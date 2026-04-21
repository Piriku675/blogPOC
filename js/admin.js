// ─── admin.js ─────────────────────────────────────────────────────────────────
// Admin panel: article list, create, edit, delete, section/block management.

import firebaseConfig from './firebase-config.js';

// ── Firebase init ─────────────────────────────────────────────────────────────
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewArticles    = document.getElementById('view-articles');
const viewEditor      = document.getElementById('view-editor');
const articleList     = document.getElementById('article-list');
const listEmpty       = document.getElementById('list-empty');
const sectionsList    = document.getElementById('sections-list');
const sectionsEmpty   = document.getElementById('sections-empty');
const inputId         = document.getElementById('input-id');
const inputTitle      = document.getElementById('input-title');
const btnBack         = document.getElementById('btn-back');
const btnSave         = document.getElementById('btn-save');
const btnDelete       = document.getElementById('btn-delete');
const btnPreview      = document.getElementById('btn-preview');
const btnNewFromList  = document.getElementById('btn-new-from-list');
const btnAddSingle    = document.getElementById('btn-add-single');
const btnAddTwo       = document.getElementById('btn-add-two');
const navItems        = document.querySelectorAll('.nav-item');
const toast           = document.getElementById('toast');
const dbStatusDot     = document.getElementById('db-status-dot');
const dbStatusLabel   = document.getElementById('db-status-label');

// Block modal
const blockModalBackdrop = document.getElementById('block-modal-backdrop');
const blockModalClose    = document.getElementById('block-modal-close');
const blockTypeBtns      = document.querySelectorAll('.block-type-btn');

// Confirm modal
const confirmBackdrop = document.getElementById('confirm-modal-backdrop');
const confirmCancel   = document.getElementById('confirm-cancel');
const confirmDeleteBtn = document.getElementById('confirm-delete');

// ── State ─────────────────────────────────────────────────────────────────────
let currentArticleId = null;   // null = new article
let sections = [];             // working copy of sections array
let blockModalTarget = null;   // { sectionIdx, column }
let dragSrcIdx = null;

// ── DB connectivity check ─────────────────────────────────────────────────────
db.collection('articles').limit(1).get()
  .then(() => {
    dbStatusDot.className = 'status-dot connected';
    dbStatusLabel.textContent = 'Connected';
  })
  .catch(() => {
    dbStatusDot.className = 'status-dot error';
    dbStatusLabel.textContent = 'Error';
  });

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(viewName) {
  viewArticles.classList.toggle('hidden', viewName !== 'articles');
  viewEditor.classList.toggle('hidden',   viewName !== 'editor');
  navItems.forEach(n => n.classList.toggle('active', n.dataset.view === (viewName === 'editor' ? 'new' : viewName)));
}

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.view === 'articles') { showView('articles'); loadArticleList(); }
    if (btn.dataset.view === 'new')      { openNewEditor(); }
  });
});

btnBack.addEventListener('click', () => { showView('articles'); loadArticleList(); });
btnNewFromList.addEventListener('click', openNewEditor);

// ── Article List ──────────────────────────────────────────────────────────────
async function loadArticleList() {
  articleList.innerHTML = '';
  articleList.appendChild(listEmpty);
  listEmpty.classList.add('hidden');

  try {
    const snap = await db.collection('articles').orderBy('updatedAt', 'desc').get();

    if (snap.empty) {
      listEmpty.classList.remove('hidden');
      return;
    }

    snap.forEach(doc => {
      const data = doc.data();
      const row  = document.createElement('div');
      row.className = 'article-row';
      row.innerHTML = `
        <div>
          <div class="article-row__title">${escHtml(data.title || 'Untitled')}</div>
          <div class="article-row__id">${escHtml(doc.id)}</div>
        </div>
        <div class="article-row__meta">${data.sections?.length ?? 0} section${data.sections?.length === 1 ? '' : 's'}</div>
        <div class="article-row__meta">${formatDate(data.updatedAt)}</div>
      `;
      row.addEventListener('click', () => openEditor(doc.id, data));
      articleList.appendChild(row);
    });
  } catch (err) {
    showToast('Failed to load articles: ' + err.message, 'error');
  }
}

// ── Editor — open ─────────────────────────────────────────────────────────────
function openNewEditor() {
  currentArticleId = null;
  sections = [];
  inputId.value    = '';
  inputTitle.value = '';
  inputId.disabled = false;
  btnDelete.style.display  = 'none';
  btnPreview.style.display = 'none';
  renderSections();
  showView('editor');
}

function openEditor(id, data) {
  currentArticleId = id;
  // Deep clone so we don't mutate cached data
  sections = JSON.parse(JSON.stringify(data.sections || []));
  sections.sort((a, b) => a.order - b.order);

  inputId.value    = id;
  inputTitle.value = data.title || '';
  inputId.disabled = true;   // can't rename doc IDs in Firestore

  btnDelete.style.display  = 'inline-flex';
  btnPreview.style.display = 'inline-flex';
  btnPreview.href = `article.html?id=${encodeURIComponent(id)}`;

  renderSections();
  showView('editor');
}

// ── Save ──────────────────────────────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  const id    = inputId.value.trim();
  const title = inputTitle.value.trim();

  if (!id)    { showToast('Article ID is required.', 'error'); return; }
  if (!title) { showToast('Title is required.', 'error'); return; }
  if (/\s/.test(id)) { showToast('Article ID must have no spaces.', 'error'); return; }

  // Collect sections from DOM state (sections array is kept in sync)
  const ordered = sections.map((s, i) => ({ ...s, order: i + 1 }));

  // Basic validation
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const label = `Section ${i + 1}`;
    if (s.type === 'singleColumn' && (!s.blocks || s.blocks.length === 0)) {
      showToast(`${label}: must have at least 1 block.`, 'error'); return;
    }
    if (s.type === 'twoColumn') {
      if (!s.left  || s.left.length === 0)  { showToast(`${label} left column: must have at least 1 block.`, 'error'); return; }
      if (!s.right || s.right.length === 0) { showToast(`${label} right column: must have at least 1 block.`, 'error'); return; }
    }
    const allBlocks = s.type === 'singleColumn' ? s.blocks : [...s.left, ...s.right];
    for (const b of allBlocks) {
      const err = validateBlock(b);
      if (err) { showToast(`${label}: ${err}`, 'error'); return; }
    }
  }

  btnSave.disabled = true;
  try {
    const payload = {
      title,
      sections: ordered,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!currentArticleId) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    await db.collection('articles').doc(id).set(payload, { merge: true });
    currentArticleId = id;
    inputId.disabled = true;
    btnDelete.style.display  = 'inline-flex';
    btnPreview.style.display = 'inline-flex';
    btnPreview.href = `article.html?id=${encodeURIComponent(id)}`;
    showToast('Article saved.', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btnSave.disabled = false;
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────
btnDelete.addEventListener('click', () => {
  confirmBackdrop.classList.remove('hidden');
});
confirmCancel.addEventListener('click', () => confirmBackdrop.classList.add('hidden'));
confirmDeleteBtn.addEventListener('click', async () => {
  confirmBackdrop.classList.add('hidden');
  if (!currentArticleId) return;
  try {
    await db.collection('articles').doc(currentArticleId).delete();
    showToast('Article deleted.', 'success');
    showView('articles');
    loadArticleList();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
});

// ── Add Sections ──────────────────────────────────────────────────────────────
btnAddSingle.addEventListener('click', () => {
  sections.push({ type: 'singleColumn', order: sections.length + 1, blocks: [] });
  renderSections();
});

btnAddTwo.addEventListener('click', () => {
  sections.push({ type: 'twoColumn', order: sections.length + 1, left: [], right: [] });
  renderSections();
});

// ── Render Sections ───────────────────────────────────────────────────────────
function renderSections() {
  sectionsList.innerHTML = '';
  if (sections.length === 0) {
    sectionsList.appendChild(sectionsEmpty);
    sectionsEmpty.classList.remove('hidden');
    return;
  }
  sectionsEmpty.classList.add('hidden');

  sections.forEach((section, idx) => {
    sectionsList.appendChild(buildSectionCard(section, idx));
  });
}

function buildSectionCard(section, idx) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.draggable = true;
  card.dataset.idx = idx;

  // Header
  const header = document.createElement('div');
  header.className = 'section-card__header';
  header.innerHTML = `
    <div class="section-card__left">
      <span class="drag-handle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9"  cy="5"  r="1" fill="currentColor"/><circle cx="15" cy="5"  r="1" fill="currentColor"/>
          <circle cx="9"  cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
          <circle cx="9"  cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
        </svg>
      </span>
      <span class="section-badge">${section.type === 'singleColumn' ? 'Single Column' : 'Two Column'}</span>
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">#${idx + 1}</span>
    </div>
    <div class="section-card__actions">
      <button class="icon-btn" title="Move up"   data-action="up"   data-idx="${idx}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button class="icon-btn" title="Move down" data-action="down" data-idx="${idx}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button class="icon-btn danger" title="Remove section" data-action="remove" data-idx="${idx}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;

  header.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'up'     && i > 0)                   { swap(sections, i, i - 1); renderSections(); }
      if (action === 'down'   && i < sections.length - 1) { swap(sections, i, i + 1); renderSections(); }
      if (action === 'remove')                             { sections.splice(i, 1); renderSections(); }
    });
  });

  // Drag and drop
  card.addEventListener('dragstart', () => { dragSrcIdx = idx; card.classList.add('dragging'); });
  card.addEventListener('dragend',   () => { card.classList.remove('dragging'); });
  card.addEventListener('dragover',  (e) => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (dragSrcIdx !== null && dragSrcIdx !== idx) {
      const moved = sections.splice(dragSrcIdx, 1)[0];
      sections.splice(idx, 0, moved);
      dragSrcIdx = null;
      renderSections();
    }
  });

  card.appendChild(header);

  // Body
  const body = document.createElement('div');

  if (section.type === 'singleColumn') {
    body.className = 'section-card__body';
    body.appendChild(buildColumnArea(idx, null, section.blocks));
  } else {
    body.className = 'section-card__body section-card__body--two-col';
    body.appendChild(buildColumnArea(idx, 'left',  section.left));
    body.appendChild(buildColumnArea(idx, 'right', section.right));
  }

  card.appendChild(body);
  return card;
}

// ── Column Area ───────────────────────────────────────────────────────────────
function buildColumnArea(sectionIdx, column, blocks) {
  const area = document.createElement('div');
  area.className = 'column-area';

  if (column) {
    const lbl = document.createElement('div');
    lbl.className = 'column-label';
    lbl.textContent = column === 'left' ? 'Left' : 'Right';
    area.appendChild(lbl);
  }

  blocks.forEach((block, blockIdx) => {
    area.appendChild(buildBlockCard(block, sectionIdx, column, blockIdx));
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'add-block-btn';
  addBtn.textContent = '+ Add Block';
  addBtn.addEventListener('click', () => openBlockModal(sectionIdx, column));
  area.appendChild(addBtn);

  return area;
}

// ── Block Card ────────────────────────────────────────────────────────────────
function buildBlockCard(block, sectionIdx, column, blockIdx) {
  const card = document.createElement('div');
  card.className = 'block-card';

  const bHeader = document.createElement('div');
  bHeader.className = 'block-card__header';
  bHeader.innerHTML = `
    <span class="block-type-label">${block.type}</span>
    <div style="display:flex;gap:2px">
      <button class="icon-btn" data-action="block-up"   title="Move up">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button class="icon-btn" data-action="block-down" title="Move down">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button class="icon-btn danger" data-action="block-remove" title="Remove block">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;

  bHeader.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const blocksArr = getBlocksArray(sectionIdx, column);
      const action = btn.dataset.action;
      if (action === 'block-up'   && blockIdx > 0)               { swap(blocksArr, blockIdx, blockIdx - 1); renderSections(); }
      if (action === 'block-down' && blockIdx < blocksArr.length - 1) { swap(blocksArr, blockIdx, blockIdx + 1); renderSections(); }
      if (action === 'block-remove') { blocksArr.splice(blockIdx, 1); renderSections(); }
    });
  });

  const bBody = document.createElement('div');
  bBody.className = 'block-card__body';
  bBody.appendChild(buildBlockFields(block, sectionIdx, column, blockIdx));

  card.appendChild(bHeader);
  card.appendChild(bBody);
  return card;
}

// ── Block Fields ──────────────────────────────────────────────────────────────
function buildBlockFields(block, sectionIdx, column, blockIdx) {
  const frag = document.createDocumentFragment();

  function field(labelText, inputEl) {
    const wrap = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
    wrap.appendChild(inputEl);
    return wrap;
  }

  function input(value, placeholder, key) {
    const el = document.createElement('input');
    el.type = 'text';
    el.className = 'field-input';
    el.value = value || '';
    el.placeholder = placeholder;
    el.addEventListener('input', () => { block[key] = el.value; });
    return el;
  }

  function textarea(value, placeholder, key) {
    const el = document.createElement('textarea');
    el.className = 'field-input';
    el.value = value || '';
    el.placeholder = placeholder;
    el.rows = 3;
    el.addEventListener('input', () => { block[key] = el.value; });
    return el;
  }

  switch (block.type) {
    case 'header': {
      const levelSel = document.createElement('select');
      levelSel.className = 'block-select';
      [1, 2, 3].forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = `H${l}`;
        if (block.level === l) opt.selected = true;
        levelSel.appendChild(opt);
      });
      levelSel.addEventListener('change', () => { block.level = parseInt(levelSel.value); });
      frag.appendChild(field('Level', levelSel));
      frag.appendChild(field('Text', input(block.text, 'Header text…', 'text')));
      break;
    }
    case 'paragraph': {
      frag.appendChild(field('Text', textarea(block.text, 'Paragraph text…', 'text')));
      break;
    }
    case 'image': {
      frag.appendChild(field('Cloudinary URL', input(block.src, 'https://res.cloudinary.com/…', 'src')));
      frag.appendChild(field('Alt Text', input(block.alt, 'Describe the image…', 'alt')));
      frag.appendChild(field('Caption (optional)', input(block.caption, 'Caption…', 'caption')));
      break;
    }
    case 'video': {
      frag.appendChild(field('URL (YouTube / Facebook)', input(block.url, 'https://youtube.com/watch?v=…', 'url')));
      break;
    }
  }

  return frag;
}

// ── Block Modal ───────────────────────────────────────────────────────────────
function openBlockModal(sectionIdx, column) {
  blockModalTarget = { sectionIdx, column };
  blockModalBackdrop.classList.remove('hidden');
}

blockModalClose.addEventListener('click', () => blockModalBackdrop.classList.add('hidden'));
blockModalBackdrop.addEventListener('click', (e) => {
  if (e.target === blockModalBackdrop) blockModalBackdrop.classList.add('hidden');
});

blockTypeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!blockModalTarget) return;
    const { sectionIdx, column } = blockModalTarget;
    const blocksArr = getBlocksArray(sectionIdx, column);
    blocksArr.push(makeBlock(btn.dataset.type));
    blockModalBackdrop.classList.add('hidden');
    renderSections();
  });
});

function makeBlock(type) {
  switch (type) {
    case 'header':    return { type: 'header',    level: 2, text: '' };
    case 'paragraph': return { type: 'paragraph', text: '' };
    case 'image':     return { type: 'image',     src: '', alt: '', caption: '' };
    case 'video':     return { type: 'video',     url: '' };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getBlocksArray(sectionIdx, column) {
  const s = sections[sectionIdx];
  if (s.type === 'singleColumn') return s.blocks;
  return column === 'left' ? s.left : s.right;
}

function validateBlock(block) {
  switch (block.type) {
    case 'header':
      if (!block.text?.trim()) return 'Header block is missing text.';
      if (![1,2,3].includes(Number(block.level))) return 'Header level must be 1, 2, or 3.';
      break;
    case 'paragraph':
      if (!block.text?.trim()) return 'Paragraph block is missing text.';
      break;
    case 'image':
      if (!block.src?.trim())  return 'Image block is missing a URL.';
      if (!block.alt?.trim())  return 'Image block is missing alt text.';
      break;
    case 'video':
      if (!block.url?.trim())  return 'Video block is missing a URL.';
      break;
  }
  return null;
}

function swap(arr, i, j) { [arr[i], arr[j]] = [arr[j], arr[i]]; }

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (!viewEditor.classList.contains('hidden')) btnSave.click();
  }
  if (e.key === 'Escape') {
    blockModalBackdrop.classList.add('hidden');
    confirmBackdrop.classList.add('hidden');
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
loadArticleList();
