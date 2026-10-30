const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 5e7 // 50MB payload limit
});

const PORT = process.env.PORT || 3000;
const DOCS_DIR = path.join(__dirname, "documents");
const LEGACY_FILE = path.join(__dirname, "doc.json");

// Ensure documents directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Route shortcut: /d/:id redirects to /?doc=:id
app.get("/d/:id", (req, res) => {
  const cleanId = String(req.params.id || "").replace(/\D/g, "").slice(0, 8);
  if (cleanId.length === 8) {
    return res.redirect(`/?doc=${cleanId}`);
  }
  res.redirect("/");
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// In-memory document storage: docId -> document object
const documents = new Map();

// In-memory rooms: docId -> Map<socketId, userObj>
const roomUsers = new Map();

// Color palette for collaborator cursors and avatars
const PRESET_COLORS = [
  '#ea4335', // Google Red
  '#1a73e8', // Google Blue
  '#34a853', // Google Green
  '#f9ab00', // Google Amber
  '#9334e6', // Purple
  '#e52592', // Magenta/Pink
  '#00897b', // Teal
  '#f4511e', // Orange
  '#3949ab', // Indigo
  '#00acc1'  // Cyan
];

let colorIndex = 0;
function assignUserColor() {
  const color = PRESET_COLORS[colorIndex % PRESET_COLORS.length];
  colorIndex++;
  return color;
}

// Helper: Sanitize 8-digit document ID
function sanitizeDocId(rawId) {
  if (!rawId) return null;
  const digits = String(rawId).replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

// Helper: Generate unique 8-digit document ID
function generateUniqueDocId() {
  let docId;
  let attempts = 0;
  do {
    docId = Math.floor(10000000 + Math.random() * 90000000).toString();
    attempts++;
  } while ((documents.has(docId) || fs.existsSync(getDocPath(docId))) && attempts < 100);
  return docId;
}

function getDocPath(docId) {
  return path.join(DOCS_DIR, `${docId}.json`);
}

// Migrate legacy doc.json if present and documents directory is empty
function checkLegacyDoc() {
  try {
    const existingDocs = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith(".json"));
    if (existingDocs.length === 0 && fs.existsSync(LEGACY_FILE)) {
      const raw = fs.readFileSync(LEGACY_FILE, "utf8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        const defaultId = "10000000";
        const docObj = {
          id: defaultId,
          title: parsed.title || "Untitled Document",
          content: parsed.content || (parsed.ops ? parsed : { ops: [{ insert: "\n" }] }),
          password: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(getDocPath(defaultId), JSON.stringify(docObj, null, 2), "utf8");
        documents.set(defaultId, docObj);
        console.log(`Migrated legacy doc.json to document ID ${defaultId}`);
      }
    }
  } catch (err) {
    console.error("Error migrating legacy doc.json:", err);
  }
}
checkLegacyDoc();

// Load or retrieve document from memory/disk
function getOrLoadDoc(docId) {
  const cleanId = sanitizeDocId(docId);
  if (!cleanId) return null;

  if (documents.has(cleanId)) {
    return documents.get(cleanId);
  }

  const filePath = getDocPath(cleanId);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const docObj = {
        id: cleanId,
        title: parsed.title || "Untitled Document",
        content: parsed.content || { ops: [{ insert: "\n" }] },
        password: parsed.password || null,
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
      documents.set(cleanId, docObj);
      return docObj;
    } catch (err) {
      console.error(`Error reading doc ${cleanId} from disk:`, err);
    }
  }
  return null;
}

// Create new document on server
function createDoc(docId, password, initialData) {
  const cleanId = sanitizeDocId(docId) || generateUniqueDocId();
  const docObj = {
    id: cleanId,
    title: (initialData && initialData.title) ? initialData.title : "Untitled Document",
    content: (initialData && initialData.content) ? initialData.content : { ops: [{ insert: "\n" }] },
    password: (password && String(password).trim().length > 0) ? String(password).trim() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  documents.set(cleanId, docObj);
  saveDocToDisk(cleanId);
  return docObj;
}

// Debounced disk save helper per document
const saveTimers = new Map();
function scheduleDocDiskSave(docId) {
  const cleanId = sanitizeDocId(docId);
  if (!cleanId) return;

  if (saveTimers.has(cleanId)) {
    clearTimeout(saveTimers.get(cleanId));
  }

  const timer = setTimeout(() => {
    saveDocToDisk(cleanId);
    saveTimers.delete(cleanId);
  }, 1000);
  saveTimers.set(cleanId, timer);
}

function saveDocToDisk(docId) {
  const cleanId = sanitizeDocId(docId);
  if (!cleanId) return;
  const doc = documents.get(cleanId);
  if (!doc) return;
  try {
    fs.writeFileSync(getDocPath(cleanId), JSON.stringify(doc, null, 2), "utf8");
  } catch (err) {
    console.error(`Failed to write doc ${cleanId} to disk:`, err);
  }
}

// Room users helper
function getRoomUsers(docId) {
  const usersMap = roomUsers.get(docId);
  return usersMap ? Array.from(usersMap.values()) : [];
}

function addUserToRoom(docId, socketId, user) {
  if (!roomUsers.has(docId)) {
    roomUsers.set(docId, new Map());
  }
  roomUsers.get(docId).set(socketId, user);
}

function removeUserFromRoom(docId, socketId) {
  if (roomUsers.has(docId)) {
    const usersMap = roomUsers.get(docId);
    usersMap.delete(socketId);
    if (usersMap.size === 0) {
      roomUsers.delete(docId);
    }
  }
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// Generate a new available 8-digit ID
app.get("/api/new-id", (req, res) => {
  res.json({ id: generateUniqueDocId() });
});

// Check if document exists and whether it requires a password
app.get("/api/docs/:id/info", (req, res) => {
  const cleanId = sanitizeDocId(req.params.id);
  if (!cleanId) {
    return res.status(400).json({ error: "Invalid 8-digit document ID" });
  }
  const doc = getOrLoadDoc(cleanId);
  if (!doc) {
    return res.json({ exists: false, id: cleanId });
  }
  res.json({
    exists: true,
    id: cleanId,
    title: doc.title,
    hasPassword: !!(doc.password && doc.password.trim())
  });
});

// Backward-compatible load / save endpoints
app.get("/load", (req, res) => {
  const docId = sanitizeDocId(req.query.doc) || "10000000";
  let doc = getOrLoadDoc(docId);
  if (!doc) {
    doc = createDoc(docId, null, null);
  }
  res.json(doc);
});

app.post("/save", (req, res) => {
  const docId = sanitizeDocId(req.body.id || req.query.doc) || "10000000";
  let doc = getOrLoadDoc(docId);
  if (!doc) {
    doc = createDoc(docId, null, req.body);
  } else {
    if (req.body.title) doc.title = req.body.title;
    if (req.body.content) doc.content = req.body.content;
    doc.updatedAt = new Date().toISOString();
    scheduleDocDiskSave(docId);
  }
  res.json({ status: "saved", docId });
});

// ============================================================================
// SOCKET.IO REAL-TIME COLLABORATION & PASSWORD PROTECTION
// ============================================================================

io.on("connection", (socket) => {
  const query = socket.handshake.query || {};
  let currentDocId = null;
  let currentUser = null;

  // Handle client joining a document room with ID & optional password
  socket.on("join-document", (data, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};
    let targetId = sanitizeDocId(data && data.docId);

    // If no valid 8-digit ID provided, generate one
    if (!targetId) {
      targetId = generateUniqueDocId();
    }

    const userName = (data && data.name && data.name.trim()) ? data.name.trim() : `User ${Math.floor(100 + Math.random() * 900)}`;
    const userColor = (data && data.color && data.color.startsWith("#")) ? data.color : assignUserColor();
    const providedPassword = (data && data.password && typeof data.password === "string") ? data.password.trim() : "";
    const setPassword = (data && data.setPassword && typeof data.setPassword === "string") ? data.setPassword.trim() : null;

    let doc = getOrLoadDoc(targetId);

    // 1. Document does NOT exist yet -> Create it
    if (!doc) {
      doc = createDoc(targetId, setPassword || providedPassword, null);
    } else {
      // 2. Document DOES exist and is protected with a password
      const docHasPass = !!(doc.password && doc.password.trim().length > 0);
      if (docHasPass) {
        if (!providedPassword || providedPassword !== doc.password) {
          const isIncorrect = providedPassword.length > 0;
          socket.emit("password-required", {
            docId: targetId,
            title: doc.title,
            isIncorrect
          });
          return ack({ success: false, requiresPassword: true, isIncorrect });
        }
      } else if (setPassword && setPassword.length > 0) {
        // Document had no password yet, but user set one now
        doc.password = setPassword;
        scheduleDocDiskSave(targetId);
      }
    }

    // Leave any previous room
    if (currentDocId) {
      socket.leave(currentDocId);
      removeUserFromRoom(currentDocId, socket.id);
      socket.to(currentDocId).emit("user-left", { userId: socket.id });
      socket.to(currentDocId).emit("cursor-remove", { userId: socket.id });
    }

    // Join the target document room
    currentDocId = targetId;
    socket.join(targetId);

    currentUser = {
      id: socket.id,
      name: userName,
      color: userColor,
      range: null
    };

    addUserToRoom(targetId, socket.id, currentUser);

    const hasPassword = !!(doc.password && doc.password.trim().length > 0);

    // Send initial document state to the joined user
    socket.emit("init-document", {
      docId: targetId,
      title: doc.title,
      content: doc.content,
      hasPassword,
      myUser: currentUser,
      users: getRoomUsers(targetId)
    });

    // Notify other collaborators in the same document room
    socket.to(targetId).emit("user-joined", currentUser);

    ack({
      success: true,
      docId: targetId,
      hasPassword
    });
  });

  // Real-time text changes (Quill Delta)
  socket.on("doc-change", (delta) => {
    if (!currentDocId) return;
    socket.to(currentDocId).emit("doc-change", {
      delta,
      userId: socket.id
    });
  });

  // Document snapshot save
  socket.on("doc-save", (data) => {
    if (!currentDocId) return;
    const doc = documents.get(currentDocId);
    if (!doc) return;

    if (data.title) doc.title = data.title;
    if (data.content) doc.content = data.content;
    doc.updatedAt = new Date().toISOString();
    scheduleDocDiskSave(currentDocId);
  });

  // Title change
  socket.on("title-change", (newTitle) => {
    if (!currentDocId) return;
    const doc = documents.get(currentDocId);
    if (!doc) return;

    doc.title = newTitle;
    doc.updatedAt = new Date().toISOString();
    socket.to(currentDocId).emit("title-change", {
      title: newTitle,
      userId: socket.id
    });
    scheduleDocDiskSave(currentDocId);
  });

  // Cursor movement
  socket.on("cursor-move", (range) => {
    if (!currentDocId || !currentUser) return;
    currentUser.range = range;
    socket.to(currentDocId).emit("cursor-move", {
      userId: socket.id,
      range,
      user: currentUser
    });
  });

  // Update collaborator profile (display name or color)
  socket.on("user-update", (data) => {
    if (!currentDocId || !currentUser) return;
    if (data.name) currentUser.name = data.name.trim();
    if (data.color) currentUser.color = data.color;
    io.to(currentDocId).emit("user-updated", currentUser);
  });

  // Set / Change / Remove Document Password
  socket.on("set-doc-password", (data, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};
    if (!currentDocId) return ack({ success: false, error: "No active document" });

    const doc = documents.get(currentDocId);
    if (!doc) return ack({ success: false, error: "Document not found" });

    const currentPass = doc.password;
    const inputCurrent = (data && data.currentPassword) ? String(data.currentPassword).trim() : "";
    const newPass = (data && data.newPassword) ? String(data.newPassword).trim() : null;

    // Verify current password if already protected
    if (currentPass && currentPass.length > 0 && inputCurrent !== currentPass) {
      return ack({ success: false, error: "Current password does not match" });
    }

    doc.password = (newPass && newPass.length > 0) ? newPass : null;
    doc.updatedAt = new Date().toISOString();
    scheduleDocDiskSave(currentDocId);

    const hasPassword = !!(doc.password && doc.password.length > 0);
    io.to(currentDocId).emit("doc-security-updated", { hasPassword });

    ack({ success: true, hasPassword });
  });

  // Disconnection handler
  socket.on("disconnect", () => {
    if (currentDocId) {
      removeUserFromRoom(currentDocId, socket.id);
      socket.to(currentDocId).emit("user-left", { userId: socket.id });
      socket.to(currentDocId).emit("cursor-remove", { userId: socket.id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Offline Docs running at http://localhost:${PORT}`);
});
