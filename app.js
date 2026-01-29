/* =============================================================
   RSVP Reader - Speed Reading Tool
   (c) 2026 rundskp
   
   NON-COMMERCIAL USE ONLY
   Dieses Tool ist für den privaten Gebrauch bestimmt. 
   Kommerzielle Nutzung oder Weiterverkauf sind untersagt.
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
  file: $("file"), status: $("status"), headerInfo: $("headerInfo"),
  coverImg: $("coverImg"), bookTitle: $("bookTitle"), bookAuthor: $("bookAuthor"),
  prog: $("prog"), wpmVal: $("wpmVal"), chapVal: $("chapVal"),
  display: $("display"), word: $("word"), btnPlay: $("btnPlay"),
  btnBack: $("btnBack"), btnFwd: $("btnFwd"), btnBookmark: $("btnBookmark"),
  seek: $("seek"), pos: $("pos"), total: $("total"),
  btnSidebar: $("btnSidebar"), btnHeader: $("btnHeader"), btnSettings: $("btnSettings"),
  btnShelf: $("btnShelf"), btnHelp: $("btnHelp"), btnDonate: $("btnDonate"),
  btnExportAll: $("btnExportAll"), importFile: $("importFile"),
  btnDeleteSelected: $("btnDeleteSelected"), btnSelectAll: $("btnSelectAll"),
  sidebar: $("sidebar"), tabToc: $("tabToc"), tabMarks: $("tabMarks"),
  tocPane: $("tocPane"), marksPane: $("marksPane"), tocList: $("tocList"),
  marksList: $("marksList"), btnSidebarCloseMobile: $("btnSidebarCloseMobile"),
  settingsModal: $("settingsModal"), wpm: $("wpm"), wpmSettingVal: $("wpmSettingVal"),
  chunk: $("chunk"), chunkVal: $("chunkVal"), orp: $("orp"), punct: $("punct"),
  punctMs: $("punctMs"), punctVal: $("punctVal"), stopChapter: $("stopChapter"),
  stopWordsOn: $("stopWordsOn"), stopWords: $("stopWords"),
  stopMinsOn: $("stopMinsOn"), stopMins: $("stopMins"),
  btnSaveSettings: $("btnSaveSettings"), btnLoadSettings: $("btnLoadSettings"),
  btnSettingsClose: $("btnSettingsClose"), shelf: $("shelf"), shelfList: $("shelfList"),
  helpBackdrop: $("helpBackdrop"), helpBody: $("helpBody"), btnHelpClose: $("btnHelpClose"),
  donateBackdrop: $("donateBackdrop"), btnDonateClose: $("btnDonateClose"),
  btnPaypalQR: $("btnPaypalQR"), paypalQrWrap: $("paypalQrWrap"),
  paypalQrImg: $("paypalQrImg"), paypalQrHint: $("paypalQrHint"),
  btcAddr: $("btcAddr"), btnCopyBtc: $("btnCopyBtc"), btnBtcQR: $("btnBtcQR"),
  btcQrWrap: $("btcQrWrap"), btcQrImg: $("btcQrImg"), btcQrHint: $("btcQrHint"),
};

/* -----------------------------
   Toast & Status
------------------------------ */
const toastEl = $("toast");
let _toastT = null;
function toast(msg, ms = 1400) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  if (_toastT) clearTimeout(_toastT);
  _toastT = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

let _statusT = null;
function setStatus(msg, { sticky = false, toastMs = 1400, persist = false } = {}) {
  if (!el.status) return;
  if (el.status.classList.contains("import-active") && !persist) return;
  if (!sticky) toast(msg, toastMs);
  el.status.textContent = msg;
  el.status.classList.toggle("import-active", !!persist); 
  if (_statusT) clearTimeout(_statusT);
  if (sticky && !persist) {
    _statusT = setTimeout(() => { 
      if (el.status) { el.status.textContent = ""; el.status.classList.remove("import-active"); }
    }, 4000);
  }
}

/* -----------------------------
   Storage & Helpers
------------------------------ */
async function ensurePersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return { ok: false };
    const already = await navigator.storage.persisted?.();
    if (already) return { ok: true };
    const granted = await navigator.storage.persist();
    return { ok: true };
  } catch (e) { return { ok: false }; }
}

const DB_NAME = "rsvp_reader_db", DB_VER = 1, STORE = "books";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) { const db = await idbOpen(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); }
async function idbPut(book) { const db = await idbOpen(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(book); }
async function idbGet(id) { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id); return new Promise(r => req.onsuccess = () => r(req.result)); }
async function idbGetAll() { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); return new Promise(r => req.onsuccess = () => r(req.result)); }

function wordsFromText(txt) {
  const cleaned = String(txt || "").replace(/\u00AD/g, "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.split(" ").filter(Boolean) : [];
}

/* -----------------------------
   Playback Logic
------------------------------ */
const S = {
  words: [], idx: 0, playing: false, timer: null,
  book: { id: null, title: "—", author: "—", coverDataUrl: "", chapters: [], toc: [] },
  bookmarks: [], playStartedAt: 0, wordsAtPlayStart: 0, pendingStop: false,
  settings: { wpm: 360, chunk: 1, orp: true, punct: true, punctMs: 200, stopChapter: false, stopWordsOn: false, stopWords: 2000, stopMinsOn: false, stopMins: 10 }
};

function renderToken(token) {
  if (!S.settings.orp) { el.word.innerHTML = escapeHtml(token); return; }
  const m = token.match(/[A-Za-zÄÖÜäöüß0-9]+/);
  if (!m) { el.word.innerHTML = escapeHtml(token); return; }
  const seg = m[0], orpIdx = computeOrpIndex(seg);
  el.word.innerHTML = `${escapeHtml(token.slice(0, token.indexOf(seg)))}${escapeHtml(seg.slice(0, orpIdx))}<span class="orp">${escapeHtml(seg.slice(orpIdx, orpIdx + 1))}</span>${escapeHtml(seg.slice(orpIdx + 1))}${escapeHtml(token.slice(token.indexOf(seg) + seg.length))}`;
}

function computeOrpIndex(w) { const l = w.replace(/[^A-Za-zÄÖÜäöüß0-9]/g, "").length; return l <= 1 ? 0 : l <= 5 ? 1 : l <= 9 ? 2 : 3; }
function escapeHtml(s) { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function scheduleNext() {
  if (!S.playing || !S.words.length) { stopPlayback(); return; }
  const chunk = S.settings.chunk, start = S.idx, end = clamp(start + chunk, start, S.words.length);
  const token = S.words.slice(start, end).join(" ");
  renderToken(token); updateProgressUI();
  S.idx = end;
  if (S.pendingStop && /[.!?…。！？]/.test(token)) { stopPlayback("Auto-Stop ✅"); return; }
  if (end >= S.words.length) { stopPlayback("Ende ✅"); return; }
  let delay = (60000 / S.settings.wpm) * chunk;
  if (S.settings.punct && /[.!?…。！？;:,，]/.test(token)) delay += S.settings.punctMs;
  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;
  if (S.playing) { stopPlayback(); return; }
  S.playing = true; S.pendingStop = false;
  if (el.btnPlay) el.btnPlay.textContent = "Pause";
  S.playStartedAt = Date.now(); S.wordsAtPlayStart = S.idx;
  scheduleNext();
}

function stopPlayback(reason = "") {
  S.playing = false; if (S.timer) clearTimeout(S.timer);
  S.timer = null; S.pendingStop = false;
  if (el.btnPlay) el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
  persistCurrentBookState();
}

function step(deltaChunks) {
  stopPlayback();
  S.idx = clamp(S.idx + (deltaChunks * S.settings.chunk), 0, Math.max(0, S.words.length - 1));
  showCurrent();
}

function showCurrent() {
  if (!S.words.length) { if (el.word) el.word.textContent = "—"; updateProgressUI(); return; }
  const token = S.words.slice(S.idx, S.idx + S.settings.chunk).join(" ");
  renderToken(token); updateProgressUI();
}

/* -----------------------------
   Library Management
------------------------------ */
async function renderShelf() {
  if (!el.shelfList) return;
  const all = await idbGetAll();
  const books = all.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
  el.shelfList.innerHTML = books.length ? "" : "Noch keine Bücher gespeichert.";
  books.forEach(b => {
    const card = document.createElement("div"); card.className = "bookCard";
    card.innerHTML = `<div class="bookCardTop"><input type="checkbox" class="bookPick" data-id="${b.id}"><div class="t">${escapeHtml(b.title)}</div></div><img src="${b.coverDataUrl || ''}" style="display:${b.coverDataUrl?'block':'none'}"><div class="a">${escapeHtml(b.author)}</div>`;
    card.onclick = () => loadBookFromLibrary(b.id); el.shelfList.appendChild(card);
  });
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id); if (!b) return;
  stopPlayback(); S.book = b; S.words = b.words || []; S.idx = b.idx || 0; S.bookmarks = b.bookmarks || [];
  syncHeaderUI(); renderToc(); renderBookmarks(); showCurrent();
  setStatus(`Geladen: ${b.title}`, { sticky: true });
}

async function saveBookToLibrary(bookObj) { await idbPut(bookObj); await renderShelf(); }
async function persistCurrentBookState() { if (S.book.id) { const b = await idbGet(S.book.id); b.idx = S.idx; b.bookmarks = S.bookmarks; b.updatedAt = Date.now(); await idbPut(b); } }

/* -----------------------------
   Import Logic
------------------------------ */
async function checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('import') === 'clipboard') {
    window.history.replaceState({}, "", window.location.pathname);
    setStatus("📥 Hier tippen zum Importieren", { sticky: true, persist: true });
    el.status.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return setStatus("Zwischenablage leer!");
        const id = 'web_' + Date.now();
        await saveBookToLibrary({ id, title: p.get('title') || 'Web Import', author: 'Web', words: wordsFromText(text), idx: 0, bookmarks: [], createdAt: Date.now(), updatedAt: Date.now() });
        await loadBookFromLibrary(id);
        setStatus("Import erfolgreich ✅");
      } catch (e) { setStatus("Fehler: Klick nötig!"); }
    };
  }
}

/* -----------------------------
   UI BINDING
------------------------------ */
function bindUI() {
  const addFeedback = (b) => { if(!b) return; b.classList.remove("btn-feedback"); void b.offsetWidth; b.classList.add("btn-feedback"); };
  el.btnPlay?.addEventListener("click", () => { togglePlay(); addFeedback(el.btnPlay); });
  el.btnBack?.addEventListener("click", () => { step(-1); addFeedback(el.btnBack); });
  el.btnFwd?.addEventListener("click", () => { step(1); addFeedback(el.btnFwd); });
  el.btnBookmark?.addEventListener("click", () => { addBookmarkAtCurrent(); addFeedback(el.btnBookmark); });
  el.file?.addEventListener("change", (e) => { const f = e.target.files[0]; if(f) handleFile(f); });
  el.btnShelf?.addEventListener("click", () => { el.shelf.classList.toggle("hidden"); });
  // Weitere Listener hier einfügen...
}

/* -----------------------------
   BOOT
------------------------------ */
(async function boot() {
  setTopbarHeightVar();
  bindUI();
  if (typeof initDockPanels === 'function') initDockPanels();
  await ensurePersistentStorage();
  try { await renderShelf(); } catch(e){}
  await checkURLParams();
  if (!el.status.classList.contains("import-active")) setStatus("Warte auf Datei…");
})().catch(e => console.error("Boot Error:", e));
