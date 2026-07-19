const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Start writing something amazing...',
});

// Load document
async function loadDoc() {
  try {
    const res = await fetch('/load');
    const data = await res.json();
    quill.setContents(data);
  } catch (err) {
    console.error("Load failed:", err);
  }
}

// Save document
async function saveDoc() {
  try {
    await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quill.getContents())
    });
  } catch (err) {
    console.error("Save failed:", err);
  }
}

// Auto-save (optimized)
let timeout;
quill.on('text-change', () => {
  clearTimeout(timeout);
  timeout = setTimeout(saveDoc, 1000); // saves 1s after typing stops
});

// Initial load
loadDoc();