# Offline Docs

An ultra-lightweight, offline-first document editor built for easy writing, minimal memory footprint, and pixel-perfect printing.

---

## Features

- **Ultra-Low Memory & Fast Load**:
  - Uses < 20 MB of RAM (compared to 500MB+ for Google Docs).
  - Starts up instantly (< 50ms) with zero heavy framework bloat.
- **Perfect Print & PDF Engine**:
  - Native **Print** button in the header (`⌘P` on Mac, `Ctrl+P` on Windows/Linux).
  - Seamless `@media print` styling: hides UI chrome, toolbar, and background gradients.
  - Automatically formats pages with clean standard margins (`20mm 15mm`), exact typography, and smart page breaks (no orphaned headings or split code blocks).
  - Browser PDF preview names the exported PDF according to your document title.
- **100% Offline Capability**:
  - All editor vendor libraries (`quill.min.js`, `quill.snow.css`) are hosted locally with zero external CDN dependencies.
  - Service Worker (`sw.js`) caches all assets for true offline PWA functionality.
  - Dual-layer auto-save: instant synchronous saving via `localStorage` + background persistence to `doc.json`.
- **Intuitive Document Editing**:
  - In-place editable document title with instant tab synchronization.
  - Real-time word count and character count.
  - Rich text formatting: Headings, Bold, Italic, Underline, Strike, Colors, Highlights, Bullet & Numbered Lists, Alignments, Blockquotes, Code Blocks, and Links.
  - Multi-format Export: **Print / PDF**, Plain Text (`.txt`), Standalone HTML (`.html`), Markdown (`.md`), and Raw Delta Backup (`.json`).
  - Distraction-Free Focus Mode.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# or
node server.js
```

### 3. Open in Browser
Visit **`http://localhost:3000`** in your browser.

> You can also install it as a desktop app via your browser's "Install App" or "Add to Dock" button.

---

### 4. Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌘P` / `Ctrl+P` | **Print / Save to PDF** |
| `⌘S` / `Ctrl+S` | **Save immediately** |
| `⌘B` / `Ctrl+B` | **Bold** |
| `⌘I` / `Ctrl+I` | **Italic** |
| `⌘U` / `Ctrl+U` | **Underline** |
| `Esc` | **Exit Focus Mode / Close menus** |
