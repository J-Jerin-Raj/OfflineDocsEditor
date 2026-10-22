// ==========================================================================
// OFFLINE DOCS - CLIENT APPLICATION LOGIC
// ==========================================================================

(function () {
  'use strict';

  // Constants & Keys
  const STORAGE_KEY = 'offline_docs_backup_v1';
  const DEFAULT_TITLE = 'Untitled Document';

  // DOM Elements
  const docTitleInput = document.getElementById('doc-title');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const offlineBadge = document.getElementById('offline-badge');
  const wordCountEl = document.getElementById('word-count');
  const charCountEl = document.getElementById('char-count');
  const btnPrint = document.getElementById('btn-print');
  const btnExportToggle = document.getElementById('btn-export-toggle');
  const exportDropdown = document.getElementById('export-dropdown');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnExportTxt = document.getElementById('btn-export-txt');
  const btnExportHtml = document.getElementById('btn-export-html');
  const btnExportMd = document.getElementById('btn-export-md');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnNew = document.getElementById('btn-new');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const toastEl = document.getElementById('toast');

  // Initialize Quill Editor (Snow Theme, Custom Toolbar)
  const quill = new Quill('#editor', {
    modules: {
      toolbar: '#toolbar-container'
    },
    placeholder: 'Start writing your document here...',
    theme: 'snow'
  });

  // State
  let saveTimeout = null;
  let toastTimeout = null;
  let isSaving = false;

  // ==========================================================================
  // 1. PERFECT PRINT SYSTEM
  // ==========================================================================

  /**
   * Triggers browser print with zero DOM destruction.
   * Leverages pure CSS @media print for maximum performance, fidelity & speed.
   */
  function printDocument() {
    const rawTitle = docTitleInput.value.trim() || DEFAULT_TITLE;
    const previousPageTitle = document.title;

    // Set page title so browser's native print/PDF engine names the file accurately
    document.title = rawTitle;

    // Small delay ensures title is updated before print preview is generated
    setTimeout(() => {
      window.print();
      // Restore application title afterwards
      document.title = `${rawTitle} - Offline Docs`;
    }, 50);

    showToast('Print preview generated');
  }

  // Bind Print Events
  btnPrint.addEventListener('click', printDocument);
  btnExportPdf.addEventListener('click', () => {
    closeDropdown();
    printDocument();
  });

  // Set OS shortcut hint on print button
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const printKbd = document.querySelector('.btn-kbd');
  if (printKbd) {
    printKbd.textContent = isMac ? '⌘P' : 'Ctrl+P';
  }

  // Restore document title reliably when print preview closes
  window.addEventListener('afterprint', () => {
    const rawTitle = docTitleInput.value.trim() || DEFAULT_TITLE;
    document.title = `${rawTitle} - Offline Docs`;
  });

  // ==========================================================================
  // 2. STATUS & TOAST NOTIFICATIONS
  // ==========================================================================

  function updateStatus(state, message) {
    statusPill.className = 'status-pill';

    if (state === 'saving') {
      statusPill.classList.add('status-saving');
      statusText.textContent = message || 'Saving...';
    } else if (state === 'offline') {
      statusPill.classList.add('status-offline');
      statusText.textContent = message || 'Saved offline';
    } else {
      statusPill.classList.add('status-saved');
      statusText.textContent = message || 'Saved';
    }
  }

  function showToast(message, duration = 2500) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  // ==========================================================================
  // 3. STATS (WORD & CHAR COUNT)
  // ==========================================================================

  function updateStats() {
    const text = quill.getText();
    // Quill adds a trailing \n by default
    const clean = text.replace(/\n$/, '');
    const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
    const chars = clean.length;

    wordCountEl.textContent = words.toLocaleString();
    charCountEl.textContent = chars.toLocaleString();
  }

  // ==========================================================================
  // 4. STORAGE & SYNC (LOCALSTORAGE + NODE SERVER)
  // ==========================================================================

  function getDocumentData() {
    return {
      title: docTitleInput.value.trim() || DEFAULT_TITLE,
      content: quill.getContents(),
      updatedAt: new Date().toISOString()
    };
  }

  // Save to LocalStorage immediately
  function saveToLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // Save to Server via Fetch
  async function saveDoc() {
    isSaving = true;
    updateStatus('saving', 'Saving...');
    const data = getDocumentData();

    // 1. Instant local persistence
    saveToLocalStorage(data);

    // 2. Server persistence
    try {
      const response = await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        updateStatus('saved', 'Saved');
      } else {
        updateStatus('offline', 'Saved locally');
      }
    } catch (err) {
      // Server is offline / unreachable: safe local fallback
      updateStatus('offline', 'Saved locally');
    } finally {
      isSaving = false;
    }
  }

  // Debounced auto-save on typing
  function triggerAutoSave() {
    updateStatus('saving', 'Saving...');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveDoc, 750);
  }

  // Load document (Local first, then Server)
  async function loadDoc() {
    let loadedFromLocal = false;

    // Step 1: Immediate local restore
    try {
      const localDataRaw = localStorage.getItem(STORAGE_KEY);
      if (localDataRaw) {
        const localData = JSON.parse(localDataRaw);
        if (localData && (localData.content || localData.ops)) {
          applyDocData(localData);
          loadedFromLocal = true;
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }

    // Step 2: Fetch from server if available
    try {
      const res = await fetch('/load');
      if (res.ok) {
        const serverData = await res.json();
        // If server data exists and is not empty
        if (serverData) {
          applyDocData(serverData);
          saveToLocalStorage(getDocumentData());
          updateStatus('saved', 'Saved');
          return;
        }
      }
    } catch (err) {
      console.log('Server not reachable, continuing in full offline mode');
    }

    if (loadedFromLocal) {
      updateStatus('offline', 'Loaded local copy');
    } else {
      updateStatus('saved', 'Ready');
    }
  }

  // Helper to apply title and Delta content
  function applyDocData(data) {
    if (data.title) {
      docTitleInput.value = data.title;
      document.title = `${data.title} - Offline Docs`;
    }

    if (data.content && data.content.ops) {
      quill.setContents(data.content, 'silent');
    } else if (data.ops) {
      // Backward compatibility with legacy format
      quill.setContents(data, 'silent');
    }

    updateStats();
  }

  // ==========================================================================
  // 5. DOCUMENT TITLE HANDLERS
  // ==========================================================================

  docTitleInput.addEventListener('input', () => {
    const title = docTitleInput.value.trim() || DEFAULT_TITLE;
    document.title = `${title} - Offline Docs`;
    triggerAutoSave();
  });

  docTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      docTitleInput.blur();
      quill.focus();
    }
  });

  // ==========================================================================
  // 6. EXPORT UTILITIES (TXT, HTML, MD, JSON)
  // ==========================================================================

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    showToast(`Exported ${filename}`);
  }

  function getSanitizedFilename(ext) {
    const base = docTitleInput.value.trim() || DEFAULT_TITLE;
    return `${base.replace(/[/\\?%*:|"<>]/g, '_')}.${ext}`;
  }

  // Export Plain Text
  btnExportTxt.addEventListener('click', () => {
    closeDropdown();
    const text = quill.getText();
    downloadBlob(text, getSanitizedFilename('txt'), 'text/plain');
  });

  // Export Standalone HTML
  btnExportHtml.addEventListener('click', () => {
    closeDropdown();
    const title = docTitleInput.value.trim() || DEFAULT_TITLE;
    const bodyHtml = quill.root.innerHTML;
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body {
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65;
    color: #1f2937;
  }
  h1 { font-size: 26px; font-weight: 700; margin-top: 24px; }
  h2 { font-size: 20px; font-weight: 600; margin-top: 20px; }
  h3 { font-size: 16px; font-weight: 600; margin-top: 16px; }
  blockquote { border-left: 3.5px solid #2563eb; padding-left: 14px; color: #4b5563; font-style: italic; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
  img { max-width: 100%; border-radius: 4px; }
  @media print {
    body { max-width: 100%; margin: 0; padding: 0; }
  }
</style>
</head>
<body>
<h1>${title}</h1>
${bodyHtml}
</body>
</html>`;
    downloadBlob(fullHtml, getSanitizedFilename('html'), 'text/html');
  });

  // Export Markdown
  btnExportMd.addEventListener('click', () => {
    closeDropdown();
    const title = docTitleInput.value.trim() || DEFAULT_TITLE;
    let md = `# ${title}\n\n`;

    // Simple, lightweight delta to markdown converter
    const contents = quill.getContents();
    if (contents && contents.ops) {
      contents.ops.forEach((op) => {
        if (typeof op.insert === 'string') {
          let text = op.insert;
          if (op.attributes) {
            if (op.attributes.bold) text = `**${text}**`;
            if (op.attributes.italic) text = `*${text}*`;
            if (op.attributes.code) text = `\`${text}\``;
            if (op.attributes.link) text = `[${text}](${op.attributes.link})`;
          }
          md += text;
        }
      });
    } else {
      md += quill.getText();
    }

    downloadBlob(md, getSanitizedFilename('md'), 'text/markdown');
  });

  // Export JSON Backup
  btnExportJson.addEventListener('click', () => {
    closeDropdown();
    const jsonStr = JSON.stringify(getDocumentData(), null, 2);
    downloadBlob(jsonStr, getSanitizedFilename('json'), 'application/json');
  });

  // ==========================================================================
  // 7. NEW DOCUMENT ACTION
  // ==========================================================================

  btnNew.addEventListener('click', () => {
    const text = quill.getText().trim();
    if (text.length > 0) {
      const confirmNew = window.confirm('Start a new document? Unsaved changes will be replaced.');
      if (!confirmNew) return;
    }

    docTitleInput.value = DEFAULT_TITLE;
    document.title = `${DEFAULT_TITLE} - Offline Docs`;
    quill.setText('');
    saveDoc();
    updateStats();
    quill.focus();
    showToast('New document created');
  });

  // ==========================================================================
  // 8. FOCUS / FULLSCREEN MODE
  // ==========================================================================

  btnFullscreen.addEventListener('click', () => {
    document.body.classList.toggle('focus-mode');
    const isFocus = document.body.classList.contains('focus-mode');
    showToast(isFocus ? 'Focus mode enabled (Esc to exit)' : 'Focus mode disabled');
  });

  // ==========================================================================
  // 9. DROPDOWN CONTROLS
  // ==========================================================================

  function closeDropdown() {
    exportDropdown.classList.remove('open');
  }

  btnExportToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!exportDropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  // ==========================================================================
  // 10. KEYBOARD SHORTCUTS
  // ==========================================================================

  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl+P / Cmd+P -> Perfect Print
    if (modifier && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      printDocument();
      return;
    }

    // Ctrl+S / Cmd+S -> Immediate Manual Save
    if (modifier && e.key.toLowerCase() === 's') {
      e.preventDefault();
      clearTimeout(saveTimeout);
      saveDoc();
      showToast('Document saved');
      return;
    }

    // Escape -> Exit focus mode & close dropdowns
    if (e.key === 'Escape') {
      closeDropdown();
      if (document.body.classList.contains('focus-mode')) {
        document.body.classList.remove('focus-mode');
        showToast('Focus mode disabled');
      }
    }
  });

  // ==========================================================================
  // 11. ONLINE / OFFLINE DETECTION & SERVICE WORKER
  // ==========================================================================

  function updateNetworkBadge() {
    if (navigator.onLine) {
      offlineBadge.textContent = 'Offline Ready';
      offlineBadge.style.color = '#059669';
    } else {
      offlineBadge.textContent = 'Offline Mode';
      offlineBadge.style.color = '#7c3aed';
    }
  }

  window.addEventListener('online', () => {
    updateNetworkBadge();
    showToast('Back online - syncing...');
    saveDoc();
  });

  window.addEventListener('offline', () => {
    updateNetworkBadge();
    showToast('Offline mode active - auto-saving locally');
    updateStatus('offline', 'Saved locally');
  });

  updateNetworkBadge();

  // Register Service Worker for true 100% offline caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    });
  }

  // ==========================================================================
  // 12. INITIALIZATION
  // ==========================================================================

  quill.on('text-change', () => {
    updateStats();
    triggerAutoSave();
  });

  // Load document on boot
  loadDoc();

})();
