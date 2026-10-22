// ==========================================================================
// OFFLINE DOCS - CLIENT APPLICATION LOGIC
// ==========================================================================

(function () {
  'use strict';

  // Constants & Keys
  const STORAGE_KEY = 'offline_docs_backup_v1';
  const DEFAULT_TITLE = 'Untitled Document';

  // DOM Elements (Desktop & Mobile)
  const docTitleInput = document.getElementById('doc-title');
  const mobileDocTitleInput = document.getElementById('mobile-doc-title');
  
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const mobileStatusPill = document.getElementById('mobile-status-pill');
  const mobileStatusText = document.getElementById('mobile-status-text');
  const offlineBadge = document.getElementById('offline-badge');
  
  const wordCountEl = document.getElementById('word-count');
  const charCountEl = document.getElementById('char-count');
  const mobileWordCountEl = document.getElementById('mobile-word-count');
  const mobileCharCountEl = document.getElementById('mobile-char-count');
  
  const btnPrint = document.getElementById('btn-print');
  
  // Desktop Export Dropdown
  const btnExportToggle = document.getElementById('btn-export-toggle');
  const exportDropdown = document.getElementById('export-dropdown');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnExportTxt = document.getElementById('btn-export-txt');
  const btnExportHtml = document.getElementById('btn-export-html');
  const btnExportMd = document.getElementById('btn-export-md');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnNew = document.getElementById('btn-new');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // Mobile More Menu Dropdown
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const mobileMenuDropdown = document.getElementById('mobile-menu-dropdown');
  const btnMobileNew = document.getElementById('btn-mobile-new');
  const btnMobileFocus = document.getElementById('btn-mobile-focus');
  const btnMobilePdf = document.getElementById('btn-mobile-pdf');
  const btnMobileTxt = document.getElementById('btn-mobile-txt');
  const btnMobileHtml = document.getElementById('btn-mobile-html');
  const btnMobileMd = document.getElementById('btn-mobile-md');
  const btnMobileJson = document.getElementById('btn-mobile-json');

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
    const rawTitle = getCurrentTitle();
    const previousPageTitle = document.title;

    // Set page title so browser's native print/PDF engine names the file accurately
    document.title = rawTitle;

    // Small delay ensures title is updated before print preview is generated
    setTimeout(() => {
      window.print();
      // Restore application title afterwards
      document.title = `${rawTitle} - Offline Docs`;
    }, 60);

    showToast('Print preview generated');
  }

  // Bind Print Events
  btnPrint.addEventListener('click', printDocument);

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      closeAllDropdowns();
      printDocument();
    });
  }

  if (btnMobilePdf) {
    btnMobilePdf.addEventListener('click', () => {
      closeAllDropdowns();
      printDocument();
    });
  }

  // Set OS shortcut hint on print button
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const printKbd = document.querySelector('.btn-kbd');
  if (printKbd) {
    printKbd.textContent = isMac ? '⌘P' : 'Ctrl+P';
  }

  // Restore document title reliably when print preview closes
  window.addEventListener('afterprint', () => {
    const rawTitle = getCurrentTitle();
    document.title = `${rawTitle} - Offline Docs`;
  });

  // ==========================================================================
  // 2. STATUS & TOAST NOTIFICATIONS
  // ==========================================================================

  function updateStatus(state, message) {
    const pills = [statusPill, mobileStatusPill].filter(Boolean);
    const texts = [statusText, mobileStatusText].filter(Boolean);

    pills.forEach((pill) => {
      pill.className = 'status-pill';
      if (state === 'saving') {
        pill.classList.add('status-saving');
      } else if (state === 'offline') {
        pill.classList.add('status-offline');
      } else {
        pill.classList.add('status-saved');
      }
    });

    const displayMsg = message || (state === 'saving' ? 'Saving...' : state === 'offline' ? 'Saved offline' : 'Saved');
    texts.forEach((txt) => {
      txt.textContent = displayMsg;
    });
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
    const clean = text.replace(/\n$/, '');
    const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
    const chars = clean.length;

    const formattedWords = words.toLocaleString();
    const formattedChars = chars.toLocaleString();

    if (wordCountEl) wordCountEl.textContent = formattedWords;
    if (charCountEl) charCountEl.textContent = formattedChars;
    if (mobileWordCountEl) mobileWordCountEl.textContent = formattedWords;
    if (mobileCharCountEl) mobileCharCountEl.textContent = formattedChars;
  }

  // ==========================================================================
  // 4. TITLE SYNC (DESKTOP & MOBILE INPUTS)
  // ==========================================================================

  function getCurrentTitle() {
    if (docTitleInput && docTitleInput.value.trim()) {
      return docTitleInput.value.trim();
    }
    if (mobileDocTitleInput && mobileDocTitleInput.value.trim()) {
      return mobileDocTitleInput.value.trim();
    }
    return DEFAULT_TITLE;
  }

  function setTitle(newTitle) {
    const clean = newTitle || DEFAULT_TITLE;
    if (docTitleInput) docTitleInput.value = clean;
    if (mobileDocTitleInput) mobileDocTitleInput.value = clean;
    document.title = `${clean} - Offline Docs`;
  }

  function handleTitleInput(sourceInput) {
    const title = sourceInput.value.trim() || DEFAULT_TITLE;
    setTitle(title);
    triggerAutoSave();
  }

  if (docTitleInput) {
    docTitleInput.addEventListener('input', () => handleTitleInput(docTitleInput));
    docTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        docTitleInput.blur();
        quill.focus();
      }
    });
  }

  if (mobileDocTitleInput) {
    mobileDocTitleInput.addEventListener('input', () => handleTitleInput(mobileDocTitleInput));
    mobileDocTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        mobileDocTitleInput.blur();
        quill.focus();
      }
    });
  }

  // ==========================================================================
  // 5. STORAGE & SYNC (LOCALSTORAGE + NODE SERVER)
  // ==========================================================================

  function getDocumentData() {
    return {
      title: getCurrentTitle(),
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
      setTitle(data.title);
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
    const base = getCurrentTitle();
    return `${base.replace(/[/\\?%*:|"<>]/g, '_')}.${ext}`;
  }

  function exportTxt() {
    closeAllDropdowns();
    const text = quill.getText();
    downloadBlob(text, getSanitizedFilename('txt'), 'text/plain');
  }

  function exportHtml() {
    closeAllDropdowns();
    const title = getCurrentTitle();
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
  }

  function exportMd() {
    closeAllDropdowns();
    const title = getCurrentTitle();
    let md = `# ${title}\n\n`;

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
  }

  function exportJson() {
    closeAllDropdowns();
    const jsonStr = JSON.stringify(getDocumentData(), null, 2);
    downloadBlob(jsonStr, getSanitizedFilename('json'), 'application/json');
  }

  // Bind Export Listeners (Desktop & Mobile)
  if (btnExportTxt) btnExportTxt.addEventListener('click', exportTxt);
  if (btnMobileTxt) btnMobileTxt.addEventListener('click', exportTxt);

  if (btnExportHtml) btnExportHtml.addEventListener('click', exportHtml);
  if (btnMobileHtml) btnMobileHtml.addEventListener('click', exportHtml);

  if (btnExportMd) btnExportMd.addEventListener('click', exportMd);
  if (btnMobileMd) btnMobileMd.addEventListener('click', exportMd);

  if (btnExportJson) btnExportJson.addEventListener('click', exportJson);
  if (btnMobileJson) btnMobileJson.addEventListener('click', exportJson);

  // ==========================================================================
  // 7. NEW DOCUMENT ACTION
  // ==========================================================================

  function startNewDocument() {
    closeAllDropdowns();
    const text = quill.getText().trim();
    if (text.length > 0) {
      const confirmNew = window.confirm('Start a new document? Unsaved changes will be cleared.');
      if (!confirmNew) return;
    }

    setTitle(DEFAULT_TITLE);
    quill.setText('');
    saveDoc();
    updateStats();
    quill.focus();
    showToast('New document created');
  }

  if (btnNew) btnNew.addEventListener('click', startNewDocument);
  if (btnMobileNew) btnMobileNew.addEventListener('click', startNewDocument);

  // ==========================================================================
  // 8. FOCUS / FULLSCREEN MODE
  // ==========================================================================

  function toggleFocusMode() {
    closeAllDropdowns();
    document.body.classList.toggle('focus-mode');
    const isFocus = document.body.classList.contains('focus-mode');
    showToast(isFocus ? 'Focus mode enabled (Esc to exit)' : 'Focus mode disabled');
  }

  if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFocusMode);
  if (btnMobileFocus) btnMobileFocus.addEventListener('click', toggleFocusMode);

  // ==========================================================================
  // 9. DROPDOWN CONTROLS
  // ==========================================================================

  function closeAllDropdowns() {
    if (exportDropdown) exportDropdown.classList.remove('open');
    if (mobileMenuDropdown) mobileMenuDropdown.classList.remove('open');
  }

  if (btnExportToggle) {
    btnExportToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mobileMenuDropdown) mobileMenuDropdown.classList.remove('open');
      exportDropdown.classList.toggle('open');
    });
  }

  if (btnMobileMenu) {
    btnMobileMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (exportDropdown) exportDropdown.classList.remove('open');
      mobileMenuDropdown.classList.toggle('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (exportDropdown && exportDropdown.contains(e.target)) return;
    if (mobileMenuDropdown && mobileMenuDropdown.contains(e.target)) return;
    closeAllDropdowns();
  });

  // ==========================================================================
  // 10. KEYBOARD SHORTCUTS
  // ==========================================================================

  window.addEventListener('keydown', (e) => {
    const isMacPlatform = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMacPlatform ? e.metaKey : e.ctrlKey;

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
      closeAllDropdowns();
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
    if (!offlineBadge) return;
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
