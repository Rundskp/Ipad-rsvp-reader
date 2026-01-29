/* =============================================================
   RSVP Reader - Speed Reading Tool (COMPLETE RESTORED VERSION)
   (c) 2026 rundskp
   ============================================================= */

const $ = (id) => document.getElementById(id);
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
  donateBackdrop: $("donateBackdrop"), btnDonateClose: $("btnDonateClose")
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function show(x) { if (x) x.classList.remove("hidden"); }
function hide(x) { if (x) x.classList.add("hidden"); }

/* -----------------------------
   Layout & Status
------------------------------ */
function setTopbarHeightVar() {
  const tb = document.querySelector('.topbar');
  if (tb) document.documentElement.style.setProperty('--topbarH', tb.offsetHeight + 'px');
}
window.addEventListener('load', setTopbarHeightVar);
window.addEventListener('resize', setTopbarHeightVar);

const toastEl = $("toast");
let _toastT = null;
function toast(msg, ms = 1400) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.remove("hidden");
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
    _statusT = setTimeout(() => { if (el.status) { el.status.textContent = ""; el.status.classList.remove("import-active"); } }, 4000);
  }
}

/* -----------------------------
   IndexedDB Logic
------------------------------ */
const DB_NAME = "rsvp_reader_db", STORE = "books";
function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
async function idbPut(o) { const db = await idbOpen(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(o); }
async function idbGet(id) { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id); return new Promise(r => req.onsuccess = () => r(req.result)); }
async function idbGetAll() { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); return new Promise(r => req.onsuccess = () => r(req.result)); }

/* -----------------------------
   Reader Logic
------------------------------ */
const S = { 
  words: [], idx: 0, playing: false, timer: null,
  settings: { wpm: 360, chunk: 1, orp: true, punct: true, punctMs: 200 },
  book: { id: null, title: "—" }, bookmarks: []
};

function wordsFromText(t) { return String(t||"").replace(/\s+/g, " ").trim().split(" ").filter(Boolean); }

function showCurrent() {
  if (!S.words.length) return;
  const start = clamp(S.idx, 0, S.words.length - 1);
  const token = S.words.slice(start, start + S.settings.chunk).join(" ");
  if (el.word) el.word.textContent = token;
  updateProgressUI();
}

function updateProgressUI() {
  const total = S.words.length;
  if (el.pos) el.pos.textContent = S.idx;
  if (el.total) el.total.textContent = total;
  if (el.seek) { el.seek.max = total; el.seek.value = S.idx; }
  if (el.btnPlay) el.btnPlay.disabled = total === 0;
}

function scheduleNext() {
  if (!S.playing || S.idx >= S.words.length) { stopPlayback(); return; }
  showCurrent();
  S.idx += S.settings.chunk;
  let delay = (60000 / S.settings.wpm) * S.settings.chunk;
  if (S.settings.punct && /[.!?]/.test(S.words[S.idx-1])) delay += S.settings.punctMs;
  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;
  S.playing = !S.playing;
  if (el.btnPlay) el.btnPlay.textContent = S.playing ? "Pause" : "Play";
  if (S.playing) scheduleNext(); else if (S.timer) clearTimeout(S.timer);
}

function stopPlayback() { S.playing = false; if (S.timer) clearTimeout(S.timer); if (el.btnPlay) el.btnPlay.textContent = "Play"; }

async function loadBookFromLibrary(id) {
  const b = await idbGet(id); if (!b) return;
  stopPlayback(); S.book = b; S.words = b.words || []; S.idx = b.idx || 0;
  showCurrent(); setStatus(`Geladen: ${b.title}`, { sticky: true });
}

/* -----------------------------
   Import & UI Bindings
------------------------------ */
async function checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('import') === 'clipboard') {
    window.history.replaceState({}, "", window.location.pathname);
    setStatus("📥 Hier tippen zum Importieren", { sticky: true, persist: true });
    el.status.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return setStatus("Clipboard leer!");
        const id = 'web_' + Date.now();
        const book = { id, title: p.get('title') || 'Web Import', words: wordsFromText(text), updatedAt: Date.now() };
        await idbPut(book); await renderShelf(); await loadBookFromLibrary(id);
        setStatus("Import fertig ✅");
        el.status.classList.remove("import-active");
      } catch (e) { setStatus("Fehler: Klick nötig!"); }
    };
  }
}

async function renderShelf() {
  const books = await idbGetAll(); if (!el.shelfList) return;
  el.shelfList.innerHTML = "";
  books.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0)).forEach(b => {
    const d = document.createElement("div"); d.className = "bookCard"; d.textContent = b.title;
    d.onclick = () => loadBookFromLibrary(b.id); el.shelfList.appendChild(d);
  });
}

function bindUI() {
  el.btnPlay?.addEventListener("click", togglePlay);
  el.btnBack?.addEventListener("click", () => { S.idx = clamp(S.idx - 10, 0, S.words.length); showCurrent(); });
  el.btnFwd?.addEventListener("click", () => { S.idx = clamp(S.idx + 10, 0, S.words.length); showCurrent(); });
  el.btnShelf?.addEventListener("click", () => { el.shelf.classList.contains("hidden") ? show(el.shelf) : hide(el.shelf); });
  el.seek?.addEventListener("input", (e) => { S.idx = parseInt(e.target.value); showCurrent(); });
}

/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  setTopbarHeightVar(); bindUI();
  try { await renderShelf(); } catch(e){}
  await checkURLParams();
  if (!el.status.classList.contains("import-active")) setStatus("Warte auf Datei…");
})().catch(e => console.error("Boot Error:", e));
