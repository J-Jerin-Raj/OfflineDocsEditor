// ==========================================================================
// OFFLINE DOCS - REAL-TIME COLLABORATION & CLIENT LOGIC
// Multi-Document Support with 8-Digit Unique ID & Password Security
// ==========================================================================

(function () {
  'use strict';

  // Constants & Storage Keys
  const USER_STORAGE_KEY = 'offline_docs_user_info_v1';
  const ACTIVE_DOC_STORAGE_KEY = 'offline_docs_active_id';
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

  // Helper: Extract valid 8-digit document ID from URL query (?doc=... or ?id=...)
  function getDocIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('doc') || params.get('id');
    if (raw) {
      const clean = String(raw).replace(/\D/g, '').slice(0, 8);
      if (clean.length === 8) return clean;
    }
    return null;
  }

  // Helper: Generate a random 8-digit ID
  function generate8DigitId() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  // Active Document ID State
  let activeDocId = getDocIdFromUrl();
  if (!activeDocId) {
    try {
      const stored = localStorage.getItem(ACTIVE_DOC_STORAGE_KEY);
      if (stored && /^\d{8}$/.test(stored)) {
        activeDocId = stored;
      }
    } catch (e) {}
  }
  if (!activeDocId) {
    activeDocId = generate8DigitId();
  }

  // Sync to URL and LocalStorage
  function syncDocIdToUrl(docId) {
    activeDocId = docId;
    try {
      localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, docId);
    } catch (e) {}
    const newUrl = `${window.location.pathname}?doc=${docId}`;
    window.history.replaceState({ docId }, '', newUrl);
    updateDocIdBadges();
  }

  function getDocStorageKey(docId) {
    return `offline_docs_backup_${docId}`;
  }

  let currentDocHasPassword = false;
  let enteredDocPassword = '';

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

  // Collab & Document ID Header Badges
  const btnCollabShare = document.getElementById('btn-collab-share');
  const headerDocId = document.getElementById('header-doc-id');
  const headerLockBadge = document.getElementById('header-lock-badge');
  const mobileBtnCollabId = document.getElementById('mobile-btn-collab-id');
  const mobileHeaderDocId = document.getElementById('mobile-header-doc-id');
  const mobileHeaderLockBadge = document.getElementById('mobile-header-lock-badge');

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
  const btnMobileShare = document.getElementById('btn-mobile-share');
  const menuDocId = document.getElementById('menu-doc-id');
  const btnMobileJoin = document.getElementById('btn-mobile-join');
  const btnMobilePassword = document.getElementById('btn-mobile-password');
  const menuPasswordText = document.getElementById('menu-password-text');
  const btnMobileNew = document.getElementById('btn-mobile-new');
  const btnMobileFocus = document.getElementById('btn-mobile-focus');
  const btnMobilePdf = document.getElementById('btn-mobile-pdf');
  const btnMobileTxt = document.getElementById('btn-mobile-txt');
  const btnMobileHtml = document.getElementById('btn-mobile-html');
  const btnMobileMd = document.getElementById('btn-mobile-md');
  const btnMobileJson = document.getElementById('btn-mobile-json');

  // Modals: Share Modal
  const modalShare = document.getElementById('modal-share');
  const modalShareBackdrop = document.getElementById('modal-share-backdrop');
  const btnCloseShare = document.getElementById('btn-close-share');
  const modalDocIdText = document.getElementById('modal-doc-id-text');
  const btnCopyId = document.getElementById('btn-copy-id');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const securityIcon = document.getElementById('security-icon');
  const securityText = document.getElementById('security-text');
  const securitySubtext = document.getElementById('security-subtext');
  const btnManagePassword = document.getElementById('btn-manage-password');
  const inputJoinId = document.getElementById('input-join-id');
  const btnSubmitJoin = document.getElementById('btn-submit-join');

  // Modals: Password Prompt Modal
  const modalPassword = document.getElementById('modal-password');
  const modalPasswordBackdrop = document.getElementById('modal-password-backdrop');
  const btnClosePasswordModal = document.getElementById('btn-close-password-modal');
  const formPasswordPrompt = document.getElementById('form-password-prompt');
  const promptLockIcon = document.getElementById('prompt-lock-icon');
  const promptPasswordTitle = document.getElementById('prompt-password-title');
  const promptPasswordSubtitle = document.getElementById('prompt-password-subtitle');
  const formGroupCurrentPass = document.getElementById('form-group-current-pass');
  const inputCurrentPass = document.getElementById('input-current-pass');
  const labelPromptPass = document.getElementById('label-prompt-pass');
  const inputPromptPass = document.getElementById('input-prompt-pass');
  const btnToggleEye = document.getElementById('btn-toggle-eye');
  const promptErrorMsg = document.getElementById('prompt-error-msg');
  const btnPasswordCancel = document.getElementById('btn-password-cancel');
  const btnPasswordSubmit = document.getElementById('btn-password-submit');

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

  // Update Header & Menu badges with active doc ID & security state
  function updateDocIdBadges() {
    if (headerDocId) headerDocId.textContent = activeDocId;
    if (mobileHeaderDocId) mobileHeaderDocId.textContent = activeDocId;
    if (menuDocId) menuDocId.textContent = activeDocId;
    if (modalDocIdText) modalDocIdText.textContent = activeDocId;

    const lockEmoji = currentDocHasPassword ? '🔒' : '🔓';
    const lockTitle = currentDocHasPassword ? 'Password Protected' : 'Public (No password)';

    if (headerLockBadge) {
      headerLockBadge.textContent = lockEmoji;
      headerLockBadge.title = lockTitle;
    }
    if (mobileHeaderLockBadge) {
      mobileHeaderLockBadge.textContent = lockEmoji;
    }
    if (securityIcon) securityIcon.textContent = lockEmoji;
    if (securityText) {
      securityText.textContent = currentDocHasPassword ? 'Password Protected' : 'No password set (Public)';
    }
    if (securitySubtext) {
      securitySubtext.textContent = currentDocHasPassword
        ? 'A password is required for collaborators to join and edit.'
        : 'Anyone with the 8-digit ID can view and edit.';
    }
    if (btnManagePassword) {
      btnManagePassword.textContent = currentDocHasPassword ? 'Change Password' : 'Set Password';
    }
    if (menuPasswordText) {
      menuPasswordText.textContent = currentDocHasPassword ? 'Change Document Password' : 'Set Document Password';
    }
  }

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

  function initSocketConnection() {
    if (typeof io === 'undefined') return;

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
      // Request to join the active document room
      joinDocRoom(activeDocId, enteredDocPassword);
    });

    socket.on('disconnect', () => {
      updateStatus('offline', 'Offline');
      clearAllRemoteCursors();
      updateCollaboratorAvatars();
    });

    // Password is required to join this document
    socket.on('password-required', ({ docId, title, isIncorrect }) => {
      // Blur and lock document editor
      document.body.classList.add('doc-locked');
      quill.enable(false);

      if (title) setTitle(title);
      currentDocHasPassword = true;
      updateDocIdBadges();

      openPasswordPromptModal({
        mode: 'unlock',
        docId,
        isIncorrect,
        title: 'Password Protected Document',
        subtitle: `Document ${docId} requires a password to collaborate:`,
        submitText: 'Unlock & Join'
      });
    });

    // Successfully initialized / joined document
    socket.on('init-document', (data) => {
      // Unlock editor
      document.body.classList.remove('doc-locked');
      quill.enable(true);
      closePasswordPromptModal();

      myUserId = data.myUser.id;
      if (data.myUser.color) {
        myProfile.color = data.myUser.color;
        try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(myProfile)); } catch (e) {}
      }

      currentDocHasPassword = !!data.hasPassword;
      syncDocIdToUrl(data.docId);

      // Apply title & document content
      if (data.title) setTitle(data.title);
      if (data.content) {
        applyDocData(data.content);
        saveToLocalStorage(getDocumentData());
      }

      // Initialize remote collaborators in this document room
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

      // If document was newly created and has no password yet, prompt creator to optionally set one
      if (data.isNew && !data.hasPassword) {
        const creatorDismissKey = `offline_dismiss_pass_prompt_${data.docId}`;
        if (!sessionStorage.getItem(creatorDismissKey)) {
          sessionStorage.setItem(creatorDismissKey, '1');
          setTimeout(() => {
            openPasswordPromptModal({
              mode: 'create',
              docId: data.docId,
              title: 'Protect Your Document',
              subtitle: `Document ID: ${data.docId}`,
              submitText: 'Set Password',
              cancelText: 'Skip (Keep Open)'
            });
          }, 400);
        }
      }
    });

    // Security status updated (password added or removed)
    socket.on('doc-security-updated', ({ hasPassword }) => {
      currentDocHasPassword = !!hasPassword;
      updateDocIdBadges();
      showToast(hasPassword ? 'Document is now password protected' : 'Document password removed');
    });

    // Another collaborator joined this room
    socket.on('user-joined', (user) => {
      if (user.id !== myUserId) {
        remoteUsers.set(user.id, user);
        updateCollaboratorAvatars();
        showToast(`${user.name} joined`);
      }
    });

    // Collaborator left this room
    socket.on('user-left', ({ userId }) => {
      const u = remoteUsers.get(userId);
      if (u) {
        showToast(`${u.name} left`);
        removeCursorElements(userId);
        remoteUsers.delete(userId);
        updateCollaboratorAvatars();
      }
    });

    // Collaborator updated profile
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

    // Real-time document edit received from collaborator
    socket.on('doc-change', ({ delta, userId }) => {
      quill.updateContents(delta, 'api');

      if (Delta) {
        const deltaObj = new Delta(delta);
        remoteUsers.forEach((u) => {
          if (u.range && typeof u.range.index === 'number') {
            u.range.index = deltaObj.transformPosition(u.range.index);
          }
        });
        renderAllRemoteCursors();
      }

      updateStats();
      saveToLocalStorage(getDocumentData());
      updateStatus('saved', 'Saved');
    });

    // Title change received
    socket.on('title-change', ({ title, userId }) => {
      setTitle(title);
      saveToLocalStorage(getDocumentData());
    });

    // Cursor movement received
    socket.on('cursor-move', ({ userId, range, user }) => {
      if (userId === myUserId) return;

      let rUser = remoteUsers.get(userId);
      if (!rUser) {
        rUser = user || { id: userId, name: 'Collaborator', color: '#1a73e8' };
        remoteUsers.set(userId, rUser);
        updateCollaboratorAvatars();
      }

      rUser.range = range;
      if (user && user.name) rUser.name = user.name;
      if (user && user.color) rUser.color = user.color;

      renderRemoteCursor(rUser);
    });

    // Cursor removal
    socket.on('cursor-remove', ({ userId }) => {
      removeCursorElements(userId);
    });
  }

  // Join or switch document room helper
  function joinDocRoom(docId, password = '', setPassword = null) {
    if (!socket || !socket.connected) {
      // Offline fallback: load local copy for this doc
      loadDoc();
      return;
    }

    socket.emit('join-document', {
      docId,
      password: password || '',
      setPassword: setPassword || null,
      name: myProfile.name,
      color: myProfile.color || ''
    }, (res) => {
      if (res && res.requiresPassword) {
        // Will be handled by password-required event
      }
    });
  }

  // ==========================================================================
  // 4. REMOTE CURSORS & SELECTION HIGHLIGHTS
  // ==========================================================================

  function renderRemoteCursor(user) {
    if (!user || !user.range || !cursorOverlay) return;

    const docLength = quill.getLength();
    const safeIndex = Math.max(0, Math.min(user.range.index, docLength - 1));

    // Caret Bar & Flag
    let cursorEl = document.getElementById(`remote-cursor-${user.id}`);
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = `remote-cursor-${user.id}`;
      cursorEl.className = 'remote-cursor';
      cursorEl.innerHTML = `
        <div class="remote-cursor-caret"></div>
        <div class="remote-cursor-flag">
          <span class="remote-cursor-name"></span>
        </div>
      `;
      cursorOverlay.appendChild(cursorEl);
    }

    const caretEl = cursorEl.querySelector('.remote-cursor-caret');
    const flagEl = cursorEl.querySelector('.remote-cursor-flag');
    const nameEl = cursorEl.querySelector('.remote-cursor-name');

    if (caretEl) caretEl.style.backgroundColor = user.color;
    if (flagEl) flagEl.style.backgroundColor = user.color;
    if (nameEl) nameEl.textContent = user.name || 'User';

    const bounds = quill.getBounds(safeIndex, 0);
    if (bounds) {
      cursorEl.style.left = `${bounds.left}px`;
      cursorEl.style.top = `${bounds.top}px`;
      cursorEl.style.height = `${bounds.height}px`;

      if (bounds.top < 22) {
        flagEl.classList.add('flip-down');
      } else {
        flagEl.classList.remove('flip-down');
      }
    }

    cursorEl.classList.add('is-active');
    cursorEl.classList.remove('is-idle');
    clearTimeout(user.idleTimer);
    user.idleTimer = setTimeout(() => {
      cursorEl.classList.remove('is-active');
      cursorEl.classList.add('is-idle');
    }, 3500);

    // Selection Box (if length > 0)
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
    if (cursorOverlay) cursorOverlay.innerHTML = '';
  }

  function renderAllRemoteCursors() {
    remoteUsers.forEach((user) => renderRemoteCursor(user));
  }

  window.addEventListener('resize', renderAllRemoteCursors);

  // ==========================================================================
  // 5. COLLABORATOR AVATARS & PRESENCE BAR
  // ==========================================================================

  function updateCollaboratorAvatars() {
    if (!collaboratorsList) return;
    collaboratorsList.innerHTML = '';

    const allUsers = [];

    allUsers.push({
      id: myUserId || 'local',
      name: myProfile.name,
      color: myProfile.color || '#1a73e8',
      isMe: true
    });

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
      if (state === 'saving') pill.classList.add('status-saving');
      else if (state === 'offline') pill.classList.add('status-offline');
      else pill.classList.add('status-saved');
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
  // 10. STORAGE & PERSISTENCE (PER-DOCUMENT BACKUP)
  // ==========================================================================

  function getDocumentData() {
    return {
      id: activeDocId,
      title: getCurrentTitle(),
      content: quill.getContents(),
      updatedAt: new Date().toISOString()
    };
  }

  function saveToLocalStorage(data) {
    try {
      const key = getDocStorageKey(activeDocId);
      localStorage.setItem(key, JSON.stringify(data));
      // Keep legacy backup updated as fallback
      if (activeDocId === '10000000') {
        localStorage.setItem('offline_docs_backup_v1', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  async function saveDoc() {
    isSaving = true;
    updateStatus('saving', 'Saving...');
    const data = getDocumentData();

    saveToLocalStorage(data);

    if (socket && socket.connected) {
      socket.emit('doc-save', data);
      updateStatus('saved', 'Saved');
      isSaving = false;
      return;
    }

    try {
      const response = await fetch(`/save?doc=${activeDocId}`, {
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

    // Step 1: Immediate local restore for activeDocId
    try {
      let localDataRaw = localStorage.getItem(getDocStorageKey(activeDocId));
      if (!localDataRaw && activeDocId === '10000000') {
        localDataRaw = localStorage.getItem('offline_docs_backup_v1');
      }

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
      const res = await fetch(`/load?doc=${activeDocId}`);
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
</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
    downloadBlob(fullHtml, getSanitizedFilename('html'), 'text/html');
  }

  function exportMd() {
    closeAllDropdowns();
    let md = '';
    const lines = quill.getLines();
    lines.forEach((line) => {
      const format = line.formats();
      const text = line.domNode.innerText;
      if (format.header === 1) md += `# ${text}\n\n`;
      else if (format.header === 2) md += `## ${text}\n\n`;
      else if (format.header === 3) md += `### ${text}\n\n`;
      else if (format.blockquote) md += `> ${text}\n\n`;
      else if (format.list === 'bullet') md += `* ${text}\n`;
      else if (format.list === 'ordered') md += `1. ${text}\n`;
      else md += `${text}\n\n`;
    });
    downloadBlob(md, getSanitizedFilename('md'), 'text/markdown');
  }

  function exportJson() {
    closeAllDropdowns();
    const data = getDocumentData();
    downloadBlob(JSON.stringify(data, null, 2), getSanitizedFilename('json'), 'application/json');
  }

  if (btnExportTxt) btnExportTxt.addEventListener('click', exportTxt);
  if (btnExportHtml) btnExportHtml.addEventListener('click', exportHtml);
  if (btnExportMd) btnExportMd.addEventListener('click', exportMd);
  if (btnExportJson) btnExportJson.addEventListener('click', exportJson);

  if (btnMobileTxt) btnMobileTxt.addEventListener('click', exportTxt);
  if (btnMobileHtml) btnMobileHtml.addEventListener('click', exportHtml);
  if (btnMobileMd) btnMobileMd.addEventListener('click', exportMd);
  if (btnMobileJson) btnMobileJson.addEventListener('click', exportJson);

  // ==========================================================================
  // 12. PASSWORD PROMPT & SHARE MODALS
  // ==========================================================================

  let passwordModalState = {
    mode: 'unlock', // 'unlock' | 'create' | 'set'
    targetDocId: null,
    onSuccess: null
  };

  function openPasswordPromptModal(options = {}) {
    passwordModalState.mode = options.mode || 'unlock';
    passwordModalState.targetDocId = options.docId || activeDocId;
    passwordModalState.onSuccess = options.onSuccess || null;

    if (promptErrorMsg) {
      promptErrorMsg.textContent = options.isIncorrect ? 'Incorrect password. Please try again.' : '';
    }

    if (inputPromptPass) {
      inputPromptPass.value = '';
      inputPromptPass.type = 'password';
      if (btnToggleEye) btnToggleEye.textContent = '👁️';
    }

    if (inputCurrentPass) inputCurrentPass.value = '';

    if (options.mode === 'create') {
      promptLockIcon.textContent = '🔑';
      promptPasswordTitle.textContent = options.title || 'Protect New Document';
      promptPasswordSubtitle.textContent = options.subtitle || `Document ID: ${options.docId}`;
      labelPromptPass.textContent = 'Set Password (Optional)';
      inputPromptPass.placeholder = 'Leave blank to allow open access';
      formGroupCurrentPass.style.display = 'none';
      btnPasswordSubmit.textContent = options.submitText || 'Create Document';
      btnPasswordCancel.textContent = options.cancelText || 'Skip (Open Access)';
    } else if (options.mode === 'set') {
      promptLockIcon.textContent = '🔒';
      promptPasswordTitle.textContent = currentDocHasPassword ? 'Change Document Password' : 'Set Document Password';
      promptPasswordSubtitle.textContent = `Document ID: ${activeDocId}`;
      labelPromptPass.textContent = currentDocHasPassword ? 'New Password' : 'Password';
      inputPromptPass.placeholder = currentDocHasPassword ? 'Enter new password (leave blank to remove)' : 'Enter password...';
      formGroupCurrentPass.style.display = currentDocHasPassword ? 'flex' : 'none';
      btnPasswordSubmit.textContent = 'Save Password';
      btnPasswordCancel.textContent = 'Cancel';
    } else {
      // mode === 'unlock'
      promptLockIcon.textContent = '🔒';
      promptPasswordTitle.textContent = options.title || 'Password Protected Document';
      promptPasswordSubtitle.textContent = options.subtitle || `Enter password for document ${options.docId}:`;
      labelPromptPass.textContent = 'Document Password';
      inputPromptPass.placeholder = 'Enter password...';
      formGroupCurrentPass.style.display = 'none';
      btnPasswordSubmit.textContent = options.submitText || 'Unlock Document';
      btnPasswordCancel.textContent = options.cancelText || 'Cancel / Back';
    }

    if (modalPassword) {
      modalPassword.classList.add('open');
      modalPassword.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        if (inputPromptPass) inputPromptPass.focus();
      }, 150);
    }
  }

  function closePasswordPromptModal() {
    if (modalPassword) {
      modalPassword.classList.remove('open');
      modalPassword.setAttribute('aria-hidden', 'true');
    }
    if (promptErrorMsg) promptErrorMsg.textContent = '';
  }

  // Toggle password visibility in prompt modal
  if (btnToggleEye && inputPromptPass) {
    btnToggleEye.addEventListener('click', () => {
      if (inputPromptPass.type === 'password') {
        inputPromptPass.type = 'text';
        btnToggleEye.textContent = '🙈';
      } else {
        inputPromptPass.type = 'password';
        btnToggleEye.textContent = '👁️';
      }
    });
  }

  // Submit Password Form
  if (formPasswordPrompt) {
    formPasswordPrompt.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPass = inputPromptPass ? inputPromptPass.value.trim() : '';
      const currentPass = inputCurrentPass ? inputCurrentPass.value.trim() : '';

      if (passwordModalState.mode === 'unlock') {
        if (!enteredPass) {
          if (promptErrorMsg) promptErrorMsg.textContent = 'Please enter a password.';
          return;
        }
        enteredDocPassword = enteredPass;
        // Attempt room join with password
        joinDocRoom(passwordModalState.targetDocId, enteredPass);
      } else if (passwordModalState.mode === 'create') {
        // Create new document with or without password
        const targetId = passwordModalState.targetDocId || generate8DigitId();
        syncDocIdToUrl(targetId);
        setTitle(DEFAULT_TITLE);
        quill.setText('');
        currentDocHasPassword = enteredPass.length > 0;
        enteredDocPassword = enteredPass;
        joinDocRoom(targetId, enteredPass, enteredPass);
        closePasswordPromptModal();
        showToast(enteredPass ? `New protected document created (ID: ${targetId})` : `New document created (ID: ${targetId})`);
        quill.focus();
      } else if (passwordModalState.mode === 'set') {
        if (!socket || !socket.connected) {
          showToast('Cannot change password while offline');
          return;
        }

        socket.emit('set-doc-password', {
          docId: activeDocId,
          currentPassword: currentPass,
          newPassword: enteredPass
        }, (res) => {
          if (res && res.success) {
            currentDocHasPassword = !!res.hasPassword;
            updateDocIdBadges();
            closePasswordPromptModal();
            showToast(res.hasPassword ? 'Password updated successfully' : 'Password removed (Document is now public)');
          } else {
            if (promptErrorMsg) promptErrorMsg.textContent = (res && res.error) || 'Failed to update password';
          }
        });
      }
    });
  }

  if (btnPasswordCancel) {
    btnPasswordCancel.addEventListener('click', () => {
      if (passwordModalState.mode === 'create') {
        // Skip setting password, continue creating open document
        const targetId = passwordModalState.targetDocId || generate8DigitId();
        syncDocIdToUrl(targetId);
        setTitle(DEFAULT_TITLE);
        quill.setText('');
        currentDocHasPassword = false;
        enteredDocPassword = '';
        joinDocRoom(targetId);
        closePasswordPromptModal();
        showToast(`New document created (ID: ${targetId})`);
        quill.focus();
      } else if (passwordModalState.mode === 'unlock') {
        // User cancelled unlocking: redirect back to their own fresh document
        closePasswordPromptModal();
        const fallbackId = generate8DigitId();
        syncDocIdToUrl(fallbackId);
        setTitle(DEFAULT_TITLE);
        quill.setText('');
        document.body.classList.remove('doc-locked');
        quill.enable(true);
        joinDocRoom(fallbackId);
        showToast(`Created new document (ID: ${fallbackId})`);
      } else {
        closePasswordPromptModal();
      }
    });
  }

  if (btnClosePasswordModal) {
    btnClosePasswordModal.addEventListener('click', () => {
      if (passwordModalState.mode === 'unlock') {
        // Cannot dismiss without unlocking; route to fresh doc
        btnPasswordCancel.click();
      } else {
        closePasswordPromptModal();
      }
    });
  }

  if (modalPasswordBackdrop) {
    modalPasswordBackdrop.addEventListener('click', () => {
      if (passwordModalState.mode !== 'unlock') {
        closePasswordPromptModal();
      }
    });
  }

  // ==========================================================================
  // SHARE & COLLABORATION MODAL HANDLERS
  // ==========================================================================

  function openShareModal() {
    closeAllDropdowns();
    updateDocIdBadges();
    if (modalShare) {
      modalShare.classList.add('open');
      modalShare.setAttribute('aria-hidden', 'false');
      if (inputJoinId) inputJoinId.value = '';
    }
  }

  function closeShareModal() {
    if (modalShare) {
      modalShare.classList.remove('open');
      modalShare.setAttribute('aria-hidden', 'true');
    }
  }

  if (btnCollabShare) btnCollabShare.addEventListener('click', openShareModal);
  if (mobileBtnCollabId) mobileBtnCollabId.addEventListener('click', openShareModal);
  if (btnMobileShare) {
    btnMobileShare.addEventListener('click', () => {
      closeAllDropdowns();
      openShareModal();
    });
  }
  if (btnCloseShare) btnCloseShare.addEventListener('click', closeShareModal);
  if (modalShareBackdrop) modalShareBackdrop.addEventListener('click', closeShareModal);

  // Copy 8-digit ID
  if (btnCopyId) {
    btnCopyId.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(activeDocId);
        showToast(`Copied ID: ${activeDocId}`);
      } catch (err) {
        showToast(`Document ID: ${activeDocId}`);
      }
    });
  }

  // Copy shareable link
  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', async () => {
      const shareUrl = `${window.location.origin}/?doc=${activeDocId}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Share link copied to clipboard!');
      } catch (err) {
        showToast(shareUrl);
      }
    });
  }

  // Manage password button from Share modal
  if (btnManagePassword) {
    btnManagePassword.addEventListener('click', () => {
      closeShareModal();
      openPasswordPromptModal({
        mode: 'set',
        docId: activeDocId
      });
    });
  }

  // Join Another Document from Share modal
  if (btnSubmitJoin && inputJoinId) {
    btnSubmitJoin.addEventListener('click', () => {
      const raw = inputJoinId.value.trim().replace(/\D/g, '');
      if (raw.length !== 8) {
        showToast('Please enter a valid 8-digit document ID');
        inputJoinId.focus();
        return;
      }

      if (raw === activeDocId) {
        showToast('You are already viewing this document');
        closeShareModal();
        return;
      }

      closeShareModal();
      enteredDocPassword = '';
      syncDocIdToUrl(raw);
      joinDocRoom(raw);
    });

    inputJoinId.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnSubmitJoin.click();
      }
    });
  }

  // Mobile Join & Password items
  if (btnMobileJoin) {
    btnMobileJoin.addEventListener('click', () => {
      closeAllDropdowns();
      openShareModal();
      setTimeout(() => {
        if (inputJoinId) inputJoinId.focus();
      }, 200);
    });
  }

  if (btnMobilePassword) {
    btnMobilePassword.addEventListener('click', () => {
      closeAllDropdowns();
      openPasswordPromptModal({
        mode: 'set',
        docId: activeDocId
      });
    });
  }

  // ==========================================================================
  // 13. NEW DOCUMENT (WITH 8-DIGIT ID & OPTIONAL PASSWORD PROMPT)
  // ==========================================================================

  function startNewDocument() {
    closeAllDropdowns();
    const newDocId = generate8DigitId();

    openPasswordPromptModal({
      mode: 'create',
      docId: newDocId,
      title: 'Create New Document',
      subtitle: `Assigned ID: ${newDocId}`,
      submitText: 'Set Password & Create',
      cancelText: 'Skip (Public Doc)'
    });
  }

  if (btnNew) btnNew.addEventListener('click', startNewDocument);
  if (btnMobileNew) btnMobileNew.addEventListener('click', startNewDocument);

  // ==========================================================================
  // 14. FOCUS / FULLSCREEN MODE
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
  // 15. DROPDOWN CONTROLS
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
  // 16. KEYBOARD SHORTCUTS
  // ==========================================================================

  window.addEventListener('keydown', (e) => {
    const isMacPlatform = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMacPlatform ? e.metaKey : e.ctrlKey;

    // Ctrl+P / Cmd+P -> Print
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

    // Esc closes focus mode, dropdowns, and modals
    if (e.key === 'Escape') {
      if (document.body.classList.contains('focus-mode')) {
        toggleFocusMode();
      }
      closeAllDropdowns();
      if (passwordModalState.mode !== 'unlock') {
        closePasswordPromptModal();
      }
      closeShareModal();
    }
  });

  // Listen for browser popstate (e.g. Back / Forward button changes doc)
  window.addEventListener('popstate', (e) => {
    const urlDocId = getDocIdFromUrl();
    if (urlDocId && urlDocId !== activeDocId) {
      activeDocId = urlDocId;
      enteredDocPassword = '';
      updateDocIdBadges();
      joinDocRoom(activeDocId);
    }
  });

  // ==========================================================================
  // 17. NETWORK STATUS & SERVICE WORKER
  // ==========================================================================

  function updateNetworkBadge() {
    if (!offlineBadge) return;
    if (navigator.onLine) {
      offlineBadge.textContent = 'Online';
      offlineBadge.className = 'brand-badge badge-online';
      offlineBadge.title = 'Collaborating in real time';
    } else {
      offlineBadge.textContent = 'Offline';
      offlineBadge.className = 'brand-badge badge-offline';
      offlineBadge.title = 'Offline mode active (Zero external dependencies)';
    }
  }

  window.addEventListener('online', () => {
    updateNetworkBadge();
    showToast('Internet connection restored');
    if (socket && !socket.connected) {
      socket.connect();
    }
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
  // 18. DOCUMENT EVENT BINDINGS (TEXT & SELECTION CHANGES)
  // ==========================================================================

  quill.on('text-change', (delta, oldDelta, source) => {
    updateStats();

    if (source === 'user') {
      if (socket && socket.connected) {
        socket.emit('doc-change', delta);
      }
      triggerAutoSave();

      const sel = quill.getSelection();
      if (sel && socket && socket.connected) {
        socket.emit('cursor-move', sel);
      }
    }
  });

  quill.on('selection-change', (range, oldRange, source) => {
    if (socket && socket.connected) {
      socket.emit('cursor-move', range);
    }
  });

  // ==========================================================================
  // 19. INITIALIZATION
  // ==========================================================================

  updateDocIdBadges();
  loadDoc();
  updateCollaboratorAvatars();
  initSocketConnection();

})();
