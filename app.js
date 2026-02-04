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

/* ---------- Elements (must exist) ---------- */
const el = {
  file: $("file"),
  status: $("status"),

  // Header info (toggle via btnHeader)
  headerInfo: $("headerInfo"),
  coverImg: $("coverImg"),
  bookTitle: $("bookTitle"),
  bookAuthor: $("bookAuthor"),
  prog: $("prog"),
  wpmVal: $("wpmVal"),
  chapVal: $("chapVal"),

  // Reader
  display: $("display"),
  word: $("word"),
  btnPlay: $("btnPlay"),
  btnBack: $("btnBack"),
  btnFwd: $("btnFwd"),
  btnBookmark: $("btnBookmark"),
  seek: $("seek"),
  pos: $("pos"),
  total: $("total"),

  // Top buttons
  btnSidebar: $("btnSidebar"),
  btnHeader: $("btnHeader"),
  btnSettings: $("btnSettings"),
  btnShelf: $("btnShelf"),
  btnHelp: $("btnHelp"),
  btnDonate: $("btnDonate"),

  // Export / Import (Shelf)
  btnExportAll: $("btnExportAll"),
  importFile: $("importFile"),
  btnDeleteSelected: $("btnDeleteSelected"),
  btnSelectAll: $("btnSelectAll"),

  // Sidebar (dock)
  sidebar: $("sidebar"),
  tabToc: $("tabToc"),
  tabMarks: $("tabMarks"),
  tocPane: $("tocPane"),
  marksPane: $("marksPane"),
  tocList: $("tocList"),
  marksList: $("marksList"),
  btnSidebarCloseMobile: $("btnSidebarCloseMobile"),

  // Settings (popover)
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

  // Shelf (dock)
  shelf: $("shelf"),
  shelfList: $("shelfList"),

  // Help (popover)
  helpBackdrop: $("helpBackdrop"),
  helpBody: $("helpBody"),
  btnHelpClose: $("btnHelpClose"),

  // Donate (popover)
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
   Toast + Status
   - sticky: bleibt stehen bis du was anderes setzt
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

function setStatus(msg, { sticky = false, toastMs = 1400 } = {}) {
  // Geladen-Meldungen NIE sticky, sonst pickt's ewig.
  if (sticky && typeof msg === "string" && msg.startsWith("Geladen:")) {
  sticky = false;
  }
  if (!el.status) return;

  if (sticky) {
    // NUR Status, bleibt stehen
    el.status.textContent = msg || "";
    return;
  }

  // Toast + Status kurz
  if (msg) toast(msg, toastMs);
  el.status.textContent = msg || "";

  // Auto-clear nach kurzer Zeit (nur bei non-sticky)
  setTimeout(() => {
    if (el.status && el.status.textContent === msg) el.status.textContent = "";
  }, 2200);
}

/* -----------------------------
   DEBUG: missing IDs
------------------------------ */
(() => {
  const missing = Object.entries(el)
    .filter(([k, v]) => !v)
    .map(([k]) => k);
  if (missing.length) console.warn("Missing DOM IDs:", missing);
})();

/* -----------------------------
   Storage persistence (iOS)
------------------------------ */
async function ensurePersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return { ok: false, reason: "no_api" };
    const already = await navigator.storage.persisted?.();
    if (already) return { ok: true, persisted: true };
    const granted = await navigator.storage.persist();
    return { ok: true, persisted: granted };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

/* -----------------------------
   IndexedDB
------------------------------ */
const DB_NAME = "rsvp_reader_db";
const DB_VER = 1;
const STORE = "books";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbPut(bookObj) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(bookObj);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/* -----------------------------
   Export/Import helpers
------------------------------ */
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function exportLibrary({ mode }) {
  const all = await idbGetAll();
  if (!all.length) { setStatus("Nix zu exportieren (Bibliothek leer)."); return; }

  let books = all;

  if (mode === "selected") {
    const picked = [...document.querySelectorAll(".bookPick")]
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute("data-id"));
    books = all.filter(b => picked.includes(b.id));
    if (!books.length) { setStatus("Keine Auswahl getroffen."); return; }
  }

  const payload = {
    format: "rsvp-library",
    version: 1,
    exportedAt: Date.now(),
    settings: S.settings,
    books: books.map(b => ({
      id: b.id,
      title: b.title || "",
      author: b.author || "",
      coverDataUrl: b.coverDataUrl || "",
      words: b.words || [],
      chapters: b.chapters || [],
      toc: b.toc || [],
      idx: Number.isFinite(b.idx) ? b.idx : 0,
      bookmarks: b.bookmarks || [],
      createdAt: b.createdAt || Date.now(),
      updatedAt: b.updatedAt || Date.now(),
    })),
  };

  const name = `rsvp_library_${mode}_${nowStamp()}.json`;
  downloadTextFile(name, JSON.stringify(payload));
  setStatus(`Export fertig ✅ (${books.length} Buch/Bücher)`);
}

function toggleSelectAllBooks() {
  const checkboxes = document.querySelectorAll(".bookPick");
  if (!checkboxes.length) return;

  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => cb.checked = !allChecked);

  if (el.btnSelectAll) {
    el.btnSelectAll.textContent = allChecked ? "Alle auswählen" : "Auswahl aufheben";
  }
}

async function deleteSelectedFromLibrary() {
  const checkboxes = document.querySelectorAll(".bookPick:checked");
  const ids = Array.from(checkboxes).map(cb => cb.getAttribute("data-id"));

  if (ids.length === 0) {
    setStatus("Keine Auswahl zum Löschen getroffen.");
    return;
  }

  if (confirm(`${ids.length} Buch/Bücher wirklich dauerhaft löschen?`)) {
    for (const id of ids) {
      await idbDelete(id);
      if (S.book.id === id) {
        S.book.id = null;
        S.words = [];
        S.idx = 0;
        showCurrent();
        syncHeaderUI();
      }
    }
    await renderShelf();
    setStatus(`${ids.length} Buch/Bücher gelöscht.`);
  }
}

function validateImportPayload(p) {
  if (!p || typeof p !== "object") return "Keine gültige JSON-Struktur.";
  if (p.format !== "rsvp-library") return "Falsches Format (nicht rsvp-library).";
  if (!Array.isArray(p.books)) return "Import: 'books' fehlt oder ist kein Array.";
  return null;
}

async function importLibraryFromJsonFile(file) {
  try {
    const txt = await file.text();
    const p = JSON.parse(txt);
    const err = validateImportPayload(p);
    if (err) throw new Error(err);

    if (p.settings && typeof p.settings === "object") {
      S.settings = { ...S.settings, ...p.settings };
      saveSettingsToLS();
      applySettingsToUI();
    }

    let count = 0;
    for (const b of p.books) {
      if (!b?.id || !Array.isArray(b?.words)) continue;

      await idbPut({
        id: b.id,
        title: b.title || "",
        author: b.author || "",
        coverDataUrl: b.coverDataUrl || "",
        words: b.words,
        chapters: b.chapters || [],
        toc: b.toc || [],
        idx: Number.isFinite(b.idx) ? b.idx : 0,
        bookmarks: Array.isArray(b.bookmarks) ? b.bookmarks : [],
        createdAt: b.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
      count++;
    }

    await renderShelf();
    setStatus(`Import fertig ✅ (${count} Buch/Bücher)`);
  } catch (e) {
    console.error(e);
    setStatus(`Import-Fehler: ${e?.message || e}`);
  }
}

/* -----------------------------
   State / Settings
------------------------------ */
const LS_KEY = "rsvp_reader_v2_settings";

const S = {
  words: [],
  idx: 0,
  playing: false,
  timer: null,

  book: {
    id: null,
    title: "—",
    author: "—",
    coverDataUrl: "",
    chapters: [],
    toc: [],
  },

  bookmarks: [],

  playStartedAt: 0,
  wordsAtPlayStart: 0,
  pendingStop: false,

  settings: {
    wpm: 360,
    chunk: 1,
    orp: true,
    punct: true,
    punctMs: 200,

    stopChapter: false,
    stopWordsOn: false,
    stopWords: 2000,
    stopMinsOn: false,
    stopMins: 10,
  },
};

/* -----------------------------
   Text utils
------------------------------ */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortText(s, max = 60) {
  s = String(s || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function wordsFromText(txt) {
  const cleaned = String(txt || "")
    .replace(/\u00AD/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned.split(" ").filter(Boolean);
}

function isSentenceEnd(token) { return /[.!?…。！？]/.test(token); }
function isPunctHeavy(token) { return /[.!?…。！？;:]/.test(token) || /[,，]/.test(token); }

function msPerToken(baseWpm, chunkSize) {
  const msPerWord = 60000 / baseWpm;
  return msPerWord * chunkSize;
}

function computeOrpIndex(word) {
  const w = word.replace(/[^A-Za-zÄÖÜäöüß0-9]/g, "");
  const len = w.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

function renderToken(token) {
  if (!S.settings.orp) {
    el.word.innerHTML = escapeHtml(token);
    return;
  }
  const m = token.match(/[A-Za-zÄÖÜäöüß0-9]+/);
  if (!m) {
    el.word.innerHTML = escapeHtml(token);
    return;
  }
  const seg = m[0];
  const segStart = token.indexOf(seg);
  const orpIdx = computeOrpIndex(seg);

  const before = escapeHtml(token.slice(0, segStart));
  const segBefore = escapeHtml(seg.slice(0, orpIdx));
  const segOrp = escapeHtml(seg.slice(orpIdx, orpIdx + 1));
  const segAfter = escapeHtml(seg.slice(orpIdx + 1));
  const after = escapeHtml(token.slice(segStart + seg.length));

  el.word.innerHTML = `${before}${segBefore}<span class="orp">${segOrp}</span>${segAfter}${after}`;
}

/* -----------------------------
   Settings save/load
------------------------------ */
function saveSettingsToLS() {
  localStorage.setItem(LS_KEY, JSON.stringify(S.settings));
}

function loadSettingsFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && typeof p === "object") S.settings = { ...S.settings, ...p };
  } catch {}
}

function applySettingsToUI() {
  if (!el.wpm) return;

  el.wpm.value = String(S.settings.wpm);
  el.wpmVal.textContent = String(S.settings.wpm);
  if (el.wpmSettingVal) el.wpmSettingVal.textContent = String(S.settings.wpm);

  el.chunk.value = String(S.settings.chunk);
  el.chunkVal.textContent = String(S.settings.chunk);

  el.orp.checked = !!S.settings.orp;
  el.punct.checked = !!S.settings.punct;

  el.punctMs.value = String(S.settings.punctMs);
  el.punctVal.textContent = String(S.settings.punctMs);

  el.stopChapter.checked = !!S.settings.stopChapter;
  el.stopWordsOn.checked = !!S.settings.stopWordsOn;
  el.stopWords.value = String(S.settings.stopWords);
  el.stopMinsOn.checked = !!S.settings.stopMinsOn;
  el.stopMins.value = String(S.settings.stopMins);

  syncHeaderUI();
}

function readSettingsFromUI() {
  S.settings.wpm = Number(el.wpm.value);
  S.settings.chunk = Number(el.chunk.value);
  S.settings.orp = el.orp.checked;
  S.settings.punct = el.punct.checked;
  S.settings.punctMs = Number(el.punctMs.value);

  S.settings.stopChapter = el.stopChapter.checked;
  S.settings.stopWordsOn = el.stopWordsOn.checked;
  S.settings.stopWords = Number(el.stopWords.value || 0);
  S.settings.stopMinsOn = el.stopMinsOn.checked;
  S.settings.stopMins = Number(el.stopMins.value || 0);
}

/* -----------------------------
   Header + progress
------------------------------ */
function syncHeaderUI() {
  if (el.bookTitle) el.bookTitle.textContent = S.book.title || "—";
  if (el.bookAuthor) el.bookAuthor.textContent = S.book.author || "—";
  if (el.coverImg) {
    if (S.book.coverDataUrl) {
      el.coverImg.src = S.book.coverDataUrl;
      el.coverImg.style.display = "block";
    } else {
      el.coverImg.style.display = "none";
    }
  }
}

function getChapterByWordIndex(idx) {
  for (const ch of (S.book.chapters || [])) {
    if (idx >= ch.start && idx < ch.end) return ch;
  }
  return null;
}

function updateProgressUI() {
  const total = S.words.length;
  const idx = clamp(S.idx, 0, Math.max(0, total - 1));
  const pct = total ? Math.round((idx / total) * 100) : 0;

  if (el.prog) el.prog.textContent = `${pct}%`;
  if (el.pos) el.pos.textContent = String(idx);
  if (el.total) el.total.textContent = String(total);

  if (el.seek) {
    el.seek.max = String(Math.max(0, total - 1));
    el.seek.value = String(idx);
    el.seek.disabled = total === 0;
  }

  const ch = getChapterByWordIndex(idx);
  if (el.chapVal) el.chapVal.textContent = ch?.label || "—";

  if (el.btnPlay) el.btnPlay.disabled = total === 0;
  if (el.btnBack) el.btnBack.disabled = total === 0;
  if (el.btnFwd) el.btnFwd.disabled = total === 0;
  if (el.btnBookmark) el.btnBookmark.disabled = total === 0;
}

function showCurrent() {
  if (!S.words.length) {
    if (el.word) el.word.textContent = "—";
    updateProgressUI();
    return;
  }
  const chunk = S.settings.chunk;
  const start = clamp(S.idx, 0, S.words.length - 1);
  const end = clamp(start + chunk, start, S.words.length);
  const token = S.words.slice(start, end).join(" ");
  renderToken(token);
  updateProgressUI();
}

/* -----------------------------
   Playback
------------------------------ */
function stopPlayback(reason = "") {
  S.playing = false;
  if (S.timer) clearTimeout(S.timer);
  S.timer = null;
  S.pendingStop = false;
  if (el.btnPlay) el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
  persistCurrentBookState().catch(()=>{});
}

function checkAutoStop(currentToken, nextIdxAfterAdvance) {
  if (S.pendingStop) return isSentenceEnd(currentToken);

  if (S.settings.stopMinsOn && S.playStartedAt) {
    const elapsedMs = Date.now() - S.playStartedAt;
    const limitMs = S.settings.stopMins * 60 * 1000;
    if (limitMs > 0 && elapsedMs >= limitMs) S.pendingStop = true;
  }

  if (S.settings.stopWordsOn) {
    const limit = S.settings.stopWords;
    if (limit > 0) {
      const readWords = nextIdxAfterAdvance - S.wordsAtPlayStart;
      if (readWords >= limit) S.pendingStop = true;
    }
  }

  if (S.settings.stopChapter) {
    const ch = getChapterByWordIndex(nextIdxAfterAdvance);
    const prevCh = getChapterByWordIndex(nextIdxAfterAdvance - 1);
    if (prevCh && ch && prevCh.href !== ch.href) S.pendingStop = true;
  }

  return (S.pendingStop && isSentenceEnd(currentToken));
}

function scheduleNext() {
  if (!S.playing) return;

  const total = S.words.length;
  if (!total) { stopPlayback(); return; }

  const chunk = S.settings.chunk;
  const start = S.idx;
  const end = clamp(start + chunk, start, total);

  const token = S.words.slice(start, end).join(" ");
  renderToken(token);
  updateProgressUI();

  S.idx = end;

  if (checkAutoStop(token, S.idx)) {
    stopPlayback("Auto-Stop ✅");
    return;
  }

  let delay = msPerToken(S.settings.wpm, chunk);
  if (S.settings.punct && isPunctHeavy(token)) delay += S.settings.punctMs;

  if (end >= total) {
    stopPlayback("Ende ✅");
    return;
  }
  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;

  if (S.playing) { stopPlayback(); return; }

  S.playing = true;
  S.pendingStop = false;
  if (el.btnPlay) el.btnPlay.textContent = "Pause";
  S.playStartedAt = Date.now();
  S.wordsAtPlayStart = S.idx;
  scheduleNext();
}

function step(deltaChunks) {
  if (!S.words.length) return;
  stopPlayback();
  const delta = deltaChunks * S.settings.chunk;
  S.idx = clamp(S.idx + delta, 0, Math.max(0, S.words.length - 1));
  showCurrent();
  persistCurrentBookState().catch(()=>{});
}

function resetPosition() {
  stopPlayback();
  S.idx = 0;
  showCurrent();
  persistCurrentBookState().catch(()=>{});
}

/* -----------------------------
   Bookmarks
------------------------------ */
function makeBookmarkLabel() {
  const ch = getChapterByWordIndex(S.idx);
  const chName = ch?.label ? ` – ${ch.label}` : "";
  return `#${S.idx}${chName}`;
}

function addBookmarkAtCurrent() {
  const id = `m_${Date.now()}`;
  const bm = { id, label: makeBookmarkLabel(), idx: S.idx, createdAt: Date.now() };
  S.bookmarks.unshift(bm);
  renderBookmarks();
  persistCurrentBookState().catch(()=>{});
  setStatus("Lesezeichen gesetzt 🔖");
}

function jumpToIndex(idx) {
  stopPlayback();
  S.idx = clamp(idx, 0, Math.max(0, S.words.length - 1));
  showCurrent();
  persistCurrentBookState().catch(()=>{});
}

function renderBookmarks() {
  if (!el.marksList) return;

  if (!S.bookmarks.length) {
    el.marksList.classList.add("muted");
    el.marksList.textContent = "Keine Lesezeichen.";
    return;
  }
  el.marksList.classList.remove("muted");
  el.marksList.innerHTML = "";
  for (const bm of S.bookmarks) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div><b>${escapeHtml(bm.label)}</b></div><div class="small">Wort #${bm.idx}</div>`;
    div.addEventListener("click", () => jumpToIndex(bm.idx));
    el.marksList.appendChild(div);
  }
}

/* -----------------------------
   TOC
------------------------------ */
function setTab(which) {
  if (!el.tabToc || !el.tabMarks || !el.tocPane || !el.marksPane) return;

  if (which === "toc") {
    el.tabToc.classList.add("active");
    el.tabMarks.classList.remove("active");
    show(el.tocPane);
    hide(el.marksPane);
  } else {
    el.tabMarks.classList.add("active");
    el.tabToc.classList.remove("active");
    show(el.marksPane);
    hide(el.tocPane);
  }
}

function renderToc() {
  if (!el.tocList) return;

  const toc = S.book.toc || [];
  if (!toc.length) {
    el.tocList.classList.add("muted");
    el.tocList.textContent = "Kein Kapitelindex gefunden.";
    return;
  }
  el.tocList.classList.remove("muted");
  el.tocList.innerHTML = "";

  const hrefToStart = new Map();
  for (const ch of (S.book.chapters || [])) hrefToStart.set(ch.href, ch.start);

  for (const t of toc) {
    const start = hrefToStart.get(t.href) ?? null;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div><b>${escapeHtml(t.label || t.href)}</b></div><div class="small">${start !== null ? `Wort #${start}` : "Kapitel"}</div>`;
    div.addEventListener("click", () => {
      if (start !== null) jumpToIndex(start);
    });
    el.tocList.appendChild(div);
  }
}

/* -----------------------------
   Library (persist)
------------------------------ */
function stableBookId(file) {
  return `b_${file.name}_${file.size}_${file.type || "bin"}`;
}

async function persistCurrentBookState() {
  if (!S.book.id) return;
  try {
    const existing = await idbGet(S.book.id);
    if (!existing) return;
    existing.idx = S.idx;
    existing.bookmarks = S.bookmarks;
    existing.updatedAt = Date.now();
    await idbPut(existing);
  } catch (e) {
    console.error("persistCurrentBookState failed", e);
  }
}

async function saveBookToLibrary(bookObj) {
  await ensurePersistentStorage();
  await idbPut(bookObj);
  await renderShelf();
}

async function renderShelf() {
  if (el.btnSelectAll) el.btnSelectAll.textContent = "Alle auswählen";
  try {
    if (!el.shelfList) return;

    el.shelfList.textContent = "";
    el.shelfList.classList.remove("muted");

    const all = await idbGetAll();

    const byId = new Map();
    for (const b of all) {
      if (!b?.id) continue;
      const prev = byId.get(b.id);
      const prevT = (prev?.updatedAt || prev?.createdAt || 0);
      const curT  = (b.updatedAt || b.createdAt || 0);
      if (!prev || curT >= prevT) byId.set(b.id, b);
    }

    const books = [...byId.values()]
      .sort((a,b) => (b.updatedAt||b.createdAt||0) - (a.updatedAt||a.createdAt||0));

    if (!books.length) {
      el.shelfList.classList.add("muted");
      el.shelfList.textContent = "Noch keine Bücher gespeichert.";
      return;
    }

    const frag = document.createDocumentFragment();

    for (const b of books) {
      const card = document.createElement("div");
      card.className = "bookCard";

      const top = document.createElement("div");
      top.className = "bookCardTop";

      const pick = document.createElement("input");
      pick.type = "checkbox";
      pick.className = "bookPick";
      pick.setAttribute("data-id", b.id);

      const t = document.createElement("div");
      t.className = "t";
      t.textContent = b.title || "—";
      card.title = b.title || "";

      top.appendChild(pick);
      top.appendChild(t);

      const img = document.createElement("img");
      img.alt = "Cover";
      img.src = b.coverDataUrl || "";
      img.style.display = b.coverDataUrl ? "block" : "none";

      const a = document.createElement("div");
      a.className = "a";
      a.textContent = b.author || "";

      card.appendChild(top);
      card.appendChild(img);
      card.appendChild(a);

      pick.addEventListener("click", (ev) => ev.stopPropagation());
      card.addEventListener("click", async () => { await loadBookFromLibrary(b.id); });

      frag.appendChild(card);
    }

    el.shelfList.appendChild(frag);
  } catch (e) {
    console.error("renderShelf failed", e);
    if (!el.shelfList) return;
    el.shelfList.textContent = "";
    el.shelfList.classList.add("muted");
    el.shelfList.textContent = "Bibliothek kann nicht geladen werden (IndexedDB blockiert?).";
  }
}

async function loadBookFromLibrary(id) {
  const b = await idbGet(id);
  if (!b) { setStatus("Buch nicht gefunden."); return; }

  stopPlayback();
  S.book.id = b.id;
  S.book.title = b.title || "—";
  S.book.author = b.author || "—";
  S.book.coverDataUrl = b.coverDataUrl || "";
  S.book.chapters = b.chapters || [];
  S.book.toc = b.toc || [];

  S.words = b.words || [];
  S.idx = clamp(b.idx || 0, 0, Math.max(0, S.words.length - 1));
  S.bookmarks = b.bookmarks || [];

  syncHeaderUI();
  renderToc();
  renderBookmarks();
  updateProgressUI();
  showCurrent();

  setStatus(`Geladen: ${shortText(S.book.title)} (${S.words.length} Wörter)`, { sticky: false, toastMs: 1200 });
}

/* -----------------------------
   EPUB extraction (robust)
------------------------------ */
function isNavItem(item) {
  const props = item?.properties;
  if (!props) return false;
  if (Array.isArray(props)) return props.includes("nav");
  return String(props).includes("nav");
}
function looksLikeHtmlItem(item) {
  const href = String(item?.href || "").toLowerCase();
  const mt = String(item?.mediaType || "").toLowerCase();
  return mt.includes("html") || href.endsWith(".xhtml") || href.endsWith(".html");
}
function cleanDocText(doc) {
  try { doc.querySelectorAll("script,style,noscript,svg,math,iframe").forEach(n => n.remove()); } catch {}
  let txt = "";
  if (doc?.body?.textContent) txt = doc.body.textContent;
  else if (doc?.documentElement?.textContent) txt = doc.documentElement.textContent;
  return String(txt || "").replace(/\s+/g, " ").trim();
}
function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(blob);
  });
}
async function extractCoverDataUrl(book) {
  try {
    const url = await book.coverUrl();
    if (!url) return "";
    const res = await fetch(url);
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
}

async function loadEpubFromFile(file) {
  if (typeof window.ePub !== "function") throw new Error("EPUB Engine (epub.js) nicht geladen.");

  setStatus("Lade EPUB…", { sticky: true });
  const buf = await file.arrayBuffer();

  const book = ePub(buf);
  await book.ready;

  let title = file.name;
  let author = "";
  try {
    const md = await book.loaded.metadata;
    title = md?.title || title;
    author = md?.creator || md?.author || "";
  } catch {}

  const coverDataUrl = await extractCoverDataUrl(book);

  let toc = [];
  try {
    const nav = await book.loaded.navigation;
    toc = (nav?.toc || []).map(x => ({ label: x.label, href: (x.href || "").split("#")[0] }));
  } catch {}

  const spine = book.spine?.spineItems || [];
  if (!spine.length) throw new Error("EPUB: Keine Spine-Items gefunden.");

  const chapters = [];
  const allParts = [];
  let wordCursor = 0;
  let kept = 0;

  for (let i = 0; i < spine.length; i++) {
    const item = spine[i];
    if (item?.linear === "no") continue;
    if (isNavItem(item)) continue;
    if (!looksLikeHtmlItem(item)) continue;

    setStatus(`Extrahiere Kapitel ${i+1}/${spine.length}… (${kept} gesammelt)`, { sticky: true });

    await item.load(book.load.bind(book));
    const rawText = cleanDocText(item.document);
    item.unload();

    if (rawText.length < 400) continue;
    const w = wordsFromText(rawText);
    if (w.length < 80) continue;

    const labelGuess =
      (toc.find(t => t.href === item.href)?.label) ||
      `Kapitel ${chapters.length + 1}`;

    const start = wordCursor;
    wordCursor += w.length;
    const end = wordCursor;

    chapters.push({ label: labelGuess, href: item.href, start, end });
    allParts.push(rawText);
    kept++;
  }

  const combined = allParts.join("\n\n");
  const words = wordsFromText(combined);
  if (!words.length) throw new Error("Kein Text gefunden (EPUB evtl. Scan/Bild oder ungewöhnlich).");

  return {
    id: stableBookId(file),
    title, author, coverDataUrl,
    words, chapters, toc,
  };
}

async function loadTxtFromFile(file) {
  setStatus("Lade TXT…", { sticky: true });
  const txt = await file.text();
  const words = wordsFromText(txt);
  return {
    id: stableBookId(file),
    title: file.name,
    author: "",
    coverDataUrl: "",
    words,
    chapters: [],
    toc: [],
  };
}

/* -----------------------------
   PDF extraction (pdf.js)
   - Nur Textlayer. Kein OCR im Browser.
------------------------------ */
async function loadPdfFromFile(file) {
  if (!window.pdfjsLib) {
    const e = new Error("PDFJS_NOT_LOADED");
    e.code = "PDFJS_NOT_LOADED";
    throw e;
  }
function prettifyHeadingLabel(s) {
  s = String(s || "").trim();

  // Whitespace normalisieren
  s = s.replace(/\s+/g, " ");

  // typische PDF-Header/Footers killen
  if (/^(seite|page)\s+\d+(\s+von\s+\d+)?$/i.test(s)) return "";
  if (/^\d+\s*\/\s*\d+$/.test(s)) return "";

  // Bullet/Trennzeichen vorne weg
  s = s.replace(/^[•·▪●○\-\–—]+/g, "").trim();

  // Mehrfachpunkte/komische Trennungen
  s = s.replace(/\.{2,}/g, ".").trim();

  // Wenn ALL CAPS: Title Case light (aber nur bei kurzen Strings)
  const isAllCaps = s.length <= 60 && s === s.toUpperCase() && /[A-ZÄÖÜ]/.test(s);
  if (isAllCaps) {
    s = s
      .toLowerCase()
      .replace(/\b([a-zäöüß])/g, m => m.toUpperCase());
  }

  // Am Ende keinen Punkt erzwingen
  s = s.replace(/[.:;\-–—]+$/g, "").trim();

  // Länge begrenzen (Kapitel-Leiste soll nicht explodieren)
  if (s.length > 52) s = s.slice(0, 51) + "…";

  return s;
}

function dedupeAndNormalizeHeadings(headings) {
  // headings: [{page, label}]
  const out = [];
  const seen = new Set();

  for (const h of headings) {
    let label = prettifyHeadingLabel(h.label);
    if (!label) continue;

    // Standardisiere Nummerierung: "1.2  Foo" -> "1.2 Foo"
    label = label.replace(/^(\d+(?:\.\d+)*)(\s*[\)\.]?\s*)/, "$1 ");

    // Duplikate raus (case-insensitive)
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ page: h.page, label });
  }

  // Wenn die erste Überschrift erst spät kommt:
  // Wir wollen trotzdem ein "Kapitel 1" am Anfang, damit die Leiste nicht leer wirkt.
  if (out.length && out[0].page > 2) {
    out.unshift({ page: 1, label: "Kapitel 1" });
  }

  return out;
}
  setStatus("Lade PDF…", { sticky: true });

  const ab = await file.arrayBuffer();

  // Worker (falls du das nicht schon irgendwo global machst)
  // pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.js";

  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

  // --- Helper: render first page as cover ---
  async function renderCoverDataUrl() {
    try {
      const page1 = await pdf.getPage(1);
      // Scale so it looks nice in shelf but not huge
      const viewport = page1.getViewport({ scale: 0.8 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page1.render({ canvasContext: ctx, viewport }).promise;

      // JPEG is smaller than PNG
      return canvas.toDataURL("image/jpeg", 0.82);
    } catch (e) {
      console.warn("PDF cover render failed:", e);
      return "";
    }
  }

  // --- Helper: get PDF metadata title (best effort) ---
  async function getPdfTitle() {
    try {
      const meta = await pdf.getMetadata();
      const t = meta?.info?.Title || meta?.metadata?.get?.("dc:title") || "";
      const cleaned = String(t || "").trim();
      if (cleaned && cleaned.toLowerCase() !== "untitled") return cleaned;
    } catch {}
    // Fallback to filename
    return String(file.name || "PDF").replace(/\.pdf$/i, "").trim() || "PDF";
  }

  // --- Helper: normalize heading text ---
  function normalizeHeading(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .replace(/[•·▪●○]/g, "")
      .trim();
  }

  function looksLikeHeading(text) {
    if (!text) return false;
    const t = text.trim();

    // Too long = probably paragraph
    if (t.length > 90) return false;

    // Very short but only digits/punct => no
    if (/^[\d\s\.\-–—]+$/.test(t)) return false;

    // Page header/footer junk (common)
    if (/^seite\s+\d+$/i.test(t)) return false;
    if (/^\d+\s*\/\s*\d+$/.test(t)) return false;

    // Strong signals:
    // 1) Numbered headings
    if (/^\d+(\.\d+)*\s+\S+/.test(t)) return true;

    // 2) ALL CAPS short (often headings)
    if (t.length >= 6 && t.length <= 60 && t === t.toUpperCase() && /[A-ZÄÖÜ]/.test(t)) return true;

    // 3) Ends without period and has decent letters
    if (!/[.!?]$/.test(t) && /[A-Za-zÄÖÜäöüß]{3,}/.test(t) && t.length <= 60) return true;

    return false;
  }

  // --- Collect per page: text + heading candidates ---
  const pageWords = [];           // words count per page
  const pageTexts = [];           // cleaned page text
  const headingCandidates = [];   // {page, text, score}

  let totalChars = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    setStatus(`Extrahiere PDF Seite ${p}/${pdf.numPages}…`, { sticky: true });

    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Items contain: str, transform, fontName
    const items = content.items || [];
    const styles = content.styles || {};

    // Group into "lines" by y coordinate (rough)
    // y is transform[5], font size approx abs(transform[3])
    const lines = new Map(); // key -> {y, items:[], maxFont, topX}
    const yBucket = (y) => Math.round(y / 4) * 4; // bucket to reduce jitter

    for (const it of items) {
      const str = String(it.str || "").trim();
      if (!str) continue;

      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tr[4] || 0;
      const y = tr[5] || 0;
      const fontSize = Math.abs(tr[3] || tr[0] || 0) || 0;

      const key = yBucket(y);
      if (!lines.has(key)) lines.set(key, { y, items: [], maxFont: fontSize, minX: x, maxX: x });
      const L = lines.get(key);
      L.items.push({ str, x, y, fontSize, fontName: it.fontName });
      L.maxFont = Math.max(L.maxFont, fontSize);
      L.minX = Math.min(L.minX, x);
      L.maxX = Math.max(L.maxX, x);
    }

    // Convert lines -> sorted by y desc (PDF y grows upward usually)
    const lineArr = [...lines.values()].sort((a, b) => b.y - a.y);

    // Determine median font size on this page for relative comparison
    const fontSamples = [];
    for (const L of lineArr) {
      if (L.maxFont) fontSamples.push(L.maxFont);
    }
    fontSamples.sort((a, b) => a - b);
    const medianFont = fontSamples.length
      ? fontSamples[Math.floor(fontSamples.length * 0.5)]
      : 10;

    // Build page text + headings
    const pageLineTexts = [];
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height || 800;

    for (const L of lineArr) {
      // Build line string in x-order
      const parts = L.items.sort((a, b) => a.x - b.x).map(x => x.str);
      const lineText = normalizeHeading(parts.join(" "));
      if (!lineText) continue;

      // Keep for body text
      pageLineTexts.push(lineText);

      // Heading candidate scoring
      const isTopish = (pageHeight - L.y) < pageHeight * 0.30; // near top (PDF coords)
      const bigFont = L.maxFont >= medianFont * 1.25;
      const numbered = /^\d+(\.\d+)*\s+\S+/.test(lineText);

      if ((numbered || (bigFont && isTopish)) && looksLikeHeading(lineText)) {
        // score: number headings strongest, then font size, then topish
        const score =
          (numbered ? 3 : 0) +
          (bigFont ? 2 : 0) +
          (isTopish ? 1 : 0) +
          Math.min(2, (L.maxFont / Math.max(1, medianFont)) - 1);

        headingCandidates.push({ page: p, text: lineText, score });
      }
    }

    // Page text cleanup
    const pageRaw = pageLineTexts.join("\n");
    const cleanedPage = pageRaw
      .replace(/-\s*\n/g, "")       // hyphen line breaks
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    totalChars += cleanedPage.length;
    pageTexts.push(cleanedPage);

    const w = wordsFromText(cleanedPage);
    pageWords.push(w.length);
  }

  // validate text existence
  const fullRaw = pageTexts.join("\n\n");
  const cleaned = fullRaw
    .replace(/-\s*\n/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (totalChars < 200 || cleaned.length < 200) {
    const e = new Error("PDF_NO_TEXT");
    e.code = "PDF_NO_TEXT";
    throw e;
  }

  const words = wordsFromText(cleaned);

  // --- Build chapters/toc based on heading candidates ---
  // 1) Deduplicate headings per page, pick best per page
  const bestByPage = new Map();
  for (const h of headingCandidates) {
    const prev = bestByPage.get(h.page);
    if (!prev || h.score > prev.score) bestByPage.set(h.page, h);
  }

  // 2) Sort by page
  const headings = [...bestByPage.values()]
  .sort((a, b) => a.page - b.page)
  .map(h => ({ page: h.page, label: h.text }));  // 3) Map page -> wordStart index
  
  const pageStartWord = [];

  let acc = 0;
  for (let i = 0; i < pageWords.length; i++) {
    pageStartWord[i + 1] = acc;      // page number starts at 1
    acc += pageWords[i];
  }

  let chapters = [];
  let toc = [];

  if (headings.length >= 2) {
    for (let i = 0; i < headings.length; i++) {
      const cur = headings[i];
      const next = headings[i + 1];

      const start = clamp(pageStartWord[cur.page] ?? 0, 0, Math.max(0, words.length));
      const end = clamp(next ? (pageStartWord[next.page] ?? words.length) : words.length, start, words.length);

      // Avoid tiny chapters (often false positives)
      if (end - start < 120) continue;

      const href = `p${cur.page}`;
      chapters.push({ label: cur.label, href, start, end });
      toc.push({ label: cur.label, href });
    }

    // If after filtering nothing remains -> fallback
    if (!chapters.length) headings.length = 0;
  }

  // Fallback: chunk by word count
  if (!chapters.length) {
    const approx = 1200;
    let k = 0;
    for (let start = 0; start < words.length; start += approx) {
      const end = Math.min(words.length, start + approx);
      k++;
      const label = `Teil ${k}`;
      const href = `chunk${k}`;
      const niceLabel = /^\d+(\.\d+)*\s/.test(cur.label)
        ? cur.label
        : `Kapitel ${i + 1}: ${cur.label}`;
      chapters.push({ label: niceLabel, href, start, end });
      toc.push({ label: niceLabel, href });
    }
  }

  const title = await getPdfTitle();
  const coverDataUrl = await renderCoverDataUrl();

  return {
    id: stableBookId(file),
    title,
    author: "PDF",
    coverDataUrl,
    words,
    chapters,
    toc,
  };
}

/* -----------------------------
   File handling
------------------------------ */
async function handleFile(file) {
  try {
    stopPlayback();
    S.words = [];
    S.idx = 0;
    S.bookmarks = [];

    await ensurePersistentStorage();

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    let parsed;

    if (ext === "epub") parsed = await loadEpubFromFile(file);
    else if (ext === "txt") parsed = await loadTxtFromFile(file);
    else if (ext === "pdf") parsed = await loadPdfFromFile(file);
    else throw new Error("Bitte .epub, .txt oder .pdf laden.");

    const existing = await idbGet(parsed.id);
    const idx = existing?.idx ?? 0;
    const marks = existing?.bookmarks ?? [];

    S.book.id = parsed.id;
    S.book.title = parsed.title || "—";
    S.book.author = parsed.author || "—";
    S.book.coverDataUrl = parsed.coverDataUrl || "";
    S.book.chapters = parsed.chapters || [];
    S.book.toc = parsed.toc || [];

    S.words = parsed.words || [];
    S.idx = clamp(idx, 0, Math.max(0, S.words.length - 1));
    S.bookmarks = marks;

    syncHeaderUI();
    renderToc();
    renderBookmarks();
    updateProgressUI();
    showCurrent();

    await saveBookToLibrary({
      id: parsed.id,
      title: S.book.title,
      author: S.book.author,
      coverDataUrl: S.book.coverDataUrl,
      words: S.words,
      chapters: S.book.chapters,
      toc: S.book.toc,
      idx: S.idx,
      bookmarks: S.bookmarks,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });

    setStatus(`Geladen: ${S.book.title} (${S.words.length} Wörter)`, { sticky: true });
  } catch (e) {
    console.error(e);

    if (e?.code === "PDF_NO_TEXT" || e?.message === "PDF_NO_TEXT") {
      setStatus("PDF enthält keinen Text (OCR nötig).", { sticky: true });
      alert(
        "Kein Text erkannt.\n\n" +
        "Dieses PDF ist vermutlich ein Scan/Bild.\n" +
        "Bitte in Quick Scan OCR aktivieren und als 'durchsuchbares PDF' exportieren."
      );
    } else if (e?.code === "PDFJS_NOT_LOADED" || e?.message === "PDFJS_NOT_LOADED") {
      setStatus("pdf.js fehlt in /lib.", { sticky: true });
      alert(
        "pdf.js fehlt.\n\n" +
        "Lege lib/pdf.min.js und lib/pdf.worker.min.js ab\n" +
        "und binde sie in index.html VOR app.js ein."
      );
    } else {
      setStatus(`Fehler: ${e?.message || e}`, { sticky: true });
    }

    S.words = [];
    updateProgressUI();
    showCurrent();
  }
}

/* -----------------------------
   Help content
------------------------------ */
function buildHelpHtml() {
  const lines = [
    `<div class="h">Schnellstart</div>
     <div class="b">Tippe <span class="k">Datei laden</span>, wähle ein <span class="k">.epub</span>, <span class="k">.txt</span> oder <span class="k">.pdf</span>. Danach mit <span class="k">Play</span> starten.</div>`,
    `<div class="h">PDF Hinweis</div>
     <div class="b">PDFs ohne Textlayer (Scan/Bild) können nicht gelesen werden. Bitte vorher OCR (z.B. Quick Scan → durchsuchbares PDF).</div>`,
    `<div class="h">Tippen im Lesefeld</div>
     <div class="b">Links = zurück, Mitte = Play/Pause, rechts = vor.</div>`,
    `<div class="h">Sidebar ☰</div>
     <div class="b"><span class="k">Kapitel</span> zeigt den Index (wenn im EPUB vorhanden). <span class="k">Lesezeichen</span> sind Sprungmarken.</div>`,
    `<div class="h">Lesezeichen 🔖</div>
     <div class="b">Setzt ein Lesezeichen bei der aktuellen Wortposition. In der Sidebar kannst du direkt hinspringen.</div>`,
    `<div class="h">Cover/Titel 🛈</div>
     <div class="b">Zeigt Cover + Titel + Fortschritt.</div>`,
    `<div class="h">Einstellungen ⚙︎</div>
     <div class="b">WPM = Geschwindigkeit, Chunk = mehrere Wörter pro Anzeige, ORP = Fokus-Buchstabe, Satzzeichenpause = Extra-Zeit bei Punkt/Komma.</div>`,
    `<div class="h">Auto-Stop</div>
     <div class="b">Stoppt am Kapitelende oder nach X Wörtern oder nach X Minuten – aber immer erst am Satzende.</div>`,
    `<div class="h">Bibliothek 📚</div>
     <div class="b">Gelesene Bücher werden offline gespeichert (inkl. Cover & Lesezeichen).</div>`,
    `<div class="h">Wenn etwas „weg“ ist</div>
     <div class="b">Privater Modus blockt/killt Speicher. Am besten als Home-Screen-App nutzen.</div>`,
  ];
  return lines.join("");
}

/* -----------------------------
   Donate helpers
------------------------------ */
const DONATE = {
  paypal: "https://paypal.me/rophko",
  btc: "bc1qwr08y9ngmvplpr8tuk4w34rl4pkryur8u4cf5f"
};

function qrUrl(data) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(data);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Kopiert ✅");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setStatus("Kopiert ✅");
  }
}

function attachScrubButton(btn, dir /* -1 or +1 */) {
  if (!btn) return;

  const stopZoom = (ev) => { try { ev.preventDefault(); } catch {} };

  let holdTimer = null;
  let interval = null;
  let didHold = false;

  const clearHold = () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (interval)  { clearInterval(interval); interval = null; }
  };

  const doStep = () => step(dir); // nutzt deine existierende step()-Funktion

  const startHold = () => {
    if (S.playing) return; // long-press nur im Pausemodus
    didHold = false;
    clearHold();
    holdTimer = setTimeout(() => {
      if (S.playing) return;
      didHold = true;
      const tick = () => doStep();
      tick();
      const ms = Math.max(30, (1000 * Math.max(1, S.settings.chunk)) / 10);
interval = setInterval(tick, ms);
    }, 500);
  };

  const endHold = () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (didHold) { clearHold(); return; }
    clearHold();
    doStep(); // kurzer Tap = 1 Schritt
  };

  // Pointer Events (best)
  btn.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    stopZoom(ev);
    startHold();
  }, { passive: false });

  btn.addEventListener("pointerup", (ev) => {
    stopZoom(ev);
    endHold();
  }, { passive: false });

  btn.addEventListener("pointercancel", clearHold);

  // Touch fallback (iOS)
  btn.addEventListener("touchstart", (ev) => { stopZoom(ev); startHold(); }, { passive: false });
  btn.addEventListener("touchend", (ev) => { stopZoom(ev); endHold(); }, { passive: false });
  btn.addEventListener("touchcancel", clearHold, { passive: true });
}

/* -----------------------------
   Bind UI
------------------------------ */
function bindUI() {
  const addFeedback = (btn) => {
    if (!btn) return;
    btn.classList.remove("btn-feedback");
    void btn.offsetWidth;
    btn.classList.add("btn-feedback");
  };

  el.file?.addEventListener("change", (ev) => {
    const f = ev.target.files?.[0];
    if (f) handleFile(f);
    ev.target.value = "";
  });

  el.btnExportAll?.addEventListener("click", () => exportLibrary({ mode: "all" }));
  document.getElementById("btnExportAllMobile")?.addEventListener("click", () => exportLibrary({ mode: "all" }));

  // (btnExportSelected existiert in deiner HTML nicht mehr -> optional chaining wäre ok, lassen wir weg)

  el.importFile?.addEventListener("change", (ev) => {
    const f = ev.target.files?.[0];
    if (f) importLibraryFromJsonFile(f);
    ev.target.value = "";
  });

  el.btnSelectAll?.addEventListener("click", toggleSelectAllBooks);
  el.btnDeleteSelected?.addEventListener("click", deleteSelectedFromLibrary);

  el.btnPlay?.addEventListener("click", () => { togglePlay(); addFeedback(el.btnPlay); });
  attachScrubButton(el.btnBack, -1);
attachScrubButton(el.btnFwd, +1);
  el.btnBookmark?.addEventListener("click", () => { addBookmarkAtCurrent(); addFeedback(el.btnBookmark); });

  el.seek?.addEventListener("input", () => {
    stopPlayback();
    S.idx = Number(el.seek.value);
    showCurrent();
    persistCurrentBookState().catch(()=>{});
  });

  el.display?.addEventListener("click", (ev) => {
    const r = el.display.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const third = r.width / 3;
    if (x < third) step(-1);
    else if (x > 2 * third) step(+1);
    else togglePlay();
  });

  el.tabToc?.addEventListener("click", () => setTab("toc"));
  el.tabMarks?.addEventListener("click", () => setTab("marks"));

  const btnCloseMob = $("btnSidebarCloseMobile");
  if(btnCloseMob) {
    btnCloseMob.addEventListener("click", () => {
      if (window.__dockClose) window.__dockClose("sidebar");
    });
  }

  el.wpm?.addEventListener("input", () => {
    S.settings.wpm = Number(el.wpm.value);
    if (el.wpmVal) el.wpmVal.textContent = String(S.settings.wpm);
    if (el.wpmSettingVal) el.wpmSettingVal.textContent = String(S.settings.wpm);
  });

  el.chunk?.addEventListener("input", () => {
    S.settings.chunk = Number(el.chunk.value);
    if (el.chunkVal) el.chunkVal.textContent = String(S.settings.chunk);
  });

  el.orp?.addEventListener("change", () => { S.settings.orp = el.orp.checked; showCurrent(); });
  el.punct?.addEventListener("change", () => { S.settings.punct = el.punct.checked; });
  el.punctMs?.addEventListener("input", () => { S.settings.punctMs = Number(el.punctMs.value); if (el.punctVal) el.punctVal.textContent = String(S.settings.punctMs); });

  el.stopChapter?.addEventListener("change", () => { S.settings.stopChapter = el.stopChapter.checked; });
  el.stopWordsOn?.addEventListener("change", () => { S.settings.stopWordsOn = el.stopWordsOn.checked; });
  el.stopWords?.addEventListener("input", () => { S.settings.stopWords = Number(el.stopWords.value || 0); });
  el.stopMinsOn?.addEventListener("change", () => { S.settings.stopMinsOn = el.stopMinsOn.checked; });
  el.stopMins?.addEventListener("input", () => { S.settings.stopMins = Number(el.stopMins.value || 0); });

  el.btnSaveSettings?.addEventListener("click", () => {
    readSettingsFromUI();
    saveSettingsToLS();
    applySettingsToUI();
    setStatus("Einstellungen gespeichert ✅");
  });

  el.btnLoadSettings?.addEventListener("click", () => {
    loadSettingsFromLS();
    applySettingsToUI();
    setStatus("Einstellungen geladen ✅");
  });

  el.btnPaypalQR?.addEventListener("click", () => {
    const u = DONATE.paypal;
    if (!el.paypalQrImg || !el.paypalQrWrap) return;

    el.paypalQrImg.onerror = () => { if (el.paypalQrHint) el.paypalQrHint.textContent = "QR konnte nicht geladen werden (Netz/Blocker)."; };
    el.paypalQrImg.src = qrUrl(u);
    el.paypalQrWrap.style.display = "block";
    if (el.paypalQrHint) el.paypalQrHint.textContent = "";
  });

  el.btnCopyBtc?.addEventListener("click", () => copyToClipboard(DONATE.btc));

  el.btnBtcQR?.addEventListener("click", () => {
    const uri = "bitcoin:" + DONATE.btc;
    if (!el.btcQrImg || !el.btcQrWrap) return;

    el.btcQrImg.onerror = () => { if (el.btcQrHint) el.btcQrHint.textContent = "QR konnte nicht geladen werden (Netz/Blocker)."; };
    el.btcQrImg.src = qrUrl(uri);
    el.btcQrWrap.style.display = "block";
    if (el.btcQrHint) el.btcQrHint.textContent = "";
  });

  document.getElementById("btnExportAllMobile")?.addEventListener("click", () => exportLibrary({ mode: "all" }));
}

if (el.btnBack) el.btnBack.innerHTML = "◀";
if (el.btnFwd)  el.btnFwd.innerHTML  = "▶";

/* =====================================================
   Dock + Popover Panels (ONE source of truth)
===================================================== */
let _dockPanelsInited = false;

function initDockPanels() {
  if (_dockPanelsInited) return;
  _dockPanelsInited = true;

  let buttons = [...document.querySelectorAll(".topBtn[data-panel]")];
  buttons = buttons.map((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
    return clone;
  });

  const panels = [...document.querySelectorAll("[data-panel-id]")];
  const panelById = (id) => panels.find(p => p.dataset.panelId === id);

  const DOCK_TOGGLES = new Set(["sidebar", "shelf"]);
  const POPOVERS = new Set(["settings", "help", "donate"]);

  const isVisible = (p) => !p.classList.contains("hidden");

  const showWithAnim = (p) => {
    p.classList.remove("hidden");
    p.hidden = false;
    requestAnimationFrame(() => p.classList.add("isOpen"));
  };

  const hideWithAnim = (p) => {
    p.classList.remove("isOpen");
    setTimeout(() => {
      p.classList.add("hidden");
      p.hidden = true;
    }, 160);
  };
  let _scrollYBeforeModal = 0;

function lockBackgroundScroll() {
  _scrollYBeforeModal = window.scrollY || 0;
  document.body.classList.add("modalOpen");
  document.body.style.top = `-${_scrollYBeforeModal}px`;
}

function unlockBackgroundScroll() {
  document.body.classList.remove("modalOpen");
  const top = document.body.style.top;
  document.body.style.top = "";
  const y = top ? -parseInt(top, 10) : _scrollYBeforeModal;
  window.scrollTo(0, y || 0);
}
  function setShelfSafe(on) {
    const shelfEl =
      document.querySelector('[data-panel-id="shelf"]') ||
      document.getElementById("shelf");

    if (!on || !shelfEl) {
      document.documentElement.style.setProperty("--shelfSafe", "0px");
      return;
    }

    requestAnimationFrame(() => {
      const r = shelfEl.getBoundingClientRect();
      const h = Math.max(0, Math.round(r.height));
      document.documentElement.style.setProperty("--shelfSafe", `${h + 12}px`);
    });
  }

  const openDock = (p, btn) => {
    setTopbarHeightVar();
    showWithAnim(p);
    btn?.classList.add("isActive");
    if (p.dataset.panelId === "shelf") setShelfSafe(true);
  };

  const closeDock = (p, btn) => {
    hideWithAnim(p);
    btn?.classList.remove("isActive");
    if (p.dataset.panelId === "shelf") setShelfSafe(false);
  };

  const positionPopoverUnderButton = (p, btn) => {
    const r = btn.getBoundingClientRect();
    p.style.left = "0px";
    p.style.right = "auto";

    let left = r.left;
    const maxLeft = window.innerWidth - p.offsetWidth - 12;
    left = Math.max(12, Math.min(left, maxLeft));
    p.style.left = `${left}px`;
    p.style.top = "calc(var(--topbarH) + 14px)";
  };

  const openPopover = (p, btn, id) => {
    if (id === "help" && el.helpBody) el.helpBody.innerHTML = buildHelpHtml();
    if (id === "donate") {
      if (el.btcAddr) el.btcAddr.textContent = DONATE.btc;
      if (el.paypalQrWrap) el.paypalQrWrap.style.display = "none";
      if (el.btcQrWrap) el.btcQrWrap.style.display = "none";
      if (el.paypalQrHint) el.paypalQrHint.textContent = "";
      if (el.btcQrHint) el.btcQrHint.textContent = "";
    }
    lockBackgroundScroll();
    showWithAnim(p);
    requestAnimationFrame(() => positionPopoverUnderButton(p, btn));
    btn?.classList.add("isActive");
  };

  const closePopover = (p, btn) => {
    hideWithAnim(p);
    unlockBackgroundScroll();
    btn?.classList.remove("isActive");
  };

  window.__dockClose = (id) => {
    const p = panelById(id);
    const b = document.querySelector(`.topBtn[data-panel="${id}"]`);
    if (!p) return;
    if (POPOVERS.has(id)) closePopover(p, b);
    else closeDock(p, b);
  };

  const hookClose = (closeEl, panelId, btnId) => {
    if (!closeEl) return;
    closeEl.addEventListener("click", (e) => {
      e.preventDefault();
      const p = panelById(panelId);
      const b = document.getElementById(btnId);
      if (!p) return;
      closePopover(p, b);
    });
  };

  hookClose(el.btnSettingsClose, "settings", "btnSettings");
  hookClose(el.btnHelpClose, "help", "btnHelp");
  hookClose(el.btnDonateClose, "donate", "btnDonate");

  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const id = btn.dataset.panel;

      if (id === "header") {
        if (!el.headerInfo) return;
        const willShow = el.headerInfo.classList.contains("hidden");
        willShow ? show(el.headerInfo) : hide(el.headerInfo);
        btn.classList.toggle("isActive", willShow);
        return;
      }

      const p = panelById(id);
      if (!p) return;

      if (DOCK_TOGGLES.has(id)) {
        isVisible(p) ? closeDock(p, btn) : openDock(p, btn);
        return;
      }

      if (POPOVERS.has(id)) {
        isVisible(p) ? closePopover(p, btn) : openPopover(p, btn, id);
        return;
      }
    });
  });

  const repositionOpenPopovers = () => {
    for (const id of POPOVERS) {
      const p = panelById(id);
      if (!p || !isVisible(p)) continue;
      const btn = document.querySelector(`.topBtn[data-panel="${id}"]`);
      if (btn) positionPopoverUnderButton(p, btn);
    }
  };
  window.addEventListener("resize", repositionOpenPopovers, { passive: true });
  window.addEventListener("scroll", repositionOpenPopovers, { passive: true });

  setShelfSafe(false);
}

/* -----------------------------
   Share Target / Shortcut Handler
------------------------------ */
async function performClipboardImport(titleOverride) {
  const overlay = document.getElementById("importOverlay");

  try {
    const text = await navigator.clipboard.readText();

    if (!text || !text.trim()) {
      setStatus("Zwischenablage ist leer!");
      return;
    }

    const words = wordsFromText(text);
    if (!words.length) {
      setStatus("Kein lesbarer Text gefunden.");
      return;
    }

    let bookIdToLoad;
    try {
      const allBooks = await idbGetAll();
      const existing = allBooks.find(b =>
        (b.title === titleOverride || b.title === "Geteilter Artikel") &&
        b.words.length === words.length
      );
      if (existing) bookIdToLoad = existing.id;
    } catch(e) {}

    if (!bookIdToLoad) {
      const newId = `share_${Date.now()}`;
      bookIdToLoad = newId;
      await saveBookToLibrary({
        id: newId,
        title: titleOverride || "Geteilter Artikel",
        author: "Import",
        coverDataUrl: "",
        words: words,
        chapters: [],
        toc: [],
        idx: 0,
        bookmarks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await loadBookFromLibrary(bookIdToLoad);

    document.querySelectorAll(".isActive").forEach(b => b.classList.remove("isActive"));
    document.querySelectorAll(".panel, .popoverPanel").forEach(p => {
      p.classList.remove("isOpen"); p.classList.add("hidden");
    });

  } catch (e) {
    console.error(e);
    alert("Import-Fehler: " + e.message);
  } finally {
    if (overlay) overlay.remove();
  }
}

function showImportOverlay(title) {
  const old = document.getElementById("importOverlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "importOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "10000",
    background: "rgba(11, 12, 16, 0.98)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    cursor: "pointer", textAlign: "center", padding: "20px"
  });

  overlay.innerHTML = `
    <div style="font-size:60px; margin-bottom:20px;">📋</div>
    <div style="font-size:24px; font-weight:bold; color:#fff; margin-bottom:10px;">
      Import bereit
    </div>
    <div style="color:#aaa; margin-bottom:40px; max-width:80%;">
      "${escapeHtml(title || 'Artikel')}"
    </div>
    <div style="padding:16px 32px; background:#7ee787; color:#000; border-radius:12px; font-weight:bold; font-size:18px;">
      HIER TIPPEN
    </div>
  `;

  overlay.addEventListener("click", () => {
    overlay.style.opacity = "0.5";
    setStatus("Lese Zwischenablage...", { sticky: true });
    setTimeout(() => performClipboardImport(title), 50);
  });

  document.body.appendChild(overlay);
}

// URL Handler
async function handleSharedContent() {
  const params = new URLSearchParams(window.location.search);
  const importMode = params.get("import");
  const sharedTitle = params.get("title");
  const directText = params.get("text");
  const importUrl = params.get("import_url") || params.get("url");

  if (importMode || directText || importUrl) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // BONUS: PDF via URL
  if (importUrl) {
    try {
      setStatus("Lade PDF aus dem Netz…", { sticky: true });

      const res = await fetch(importUrl);
      if (!res.ok) throw new Error("PDF_FETCH_FAILED");

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const looksPdf = ct.includes("application/pdf") || importUrl.toLowerCase().includes(".pdf");
      if (!looksPdf) throw new Error("IMPORT_URL_NOT_PDF");

      const blob = await res.blob();
      const f = new File([blob], "import.pdf", { type: "application/pdf" });

      const parsed = await loadPdfFromFile(f);

      await saveBookToLibrary({
        id: parsed.id,
        title: parsed.title || "PDF Import",
        author: "Import",
        coverDataUrl: "",
        words: parsed.words,
        chapters: [],
        toc: [],
        idx: 0,
        bookmarks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await loadBookFromLibrary(parsed.id);
      setStatus(`Geladen: ${parsed.title} (${parsed.words.length} Wörter)`, { sticky: true });
      return;

    } catch (e) {
      console.error(e);
      setStatus("PDF konnte nicht geladen werden (CORS?).", { sticky: true });
      alert(
        "PDF konnte nicht direkt importiert werden.\n\n" +
        "Manche Webseiten blocken das (CORS).\n" +
        "Workaround: PDF in 'Dateien' speichern und dann lokal über 'Datei laden' öffnen."
      );
      return;
    }
  }

  // Fall A: Shortcut (via Clipboard)
  if (importMode === "clipboard") {
    showImportOverlay(sharedTitle);
    return;
  }

  // Fall B: Legacy direct text
  if (directText) {
    const words = wordsFromText(directText);
    if (!words.length) return;
    const newId = `url_${Date.now()}`;
    await saveBookToLibrary({
      id: newId, title: sharedTitle || "URL Text", author: "Import",
      coverDataUrl: "", words: words, chapters: [], toc: [], idx: 0, bookmarks: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    await loadBookFromLibrary(newId);
  }
}

/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  setTopbarHeightVar();
  try { bindUI(); } catch (e) { console.error("bindUI failed", e); }
  initDockPanels();
  try { await ensurePersistentStorage(); } catch (e) {}
  try { loadSettingsFromLS(); } catch(e){}
  try { applySettingsToUI(); } catch(e){}

  setTab("toc");
  updateProgressUI();
  showCurrent();

  try { await renderShelf(); } catch(e){}

  await handleSharedContent();

  if (!S.book.id) {
    setStatus("Warte auf Datei…", { sticky: true });
  }
})().catch((e) => {
  console.error(e);
  setStatus("Boot-Fehler", { sticky: true });
});
