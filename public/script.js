// ==========================================================================
// OFFLINE DOCS - REAL-TIME COLLABORATION & CLIENT LOGIC
// ==========================================================================

(function () {
  'use strict';

  // Constants & Storage Keys
  const STORAGE_KEY = 'offline_docs_backup_v1';
  const USER_STORAGE_KEY = 'offline_docs_user_info_v1';
  const DEFAULT_TITLE = 'Untitled Document';

  // Preset Colors for Collaborators
  const COLLAB_COLORS = [
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
  
  // Collaborators UI
  const collaboratorsList = document.getElementById('collaborators-list');
  const mobileCollabCount = document.getElementById('mobile-collab-count');
  const btnChangeName = document.getElementById('btn-change-name');

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

  // ==========================================================================
  // 1. LOCAL USER PROFILE MANAGEMENT
  // ==========================================================================

  function getLocalUserProfile() {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name) return parsed;
      }
    } catch (e) {}

    const randomNum = Math.floor(100 + Math.random() * 900);
    const randomColor = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
    const profile = {
      name: `User ${randomNum}`,
      color: randomColor
    };

    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {}
    return profile;
  }

  const myProfile = getLocalUserProfile();
  let myUserId = null;

  // ==========================================================================
  // 2. QUILL EDITOR INITIALIZATION
  // ==========================================================================

  const quill = new Quill('#editor', {
    modules: {
      toolbar: '#toolbar-container'
    },
    placeholder: 'Start writing your document here...',
    theme: 'snow'
  });

  const Delta = Quill.import('delta');

  // Ensure remote cursor overlay container exists inside Quill container
  let cursorOverlay = document.getElementById('cursor-overlay');
  if (!cursorOverlay) {
    cursorOverlay = document.createElement('div');
    cursorOverlay.id = 'cursor-overlay';
    cursorOverlay.className = 'cursor-overlay no-print';
    quill.container.appendChild(cursorOverlay);
  }

  // Active remote users map: userId -> { id, name, color, range, idleTimer }
  const remoteUsers = new Map();

  // State
  let saveTimeout = null;
  let toastTimeout = null;
  let isSaving = false;

  // ==========================================================================
  // 3. SOCKET.IO REAL-TIME COLLABORATION SETUP
  // ==========================================================================

  let socket = null;

  if (typeof io !== 'undefined') {
    socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      query: {
        name: myProfile.name,
        color: myProfile.color || ''
      }
    });

    socket.on('connect', () => {
      myUserId = socket.id;
      updateStatus('saved', 'Connected');
      updateCollaboratorAvatars();
      // Send current cursor location if focused
      const sel = quill.getSelection();
      if (sel) {
        socket.emit('cursor-move', sel);
      }
    });

    socket.on('disconnect', () => {
      updateStatus('offline', 'Offline');
      // Clear remote cursors when disconnected
      clearAllRemoteCursors();
      updateCollaboratorAvatars();
    });

    // Initial document sync from server
    socket.on('init-document', (data) => {
      myUserId = data.myUser.id;
      if (data.myUser.color) {
        myProfile.color = data.myUser.color;
        try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(myProfile)); } catch (e) {}
      }

      // Apply title
      if (data.title) {
        setTitle(data.title);
      }

      // Apply document content
      if (data.content) {
        applyDocData(data.content);
        saveToLocalStorage(getDocumentData());
      }

      // Initialize existing collaborators
      remoteUsers.clear();
      if (Array.isArray(data.users)) {
        data.users.forEach((u) => {
          if (u.id !== myUserId) {
            remoteUsers.set(u.id, u);
          }
        });
      }

      updateCollaboratorAvatars();
      renderAllRemoteCursors();
      updateStatus('saved', 'Saved');
    });

    // Another collaborator joined
    socket.on('user-joined', (user) => {
      if (user.id !== myUserId) {
        remoteUsers.set(user.id, user);
        updateCollaboratorAvatars();
        showToast(`${user.name} joined`);
      }
    });

    // Collaborator disconnected
    socket.on('user-left', ({ userId }) => {
      const u = remoteUsers.get(userId);
      if (u) {
        showToast(`${u.name} left`);
        removeCursorElements(userId);
        remoteUsers.delete(userId);
        updateCollaboratorAvatars();
      }
    });

    // Collaborator updated display name or color
    socket.on('user-updated', (user) => {
      if (user.id === myUserId) {
        myProfile.name = user.name;
        myProfile.color = user.color;
        try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(myProfile)); } catch (e) {}
      } else if (remoteUsers.has(user.id)) {
        const u = remoteUsers.get(user.id);
        u.name = user.name;
        u.color = user.color;
        renderRemoteCursor(u);
      }
      updateCollaboratorAvatars();
    });

    // Real-time document edit received from a collaborator
    socket.on('doc-change', ({ delta, userId }) => {
      // 1. Apply delta locally using 'api' source to prevent echo loop
      quill.updateContents(delta, 'api');

      // 2. Transform remote cursors based on the incoming delta
      if (Delta) {
        const deltaObj = new Delta(delta);
        remoteUsers.forEach((u) => {
          if (u.range && typeof u.range.index === 'number') {
            u.range.index = deltaObj.transformPosition(u.range.index);
          }
        });
        renderAllRemoteCursors();
      }

      // 3. Update word/char statistics and save local copy
      updateStats();
      saveToLocalStorage(getDocumentData());
      updateStatus('saved', 'Saved');
    });

    // Real-time document title change
    socket.on('title-change', ({ title, userId }) => {
      setTitle(title);
      saveToLocalStorage(getDocumentData());
    });

    // Real-time cursor/selection update from a collaborator
    socket.on('cursor-move', ({ userId, range, user }) => {
      if (userId === myUserId) return;
      let existing = remoteUsers.get(userId);
      if (!existing) {
        existing = user || { id: userId, name: 'Collaborator', color: '#1a73e8' };
        remoteUsers.set(userId, existing);
        updateCollaboratorAvatars();
      }
      existing.range = range;
      if (user && user.name) existing.name = user.name;
      if (user && user.color) existing.color = user.color;
      renderRemoteCursor(existing);
    });

    // Remove remote cursor
    socket.on('cursor-remove', ({ userId }) => {
      removeCursorElements(userId);
    });
  }

  // ==========================================================================
  // 4. REMOTE CURSOR & SELECTION RENDERING ENGINE
  // ==========================================================================

  function renderRemoteCursor(user) {
    if (!user || !user.range) {
      removeCursorElements(user.id);
      return;
    }

    const docLength = quill.getLength();
    const rawIndex = user.range.index;
    if (typeof rawIndex !== 'number') {
      removeCursorElements(user.id);
      return;
    }

    const safeIndex = Math.min(Math.max(0, rawIndex), Math.max(0, docLength - 1));
    
    // Caret index (at end of selection if length > 0)
    const caretIndex = user.range.length ? Math.min(safeIndex + user.range.length, docLength - 1) : safeIndex;
    const bounds = quill.getBounds(caretIndex);
    if (!bounds) return;

    // 1. Caret & Name Flag DOM
    let cursorEl = document.getElementById(`remote-cursor-${user.id}`);
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = `remote-cursor-${user.id}`;
      cursorEl.className = 'remote-cursor is-active';

      const caret = document.createElement('div');
      caret.className = 'remote-cursor-caret';
      caret.style.backgroundColor = user.color;

      const flag = document.createElement('div');
      flag.className = 'remote-cursor-flag';
      flag.style.backgroundColor = user.color;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'remote-cursor-name';
      nameSpan.textContent = user.name;

      flag.appendChild(nameSpan);
      cursorEl.appendChild(caret);
      cursorEl.appendChild(flag);
      cursorOverlay.appendChild(cursorEl);
    }

    // Position cursor
    cursorEl.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0)`;

    const caretEl = cursorEl.querySelector('.remote-cursor-caret');
    if (caretEl) {
      caretEl.style.height = `${bounds.height}px`;
      caretEl.style.backgroundColor = user.color;
    }

    const flagEl = cursorEl.querySelector('.remote-cursor-flag');
    if (flagEl) {
      flagEl.style.backgroundColor = user.color;
      const nameEl = flagEl.querySelector('.remote-cursor-name');
      if (nameEl) nameEl.textContent = user.name;
      // Flip flag below caret if near top edge of paper
      if (bounds.top < 22) {
        flagEl.classList.add('flip-down');
      } else {
        flagEl.classList.remove('flip-down');
      }
    }

    // Highlight as active, then idle fade after 3.5s
    cursorEl.classList.add('is-active');
    cursorEl.classList.remove('is-idle');
    clearTimeout(user.idleTimer);
    user.idleTimer = setTimeout(() => {
      cursorEl.classList.remove('is-active');
      cursorEl.classList.add('is-idle');
    }, 3500);

    // 2. Selection Highlight (if range.length > 0)
    let selEl = document.getElementById(`remote-sel-${user.id}`);
    if (user.range.length > 0) {
      const selLength = Math.min(user.range.length, docLength - safeIndex);
      const selBounds = quill.getBounds(safeIndex, selLength);
      if (selBounds) {
        if (!selEl) {
          selEl = document.createElement('div');
          selEl.id = `remote-sel-${user.id}`;
          selEl.className = 'remote-selection';
          cursorOverlay.appendChild(selEl);
        }
        selEl.style.left = `${selBounds.left}px`;
        selEl.style.top = `${selBounds.top}px`;
        selEl.style.width = `${selBounds.width}px`;
        selEl.style.height = `${selBounds.height}px`;
        selEl.style.backgroundColor = user.color;
      }
    } else if (selEl) {
      selEl.remove();
    }
  }

  function removeCursorElements(userId) {
    const cursorEl = document.getElementById(`remote-cursor-${userId}`);
    if (cursorEl) cursorEl.remove();
    const selEl = document.getElementById(`remote-sel-${userId}`);
    if (selEl) selEl.remove();
  }

  function clearAllRemoteCursors() {
    if (cursorOverlay) {
      cursorOverlay.innerHTML = '';
    }
  }

  function renderAllRemoteCursors() {
    remoteUsers.forEach((user) => {
      renderRemoteCursor(user);
    });
  }

  // Re-calculate bounds whenever window resizes or document structure adjusts
  window.addEventListener('resize', renderAllRemoteCursors);

  // ==========================================================================
  // 5. COLLABORATOR AVATARS & PRESENCE BAR
  // ==========================================================================

  function updateCollaboratorAvatars() {
    if (!collaboratorsList) return;
    collaboratorsList.innerHTML = '';

    const allUsers = [];

    // Local user
    allUsers.push({
      id: myUserId || 'local',
      name: myProfile.name,
      color: myProfile.color || '#1a73e8',
      isMe: true
    });

    // Remote users
    remoteUsers.forEach((u) => {
      allUsers.push({
        id: u.id,
        name: u.name,
        color: u.color,
        isMe: false
      });
    });

    if (mobileCollabCount) {
      mobileCollabCount.textContent = `${allUsers.length} user${allUsers.length === 1 ? '' : 's'} active`;
    }

    allUsers.forEach((u) => {
      const avatar = document.createElement('div');
      avatar.className = `collaborator-avatar ${u.isMe ? 'is-me' : ''}`;
      avatar.style.backgroundColor = u.color;
      avatar.title = u.isMe ? `${u.name} (You - Click to change name)` : u.name;

      const initials = u.name
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';

      avatar.textContent = initials;

      if (u.isMe) {
        avatar.addEventListener('click', promptChangeName);
      }
      collaboratorsList.appendChild(avatar);
    });
  }

  function promptChangeName() {
    const current = myProfile.name || 'User';
    const newName = window.prompt('Enter your display name for collaborators:', current);
    if (newName && newName.trim() && newName.trim() !== current) {
      const clean = newName.trim();
      myProfile.name = clean;
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(myProfile));
      } catch (e) {}

      if (socket && socket.connected) {
        socket.emit('user-update', { name: clean });
      }
      updateCollaboratorAvatars();
      showToast(`Display name set to "${clean}"`);
    }
  }

  if (btnChangeName) {
    btnChangeName.addEventListener('click', promptChangeName);
  }

  // ==========================================================================
  // 6. PERFECT PRINT SYSTEM
  // ==========================================================================

  function printDocument() {
    const rawTitle = getCurrentTitle();
    document.title = rawTitle;

    setTimeout(() => {
      window.print();
      document.title = `${rawTitle} - Offline Docs`;
    }, 60);

    showToast('Print preview generated');
  }

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

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const printKbd = document.querySelector('.btn-kbd');
  if (printKbd) {
    printKbd.textContent = isMac ? '⌘P' : 'Ctrl+P';
  }

  window.addEventListener('afterprint', () => {
    const rawTitle = getCurrentTitle();
    document.title = `${rawTitle} - Offline Docs`;
  });

  // ==========================================================================
  // 7. STATUS & TOAST NOTIFICATIONS
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
  // 8. STATS (WORD & CHAR COUNT)
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
  // 9. TITLE SYNC (DESKTOP & MOBILE INPUTS)
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
    if (socket && socket.connected) {
      socket.emit('title-change', title);
    }
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
  // 10. STORAGE & PERSISTENCE (LOCALSTORAGE + SERVER)
  // ==========================================================================

  function getDocumentData() {
    return {
      title: getCurrentTitle(),
      content: quill.getContents(),
      updatedAt: new Date().toISOString()
    };
  }

  function saveToLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  async function saveDoc() {
    isSaving = true;
    updateStatus('saving', 'Saving...');
    const data = getDocumentData();

    // 1. Instant local persistence
    saveToLocalStorage(data);

    // 2. Real-time server snapshot emit
    if (socket && socket.connected) {
      socket.emit('doc-save', data);
      updateStatus('saved', 'Saved');
      isSaving = false;
      return;
    }

    // 3. REST fallback if socket is disconnected
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
      updateStatus('offline', 'Saved locally');
    } finally {
      isSaving = false;
    }
  }

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

    // Step 2: Fetch from server if Socket hasn't already provided it
    try {
      const res = await fetch('/load');
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && (serverData.content || serverData.ops)) {
          applyDocData(serverData);
          saveToLocalStorage(getDocumentData());
          updateStatus('saved', 'Saved');
          return;
        }
      }
    } catch (err) {
      console.log('Server fetch offline, using local store');
    }

    if (loadedFromLocal) {
      updateStatus('offline', 'Loaded local copy');
    } else {
      updateStatus('saved', 'Ready');
    }
  }

  function applyDocData(data) {
    if (data.title) {
      setTitle(data.title);
    }

    if (data.content && data.content.ops) {
      quill.setContents(data.content, 'silent');
    } else if (data.ops) {
      quill.setContents(data, 'silent');
    }

    updateStats();
    renderAllRemoteCursors();
  }

  // ==========================================================================
  // 11. EXPORT UTILITIES (TXT, HTML, MD, JSON)
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
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
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

  if (btnExportTxt) btnExportTxt.addEventListener('click', exportTxt);
  if (btnMobileTxt) btnMobileTxt.addEventListener('click', exportTxt);

  if (btnExportHtml) btnExportHtml.addEventListener('click', exportHtml);
  if (btnMobileHtml) btnMobileHtml.addEventListener('click', exportHtml);

  if (btnExportMd) btnExportMd.addEventListener('click', exportMd);
  if (btnMobileMd) btnMobileMd.addEventListener('click', exportMd);

  if (btnExportJson) btnExportJson.addEventListener('click', exportJson);
  if (btnMobileJson) btnMobileJson.addEventListener('click', exportJson);

  // ==========================================================================
  // 12. NEW DOCUMENT ACTION
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
  // 13. FOCUS / FULLSCREEN MODE
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
  // 14. DROPDOWN CONTROLS
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
  // 15. KEYBOARD SHORTCUTS
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
  // 16. NETWORK BADGE & SERVICE WORKER
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
    if (socket && !socket.connected) {
      socket.connect();
    }
    saveDoc();
  });

  window.addEventListener('offline', () => {
    updateNetworkBadge();
    showToast('Offline mode active - auto-saving locally');
    updateStatus('offline', 'Saved locally');
  });

  updateNetworkBadge();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    });
  }

  // ==========================================================================
  // 17. DOCUMENT EVENT BINDINGS (TEXT & SELECTION CHANGES)
  // ==========================================================================

  quill.on('text-change', (delta, oldDelta, source) => {
    updateStats();

    // Only broadcast when change originated from local user typing
    if (source === 'user') {
      if (socket && socket.connected) {
        socket.emit('doc-change', delta);
      }
      triggerAutoSave();

      // Broadcast updated cursor position immediately after typing
      const sel = quill.getSelection();
      if (sel && socket && socket.connected) {
        socket.emit('cursor-move', sel);
      }
    }
  });

  quill.on('selection-change', (range, oldRange, source) => {
    // Broadcast cursor/selection movement to collaborators
    if (socket && socket.connected) {
      socket.emit('cursor-move', range);
    }
  });

  // Initial load
  loadDoc();
  updateCollaboratorAvatars();

})();
