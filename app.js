/* =============================================================
   RSVP Reader - Speed Reading Tool
   (c) 2026 rundskp
   NON-COMMERCIAL USE ONLY
   ============================================================= */

console.log("%c[System]%c RSVP Reader v2.2 - Full Restored Version", "color: #7ee787", "color: inherit");

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
window.addEventListener('resize', setTopbarHeightVar);
window.addEventListener('DOMContentLoaded', setTopbarHeightVar);

const $ = (id) => document.getElementById(id);
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function show(x) { if (x) x.classList.remove("hidden"); }
function hide(x) { if (x) x.classList.add("hidden"); }

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
  donateBackdrop: $("donateBackdrop"), btnDonateClose: $("btnDonateClose")
};

/* -----------------------------
   Toast & Status (FIXED)
------------------------------ */
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
  // Verhindert, dass Systemmeldungen den Import-Balken überschreiben
  if (el.status.classList.contains("import-active") && !persist) return;

  if (!sticky) toast(msg, toastMs);
  el.status.textContent = msg;
  el.status.classList.toggle("import-active", !!persist); 
  
  if (_statusT) clearTimeout(_statusT);
  if (sticky && !persist) {
    _statusT = setTimeout(() => { if (el.status) el.status.textContent = ""; }, 4000);
  }
}

/* -----------------------------
   Storage (IndexedDB)
------------------------------ */
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
async function idbDelete(id) { const db = await idbOpen(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); }

/* -----------------------------
   Reader Logic
------------------------------ */
const S = {
  words: [], idx: 0, playing: false, timer: null, bookmarks: [],
  book: { id: null, title: "—", author: "—", chapters: [], toc: [] },
  settings: { wpm: 360, chunk: 1, orp: true, punct: true, punctMs: 200 }
};

function wordsFromText(t) { return String(t||"").replace(/\u00AD/g, "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean); }

function renderToken(token) {
  if (!S.settings.orp) { el.word.innerHTML = escapeHtml(token); return; }
  const m = token.match(/[A-Za-zÄÖÜäöüß0-9]+/);
  if (!m) { el.word.innerHTML = escapeHtml(token); return; }
  const seg = m[0], orpIdx = (l = seg.replace(/[^A-Za-zÄÖÜäöüß0-9]/g,"").length) <= 1 ? 0 : l <= 5 ? 1 : l <= 9 ? 2 : 3;
  const start = token.indexOf(seg);
  el.word.innerHTML = `${escapeHtml(token.slice(0, start))}${escapeHtml(seg.slice(0, orpIdx))}<span class="orp">${escapeHtml(seg.slice(orpIdx, orpIdx+1))}</span>${escapeHtml(seg.slice(orpIdx+1))}${escapeHtml(token.slice(start+seg.length))}`;
}

function escapeHtml(s) { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function showCurrent() {
  if (!S.words.length) return;
  const start = clamp(S.idx, 0, S.words.length - 1);
  renderToken(S.words.slice(start, start + S.settings.chunk).join(" "));
  updateProgressUI();
}

function updateProgressUI() {
  const total = S.words.length;
  if (el.prog) el.prog.textContent = total ? Math.round((S.idx/total)*100)+"%" : "0%";
  if (el.pos) el.pos.textContent = S.idx;
  if (el.total) el.total.textContent = total;
  if (el.seek) { el.seek.max = total; el.seek.value = S.idx; el.seek.disabled = !total; }
  if (el.btnPlay) el.btnPlay.disabled = !total;
}

function scheduleNext() {
  if (!S.playing || S.idx >= S.words.length) { stopPlayback(); return; }
  showCurrent();
  const token = S.words.slice(S.idx, S.idx + S.settings.chunk).join(" ");
  S.idx += S.settings.chunk;
  let delay = (60000 / S.settings.wpm) * S.settings.chunk;
  if (S.settings.punct && /[.!?]/.test(token)) delay += S.settings.punctMs;
  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;
  S.playing = !S.playing;
  el.btnPlay.textContent = S.playing ? "Pause" : "Play";
  if (S.playing) scheduleNext(); else if (S.timer) clearTimeout(S.timer);
}

function stopPlayback(reason = "") {
  S.playing = false; if (S.timer) clearTimeout(S.timer);
  el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
}

function step(delta) { stopPlayback(); S.idx = clamp(S.idx + (delta * S.settings.chunk), 0, S.words.length); showCurrent(); }

/* -----------------------------
   Library & EPUB
------------------------------ */
async function renderShelf() {
  const books = await idbGetAll(); if (!el.shelfList) return;
  el.shelfList.innerHTML = books.length ? "" : "Noch keine Bücher.";
  books.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0)).forEach(b => {
    const d = document.createElement("div"); d.className = "bookCard";
    d.innerHTML = `<div class="bookCardTop"><div class="t">${escapeHtml(b.title)}</div></div><img src="${b.coverDataUrl||''}" style="display:${b.coverDataUrl?'block':'none'}">`;
    d.onclick = () => loadBookFromLibrary(b.id); el.shelfList.appendChild(d);
  });
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id); if (!b) return;
  stopPlayback(); S.words = b.words; S.idx = b.idx || 0; S.book = b;
  showCurrent(); setStatus(`Geladen: ${b.title}`, { sticky: true });
}

async function handleFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "epub") {
    const book = ePub(await file.arrayBuffer()); await book.ready;
    const meta = await book.loaded.metadata;
    let txt = ""; const spine = book.spine.spineItems;
    for(const item of spine) { await item.load(book.load.bind(book)); txt += " " + item.document.body.textContent; item.unload(); }
    const obj = { id: 'b_'+Date.now(), title: meta.title, words: wordsFromText(txt), updatedAt: Date.now() };
    await idbPut(obj); await renderShelf(); await loadBookFromLibrary(obj.id);
  } else {
    const obj = { id: 'b_'+Date.now(), title: file.name, words: wordsFromText(await file.text()), updatedAt: Date.now() };
    await idbPut(obj); await renderShelf(); await loadBookFromLibrary(obj.id);
  }
}

/* -----------------------------
   Clipboard Import (REPAIRED)
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

/* -----------------------------
   UI & Bindings
------------------------------ */
function setTab(t) {
  el.tabToc.classList.toggle("active", t==="toc"); el.tabMarks.classList.toggle("active", t!=="toc");
  t==="toc" ? (show(el.tocPane), hide(el.marksPane)) : (hide(el.tocPane), show(el.marksPane));
}

function bindUI() {
  el.btnPlay?.addEventListener("click", togglePlay);
  el.btnBack?.addEventListener("click", () => step(-1));
  el.btnFwd?.addEventListener("click", () => step(1));
  el.file?.addEventListener("change", e => handleFile(e.target.files[0]));
  el.btnShelf?.addEventListener("click", () => el.shelf.classList.toggle("hidden"));
  el.tabToc?.addEventListener("click", () => setTab("toc"));
  el.tabMarks?.addEventListener("click", () => setTab("marks"));
  el.seek?.addEventListener("input", e => { S.idx = parseInt(e.target.value); showCurrent(); });
  el.btnSettings?.addEventListener("click", () => show(el.settingsModal));
  el.btnSettingsClose?.addEventListener("click", () => hide(el.settingsModal));
  el.btnSaveSettings?.addEventListener("click", () => {
    S.settings.wpm = parseInt(el.wpm.value); S.settings.chunk = parseInt(el.chunk.value); hide(el.settingsModal);
  });
}

/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  setTopbarHeightVar(); bindUI(); initDockPanels();
  try { await renderShelf(); } catch(e){}
  await checkURLParams(); // Prüft Clipboard-Link
  // Zeigt Standardmeldung nur, wenn kein Import aktiv ist
  if (!el.status.classList.contains("import-active")) {
    setStatus("Warte auf Datei…");
  }
})().catch(e => console.error(e));

// Ende der Datei - HIER DARF NICHTS MEHR STEHEN!
