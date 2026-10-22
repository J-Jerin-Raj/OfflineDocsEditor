const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, "doc.json");

// Middleware with generous payload limit for offline docs (text + embedded images)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// Save document
app.post("/save", (req, res) => {
  try {
    const payload = req.body;
    fs.writeFileSync(FILE, JSON.stringify(payload, null, 2), "utf8");
    res.json({ status: "saved", timestamp: Date.now() });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Failed to save document" });
  }
});

// Load document
app.get("/load", (req, res) => {
  try {
    if (!fs.existsSync(FILE)) {
      return res.json({ title: "Untitled Document", content: { ops: [{ insert: "\n" }] } });
    }
    const raw = fs.readFileSync(FILE, "utf8");
    if (!raw.trim()) {
      return res.json({ title: "Untitled Document", content: { ops: [{ insert: "\n" }] } });
    }
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    console.error("Load error:", err);
    res.status(500).json({ error: "Failed to load document" });
  }
});

app.listen(PORT, () => {
  console.log(`Offline Docs running smoothly at http://localhost:${PORT}`);
});
