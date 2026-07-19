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

// print function
async function dprint(){
  let cont=document.querySelector(".ql-editor").innerHTML;

  let aphead=document.head.innerHTML
  let apbody=document.body.innerHTML

  document.head.innerHTML=""
  document.body.innerHTML=cont

  window.print();

  document.head.innerHTML=aphead
  document.body.innerHTML=apbody
}

// Auto-save (optimized)
let timeout;
quill.on('text-change', () => {
  clearTimeout(timeout);
  timeout = setTimeout(saveDoc, 1000); // saves 1s after typing stops
});

// Initial load
loadDoc();
