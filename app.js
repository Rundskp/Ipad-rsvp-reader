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

console.log("%c[System]%c RSVP Reader v2.2 - Non-Commercial Edition", "color: #7ee787", "color: inherit");
console.log("%c[Legal]%c (c) 2026 rundskp. No derivatives allowed. Do not redistribute modified versions.", "color: #ff4d4d; font-weight: bold;", "color: inherit");

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
  stopMinsOn: $("stopMinsOn"),
  stopMins: $("stopMins"),
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
      if (el.status) {
        el.status.textContent = ""; 
        el.status.classList.remove("import-active");
      }
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
    if (already) return { ok: true, persisted: true };
    const granted = await navigator.storage.persist();
    return { ok: true, persisted: granted };
  } catch (e) { return { ok: false }; }
}

const DB_NAME = "rsvp_reader_db", STORE = "books";
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await idbOpen();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
}

async function idbPut(bookObj) {
  const db = await idbOpen();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(bookObj);
}

async function idbGet(id) {
  const db = await idbOpen();
  const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
  return new Promise(r => req.onsuccess = () => r(req.result || null));
}

async function idbGetAll() {
  const db = await idbOpen();
  const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
  return new Promise(r => req.onsuccess = () => r(req.result || []));
}

function wordsFromText(txt) {
  const cleaned = String(txt || "").replace(/\u00AD/g, "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.split(" ").filter(Boolean) : [];
}

/* -----------------------------
   Export/Import
------------------------------ */
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

async function exportLibrary({ mode }) {
  const all = await idbGetAll();
  if (!all.length) { setStatus("Bibliothek leer."); return; }
  let books = all;
  if (mode === "selected") {
    const picked = [...document.querySelectorAll(".bookPick:checked")].map(cb => cb.dataset.id);
    books = all.filter(b => picked.includes(b.id));
  }
  const payload = { format: "rsvp-library", books: books };
  downloadTextFile(`rsvp_library_${Date.now()}.json`, JSON.stringify(payload));
}

async function importLibraryFromJsonFile(file) {
  try {
    const p = JSON.parse(await file.text());
    for (const b of p.books) await idbPut(b);
    await renderShelf(); setStatus("Import fertig ✅");
  } catch (e) { setStatus("Import-Fehler"); }
}

async function deleteSelectedFromLibrary() {
  const ids = [...document.querySelectorAll(".bookPick:checked")].map(cb => cb.dataset.id);
  if (!ids.length || !confirm("Löschen?")) return;
  for (const id of ids) await idbDelete(id);
  await renderShelf(); setStatus("Gelöscht.");
}

/* -----------------------------
   Reader State & Logic
------------------------------ */
const LS_KEY = "rsvp_reader_v2_settings";
const S = {
  words: [], idx: 0, playing: false, timer: null,
  book: { id: null, title: "—", author: "—", coverDataUrl: "", chapters: [], toc: [] },
  bookmarks: [], playStartedAt: 0, wordsAtPlayStart: 0, pendingStop: false,
  settings: { wpm: 360, chunk: 1, orp: true, punct: true, punctMs: 200, stopChapter: false, stopWordsOn: false, stopWords: 2000, stopMinsOn: false, stopMins: 10 }
};

function escapeHtml(s) { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function renderToken(token) {
  if (!S.settings.orp) { el.word.innerHTML = escapeHtml(token); return; }
  const m = token.match(/[A-Za-zÄÖÜäöüß0-9]+/);
  if (!m) { el.word.innerHTML = escapeHtml(token); return; }
  const seg = m[0], orpIdx = (l = seg.replace(/[^A-Za-zÄÖÜäöüß0-9]/g,"").length) <= 1 ? 0 : l <= 5 ? 1 : l <= 9 ? 2 : 3;
  const start = token.indexOf(seg);
  el.word.innerHTML = `${escapeHtml(token.slice(0, start))}${escapeHtml(seg.slice(0, orpIdx))}<span class="orp">${escapeHtml(seg.slice(orpIdx, orpIdx+1))}</span>${escapeHtml(seg.slice(orpIdx+1))}${escapeHtml(token.slice(start+seg.length))}`;
}

function updateProgressUI() {
  const total = S.words.length;
  const cur = clamp(S.idx, 0, total);
  if (el.prog) el.prog.textContent = total ? Math.round((cur/total)*100)+"%" : "0%";
  if (el.pos) el.pos.textContent = cur;
  if (el.total) el.total.textContent = total;
  if (el.seek) { el.seek.max = total; el.seek.value = cur; el.seek.disabled = !total; }
  if (el.btnPlay) el.btnPlay.disabled = !total;
}

function showCurrent() {
  if (!S.words.length) { el.word.textContent = "—"; updateProgressUI(); return; }
  const token = S.words.slice(S.idx, S.idx + S.settings.chunk).join(" ");
  renderToken(token); updateProgressUI();
}

function scheduleNext() {
  if (!S.playing) return;
  if (S.idx >= S.words.length) { stopPlayback("Ende ✅"); return; }
  const token = S.words.slice(S.idx, S.idx + S.settings.chunk).join(" ");
  renderToken(token);
  S.idx += S.settings.chunk;
  updateProgressUI();
  if (S.pendingStop && /[.!?]/.test(token)) { stopPlayback("Auto-Stop ✅"); return; }
  let delay = (60000 / S.settings.wpm) * S.settings.chunk;
  if (S.settings.punct && /[.!?]/.test(token)) delay += S.settings.punctMs;
  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;
  if (S.playing) { stopPlayback(); return; }
  S.playing = true; S.pendingStop = false;
  el.btnPlay.textContent = "Pause";
  S.playStartedAt = Date.now(); S.wordsAtPlayStart = S.idx;
  scheduleNext();
}

function stopPlayback(reason = "") {
  S.playing = false; if (S.timer) clearTimeout(S.timer);
  el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
  persistCurrentBookState();
}

function step(delta) {
  stopPlayback();
  S.idx = clamp(S.idx + (delta * S.settings.chunk), 0, S.words.length);
  showCurrent();
}

/* -----------------------------
   Library & EPUB
------------------------------ */
async function renderShelf() {
  const all = await idbGetAll();
  if (!el.shelfList) return;
  el.shelfList.innerHTML = "";
  all.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0)).forEach(b => {
    const d = document.createElement("div"); d.className = "bookCard";
    d.innerHTML = `<div class="bookCardTop"><input type="checkbox" class="bookPick" data-id="${b.id}"><div class="t">${escapeHtml(b.title)}</div></div><img src="${b.coverDataUrl||''}" style="display:${b.coverDataUrl?'block':'none'}"><div class="a">${escapeHtml(b.author)}</div>`;
    d.onclick = () => loadBookFromLibrary(b.id);
    el.shelfList.appendChild(d);
  });
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id); if (!b) return;
  stopPlayback(); S.book = b; S.words = b.words || []; S.idx = b.idx || 0; S.bookmarks = b.bookmarks || [];
  if (el.bookTitle) el.bookTitle.textContent = b.title;
  if (el.bookAuthor) el.bookAuthor.textContent = b.author;
  if (el.coverImg) { el.coverImg.src = b.coverDataUrl; el.coverImg.style.display = b.coverDataUrl ? "block" : "none"; }
  renderToc(); renderBookmarks(); showCurrent(); setStatus(`Geladen: ${b.title}`, { sticky: true });
}

async function persistCurrentBookState() {
  if (!S.book.id) return;
  const b = await idbGet(S.book.id);
  if (b) { b.idx = S.idx; b.bookmarks = S.bookmarks; b.updatedAt = Date.now(); await idbPut(b); }
}

async function handleFile(file) {
  setStatus("Lade Datei...");
  const ext = file.name.split(".").pop().toLowerCase();
  let bookObj;
  if (ext === "epub") bookObj = await loadEpubFromFile(file);
  else bookObj = { id: 'b_'+Date.now(), title: file.name, words: wordsFromText(await file.text()) };
  await idbPut(bookObj); await renderShelf(); await loadBookFromLibrary(bookObj.id);
}

async function loadEpubFromFile(file) {
  const book = ePub(await file.arrayBuffer());
  await book.ready;
  const meta = await book.loaded.metadata;
  let allText = "";
  const spine = book.spine.spineItems;
  for (const item of spine) {
    await item.load(book.load.bind(book));
    allText += " " + item.document.body.textContent;
    item.unload();
  }
  return { id: 'b_'+Date.now(), title: meta.title, author: meta.creator, words: wordsFromText(allText), updatedAt: Date.now() };
}

/* -----------------------------
   Web Import
------------------------------ */
async function importUrlIntoReader(url) {
  stopPlayback(); setStatus("Importiere Webseite...", { sticky: true });
  try {
    const res = await fetch("https://r.jina.ai/" + url);
    const txt = await res.text();
    const id = 'web_' + Date.now();
    const book = { id, title: url, words: wordsFromText(txt), updatedAt: Date.now() };
    await idbPut(book); await renderShelf(); await loadBookFromLibrary(id);
  } catch (e) { setStatus("Fehler beim Import."); }
}

async function checkURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('import') === 'clipboard') {
    window.history.replaceState({}, "", window.location.pathname);
    setStatus("📥 Hier tippen zum Importieren", { sticky: true, persist: true });
    const trigger = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return setStatus("Clipboard leer!");
        const id = 'clip_' + Date.now();
        const book = { id, title: p.get('title') || 'Web Import', words: wordsFromText(text), createdAt: Date.now(), updatedAt: Date.now() };
        await idbPut(book); await renderShelf(); await loadBookFromLibrary(id);
        setStatus("Import erfolgreich ✅");
        el.status.classList.remove("import-active");
        el.status.removeEventListener("click", trigger);
      } catch (e) { setStatus("Fehler: Klick nötig!"); }
    };
    el.status.addEventListener("click", trigger);
  }
}

async function importFromShareParam() {
  const url = new URLSearchParams(window.location.search).get("import_url");
  if (url) { await importUrlIntoReader(url); return true; }
  return false;
}

/* -----------------------------
   UI Tabs & Modal
------------------------------ */
function setTab(t) {
  el.tabToc.classList.toggle("active", t==="toc"); el.tabMarks.classList.toggle("active", t!=="toc");
  t==="toc" ? (show(el.tocPane), hide(el.marksPane)) : (hide(el.tocPane), show(el.marksPane));
}
function renderToc() { el.tocList.innerHTML = "Kein Index."; }
function renderBookmarks() { el.marksList.innerHTML = S.bookmarks.length ? "" : "Keine."; }

/* -----------------------------
   Settings
------------------------------ */
function saveSettingsToLS() { localStorage.setItem(LS_KEY, JSON.stringify(S.settings)); }
function loadSettingsFromLS() { const r = localStorage.getItem(LS_KEY); if (r) S.settings = {...S.settings, ...JSON.parse(r)}; }
function applySettingsToUI() {
  el.wpm.value = S.settings.wpm; el.wpmSettingVal.textContent = S.settings.wpm;
  el.chunk.value = S.settings.chunk; el.chunkVal.textContent = S.settings.chunk;
  el.orp.checked = S.settings.orp; el.punct.checked = S.settings.punct;
  el.punctMs.value = S.settings.punctMs; el.punctVal.textContent = S.settings.punctMs;
}

/* -----------------------------
   Bindings & Boot
------------------------------ */
function bindUI() {
  el.btnPlay?.addEventListener("click", togglePlay);
  el.btnBack?.addEventListener("click", () => step(-1));
  el.btnFwd?.addEventListener("click", () => step(1));
  el.file?.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  el.btnShelf?.addEventListener("click", () => el.shelf.classList.toggle("hidden"));
  el.btnSettings?.addEventListener("click", () => show(el.settingsModal));
  el.btnSettingsClose?.addEventListener("click", () => hide(el.settingsModal));
  el.btnSaveSettings?.addEventListener("click", () => {
    S.settings.wpm = parseInt(el.wpm.value); S.settings.chunk = parseInt(el.chunk.value);
    S.settings.orp = el.orp.checked; S.settings.punct = el.punct.checked;
    S.settings.punctMs = parseInt(el.punctMs.value); saveSettingsToLS(); hide(el.settingsModal);
  });
  el.tabToc?.addEventListener("click", () => setTab("toc"));
  el.tabMarks?.addEventListener("click", () => setTab("marks"));
  el.seek?.addEventListener("input", e => { S.idx = parseInt(e.target.value); showCurrent(); });
}

function initDockPanels() { /* Bereits in bindUI integriert */ }

(async function boot() {
  setTopbarHeightVar(); bindUI(); loadSettingsFromLS(); applySettingsToUI();
  setTab("toc"); updateProgressUI(); showCurrent();
  try { await renderShelf(); } catch(e){}
  await checkURLParams();
  const shared = await importFromShareParam();
  if (el.status && !el.status.classList.contains("import-active") && !shared) {
    setStatus("Warte auf Datei…");
  }
})().catch(e => console.error(e));
