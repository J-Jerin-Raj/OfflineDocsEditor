const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const FILE = "doc.json";

// Save document
app.post("/save", (req, res) => {
  fs.writeFileSync(FILE, JSON.stringify(req.body));
  res.send({ status: "saved" });
});

// Load document
app.get("/load", (req, res) => {
  if (!fs.existsSync(FILE)) return res.send({ ops: [] });
  const data = fs.readFileSync(FILE);
  res.send(JSON.parse(data));
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));