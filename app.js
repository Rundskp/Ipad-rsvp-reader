/* =============================================================
   RSVP Reader - Speed Reading Tool
   (c) 2026 rundskp
   
   NON-COMMERCIAL USE ONLY / NO DERIVATIVES
   Dieses Tool ist für den privaten Gebrauch bestimmt. 
   Kommerzielle Nutzung, Weiterverkauf oder die Verbreitung 
   modifizierter Versionen sind strengstens untersagt.
   ============================================================= */

console.log(
`%c
  _____  _______      _______  _____                _Z_
 |  __ \\/ ____\\ \\    / /  __ \\|  __ \\              /   \\
 | |__) | (___  \\ \\  / /| |__) | |__) |___  __ _  |  O  |
 |  _  / \\___ \\  \\ \\/ / |  ___/|  _  // _ \\/ _' |  \\___/
 | | \\ \\ ____) |  \\  /  | |    | | \\ \\  __/ (_| |   |_|
 |_|  \\_\\_____/    \\/   |_|    |_|  \\_\\___|\\__,_|  /__/
`, "color: #7ee787; font-weight: bold;");

console.log("%c[System]%c RSVP Reader v2.2 - Non-Commercial Edition", "color: #7ee787", "color: inherit");
console.log("%c[Legal]%c (c) 2026 rundskp. No derivatives allowed.", "color: #ff4d4d; font-weight: bold;", "color: inherit");

/* -----------------------------
   Layout helpers
------------------------------ */
function setTopbarHeightVar() {
  const tb = document.querySelector('.topbar');
  if (!tb) return;
  const h = Math.max(0, tb.offsetHeight || 0);
  document.documentElement.style.setProperty('--topbarH', h + 'px');
}

window.addEventListener('load', setTopbarHeightVar);
let _tbT = null;
window.addEventListener('resize', () => {
  clearTimeout(_tbT);
  _tbT = setTimeout(setTopbarHeightVar, 100);
});
window.addEventListener('DOMContentLoaded', setTopbarHeightVar);

const $ = (id) => document.getElementById(id);
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function show(x) { if (!x) return; x.classList.remove("hidden"); x.hidden = false; }
function hide(x) { if (!x) return; x.classList.add("hidden"); x.hidden = true; }

/* ---------- Elements ---------- */
const el = {
  file: $("file"),
  status: $("status"),
  headerInfo: $("headerInfo"),
  coverImg: $("coverImg"),
  bookTitle: $("bookTitle"),
  bookAuthor: $("bookAuthor"),
  prog: $("prog"),
  wpmVal: $("wpmVal"),
  chapVal: $("chapVal"),
  display: $("display"),
  word: $("word"),
  btnPlay: $("btnPlay"),
  btnBack: $("btnBack"),
  btnFwd: $("btnFwd"),
  btnReset: $("btnReset"),
  btnBookmark: $("btnBookmark"),
  seek: $("seek"),
  pos: $("pos"),
  total: $("total"),
  btnSidebar: $("btnSidebar"),
  btnHeader: $("btnHeader"),
  btnSettings: $("btnSettings"),
  btnShelf: $("btnShelf"),
  btnHelp: $("btnHelp"),
  btnDonate: $("btnDonate"),
  btnExportAll: $("btnExportAll"),
  btnExportSelected: $("btnExportSelected"),
  importFile: $("importFile"),
  btnDeleteSelected: $("btnDeleteSelected"),
  btnSelectAll: $("btnSelectAll"),
  sidebar: $("sidebar"),
  tabToc: $("tabToc"),
  tabMarks: $("tabMarks"),
  tocPane: $("tocPane"),
  marksPane: $("marksPane"),
  tocList: $("tocList"),
  marksList: $("marksList"),
  btnSidebarCloseMobile: $("btnSidebarCloseMobile"),
  settingsModal: $("settingsModal"),
  wpm: $("wpm"),
  wpmSettingVal: $("wpmSettingVal"),
  chunk: $("chunk"),
  chunkVal: $("chunkVal"),
  orp: $("orp"),
  punct: $("punct"),
  punctMs: $("punctMs"),
  punctVal: $("punctVal"),
  stopChapter: $("stopChapter"),
  stopWordsOn: $("stopWordsOn"),
  stopWords: $("stopWords"),
  btnSaveSettings: $("btnSaveSettings"),
  btnLoadSettings: $("btnLoadSettings"),
  btnSettingsClose: $("btnSettingsClose"),
  shelf: $("shelf"),
  shelfList: $("shelfList"),
  helpBackdrop: $("helpBackdrop"),
  helpBody: $("helpBody"),
  btnHelpClose: $("btnHelpClose"),
  donateBackdrop: $("donateBackdrop"),
  btnDonateClose: $("btnDonateClose"),
  btnPaypalQR: $("btnPaypalQR"),
  paypalQrWrap: $("paypalQrWrap"),
  paypalQrImg: $("paypalQrImg"),
  paypalQrHint: $("paypalQrHint"),
  btcAddr: $("btcAddr"),
  btnCopyBtc: $("btnCopyBtc"),
  btnBtcQR: $("btnBtcQR"),
  btcQrWrap: $("btcQrWrap"),
  btcQrImg: $("btcQrImg"),
  btcQrHint: $("btcQrHint"),
};

/* -----------------------------
   Toast & Status (3s Timer)
------------------------------ */
const toastEl = $("toast");
let _toastT = null, _statusT = null;

function toast(msg, ms = 1400) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  if (_toastT) clearTimeout(_toastT);
  _toastT = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function setStatus(msg, { sticky = false, toastMs = 1400 } = {}) {
  toast(msg, toastMs);
  if (el.status && sticky) {
    el.status.textContent = msg;
    if (_statusT) clearTimeout(_statusT);
    _statusT = setTimeout(() => { if (el.status) el.status.textContent = ""; }, 3000);
  }
}

/* -----------------------------
   IndexedDB Logic
------------------------------ */
const DB_NAME = "rsvp_reader_db", DB_VER = 1, STORE = "books";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function idbDelete(id) { const db = await idbOpen(); return new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(true); }); }
async function idbPut(obj) { const db = await idbOpen(); return new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(obj); tx.oncomplete = () => res(true); }); }
async function idbGet(id) { const db = await idbOpen(); return new Promise((res) => { const tx = db.transaction(STORE, "readonly"); const req = tx.objectStore(STORE).get(id); req.onsuccess = () => res(req.result || null); }); }
async function idbGetAll() { const db = await idbOpen(); return new Promise((res) => { const tx = db.transaction(STORE, "readonly"); const req = tx.objectStore(STORE).getAll(); req.onsuccess = () => res(req.result || []); }); }

/* -----------------------------
   Library Actions
------------------------------ */
async function exportLibrary({ mode }) {
  const all = await idbGetAll();
  if (!all.length) return setStatus("Bibliothek leer.");
  let books = all;
  if (mode === "selected") {
    const picked = [...document.querySelectorAll(".bookPick:checked")].map(cb => cb.getAttribute("data-id"));
    books = all.filter(b => picked.includes(b.id));
  }
  const payload = { format: "rsvp-library", exportedAt: Date.now(), books };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rsvp_lib_${mode}.json`; a.click();
  setStatus("Export fertig ✅");
}

function toggleSelectAllBooks() {
  const cbs = document.querySelectorAll(".bookPick");
  const allOn = [...cbs].every(c => c.checked);
  cbs.forEach(c => c.checked = !allOn);
  if (el.btnSelectAll) el.btnSelectAll.textContent = allOn ? "Alle auswählen" : "Auswahl aufheben";
}

async function deleteSelectedFromLibrary() {
  const ids = [...document.querySelectorAll(".bookPick:checked")].map(cb => cb.getAttribute("data-id"));
  if (!ids.length) return setStatus("Nichts ausgewählt.");
  if (confirm(`${ids.length} Bücher löschen?`)) {
    for (const id of ids) {
      await idbDelete(id);
      if (S.book.id === id) { S.book.id = null; S.words = []; showCurrent(); }
    }
    await renderShelf();
    setStatus("Gelöscht ✅");
  }
}

/* -----------------------------
   State & Settings
------------------------------ */
const LS_KEY = "rsvp_reader_settings";
const S = {
  words: [], idx: 0, playing: false, timer: null,
  book: { id: null, title: "—", author: "—", coverDataUrl: "", chapters: [], toc: [] },
  bookmarks: [],
  settings: { wpm: 360, chunk: 1, orp: true, punct: true, punctMs: 200, stopChapter: false, stopWordsOn: false, stopWords: 2000 }
};

function saveSettingsToLS() { localStorage.setItem(LS_KEY, JSON.stringify(S.settings)); }
function loadSettingsFromLS() { try { const p = JSON.parse(localStorage.getItem(LS_KEY)); if (p) S.settings = { ...S.settings, ...p }; } catch {} }

function applySettingsToUI() {
  if (!el.wpm) return;
  el.wpm.value = S.settings.wpm; el.wpmVal.textContent = S.settings.wpm;
  if (el.wpmSettingVal) el.wpmSettingVal.textContent = S.settings.wpm;
  el.chunk.value = S.settings.chunk; el.chunkVal.textContent = S.settings.chunk;
  el.orp.checked = S.settings.orp; el.punct.checked = S.settings.punct;
  el.punctMs.value = S.settings.punctMs; el.punctVal.textContent = S.settings.punctMs;
  el.stopChapter.checked = S.settings.stopChapter; el.stopWordsOn.checked = S.settings.stopWordsOn;
  el.stopWords.value = S.settings.stopWords;
  syncHeaderUI();
}

function syncHeaderUI() {
  if (el.bookTitle) el.bookTitle.textContent = S.book.title || "—";
  if (el.bookAuthor) el.bookAuthor.textContent = S.book.author || "—";
  if (el.coverImg) { el.coverImg.src = S.book.coverDataUrl || ""; el.coverImg.style.display = S.book.coverDataUrl ? "block" : "none"; }
}

function updateProgressUI() {
  const total = S.words.length;
  const idx = clamp(S.idx, 0, Math.max(0, total - 1));
  const pct = total ? Math.round((idx / total) * 100) : 0;
  if (el.prog) el.prog.textContent = `${pct}%`;
  if (el.pos) el.pos.textContent = idx;
  if (el.total) el.total.textContent = total;
  if (el.seek) { el.seek.max = Math.max(0, total - 1); el.seek.value = idx; el.seek.disabled = total === 0; }
}

function showCurrent() {
  if (!S.words.length) { if (el.word) el.word.textContent = "—"; updateProgressUI(); return; }
  const token = S.words.slice(S.idx, S.idx + S.settings.chunk).join(" ");
  el.word.textContent = token; // Einfaches Rendering für Stabilität
  updateProgressUI();
}

/* -----------------------------
   Panels & Docks (Fix)
------------------------------ */
function initDockPanels() {
  const panels = [...document.querySelectorAll("[data-panel-id]")];
  const panelById = (id) => panels.find(p => p.dataset.panelId === id);

  const showWithAnim = (p) => { p.classList.remove("hidden"); p.hidden = false; requestAnimationFrame(() => p.classList.add("isOpen")); };
  const hideWithAnim = (p) => { p.classList.remove("isOpen"); setTimeout(() => { p.classList.add("hidden"); p.hidden = true; }, 160); };

  window.__dockClose = (id) => {
    const p = panelById(id);
    if (p) hideWithAnim(p);
    document.querySelector(`.topBtn[data-panel="${id}"]`)?.classList.remove("isActive");
  };

  document.querySelectorAll(".topBtn[data-panel]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.panel;
      if (id === "header") { el.headerInfo?.classList.toggle("hidden"); btn.classList.toggle("isActive"); return; }
      const p = panelById(id);
      if (!p) return;
      if (!p.classList.contains("hidden")) {
        hideWithAnim(p); btn.classList.remove("isActive");
      } else {
        setTopbarHeightVar(); showWithAnim(p); btn.classList.add("isActive");
      }
    });
  });

  // Schließen-Buttons in Popovers
  [el.btnSettingsClose, el.btnHelpClose, el.btnDonateClose, el.btnSidebarCloseMobile].forEach(b => {
    if (b) b.addEventListener("click", () => {
       const p = b.closest('[data-panel-id]');
       if (p) window.__dockClose(p.dataset.panelId);
    });
  });
}

/* -----------------------------
   Reader Logic
------------------------------ */
function togglePlay() {
  if (!S.words.length) return;
  S.playing = !S.playing;
  el.btnPlay.textContent = S.playing ? "Pause" : "Play";
  if (S.playing) scheduleNext();
  else if (S.timer) clearTimeout(S.timer);
}

function scheduleNext() {
  if (!S.playing || S.idx >= S.words.length) { S.playing = false; el.btnPlay.textContent = "Play"; return; }
  showCurrent();
  S.idx += S.settings.chunk;
  const ms = (60000 / S.settings.wpm) * S.settings.chunk;
  S.timer = setTimeout(scheduleNext, ms);
}

async function renderShelf() {
  if (el.btnSelectAll) el.btnSelectAll.textContent = "Alle auswählen";
  el.shelfList.innerHTML = "";
  const all = await idbGetAll();
  all.forEach(b => {
    const card = document.createElement("div");
    card.className = "bookCard";
    card.innerHTML = `<div class="bookCardTop"><input type="checkbox" class="bookPick" data-id="${b.id}"><div>${b.title}</div></div>
                      ${b.coverDataUrl ? `<img src="${b.coverDataUrl}">` : ''}<div>${b.author}</div>`;
    card.querySelector('input').onclick = e => e.stopPropagation();
    card.onclick = () => loadBookFromLibrary(b.id);
    el.shelfList.appendChild(card);
  });
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id);
  if (!b) return;
  S.book = b; S.words = b.words; S.idx = b.idx || 0;
  syncHeaderUI(); showCurrent();
  setStatus(`Geladen: ${b.title}`, { sticky: true });
}

function bindUI() {
  el.file.onchange = e => { const f = e.target.files[0]; if (f) handleFile(f); };
  el.btnPlay.onclick = togglePlay;
  el.btnSelectAll.onclick = toggleSelectAllBooks;
  el.btnDeleteSelected.onclick = deleteSelectedFromLibrary;
  el.btnExportAll.onclick = () => exportLibrary({ mode: "all" });
  el.btnExportSelected.onclick = () => exportLibrary({ mode: "selected" });
  el.btnSaveSettings.onclick = () => { 
    S.settings.wpm = parseInt(el.wpm.value); 
    saveSettingsToLS(); applySettingsToUI(); setStatus("Gespeichert ✅"); 
  };
}

async function handleFile(file) {
  const words = (await file.text()).split(/\s+/);
  S.book = { id: file.name, title: file.name, author: "Lokal", words };
  S.words = words; S.idx = 0;
  await idbPut(S.book); await renderShelf();
  syncHeaderUI(); showCurrent();
}

/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  setTopbarHeightVar();
  bindUI();
  initDockPanels();
  loadSettingsFromLS();
  applySettingsToUI();
  await renderShelf();
  setStatus("Warte auf Datei...");
})();
