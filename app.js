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

/* Read-Along state – muss vor stopPlayback/scheduleNext definiert sein */
const ReadAlong = {
  active:        false,
  utterance:     null,
  startIdx:      0,
  wordOffsets:   [],
  _fallbackTimer: null,
  _manualPaused:  false,
  _keepAlive:     null,
  _pausedAt:      0,
};

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
  btnResetSettings: $("btnResetSettings"),

  // Appearance
  fontSize: $("fontSize"),
  fontSizeVal: $("fontSizeVal"),
  fontFamily: $("fontFamily"),
  textColor: $("textColor"),
  bgColor: $("bgColor"),
  orpColor: $("orpColor"),
  appearancePreviewWord: $("appearancePreviewWord"),

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
  btnBtcWallet: $("btnBtcWallet"),
  btcQrWrap: $("btcQrWrap"),
  btcQrImg: $("btcQrImg"),
  btcQrHint: $("btcQrHint"),

  // TTS read-along checkbox
  ttsReadAlong: $("ttsReadAlong"),
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
    wpm: 500,
    chunk: 1,
    orp: true,
    punct: true,
    punctMs: 200,

    stopChapter: false,
    stopWordsOn: false,
    stopWords: 2000,
    stopMinsOn: false,
    stopMins: 10,

    // Appearance
    fontSize: 64,
    fontFamily: 'system',
    textColor: '#e8edf2',
    bgColor: '#0b0c10',
    orpColor: '#7ee787',
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
  // RSVP standard: ORP ist bei ~35% der Wortlänge (immer linkszentriert im Fenster)
  // Das ergibt: len=2→0, len=3→1, len=4→1, len=5→1, len=6→2, len=7→2, len=8→2, len=9→3 ...
  return Math.max(0, Math.floor(len * 0.35));
}

function renderToken(token) {
  if (!S.settings.orp) {
    el.word.innerHTML = escapeHtml(token);
    el.word.style.textAlign = 'center';
    el.word.style.paddingLeft = '';
    el.word.style.paddingRight = '';
  } else {
    const m = token.match(/[A-Za-zÄÖÜäöüß0-9]+/);
    if (!m) {
      el.word.innerHTML = escapeHtml(token);
      el.word.style.textAlign = 'center';
      el.word.style.paddingLeft = '';
      el.word.style.paddingRight = '';
    } else {
      const seg = m[0];
      const segStart = token.indexOf(seg);
      const orpIdx = computeOrpIndex(seg);
      const before    = escapeHtml(token.slice(0, segStart));
      const segBefore = escapeHtml(seg.slice(0, orpIdx));
      const segOrp    = escapeHtml(seg.slice(orpIdx, orpIdx + 1));
      const segAfter  = escapeHtml(seg.slice(orpIdx + 1));
      const after     = escapeHtml(token.slice(segStart + seg.length));
      el.word.innerHTML = `${before}<span class="orp-before">${segBefore}</span><span class="orp">${segOrp}</span><span class="orp-after">${segAfter}${after}</span>`;
      // ORP-Buchstabe soll immer optisch in der Mitte der Box stehen
      // via CSS flex + orp-pivot wrapper (kein JS-Offset nötig wenn HTML-Struktur stimmt)
      el.word.style.textAlign = 'left'; // flex-Zentrierung via .word CSS
    }
  }
  autoFitWord();
}

/* Auto-Fit: Schrift verkleinern wenn Wort die Box überschreitet */
function autoFitWord() {
  if (!el.word || !el.display) return;

  // Im Vollbild: kein Shrink – Text umbricht natürlich (via CSS)
  if (document.body.classList.contains('readerFullscreen')) {
    el.word.style.fontSize = '';
    el.word.style.wordBreak = '';
    el.word.style.overflowWrap = '';
    return;
  }

  // Erst auf Basis-Größe zurücksetzen
  el.word.style.fontSize = '';
  el.word.style.wordBreak = '';
  el.word.style.overflowWrap = '';

  requestAnimationFrame(() => {
    const boxW   = el.display.clientWidth  - 28; // 14px padding beidseitig
    const wordW  = el.word.scrollWidth;

    if (wordW <= boxW) return; // passt — nichts tun

    // Basisgröße aus CSS-Variable lesen
    const basePx = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--reader-font-size')
    ) || 64;

    // Skalierungsfaktor: wie viel kleiner muss es werden?
    const ratio = boxW / wordW;
    const newSize = Math.max(18, Math.floor(basePx * ratio));

    el.word.style.fontSize = newSize + 'px';

    // Falls es immer noch nicht passt: Silbentrennung
    if (el.word.scrollWidth > boxW) {
      el.word.style.overflowWrap = 'break-word';
      el.word.lang = document.documentElement.lang || 'de';
    }
  });
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

  // Appearance
  if (el.fontSize) { el.fontSize.value = String(S.settings.fontSize || 64); if (el.fontSizeVal) el.fontSizeVal.textContent = String(S.settings.fontSize || 64); }
  if (el.fontFamily) el.fontFamily.value = S.settings.fontFamily || 'system';
  if (el.textColor) el.textColor.value = S.settings.textColor || '#e8edf2';
  if (el.bgColor) el.bgColor.value = S.settings.bgColor || '#0b0c10';
  if (el.orpColor) el.orpColor.value = S.settings.orpColor || '#7ee787';

  applyAppearance();
  updateAppearancePreview();
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

  // Appearance
  if (el.fontSize)   S.settings.fontSize   = Number(el.fontSize.value);
  if (el.fontFamily) S.settings.fontFamily  = el.fontFamily.value;
  if (el.textColor)  S.settings.textColor   = el.textColor.value;
  if (el.bgColor)    S.settings.bgColor     = el.bgColor.value;
  if (el.orpColor)   S.settings.orpColor    = el.orpColor.value;
}

/* -----------------------------
   Header + progress
------------------------------ */
/* -----------------------------
   Appearance: Apply to DOM + CSS vars
------------------------------ */
const FONT_MAP = {
  'system': 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  'sans':   'Arial, Helvetica, sans-serif',
  'serif':  'Georgia, "Times New Roman", Times, serif',
  'mono':   '"Courier New", Courier, ui-monospace, monospace',
};

const DEFAULT_SETTINGS = {
  wpm: 500, chunk: 1, orp: true, punct: true, punctMs: 200,
  stopChapter: false, stopWordsOn: false, stopWords: 2000,
  stopMinsOn: false, stopMins: 10,
  fontSize: 64, fontFamily: 'system',
  textColor: '#e8edf2', bgColor: '#0b0c10', orpColor: '#7ee787',
};

function applyAppearance() {
  const s = S.settings;
  const font = FONT_MAP[s.fontFamily] || FONT_MAP['system'];
  const root = document.documentElement;
  root.style.setProperty('--reader-font-size', (s.fontSize || 64) + 'px');
  root.style.setProperty('--reader-font-family', font);
  root.style.setProperty('--reader-text-color', s.textColor || '#e8edf2');
  root.style.setProperty('--reader-bg-color',   s.bgColor   || '#0b0c10');
  root.style.setProperty('--orp-color',          s.orpColor  || '#7ee787');
}

function updateAppearancePreview() {
  const s = S.settings;
  const font = FONT_MAP[s.fontFamily] || FONT_MAP['system'];
  const prev = el.appearancePreviewWord;
  if (!prev) return;
  prev.style.fontSize      = (s.fontSize || 64) + 'px';
  prev.style.fontFamily    = font;
  prev.style.color         = s.textColor || '#e8edf2';
  prev.style.fontWeight    = '900';
  prev.style.letterSpacing = '0.5px';
  const box = prev.closest('.previewBox');
  if (box) box.style.backgroundColor = s.bgColor || '#0b0c10';
  const orpSpan = prev.querySelector('.orp');
  if (orpSpan) orpSpan.style.color = s.orpColor || '#7ee787';
}

/* ----------------------------- */

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
  // Read-Along beenden wenn aktiv
  if (ReadAlong.active) {
    readAlongStop();
  }
  S.playing = false;
  if (S.timer) clearTimeout(S.timer);
  S.timer = null;
  S.pendingStop = false;
  if (el.btnPlay) el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
  try { window.speechSynthesis?.cancel(); } catch {}
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
  // Während Read-Along steuert die TTS-Stimme – scheduleNext bleibt draußen
  if (ReadAlong.active) return;

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

  // Read-Along Modus: TTS pausieren/fortsetzen
  // WICHTIG: speechSynthesis.paused/.speaking sind in Chrome unzuverlässig nach pause().
  // Deshalb verwalten wir den Pause-Zustand selbst mit ReadAlong._manualPaused.
  if (ReadAlong.active) {
    if (ReadAlong._manualPaused) {
      // ── RESUME ──
      ReadAlong._manualPaused = false;
      try { window.speechSynthesis.resume(); } catch(e) {}
      S.playing = true;
      if (el.btnPlay) el.btnPlay.textContent = "Pause";
      // Fallback-Timer neu starten falls kein onboundary läuft
      // (wird intern von speakChunk via onstart/onboundary gesteuert)
    } else {
      // ── PAUSE ──
      // Fallback-Timer stoppen, damit Text nicht weiterläuft!
      if (ReadAlong._fallbackTimer) {
        clearTimeout(ReadAlong._fallbackTimer);
        ReadAlong._fallbackTimer = null;
      }
      ReadAlong._manualPaused = true;
      try { window.speechSynthesis.pause(); } catch(e) {}
      S.playing = false;
      if (el.btnPlay) el.btnPlay.textContent = "Play";
    }
    return;
  }

  if (S.playing) {
    stopPlayback();
    return;
  }

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

function fmtTime(words, wpm) {
  if (!words || !wpm) return "";
  const secs = Math.round((words / wpm) * 60);
  if (secs < 60) return `~${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

function renderToc() {
  if (!el.tocList) return;

  const toc = S.book.toc || [];
  const chapters = S.book.chapters || [];
  if (!toc.length) {
    el.tocList.classList.add("muted");
    el.tocList.textContent = "Kein Kapitelindex gefunden.";
    return;
  }
  el.tocList.classList.remove("muted");
  el.tocList.innerHTML = "";

  // Map: href → chapter object (für Wortanzahl)
  const hrefToChapter = new Map();
  for (const ch of (S.book.chapters || [])) hrefToChapter.set(ch.href, ch);

  for (const t of toc) {
    const ch    = hrefToChapter.get(t.href) ?? null;
    const start = ch?.start ?? null;
    const count = ch ? (ch.end - ch.start) : null;
    const wpm   = S.settings.wpm || 500;
    const timeStr = count ? fmtTime(count, wpm) : "";

    const div = document.createElement("div");
    div.className = "item tocItem";
    div.dataset.href = t.href; // für Live-Update
    div.innerHTML = `
      <div><b>${escapeHtml(t.label || t.href)}</b></div>
      <div class="small tocMeta">
        ${count !== null ? `${count} Wörter` : "Kapitel"}
        ${timeStr ? `<span class="tocTime"> · ${timeStr}</span>` : ""}
      </div>`;
    div.addEventListener("click", () => {
      if (start !== null) jumpToIndex(start);
    });
    el.tocList.appendChild(div);
  }
}

// Lesezeiten neu berechnen wenn WPM geändert wird (ohne TOC neu zu bauen)
function updateTocTimes() {
  const wpm = S.settings.wpm || 500;
  const hrefToChapter = new Map();
  for (const ch of (S.book.chapters || [])) hrefToChapter.set(ch.href, ch);

  document.querySelectorAll(".tocItem").forEach(div => {
    const ch = hrefToChapter.get(div.dataset.href);
    if (!ch) return;
    const count = ch.end - ch.start;
    const span = div.querySelector(".tocTime");
    if (span) span.textContent = ` · ${fmtTime(count, wpm)}`;
  });
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
  document.dispatchEvent(new Event("rsvpBookLoaded"));
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
      chapters.push({ label, href, start, end });
      toc.push({ label, href });
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
    `<div class="h">📂 Schnellstart</div>
     <div class="b">Tippe <span class="k">Datei laden</span> und wähle eine <span class="k">.epub</span>, <span class="k">.txt</span> oder <span class="k">.pdf</span>. Dann mit <span class="k">Play</span> loslesen.</div>`,

    `<div class="h">🖱️ Tippen im Lesefenster</div>
     <div class="b">Linkes Drittel = <b>◀ zurück</b>, Mitte = <b>Play/Pause</b>, rechtes Drittel = <b>▶ vor</b>. Halten = schnell spulen.</div>`,

    `<div class="h">▶ Bedienleiste</div>
     <div class="b"><span class="k">◀</span> / <span class="k">▶</span> – Schritt zurück oder vor (halten = scrubben). <span class="k">🔖</span> – Lesezeichen. <span class="k">🔊</span> ☐ – Vorlesen aktivieren (läuft synchron mit dem RSVP-Tempo).</div>`,

    `<div class="h">🔊 Vorlesen</div>
     <div class="b">Das Kästchen <span class="k">🔊</span> neben Play aktiviert das Vorlesen. Stimme und Geschwindigkeit stellst du in <span class="k">⚙︎ Einstellungen</span> ein.</div>`,

    `<div class="h">⛶ Vollbild</div>
     <div class="b">Dehnt das Lesefenster auf die volle Höhe aus – ideal zum Experimentieren mit <b>Chunk</b> (mehrere Wörter). Mit <span class="k">✕</span> oder Esc beenden.</div>`,

    `<div class="h">☰ Sidebar</div>
     <div class="b"><b>Kapitel</b> = Inhaltsverzeichnis, <b>Lesezeichen</b> = Sprungmarken. Tippe einen Eintrag zum Hinspringen.</div>`,

    `<div class="h">⚙︎ Einstellungen</div>
     <div class="b"><b>WPM</b> (100–1000) = Lesegeschwindigkeit. <b>Chunk</b> = mehrere Wörter gleichzeitig. <b>ORP</b> = grüner Fokus-Buchstabe (35%-Position, RSVP-Standard). <b>Satzzeichenpause</b> = Extrazeit bei . , ! ?. Dazu: Auto-Stop, Schrift &amp; Farben, Sprachsteuerung, Vorlesen.</div>`,

    `<div class="h">🎙 Sprachsteuerung</div>
     <div class="b">In Einstellungen aktivierbar. Befehle: <b>play / weiter</b> · <b>pause / stop</b> · <b>vor / zurück</b> · <b>lesezeichen</b>.</div>`,

    `<div class="h">📚 Bibliothek</div>
     <div class="b">Bücher werden automatisch offline gespeichert (Leseposition, Lesezeichen, Cover). Antippen zum Wiederladen.</div>`,

    `<div class="h">⚠️ PDF-Hinweis &amp; Offline</div>
     <div class="b">Nur PDFs mit echtem Textlayer funktionieren (kein Scan/Bild). Als Home-Screen-App installieren für dauerhaften Speicher.</div>`,
  ];
  return lines.join("");
}


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

  // Clipboard-Import Button (Desktop + iOS direkt)
  document.getElementById("btnClipboardImport")?.addEventListener("click", () => {
    performClipboardImport(null);
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
    updateTocTimes();
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

  el.btnResetSettings?.addEventListener("click", () => {
    if (!confirm("Alle Einstellungen auf Standard zurücksetzen?")) return;
    S.settings = { ...DEFAULT_SETTINGS };
    saveSettingsToLS();
    applySettingsToUI();
    showCurrent();
    setStatus("Standard-Einstellungen wiederhergestellt ✅");
  });

  // Appearance live preview
  const syncAppearanceLive = () => {
    readSettingsFromUI();
    applyAppearance();
    updateAppearancePreview();
    showCurrent(); // re-render ORP highlight with new color
  };

  el.fontSize?.addEventListener("input", () => {
    S.settings.fontSize = Number(el.fontSize.value);
    if (el.fontSizeVal) el.fontSizeVal.textContent = String(S.settings.fontSize);
    syncAppearanceLive();
  });
  el.fontFamily?.addEventListener("change", () => { S.settings.fontFamily = el.fontFamily.value; syncAppearanceLive(); });
  el.textColor?.addEventListener("input",  () => { S.settings.textColor = el.textColor.value; syncAppearanceLive(); });
  el.bgColor?.addEventListener("input",    () => { S.settings.bgColor   = el.bgColor.value;   syncAppearanceLive(); });
  el.orpColor?.addEventListener("input",   () => { S.settings.orpColor  = el.orpColor.value;  syncAppearanceLive(); });

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

  el.btnBtcWallet?.addEventListener("click", () => {
    window.open("bitcoin:" + DONATE.btc, "_blank");
  });

  document.getElementById("btnExportAllMobile")?.addEventListener("click", () => exportLibrary({ mode: "all" }));

  /* ------------------------------------------
     TTS Read-Along Checkbox
  ------------------------------------------ */
  el.ttsReadAlong?.addEventListener("change", () => {
    if (_readAlongStopInProgress) return; // kein Re-entry
    if (el.ttsReadAlong.checked) {
      if (S.playing && !ReadAlong.active) {
        S.playing = false;
        if (S.timer) { clearTimeout(S.timer); S.timer = null; }
        if (el.btnPlay) el.btnPlay.textContent = "Play";
      }
      readAlongStart();
    } else {
      if (ReadAlong.active) readAlongStop();
    }
  });

  /* ------------------------------------------
     Vollbild – Lesefenster ausdehnen (kein Browser-Vollbild)
  ------------------------------------------ */
  const btnFS = document.getElementById("btnFullscreen");
  if (btnFS) {
    let _fsActive = false;

    // Floating Exit-Button der im Vollbild über der Karte schwebt
    const floatBtn = document.createElement("button");
    floatBtn.id = "btnFsFloat";
    floatBtn.className = "btn ghost";
    floatBtn.title = "Vollbild beenden (Esc)";
    floatBtn.textContent = "✕ Vollbild";
    floatBtn.style.cssText = "position:fixed;top:14px;right:14px;z-index:99999;display:none;" +
      "background:rgba(20,22,28,0.85);border:1px solid rgba(255,255,255,0.25);backdrop-filter:blur(10px);" +
      "padding:8px 16px;border-radius:10px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;" +
      "box-shadow:0 4px 20px rgba(0,0,0,0.5);letter-spacing:0.3px;";
    document.body.appendChild(floatBtn);

    const card    = document.getElementById("readerCard");
    const player   = card ? card.querySelector(".player") : null;
    const display2 = card ? card.querySelector(".display") : null;

    // Inline-Styles für die Lesebox im Vollbild
    const applyCardStyles = () => {
      if (card)    card.style.cssText    = "position:fixed;top:0;left:0;right:0;bottom:0;" +
        "z-index:9999;display:flex;flex-direction:column;overflow:hidden;" +
        "background:var(--reader-bg-color,#0b0c10);border-radius:0;border:none;" +
        "box-sizing:border-box;padding:24px;margin:0;";
      if (player)   player.style.cssText   = "flex:1;display:flex;flex-direction:column;min-height:0;";
      if (display2) display2.style.cssText = "flex:1;height:auto;min-height:0;border-radius:16px;";
    };

    const clearCardStyles = () => {
      if (card)    card.style.cssText    = "";
      if (player)  player.style.cssText  = "";
      if (display2) display2.style.cssText = "";
    };

    const enterReaderFullscreen = async () => {
      _fsActive = true;
      // Nativer Browser-Vollbild
      try {
        const el2 = document.documentElement;
        if (el2.requestFullscreen)            await el2.requestFullscreen();
        else if (el2.webkitRequestFullscreen) await el2.webkitRequestFullscreen();
      } catch(e) { /* ignorieren falls nicht erlaubt */ }
      applyCardStyles();
      btnFS.classList.add("isActive");
      floatBtn.style.display = "block";
    };

    const exitReaderFullscreen = async () => {
      _fsActive = false;
      clearCardStyles();
      btnFS.textContent = "⛶";
      btnFS.title = "Vollbild";
      btnFS.classList.remove("isActive");
      floatBtn.style.display = "none";
      // Nativen Vollbild beenden
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen)            await document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      } catch(e) {}
      requestAnimationFrame(() => setTopbarHeightVar());
    };

    // Wenn der Nutzer Esc/F11 drückt und der Browser selbst den Vollbild beendet
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && _fsActive) {
        _fsActive = false;
        clearCardStyles();
        btnFS.textContent = "⛶";
        btnFS.title = "Vollbild";
        btnFS.classList.remove("isActive");
        floatBtn.style.display = "none";
        requestAnimationFrame(() => setTopbarHeightVar());
      } else if (document.fullscreenElement && _fsActive) {
        // Sicherstellen dass Styles gesetzt sind nach fullscreenchange
        applyCardStyles();
      }
    });
    document.addEventListener("webkitfullscreenchange", () => {
      if (!document.webkitFullscreenElement && _fsActive) {
        _fsActive = false;
        clearCardStyles();
        btnFS.textContent = "⛶";
        btnFS.title = "Vollbild";
        btnFS.classList.remove("isActive");
        floatBtn.style.display = "none";
        requestAnimationFrame(() => setTopbarHeightVar());
      }
    });

    floatBtn.addEventListener("click", exitReaderFullscreen);

    btnFS.addEventListener("click", () => {
      _fsActive ? exitReaderFullscreen() : enterReaderFullscreen();
    });

    // Escape key to exit
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && _fsActive) exitReaderFullscreen();
    });
  }

  /* ------------------------------------------
     Sprachsteuerung
  ------------------------------------------ */
  initVoiceControl();
}

if (el.btnBack) el.btnBack.innerHTML = "◀";
if (el.btnFwd)  el.btnFwd.innerHTML  = "▶";

/* =====================================================
   Sprachsteuerung
   Kommandos (DE + EN): pause/stop · weiter/play/start · lesezeichen/bookmark
===================================================== */
function initVoiceControl() {
  const btn = document.getElementById("btnVoice");
  if (!btn) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.style.display = "none"; // Browser unterstützt es nicht
    return;
  }

  const COMMANDS = [
    { pattern: /^(pause|stop|stopp|halt)$/i,          action: () => { if (S.playing) stopPlayback(); } },
    { pattern: /^(weiter|play|start|los|go)$/i,       action: () => { if (!S.playing) togglePlay(); } },
    { pattern: /^(lesezeichen|bookmark|mark|merken)$/i, action: () => addBookmarkAtCurrent() },
    { pattern: /^(zurück|back|rückwärts)$/i,           action: () => step(-10) },
    { pattern: /^(vor|vorwärts|forward|skip)$/i,       action: () => step(+10) },
  ];

  let recognition = null;
  let active = false;
  let restartTimer = null;

  function createRecognition() {
    const r = new SR();
    r.lang = "de-DE";
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;

    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        // Alle Alternativen prüfen
        for (let a = 0; a < ev.results[i].length; a++) {
          const raw = (ev.results[i][a].transcript || "").trim().toLowerCase();
          // Letztes Wort (bei Nebensätzen wie "bitte pause")
          const word = raw.split(/\s+/).pop() || raw;
          for (const cmd of COMMANDS) {
            if (cmd.pattern.test(word) || cmd.pattern.test(raw)) {
              cmd.action();
              setStatus("\uD83C\uDF99 \u201E" + word + "\u201C erkannt");
              return;
            }
          }
        }
      }
    };

    r.onerror = (ev) => {
      if (ev.error === "no-speech") return; // normal, kein Lärm
      console.warn("SR error:", ev.error);
      if (ev.error === "not-allowed") {
        setStatus("Mikrofon verweigert.");
        deactivate();
      }
    };

    r.onend = () => {
      if (active) {
        // Auto-Neustart nach kurzem Delay (iOS beendet nach Stille)
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 300);
      }
    };

    return r;
  }

  function activate() {
    active = true;
    recognition = createRecognition();
    try {
      recognition.start();
      btn.classList.add("isActive", "voiceActive");
      btn.title = "Sprachsteuerung aktiv – tippen zum Beenden";
      setStatus("🎙 Sprachsteuerung aktiv");
    } catch(e) {
      console.warn("SR start:", e);
      deactivate();
    }
  }

  function deactivate() {
    active = false;
    clearTimeout(restartTimer);
    try { recognition?.stop(); } catch {}
    recognition = null;
    btn.classList.remove("isActive", "voiceActive");
    btn.title = "Sprachsteuerung";
    setStatus("🎙 Sprachsteuerung beendet");
  }

  btn.addEventListener("click", () => {
    active ? deactivate() : activate();
  });
}

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
  const POPOVERS = new Set(["settings", "help", "donate", "tts"]);

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
    // CSS already handles left:12px / right:12px constraints.
    // Just reset any previous inline overrides and ensure correct top.
    p.style.left  = "";
    p.style.right = "";
    p.style.top   = "calc(var(--topbarH) + 14px)";
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
  hookClose(document.getElementById("btnTtsClose"), "tts", "btnTts");

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
   HTML Clipboard Parser
   Extrahiert Haupttext + Überschriften für TOC
   Robust gegen archive.ph, Nachrichtenseiten, Blogs, etc.
------------------------------ */
function parseClipboardHtml(html, titleOverride) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1) Rauschen entfernen – aggressiv für News-Sites
  const NOISE = [
    // Technisches
    'script','style','noscript','iframe','canvas','template','svg','math',
    // Navigation & Struktur
    'nav','footer','header','aside',
    '[role="navigation"]','[role="banner"]','[role="contentinfo"]','[role="complementary"]','[role="search"]',
    // Cookie / DSGVO
    '[class*="cookie"]','[id*="cookie"]','[class*="consent"]','[id*="consent"]','[class*="gdpr"]',
    // Popups & Overlays
    '[class*="popup"]','[id*="popup"]','[class*="modal"]','[id*="modal"]',
    '[class*="overlay"]','[id*="overlay"]','[class*="lightbox"]',
    // Newsletter & Abo-Boxen
    '[class*="newsletter"]','[id*="newsletter"]','[class*="subscribe"]','[id*="subscribe"]',
    '[class*="signup"]','[class*="sign-up"]','[class*="registration"]',
    '[class*="abo"]','[class*="abonnement"]','[id*="abo"]',
    '[class*="paywall"]','[class*="subscription"]','[id*="paywall"]',
    '[class*="piano"]','[id*="piano"]', // Piano (Abo-System vieler AT/DE Verlage)
    '[class*="pv-"]',                    // Futurezone / Kurier nutzen pv- Prefix für Werbung
    // Werbung
    '[class*="ad-"]','[class*="-ad"]','[class*="advert"]','[class*="advertisement"]',
    '[class*="promo"]','[class*="sponsored"]','[class*="anzeige"]',
    '[class*="teaser"]',               // Teaser-Boxen = kein Artikelinhalt
    '[class*="outbrain"]','[class*="taboola"]','[class*="plista"]',
    // Social / Share
    '[class*="social"]','[class*="share-"]','[class*="-share"]','[class*="sharing"]',
    '[class*="follow"]',
    // Verwandte Artikel / Empfehlungen
    '[class*="related"]','[class*="recommend"]','[class*="mehr-zum"]',
    '[class*="also-read"]','[class*="read-more"]','[class*="weiterlesen"]',
    '[class*="more-stories"]','[class*="more-articles"]',
    // Navigation / Breadcrumb
    '[class*="breadcrumb"]','[class*="pagination"]','[class*="pager"]',
    '[class*="toolbar"]','[class*="topbar"]','[class*="navbar"]',
    '[class*="menu"]','[id*="menu"]',
    // Sidebar / Widget
    '[class*="sidebar-nav"]','[class*="nav-sidebar"]',
    '[class*="widget"]',
    // Kommentare
    '[class*="comment"]','[id*="comment"]','[class*="disqus"]',
    '[id*="comments"]','[class*="discussion"]',
    // Banner
    '[class*="banner"]','[role="banner"]',
    // Bilder-Captions (kein Fließtext)
    'figcaption','figure > figcaption',
    // Autor-Box (oft am Ende)
    '[class*="author-box"]','[class*="authorbox"]','[class*="author-bio"]',
    // Tags / Labels
    '[class*="tag-list"]','[class*="taglist"]','[class*="tags"]',
    '[class*="label"]',
    // Header IDs
    '[id*="header"]',
  ].join(',');

  try { doc.querySelectorAll(NOISE).forEach(n => { try { n.remove(); } catch {} }); } catch {}

  // 1b) Bildcredits auf DOM-Ebene entfernen:
  //     <p> die NUR "Credit: ..." oder "© ..." enthalten, rauswerfen
  try {
    doc.querySelectorAll('p, div, span').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t.length < 200 && (/^Credit[\s:]/i.test(t) || /^©\s/.test(t) || /^\((?:Bild|Foto|Image|Photo)\s*:/i.test(t))) {
        try { el.remove(); } catch {}
      }
    });
  } catch {}

  // 2) Seitentitel
  const rawTitle =
    doc.querySelector('h1')?.textContent?.trim() ||
    doc.querySelector('[class*="headline"]')?.textContent?.trim() ||
    doc.querySelector('[class*="title"]')?.textContent?.trim() ||
    doc.title?.trim() ||
    titleOverride || 'Artikel';
  const pageTitle = rawTitle.slice(0, 120);

  // 3) Hauptinhalt finden
  // Erst semantisch/explizit suchen …
  const CANDIDATES_CSS = [
    'article',
    '[role="main"]',
    'main',
    '[class*="article-body"]',
    '[class*="article-content"]',
    '[class*="article-text"]',
    '[class*="article__body"]',
    '[class*="article__content"]',
    '[class*="article__text"]',
    '[class*="post-body"]',
    '[class*="post-content"]',
    '[class*="post-text"]',
    '[class*="entry-content"]',
    '[class*="story-body"]',
    '[class*="story-content"]',
    '[class*="story-text"]',
    '[class*="content-body"]',
    '[class*="content-text"]',
    '[class*="page-content"]',
    '[class*="newsarticle"]',
    '[class*="article-copy"]',  // Futurezone / Kurier
    '[class*="copy-body"]',
    '[class*="text-body"]',
    '[class*="body-text"]',
    '[class*="richtext"]',
    '[class*="cms-content"]',
    '[class*="article-detail"]',
    '[id="article"]',
    '[id="content"]',
    '[id="main-content"]',
    '[id="main"]',
    '[id="text"]',
    '[id="article-body"]',
    '[id="article-content"]',
    '[id="story-content"]',
  ];

  let mainEl = null;
  for (const sel of CANDIDATES_CSS) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim().length > 200) { mainEl = el; break; }
  }

  // … sonst: "größter Textblock"-Heuristik (Readability-Prinzip)
  if (!mainEl) mainEl = findLargestTextBlock(doc);

  if (!mainEl) mainEl = doc.body || doc.documentElement;

  // 4) DOM traversieren – Wörter + Überschriften sammeln
  const words    = [];
  const rawHeads = []; // { label, wordIndex }

  // Zähler für Paragraph-Breaks (verhindert falsche Wortfusion)
  function addParagraphBreak() {
    // Kein eigentliches Wort, nur Sicherheitsabstand für Kapitelgrenzen
  }

  function walk(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt) words.push(...txt.split(' ').filter(Boolean));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = (node.tagName || '').toLowerCase();
    if (['script','style','noscript','iframe','svg','math','canvas'].includes(tag)) return;

    const cls   = ((node.className && typeof node.className === 'string') ? node.className : '').toLowerCase();
    const nodeId = (node.id || '').toLowerCase();
    const role  = (node.getAttribute ? (node.getAttribute('role') || '') : '').toLowerCase();
    const isH   = /^h[1-6]$/.test(tag);

    // Inline-Rauschen überspringen – aber NICHT wenn es ein echtes Heading-Tag ist
    if (!isH) {
      const isInlineNoise =
        cls.includes('newsletter') || cls.includes('subscribe') || cls.includes('signup') ||
        cls.includes('teaser')     || cls.includes('promo')      || cls.includes('advert') ||
        cls.includes('piano')      || cls.includes('paywall')    ||
        cls.includes('outbrain')   || cls.includes('taboola')    || cls.includes('plista')  ||
        cls.includes('related')    || cls.includes('recommend')  || cls.includes('weiterlesen') ||
        cls.includes('also-read')  || cls.includes('read-more')  || cls.includes('more-stories') ||
        cls.includes('share-')     || cls.includes('-share')     ||
        cls.includes('comment')    || cls.includes('widget')     ||
        cls.includes('caption')    || cls.includes('credit')     || cls.includes('photo-credit') ||
        cls.includes('image-credit') || cls.includes('pic-credit') ||
        cls.includes('gallery-caption') || cls.includes('slide-caption') ||
        nodeId.includes('newsletter') || nodeId.includes('subscribe') ||
        nodeId.includes('piano')   || nodeId.includes('paywall')  || nodeId.includes('comment');
      if (isInlineNoise) return;
    }
    const hasHeadingClass =
      cls.includes('heading') || cls.includes('headline') ||
      cls.includes('subhead') || cls.includes('chapter') ||
      cls.includes('subtitle') || cls.includes('section-title') ||
      cls.includes('article__title') || cls.includes('article-title') ||
      cls.includes('entry-title') || cls.includes('post-title') ||
      cls.includes('content-title') || cls.includes('text-title') ||
      cls.includes('story-headline') || cls.includes('page-title') ||
      role === 'heading';
    // Inline-style Heuristik: fett + größere Schrift als Fließtext
    const style = (node.getAttribute ? (node.getAttribute('style') || '') : '').toLowerCase();
    const looksLikeHeading = !isH && !hasHeadingClass &&
      (style.includes('font-size') && (style.includes('bold') || style.includes('700') || style.includes('800') || style.includes('900')));

    // iOS Reader Mode: <b>/<strong> allein in einem <p> = war ursprünglich eine Überschrift
    const isReaderModeHeading = !isH && !hasHeadingClass && !looksLikeHeading &&
      (tag === 'b' || tag === 'strong') &&
      node.parentNode?.tagName?.toLowerCase() === 'p' &&
      (node.parentNode.textContent || '').trim() === (node.textContent || '').trim() &&
      (node.textContent || '').trim().length >= 4 &&
      (node.textContent || '').trim().length <= 150;

    if (isH || hasHeadingClass || looksLikeHeading || isReaderModeHeading) {
      const label = (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (label.length >= 3 && label.length <= 120 && !/^\d+$/.test(label)) {
        rawHeads.push({ label, wordIndex: words.length });
      }
      // Bei Reader-Mode-Headings: children NICHT nochmal traversieren
      // (der Text wurde bereits als Heading erfasst, nicht als Fließtext)
      if (isReaderModeHeading) return;
    }

    for (const child of node.childNodes) walk(child);
  }

  walk(mainEl);

  // 4b) Credits entfernen und Heading-Indizes neu berechnen
  // Wir merken uns welche Wörter "Credit"-Blöcke sind (als Bitmask),
  // bauen dann ein sauberes Array und rechnen die rawHead-Indizes um.
  const keepMask = new Uint8Array(words.length).fill(1);
  for (let wi = 0; wi < words.length; wi++) {
    if (/^Credit[:\s]/i.test(words[wi]) || words[wi] === 'Credit:') {
      let end = wi + 1;
      while (end < words.length && end < wi + 20) {
        const w = words[end]; end++;
        if (/[.!?]$/.test(w)) break;
      }
      for (let k = wi; k < end; k++) keepMask[k] = 0;
      wi = end - 1;
    } else if (words[wi] === '©' || /^©/.test(words[wi])) {
      let end = Math.min(wi + 8, words.length);
      for (let k = wi; k < end; k++) keepMask[k] = 0;
      wi = end - 1;
    }
  }
  // Neue Wörter + Indexübersetzung aufbauen
  const oldToNew = new Int32Array(words.length).fill(-1);
  const cleanWords = [];
  for (let i = 0; i < words.length; i++) {
    if (keepMask[i]) { oldToNew[i] = cleanWords.length; cleanWords.push(words[i]); }
  }
  words.length = 0;
  words.push(...cleanWords);
  // rawHead-Indizes auf neue Positionen umrechnen
  for (const rh of rawHeads) {
    // Suche nächsten gültigen Index ab dem alten wordIndex
    let ni = rh.wordIndex;
    while (ni < oldToNew.length && oldToNew[ni] === -1) ni++;
    rh.wordIndex = ni < oldToNew.length ? oldToNew[ni] : words.length;
  }

  // 5) Duplikate + Kurz-Überschriften filtern
  const seen = new Set();
  const headings = rawHeads.filter(h => {
    const k = h.label.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 6) Kapitel + TOC
  const chapters = [];
  const toc      = [];

  for (let i = 0; i < headings.length; i++) {
    const h    = headings[i];
    const next = headings[i + 1];
    const start = h.wordIndex;
    const end   = next ? next.wordIndex : words.length;
    if (end - start < 3) continue;   // zu kleiner Abschnitt = vermutlich kein echtes Kapitel
    const href = `section-${i}`;
    chapters.push({ label: h.label, href, start, end });
    toc.push({ label: h.label, href });
  }

  // Fallback: kein Heading gefunden → ein Kapitel für den ganzen Artikel
  if (!chapters.length && words.length > 0) {
    chapters.push({ label: pageTitle, href: 'main', start: 0, end: words.length });
    toc.push({ label: pageTitle, href: 'main' });
  }

  return { words, chapters, toc, title: pageTitle };
}

/* Findet das Element mit der höchsten Textdichte (Readability-Heuristik) */
function findLargestTextBlock(doc) {
  let best = null;
  let bestScore = 0;

  const blocks = doc.querySelectorAll(
    'div, section, td, article, main'
  );

  for (const el of blocks) {
    // Überspringe sehr kleine oder sehr große Container
    const txt = el.textContent || '';
    if (txt.length < 200) continue;

    // Link-Anteil berechnen (hoher Anteil = Navigation)
    let linkLen = 0;
    el.querySelectorAll('a').forEach(a => { linkLen += (a.textContent || '').length; });
    const linkDensity = linkLen / Math.max(1, txt.length);
    if (linkDensity > 0.5) continue;

    // Absatz-Zähler (mehr <p> = höhere Wahrscheinlichkeit Artikeltext)
    const pCount = el.querySelectorAll('p').length;

    // Score: Textlänge * Absatzbonus, bestraft für hohe Link-Dichte
    const score = txt.length * (1 + pCount * 0.1) * (1 - linkDensity);

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

/* ----------------------------- */


/* -----------------------------
   Share Target / Shortcut Handler
------------------------------ */
async function performClipboardImport(titleOverride) {
  const overlay = document.getElementById("importOverlay");

  try {
    // Versuche zuerst text/html zu lesen (enthält Überschriften/Struktur)
    // Fallback auf readText() wenn die API nicht verfügbar ist
    let htmlContent = null;
    let plainText   = null;

    if (navigator.clipboard.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            htmlContent = await blob.text();
          }
          if (item.types.includes("text/plain")) {
            const blob = await item.getType("text/plain");
            plainText = await blob.text();
          }
        }
      } catch (readErr) {
        // Manche Browser verweigern clipboard.read() – Fallback
        console.warn("clipboard.read() fehlgeschlagen, nutze readText():", readErr);
        plainText = await navigator.clipboard.readText();
      }
    } else {
      plainText = await navigator.clipboard.readText();
    }

    // Primär HTML nutzen, sonst Plaintext
    const rawContent = htmlContent || plainText || "";

    if (!rawContent.trim()) {
      setStatus("Zwischenablage ist leer!");
      return;
    }

    let words = [];
    let chapters = [];
    let toc = [];
    let detectedTitle = titleOverride || 'Artikel';

    // URL erkennen: wenn Plaintext eine http(s)-URL ist, Artikel direkt abrufen
    const isUrl = !htmlContent && /^https?:\/\/\S+$/i.test(rawContent.trim());

    if (isUrl) {
      const targetUrl = rawContent.trim();
      setStatus("Lade Artikel von URL…", { sticky: true });
      try {
        // CORS-Proxy: allorigins.win gibt HTML als JSON zurück
        const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(targetUrl);
        const resp = await fetch(proxyUrl);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const json = await resp.json();
        const fetchedHtml = json.contents || "";
        if (!fetchedHtml) throw new Error("Leere Antwort vom Proxy");
        setStatus("HTML erkannt – extrahiere Artikel…", { sticky: true });
        const parsed = parseClipboardHtml(fetchedHtml, titleOverride);
        words         = parsed.words;
        chapters      = parsed.chapters;
        toc           = parsed.toc;
        detectedTitle = titleOverride || parsed.title;
      } catch(fetchErr) {
        console.warn("URL-Fetch fehlgeschlagen:", fetchErr);
        setStatus("URL konnte nicht geladen werden – bitte Seite kopieren und einfügen.", { sticky: true });
        return;
      }
    } else if (htmlContent) {
      setStatus("HTML erkannt – extrahiere Artikel…", { sticky: true });
      const parsed = parseClipboardHtml(htmlContent, titleOverride);
      words         = parsed.words;
      chapters      = parsed.chapters;
      toc           = parsed.toc;
      detectedTitle = parsed.title;
    } else {
      // Plaintext: schauen ob darin HTML-Fragmente stecken (iOS-Shortcut schickt manchmal HTML als Text)
      const looksLikeHtml = /<[a-z][^>]*>/i.test(rawContent.slice(0, 2000));
      if (looksLikeHtml) {
        setStatus("HTML erkannt – extrahiere Artikel…", { sticky: true });
        const parsed = parseClipboardHtml(rawContent, titleOverride);
        words         = parsed.words;
        chapters      = parsed.chapters;
        toc           = parsed.toc;
        detectedTitle = parsed.title;
      } else {
        // Reiner Plaintext bereinigen – smarte Extraktion des Artikeltexts
        let cleanPlain = rawContent;

        // 1) archive.today / archive.ph Header entfernen
        cleanPlain = cleanPlain.replace(/^archive\.\S[^\n]*\n[^\n]*\n?/im, '');

        // 2) Zeilen analysieren und Artikelbeginn finden
        const allLines = cleanPlain.split('\n').map(l => l.trim());

        // Bekannte Navigationsmuster die VOR dem Artikel stehen
        const NAV_PATTERNS = [
          /^(?:Zum Inhalt|Skip to content|Zur Navigation)/i,
          /^(?:Menü|Menu|Navigation|Hauptmenü)$/i,
          /^(?:Startseite|Home|Impressum|Datenschutz|AGB)$/i,
          /^(?:Anmelden|Login|Registrieren|Abonnieren|Abo)$/i,
          /^(?:Suche|Search|Suchen)$/i,
        ];

        // Finde den ersten "echten" Absatz:
        // - Länger als 80 Zeichen
        // - Enthält Leerzeichen (kein einzelnes Wort/Link)
        // - Enthält Punkt oder Komma (Prosa, kein Menüpunkt)
        // - Kommt in der ersten Hälfte des Textes
        let articleStartLine = 0;
        const halfWay = Math.floor(allLines.length * 0.5);
        for (let i = 0; i < halfWay; i++) {
          const l = allLines[i];
          if (l.length >= 80 && l.includes(' ') && (l.includes('.') || l.includes(','))) {
            articleStartLine = i;
            break;
          }
        }

        // Text ab Artikelbeginn zusammenbauen
        // Dabei: kurze Zeilen (Nav-Links, Überschriften < 5 Wörter) die nicht
        // direkt neben langen Absätzen stehen, herausfiltern
        const articleLines = allLines.slice(articleStartLine);

        // Zeilen am Ende abschneiden: "Mehr zum Thema", Kommentare, Footer
        const TAIL_PATTERNS = [
          /^(?:Mehr zum Thema|Ähnliche Artikel|Verwandte Themen|Das könnte Sie auch interessieren)/i,
          /^(?:Kommentare?|Comments?)\s*(?:\(\d+\))?$/i,
          /^(?:Schreiben Sie|Hinterlassen Sie)/i,
          /^(?:Newsletter|Abonnieren Sie)/i,
          /^(?:Impressum|Datenschutz|Cookie|AGB|©\s*20)/i,
        ];
        let tailStart = articleLines.length;
        for (let i = 0; i < articleLines.length; i++) {
          if (TAIL_PATTERNS.some(p => p.test(articleLines[i]))) {
            tailStart = i;
            break;
          }
        }
        const bodyLines = articleLines.slice(0, tailStart);

        // Credit-Zeilen und sehr kurze Navigationszeilen entfernen
        const filteredLines = bodyLines.filter(l => {
          if (!l) return false;
          if (/^Credit[:\s]/i.test(l)) return false;
          if (/^©\s/.test(l)) return false;
          if (/^\((?:Bild|Foto|Image):/i.test(l)) return false;
          // Sehr kurze Zeilen die wie Nav-Links aussehen (< 4 Wörter, kein Satzzeichen)
          const wordCount = l.split(/\s+/).length;
          if (wordCount <= 3 && !l.includes('.') && !l.includes(',') && !l.includes('?')) return false;
          return true;
        });

        cleanPlain = filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

        // Titel aus erstem nicht-leerem Satz
        const firstLine = cleanPlain.split('\n').find(l => l.trim().length > 10) || '';
        detectedTitle = titleOverride || firstLine.slice(0, 80) || 'Artikel';
        words = wordsFromText(cleanPlain);
        // Fallback-Kapitel für Plaintext (kein HTML, keine Überschriften erkennbar)
        if (words.length > 0) {
          const label = titleOverride || detectedTitle || "Artikel";
          chapters = [{ label, href: 'main', start: 0, end: words.length }];
          toc      = [{ label, href: 'main' }];
        } else {
          chapters = [];
          toc      = [];
        }
        detectedTitle = titleOverride || "Geteilter Artikel";
      }
    }

    if (!words.length) {
      setStatus("Kein lesbarer Text gefunden.");
      return;
    }

    // Sicherheitsnetz: chapters/toc IMMER befüllen wenn Wörter vorhanden
    if (!chapters.length) {
      const safeLabel = titleOverride || detectedTitle || 'Artikel';
      chapters = [{ label: safeLabel, href: 'main', start: 0, end: words.length }];
      toc      = [{ label: safeLabel, href: 'main' }];
    }

    const bookTitle = titleOverride || detectedTitle || "Geteilter Artikel";

    let bookIdToLoad;
    try {
      const allBooks = await idbGetAll();
      const existing = allBooks.find(b =>
        (b.title === bookTitle || b.title === "Geteilter Artikel") &&
        b.words.length === words.length
      );
      if (existing) {
        bookIdToLoad = existing.id;
        // Kapitel IMMER aktualisieren – auch wenn vorherige Version schon welche hatte
        // (könnten aus altem Code stammen oder veraltet sein)
        await saveBookToLibrary({ ...existing, chapters, toc, words, updatedAt: Date.now() });
      }
    } catch(e) {}

    if (!bookIdToLoad) {
      const newId = `share_${Date.now()}`;
      bookIdToLoad = newId;
      await saveBookToLibrary({
        id: newId,
        title: bookTitle,
        author: "Web-Import",
        coverDataUrl: "",
        words: words,
        chapters: chapters,
        toc: toc,
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

/* =====================================================
   TTS – Text-to-Speech Engine
   Zwei Modi: Browser SpeechSynthesis + OpenAI TTS API
===================================================== */
const TTS = {
  mode: "local",          // "local" | "openai"
  playing: false,
  sentences: [],
  idx: 0,
  utterance: null,
  audioQueue: [],
  audioIdx: 0,
  currentAudio: null,
};

/* Satz-Splitter: natürliche Pausen an ., !, ?, …, Doppelpunkt */
function splitSentences(text) {
  if (!text) return [];
  // Split nach Satzzeichen, aber Abkürzungen (z.B. "Dr.") schonen
  return text
    .replace(/([.!?…]+)\s+/g, "$1\n")
    .replace(/([;:])\s+/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 1);
}

function ttsGetText() {
  // Aktuelle Position bis Kapitelende oder Textende
  const words = S.words;
  if (!words.length) return "";
  const start = S.idx;
  // Finde Kapitelende
  const ch = (S.book.chapters || []).find(c => start >= c.start && start < c.end);
  const end = ch ? ch.end : words.length;
  return words.slice(start, end).join(" ");
}

/* ── BROWSER TTS ── */
function ttsLocalPopulateVoices() {
  const sel = document.getElementById("ttsVoiceSelect");
  if (!sel) return;
  const voices = window.speechSynthesis?.getVoices() || [];
  sel.innerHTML = "";

  // Sortierung: Deutsch zuerst, dann nach Name
  const sorted = [...voices].sort((a, b) => {
    const aDE = a.lang.startsWith("de") ? 0 : 1;
    const bDE = b.lang.startsWith("de") ? 0 : 1;
    if (aDE !== bDE) return aDE - bDE;
    return a.name.localeCompare(b.name);
  });

  for (const v of sorted) {
    const opt = document.createElement("option");
    opt.value = v.name;
    // Premium-Stimmen markieren
    const isPremium = v.name.includes("Premium") || v.name.includes("Enhanced") ||
                      v.name.includes("Neural")   || v.name.includes("Natural");
    opt.textContent = `${isPremium ? "⭐ " : ""}${v.name} (${v.lang})`;
    // Lokale Stimme bevorzugen
    if (v.localService) opt.textContent += " [lokal]";
    sel.appendChild(opt);
  }

  // Beste DE-Stimme vorauswählen
  const best = sorted.find(v => v.lang.startsWith("de") && (v.name.includes("Premium") || v.name.includes("Enhanced") || v.name.includes("Neural")))
             || sorted.find(v => v.lang.startsWith("de"))
             || sorted[0];
  if (best) sel.value = best.name;
}

function ttsLocalSpeak(sentences, startIdx, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const sel    = document.getElementById("ttsVoiceSelect");
  const rate   = parseFloat(document.getElementById("ttsRate")?.value  || "1");
  const pitch  = parseFloat(document.getElementById("ttsPitch")?.value || "1");
  const voices = window.speechSynthesis.getVoices();
  const voice  = voices.find(v => v.name === sel?.value) || null;

  let i = startIdx;
  TTS.idx = i;

  function speakNext() {
    if (!TTS.playing || i >= sentences.length) {
      onEnd();
      return;
    }

    const u = new SpeechSynthesisUtterance(sentences[i]);
    u.lang  = voice?.lang || "de-DE";
    u.rate  = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;

    u.onstart = () => {
      TTS.idx = i;
      ttsShowSentence(sentences[i], i, sentences.length);
    };
    u.onend = () => {
      i++;
      speakNext();
    };
    u.onerror = (e) => {
      if (e.error !== "interrupted") { console.warn("TTS:", e); onEnd(); }
    };

    TTS.utterance = u;
    window.speechSynthesis.speak(u);
  }

  speakNext();
}

/* ── OPENAI TTS ── */
async function ttsOpenAISpeak(sentences, startIdx, onEnd) {
  const apiKey = document.getElementById("ttsApiKey")?.value?.trim();
  if (!apiKey) { alert("Bitte OpenAI API-Key eingeben."); onEnd(); return; }

  const voice = document.getElementById("ttsOaiVoice")?.value || "nova";
  const speed = parseFloat(document.getElementById("ttsOaiRate")?.value || "1.0");

  // Sätze in Chunks aufteilen (API-Limit ~4096 Zeichen)
  const CHUNK = 800; // Zeichen pro Request
  const chunks = [];
  let buf = "";
  for (const s of sentences.slice(startIdx)) {
    if (buf.length + s.length > CHUNK && buf) { chunks.push(buf.trim()); buf = ""; }
    buf += s + " ";
  }
  if (buf.trim()) chunks.push(buf.trim());

  let ci = 0;

  async function playNext() {
    if (!TTS.playing || ci >= chunks.length) { onEnd(); return; }

    ttsShowSentence(chunks[ci], ci, chunks.length);

    try {
      const resp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",      // höchste Qualität
          voice: voice,
          input: chunks[ci],
          speed: speed,
          response_format: "mp3",
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      TTS.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        ci++;
        playNext();
      };
      audio.onerror = (e) => { console.warn("Audio error", e); onEnd(); };
      await audio.play();

    } catch(e) {
      console.error("OpenAI TTS:", e);
      alert("OpenAI TTS Fehler: " + e.message);
      onEnd();
    }
  }

  playNext();
}

/* ── Shared UI Helpers ── */
function ttsShowSentence(text, idx, total) {
  const el = document.getElementById("ttsCurrentSentence");
  if (el) el.textContent = text?.slice(0, 120) + (text?.length > 120 ? "…" : "");
  const bar = document.getElementById("ttsProgressBar");
  if (bar) bar.style.width = (total > 0 ? Math.round((idx / total) * 100) : 0) + "%";
}

function ttsSetPlaying(on) {
  TTS.playing = on;
  const btnPlay = document.getElementById("ttsBtnPlay");
  const btnStop = document.getElementById("ttsBtnStop");
  const prog    = document.getElementById("ttsProgress");
  if (btnPlay) { btnPlay.disabled = on; btnPlay.textContent = "▶ Vorlesen"; }
  if (btnStop) btnStop.disabled = !on;
  if (prog)    prog.classList.toggle("hidden", !on);
}

function ttsStop() {
  TTS.playing = false;
  window.speechSynthesis?.cancel();
  if (TTS.currentAudio) { TTS.currentAudio.pause(); TTS.currentAudio = null; }
  ttsSetPlaying(false);
  document.getElementById("ttsCurrentSentence").textContent = "";
}

function ttsStart() {
  if (!S.words.length) { setStatus("Kein Text geladen."); return; }

  const text = ttsGetText();
  if (!text.trim()) { setStatus("Kein Text an dieser Position."); return; }

  TTS.sentences = splitSentences(text);
  if (!TTS.sentences.length) return;

  ttsSetPlaying(true);

  const onEnd = () => ttsSetPlaying(false);

  if (TTS.mode === "openai") {
    ttsOpenAISpeak(TTS.sentences, 0, onEnd);
  } else {
    ttsLocalSpeak(TTS.sentences, 0, onEnd);
  }
}

/* =====================================================
   TTS READ-ALONG – Stimme führt, RSVP-Anzeige folgt
   ===================================================== */

let _readAlongStopInProgress = false;

function readAlongStop() {
  if (!ReadAlong.active) return;
  _readAlongStopInProgress = true;
  ReadAlong.active = false;
  try { window.speechSynthesis?.cancel(); } catch {}
  ReadAlong.utterance = null;
  if (ReadAlong._fallbackTimer) {
    clearTimeout(ReadAlong._fallbackTimer);
    ReadAlong._fallbackTimer = null;
  }
  if (ReadAlong._keepAlive) {
    clearInterval(ReadAlong._keepAlive);
    ReadAlong._keepAlive = null;
  }
  ReadAlong._manualPaused = false;
  if (el.ttsReadAlong) el.ttsReadAlong.checked = false;
  if (el.btnPlay) el.btnPlay.textContent = "Play";
  S.playing = false;
  S.timer = null;
  _readAlongStopInProgress = false;
}

async function readAlongStart() {
  if (!window.speechSynthesis) {
    setStatus("Sprachausgabe nicht verfügbar.");
    if (el.ttsReadAlong) el.ttsReadAlong.checked = false;
    return;
  }
  if (!S.words.length) {
    setStatus("Kein Text geladen.");
    if (el.ttsReadAlong) el.ttsReadAlong.checked = false;
    return;
  }

  // Normale RSVP-Wiedergabe anhalten
  S.playing = false;
  if (S.timer) { clearTimeout(S.timer); S.timer = null; }

  ReadAlong.active   = true;
  ReadAlong.startIdx = S.idx;

  // Stimme & Einstellungen laden
  const voiceSelect = document.getElementById("ttsVoiceSelect");
  let voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    voices = await new Promise(res => {
      const t = setTimeout(() => res(window.speechSynthesis.getVoices()), 500);
      window.speechSynthesis.onvoiceschanged = () => { clearTimeout(t); res(window.speechSynthesis.getVoices()); };
    });
  }
  let voice = null;
  if (voiceSelect?.value) voice = voices.find(v => v.name === voiceSelect.value) || null;
  const rate  = parseFloat(document.getElementById("ttsRate")?.value  || "1.0");
  const pitch = parseFloat(document.getElementById("ttsPitch")?.value || "1.0");
  const lang  = document.documentElement.lang || "de-DE";

  if (!ReadAlong.active) return;

  // ── Wörter ab aktueller Position ──────────────────────────────────────────
  const slice    = S.words.slice(S.idx);
  const baseIdx  = S.idx; // globaler Wortindex des ersten Worts in slice

  // ── Sätze ermitteln (Satzgrenzen für Chunk-Splitting) ─────────────────────
  // Wir teilen an Satzgrenzen, maximal CHUNK_WORDS Wörter pro Utterance.
  // So bleibt jeder Chunk kurz genug für zuverlässige onboundary-Events.
  const CHUNK_WORDS = 80;
  const sentenceEndRe = /[.!?;]\s*$/;
  const chunks = [];
  let ci = 0;
  while (ci < slice.length) {
    let end = Math.min(ci + CHUNK_WORDS, slice.length);
    // Versuch, an Satzende zu brechen
    if (end < slice.length) {
      for (let k = end - 1; k > ci + 10; k--) {
        if (sentenceEndRe.test(slice[k])) { end = k + 1; break; }
      }
    }
    const words = slice.slice(ci, end);
    let cPos = 0;
    const offsets = words.map((w, j) => {
      const o = { charStart: cPos, charEnd: cPos + w.length, wordIdx: baseIdx + ci + j };
      cPos += w.length + 1;
      return o;
    });
    chunks.push({ text: words.join(" "), offsets, startWordIdx: baseIdx + ci });
    ci = end;
  }

  // ── UI auf "läuft" ────────────────────────────────────────────────────────
  if (el.btnPlay) el.btnPlay.textContent = "Pause";
  S.playing = true;

  // ── showWord: einzige Stelle die das angezeigte Wort ändert ──────────────
  let lastShownIdx = -1;
  const showWord = (wIdx) => {
    if (!ReadAlong.active) return;
    if (wIdx === lastShownIdx) return; // kein unnötiges Redraw
    lastShownIdx = wIdx;
    const chunk = S.settings.chunk;
    S.idx = wIdx;
    const end   = clamp(wIdx + chunk, wIdx, S.words.length);
    const token = S.words.slice(wIdx, end).join(" ");
    renderToken(token);
    updateProgressUI();
  };

  // ── Chunk-basierte Sprachausgabe mit präzisem onboundary-Tracking ─────────
  let chunkIdx        = 0;
  let boundariesSeen  = 0;  // wie viele boundary-Events in diesem Chunk
  let speakStartTime  = 0;  // performance.now() beim onstart
  let wordTimings     = []; // [{ wordIdx, estimatedMs }] für Fallback

  // Vorberechnung der geschätzten Wort-Zeiten (Karaoke-Fallback)
  const buildWordTimings = (offsets, text) => {
    // Durchschnittliche Silbenzahl pro Wort schätzen (4 Zeichen ≈ 1 Silbe ≈ 200ms bei rate=1)
    const msPerChar = (60000 / (200 * rate)) / 5; // rough: 200wpm, 5chars/word avg
    return offsets.map(o => ({
      wordIdx: o.wordIdx,
      estimatedMs: o.charStart * msPerChar
    }));
  };

  const speakChunk = () => {
    if (!ReadAlong.active || chunkIdx >= chunks.length) {
      if (ReadAlong.active) {
        readAlongStop();
        setStatus("Vorlesen beendet ✅");
        persistCurrentBookState().catch(() => {});
      }
      return;
    }

    const { text, offsets } = chunks[chunkIdx];
    boundariesSeen = 0;
    wordTimings = buildWordTimings(offsets, text);
    let lastOffsetIdx = 0;

    const u = new SpeechSynthesisUtterance(text);
    u.lang  = lang;
    u.rate  = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;
    ReadAlong.utterance = u;

    // ── onboundary: primärer Sync-Mechanismus ─────────────────────────────
    u.onboundary = (ev) => {
      if (!ReadAlong.active) return;
      if (ev.name !== "word") return;
      // Fallback-Timer sofort stoppen sobald boundary-Events kommen
      if (ReadAlong._fallbackTimer) {
        clearTimeout(ReadAlong._fallbackTimer);
        ReadAlong._fallbackTimer = null;
      }
      boundariesSeen++;
      const charIdx = ev.charIndex;
      // Passendes Wort suchen: charIdx liegt innerhalb [charStart, charEnd)
      let matched = null;
      for (let i = lastOffsetIdx; i < offsets.length; i++) {
        if (charIdx >= offsets[i].charStart && charIdx < offsets[i].charEnd + 1) {
          matched = offsets[i];
          lastOffsetIdx = i;
          break;
        }
        // Falls charIdx > charEnd, weitersuchen
        if (charIdx >= offsets[i].charEnd) {
          matched = offsets[i]; // vorläufig merken
          lastOffsetIdx = i;
        }
      }
      if (!matched && offsets[lastOffsetIdx]) matched = offsets[lastOffsetIdx];
      if (matched) showWord(matched.wordIdx);
    };

    // ── onstart: Fallback-Karaoke-Timer (falls onboundary nicht feuert) ───
    u.onstart = () => {
      speakStartTime = performance.now();
      // Zeige erstes Wort sofort
      if (offsets[0]) showWord(offsets[0].wordIdx);

      // Starte Fallback-Timer nur wenn nach 300ms noch kein boundary kam
      const kickoff = setTimeout(() => {
        if (!ReadAlong.active || boundariesSeen > 0) return; // boundary läuft schon
        // Echter Karaoke-Fallback: Wörter basierend auf verstrichener Zeit anzeigen
        let timingIdx = 0;
        const tick = () => {
          if (!ReadAlong.active) return;
          // Sobald boundaries feuern: Fallback aufgeben
          if (boundariesSeen > 0) {
            ReadAlong._fallbackTimer = null;
            return;
          }
          const elapsed = performance.now() - speakStartTime;
          // Alle Wörter anzeigen die laut Timing schon gesprochen sein sollten
          while (timingIdx < wordTimings.length && wordTimings[timingIdx].estimatedMs <= elapsed) {
            showWord(wordTimings[timingIdx].wordIdx);
            timingIdx++;
          }
          if (timingIdx < wordTimings.length) {
            const nextMs = wordTimings[timingIdx].estimatedMs - elapsed;
            ReadAlong._fallbackTimer = setTimeout(tick, Math.max(16, nextMs));
          }
        };
        tick();
      }, 300);
      // kickoff Timer auch im _fallbackTimer speichern damit er bei Pause gecleard wird
      if (!ReadAlong._fallbackTimer) ReadAlong._fallbackTimer = kickoff;
    };

    u.onend = () => {
      if (ReadAlong._fallbackTimer) { clearTimeout(ReadAlong._fallbackTimer); ReadAlong._fallbackTimer = null; }
      if (!ReadAlong.active) return;
      chunkIdx++;
      speakChunk();
    };

    u.onerror = (e) => {
      if (ReadAlong._fallbackTimer) { clearTimeout(ReadAlong._fallbackTimer); ReadAlong._fallbackTimer = null; }
      if (e.error === "interrupted" || e.error === "canceled") return;
      console.warn("Read-Along Fehler:", e.error);
      readAlongStop();
    };

    if (chunkIdx === 0) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        if (!ReadAlong.active) return;
        try { window.speechSynthesis.resume(); } catch(e2) {}
        window.speechSynthesis.speak(u);
      }, 100);
    } else {
      window.speechSynthesis.speak(u);
    }
  };

  speakChunk();

  // Chrome: periodisch resume() damit speechSynthesis nicht einfriert
  ReadAlong._keepAlive = setInterval(() => {
    if (!ReadAlong.active) { clearInterval(ReadAlong._keepAlive); ReadAlong._keepAlive = null; return; }
    if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 5000);
}

function ttsReadAlongSpeakToken() { /* no-op */ }
function ttsReadAlongSync()       { /* no-op */ }

/* ── Init TTS Panel ── */
function initTtsPanel() {
  // Voices laden (kann async sein)
  if (window.speechSynthesis) {
    ttsLocalPopulateVoices();
    window.speechSynthesis.onvoiceschanged = ttsLocalPopulateVoices;
  }

  // API-Key aus localStorage laden
  const saved = localStorage.getItem("tts_oai_key");
  if (saved) {
    const inp = document.getElementById("ttsApiKey");
    if (inp) inp.value = saved;
  }
  const savedMode = localStorage.getItem("tts_mode");
  if (savedMode) ttsSetMode(savedMode);

  // Modus-Buttons
  document.getElementById("ttsModeLocal")?.addEventListener("click",  () => ttsSetMode("local"));
  document.getElementById("ttsModeOpenAI")?.addEventListener("click", () => ttsSetMode("openai"));

  // API-Key speichern beim Tippen
  document.getElementById("ttsApiKey")?.addEventListener("input", (e) => {
    localStorage.setItem("tts_oai_key", e.target.value);
  });

  // Slider live
  document.getElementById("ttsRate")?.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value).toFixed(2);
    document.getElementById("ttsRateVal").textContent = v;
  });
  document.getElementById("ttsPitch")?.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value).toFixed(2);
    document.getElementById("ttsPitchVal").textContent = v;
  });
  document.getElementById("ttsOaiRate")?.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value).toFixed(2);
    document.getElementById("ttsOaiRateVal").textContent = v;
  });

  // Buttons
  document.getElementById("ttsBtnPlay")?.addEventListener("click", ttsStart);
  document.getElementById("ttsBtnStop")?.addEventListener("click", ttsStop);
  document.getElementById("ttsBtnTest")?.addEventListener("click", () => {
    const test = "Das klingt so. Schöne Stimme? Ich bin bereit vorzulesen!";
    window.speechSynthesis?.cancel();
    if (TTS.currentAudio) { TTS.currentAudio.pause(); TTS.currentAudio = null; }
    if (TTS.mode === "openai") {
      TTS.playing = true;
      TTS.sentences = [test];
      ttsOpenAISpeak([test], 0, () => { TTS.playing = false; });
    } else {
      TTS.playing = true;
      TTS.sentences = [test];
      ttsLocalSpeak([test], 0, () => { TTS.playing = false; });
    }
  });

  // Play-Button freischalten wenn Text geladen
  const updateTtsBtn = () => {
    const btn = document.getElementById("ttsBtnPlay");
    if (btn) btn.disabled = !S.words.length;
  };
  // Überwache S.words über MutationObserver wäre zu aufwändig → kurz nach loadBook aufrufen
  document.addEventListener("rsvpBookLoaded", updateTtsBtn);
}

function ttsSetMode(mode) {
  TTS.mode = mode;
  localStorage.setItem("tts_mode", mode);
  const localPanel = document.getElementById("ttsLocalPanel");
  const oaiPanel   = document.getElementById("ttsOpenAIPanel");
  const btnLocal   = document.getElementById("ttsModeLocal");
  const btnOai     = document.getElementById("ttsModeOpenAI");

  if (mode === "openai") {
    localPanel?.classList.add("hidden");
    oaiPanel?.classList.remove("hidden");
    btnLocal?.classList.add("ghost");    btnLocal?.classList.remove("active");
    btnOai?.classList.remove("ghost");   btnOai?.classList.add("active");
  } else {
    oaiPanel?.classList.add("hidden");
    localPanel?.classList.remove("hidden");
    btnOai?.classList.add("ghost");      btnOai?.classList.remove("active");
    btnLocal?.classList.remove("ghost"); btnLocal?.classList.add("active");
  }
}

/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  setTopbarHeightVar();
  try { bindUI(); } catch (e) { console.error("bindUI failed", e); }
  initDockPanels();
  initTtsPanel();
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
