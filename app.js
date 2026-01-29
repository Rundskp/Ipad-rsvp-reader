/* =============================================================
   RSVP Reader - Speed Reading Tool
   (c) 2026 rundskp - CLEAN VERSION
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
  marksList: $("marksList"), settingsModal: $("settingsModal"),
  wpm: $("wpm"), wpmSettingVal: $("wpmSettingVal"), chunk: $("chunk"),
  chunkVal: $("chunkVal"), orp: $("orp"), punct: $("punct"),
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

/* Layout & Status */
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

/* Storage */
const DB_NAME = "rsvp_reader_db", STORE = "books";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function idbPut(o) { const db = await idbOpen(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(o); }
async function idbGet(id) { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id); return new Promise(r => req.onsuccess = () => r(req.result)); }
async function idbGetAll() { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); return new Promise(r => req.onsuccess = () => r(req.result)); }

/* Reader Logic */
const S = { words: [], idx: 0, playing: false, settings: { wpm: 360, chunk: 1, orp: true, punct: true, punctMs: 200 }, book: {} };

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
  if (el.btnPlay) el.btnPlay.disabled = total === 0;
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id);
  if (!b) return;
  S.words = b.words; S.idx = b.idx || 0; S.book = b;
  showCurrent(); setStatus(`Geladen: ${b.title}`, { sticky: true });
}

/* Import Logic */
async function checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('import') === 'clipboard') {
    window.history.replaceState({}, "", window.location.pathname);
    setStatus("📥 Hier tippen zum Importieren", { sticky: true, persist: true });
    const trigger = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return setStatus("Clipboard leer!");
        const book = { id: 'web_'+Date.now(), title: p.get('title') || 'Web Import', words: wordsFromText(text), createdAt: Date.now() };
        await idbPut(book); await renderShelf(); await loadBookFromLibrary(book.id);
        setStatus("Import fertig ✅");
      } catch (e) { setStatus("Fehler: Klick nötig!"); }
    };
    el.status.addEventListener("click", trigger);
  }
}

async function renderShelf() {
  const books = await idbGetAll();
  if (!el.shelfList) return;
  el.shelfList.innerHTML = "";
  books.forEach(b => {
    const d = document.createElement("div"); d.className = "bookCard"; d.textContent = b.title;
    d.onclick = () => loadBookFromLibrary(b.id); el.shelfList.appendChild(d);
  });
}

function bindUI() {
  el.btnPlay?.addEventListener("click", () => { S.playing = !S.playing; el.btnPlay.textContent = S.playing ? "Pause" : "Play"; });
  el.btnShelf?.addEventListener("click", () => el.shelf.classList.toggle("hidden"));
}

/* Boot */
(async function boot() {
  setTopbarHeightVar(); bindUI();
  try { await renderShelf(); } catch(e){}
  await checkURLParams();
  if (!el.status.classList.contains("import-active")) setStatus("Warte auf Datei…");
})().catch(e => console.error("Boot-Error:", e));
