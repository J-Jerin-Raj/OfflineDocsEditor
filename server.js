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
const FILE = path.join(__dirname, "doc.json");

// Middleware with generous payload limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// Load document state from disk on startup
function loadStoredDoc() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, "utf8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed.ops) {
          return { title: "Untitled Document", content: parsed };
        }
        return {
          title: parsed.title || "Untitled Document",
          content: parsed.content || { ops: [{ insert: "\n" }] }
        };
      }
    }
  } catch (err) {
    console.error("Error reading doc.json:", err);
  }
  return { title: "Untitled Document", content: { ops: [{ insert: "\n" }] } };
}

// In-memory document state
let currentDoc = loadStoredDoc();

// In-memory active collaborators: socketId -> { id, name, color, range }
const activeUsers = new Map();

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

// Debounced disk save helper
let saveTimer = null;
function scheduleDiskSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(FILE, JSON.stringify(currentDoc, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to write doc.json:", err);
    }
  }, 1000);
}

// REST Endpoints (for backward compatibility and offline fallback)
app.post("/save", (req, res) => {
  try {
    const payload = req.body;
    if (payload.title) currentDoc.title = payload.title;
    if (payload.content) currentDoc.content = payload.content;
    scheduleDiskSave();
    res.json({ status: "saved", timestamp: Date.now() });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Failed to save document" });
  }
});

app.get("/load", (req, res) => {
  res.json(currentDoc);
});

// Socket.IO Real-Time Collaboration
io.on("connection", (socket) => {
  const query = socket.handshake.query || {};
  const userColor = query.color && query.color.startsWith("#") ? query.color : assignUserColor();
  const userName = query.name && query.name.trim() ? query.name.trim() : `User ${Math.floor(100 + Math.random() * 900)}`;

  const user = {
    id: socket.id,
    name: userName,
    color: userColor,
    range: null
  };
  activeUsers.set(socket.id, user);

  // Send initial document state and current active users list
  socket.emit("init-document", {
    title: currentDoc.title,
    content: currentDoc.content,
    myUser: user,
    users: Array.from(activeUsers.values())
  });

  // Notify other collaborators of the new user
  socket.broadcast.emit("user-joined", user);

  // Real-time text changes (Quill Delta)
  socket.on("doc-change", (delta) => {
    // Broadcast delta to all other connected clients
    socket.broadcast.emit("doc-change", {
      delta,
      userId: socket.id
    });
  });

  // Full document snapshot update on debounced save
  socket.on("doc-save", (data) => {
    if (data.title) currentDoc.title = data.title;
    if (data.content) currentDoc.content = data.content;
    scheduleDiskSave();
  });

  // Real-time title change
  socket.on("title-change", (newTitle) => {
    currentDoc.title = newTitle;
    socket.broadcast.emit("title-change", {
      title: newTitle,
      userId: socket.id
    });
    scheduleDiskSave();
  });

  // Real-time cursor and selection movement
  socket.on("cursor-move", (range) => {
    if (activeUsers.has(socket.id)) {
      const u = activeUsers.get(socket.id);
      u.range = range;
      socket.broadcast.emit("cursor-move", {
        userId: socket.id,
        range,
        user: u
      });
    }
  });

  // Collaborator updates display name or color
  socket.on("user-update", (data) => {
    if (activeUsers.has(socket.id)) {
      const u = activeUsers.get(socket.id);
      if (data.name) u.name = data.name.trim();
      if (data.color) u.color = data.color;
      io.emit("user-updated", u);
    }
  });

  // Disconnection handler
  socket.on("disconnect", () => {
    activeUsers.delete(socket.id);
    socket.broadcast.emit("user-left", { userId: socket.id });
    socket.broadcast.emit("cursor-remove", { userId: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Offline Docs with Real-Time Collaboration running at http://localhost:${PORT}`);
});
