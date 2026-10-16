'use strict';
/* PDF Changer — interface d'édition.
 * Toutes les coordonnées échangées avec le serveur sont en points PDF,
 * dans l'espace « affiché » de la page (rotation déjà appliquée). */

// ------------------------------------------------------------------ icônes
// Plusieurs tracés reprennent ou adaptent Feather Icons (MIT, © 2013-2023 Cole Bemis)
// et Lucide (ISC, © Lucide Icons and Contributors) : voir THIRD_PARTY_NOTICES.md.
const ICONS = {
  select: '<path d="M5 3l14 8-6 1.8L10.5 19z"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  line: '<path d="M5 19L19 5"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  ink: '<path d="M3 17c3-1 4-9 7-9s1 9 4 9 3-6 7-6"/>',
  highlight: '<path d="M9 11l-6 6v3h6l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"/>',
  whiteout: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h10M7 14h6" stroke-dasharray="2 2"/>',
  erase: '<path d="M7 21l-4.3-4.3a1 1 0 010-1.4L13 5a1 1 0 011.4 0l5.6 5.6a1 1 0 010 1.4L11 21z"/><path d="M22 21H7M5 11l9 9"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
  download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  open: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  filePlus: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/>',
  rotate: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a3 3 0 015.6 1c0 2-3 2.6-3 4.2M12 17.5h.01"/>',
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10M9 8.5h6M9 15.5h4"/>',
  alignLeft: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignCenter: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignRight: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  alignJustify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  replace: '<path d="M4 7h11l-3-3M20 17H9l3 3"/>',
  paragraph: '<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 000 9H13"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  pages: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 5h7M14 10h7M14 15h7M14 20h5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}
function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
}

// ------------------------------------------------------------------ outils
const TOOLS = [
  { id: 'select', key: 'v', label: 'Sélectionner, déplacer, supprimer' },
  { sep: true },
  { id: 'text', key: 't', label: 'Ajouter du texte' },
  { id: 'image', key: 'i', label: 'Ajouter une image' },
  { id: 'rect', key: 'r', label: 'Rectangle' },
  { id: 'ellipse', key: 'o', label: 'Ellipse' },
  { id: 'line', key: 'l', label: 'Ligne' },
  { id: 'arrow', key: 'a', label: 'Flèche' },
  { id: 'ink', key: 'd', label: 'Dessin libre / signature' },
  { sep: true },
  { id: 'highlight', key: 'h', label: 'Surligner' },
  { id: 'whiteout', key: 'w', label: 'Cache blanc (masquer une zone)' },
  { id: 'erase', key: 'e', label: 'Gomme : effacer tout le contenu d\'une zone' },
];
const TYPE_LABEL = { text: 'Texte', image: 'Image', drawing: 'Forme', annot: 'Annotation', widget: 'Champ' };
const COLORS = ['#111111', '#555555', '#e5484d', '#f76b15', '#f5c400', '#30a46c', '#0090ff', '#4f46e5', '#8e4ec6', '#ffffff'];
const HL_COLORS = ['#ffeb3b', '#a7f3a0', '#9ad8ff', '#ffb3d9', '#ffc57a'];
const COLOR_NAMES = {
  '#111111': 'Noir', '#555555': 'Gris', '#e5484d': 'Rouge', '#f76b15': 'Orange', '#f5c400': 'Jaune', '#30a46c': 'Vert',
  '#0090ff': 'Bleu', '#4f46e5': 'Indigo', '#8e4ec6': 'Violet', '#ffffff': 'Blanc', '#1a2a6c': 'Bleu nuit',
  '#ffeb3b': 'Jaune fluo', '#a7f3a0': 'Vert fluo', '#9ad8ff': 'Bleu fluo', '#ffb3d9': 'Rose fluo', '#ffc57a': 'Orange fluo',
};

// ------------------------------------------------------------------ état
const S = {
  sid: null, name: '', version: 0, pages: [], canUndo: false, canRedo: false,
  zoom: 1, tool: 'select', els: {}, elsTok: {}, elsLoading: {}, tokens: [],
  sel: [], fonts: [], visible: new Set(), current: 0,
  paras: {}, scan: {}, ocrAvailable: false, savedVersion: 0,
  pageSel: new Set(), pageAnchor: null, clip: null, placing: null,
  props: {
    color: '#111111', fill: 'none', stroke: '#111111', width: 2, opacity: 1,
    size: 14, font: 'helv', bold: false, italic: false, hl: '#ffeb3b',
  },
};
try { Object.assign(S.props, JSON.parse(localStorage.getItem('pdfchanger.props') || '{}')); } catch (e) { /* ignore */ }
function saveProps() { try { localStorage.setItem('pdfchanger.props', JSON.stringify(S.props)); } catch (e) { /* ignore */ } }

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pagesEl = $('#pages');
const viewer = $('#viewer');

// ------------------------------------------------------------------ utilitaires
function toast(msg, type = 'info', ms = 2800, action) {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { t.remove(); action.fn(); };
    // « Annuler » ne vaut que tant qu'aucune autre modification n'a eu lieu
    if (action === undoAction) { t.classList.add('undo'); t._ver = S.version; }
    t.appendChild(b);
    ms = Math.max(ms, 6000);
  }
  $('#toasts').appendChild(t);
  t._timer = setTimeout(() => dismissToast(t), ms);
  return t;
}
function dismissToast(t) {
  if (!t || !t.isConnected) return;
  clearTimeout(t._timer);
  t.classList.add('out');
  setTimeout(() => t.remove(), 200);
}
const undoAction = { label: 'Annuler', fn: () => undo() };

// Boîte de dialogue : modal({title, body, buttons:[{label, value, primary}], input, collect}) -> Promise
// collect(m) : valeur rendue par un bouton « positif » (formulaire dans le corps).
// sticky : un clic à côté ne ferme pas (travail en cours) ; validate(m) -> message d'erreur ou rien
function modal({ title, body = '', buttons = [{ label: 'OK', value: true, primary: true }], input, wide, onOpen, collect, sticky, validate }) {
  return new Promise(resolve => {
    flushPending();
    const root = $('#modalRoot');
    const before = document.activeElement;
    const m = document.createElement('div');
    m.className = 'modal-back';
    m.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mt${root.children.length}">
      <h2 id="mt${root.children.length}">${title}</h2><div class="modal-body">${body}</div>
      ${input ? `<input class="modal-input" type="${input.type || 'text'}" placeholder="${escapeHtml(input.placeholder || '')}" value="${escapeHtml(input.value || '')}" aria-label="${escapeHtml(input.placeholder || title)}">` : ''}
      <p class="modal-error" role="alert" hidden></p>
      <div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    root.appendChild(m);
    hydrateIcons(m);
    const inp = m.querySelector('.modal-input');
    const valueOf = bt => {
      if (inp) return bt.value ? inp.value : null;
      if (collect && bt.value) return collect(m);
      return bt.value;
    };
    const tryClose = bt => {
      if (validate && bt.value) {
        const err = validate(m);
        if (err) { const p = m.querySelector('.modal-error'); p.textContent = err; p.hidden = false; return; }
      }
      close(valueOf(bt));
    };
    const close = v => {
      m.remove();
      document.removeEventListener('keydown', onKey, true);
      if (before && before.isConnected && before.focus) before.focus({ preventScroll: true });
      resolve(v);
    };
    const primary = buttons.find(b => b.primary) || buttons[0];
    const onKey = e => {
      if (!m.isConnected || root.lastElementChild !== m) return;  // une autre fenêtre est au-dessus
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      else if (e.key === 'Enter' && (inp || !e.target.closest('button, textarea, select'))) {
        e.preventDefault(); e.stopPropagation(); tryClose(primary);
      } else if (e.key === 'Tab') {
        // le focus reste dans la fenêtre
        const f = $$('button:not([disabled]), input:not([disabled]), select, textarea, canvas, [tabindex="0"]', m).filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    m.addEventListener('pointerdown', e => { if (e.target === m && !(typeof sticky === 'function' ? sticky() : sticky)) close(null); });
    m.querySelectorAll('.modal-actions button').forEach(b => b.onclick = () => tryClose(buttons[+b.dataset.i]));
    if (onOpen) onOpen(m, close);
    setTimeout(() => (inp || m.querySelector('.btn.primary') || m.querySelector('button')).focus(), 30);
  });
}
const askPassword = again => modal({
  title: again ? 'Mot de passe incorrect' : 'PDF protégé',
  body: again ? 'Réessayez :' : 'Ce document est protégé par un mot de passe.',
  input: { type: 'password', placeholder: 'Mot de passe' },
  buttons: [{ label: 'Annuler', value: false }, { label: 'Ouvrir', value: true, primary: true }],
});
let busyCount = 0;
function busy(on) {
  busyCount += on ? 1 : -1;
  document.body.classList.toggle('busy', busyCount > 0);
}
// Jeton propre à ce lancement du serveur (voir app.py) : sans lui, l'API refuse.
const TOKEN = (document.querySelector('meta[name="pdfc-token"]') || {}).content || '';
const authHeaders = (h = {}) => Object.assign({ 'X-PDF-Changer': TOKEN }, h);
async function apiFetch(url, opts = {}) {
  let r;
  try { r = await fetch(url, Object.assign({}, opts, { headers: authHeaders(opts.headers) })); } catch (e) {
    throw new Error('Le serveur ne répond pas : PDF Changer a-t-il été fermé ? Relancez-le puis rechargez la page.');
  }
  if (!r.ok) {
    let j = null;
    try { j = await r.json(); } catch (e) { /* ignore */ }
    const err = new Error((j && j.error) || (r.status === 404 ? 'Document introuvable (serveur redémarré ?)' : `Erreur ${r.status}`));
    err.status = r.status;
    throw err;
  }
  return r;
}
async function apiJson(url, opts = {}) {
  const r = await apiFetch(url, opts);
  try { return await r.json(); } catch (e) { return null; }
}
const apiPost = (url, body) => apiJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round2 = v => Math.round(v * 100) / 100;
const isTyping = () => {
  const a = document.activeElement;
  return a && (a.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName));
};
function readFileAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
function imageSize(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = rej; im.src = src; });
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ------------------------------------------------------------------ ouverture / session
// Termine ce qui est en cours (texte en édition, trait de dessin, déplacement au
// clavier) : ces actions partent dans la file avant la suivante.
function flushPending() {
  if (editor) closeEditor(false);
  if (fieldEd) closeFieldEditor(false);
  if (pendingInk) commitInk();
  flushNudge();
}
// Avant de quitter le document courant : tout est envoyé, et l'utilisateur
// confirme s'il reste des modifications non enregistrées.
async function leaveDocument() {
  flushPending();
  await queue;
  if (!isDirty()) return true;
  const v = await modal({
    title: 'Modifications non enregistrées',
    body: `<p>« ${escapeHtml(S.name)}.pdf » a des modifications qui n'ont pas été enregistrées.</p>`,
    buttons: [{ label: 'Annuler', value: null }, { label: 'Ne pas enregistrer', value: 'drop' }, { label: 'Enregistrer…', value: 'save', primary: true }],
  });
  if (v === 'save') return download();
  return v === 'drop';
}
let opening = false;  // une ouverture à la fois (double clic, glisser répété…)
async function openFile(file, password) {
  if (!password) {
    if (opening) return;
    opening = true;
    try { if (S.sid && !(await leaveDocument())) return; } finally { opening = false; }
  }
  const fd = new FormData();
  fd.append('file', file);
  if (password) fd.append('password', password);
  busy(true);
  try {
    const info = await apiJson('/api/open', { method: 'POST', body: fd });
    loadInfo(info, true);
    toast(`« ${file.name} » ouvert`, 'ok');
  } catch (e) {
    if (e.message === 'PASSWORD') {
      const pw = await askPassword(!!password);
      if (pw) return openFile(file, pw);
    } else toast(e.message, 'error', 5000);
  } finally { busy(false); }
}
async function newDocument() {
  if (opening) return;
  opening = true;
  try {
    if (S.sid && !(await leaveDocument())) return;
    busy(true);
    try { loadInfo(await apiPost('/api/new'), true); } catch (e) { toast(e.message, 'error'); } finally { busy(false); }
  } finally { opening = false; }
}
async function mergeFile(file, at, password) {
  if (!S.sid) return openFile(file);
  flushPending();
  const sid = S.sid;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('at', at == null ? S.pages.length : at);
  if (password) fd.append('password', password);
  await enqueue(async () => {
    try {
      const info = await apiJson(`/api/doc/${sid}/merge`, { method: 'POST', body: fd });
      if (sid !== S.sid) return;
      applyInfo(info);
      toast(`« ${file.name} » inséré`, 'ok');
    } catch (e) {
      if (e.message === 'PASSWORD') {
        setTimeout(async () => { const pw = await askPassword(!!password); if (pw) mergeFile(file, at, pw); });
      } else throw e;
    }
  });
}

function loadInfo(info, fresh) {
  S.sid = info.sid;
  S.name = info.name;
  try { localStorage.setItem('pdfchanger.sid', info.sid); } catch (e) { /* ignore */ }
  document.body.classList.add('has-doc');
  $('#docName').textContent = info.name + '.pdf';
  document.title = info.name + ' — PDF Changer';
  S.sel = [];
  if (S.placing) stopPlacing();
  // les notifications du document précédent (« Annuler »…) n'ont plus de sens
  if (fresh) $$('.toast').forEach(dismissToast);
  S.ocrAvailable = !!info.ocrAvailable;
  if (fresh) {
    let sv = NaN;
    try { sv = +sessionStorage.getItem('pdfchanger.saved.' + info.sid); } catch (e) { /* ignore */ }
    S.savedVersion = sv === info.version || !info.canUndo ? info.version : -1;
    S.scanPages = []; S.pageAnchor = null; S.pageSel = new Set();
  }
  closeFind();
  applyInfo(Object.assign({}, info, { changed: null }));
  if (fresh) { fitWidth(); viewer.scrollTop = 0; checkScans(); }
}

// Applique la réponse du serveur après une opération
function applyInfo(info) {
  const structural = info.changed == null || info.pages.length !== S.pages.length ||
    info.pages.some((p, i) => !S.pages[i] || p.w !== S.pages[i].w || p.h !== S.pages[i].h);
  S.version = info.version;
  $$('.toast.undo').forEach(t => { if (t._ver !== S.version) dismissToast(t); });
  S.canUndo = info.canUndo;
  S.canRedo = info.canRedo;
  const oldCount = S.pages.length;
  S.pages = info.pages;
  // un texte en cours d'édition sur une page qui vient de changer de place : abandon
  if (editor && structural) { closeEditor(true); toast('Modification du texte interrompue : les pages ont changé.', 'info', 4000); }
  if (info.changed == null) {
    S.tokens = S.pages.map(() => info.version);
    S.els = {}; S.elsTok = {}; S.elsLoading = {};
  } else {
    for (const p of info.changed) { S.tokens[p] = info.version; delete S.els[p]; delete S.elsTok[p]; delete S.paras[p]; }
  }
  if (info.changed == null) { S.paras = {}; S.scan = {}; S.pageSel = new Set(); }
  if (info.select && info.select.length) { S.sel = info.select; S.selQuiet = true; }
  else if (info.changed == null) S.sel = [];
  else S.sel = S.sel.filter(s => !info.changed.includes(s.page));
  if (S.current >= S.pages.length) S.current = S.pages.length - 1;
  if (structural || oldCount !== S.pages.length) buildPages();
  else layoutPages();
  buildThumbs(structural ? null : info.changed);
  updateTopbar();
  refreshVisible();
  drawSelection();
  renderPanel();
  if (F.open) scheduleSearch();
}
const isDirty = () => S.canUndo && S.version !== S.savedVersion;

function updateTopbar() {
  $('#btnUndo').disabled = !S.canUndo;
  $('#btnRedo').disabled = !S.canRedo;
  $('#zoomVal').textContent = Math.round(S.zoom * 100) + '%';
  $('#pageCount').textContent = S.pages.length ? `(${S.pages.length})` : '';
  updatePageNav();
  const dn = $('#docName');
  dn.classList.toggle('dirty', isDirty());
  dn.title = isDirty() ? 'Modifications non enregistrées — Ctrl+S pour enregistrer' : 'Toutes les modifications sont enregistrées';
  // la fenêtre de bureau demande confirmation à la fermeture s'il reste des modifications
  const api = desktopApi();
  if (api && api.set_dirty && updateTopbar.dirty !== isDirty()) { updateTopbar.dirty = isDirty(); api.set_dirty(isDirty()); }
}

// File d'attente : les opérations s'exécutent une par une
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(async () => {
    busy(true);
    try { return await fn(); } catch (e) { toast(e.message, 'error', 5000); return undefined; } finally { busy(false); }
  });
  queue = run.catch(() => {});
  return run;
}
// Le document visé est celui du moment où l'action est demandée : si un autre
// document est ouvert entre-temps, la réponse n'est pas appliquée à l'écran.
function runOp(body) {
  flushPending();
  const sid = S.sid;
  return enqueue(async () => {
    const res = await apiPost(`/api/doc/${sid}/op`, body);
    if (sid === S.sid) applyInfo(res);
    return res;
  });
}
function undo() {
  if (!S.sid) return;
  // un trait de dessin pas encore envoyé : on retire juste ce trait
  if (pendingInk) {
    pendingInk.strokes.pop();
    if (!pendingInk.strokes.length) { clearTimeout(inkTimer); const p = pendingInk.p; pendingInk = null; removeInkPreview(p); }
    else { clearTimeout(inkTimer); inkTimer = setTimeout(commitInk, 1100); drawInkPreview(pendingInk.p); }
    return;
  }
  flushPending();
  const sid = S.sid;
  enqueue(async () => { const r = await apiPost(`/api/doc/${sid}/undo`); if (sid === S.sid) { applyInfo(r); refreshScans(); } });
}
function redo() {
  if (!S.sid) return;
  flushPending();
  const sid = S.sid;
  enqueue(async () => { const r = await apiPost(`/api/doc/${sid}/redo`); if (sid === S.sid) { applyInfo(r); refreshScans(); } });
}
// pages scannées, sans proposer l'OCR (après annuler / rétablir)
async function refreshScans() {
  if (!S.ocrAvailable || !S.sid) return;
  try {
    const r = await apiJson(`/api/doc/${S.sid}/scans`);
    const before = (S.scanPages || []).join();
    S.scanPages = r.pages;
    if (before !== r.pages.join()) renderPanel();
  } catch (e) { /* ignore */ }
}
// Enregistre le PDF.  opts : { pages: '1-3,5', compress: true, name } (export partiel ou réduit)
let downloading = false;
async function download(opts = {}) {
  if (!S.sid || downloading) return false;
  downloading = true;
  try { return await doDownload(opts); } finally { downloading = false; }
}
// Fonctions de la fenêtre de bureau (pywebview), absentes dans un navigateur
const desktopApi = () => (window.pywebview && window.pywebview.api && window.pywebview.api.save_pdf ? window.pywebview.api : null);
async function doDownload(opts) {
  flushPending();
  await queue;
  const full = !opts.pages && !opts.compress;
  let name = (opts.name || S.name + (full ? '-modifie' : opts.pages ? '-extrait' : '-compresse')).replace(/\.pdf$/i, '') + '.pdf';
  const q = new URLSearchParams({ name });
  if (opts.pages) q.set('pages', opts.pages);
  if (opts.compress) q.set('compress', '1');
  const url = `/api/doc/${S.sid}/download?${q}`;
  const version = S.version;
  const saved = () => {
    if (!full) return;
    S.savedVersion = version; updateTopbar();
    try { sessionStorage.setItem('pdfchanger.saved.' + S.sid, String(version)); } catch (e) { /* ignore */ }
  };
  // application de bureau : boîte « Enregistrer sous » de Windows (desktop.py)
  const api = desktopApi();
  if (api) {
    busy(true);
    let t = null;
    try {
      const pending = api.save_pdf(S.sid, q.toString(), name);
      t = setTimeout(() => { t = toast('Préparation du PDF…', 'info', 60000); }, 600);
      const r = await pending;
      if (!r || r.cancelled) return false;
      if (r.error) throw new Error(r.error);
      saved();
      toast(`Enregistré : ${r.name} (${fmtSize(r.size)})`, 'ok', 4000);
      return true;
    } catch (e) {
      toast('Enregistrement impossible : ' + e.message, 'error', 6000);
      return false;
    } finally {
      if (typeof t === 'number') clearTimeout(t); else dismissToast(t);
      busy(false);
    }
  }
  let handle = null;
  if (window.showSaveFilePicker) {
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Document PDF', accept: { 'application/pdf': ['.pdf'] } }] });
    } catch (e) {
      if (e.name === 'AbortError') return false;
      handle = null;
    }
  }
  busy(true);
  const t = toast('Préparation du PDF…', 'info', 60000);
  try {
    const blob = await (await apiFetch(url)).blob();
    if (handle) {
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      name = handle.name;
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }
    saved();
    toast(`${handle ? 'Enregistré' : 'Téléchargé'} : ${name} (${fmtSize(blob.size)})`, 'ok', 4000);
    return true;
  } catch (e) {
    toast('Enregistrement impossible : ' + e.message, 'error', 6000);
    return false;
  } finally { dismissToast(t); busy(false); }
}
const fmtSize = n => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' Ko' : (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';

// ------------------------------------------------------------------ pages
let observer = null;
function renderScale() { return Math.round(clamp(S.zoom * (window.devicePixelRatio || 1), 0.25, 5) * 100) / 100; }

function buildPages() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(entries => {
    for (const en of entries) {
      const p = +en.target.dataset.p;
      if (en.isIntersecting) S.visible.add(p); else S.visible.delete(p);
    }
    refreshVisible();
    if (F.open) drawHits();
  }, { root: viewer, rootMargin: '600px 0px' });
  S.visible.clear();
  pagesEl.innerHTML = '';
  S.pages.forEach((pg, p) => {
    const d = document.createElement('div');
    d.className = 'page';
    d.dataset.p = p;
    d.innerHTML = `<div class="pnum">${p + 1}</div><img class="render" alt="" draggable="false"><div class="overlay"></div>`;
    pagesEl.appendChild(d);
    observer.observe(d);
  });
  layoutPages();
}
function layoutPages() {
  $$('.page', pagesEl).forEach(d => {
    const pg = S.pages[+d.dataset.p];
    d.style.width = pg.w * S.zoom + 'px';
    d.style.height = pg.h * S.zoom + 'px';
  });
}
const pageEl = p => pagesEl.children[p];
const overlayEl = p => pageEl(p) && pageEl(p).querySelector('.overlay');

function refreshVisible() {
  for (const p of S.visible) {
    if (p >= S.pages.length) continue;
    refreshImage(p);
    loadEls(p);
  }
}
function refreshImage(p) {
  const d = pageEl(p);
  if (!d) return;
  const img = d.querySelector('img.render');
  const want = `/api/doc/${S.sid}/page/${p}.png?s=${renderScale()}&v=${S.tokens[p]}`;
  if (img.dataset.want === want) return;
  img.dataset.want = want;
  const pre = new Image();
  pre.onload = () => { if (img.dataset.want === want) img.src = want; };
  pre.src = want;
}
async function loadEls(p) {
  const tok = S.tokens[p];
  if (S.elsTok[p] === tok || S.elsLoading[p] === tok) return;
  S.elsLoading[p] = tok;
  try {
    const r = await apiJson(`/api/doc/${S.sid}/page/${p}/elements`);
    if (S.tokens[p] !== tok) return;
    S.els[p] = r.elements;
    S.paras[p] = r.paras || [];
    S.scan[p] = !!r.scan;
    S.elsTok[p] = tok;
    drawScanBanner(p);
    drawFields(p);
    if (S.sel.some(s => s.page === p)) { drawSelection(); renderPanel(); }
  } catch (e) { /* page hors document après une opération */ } finally {
    if (S.elsLoading[p] === tok) delete S.elsLoading[p];
  }
}

// ------------------------------------------------------------------ zoom
function setZoom(z, anchor) {
  z = clamp(z, 0.2, 5);
  const oldZ = S.zoom;
  if (Math.abs(z - oldZ) < 0.001) return;
  const rect = viewer.getBoundingClientRect();
  const ax = anchor ? anchor.x - rect.left : rect.width / 2;
  const ay = anchor ? anchor.y - rect.top : rect.height / 2;
  const cx = (viewer.scrollLeft + ax), cy = (viewer.scrollTop + ay);
  S.zoom = z;
  layoutPages();
  viewer.scrollLeft = cx * z / oldZ - ax;
  viewer.scrollTop = cy * z / oldZ - ay;
  updateTopbar();
  drawSelection();
  if (editor) {
    applyEditorStyle();
    if (editor.mask) editor.mask.style.cssText = boxStyle(editor.o.mask);
  }
  if (F.open) drawHits();
  if (pendingInk) drawInkPreview(pendingInk.p);
  for (const p of Object.keys(S.els)) drawFields(+p);
  if (fieldEd) positionFieldEditor();
  clearTimeout(setZoom.t);
  setZoom.t = setTimeout(refreshVisible, 200);
}
function fitWidth() {
  if (!S.pages.length) return;
  const maxW = Math.max(...S.pages.map(p => p.w));
  const avail = viewer.clientWidth - 100;
  setZoom(clamp(avail / maxW, 0.3, 1.6));
  updateTopbar();
}
// page entière visible (la page courante)
function fitPage() {
  if (!S.pages.length) return;
  const pg = S.pages[S.current] || S.pages[0];
  const z = Math.min((viewer.clientWidth - 100) / pg.w, (viewer.clientHeight - 130) / pg.h);
  setZoom(clamp(z, 0.2, 5));
  scrollToPage(S.current, false);
  updateTopbar();
}
function zoomMenu() {
  if (!$('#ctxmenu').hidden && $('#ctxmenu').dataset.owner === 'zoom') { hideMenu(); return; }
  const b = $('#zoomVal').getBoundingClientRect();
  const levels = [50, 75, 100, 125, 150, 200, 300, 400];
  showMenu(b.left, b.bottom + 6, [
    { label: 'Largeur de la page', icon: 'alignJustify', kbd: 'Ctrl+0', fn: fitWidth },
    { label: 'Page entière', icon: 'scan', kbd: 'Ctrl+9', fn: fitPage },
    { sep: true },
    ...levels.map(l => ({ label: l + ' %', check: Math.round(S.zoom * 100) === l, fn: () => setZoom(l / 100) })),
  ], 'zoom');
}

// ------------------------------------------------------------------ miniatures
// changed : pages modifiées (seules leurs images sont rechargées) ; null = tout reconstruire
function buildThumbs(changed) {
  const box = $('#thumbs');
  const W = box.clientWidth ? Math.min(box.clientWidth - 28, 150) : 130;
  const thumbSrc = (p, pg) => `/api/doc/${S.sid}/page/${p}.png?s=${Math.round(Math.min(W * 1.6 / pg.w, 1) * 100) / 100}&v=${S.tokens[p]}`;
  if (changed && box.children.length === S.pages.length && box.dataset.w == W) {
    for (const p of changed) {
      const img = box.children[p] && box.children[p].querySelector('img');
      if (img) img.src = thumbSrc(p, S.pages[p]);
    }
    syncThumbState();
    return;
  }
  box.dataset.w = W;
  box.innerHTML = '';
  S.pages.forEach((pg, p) => {
    const w = W, h = W * pg.h / pg.w;
    const t = document.createElement('div');
    t.className = 'thumb';
    t.draggable = true;
    t.dataset.p = p;
    t.tabIndex = -1;
    t.setAttribute('role', 'group');
    t.setAttribute('aria-label', `Page ${p + 1}`);
    t.innerHTML = `
      <div class="timg" style="width:${w}px;height:${h}px"><img loading="lazy" draggable="false" alt="" src="${thumbSrc(p, pg)}"></div>
      <div class="tnum">${p + 1}</div>
      <div class="tactions">
        <button data-a="rotate" tabindex="-1" title="Pivoter de 90°" aria-label="Pivoter la page ${p + 1}"><i data-icon="rotate"></i></button>
        <button data-a="duplicate" tabindex="-1" title="Dupliquer la page" aria-label="Dupliquer la page ${p + 1}"><i data-icon="copy"></i></button>
        <button data-a="blank" tabindex="-1" title="Insérer une page blanche après" aria-label="Insérer une page blanche après la page ${p + 1}"><i data-icon="plus"></i></button>
        <button data-a="delete" tabindex="-1" class="del" title="Supprimer la page" aria-label="Supprimer la page ${p + 1}"><i data-icon="trash"></i></button>
      </div>`;
    box.appendChild(t);
  });
  hydrateIcons(box);
  syncThumbState();
}
// page courante, pages sélectionnées et barre d'actions groupées
function syncThumbState() {
  if (!S.pageSel) S.pageSel = new Set();
  for (const p of [...S.pageSel]) if (p >= S.pages.length) S.pageSel.delete(p);
  $$('.thumb').forEach(t => {
    const p = +t.dataset.p;
    t.classList.toggle('active', p === S.current);
    t.classList.toggle('picked', S.pageSel.has(p));
    if (p === S.current) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    t.setAttribute('aria-label', `Page ${p + 1}${S.pageSel.has(p) ? ' (sélectionnée)' : ''}`);
    t.tabIndex = p === S.current ? 0 : -1;
  });
  const bar = $('#pagebar');
  const n = S.pageSel.size;
  if (n < 2) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="pb-title"><b>${n} pages</b> sélectionnées <button class="linkbtn" data-a="none">Désélectionner</button></div>
    <div class="pb-actions">
      <button class="btn small" data-a="rotate" title="Pivoter de 90°">${icon('rotate')}Pivoter</button>
      <button class="btn small" data-a="duplicate" title="Dupliquer">${icon('copy')}Dupliquer</button>
      <button class="btn small" data-a="extract" title="Enregistrer ces pages dans un nouveau PDF">${icon('download')}Extraire</button>
      <button class="btn small danger" data-a="delete" title="Supprimer (Suppr)">${icon('trash')}Supprimer</button>
    </div>`;
}
const pickedPages = () => [...(S.pageSel || [])].sort((a, b) => a - b);
const pagesSpec = pages => pages.map(p => p + 1).join(',');
function pageAction(a, pages) {
  if (!pages.length) return;
  const label = pages.length > 1 ? `${pages.length} pages` : `Page ${pages[0] + 1}`;
  if (a === 'rotate' || a === 'rotateLeft') runOp({ op: 'page_rotate', pages, angle: a === 'rotate' ? 90 : -90 });
  else if (a === 'duplicate') runOp({ op: 'page_duplicate', pages }).then(r => { if (r) toast(`${label} dupliquée${pages.length > 1 ? 's' : ''}`, 'ok', 3000, undoAction); });
  else if (a === 'blank') runOp({ op: 'page_blank', at: pages[pages.length - 1] + 1 });
  else if (a === 'extract') download({ pages: pagesSpec(pages), name: S.name + (pages.length > 1 ? '-pages-' : '-page-') + pagesSpec(pages).replace(/,/g, '_') });
  else if (a === 'delete') {
    if (pages.length >= S.pages.length) return toast('Impossible de supprimer toutes les pages.', 'error');
    S.pageSel = new Set();
    runOp({ op: 'page_delete', pages }).then(r => { if (r) toast(`${label} supprimée${pages.length > 1 ? 's' : ''}`, 'info', 5000, undoAction); });
  }
}
function setCurrentPage(p, focusThumb) {
  if (p === S.current && !focusThumb) return;
  S.current = p;
  syncThumbState();
  updatePageNav();
  const t = $(`.thumb[data-p="${p}"]`);
  if (t) {
    const box = $('#thumbs');
    if (t.offsetTop < box.scrollTop || t.offsetTop + t.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTo({ top: t.offsetTop - 20, behavior: 'smooth' });
    if (focusThumb) t.focus({ preventScroll: true });
  }
}
function scrollToPage(p, smooth = true) {
  const d = pageEl(p);
  if (d) viewer.scrollTo({ top: d.offsetTop - 70, behavior: smooth ? 'smooth' : 'auto' });
}
function gotoPage(p) {
  if (!S.pages.length) return;
  p = clamp(p, 0, S.pages.length - 1);
  scrollToPage(p, Math.abs(p - S.current) < 6);
  setCurrentPage(p);
}
function updatePageNav() {
  const inp = $('#pageInput');
  if (!inp) return;
  if (document.activeElement !== inp) inp.value = S.pages.length ? S.current + 1 : '';
  inp.style.width = Math.max(2, String(S.pages.length).length) + 1.2 + 'ch';
  $('#pageTotal').textContent = S.pages.length ? `/ ${S.pages.length}` : '';
  $('#pagePrev').disabled = S.current <= 0;
  $('#pageNext').disabled = S.current >= S.pages.length - 1;
}

$('#thumbs').addEventListener('click', e => {
  const t = e.target.closest('.thumb');
  if (!t) return;
  const p = +t.dataset.p;
  const b = e.target.closest('button[data-a]');
  if (b) {
    // l'action porte sur la sélection si la page cliquée en fait partie
    const pages = S.pageSel.has(p) && S.pageSel.size > 1 ? pickedPages() : [p];
    if (b.dataset.a === 'delete' && S.pages.length <= 1) return toast('Impossible de supprimer la dernière page.', 'error');
    pageAction(b.dataset.a, pages);
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (!S.pageSel.size && S.current !== p) S.pageSel.add(S.current);
    if (S.pageSel.has(p)) S.pageSel.delete(p); else S.pageSel.add(p);
  } else if (e.shiftKey) {
    const a = S.pageAnchor != null ? S.pageAnchor : S.current;
    S.pageSel = new Set();
    for (let i = Math.min(a, p); i <= Math.max(a, p); i++) S.pageSel.add(i);
  } else {
    S.pageSel = new Set();
    S.pageAnchor = p;
  }
  if (!e.shiftKey) S.pageAnchor = p;
  scrollToPage(p);
  setCurrentPage(p, true);
  syncThumbState();
});
$('#thumbs').addEventListener('keydown', e => {
  const t = e.target.closest('.thumb');
  if (!t) return;
  const p = +t.dataset.p;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault(); e.stopPropagation();
    const q = clamp(p + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1), 0, S.pages.length - 1);
    if (e.shiftKey) { S.pageSel.add(p); S.pageSel.add(q); } else S.pageSel = new Set();
    scrollToPage(q); setCurrentPage(q, true);
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault(); e.stopPropagation();
    const q = e.key === 'Home' ? 0 : S.pages.length - 1;
    scrollToPage(q, false); setCurrentPage(q, true);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); e.stopPropagation(); scrollToPage(p);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault(); e.stopPropagation();
    pageAction('delete', S.pageSel.size > 1 ? pickedPages() : [p]);
  }
});
$('#pagebar').addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  if (b.dataset.a === 'none') { S.pageSel = new Set(); syncThumbState(); return; }
  pageAction(b.dataset.a, pickedPages());
});
// Réorganisation par glisser-déposer
let dragThumb = null;
$('#thumbs').addEventListener('dragstart', e => {
  const t = e.target.closest('.thumb');
  if (!t) return;
  dragThumb = +t.dataset.p;
  t.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/x-page', String(dragThumb));
});
$('#thumbs').addEventListener('dragend', () => {
  dragThumb = null;
  $$('.thumb').forEach(t => t.classList.remove('dragging', 'drop-before', 'drop-after'));
});
function thumbDropTarget(e) {
  const thumbs = $$('.thumb');
  if (!thumbs.length) return null;
  let target = thumbs[thumbs.length - 1], after = true;
  for (const t of thumbs) {
    const r = t.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { target = t; after = false; break; }
  }
  return { t: target, after, index: +target.dataset.p + (after ? 1 : 0) };
}
$('#thumbs').addEventListener('dragover', e => {
  const isFile = e.dataTransfer.types.includes('Files');
  if (dragThumb == null && !isFile) return;
  e.preventDefault();
  e.stopPropagation();
  const tg = thumbDropTarget(e);
  $$('.thumb').forEach(t => t.classList.remove('drop-before', 'drop-after'));
  if (tg) tg.t.classList.add(tg.after ? 'drop-after' : 'drop-before');
});
$('#thumbs').addEventListener('drop', e => {
  e.preventDefault();
  e.stopPropagation();
  document.body.classList.remove('dragging-file');
  const tg = thumbDropTarget(e);
  $$('.thumb').forEach(t => t.classList.remove('drop-before', 'drop-after'));
  if (!tg) return;
  if (e.dataTransfer.files.length) {
    [...e.dataTransfer.files].reverse().forEach(f => mergeFile(f, tg.index));
    return;
  }
  if (dragThumb == null) return;
  let to = tg.index;
  if (to > dragThumb) to -= 1;
  if (to !== dragThumb) runOp({ op: 'page_move', from: dragThumb, to });
});

// ------------------------------------------------------------------ sélection & éléments
const getEl = (p, id) => (S.els[p] || []).find(e => e.id === id);
const getPara = (p, id) => (S.paras[p] || []).find(q => q.id === id);
// paragraphe « éditable comme un bloc » d'une ligne de texte
function blockOf(p, el) {
  if (!el || el.type !== 'text' || !el.para) return null;
  const q = getPara(p, el.para);
  return q && q.lines.length > 1 ? q : null;
}
const FIELD_LABEL = { text: 'Champ texte', checkbox: 'Case à cocher', radio: 'Bouton radio', combo: 'Liste déroulante', list: 'Liste', signature: 'Champ signature', button: 'Bouton' };
function elLabel(p, el) {
  if (el.type === 'widget') return (FIELD_LABEL[el.kind] || 'Champ') + (el.label ? ` · ${el.label}` : '') + (el.readonly ? ' (lecture seule)' : '');
  if (el.type === 'annot') return `${TYPE_LABEL[el.type]} · ${el.subtype}`;
  if (el.type === 'text') {
    const q = blockOf(p, el);
    const base = el.ocr ? 'Texte scanné' : 'Texte';
    return q && q.flow ? `${base} · paragraphe de ${q.lines.length} lignes` : base;
  }
  return TYPE_LABEL[el.type];
}
const isSelected = (p, el) => S.sel.some(s => s.page === p && s.id === el.id);
function selEls() {
  return S.sel.map(s => ({ page: s.page, el: getEl(s.page, s.id) })).filter(x => x.el);
}
function elRef(p, el, extra) {
  return Object.assign({ page: p, id: el.id, type: el.type, bbox: el.bbox, text: el.text }, extra || {});
}
const area = b => Math.max(b[2] - b[0], 0.5) * Math.max(b[3] - b[1], 0.5);
function isBig(p, el) { const pg = S.pages[p]; return area(el.bbox) > 0.5 * pg.w * pg.h; }

function hitTest(p, x, y) {
  const els = S.els[p];
  if (!els) return null;
  const pad = 4 / S.zoom;
  let best = null, bestScore = Infinity;
  for (const el of els) {
    let [x0, y0, x1, y1] = el.bbox;
    if (x1 - x0 < 2 * pad) { x0 -= pad; x1 += pad; }
    if (y1 - y0 < 2 * pad) { y0 -= pad; y1 += pad; }
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    let score = area(el.bbox);
    if (el.type === 'annot' || el.type === 'widget') score *= 0.5;
    else if (el.type === 'text') score *= 0.8;
    if (score < bestScore) { best = el; bestScore = score; }
  }
  return best;
}

function boxStyle(b) {
  const z = S.zoom;
  return `left:${b[0] * z}px;top:${b[1] * z}px;width:${Math.max((b[2] - b[0]) * z, 2)}px;height:${Math.max((b[3] - b[1]) * z, 2)}px`;
}

function setHover(p, el) {
  $$('.hoverbox, .parabox').forEach(h => { if (!el || +h.parentNode.parentNode.dataset.p !== p) h.remove(); });
  $$('.page.over-el, .page.over-field').forEach(d => d.classList.remove('over-el', 'over-field'));
  if (!el) { hintFor(null); return; }
  const ov = overlayEl(p);
  pageEl(p).classList.add(fillable(el) && !isSelected(p, el) ? 'over-field' : 'over-el');
  const q = blockOf(p, el);
  let pb = ov.querySelector('.parabox');
  if (q && q.flow) {
    if (!pb) { pb = document.createElement('div'); pb.className = 'parabox'; ov.appendChild(pb); }
    pb.style.cssText = boxStyle(q.bbox);
  } else if (pb) pb.remove();
  let h = ov.querySelector('.hoverbox');
  if (!h) { h = document.createElement('div'); h.className = 'hoverbox'; ov.appendChild(h); }
  h.style.cssText = boxStyle(el.bbox);
  h.innerHTML = isSelected(p, el) ? '' : `<span class="tag">${escapeHtml(elLabel(p, el))}</span>`;
  hintFor(p, el);
}

function drawSelection() {
  document.body.classList.toggle('has-sel', S.sel.length > 0);  // au doigt : la page ne défile plus, l'élément se déplace
  $$('.selbox, .handle, .minibar').forEach(n => n.remove());
  const items = selEls();
  for (const { page, el } of items) {
    const ov = overlayEl(page);
    if (!ov) continue;
    const b = document.createElement('div');
    b.className = 'selbox' + (S.clip && S.clip.cut && S.clip.items.some(c => c.page === page && c.id === el.id) ? ' cut' : '');
    b.style.cssText = boxStyle(el.bbox);
    ov.appendChild(b);
  }
  if (editor || S.selQuiet) return;
  if (items.length === 1) {
    const { page, el } = items[0];
    const ov = overlayEl(page);
    if (!ov) return;
    const [x0, y0, x1, y1] = el.bbox.map(v => v * S.zoom);
    const corners = { nw: [x0, y0], ne: [x1, y0], sw: [x0, y1], se: [x1, y1] };
    const edges = { n: [(x0 + x1) / 2, y0], s: [(x0 + x1) / 2, y1], w: [x0, (y0 + y1) / 2], e: [x1, (y0 + y1) / 2] };
    const hs = el.type === 'text' ? corners : Object.assign({}, corners, (x1 - x0 > 30 && y1 - y0 > 30) ? edges : {});
    for (const [k, [x, y]] of Object.entries(hs)) {
      const h = document.createElement('div');
      h.className = 'handle';
      h.dataset.h = k;
      h.style.left = x + 'px';
      h.style.top = y + 'px';
      ov.appendChild(h);
    }
  }
  if (items.length) {
    // mini barre d'actions au-dessus de la sélection
    const { page } = items[0];
    const onPage = items.filter(i => i.page === page);
    const x0 = Math.min(...onPage.map(i => i.el.bbox[0])), y0 = Math.min(...onPage.map(i => i.el.bbox[1]));
    const ov = overlayEl(page);
    if (!ov) return;
    const bar = document.createElement('div');
    bar.className = 'minibar';
    bar.style.left = Math.max(0, x0 * S.zoom) + 'px';
    bar.style.top = Math.max(y0 * S.zoom, 44) + 'px';
    const single = items.length === 1 ? items[0].el : null;
    const q = single && blockOf(page, single);
    bar.innerHTML =
      (single && single.type === 'text' ? (q
        ? `<button data-a="edit" title="${q.flow ? 'Modifier tout le paragraphe (double-clic / Entrée)' : 'Modifier toutes les lignes du bloc'}"><i data-icon="paragraph"></i>Modifier le ${q.flow ? 'paragraphe' : 'bloc'}</button><button data-a="editLine" title="Modifier seulement cette ligne (Alt + double-clic)"><i data-icon="edit"></i>Ligne seule</button>`
        : `<button data-a="edit" title="Modifier le texte (double-clic / Entrée)"><i data-icon="edit"></i>Modifier</button>`) : '') +
      (items.some(i => ['text', 'image', 'drawing'].includes(i.el.type)) ? `<button data-a="dup" title="Dupliquer (Ctrl+D)"><i data-icon="copy"></i>Dupliquer</button>` : '') +
      `<button data-a="del" class="del" title="Supprimer (Suppr)"><i data-icon="trash"></i>Supprimer</button>`;
    hydrateIcons(bar);
    bar.addEventListener('pointerdown', e => e.stopPropagation());
    bar.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a === 'del') deleteSelection();
      else if (b.dataset.a === 'dup') duplicateSelection();
      else if (b.dataset.a === 'edit') editText(items[0].page, items[0].el, null, false, true);
      else if (b.dataset.a === 'editLine') editText(items[0].page, items[0].el, null, true);
    });
    ov.appendChild(bar);
  }
}
function setSelection(sel) { flushNudge(); S.sel = sel; S.selQuiet = false; drawSelection(); renderPanel(); }

function deleteSelection() {
  const items = selEls();
  if (!items.length) return;
  const n = items.length;
  S.sel = [];
  drawSelection();
  runOp({ op: 'delete', items: items.map(i => elRef(i.page, i.el)) })
    .then(r => { if (r) toast(n > 1 ? `${n} éléments supprimés` : 'Élément supprimé', 'info', 4000, undoAction); });
}
function duplicateSelection() {
  const items = selEls().filter(i => ['text', 'image', 'drawing'].includes(i.el.type));
  if (!items.length) return;
  const off = 14;
  runOp({
    op: 'move', copy: true,
    items: items.map(({ page, el }) => {
      const pg = S.pages[page];
      const [x0, y0, x1, y1] = el.bbox;
      const dx = x1 + off > pg.w ? -off : off, dy = y1 + off > pg.h ? -off : off;
      return elRef(page, el, { to: [x0 + dx, y0 + dy, x1 + dx, y1 + dy] });
    }),
  });
}
function moveItems(items, copy) {
  if (!items.length) return;
  runOp({ op: 'move', copy: !!copy, items });
}

// ------------------------------------------------------------------ aperçus (fantômes)
function clearGhosts() { $$('.overlay .ghost, .overlay .ghost-origin, .overlay .marquee, .overlay .guide, .overlay svg.preview').forEach(n => n.remove()); }
function showGhost(p, from, to, keepOrigin) {
  const ov = overlayEl(p);
  const img = pageEl(p).querySelector('img.render');
  const z = S.zoom, pg = S.pages[p];
  if (!keepOrigin) {
    const o = document.createElement('div');
    o.className = 'ghost-origin';
    o.style.cssText = boxStyle(from);
    ov.appendChild(o);
  }
  const fw = from[2] - from[0], fh = from[3] - from[1];
  const sx = fw > 0.5 ? (to[2] - to[0]) / fw : 1, sy = fh > 0.5 ? (to[3] - to[1]) / fh : 1;
  const g = document.createElement('div');
  g.className = 'ghost';
  g.style.cssText = boxStyle(to);
  g.style.backgroundImage = `url("${img.src}")`;
  g.style.backgroundSize = `${pg.w * z * sx}px ${pg.h * z * sy}px`;
  g.style.backgroundPosition = `${-from[0] * z * sx}px ${-from[1] * z * sy}px`;
  ov.appendChild(g);
}
function svgPreview(p) {
  const ov = overlayEl(p);
  let svg = ov.querySelector('svg.preview');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'preview');
    ov.appendChild(svg);
  }
  return svg;
}

// ------------------------------------------------------------------ interactions souris
let drag = null;
function ptFromEvent(e, p) {
  const r = pageEl(p).getBoundingClientRect();
  return { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom };
}
function normRect(a, b) { return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]; }
function clampRectToPage(p, r) {
  const pg = S.pages[p];
  const w = r[2] - r[0], h = r[3] - r[1];
  const x0 = clamp(r[0], 0, Math.max(0, pg.w - w)), y0 = clamp(r[1], 0, Math.max(0, pg.h - h));
  return [x0, y0, x0 + w, y0 + h];
}

pagesEl.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('.editor-wrap') || e.target.closest('.minibar') || e.target.closest('.fmtbar') || e.target.closest('.scanbanner') || e.target.closest('.fieldeditor')) return;
  hideMenu();
  if (editor) { closeEditor(false); }
  if (fieldEd) closeFieldEditor(false);
  const pe = e.target.closest('.page');
  if (!pe) { if (S.tool === 'select' && !e.shiftKey) setSelection([]); return; }
  const p = +pe.dataset.p;
  const pt = ptFromEvent(e, p);
  if (S.placing) { e.preventDefault(); placeSignature(p, pt); return; }
  // au doigt, avec l'outil de sélection : on laisse le navigateur faire défiler,
  // un simple toucher sélectionne (voir pointerup)
  if (e.pointerType === 'touch' && S.tool === 'select') {
    const hit = hitTest(p, pt.x, pt.y);
    if (!(hit && isSelected(p, hit))) { drag = { kind: 'tap', p, start: pt }; return; }
  }
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  setCurrentPage(p);
  pe.setPointerCapture(e.pointerId);

  if (S.tool === 'select') {
    const hd = e.target.closest('.handle');
    if (hd && S.sel.length === 1) {
      const it = selEls()[0];
      if (it) { drag = { kind: 'resize', p, start: pt, h: hd.dataset.h, el: it.el, page: it.page }; return; }
    }
    const el = hitTest(p, pt.x, pt.y);
    // champ de formulaire : un clic le remplit, glisser le déplace
    if (el && fillable(el) && !(e.shiftKey || e.ctrlKey || e.metaKey) && !isSelected(p, el)) {
      drag = { kind: 'field', p, start: pt, el };
      return;
    }
    if (el && (isSelected(p, el) || !isBig(p, el))) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        if (isSelected(p, el)) { setSelection(S.sel.filter(s => !(s.page === p && s.id === el.id))); return; }
        setSelection(S.sel.concat([{ page: p, id: el.id }]));
      } else if (!isSelected(p, el)) {
        setSelection([{ page: p, id: el.id }]);
      } else if (S.selQuiet) {
        S.selQuiet = false;
        drawSelection();
      }
      setHover(p, el);
      drag = { kind: 'move', p, start: pt, moved: false };
    } else {
      if (!e.shiftKey) setSelection([]);
      drag = { kind: 'marquee', p, start: pt, bigEl: el, add: e.shiftKey };
    }
    return;
  }
  if (S.tool === 'text') { drag = { kind: 'click', p, start: pt }; return; }
  if (S.tool === 'line' || S.tool === 'arrow') { drag = { kind: 'line', p, start: pt, end: pt }; return; }
  if (S.tool === 'ink') {
    clearTimeout(inkTimer);
    if (pendingInk && pendingInk.p !== p) commitInk();
    drag = { kind: 'ink', p, pts: [[round2(pt.x), round2(pt.y)]] };
    return;
  }
  drag = { kind: 'rect', p, start: pt, end: pt };
});

window.addEventListener('pointermove', e => {
  if (!drag) {
    if (S.tool !== 'select' || !S.sid || editor) return;
    const pe = e.target.closest && e.target.closest('.page');
    if (!pe || e.target.closest('.minibar') || e.target.closest('.scanbanner')) { setHover(null, null); return; }
    const p = +pe.dataset.p;
    const pt = ptFromEvent(e, p);
    const hd = e.target.closest('.handle');
    if (hd) { setHover(null, null); return; }
    const el = hitTest(p, pt.x, pt.y);
    const shown = el && (!isBig(p, el) || isSelected(p, el)) ? el : (el && e.altKey ? el : null);
    setHover(p, shown);
    if (!shown) hintFor(p, null);
    return;
  }
  const p = drag.p;
  const pt = ptFromEvent(e, p);
  const z = S.zoom;
  if (drag.kind === 'tap') {
    if (Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) * z > 8) drag = null;
    return;
  }
  if (drag.kind === 'field') {
    if (Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) * z < 3) return;
    setSelection([{ page: p, id: drag.el.id }]);
    drag = { kind: 'move', p, start: drag.start, moved: false };
  }
  if (drag.kind === 'move') {
    let dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) * z < 3) return;
    drag.moved = true;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    clearGhosts();
    // guides d'alignement (Ctrl : sans aimantation)
    if (!e.ctrlKey && !e.metaKey) [dx, dy] = snapMove(p, dx, dy, e.shiftKey);
    drag.dx = dx; drag.dy = dy; drag.copy = e.altKey;
    setHover(null, null);
    for (const { page, el } of selEls()) {
      if (page !== p) continue;
      const b = el.bbox;
      showGhost(p, b, [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy], e.altKey);
    }
  } else if (drag.kind === 'resize') {
    const keep = drag.el.type === 'text' || (drag.h.length === 2 && (drag.el.type === 'image' ? !e.shiftKey : e.shiftKey));
    const to = resizeBox(drag.el.bbox, drag.h, pt.x - drag.start.x, pt.y - drag.start.y, keep);
    drag.to = to;
    clearGhosts();
    showGhost(drag.page, drag.el.bbox, to, false);
  } else if (drag.kind === 'marquee') {
    drag.end = pt;
    clearGhosts();
    const r = normRect(drag.start, pt);
    const m = document.createElement('div');
    m.className = 'marquee';
    m.style.cssText = boxStyle(r);
    overlayEl(p).appendChild(m);
  } else if (drag.kind === 'rect') {
    drag.end = pt;
    let r = normRect(drag.start, pt);
    if (e.shiftKey && (S.tool === 'rect' || S.tool === 'ellipse')) {
      const s = Math.max(r[2] - r[0], r[3] - r[1]);
      r = [drag.start.x < pt.x ? r[0] : r[2] - s, drag.start.y < pt.y ? r[1] : r[3] - s, 0, 0];
      r[2] = r[0] + s; r[3] = r[1] + s;
    }
    drag.r = r;
    drawRectPreview(p, r);
  } else if (drag.kind === 'line') {
    let end = pt;
    if (e.shiftKey) {
      const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      end = { x: drag.start.x + Math.cos(ang) * len, y: drag.start.y + Math.sin(ang) * len };
    }
    drag.end = end;
    const svg = svgPreview(p);
    const c = S.props.stroke, w = S.props.width * z;
    const a = drag.start, b = end;
    let html = `<line x1="${a.x * z}" y1="${a.y * z}" x2="${b.x * z}" y2="${b.y * z}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${S.props.opacity}"/>`;
    if (S.tool === 'arrow') {
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
      const head = Math.max(8, S.props.width * 4);
      const bx = b.x - ux * head, by = b.y - uy * head;
      const pts = [[bx - uy * head / 2, by + ux * head / 2], [b.x, b.y], [bx + uy * head / 2, by - ux * head / 2]];
      html += `<polygon points="${pts.map(q => q[0] * z + ',' + q[1] * z).join(' ')}" fill="${c}" opacity="${S.props.opacity}"/>`;
    }
    svg.innerHTML = html;
  } else if (drag.kind === 'ink') {
    const last = drag.pts[drag.pts.length - 1];
    if (Math.hypot(pt.x - last[0], pt.y - last[1]) * z < 1.5) return;
    drag.pts.push([round2(pt.x), round2(pt.y)]);
    drawInkPreview(p);
  }
});

window.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  const p = d.p;
  const pt = ptFromEvent(e, p);
  const z = S.zoom;
  if (d.kind !== 'ink') clearGhosts();

  if (d.kind === 'tap') {
    const el = hitTest(p, pt.x, pt.y);
    setCurrentPage(p);
    if (el && fillable(el)) { openField(p, el); return; }
    setSelection(el && !isBig(p, el) ? [{ page: p, id: el.id }] : []);
    return;
  }
  if (d.kind === 'field') { openField(p, d.el); return; }
  if (d.kind === 'move') {
    if (!d.moved) return;
    const items = selEls().filter(i => i.page === p).map(({ el }) => {
      const b = el.bbox;
      return elRef(p, el, { to: [b[0] + d.dx, b[1] + d.dy, b[2] + d.dx, b[3] + d.dy] });
    });
    moveItems(items, d.copy);
  } else if (d.kind === 'resize') {
    if (!d.to) return;
    moveItems([elRef(d.page, d.el, { to: d.to })], false);
  } else if (d.kind === 'marquee') {
    const r = normRect(d.start, d.end || d.start);
    if ((r[2] - r[0]) * z < 3 && (r[3] - r[1]) * z < 3) {
      if (d.bigEl) setSelection([{ page: p, id: d.bigEl.id }]);
      return;
    }
    const pg = S.pages[p];
    const inside = (S.els[p] || []).filter(el => {
      const b = el.bbox;
      const full = b[0] >= r[0] - 1 && b[1] >= r[1] - 1 && b[2] <= r[2] + 1 && b[3] <= r[3] + 1;
      if (full) return true;
      if (el.type === 'text') {
        const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
        return cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3] && area(b) < pg.w * pg.h * 0.3;
      }
      return false;
    }).map(el => ({ page: p, id: el.id }));
    const base = d.add ? S.sel : [];
    setSelection(base.concat(inside.filter(i => !base.some(s => s.page === i.page && s.id === i.id))));
  } else if (d.kind === 'click') {
    openNewText(p, pt);
  } else if (d.kind === 'rect') {
    finishRectTool(p, d.r || normRect(d.start, d.end), d.start);
  } else if (d.kind === 'line') {
    const a = d.start, b = d.end;
    if (Math.hypot(b.x - a.x, b.y - a.y) * z < 4) return;
    runOp({
      op: 'add_shape', kind: S.tool, page: p, p1: [round2(a.x), round2(a.y)], p2: [round2(b.x), round2(b.y)],
      stroke: S.props.stroke, width: S.props.width, opacity: S.props.opacity,
    });
    setTool('select');
  } else if (d.kind === 'ink') {
    if (!pendingInk) pendingInk = { p, strokes: [] };
    pendingInk.strokes.push(d.pts);
    clearTimeout(inkTimer);
    inkTimer = setTimeout(commitInk, 1100);
  }
});

// le navigateur reprend la main (défilement au doigt, perte de focus…)
window.addEventListener('pointercancel', () => {
  if (!drag) return;
  drag = null;
  clearGhosts();
});

// Aimantation : bords et centre de la sélection vers ceux de la page et des
// autres éléments.  Retourne le déplacement corrigé et dessine les guides.
function snapMove(p, dx, dy, axisLock) {
  const items = selEls().filter(i => i.page === p);
  if (!items.length) return [dx, dy];
  const pg = S.pages[p];
  if (!drag.snap) {
    const ids = new Set(items.map(i => i.el.id));
    const xs = [0, pg.w / 2, pg.w], ys = [0, pg.h / 2, pg.h];
    const others = (S.els[p] || []).filter(el => !ids.has(el.id) && !isBig(p, el));
    if (others.length <= 400) {
      for (const el of others) {
        const [x0, y0, x1, y1] = el.bbox;
        xs.push(x0, (x0 + x1) / 2, x1); ys.push(y0, (y0 + y1) / 2, y1);
      }
    }
    const b = [Math.min(...items.map(i => i.el.bbox[0])), Math.min(...items.map(i => i.el.bbox[1])),
      Math.max(...items.map(i => i.el.bbox[2])), Math.max(...items.map(i => i.el.bbox[3]))];
    drag.snap = { xs, ys, b };
  }
  const { xs, ys, b } = drag.snap;
  const tol = 5 / S.zoom;
  const best = (cands, edges, d) => {
    let r = null;
    for (const e of edges) for (const c of cands) {
      const delta = c - (e + d);
      if (Math.abs(delta) < tol && (!r || Math.abs(delta) < Math.abs(r.delta))) r = { delta, at: c };
    }
    return r;
  };
  const sx = axisLock && dx === 0 ? null : best(xs, [b[0], (b[0] + b[2]) / 2, b[2]], dx);
  const sy = axisLock && dy === 0 ? null : best(ys, [b[1], (b[1] + b[3]) / 2, b[3]], dy);
  const ov = overlayEl(p), z = S.zoom;
  if (sx) {
    dx += sx.delta;
    const g = document.createElement('div');
    g.className = 'guide v';
    g.style.cssText = `left:${sx.at * z}px;top:0;height:${pg.h * z}px`;
    ov.appendChild(g);
  }
  if (sy) {
    dy += sy.delta;
    const g = document.createElement('div');
    g.className = 'guide h';
    g.style.cssText = `top:${sy.at * z}px;left:0;width:${pg.w * z}px`;
    ov.appendChild(g);
  }
  return [dx, dy];
}

pagesEl.addEventListener('dblclick', e => {
  if (S.tool !== 'select' || e.target.closest('.editor-wrap') || e.target.closest('.minibar') || e.target.closest('.fmtbar')) return;
  const pe = e.target.closest('.page');
  if (!pe) return;
  const p = +pe.dataset.p;
  const pt = ptFromEvent(e, p);
  const el = hitTest(p, pt.x, pt.y);
  if (el && el.type === 'text') editText(p, el, e, e.altKey);
  else if (S.scan[p] && (!el || el.type === 'image')) offerOcr(p);
  else if (!el || isBig(p, el) || el.type === 'drawing') openNewText(p, pt);
});

viewer.addEventListener('scroll', () => {
  const mid = viewer.scrollTop + viewer.clientHeight / 2;
  let cur = 0;
  for (const d of pagesEl.children) { if (d.offsetTop <= mid) cur = +d.dataset.p; else break; }
  setCurrentPage(cur);
}, { passive: true });

window.addEventListener('wheel', e => {
  if (e.ctrlKey && S.sid && !e.target.closest('#viewer')) e.preventDefault();
}, { passive: false });
viewer.addEventListener('wheel', e => {
  if (!e.ctrlKey || !S.sid) return;
  e.preventDefault();
  setZoom(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX, y: e.clientY });
}, { passive: false });

function resizeBox(b, h, dx, dy, keepRatio) {
  let [x0, y0, x1, y1] = b;
  const w = Math.max(x1 - x0, 0.5), ht = Math.max(y1 - y0, 0.5);
  if (h.includes('w')) x0 += dx;
  if (h.includes('e')) x1 += dx;
  if (h.includes('n')) y0 += dy;
  if (h.includes('s')) y1 += dy;
  const min = 3;
  if (x1 - x0 < min) { if (h.includes('w')) x0 = x1 - min; else x1 = x0 + min; }
  if (y1 - y0 < min) { if (h.includes('n')) y0 = y1 - min; else y1 = y0 + min; }
  if (b[2] - b[0] < 0.5) { x0 = b[0]; x1 = b[2]; }
  if (b[3] - b[1] < 0.5) { y0 = b[1]; y1 = b[3]; }
  if (keepRatio && h.length === 2) {
    const s = Math.max((x1 - x0) / w, (y1 - y0) / ht);
    const nw = w * s, nh = ht * s;
    if (h.includes('w')) x0 = x1 - nw; else x1 = x0 + nw;
    if (h.includes('n')) y0 = y1 - nh; else y1 = y0 + nh;
  }
  return [x0, y0, x1, y1].map(round2);
}

function drawRectPreview(p, r) {
  const svg = svgPreview(p);
  const z = S.zoom;
  const [x, y, w, h] = [r[0] * z, r[1] * z, (r[2] - r[0]) * z, (r[3] - r[1]) * z];
  const t = S.tool, P = S.props;
  let html;
  if (t === 'ellipse') html = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${P.fill === 'none' ? 'none' : P.fill}" stroke="${P.stroke === 'none' ? 'none' : P.stroke}" stroke-width="${P.width * z}" opacity="${P.opacity}"/>`;
  else if (t === 'rect') html = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.fill === 'none' ? 'none' : P.fill}" stroke="${P.stroke === 'none' ? 'none' : P.stroke}" stroke-width="${P.width * z}" opacity="${P.opacity}"/>`;
  else if (t === 'highlight') html = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.hl}" opacity=".45" style="mix-blend-mode:multiply"/>`;
  else if (t === 'whiteout') html = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#4f46e5" stroke-dasharray="4 3"/>`;
  else if (t === 'erase') html = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(229,72,77,.12)" stroke="#e5484d" stroke-dasharray="5 3"/>`;
  else html = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(79,70,229,.08)" stroke="#4f46e5" stroke-dasharray="5 3"/>`;
  svg.innerHTML = html;
}

function finishRectTool(p, r, start) {
  const z = S.zoom, P = S.props;
  const tiny = (r[2] - r[0]) * z < 5 || (r[3] - r[1]) * z < 5;
  const t = S.tool;
  if (t === 'image') {
    pickImage(file => addImageFile(file, p, tiny ? { x: start.x, y: start.y } : null, tiny ? null : r));
    return;
  }
  if (t === 'rect' || t === 'ellipse') {
    if (tiny) r = clampRectToPage(p, [start.x, start.y, start.x + 120, start.y + 80]);
    runOp({ op: 'add_shape', kind: t, page: p, bbox: r.map(round2), stroke: P.stroke, fill: P.fill, width: P.width, opacity: P.opacity });
    setTool('select');
    return;
  }
  if (tiny) return;
  if (t === 'whiteout') {
    runOp({ op: 'add_shape', kind: 'rect', page: p, bbox: r.map(round2), stroke: 'none', fill: '#ffffff', width: 0, opacity: 1 })
      .then(res => { if (res) toast('Zone masquée', 'info', 4000, undoAction); });
  } else if (t === 'highlight') {
    runOp({ op: 'add_highlight', page: p, bbox: r.map(round2), color: P.hl });
  } else if (t === 'erase') {
    runOp({ op: 'erase', page: p, bbox: r.map(round2) })
      .then(res => { if (res) toast('Contenu de la zone effacé', 'info', 5000, undoAction); });
  }
}

// ------------------------------------------------------------------ dessin libre
let pendingInk = null, inkTimer = null;
function drawInkPreview(p) {
  const svg = svgPreview(p);
  const z = S.zoom, P = S.props;
  const strokes = [];
  if (pendingInk && pendingInk.p === p) strokes.push(...pendingInk.strokes);
  if (drag && drag.kind === 'ink' && drag.p === p) strokes.push(drag.pts);
  svg.innerHTML = strokes.map(s => `<polyline points="${s.map(q => q[0] * z + ',' + q[1] * z).join(' ')}" fill="none" stroke="${P.color}" stroke-width="${P.width * z}" stroke-linecap="round" stroke-linejoin="round" opacity="${P.opacity}"/>`).join('');
}
function removeInkPreview(p) {
  const svg = overlayEl(p) && overlayEl(p).querySelector('svg.preview');
  if (svg && !(pendingInk && pendingInk.p === p)) svg.remove();
}
function commitInk() {
  clearTimeout(inkTimer);
  if (!pendingInk) return;
  const { p, strokes } = pendingInk;
  pendingInk = null;
  const P = S.props;
  const color = P.color, width = P.width, sid = S.sid;
  runOp({ op: 'add_ink', page: p, strokes, color, width, opacity: P.opacity })
    .then(r => {
      if (r && sid === S.sid && S.tool === 'ink') {
        toast('Dessin ajouté', 'ok', 6000, { label: 'Garder comme signature', fn: () => saveSignature(strokes, color, width) });
      }
    })
    .finally(() => removeInkPreview(p));
}

// ------------------------------------------------------------------ images
function pickImage(cb) {
  const inp = $('#fileImage');
  inp.value = '';
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}
async function addImageFile(file, p, at, box) {
  try {
    const data = await readFileAsDataURL(file);
    await addImageData(data, p, at, box);
  } catch (e) { toast('Image illisible', 'error'); }
}
async function addImageData(data, p, at, box) {
  const { w, h } = await imageSize(data);
  const pg = S.pages[p];
  let r;
  if (box) {
    const s = Math.min((box[2] - box[0]) / w, (box[3] - box[1]) / h);
    const nw = w * s, nh = h * s;
    const x = box[0] + ((box[2] - box[0]) - nw) / 2, y = box[1] + ((box[3] - box[1]) - nh) / 2;
    r = [x, y, x + nw, y + nh];
  } else {
    let nw = w * 0.75, nh = h * 0.75; // px -> pt (96 dpi)
    const maxW = pg.w * 0.6, maxH = pg.h * 0.6;
    const s = Math.min(1, maxW / nw, maxH / nh);
    nw *= s; nh *= s;
    const c = at || { x: pg.w / 2 - nw / 2, y: pg.h / 2 - nh / 2 };
    r = clampRectToPage(p, [c.x, c.y, c.x + nw, c.y + nh]);
  }
  await runOp({ op: 'add_image', page: p, bbox: r.map(round2), data });
  setTool('select');
}

// ------------------------------------------------------------------ éditeur de texte
// Trois modes : 'new' (nouveau texte), 'line' (une ligne), 'para' (paragraphe / bloc, remis en forme).
let editor = null;
const FONT_CSS = () => Object.fromEntries((S.fonts.length ? S.fonts : [{ key: 'helv', css: 'Helvetica, Arial, sans-serif' }]).map(f => [f.key, f.css]));
const BASE_OFF = lh => (lh - 1.15) / 2 + 0.92; // ligne de base dans la 1re ligne, en tailles de police
const ALIGNS = [['left', 'alignLeft', 'Aligner à gauche'], ['center', 'alignCenter', 'Centrer'], ['right', 'alignRight', 'Aligner à droite'], ['justify', 'alignJustify', 'Justifier']];
function cssForPdfFont(name) {
  const n = (name || '').toLowerCase();
  if (/courier|mono|consol/.test(n)) return "'Courier New', monospace";
  if (/(times|serif|georgia|garamond|cambria|minion|book)/.test(n) && !/sans/.test(n)) return "'Times New Roman', Times, serif";
  if (/calibri/.test(n)) return 'Calibri, sans-serif';
  if (/verdana/.test(n)) return 'Verdana, sans-serif';
  if (/segoe/.test(n)) return "'Segoe UI', sans-serif";
  return 'Arial, Helvetica, sans-serif';
}
const edVal = k => (editor.over[k] !== undefined ? editor.over[k] : editor.o[k]);

function makeEditor(p, o) {
  closeEditor(false);
  const ov = overlayEl(p);
  if (!ov) return;
  $$('.minibar, .handle, .hoverbox, .parabox').forEach(n => n.remove());
  // masque l'original pendant l'édition
  let mask = null;
  if (o.mask) {
    mask = document.createElement('div');
    mask.className = 'ed-mask';
    mask.style.cssText = boxStyle(o.mask);
    ov.appendChild(mask);
  }
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';
  const ed = document.createElement('div');
  ed.className = 'editor' + (o.mode !== 'new' ? ' existing' : '');
  try { ed.contentEditable = 'plaintext-only'; } catch (e) { ed.contentEditable = 'true'; }
  if (ed.contentEditable !== 'plaintext-only') ed.contentEditable = 'true';
  ed.spellcheck = true;
  ed.lang = 'fr';
  ed.dataset.placeholder = 'Tapez votre texte…';
  ed.textContent = o.text || '';
  wrap.appendChild(ed);
  const grip = document.createElement('div');
  grip.className = 'ed-grip';
  grip.title = 'Glisser pour changer la largeur (retour à la ligne automatique)';
  wrap.appendChild(grip);
  ov.appendChild(wrap);
  editor = { wrap, el: ed, mask, p, o, over: {}, done: false, bar: null };
  applyEditorStyle();
  buildFmtBar();
  hint(o.mode === 'para'
    ? '<b>Entrée</b> valider · <b>Maj+Entrée</b> nouvelle ligne · <b>Échap</b> annuler · le texte se remet en forme tout seul dans la largeur du bloc'
    : '<b>Entrée</b> valider · <b>Maj+Entrée</b> nouvelle ligne · <b>Échap</b> annuler · tirez le bord droit pour fixer une largeur', true);

  ed.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); closeEditor(true); }
    else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); closeEditor(false); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'b') { ev.preventDefault(); fmtSet('bold', !edVal('bold')); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'i') { ev.preventDefault(); fmtSet('italic', !edVal('italic')); }
  });
  ed.addEventListener('input', () => positionFmtBar());
  ed.addEventListener('blur', ev => {
    if (ev.relatedTarget && editor && editor.bar && editor.bar.contains(ev.relatedTarget)) return;
    setTimeout(() => {
      if (editor && editor.el === ed && !(editor.bar && editor.bar.contains(document.activeElement)) && document.activeElement !== ed) closeEditor(false);
    }, 0);
  });
  ['pointerdown', 'dblclick'].forEach(t => { ed.addEventListener(t, ev => ev.stopPropagation()); wrap.addEventListener(t, ev => ev.stopPropagation()); });
  grip.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const z = S.zoom, a = (o.angle || 0) * Math.PI / 180;
    const w0 = edVal('width') || ed.offsetWidth / z;
    const x0 = ev.clientX, y0 = ev.clientY;
    grip.setPointerCapture(ev.pointerId);
    const move = e2 => {
      const proj = (e2.clientX - x0) * Math.cos(a) - (e2.clientY - y0) * Math.sin(a);
      editor.over.width = round2(Math.max(20, w0 + proj / z));
      applyEditorStyle();
    };
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); ed.focus(); };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });

  // garde l'éditeur et sa barre visibles (au-dessus de la barre d'aide)
  const vr = viewer.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  const over = wr.bottom - (vr.bottom - 70);
  if (over > 0) {
    const before = viewer.scrollTop;
    viewer.scrollTop += over;
    if (o.clientY != null) o.clientY -= viewer.scrollTop - before;
    positionFmtBar();
  }
  ed.focus({ preventScroll: true });
  // place le curseur là où l'on a cliqué, sinon à la fin
  const range = document.createRange();
  let placed = false;
  if (o.clientX != null) {
    try {
      if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(o.clientX, o.clientY);
        if (r && ed.contains(r.startContainer)) { range.setStart(r.startContainer, r.startOffset); placed = true; }
      } else if (document.caretPositionFromPoint) {
        const c = document.caretPositionFromPoint(o.clientX, o.clientY);
        if (c && ed.contains(c.offsetNode)) { range.setStart(c.offsetNode, c.offset); placed = true; }
      }
    } catch (e) { /* ignore */ }
  }
  if (!placed) { range.selectNodeContents(ed); range.collapse(false); }
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function applyEditorStyle() {
  if (!editor) return;
  const { wrap, el: ed, o } = editor;
  const z = S.zoom;
  const size = edVal('size'), lh = o.lh || 1.2, width = edVal('width');
  const off = BASE_OFF(lh) * size;
  wrap.style.left = o.anchor[0] * z + 'px';
  wrap.style.top = (o.anchor[1] - off) * z + 'px';
  wrap.style.transformOrigin = `0 ${off * z}px`;
  wrap.style.transform = o.angle ? `rotate(${-o.angle}deg)` : '';
  const font = edVal('font');
  ed.style.fontFamily = font ? (FONT_CSS()[font] || 'Arial') : o.css;
  ed.style.fontSize = size * z + 'px';
  ed.style.lineHeight = lh;
  ed.style.fontWeight = edVal('bold') ? '700' : '400';
  ed.style.fontStyle = edVal('italic') ? 'italic' : 'normal';
  ed.style.color = edVal('color');
  ed.style.textAlign = edVal('align') || 'left';
  ed.style.textIndent = (o.indent || 0) * z + 'px';
  if (width) { ed.style.width = width * z + 'px'; ed.style.whiteSpace = 'pre-wrap'; ed.style.minWidth = ''; }
  else { ed.style.width = ''; ed.style.whiteSpace = 'pre'; ed.style.minWidth = (o.minW || 0) * z + 'px'; }
  positionFmtBar();
}

function buildFmtBar() {
  const { o, p } = editor;
  const bar = document.createElement('div');
  bar.className = 'fmtbar';
  const fontOpts = (o.mode === 'new' ? '' : `<option value="">${o.ocr ? 'Police standard' : "Police d'origine"}</option>`) +
    S.fonts.map(f => `<option value="${f.key}">${escapeHtml(f.label)}</option>`).join('');
  const multi = o.mode !== 'line';
  bar.innerHTML = `
    <select data-f="font" title="Police">${fontOpts}</select>
    <span class="fgroup"><button data-f="smaller" title="Plus petit">A<sup>−</sup></button><input data-f="size" type="number" min="3" max="400" step="0.5" title="Taille (pt)"><button data-f="bigger" title="Plus grand">A<sup>+</sup></button></span>
    <span class="fgroup"><button data-f="bold" class="tg" title="Gras (Ctrl+B)"><b>B</b></button><button data-f="italic" class="tg" title="Italique (Ctrl+I)"><i style="font-family:serif">I</i></button>
    <label class="fcolor" title="Couleur"><input type="color" data-f="color"><span></span></label></span>
    ${multi ? `<span class="fgroup">${ALIGNS.map(([v, ic, t]) => `<button data-f="align" data-v="${v}" class="tg" title="${t}">${icon(ic)}</button>`).join('')}</span>` : ''}
    <span class="fgroup end"><button data-f="cancel" title="Annuler (Échap)">${icon('close')}</button><button data-f="ok" class="ok" title="Valider (Entrée)">${icon('check')}Valider</button></span>`;
  overlayEl(p).appendChild(bar);
  editor.bar = bar;
  syncFmtBar();
  bar.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    if (ev.target.closest('button')) ev.preventDefault(); // garde le focus dans le texte
  });
  bar.addEventListener('dblclick', ev => ev.stopPropagation());
  bar.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    if (f === 'ok') closeEditor(false);
    else if (f === 'cancel') closeEditor(true);
    else if (f === 'smaller' || f === 'bigger') fmtSet('size', Math.max(3, round2(edVal('size') + (f === 'bigger' ? 1 : -1))));
    else if (f === 'bold' || f === 'italic') fmtSet(f, !edVal(f));
    else if (f === 'align') fmtSet('align', b.dataset.v);
  });
  bar.querySelector('[data-f="font"]').addEventListener('change', ev => { fmtSet('font', ev.target.value || undefined); if (editor) editor.el.focus(); });
  const size = bar.querySelector('[data-f="size"]');
  size.addEventListener('input', () => { const v = parseFloat(size.value); if (v >= 3) fmtSet('size', v, true); });
  size.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); editor.el.focus(); }
  });
  const col = bar.querySelector('[data-f="color"]');
  col.addEventListener('input', () => fmtSet('color', col.value, true));
  col.addEventListener('change', () => { if (editor) editor.el.focus(); });
  bar.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!editor || editor.bar !== bar) return;
      const a = document.activeElement;
      if (a !== editor.el && !bar.contains(a)) closeEditor(false);
    }, 0);
  });
}
function fmtSet(k, v, keepFocus) {
  if (!editor) return;
  if (v === undefined) delete editor.over[k]; else editor.over[k] = v;
  if (editor.o.mode === 'new' && v !== undefined && k in S.props) { S.props[k] = v; saveProps(); }
  applyEditorStyle();
  syncFmtBar(keepFocus);
}
function syncFmtBar(keepSize) {
  const bar = editor && editor.bar;
  if (!bar) return;
  bar.querySelector('[data-f="font"]').value = edVal('font') || '';
  const size = bar.querySelector('[data-f="size"]');
  if (!keepSize || document.activeElement !== size) size.value = Math.round(edVal('size') * 10) / 10;
  bar.querySelector('[data-f="bold"]').classList.toggle('on', !!edVal('bold'));
  bar.querySelector('[data-f="italic"]').classList.toggle('on', !!edVal('italic'));
  const c = edVal('color') || '#000000';
  bar.querySelector('[data-f="color"]').value = /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000';
  bar.querySelector('.fcolor span').style.background = c;
  bar.querySelectorAll('[data-f="align"]').forEach(b => b.classList.toggle('on', b.dataset.v === (edVal('align') || 'left')));
}
function positionFmtBar() {
  if (!editor || !editor.bar) return;
  const ov = overlayEl(editor.p);
  const r = editor.wrap.getBoundingClientRect(), orc = ov.getBoundingClientRect();
  const bar = editor.bar;
  const bh = bar.offsetHeight || 40;
  let top = r.top - orc.top - bh - 10;
  if (r.top - bh - 10 < viewer.getBoundingClientRect().top + 64) top = r.bottom - orc.top + 10;
  bar.style.top = top + 'px';
  bar.style.left = Math.max(0, Math.min(r.left - orc.left, orc.width - bar.offsetWidth)) + 'px';
}

function closeEditor(cancel) {
  if (!editor || editor.done) return;
  const E = editor;
  E.done = true;
  editor = null;
  const text = E.el.innerText.replace(/ /g, ' ').replace(/\n+$/, '');
  E.wrap.remove();
  if (E.mask) E.mask.remove();
  if (E.bar) E.bar.remove();
  hint(null);
  if (cancel) { drawSelection(); return; }
  const o = E.o, over = Object.assign({}, E.over);
  const styled = Object.keys(over).length > 0;
  if (o.mode === 'para') {
    if (text === o.text && !styled) { drawSelection(); return; }
    runOp(Object.assign({ op: 'edit_para', page: E.p, para: o.para.id, bbox: o.para.bbox, text }, over));
  } else if (o.mode === 'line') {
    if (text === o.text && !styled) { drawSelection(); return; }
    runOp(Object.assign({ op: 'edit_text' }, elRef(E.p, o.el), { text }, over));
  } else if (text.trim()) {
    const P = S.props;
    runOp(Object.assign({
      op: 'add_text', page: E.p, x: round2(o.anchor[0]), by: round2(o.anchor[1]), text,
      size: P.size, color: P.color, font: P.font, bold: P.bold, italic: P.italic,
    }, over));
    if (S.tool === 'text') setTool('select');
  }
}
function openNewText(p, pt) {
  const P = S.props;
  const pg = S.pages[p];
  const top = clamp(pt.y - P.size * 0.6, 0, pg.h - P.size);
  makeEditor(p, {
    mode: 'new', anchor: [pt.x, top + BASE_OFF(1.2) * P.size], angle: 0, lh: 1.2,
    size: P.size, font: P.font, css: FONT_CSS()[P.font] || 'Arial', bold: P.bold, italic: P.italic,
    color: P.color, align: 'left', text: '',
  });
}
// lineOnly : n'éditer que la ligne ; preferBlock : éditer le bloc même si ce n'est pas un paragraphe « coulé »
function editText(p, el, ev, lineOnly, preferBlock) {
  const q = !lineOnly && blockOf(p, el);
  if (q && (q.flow || preferBlock)) { editPara(p, q, ev); return; }
  setSelection([{ page: p, id: el.id }]);
  makeEditor(p, {
    mode: 'line', el, anchor: el.origin, angle: el.angle, lh: 1.2, size: el.size,
    css: el.ocr ? FONT_CSS().helv : cssForPdfFont(el.font), font: undefined, bold: el.bold, italic: el.italic,
    color: el.ocr ? '#222222' : el.color, ocr: el.ocr, text: el.text, mask: el.bbox,
    minW: el.angle ? 0 : el.bbox[2] - el.bbox[0], clientX: ev && ev.clientX, clientY: ev && ev.clientY,
  });
}
function editPara(p, q, ev) {
  setSelection(q.lines.map(id => ({ page: p, id })));
  makeEditor(p, {
    mode: 'para', para: q, anchor: q.anchor, angle: q.angle, lh: q.spacing / q.size, size: q.size,
    width: q.width, indent: q.indent, align: q.align,
    css: q.ocr ? FONT_CSS().helv : cssForPdfFont(q.font), font: undefined, bold: q.bold, italic: q.italic,
    color: q.ocr ? '#222222' : q.color, ocr: q.ocr, text: q.text, mask: q.bbox,
    clientX: ev && ev.clientX, clientY: ev && ev.clientY,
  });
}

// ------------------------------------------------------------------ barre d'outils
function buildToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = TOOLS.map(t => t.sep ? '<span class="sep"></span>' :
    `<button class="tool" data-tool="${t.id}" title="${t.label} (${t.key.toUpperCase()})" aria-label="${t.label}" aria-pressed="false">${icon(t.id)}<span class="kbd">${t.key.toUpperCase()}</span></button>`).join('');
  tb.addEventListener('click', e => {
    const b = e.target.closest('.tool');
    if (b) setTool(b.dataset.tool);
  });
}
function setTool(t) {
  if (t !== 'ink' && pendingInk) commitInk();
  if (t === S.tool) return;
  S.tool = t;
  document.body.dataset.tool = t;
  $$('.tool').forEach(b => { b.classList.toggle('active', b.dataset.tool === t); b.setAttribute('aria-pressed', b.dataset.tool === t); });
  if (t !== 'select') { setHover(null, null); }
  if (S.placing) stopPlacing();
  renderPanel();
  hint(null);
}

// ------------------------------------------------------------------ panneau de propriétés
function swatches(name, value, list, allowNone) {
  return `<div class="swatches" data-prop="${name}">` +
    (allowNone ? `<button class="sw none ${value === 'none' ? 'active' : ''}" data-v="none" title="Aucun"></button>` : '') +
    list.map(c => `<button class="sw ${value === c ? 'active' : ''}" data-v="${c}" style="background:${c}" title="${COLOR_NAMES[c] || c}" aria-label="${COLOR_NAMES[c] || c}" aria-pressed="${value === c}"></button>`).join('') +
    `<input type="color" class="sw-custom" value="${value === 'none' ? '#000000' : value}" title="Autre couleur">` +
    '</div>';
}
function fontSelect(value) {
  return `<select data-prop="font" aria-label="Police">${S.fonts.map(f => `<option value="${f.key}" ${f.key === value ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}</select>`;
}
function rangeRow(label, prop, v, min, max, step, fmt) {
  return `<div class="row"><label>${label}</label><input type="range" data-prop="${prop}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="val" data-val="${prop}">${fmt(v)}</span></div>`;
}

function renderPanel() {
  const panel = $('#panel');
  if (!S.sid) { panel.innerHTML = ''; return; }
  const P = S.props;
  const t = S.tool;
  let html = '';
  const items = selEls();

  if (t === 'select' && items.length) {
    const counts = {};
    items.forEach(i => { counts[i.el.type] = (counts[i.el.type] || 0) + 1; });
    const desc = Object.entries(counts).map(([k, n]) => `${n} ${TYPE_LABEL[k].toLowerCase()}${n > 1 ? 's' : ''}`).join(', ');
    html += `<div class="psec"><h3>Sélection</h3><p class="lead">${desc}</p>`;
    if (items.length === 1) {
      const { el } = items[0];
      if (el.type === 'text') {
        const q = blockOf(items[0].page, el);
        if (el.ocr) html += `<p class="badge">${icon('scan')} Texte reconnu sur un scan</p>`;
        if (q) html += `<div class="btn-row" style="margin-bottom:10px"><button class="btn small primary" id="pEditBlock">${icon('paragraph')}Modifier le ${q.flow ? 'paragraphe' : 'bloc'} (${q.lines.length} lignes)</button></div>`;
        html += `<div class="textprev">${escapeHtml(el.text)}</div>
          <div class="row"><label for="selSize">Taille</label><input type="number" id="selSize" min="2" max="400" step="0.5" value="${el.size}"></div>
          <div class="row"><label>Couleur</label>${swatches('selColor', el.color, COLORS)}</div>
          <div class="row"><label for="selFont">Police</label><select id="selFont"><option value="">Police d'origine</option>${S.fonts.map(f => `<option value="${f.key}">${escapeHtml(f.label)}</option>`).join('')}</select></div>`;
      } else if (el.type === 'widget') {
        html += `<p class="lead">${escapeHtml(el.subtype || '')}${el.label ? ' — ' + escapeHtml(el.label) : ''}</p>`;
        if (fillable(el)) html += `<div class="btn-row" style="margin-bottom:10px"><button class="btn small primary" id="pFill">${icon('edit')}Remplir ce champ</button></div>`;
        else if (el.readonly) html += '<p class="badge">Lecture seule</p>';
      } else if (el.type === 'annot') {
        html += `<p class="lead">${escapeHtml(el.subtype || '')}</p>`;
      }
      const b = el.bbox;
      html += `<div class="grid4">
          <label>X<input type="number" step="1" data-geo="x" value="${round2(b[0])}"></label>
          <label>Y<input type="number" step="1" data-geo="y" value="${round2(b[1])}"></label>
          <label>L<input type="number" step="1" min="1" data-geo="w" value="${round2(b[2] - b[0])}"></label>
          <label>H<input type="number" step="1" min="1" data-geo="h" value="${round2(b[3] - b[1])}"></label>
        </div>`;
    }
    html += `<div class="btn-row">
        ${items.length === 1 && items[0].el.type === 'text' ? `<button class="btn small" id="pEdit"><i data-icon="edit"></i>${blockOf(items[0].page, items[0].el) ? 'Ligne seule' : 'Modifier'}</button>` : ''}
        <button class="btn small" id="pDup"><i data-icon="copy"></i>Dupliquer</button>
        <button class="btn small danger" id="pDel"><i data-icon="trash"></i>Supprimer</button>
      </div></div>`;
  }

  if (t === 'text' || (t === 'select' && !items.length)) {
    html += `<div class="psec"><h3>${t === 'text' ? 'Nouveau texte' : 'Style du texte ajouté'}</h3>
      ${t === 'text' ? '<p class="lead">Cliquez sur la page à l\'endroit voulu, tapez, puis Entrée.</p>' : ''}
      <div class="row"><label>Police</label>${fontSelect(P.font)}</div>
      <div class="row"><label>Taille</label><input type="number" data-prop="size" min="4" max="300" step="1" value="${P.size}" aria-label="Taille">
        <div class="toggle-row"><button class="toggle ${P.bold ? 'on' : ''}" data-toggle="bold" title="Gras">B</button><button class="toggle ${P.italic ? 'on' : ''}" data-toggle="italic" title="Italique"><i style="font-family:serif">I</i></button></div></div>
      <div class="row"><label>Couleur</label>${swatches('color', P.color, COLORS)}</div>
    </div>`;
  }
  if (t === 'rect' || t === 'ellipse') {
    html += `<div class="psec"><h3>${t === 'rect' ? 'Rectangle' : 'Ellipse'}</h3>
      <p class="lead">Glissez sur la page (Maj = carré / cercle). Un simple clic pose une forme par défaut.</p>
      <div class="row"><label>Contour</label>${swatches('stroke', P.stroke, COLORS, true)}</div>
      <div class="row"><label>Remplissage</label>${swatches('fill', P.fill, COLORS, true)}</div>
      ${rangeRow('Épaisseur', 'width', P.width, 0.5, 20, 0.5, v => v + ' pt')}
      ${rangeRow('Opacité', 'opacity', P.opacity, 0.1, 1, 0.05, v => Math.round(v * 100) + '%')}
    </div>`;
  }
  if (t === 'line' || t === 'arrow') {
    html += `<div class="psec"><h3>${t === 'line' ? 'Ligne' : 'Flèche'}</h3>
      <p class="lead">Glissez du point de départ au point d'arrivée (Maj = angles de 45°).</p>
      <div class="row"><label>Couleur</label>${swatches('stroke', P.stroke === 'none' ? '#111111' : P.stroke, COLORS)}</div>
      ${rangeRow('Épaisseur', 'width', P.width, 0.5, 20, 0.5, v => v + ' pt')}
      ${rangeRow('Opacité', 'opacity', P.opacity, 0.1, 1, 0.05, v => Math.round(v * 100) + '%')}
    </div>`;
  }
  if (t === 'ink' || (t === 'select' && !items.length)) {
    const sigs = loadSignatures();
    html += `<div class="psec"><h3>Signatures</h3>
      ${sigs.length ? `<p class="lead">Cliquez sur une signature, puis sur la page.</p><div class="siglist">${sigs.map(sg => `<div class="sigitem"><button class="sigbtn" data-sig="${sg.id}" title="Poser cette signature">${sigSvg(sg)}</button><button class="sigdel" data-sigdel="${sg.id}" title="Oublier cette signature" aria-label="Oublier cette signature">${icon('close')}</button></div>`).join('')}</div>`
        : '<p class="lead">Créez votre signature une fois, puis posez-la en un clic sur n\'importe quel document.</p>'}
      <div class="btn-row"><button class="btn small" id="pSigNew">${icon('ink')}Créer une signature</button></div></div>`;
  }
  if (t === 'ink') {
    html += `<div class="psec"><h3>Dessin libre</h3>
      <p class="lead">Dessinez ou signez directement sur la page. Les traits rapprochés sont regroupés en un seul élément.</p>
      <div class="row"><label>Couleur</label>${swatches('color', P.color, COLORS)}</div>
      ${rangeRow('Épaisseur', 'width', P.width, 0.5, 20, 0.5, v => v + ' pt')}
      ${rangeRow('Opacité', 'opacity', P.opacity, 0.1, 1, 0.05, v => Math.round(v * 100) + '%')}
    </div>`;
  }
  if (t === 'highlight') {
    html += `<div class="psec"><h3>Surligneur</h3><p class="lead">Glissez sur le texte à surligner.</p>
      <div class="row"><label>Couleur</label>${swatches('hl', P.hl, HL_COLORS)}</div></div>`;
  }
  if (t === 'image') {
    html += `<div class="psec"><h3>Image</h3><p class="lead">Cliquez sur la page (ou tracez un cadre) puis choisissez l'image.<br><br>Astuce : vous pouvez aussi <b>coller</b> une image (Ctrl+V) ou la <b>glisser</b> depuis l'explorateur directement sur la page.</p></div>`;
  }
  if (t === 'whiteout') {
    html += `<div class="psec"><h3>Cache blanc</h3><p class="lead">Tracez un rectangle blanc pour masquer une zone. Le contenu reste dessous : pour l'effacer vraiment, utilisez la gomme ou la sélection + Suppr.</p></div>`;
  }
  if (t === 'erase') {
    html += `<div class="psec"><h3>Gomme</h3><p class="lead">Tracez une zone : tout le texte, les images et les formes qu'elle contient sont <b>réellement supprimés</b> du PDF.</p></div>`;
  }

  if (t === 'select' && !items.length && S.scanPages && S.scanPages.length && S.ocrAvailable) {
    html += `<div class="psec callout"><h3>${icon('scan')} PDF scanné</h3>
      <p class="lead">${S.scanPages.length} page${S.scanPages.length > 1 ? 's sont des images' : ' est une image'} : reconnaissez le texte pour pouvoir le modifier.</p>
      <button class="btn small primary" id="pOcr">${icon('sparkle')}Rendre le texte modifiable</button></div>`;
  }
  const nFields = Object.values(S.els).reduce((n, els) => n + els.filter(fillable).length, 0);
  if (t === 'select' && !items.length && nFields) {
    html += `<div class="psec callout"><h3>${icon('edit')} Formulaire</h3>
      <p class="lead">${nFields} champ${nFields > 1 ? 's' : ''} à remplir sur les pages affichées : cliquez dans un champ et tapez, <b>Tab</b> passe au suivant.</p>
      <button class="btn small primary" id="pFields">Remplir le premier champ</button></div>`;
  }
  if (t === 'select' && !items.length) {
    html += `<div class="psec"><h3>Outils rapides</h3><div class="btn-row">
      <button class="btn small" id="pFind">${icon('search')}Rechercher / remplacer</button>
      <button class="btn small" id="pHelp">${icon('keyboard')}Toute l'aide</button></div></div>`;
    html += `<div class="psec"><h3>Raccourcis</h3><ul class="tips">
      <li>Supprimer la sélection <kbd>Suppr</kbd></li>
      <li>Réécrire un paragraphe <kbd>Double-clic</kbd></li>
      <li>Réécrire une seule ligne <kbd>Alt+double-clic</kbd></li>
      <li>Ajouter un texte (dans le vide) <kbd>Double-clic</kbd></li>
      <li>Sélection multiple <kbd>Maj+clic</kbd></li>
      <li>Sélection par cadre <kbd>Glisser</kbd></li>
      <li>Dupliquer <kbd>Ctrl+D</kbd></li>
      <li>Copier / couper / coller <kbd>Ctrl+C</kbd> <kbd>Ctrl+X</kbd> <kbd>Ctrl+V</kbd></li>
      <li>Plus d'actions <kbd>Clic droit</kbd></li>
      <li>Déplacer une copie <kbd>Alt+glisser</kbd></li>
      <li>Déplacer finement <kbd>← ↑ → ↓</kbd></li>
      <li>Coller une image / un texte <kbd>Ctrl+V</kbd></li>
      <li>Annuler / Rétablir <kbd>Ctrl+Z</kbd> <kbd>Ctrl+Y</kbd></li>
      <li>Tout sélectionner (page) <kbd>Ctrl+A</kbd></li>
      <li>Zoom <kbd>Ctrl+molette</kbd></li>
      <li>Page suivante / précédente <kbd>PageDown</kbd> <kbd>PageUp</kbd></li>
    </ul></div>`;
  }
  panel.innerHTML = html;
  hydrateIcons(panel);
  bindPanel(panel, items);
}

function bindPanel(panel, items) {
  const P = S.props;
  const setProp = (k, v) => { P[k] = v; saveProps(); };
  panel.querySelectorAll('.swatches[data-prop]').forEach(box => {
    const prop = box.dataset.prop;
    const apply = v => {
      if (prop === 'selColor') { restyleSelected({ color: v }); return; }
      setProp(prop, v);
      box.querySelectorAll('.sw').forEach(s => s.classList.toggle('active', s.dataset.v === v));
    };
    box.addEventListener('click', e => { const s = e.target.closest('.sw'); if (s) apply(s.dataset.v); });
    const custom = box.querySelector('.sw-custom');
    custom.addEventListener('change', () => apply(custom.value));
  });
  panel.querySelectorAll('[data-prop]').forEach(inp => {
    if (inp.classList.contains('swatches')) return;
    inp.addEventListener('input', () => {
      const v = inp.type === 'range' || inp.type === 'number' ? parseFloat(inp.value) : inp.value;
      if (inp.type === 'number' && !(v > 0)) return;
      setProp(inp.dataset.prop, v);
      const out = panel.querySelector(`[data-val="${inp.dataset.prop}"]`);
      if (out) out.textContent = inp.dataset.prop === 'opacity' ? Math.round(v * 100) + '%' : v + ' pt';
    });
  });
  panel.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    setProp(b.dataset.toggle, !P[b.dataset.toggle]);
    b.classList.toggle('on', P[b.dataset.toggle]);
  }));
  const on = (id, fn) => { const el = panel.querySelector('#' + id); if (el) el.addEventListener('click', fn); };
  on('pDel', deleteSelection);
  on('pDup', duplicateSelection);
  on('pEdit', () => { const it = selEls()[0]; if (it) editText(it.page, it.el, null, true); });
  on('pEditBlock', () => { const it = selEls()[0]; if (it) editText(it.page, it.el, null, false, true); });
  on('pFind', () => openFind(true));
  on('pHelp', showHelp);
  on('pOcr', () => runOcr(S.scanPages || []));
  on('pFill', () => { const it = selEls()[0]; if (it) openField(it.page, it.el); });
  on('pFields', () => { const f = allFields()[0]; if (f) { scrollToPage(f.p); openField(f.p, f.el, true); } });
  on('pSigNew', signatureDialog);
  panel.querySelectorAll('[data-sig]').forEach(b => b.addEventListener('click', () => {
    const sg = loadSignatures().find(x => x.id === b.dataset.sig);
    if (sg) startPlacing(sg);
  }));
  panel.querySelectorAll('[data-sigdel]').forEach(b => b.addEventListener('click', () => {
    const before = loadSignatures();
    storeSignatures(before.filter(x => x.id !== b.dataset.sigdel));
    renderPanel();
    toast('Signature oubliée', 'info', 6000, { label: 'Annuler', fn: () => { storeSignatures(before); renderPanel(); } });
  }));
  const size = panel.querySelector('#selSize');
  if (size) size.addEventListener('change', () => { const v = parseFloat(size.value); if (v > 0) restyleSelected({ size: v }); });
  const font = panel.querySelector('#selFont');
  if (font) font.addEventListener('change', () => { if (font.value) restyleSelected({ font: font.value }); });
  panel.querySelectorAll('[data-geo]').forEach(inp => inp.addEventListener('change', () => {
    const it = selEls()[0];
    if (!it) return;
    const g = Object.fromEntries([...panel.querySelectorAll('[data-geo]')].map(i => [i.dataset.geo, parseFloat(i.value)]));
    if (![g.x, g.y, g.w, g.h].every(Number.isFinite)) return;
    const b = it.el.bbox;
    let w = g.w, h = g.h;
    if (it.el.type === 'text') {
      // le texte garde ses proportions
      const s = inp.dataset.geo === 'w' ? w / (b[2] - b[0]) : h / (b[3] - b[1]);
      w = (b[2] - b[0]) * s; h = (b[3] - b[1]) * s;
    }
    moveItems([elRef(it.page, it.el, { to: [g.x, g.y, g.x + w, g.y + h].map(round2) })]);
  }));
}
function restyleSelected(over) {
  const it = selEls()[0];
  if (!it || it.el.type !== 'text') return;
  runOp(Object.assign({ op: 'edit_text' }, elRef(it.page, it.el), { text: it.el.text }, over));
}

// ------------------------------------------------------------------ aide contextuelle (barre du bas)
const TOOL_HINTS = {
  select: 'Cliquez sur un élément pour le sélectionner · <b>double-clic</b> sur un texte pour le modifier · <b>double-clic dans le vide</b> pour écrire',
  text: 'Cliquez à l\'endroit où écrire, tapez, puis <b>Entrée</b>',
  image: 'Cliquez sur la page (ou tracez un cadre) puis choisissez l\'image · vous pouvez aussi <b>coller</b> une image (Ctrl+V)',
  rect: 'Glissez pour tracer · <b>Maj</b> pour un carré · un simple clic pose une forme par défaut',
  ellipse: 'Glissez pour tracer · <b>Maj</b> pour un cercle',
  line: 'Glissez du départ à l\'arrivée · <b>Maj</b> pour des angles de 45°',
  arrow: 'Glissez du départ à la pointe · <b>Maj</b> pour des angles de 45°',
  ink: 'Dessinez ou signez à main levée · les traits rapprochés forment un seul dessin',
  highlight: 'Glissez sur le texte à surligner',
  whiteout: 'Tracez un rectangle blanc pour masquer une zone (le contenu reste dessous)',
  erase: 'Tracez une zone : tout ce qu\'elle contient est <b>réellement supprimé</b> du PDF',
};
let hintLocked = false;
function hint(html, lock) {
  const h = $('#hint');
  if (!h) return;
  if (html == null) { hintLocked = false; html = TOOL_HINTS[S.tool] || ''; }
  else if (lock) hintLocked = true;
  else if (hintLocked) return;
  if (h.innerHTML !== html) h.innerHTML = html;
  h.classList.toggle('empty', !html);
}
function hintFor(p, el) {
  if (hintLocked || editor) return;
  if (p == null || S.tool !== 'select') { hint(null); return; }
  if (!el) {
    if (S.scan[p]) hint('Page scannée : c\'est une image. <b>Double-cliquez</b> ou utilisez le bandeau pour rendre son texte modifiable (OCR)');
    else hint(TOOL_HINTS.select);
    return;
  }
  if (el.type === 'text') {
    const q = blockOf(p, el);
    if (q && q.flow) hint('<b>Double-clic</b> : modifier le paragraphe (remise en forme automatique) · <b>Alt + double-clic</b> : seulement cette ligne · <b>Glisser</b> : déplacer');
    else if (q) hint('<b>Double-clic</b> : modifier la ligne · bouton « Modifier le bloc » pour tout le bloc · <b>Glisser</b> : déplacer · <b>Suppr</b> : effacer');
    else hint('<b>Double-clic</b> : modifier le texte · <b>Glisser</b> : déplacer · <b>Suppr</b> : effacer');
  } else if (fillable(el)) hint(`<b>Clic</b> : ${el.kind === 'checkbox' ? 'cocher / décocher' : el.kind === 'radio' ? 'choisir cette option' : 'remplir le champ'} · <b>Tab</b> : champ suivant · <b>Glisser</b> : déplacer le champ`);
  else if (el.type === 'image') hint('<b>Glisser</b> : déplacer · <b>poignées</b> : redimensionner (Maj = proportions) · <b>Alt+glisser</b> : copier · <b>Suppr</b> : effacer');
  else if (el.type === 'drawing') hint('<b>Glisser</b> : déplacer · <b>poignées</b> : redimensionner · <b>Suppr</b> : effacer · <b>double-clic</b> : écrire par-dessus');
  else hint('<b>Glisser</b> : déplacer · <b>Suppr</b> : supprimer');
}

// ------------------------------------------------------------------ pages scannées (OCR)
function drawScanBanner(p) {
  const d = pageEl(p);
  if (!d) return;
  let b = d.querySelector('.scanbanner');
  if (!S.scan[p]) { if (b) b.remove(); return; }
  if (b) return;
  b = document.createElement('div');
  b.className = 'scanbanner';
  b.innerHTML = S.ocrAvailable
    ? `<i data-icon="scan"></i><span><b>Page scannée</b> — son texte est une image.</span><button class="btn small primary">Rendre le texte modifiable</button>`
    : `<i data-icon="scan"></i><span><b>Page scannée</b> — la reconnaissance de texte n'est pas disponible sur ce poste.</span>`;
  hydrateIcons(b);
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('dblclick', e => e.stopPropagation());
  const btn = b.querySelector('button');
  if (btn) btn.onclick = () => runOcr(scanPagesFrom(p));
  d.appendChild(b);
}
// la page cliquée d'abord, puis les autres pages scannées connues
function scanPagesFrom(p) {
  const known = (S.scanPages || []).filter(x => x !== p && x < S.pages.length);
  return [p].concat(known);
}
async function checkScans() {
  if (!S.sid) return;
  try {
    const r = await apiJson(`/api/doc/${S.sid}/scans`);
    S.scanPages = r.pages;
    S.ocrAvailable = r.available;
    if (!r.pages.length) return;
    const n = r.pages.length, all = n === S.pages.length;
    if (!r.available) {
      toast('Ce PDF est scanné, mais la reconnaissance de texte n\'est pas disponible (installez les dépendances).', 'error', 7000);
      return;
    }
    const go = await modal({
      title: `${icon('scan')} Document scanné`,
      body: `<p>${all ? (n > 1 ? `Les ${n} pages de ce PDF sont` : 'Ce PDF est') : `${n} page${n > 1 ? 's' : ''} de ce PDF ${n > 1 ? 'sont' : 'est'}`} des <b>images scannées</b> : le texte ne peut pas être modifié tel quel.</p>
             <p>La <b>reconnaissance de texte</b> (OCR, faite sur votre ordinateur) le rend modifiable : vous pourrez ensuite double-cliquer sur une ligne pour la réécrire, la déplacer ou la supprimer, comme dans un PDF normal.</p>`,
      buttons: [{ label: 'Plus tard', value: false }, { label: `Rendre le texte modifiable`, value: true, primary: true }],
    });
    if (go) runOcr(r.pages);
  } catch (e) { /* ignore */ }
}
function offerOcr(p) {
  if (!S.ocrAvailable) { toast('La reconnaissance de texte n\'est pas disponible sur ce poste.', 'error'); return; }
  modal({
    title: `${icon('scan')} Page scannée`,
    body: '<p>Cette page est une image : pour modifier son texte, il faut d\'abord le <b>reconnaître</b> (OCR). Cela prend environ une seconde par page.</p>',
    buttons: [{ label: 'Annuler', value: false }, { label: 'Reconnaître le texte', value: true, primary: true }],
  }).then(go => { if (go) runOcr(scanPagesFrom(p)); });
}
let ocrRunning = false;
async function runOcr(pages) {
  if (ocrRunning || !pages.length) return;
  ocrRunning = true;
  if (editor) closeEditor(false);
  let cancelled = false, done = 0;
  const root = $('#modalRoot');
  const m = document.createElement('div');
  m.className = 'modal-back';
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Reconnaissance du texte"><h2>${icon('sparkle')} Reconnaissance du texte…</h2>
    <div class="modal-body"><p class="ocr-status">Préparation…</p><div class="pbar"><div></div></div></div>
    <div class="modal-actions"><button class="btn">Arrêter</button></div></div>`;
  root.appendChild(m);
  const stop = () => { cancelled = true; m.querySelector('.ocr-status').textContent = 'Arrêt après la page en cours…'; };
  m.querySelector('button').onclick = stop;
  const onEsc = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stop(); } };
  document.addEventListener('keydown', onEsc, true);
  setTimeout(() => m.querySelector('button').focus(), 30);
  const bar = m.querySelector('.pbar div');
  let stepped = false;  // une seule annulation pour tout l'OCR
  for (let i = 0; i < pages.length && !cancelled; i++) {
    m.querySelector('.ocr-status').textContent = pages.length > 1 ? `Page ${pages[i] + 1} — ${i + 1} sur ${pages.length}` : `Page ${pages[i] + 1}`;
    bar.style.width = (i / pages.length * 100) + '%';
    const res = await runOp({ op: 'ocr', pages: [pages[i]], amend: stepped });
    if (!res) break;
    if (res.changed && res.changed.length) stepped = true;
    done++;
    S.scan[pages[i]] = false;
    drawScanBanner(pages[i]);
  }
  bar.style.width = '100%';
  m.remove();
  document.removeEventListener('keydown', onEsc, true);
  ocrRunning = false;
  S.scanPages = (S.scanPages || []).filter(p => !pages.slice(0, done).includes(p));
  renderPanel();
  if (done) {
    toast(`Texte reconnu sur ${done} page${done > 1 ? 's' : ''} — double-cliquez sur une ligne pour la modifier`, 'ok', 6000, undoAction);
    scrollToPage(pages[0]);
  }
}

// ------------------------------------------------------------------ rechercher / remplacer
const F = { open: false, q: '', repl: '', case: false, whole: false, replace: false, hits: [], idx: -1, t: null, seq: 0 };
function openFind(replace) {
  if (!S.sid) return;
  if (editor) closeEditor(false);
  const box = $('#findbar');
  F.open = true;
  F.replace = F.replace || !!replace;
  // pré-remplit avec le texte sélectionné
  const sel = selEls();
  if (sel.length === 1 && sel[0].el.type === 'text' && !F.q) F.q = sel[0].el.text.slice(0, 80);
  box.hidden = false;
  box.innerHTML = `
    <div class="frow">
      <button class="icon-btn ftoggle" data-a="mode" title="Afficher le remplacement">${icon(F.replace ? 'down' : 'replace')}</button>
      <div class="finput"><i data-icon="search"></i><input id="fq" type="text" placeholder="Rechercher dans le document" value="${escapeHtml(F.q)}"><span class="fcount" id="fcount"></span></div>
      <button class="icon-btn tg ${F.case ? 'on' : ''}" data-a="case" title="Respecter la casse">Aa</button>
      <button class="icon-btn tg ${F.whole ? 'on' : ''}" data-a="whole" title="Mot entier"><u>ab</u></button>
      <button class="icon-btn" data-a="prev" title="Précédent (Maj+Entrée)">${icon('up')}</button>
      <button class="icon-btn" data-a="next" title="Suivant (Entrée)">${icon('down')}</button>
      <button class="icon-btn" data-a="close" title="Fermer (Échap)">${icon('close')}</button>
    </div>
    <div class="frow" ${F.replace ? '' : 'hidden'}>
      <span class="fspacer"></span>
      <div class="finput"><i data-icon="replace"></i><input id="fr" type="text" placeholder="Remplacer par" value="${escapeHtml(F.repl)}"></div>
      <button class="btn small" data-a="one" title="Remplacer dans la ligne courante">Remplacer</button>
      <button class="btn small primary" data-a="all" title="Remplacer partout">Tout remplacer</button>
    </div>
    <p class="fnote" ${F.replace ? '' : 'hidden'}>Le style de chaque mot (police, gras, couleur) est conservé.</p>`;
  hydrateIcons(box);
  const q = $('#fq'), r = $('#fr');
  q.addEventListener('input', () => { F.q = q.value; F.idx = -1; scheduleSearch(120); });
  r.addEventListener('input', () => { F.repl = r.value; });
  const keys = e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.target === r) { if (e.ctrlKey || e.metaKey) replaceAll(); else replaceOne(); }
      else gotoHit(F.idx + (e.shiftKey ? -1 : 1));
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); F.replace = true; openFind(true); }
  };
  q.addEventListener('keydown', keys);
  r.addEventListener('keydown', keys);
  box.onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') closeFind();
    else if (a === 'prev') gotoHit(F.idx - 1);
    else if (a === 'next') gotoHit(F.idx + 1);
    else if (a === 'case' || a === 'whole') { F[a] = !F[a]; b.classList.toggle('on', F[a]); F.idx = -1; runSearch(); }
    else if (a === 'mode') { F.replace = !F.replace; openFind(); }
    else if (a === 'one') replaceOne();
    else if (a === 'all') replaceAll();
  };
  if (F.replace && replace) r.focus(); else { q.focus(); q.select(); }
  runSearch();
}
function closeFind() {
  F.open = false;
  F.hits = [];
  const box = $('#findbar');
  if (box) { box.hidden = true; box.innerHTML = ''; }
  $$('.hit').forEach(n => n.remove());
}
function scheduleSearch(ms = 250) { clearTimeout(F.t); F.t = setTimeout(runSearch, ms); }
async function runSearch() {
  if (!F.open || !S.sid) return;
  const seq = ++F.seq;
  if (!F.q.trim()) { F.hits = []; drawHits(); updateFindCount(); return; }
  try {
    const r = await apiJson(`/api/doc/${S.sid}/search?q=${encodeURIComponent(F.q)}&case=${F.case ? 1 : 0}&whole=${F.whole ? 1 : 0}`);
    if (seq !== F.seq) return;
    F.hits = [];
    for (const m of r.matches) for (const rc of m.rects) F.hits.push({ page: m.page, id: m.id, bbox: m.bbox, text: m.text, rect: rc });
    if (F.idx >= F.hits.length) F.idx = F.hits.length - 1;
    if (F.idx < 0 && F.hits.length) {
      // premier résultat à partir de la page courante
      const i = F.hits.findIndex(h => h.page >= S.current);
      gotoHit(i < 0 ? 0 : i, true);
    } else drawHits();
    updateFindCount();
  } catch (e) { /* ignore */ }
}
function updateFindCount() {
  const c = $('#fcount');
  if (!c) return;
  const n = F.hits.length;
  c.textContent = !F.q.trim() ? '' : n ? `${F.idx + 1} / ${n}` : 'Aucun résultat';
  c.classList.toggle('none', !!F.q.trim() && !n);
}
// seulement sur les pages visibles (des milliers de résultats sinon)
function drawHits() {
  $$('.hit').forEach(n => n.remove());
  if (!F.open) return;
  F.hits.forEach((h, i) => {
    if (!S.visible.has(h.page) && i !== F.idx) return;
    const ov = overlayEl(h.page);
    if (!ov) return;
    const d = document.createElement('div');
    d.className = 'hit' + (i === F.idx ? ' cur' : '');
    d.style.cssText = boxStyle(h.rect);
    ov.appendChild(d);
  });
}
function gotoHit(i, quiet) {
  const n = F.hits.length;
  if (!n) return;
  F.idx = ((i % n) + n) % n;
  const h = F.hits[F.idx];
  drawHits();
  updateFindCount();
  const d = pageEl(h.page);
  if (!d) return;
  const y = d.offsetTop + h.rect[1] * S.zoom;
  const x = d.offsetLeft + h.rect[0] * S.zoom;
  if (y < viewer.scrollTop + 90 || y > viewer.scrollTop + viewer.clientHeight - 60 || !quiet)
    viewer.scrollTo({ top: y - viewer.clientHeight / 3, left: Math.max(0, x - viewer.clientWidth / 2), behavior: quiet ? 'auto' : 'smooth' });
  setCurrentPage(h.page);
}
// Bilan honnête : ce qui a vraiment été remplacé, et ce qui a été laissé de côté
function replaceReport(r, one) {
  if (!r) return;
  const n = r.count || 0, skipped = r.skipped || 0;
  const skip = skipped ? ` · ${skipped} laissé${skipped > 1 ? 's' : ''} tel${skipped > 1 ? 's' : ''} quel${skipped > 1 ? 's' : ''} (écriture de droite à gauche)` : '';
  if (!n) { toast(skipped ? 'Aucun remplacement' + skip : 'Aucun remplacement : le texte a peut-être déjà changé.', 'info', 4500); return; }
  const msg = one && n > 1 ? `${n} remplacements dans la ligne` : `${n} remplacement${n > 1 ? 's' : ''} effectué${n > 1 ? 's' : ''}`;
  toast(msg + skip, 'ok', skipped ? 6000 : 4000, undoAction);
}
function replaceOne() {
  if (!F.hits.length) return;
  const h = F.hits[Math.max(F.idx, 0)];
  runOp({ op: 'replace', query: F.q, replacement: F.repl, case: F.case, whole: F.whole, targets: [{ page: h.page, id: h.id }] })
    .then(r => replaceReport(r, true));
}
function replaceAll() {
  if (!F.hits.length) return;
  const many = F.hits.length > 200 || new Set(F.hits.map(h => h.page)).size > 20;
  const wait = many ? toast(`Remplacement de ${F.hits.length} occurrences…`, 'info', 120000) : null;
  runOp({ op: 'replace', query: F.q, replacement: F.repl, case: F.case, whole: F.whole })
    .then(r => { dismissToast(wait); replaceReport(r, false); });
}

// ------------------------------------------------------------------ aide
function showHelp() {
  const g = (title, rows) => `<div class="hgroup"><h3>${title}</h3><ul class="tips">${rows.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('')}</ul></div>`;
  modal({
    title: `${icon('keyboard')} Aide et raccourcis`, wide: true,
    body: `<div class="hgrid">
      ${g('Modifier du texte', [
        ['Réécrire un paragraphe', '<kbd>Double-clic</kbd>'],
        ['Réécrire une seule ligne', '<kbd>Alt</kbd>+<kbd>Double-clic</kbd>'],
        ['Valider / annuler', '<kbd>Entrée</kbd> <kbd>Échap</kbd>'],
        ['Nouvelle ligne', '<kbd>Maj</kbd>+<kbd>Entrée</kbd>'],
        ['Gras / italique', '<kbd>Ctrl+B</kbd> <kbd>Ctrl+I</kbd>'],
        ['Ajouter un texte', '<kbd>Double-clic</kbd> dans le vide'],
        ['Rechercher / remplacer', '<kbd>Ctrl+F</kbd> <kbd>Ctrl+H</kbd>'],
      ])}
      ${g('Éléments', [
        ['Supprimer', '<kbd>Suppr</kbd>'],
        ['Sélection multiple', '<kbd>Maj</kbd>+clic ou cadre'],
        ['Tout sélectionner (page)', '<kbd>Ctrl+A</kbd>'],
        ['Dupliquer', '<kbd>Ctrl+D</kbd> ou <kbd>Alt</kbd>+glisser'],
        ['Copier / couper / coller', '<kbd>Ctrl+C</kbd> <kbd>Ctrl+X</kbd> <kbd>Ctrl+V</kbd>'],
        ['Déplacer finement', '<kbd>←↑→↓</kbd> (<kbd>Maj</kbd> ×10)'],
        ['Glisser sans aimantation', '<kbd>Ctrl</kbd>+glisser'],
        ['Coller une image', '<kbd>Ctrl+V</kbd>'],
        ['Toutes les actions', '<kbd>Clic droit</kbd>'],
      ])}
      ${g('Outils', TOOLS.filter(t => !t.sep).map(t => [t.label, `<kbd>${t.key.toUpperCase()}</kbd>`]))}
      ${g('Document', [
        ['Annuler / rétablir', '<kbd>Ctrl+Z</kbd> <kbd>Ctrl+Y</kbd>'],
        ['Enregistrer', '<kbd>Ctrl+S</kbd>'],
        ['Exporter (pages, taille)', '<kbd>Ctrl+Maj+S</kbd>'],
        ['Ouvrir', '<kbd>Ctrl+O</kbd>'],
        ['Page suivante / précédente', '<kbd>PageDown</kbd> <kbd>PageUp</kbd>'],
        ['Zoom', '<kbd>Ctrl</kbd>+molette, <kbd>Ctrl +</kbd> <kbd>Ctrl −</kbd>'],
        ['Largeur / page entière', '<kbd>Ctrl+0</kbd> <kbd>Ctrl+9</kbd>'],
        ['Plusieurs pages', '<kbd>Ctrl</kbd>/<kbd>Maj</kbd>+clic sur les miniatures'],
        ['Cette aide', '<kbd>?</kbd>'],
      ])}
    </div>
    <p class="help-foot">PDF scanné ? Ouvrez-le : l'application propose de <b>reconnaître le texte</b> (OCR, en local) pour le rendre modifiable.
      Formulaire ? <b>Cliquez dans un champ</b> et tapez, <b>Tab</b> passe au suivant. Signature : outil Dessin (<kbd>D</kbd>) → « Créer une signature ».</p>`,
    buttons: [{ label: 'Fermer', value: true, primary: true }],
  });
}

// ------------------------------------------------------------------ clavier
// Déplacement fin au clavier : les éléments visés sont ceux sélectionnés à la
// première flèche ; l'envoi part après une courte pause (ou dès que la
// sélection change).
let nudge = null;
function flushNudge() {
  if (!nudge) return;
  clearTimeout(nudge.t);
  const { dx, dy, items } = nudge;
  nudge = null;
  clearGhosts();
  if (!dx && !dy) return;
  moveItems(items.map(({ page, el }) => {
    const b = el.bbox;
    return elRef(page, el, { to: [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy] });
  }));
}
// Enregistrer / rechercher marchent aussi pendant la saisie (texte, champ, recherche) :
// écouteur en phase de capture, avant les zones de saisie qui arrêtent les touches.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || !S.sid) return;
  const kl = e.key.toLowerCase();
  if (kl !== 's' && kl !== 'f' && kl !== 'h') return;
  e.preventDefault();
  if ($('#modalRoot').children.length) return;
  e.stopPropagation();
  if (kl === 's') {
    if (fieldEd) closeFieldEditor(false);
    if (e.shiftKey) exportDialog(); else download();
  } else if (!e.target.closest || !e.target.closest('#findbar')) openFind(kl === 'h');
  else if (kl === 'h' && !F.replace) { F.replace = true; openFind(true); }
  else { const q = $('#fq'); if (q) { q.focus(); q.select(); } }
}, true);

document.addEventListener('keydown', e => {
  if (!S.sid) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#fileOpen').click(); }
    return;
  }
  if ($('#modalRoot').children.length) return;
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  if (!$('#ctxmenu').hidden) { if (k === 'Escape') { e.preventDefault(); hideMenu(); } return; }
  if (isTyping()) return;
  if (k === 'Tab' && !ctrl && !e.altKey) {
    const sel = selEls();
    // formulaire : Tab passe au champ suivant (jamais aux boutons de la barre)
    if (sel.length === 1 && fillable(sel[0].el)) { e.preventDefault(); nextField(e.shiftKey ? -1 : 1, sel[0]); return; }
    // sinon, depuis la page : parcourt les éléments de la page courante
    const ae0 = document.activeElement;
    if (!ae0 || ae0 === document.body || sel.length) { e.preventDefault(); cycleElement(e.shiftKey ? -1 : 1); return; }
  }
  // menu de l'élément au clavier : Maj+F10 ou touche Menu
  if ((k === 'F10' && e.shiftKey) || k === 'ContextMenu') {
    const it = selEls()[0];
    if (it) {
      e.preventDefault();
      const r = pageEl(it.page).getBoundingClientRect(), b = it.el.bbox;
      const pt = { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
      pageMenu(it.page, pt, r.left + pt.x * S.zoom, r.top + pt.y * S.zoom);
      return;
    }
  }
  if (k === ' ' && S.sel.length === 1) {
    const it = selEls()[0];
    if (it && fillable(it.el) && (it.el.kind === 'checkbox' || it.el.kind === 'radio')) { e.preventDefault(); openField(it.page, it.el); return; }
  }
  // Entrée / Espace sur un bouton : c'est le bouton qui agit
  const ae = document.activeElement;
  if ((k === 'Enter' || k === ' ') && ae && ae !== document.body && ae.closest('button, a, select, [role="option"], [role="menuitem"]')) return;
  if (S.placing && k === 'Escape') { e.preventDefault(); stopPlacing(); return; }
  if (k === '?' || k === 'F1') { e.preventDefault(); showHelp(); return; }
  if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); gotoPage(S.current + (k === 'PageDown' ? 1 : -1)); return; }
  if ((k === 'Home' || k === 'End') && !S.sel.length) { e.preventDefault(); gotoPage(k === 'Home' ? 0 : S.pages.length - 1); return; }
  if (ctrl) {
    const kl = k.toLowerCase();
    if (kl === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (kl === 'y' || (kl === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (kl === 'd') { e.preventDefault(); duplicateSelection(); }
    else if (kl === 'o') { e.preventDefault(); $('#fileOpen').click(); }
    else if (kl === 'a') {
      e.preventDefault();
      setTool('select');
      const p = S.current;
      setSelection((S.els[p] || []).filter(el => !isBig(p, el)).map(el => ({ page: p, id: el.id })));
    } else if (k === '+' || k === '=') { e.preventDefault(); setZoom(S.zoom * 1.2); }
    else if (k === '-') { e.preventDefault(); setZoom(S.zoom / 1.2); }
    // e.code : marche aussi en AZERTY (la touche 0 y donne « à », la 9 « ç »)
    else if (k === '0' || e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); fitWidth(); }
    else if (k === '9' || e.code === 'Digit9' || e.code === 'Numpad9') { e.preventDefault(); fitPage(); }
    return;
  }
  if (k === 'Delete' || k === 'Backspace') { if (S.sel.length) { e.preventDefault(); deleteSelection(); } return; }
  if (k === 'Escape') {
    if (F.open && !S.sel.length) { closeFind(); return; }
    if (pendingInk) commitInk();
    if (drag) { drag = null; clearGhosts(); return; }
    if (S.clip && S.clip.cut) { S.clip = null; drawSelection(); toast('Couper annulé', 'info', 1800); return; }
    if (S.sel.length) setSelection([]); else setTool('select');
    return;
  }
  if (k === 'Enter' && S.sel.length >= 1) {
    const it = selEls()[0];
    if (it && it.el.type === 'text') { e.preventDefault(); editText(it.page, it.el, null, false, S.sel.length > 1); }
    else if (it && fillable(it.el)) { e.preventDefault(); openField(it.page, it.el); }
    return;
  }
  if (k.startsWith('Arrow') && S.sel.length) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    if (!nudge) nudge = { dx: 0, dy: 0, items: selEls() };
    if (k === 'ArrowLeft') nudge.dx -= step;
    if (k === 'ArrowRight') nudge.dx += step;
    if (k === 'ArrowUp') nudge.dy -= step;
    if (k === 'ArrowDown') nudge.dy += step;
    clearGhosts();
    for (const { page, el } of nudge.items) {
      const b = el.bbox;
      showGhost(page, b, [b[0] + nudge.dx, b[1] + nudge.dy, b[2] + nudge.dx, b[3] + nudge.dy]);
    }
    clearTimeout(nudge.t);
    nudge.t = setTimeout(flushNudge, 450);
    return;
  }
  const tool = TOOLS.find(t => t.key === k.toLowerCase());
  if (tool && !e.altKey) setTool(tool.id);
});

// ------------------------------------------------------------------ copier / couper / coller
// Presse-papiers interne pour les éléments du PDF ; le texte copié part aussi
// dans le presse-papiers du système (pour le coller ailleurs).
const CLIP_TYPE = 'application/x-pdfchanger';
function copySelection(cut, cd) {
  const items = selEls().filter(i => ['text', 'image', 'drawing', 'annot'].includes(i.el.type));
  if (!items.length) return false;
  const text = items.filter(i => i.el.type === 'text').map(i => i.el.text).join('\n');
  S.clip = { sid: S.sid, id: Math.random().toString(36).slice(2), cut: !!cut, text, n: 0,
    items: items.map(i => elRef(i.page, i.el)) };
  if (cd) { cd.setData('text/plain', text); cd.setData(CLIP_TYPE, S.clip.id); }
  else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  const n = items.length, what = n > 1 ? `${n} éléments` : 'Élément';
  if (cut) { drawSelection(); toast(`${what} coupé${n > 1 ? 's' : ''} : collez-le${n > 1 ? 's' : ''} (Ctrl+V) à l'endroit voulu`, 'info', 4000); }
  else toast(`${what} copié${n > 1 ? 's' : ''}`, 'ok', 1600);
  return true;
}
// Colle les éléments copiés sur la page p (décalés, ou à la position `at`)
function pasteElements(p, at) {
  const c = S.clip;
  if (!c || c.sid !== S.sid) return false;
  const pg = S.pages[p];
  const box = [Math.min(...c.items.map(i => i.bbox[0])), Math.min(...c.items.map(i => i.bbox[1])),
    Math.max(...c.items.map(i => i.bbox[2])), Math.max(...c.items.map(i => i.bbox[3]))];
  let dx = 0, dy = 0;
  if (at) { dx = at.x - box[0]; dy = at.y - box[1]; }
  else if (!c.cut && c.items.every(i => i.page === p)) { c.n += 1; dx = dy = 14 * c.n; }
  // reste dans la page
  dx = clamp(dx, -box[0], Math.max(-box[0], pg.w - box[2]));
  dy = clamp(dy, -box[1], Math.max(-box[1], pg.h - box[3]));
  const items = c.items.filter(i => i.type !== 'annot' || i.page === p).map(i => Object.assign({}, i, {
    dest: p, to: [i.bbox[0] + dx, i.bbox[1] + dy, i.bbox[2] + dx, i.bbox[3] + dy].map(round2),
  }));
  if (items.length < c.items.length) toast('Les annotations ne se collent que sur leur propre page.', 'info', 4000);
  if (!items.length) return true;
  const cut = c.cut;
  runOp({ op: 'move', copy: !cut, items }).then(r => {
    if (!r) return;
    if (!r.changed || !r.changed.length) {
      toast(cut ? "L'élément coupé a changé depuis : coupez-le à nouveau." : "L'élément copié a été modifié ou supprimé depuis : copiez-le à nouveau.", 'error', 5000);
      if (S.clip === c) S.clip = null;
      return;
    }
    if (cut && S.clip === c) S.clip = null;  // couper-coller : une seule fois
    if (r.select && r.select.length) { S.selQuiet = false; drawSelection(); }
  });
  return true;
}
document.addEventListener('copy', e => {
  if (!S.sid || isTyping() || $('#modalRoot').children.length) return;
  if (copySelection(false, e.clipboardData)) e.preventDefault();
});
document.addEventListener('cut', e => {
  if (!S.sid || isTyping() || $('#modalRoot').children.length) return;
  if (copySelection(true, e.clipboardData)) e.preventDefault();
});
document.addEventListener('paste', async e => {
  if (!S.sid || isTyping() || $('#modalRoot').children.length) return;
  const cd = e.clipboardData || { items: [], getData: () => '' };
  const items = [...(cd.items || [])];
  const img = items.find(i => i.type.startsWith('image/'));
  const text = cd.getData('text/plain');
  const p = S.current;
  // nos propres éléments, s'ils sont toujours ce qui a été copié en dernier
  if (S.clip && S.clip.sid === S.sid && !img && (cd.getData(CLIP_TYPE) === S.clip.id || text === S.clip.text)) {
    e.preventDefault();
    pasteElements(p);
    return;
  }
  if (img) {
    e.preventDefault();
    const data = await readFileAsDataURL(img.getAsFile());
    addImageData(data, p);
    return;
  }
  if (text && text.trim()) {
    e.preventDefault();
    const pg = S.pages[p];
    const P = S.props;
    runOp({ op: 'add_text', page: p, x: round2(pg.w * 0.15), y: round2(pg.h * 0.4), text: text.replace(/\r/g, ''), size: P.size, color: P.color, font: P.font, bold: P.bold, italic: P.italic });
  }
});
async function pasteFromMenu(p, at) {
  if (pasteElements(p, at)) return;
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find(t => t.startsWith('image/'));
      if (type) { const blob = await it.getType(type); addImageData(await readFileAsDataURL(blob), p, at); return; }
    }
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) {
      const P = S.props;
      runOp({ op: 'add_text', page: p, x: round2(at.x), y: round2(at.y), text: text.replace(/\r/g, ''), size: P.size, color: P.color, font: P.font, bold: P.bold, italic: P.italic });
      return;
    }
    toast('Le presse-papiers est vide.', 'info');
  } catch (err) { toast('Utilisez Ctrl+V pour coller depuis une autre application.', 'info', 4000); }
}

// ------------------------------------------------------------------ glisser-déposer de fichiers
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  if (!e.dataTransfer.types.includes('Files')) return;
  dragDepth++;
  document.body.classList.add('dragging-file');
  $('#dropCard').classList.add('drag');
});
window.addEventListener('dragleave', e => {
  if (!e.dataTransfer.types.includes('Files')) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) { document.body.classList.remove('dragging-file'); $('#dropCard').classList.remove('drag'); }
});
window.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => {
  if (!e.dataTransfer.files.length) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging-file');
  $('#dropCard').classList.remove('drag');
  const files = [...e.dataTransfer.files];
  if (!S.sid) { openFile(files[0]); return; }
  const pe = e.target.closest && e.target.closest('.page');
  for (const f of files) {
    if (f.type.startsWith('image/') && pe) {
      const p = +pe.dataset.p;
      const pt = ptFromEvent(e, p);
      addImageFile(f, p, { x: pt.x, y: pt.y });
    } else {
      mergeFile(f, pe ? +pe.dataset.p + 1 : S.pages.length);
    }
  }
});

// ------------------------------------------------------------------ menu contextuel
// items : [{ label, icon, kbd, fn, danger, disabled, check } | { sep: true }]
function showMenu(x, y, items, owner) {
  const m = $('#ctxmenu');
  m.dataset.owner = owner || '';
  $('#zoomVal').setAttribute('aria-expanded', owner === 'zoom');
  m.innerHTML = items.map((it, i) => it.sep ? '<div class="msep" role="separator"></div>' :
    `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>` +
    `<span class="mi">${it.check ? icon('check') : it.icon ? icon(it.icon) : ''}</span><span class="ml">${escapeHtml(it.label)}</span>` +
    `${it.kbd ? `<kbd>${it.kbd}</kbd>` : ''}</button>`).join('');
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  m.onclick = e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    hideMenu();
    items[+b.dataset.i].fn();
  };
  m.onkeydown = e => {
    const bs = $$('button:not([disabled])', m);
    const i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); hideMenu(); }
  };
  const first = m.querySelector('button:not([disabled])');
  if (first) first.focus({ preventScroll: true });
}
function hideMenu() {
  const m = $('#ctxmenu');
  if (m.hidden) return;
  m.hidden = true;
  m.innerHTML = '';
  $('#zoomVal').setAttribute('aria-expanded', 'false');
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('#ctxmenu') && !e.target.closest('#zoomVal')) hideMenu(); }, true);
viewer.addEventListener('scroll', hideMenu, { passive: true });
window.addEventListener('blur', hideMenu);

// Au clavier (Maj+F10, touche Menu), le menu s'ouvre sur la sélection
document.addEventListener('contextmenu', e => {
  if (!S.sid || e.target.closest('.page') || e.target.closest('.thumb') || isTyping()) return;
  const it = selEls()[0];
  if (!it) return;
  e.preventDefault();
  const r = pageEl(it.page).getBoundingClientRect(), b = it.el.bbox;
  const pt = { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
  pageMenu(it.page, pt, r.left + pt.x * S.zoom, r.top + pt.y * S.zoom);
});
pagesEl.addEventListener('contextmenu', e => {
  const pe = e.target.closest('.page');
  if (!pe || !S.sid || e.target.closest('.editor-wrap') || e.target.closest('.fieldeditor')) return;
  e.preventDefault();
  const p = +pe.dataset.p;
  pageMenu(p, ptFromEvent(e, p), e.clientX, e.clientY);
});
// Tab / Maj+Tab : élément suivant / précédent de la page courante (ordre de lecture)
function cycleElement(dir) {
  const p = S.sel.length ? S.sel[0].page : S.current;
  const els = (S.els[p] || []).filter(el => !isBig(p, el)).sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
  if (!els.length) return;
  const cur = S.sel.length ? els.findIndex(el => el.id === S.sel[0].id) : -1;
  const el = els[(cur + dir + els.length) % els.length] || els[0];
  setSelection([{ page: p, id: el.id }]);
  const d = pageEl(p);
  const y = d.offsetTop + el.bbox[1] * S.zoom;
  if (y < viewer.scrollTop + 80 || y > viewer.scrollTop + viewer.clientHeight - 80) viewer.scrollTo({ top: y - viewer.clientHeight / 3 });
  hint(`${escapeHtml(elLabel(p, el))} · <b>Entrée</b> modifier · <b>Suppr</b> effacer · <b>flèches</b> déplacer · <b>Maj+F10</b> menu`, false);
}
function pageMenu(p, pt, clientX, clientY) {
  flushPending();
  setCurrentPage(p);
  if (S.tool !== 'select') setTool('select');
  const el = hitTest(p, pt.x, pt.y);
  const target = el && (!isBig(p, el) || isSelected(p, el)) ? el : null;
  if (target && !isSelected(p, target)) setSelection([{ page: p, id: target.id }]);
  const canPaste = S.clip && S.clip.sid === S.sid;
  const items = [];
  if (target) {
    const sel = selEls();
    const single = sel.length === 1 ? sel[0].el : null;
    if (single && single.type === 'text') {
      const q = blockOf(p, single);
      if (q) items.push({ label: `Modifier le ${q.flow ? 'paragraphe' : 'bloc'}`, icon: 'paragraph', kbd: 'Double-clic', fn: () => editText(p, single, null, false, true) });
      items.push({ label: q ? 'Modifier cette ligne seule' : 'Modifier le texte', icon: 'edit', kbd: q ? 'Alt+double-clic' : 'Double-clic', fn: () => editText(p, single, null, true) });
    }
    if (single && fillable(single)) items.push({ label: 'Remplir le champ', icon: 'edit', kbd: 'Entrée', fn: () => openField(p, single) });
    if (items.length) items.push({ sep: true });
    const copyable = sel.some(i => ['text', 'image', 'drawing', 'annot'].includes(i.el.type));
    items.push({ label: 'Copier', icon: 'copy', kbd: 'Ctrl+C', disabled: !copyable, fn: () => copySelection(false) });
    items.push({ label: 'Couper', icon: 'replace', kbd: 'Ctrl+X', disabled: !copyable, fn: () => copySelection(true) });
    items.push({ label: 'Dupliquer', icon: 'copy', kbd: 'Ctrl+D', disabled: !sel.some(i => ['text', 'image', 'drawing'].includes(i.el.type)), fn: duplicateSelection });
    if (canPaste) items.push({ label: 'Coller ici', icon: 'filePlus', kbd: 'Ctrl+V', fn: () => pasteFromMenu(p, pt) });
    items.push({ sep: true });
    items.push({ label: sel.length > 1 ? `Supprimer (${sel.length})` : 'Supprimer', icon: 'trash', kbd: 'Suppr', danger: true, fn: deleteSelection });
  } else {
    setSelection([]);
    items.push({ label: 'Coller ici', icon: 'filePlus', kbd: 'Ctrl+V', fn: () => pasteFromMenu(p, pt) });
    items.push({ sep: true });
    items.push({ label: 'Écrire un texte ici', icon: 'text', kbd: 'Double-clic', fn: () => openNewText(p, pt) });
    items.push({ label: 'Insérer une image ici…', icon: 'image', fn: () => pickImage(f => addImageFile(f, p, { x: pt.x, y: pt.y })) });
    const sigs = loadSignatures();
    if (sigs.length) items.push({ label: 'Signer ici', icon: 'ink', fn: () => placeSignatureAt(sigs[0], p, pt) });
    else items.push({ label: 'Créer une signature…', icon: 'ink', fn: () => signatureDialog() });
    if (S.scan[p] && S.ocrAvailable) items.push({ label: 'Rendre le texte modifiable (OCR)', icon: 'sparkle', fn: () => offerOcr(p) });
    items.push({ sep: true });
    items.push({ label: 'Tout sélectionner sur la page', icon: 'select', kbd: 'Ctrl+A', fn: () => setSelection((S.els[p] || []).filter(x => !isBig(p, x)).map(x => ({ page: p, id: x.id }))) });
  }
  showMenu(clientX, clientY, items);
}

$('#thumbs').addEventListener('contextmenu', e => {
  const t = e.target.closest('.thumb');
  if (!t) return;
  e.preventDefault();
  const p = +t.dataset.p;
  if (!S.pageSel.has(p)) { S.pageSel = new Set(); setCurrentPage(p, true); syncThumbState(); }
  const pages = S.pageSel.size > 1 ? pickedPages() : [p];
  const lbl = pages.length > 1 ? ` (${pages.length} pages)` : '';
  const tr = t.getBoundingClientRect();
  const x = e.clientX || tr.left + tr.width / 2, y = e.clientY || tr.top + tr.height / 2;  // au clavier
  showMenu(x, y, [
    { label: 'Pivoter à droite' + lbl, icon: 'rotate', fn: () => pageAction('rotate', pages) },
    { label: 'Pivoter à gauche' + lbl, icon: 'undo', fn: () => pageAction('rotateLeft', pages) },
    { label: 'Dupliquer' + lbl, icon: 'copy', fn: () => pageAction('duplicate', pages) },
    { label: 'Insérer une page blanche après', icon: 'plus', fn: () => pageAction('blank', pages) },
    { label: 'Insérer un PDF / une image après…', icon: 'filePlus', fn: () => { $('#fileMerge').dataset.at = pages[pages.length - 1] + 1; $('#fileMerge').click(); } },
    { sep: true },
    { label: 'Extraire dans un nouveau PDF' + lbl, icon: 'download', fn: () => pageAction('extract', pages) },
    { sep: true },
    { label: 'Supprimer' + lbl, icon: 'trash', kbd: 'Suppr', danger: true, disabled: pages.length >= S.pages.length, fn: () => pageAction('delete', pages) },
  ]);
});

// ------------------------------------------------------------------ formulaires
const fillable = el => el && el.type === 'widget' && ['text', 'checkbox', 'radio', 'combo', 'list'].includes(el.kind) && !el.readonly;
// léger fond bleuté sur les champs à remplir (comme dans les lecteurs PDF)
function drawFields(p) {
  const ov = overlayEl(p);
  if (!ov) return;
  ov.querySelectorAll('.fieldbox').forEach(n => n.remove());
  for (const el of S.els[p] || []) {
    if (!fillable(el)) continue;
    const d = document.createElement('div');
    d.className = 'fieldbox ' + el.kind;
    d.style.cssText = boxStyle(el.bbox);
    ov.appendChild(d);
  }
}
let fieldEd = null;
function allFields() {
  const out = [];
  for (let p = 0; p < S.pages.length; p++) {
    for (const el of (S.els[p] || []).filter(fillable).sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])) out.push({ p, el });
  }
  return out;
}
function openField(p, el, focusNext) {
  closeFieldEditor(false);
  if (!fillable(el)) {
    if (el && el.readonly) toast('Ce champ est en lecture seule.', 'info');
    return;
  }
  setSelection([]);
  if (el.kind === 'checkbox') { runOp({ op: 'fill_field', page: p, xref: el.xref, value: !el.value }); return; }
  if (el.kind === 'radio') { if (!el.value) runOp({ op: 'fill_field', page: p, xref: el.xref, value: true }); return; }
  const ov = overlayEl(p);
  const wrap = document.createElement('div');
  wrap.className = 'fieldeditor';
  let input;
  if (el.kind === 'combo' || el.kind === 'list') {
    input = document.createElement('select');
    const choices = (el.choices || []).map(c => (Array.isArray(c) ? c : [c, c]));  // [valeur, libellé]
    input.innerHTML = (!choices.some(c => c[0] === el.value) ? `<option value="${escapeHtml(el.value || '')}">${escapeHtml(el.value || '—')}</option>` : '') +
      choices.map(c => `<option value="${escapeHtml(c[0])}" ${c[0] === el.value ? 'selected' : ''}>${escapeHtml(c[1])}</option>`).join('');
    input.addEventListener('change', () => closeFieldEditor(false));
  } else {
    input = document.createElement(el.multiline ? 'textarea' : 'input');
    if (!el.multiline) input.type = 'text';
    input.value = el.value || '';
    if (el.maxlen) input.maxLength = el.maxlen;
    input.spellcheck = true;
  }
  input.setAttribute('aria-label', el.tooltip || el.label || 'Champ');
  wrap.appendChild(input);
  const tip = document.createElement('div');
  tip.className = 'fieldtip';
  tip.innerHTML = `${escapeHtml(el.tooltip || el.label || 'Champ')} · <b>Entrée</b> valider · <b>Tab</b> champ suivant · <b>Échap</b> annuler`;
  wrap.appendChild(tip);
  ov.appendChild(wrap);
  fieldEd = { p, el, wrap, input, start: input.value };
  positionFieldEditor();
  ['pointerdown', 'dblclick', 'contextmenu'].forEach(t => wrap.addEventListener(t, ev => ev.stopPropagation()));
  input.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); closeFieldEditor(true); }
    else if (ev.key === 'Enter' && !(el.multiline && ev.shiftKey) && input.tagName !== 'SELECT') { ev.preventDefault(); closeFieldEditor(false); }
    else if (ev.key === 'Tab') { ev.preventDefault(); nextField(ev.shiftKey ? -1 : 1); }
  });
  input.addEventListener('blur', () => setTimeout(() => { if (fieldEd && fieldEd.input === input && document.activeElement !== input) closeFieldEditor(false); }, 0));
  input.focus({ preventScroll: !focusNext });
  if (input.select && input.tagName === 'INPUT') input.select();
  hint('<b>Entrée</b> valider · <b>Tab</b> / <b>Maj+Tab</b> champ suivant / précédent · <b>Échap</b> annuler', true);
}
function positionFieldEditor() {
  if (!fieldEd) return;
  const { el, wrap, input } = fieldEd, z = S.zoom;
  const [x0, y0, x1, y1] = el.bbox;
  wrap.style.left = x0 * z + 'px';
  wrap.style.top = y0 * z + 'px';
  input.style.width = Math.max((x1 - x0) * z, 60) + 'px';
  input.style.height = Math.max((y1 - y0) * z, 22) + 'px';
  input.style.fontSize = clamp((y1 - y0) * z * (el.multiline ? 0.3 : 0.62), 11, 22) + 'px';
}
function closeFieldEditor(cancel) {
  if (!fieldEd) return;
  const F0 = fieldEd;
  fieldEd = null;
  const value = F0.input.value;
  F0.wrap.remove();
  hint(null);
  if (!cancel && value !== F0.start) runOp({ op: 'fill_field', page: F0.p, xref: F0.el.xref, value });
}
// from : champ sélectionné (case à cocher…) d'où l'on repart, à défaut du champ en saisie
function nextField(dir, from) {
  const cur = fieldEd || (from ? { p: from.page, el: from.el } : null);
  const list = allFields();
  closeFieldEditor(false);
  if (!list.length) return;
  let i = cur ? list.findIndex(f => f.p === cur.p && f.el.xref === cur.el.xref) : -1;
  i = (i + dir + list.length) % list.length;
  const { p, el } = list[i];
  if (!S.visible.has(p)) scrollToPage(p, false);
  setCurrentPage(p);
  // la page vient d'être modifiée : on attend ses éléments à jour
  let tries = 0;
  const go = () => {
    const fresh = (S.els[p] || []).find(x => x.type === 'widget' && x.xref === el.xref);
    if (!fresh) { if (++tries < 40) setTimeout(go, 80); return; }
    if (fresh.kind === 'text' || fresh.kind === 'combo' || fresh.kind === 'list') openField(p, fresh, true);
    else { setSelection([{ page: p, id: fresh.id }]); hint('<b>Entrée</b> ou <b>Espace</b> : cocher · <b>Tab</b> : champ suivant · <b>Maj+Tab</b> : précédent', true); }
  };
  queue.then(go);
}

// ------------------------------------------------------------------ signatures
// Gardées dans ce navigateur : traits normalisés dans une boîte 0..1 et rapport largeur/hauteur.
const SIG_KEY = 'pdfchanger.signatures';
function loadSignatures() {
  try { return JSON.parse(localStorage.getItem(SIG_KEY) || '[]'); } catch (e) { return []; }
}
function storeSignatures(list) {
  try { localStorage.setItem(SIG_KEY, JSON.stringify(list.slice(0, 8))); return true; } catch (e) { toast('Impossible de garder la signature dans ce navigateur.', 'error'); return false; }
}
// strokeWidth : épaisseur du trait, dans la même unité que les points des traits
function saveSignature(strokes, color, strokeWidth) {
  const pts = strokes.flat();
  if (!pts.length) return;
  const x0 = Math.min(...pts.map(q => q[0])), y0 = Math.min(...pts.map(q => q[1]));
  const x1 = Math.max(...pts.map(q => q[0])), y1 = Math.max(...pts.map(q => q[1]));
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1), s = Math.max(w, h);
  const norm = strokes.map(st => st.map(q => [Math.round((q[0] - x0) / s * 1000) / 1000, Math.round((q[1] - y0) / s * 1000) / 1000]));
  const list = loadSignatures();
  list.unshift({ id: Date.now().toString(36), strokes: norm, ratio: w / h, color, lw: strokeWidth / s });
  if (storeSignatures(list)) { toast('Signature enregistrée : retrouvez-la dans l\'outil Dessin (D) ou par clic droit', 'ok', 4500); renderPanel(); }
}
function sigSvg(sig, w = 120, h = 48) {
  const sc = Math.min(w / (sig.ratio >= 1 ? 1 : sig.ratio), h / (sig.ratio >= 1 ? 1 / sig.ratio : 1)) * 0.92;
  const bw = (sig.ratio >= 1 ? 1 : sig.ratio) * sc, bh = (sig.ratio >= 1 ? 1 / sig.ratio : 1) * sc;
  const ox = (w - bw) / 2, oy = (h - bh) / 2;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${sig.strokes.map(st => `<polyline points="${st.map(q => (ox + q[0] * sc).toFixed(1) + ',' + (oy + q[1] * sc).toFixed(1)).join(' ')}" fill="none" stroke="${escapeHtml(sig.color || '#111')}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
}
// Traits d'une signature posée à la largeur `width` (points PDF), coin haut-gauche (x, y)
function sigStrokes(sig, x, y, width) {
  const s = sig.ratio >= 1 ? width : width / sig.ratio;
  return sig.strokes.map(st => st.map(q => [round2(x + q[0] * s), round2(y + q[1] * s)]));
}
const SIG_W = 150;
function placeSignatureAt(sig, p, pt) {
  const w = SIG_W, h = w / sig.ratio;
  const pg = S.pages[p];
  const x = clamp(pt.x - w / 2, 0, Math.max(0, pg.w - w)), y = clamp(pt.y - h / 2, 0, Math.max(0, pg.h - h));
  const scale = sig.ratio >= 1 ? w : w / sig.ratio;
  runOp({ op: 'add_ink', page: p, strokes: sigStrokes(sig, x, y, w), color: sig.color || S.props.color,
    width: round2(clamp((sig.lw || 0.012) * scale, 0.5, 4)), opacity: 1 }).then(r => {
    if (r) toast('Signature ajoutée', 'ok', 4000, undoAction);
  });
}
function startPlacing(sig) {
  S.placing = sig;
  document.body.classList.add('placing');
  if (S.tool !== 'select') setTool('select');
  hint('Cliquez sur la page pour poser la signature · <b>Échap</b> pour annuler', true);
}
function stopPlacing() {
  S.placing = null;
  document.body.classList.remove('placing');
  $$('.sigghost').forEach(n => n.remove());
  hint(null);
}
function placeSignature(p, pt) {
  const sig = S.placing;
  stopPlacing();
  placeSignatureAt(sig, p, pt);
}
// aperçu qui suit la souris pendant le placement
window.addEventListener('pointermove', e => {
  if (!S.placing) return;
  const pe = e.target.closest && e.target.closest('.page');
  $$('.sigghost').forEach(n => { if (!pe || n.parentNode !== overlayEl(+pe.dataset.p)) n.remove(); });
  if (!pe) return;
  const p = +pe.dataset.p, pt = ptFromEvent(e, p), z = S.zoom;
  const w = SIG_W, h = w / S.placing.ratio;
  let g = overlayEl(p).querySelector('.sigghost');
  if (!g) { g = document.createElement('div'); g.className = 'sigghost'; g.innerHTML = sigSvg(S.placing, 300, 300 / S.placing.ratio); overlayEl(p).appendChild(g); }
  g.style.cssText = `left:${(pt.x - w / 2) * z}px;top:${(pt.y - h / 2) * z}px;width:${w * z}px;height:${h * z}px`;
});
// Pavé de signature : on dessine à la souris, au stylet ou au doigt
function signatureDialog() {
  let strokes = [], cur = null, color = '#1a2a6c';
  modal({
    title: `${icon('ink')} Créer une signature`, wide: true,
    body: `<p class="lead">Signez dans le cadre (souris, stylet ou doigt). Elle sera gardée dans ce navigateur pour la poser en un clic.</p>
      <div class="sigpad-wrap"><canvas class="sigpad" width="900" height="300" aria-label="Zone de signature"></canvas><div class="sigline">Signature</div></div>
      <div class="sig-tools"><label>Couleur ${swatches('sigColor', '#1a2a6c', ['#111111', '#1a2a6c', '#0090ff', '#e5484d'])}</label><button class="btn small" data-sig="clear">${icon('trash')}Effacer</button></div>`,
    buttons: [{ label: 'Annuler', value: null }, { label: 'Enregistrer la signature', value: 'save', primary: true }],
    sticky: () => strokes.length > 0,  // un clic à côté ne jette pas le tracé
    onOpen: (m) => {
      const cv = m.querySelector('canvas'), ctx = cv.getContext('2d');
      const redraw = () => {
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round';
        for (const st of strokes.concat(cur ? [cur] : [])) {
          ctx.beginPath();
          st.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          if (st.length === 1) ctx.lineTo(st[0][0] + 0.1, st[0][1] + 0.1);
          ctx.stroke();
        }
      };
      const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
      cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [at(e)]; redraw(); });
      cv.addEventListener('pointermove', e => { if (cur) { cur.push(at(e)); redraw(); } });
      const end = () => { if (cur) { strokes.push(cur); cur = null; redraw(); } };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      m.querySelector('[data-sig="clear"]').onclick = () => { strokes = []; redraw(); };
      m.querySelectorAll('.swatches .sw').forEach(b => b.onclick = () => {
        color = b.dataset.v; m.querySelectorAll('.swatches .sw').forEach(x => x.classList.toggle('active', x === b)); redraw();
      });
      const custom = m.querySelector('.sw-custom');
      if (custom) custom.onchange = () => { color = custom.value; redraw(); };
    },
  }).then(v => {
    if (v !== 'save') return;
    if (!strokes.length) { toast('Signature vide : rien n\'a été enregistré.', 'info'); return; }
    saveSignature(strokes, color, 4);
  });
}

// ------------------------------------------------------------------ export
function exportDialog() {
  if (!S.sid) return;
  const n = S.pages.length;
  const picked = pickedPages();
  modal({
    title: `${icon('download')} Exporter le PDF`,
    body: `<div class="exp">
      <div class="exp-row"><b>Pages</b>
        <label><input type="radio" name="expPages" value="all" checked> Toutes (${n})</label>
        ${picked.length > 1 ? `<label><input type="radio" name="expPages" value="picked"> Pages sélectionnées (${picked.length})</label>` : ''}
        <label><input type="radio" name="expPages" value="range"> Pages : <input type="text" id="expRange" placeholder="ex. 1-3, 5" value="${S.current + 1}"></label>
      </div>
      <div class="exp-row"><b>Taille</b>
        <label><input type="checkbox" id="expCompress"> Réduire la taille (images recompressées à 150 ppp, idéal pour l'envoyer par e-mail)</label>
      </div>
      <div class="exp-row"><b>Nom</b><input type="text" id="expName" value="${escapeHtml(S.name)}-modifie"></div>
      <p class="fnote">Les polices sont toujours réduites aux caractères utilisés : le fichier reste léger.</p></div>`,
    buttons: [{ label: 'Annuler', value: null }, { label: 'Exporter', value: 'go', primary: true }],
    onOpen: m => {
      const range = m.querySelector('#expRange');
      range.addEventListener('focus', () => { m.querySelector('input[value="range"]').checked = true; });
      m.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); m.querySelector('.btn.primary').click(); } }));
      m._read = () => ({
        mode: (m.querySelector('input[name="expPages"]:checked') || {}).value,
        range: range.value, compress: m.querySelector('#expCompress').checked, name: m.querySelector('#expName').value.trim(),
      });
    },
    collect: m => m._read(),
    sticky: true,
    validate: m => {
      const v = m._read();
      if (v.mode !== 'range') return null;
      const spec = v.range.replace(/\s+/g, '');
      if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(spec)) return 'Pages illisibles : écrivez par exemple 1-3, 5';
      const bad = spec.split(/[,-]/).map(Number).find(x => x < 1 || x > n);
      if (bad != null) return `La page ${bad} n'existe pas : le document en compte ${n}.`;
      return null;
    },
  }).then(v => {
    if (!v || typeof v !== 'object') return;
    const pages = v.mode === 'picked' ? pagesSpec(picked) : v.mode === 'range' ? v.range.replace(/\s+/g, '') : '';
    download({ pages, compress: v.compress, name: v.name || undefined });
  });
}

// ------------------------------------------------------------------ boutons
$('#btnOpen').onclick = $('#welcomeOpen').onclick = () => $('#fileOpen').click();
$('#btnNew').onclick = $('#welcomeNew').onclick = newDocument;
$('#fileOpen').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };
$('#btnMerge').onclick = () => $('#fileMerge').click();
$('#fileMerge').onchange = e => {
  const f = e.target.files[0], at = e.target.dataset.at;
  e.target.value = ''; delete e.target.dataset.at;
  if (f) mergeFile(f, at != null ? +at : S.current + 1);
};
$('#btnBlank').onclick = () => runOp({ op: 'page_blank', at: S.current + 1 }).then(() => scrollToPage(S.current + 1));
$('#btnUndo').onclick = undo;
$('#btnRedo').onclick = redo;
$('#btnDownload').onclick = () => download();
$('#btnExport').onclick = exportDialog;
$('#btnFind').onclick = () => (F.open ? closeFind() : openFind());
$('#btnHelp').onclick = showHelp;
$('#zoomIn').onclick = () => setZoom(S.zoom * 1.2);
$('#zoomOut').onclick = () => setZoom(S.zoom / 1.2);
$('#zoomVal').onclick = zoomMenu;
$('#btnThumbsToggle').onclick = () => { document.body.classList.toggle('show-thumbs'); document.body.classList.remove('show-panel'); };
$('#btnPanelToggle').onclick = () => { document.body.classList.toggle('show-panel'); document.body.classList.remove('show-thumbs'); };
// un panneau flottant se referme quand on revient sur la page
viewer.addEventListener('pointerdown', () => document.body.classList.remove('show-thumbs', 'show-panel'));
$('#pagePrev').onclick = () => gotoPage(S.current - 1);
$('#pageNext').onclick = () => gotoPage(S.current + 1);
{
  const inp = $('#pageInput');
  inp.addEventListener('focus', () => inp.select());
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const n = parseInt(inp.value, 10);
      if (n >= 1 && n <= S.pages.length) { gotoPage(n - 1); inp.blur(); }
      else { inp.classList.add('bad'); setTimeout(() => inp.classList.remove('bad'), 600); toast(`Page de 1 à ${S.pages.length}`, 'info', 1800); }
    } else if (e.key === 'Escape') { inp.blur(); }
  });
  inp.addEventListener('blur', updatePageNav);
}
window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(() => { if (S.sid) buildThumbs(); }, 200); });
window.addEventListener('beforeunload', e => {
  if (pendingInk) commitInk();
  // dans la fenêtre de bureau, c'est elle qui demande confirmation (desktop.py)
  if (isDirty() && !desktopApi()) { e.preventDefault(); e.returnValue = ''; }
});
// fenêtre de bureau prête : on lui transmet l'état « modifié » actuel
window.addEventListener('pywebviewready', () => { updateTopbar.dirty = undefined; if (S.sid) updateTopbar(); });

// ------------------------------------------------------------------ démarrage
(async function init() {
  hydrateIcons();
  buildToolbar();
  document.body.dataset.tool = 'select';
  $$('.tool').forEach(b => { b.classList.toggle('active', b.dataset.tool === 'select'); b.setAttribute('aria-pressed', b.dataset.tool === 'select'); });
  hint(null);
  try { S.fonts = await apiJson('/api/fonts'); } catch (e) { S.fonts = [{ key: 'helv', label: 'Helvetica', css: 'Arial, sans-serif' }]; }
  if (!S.fonts.some(f => f.key === S.props.font)) S.props.font = 'helv';
  // reprend le document en cours après un rafraîchissement de la page
  // ?sid=… : document ouvert par l'application de bureau (fichier passé au lancement)
  let sid = new URLSearchParams(location.search).get('sid');
  if (sid) history.replaceState(null, '', location.pathname);
  else try { sid = localStorage.getItem('pdfchanger.sid'); } catch (e) { /* ignore */ }
  if (sid) {
    try { loadInfo(await apiJson(`/api/doc/${sid}/info`), true); } catch (e) { try { localStorage.removeItem('pdfchanger.sid'); } catch (_) { /* ignore */ } }
  }
})();
