/* =============================================================
   RSVP Reader - Saubere Version (Clipboard Import fix)
   (c) 2026 rundskp
   ============================================================= */
const $ = (id) => document.getElementById(id);
const el = {
  file: $("file"), status: $("status"), display: $("display"), word: $("word"),
  btnPlay: $("btnPlay"), btnBack: $("btnBack"), btnFwd: $("btnFwd"), btnBookmark: $("btnBookmark"),
  seek: $("seek"), pos: $("pos"), total: $("total"), shelf: $("shelf"), shelfList: $("shelfList"),
  btnSidebar: $("btnSidebar"), btnSettings: $("btnSettings"), btnShelf: $("btnShelf"),
  btnHelp: $("btnHelp"), btnDonate: $("btnDonate")
};

let _statusT = null;
const toastEl = $("toast");
function toast(msg, ms = 1400) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function setStatus(msg, { sticky = false, toastMs = 1400, persist = false } = {}) {
  if (!el.status) return;
  if (el.status.classList.contains("import-active") && !persist) return;
  if (!sticky) toast(msg, toastMs);
  el.status.textContent = msg;
  el.status.classList.toggle("import-active", !!persist);
  if (_statusT) clearTimeout(_statusT);
  if (sticky && !persist) {
    _statusT = setTimeout(() => { if (el.status) el.status.textContent = ""; }, 4000);
  }
}

/* STORAGE & HELPERS */
const DB_NAME = "rsvp_reader_db", STORE = "books";
function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}
async function idbPut(obj) { const db = await idbOpen(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(obj); }
async function idbGet(id) { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id); return new Promise(r => req.onsuccess = () => r(req.result)); }
async function idbGetAll() { const db = await idbOpen(); const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); return new Promise(r => req.onsuccess = () => r(req.result)); }

function wordsFromText(t) { return String(t||"").replace(/\s+/g, " ").trim().split(" ").filter(Boolean); }

async function saveBookToLibrary(obj) { await idbPut(obj); await renderShelf(); }

async function checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('import') === 'clipboard') {
    window.history.replaceState({}, "", window.location.pathname);
    setStatus("📥 Hier tippen zum Importieren", { sticky: true, persist: true });
    const trigger = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return setStatus("Clipboard leer!");
        const id = 'web_' + Date.now();
        const book = { id, title: p.get('title') || 'Web Import', words: wordsFromText(text), idx: 0, bookmarks: [], createdAt: Date.now() };
        await saveBookToLibrary(book);
        await loadBookFromLibrary(id);
        setStatus("Import fertig ✅");
        el.status.classList.remove("import-active");
        el.status.removeEventListener("click", trigger);
      } catch (e) { setStatus("Fehler: Klick nötig!"); }
    };
    el.status.addEventListener("click", trigger);
  }
}

/* UI & BOOT */
async function renderShelf() {
  const books = await idbGetAll();
  if (!el.shelfList) return;
  el.shelfList.innerHTML = books.length ? "" : "Keine Bücher.";
  books.forEach(b => {
    const d = document.createElement("div"); d.className = "bookCard"; d.textContent = b.title;
    d.onclick = () => loadBookFromLibrary(b.id); el.shelfList.appendChild(d);
  });
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id); if(!b) return;
  S.words = b.words; S.idx = b.idx || 0; setStatus(`Geladen: ${b.title}`, { sticky: true });
  showCurrent();
}

const S = { words: [], idx: 0 };
function showCurrent() { if(S.words.length) el.word.textContent = S.words[S.idx]; }

(async function boot() {
  try { await renderShelf(); } catch(e){}
  await checkURLParams();
  if (!el.status.classList.contains("import-active")) {
    setStatus("Warte auf Datei…");
  }
})().catch(e => console.error(e));
