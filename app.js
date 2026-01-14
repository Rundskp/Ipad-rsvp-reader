/* -----------------------------
   RSVP Reader V2.1 (iPad / Offline)
   - Library in IndexedDB (books)
   - Storage persistence request
   - Help modal + Donate modal
------------------------------ */
console.log("RSVP app.js loaded ✅", new Date().toISOString());

const $ = (id) => document.getElementById(id);

/* ---------- Elements (must exist) ---------- */
const el = {
  file: $("file"),
  status: $("status"),

  // Header info
  headerInfo: $("headerInfo"),
  coverImg: $("coverImg"),
  bookTitle: $("bookTitle"),
  bookAuthor: $("bookAuthor"),
  prog: $("prog"),
  wpmVal: $("wpmVal"),
  chapVal: $("chapVal"),
  pinHeader: $("pinHeader"),

  // Reader
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

  // top buttons
  btnSidebar: $("btnSidebar"),
  btnHeader: $("btnHeader"),
  btnSettings: $("btnSettings"),
  btnShelf: $("btnShelf"),
  btnHelp: $("btnHelp"),
  btnDonate: $("btnDonate"),
  btnExportAll: $("btnExportAll"),
  btnExportSelected: $("btnExportSelected"),
  importFile: $("importFile"),


  // sidebar
  sidebar: $("sidebar"),
  btnSidebarClose: $("btnSidebarClose"),
  tabToc: $("tabToc"),
  tabMarks: $("tabMarks"),
  tocPane: $("tocPane"),
  marksPane: $("marksPane"),
  tocList: $("tocList"),
  marksList: $("marksList"),

  // settings modal
  settingsModal: $("settingsModal"),
  btnSettingsClose: $("btnSettingsClose"),
  wpm: $("wpm"),
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

  // shelf
  shelf: $("shelf"),
  shelfList: $("shelfList"),
  btnShelfClose: $("btnShelfClose"),
  pinShelf: $("pinShelf"),

  // Help modal
  helpBackdrop: $("helpBackdrop"),
  btnHelpClose: $("btnHelpClose"),
  helpBody: $("helpBody"),

  // Donate modal
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
// === DEBUG: zeigt ob Buttons/IDs existieren + ob Click ankommt ===
(() => {
  const missing = Object.entries(el)
    .filter(([k,v]) => !v)
    .map(([k]) => k);

  console.log("RSVP app.js loaded ✅", new Date().toISOString());
  if (missing.length) console.warn("Missing DOM IDs:", missing);

  // Click-Probes (wenn das NICHT loggt, ist bindUI nicht aktiv oder alte Datei)
  window.__probe = {
    save: () => console.log("PROBE: save clicked ✅"),
    load: () => console.log("PROBE: load clicked ✅"),
    qrpp: () => console.log("PROBE: paypal-qr clicked ✅"),
  };
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
  // mode: "all" | "selected"
  const all = await idbGetAll();
  if (!all.length) {
    setStatus("Nix zu exportieren (Bibliothek leer).");
    return;
  }

  let books = all;

  if (mode === "selected") {
    const picked = [...document.querySelectorAll(".bookPick")]
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute("data-id"));
    books = all.filter(b => picked.includes(b.id));
    if (!books.length) {
      setStatus("Keine Auswahl getroffen.");
      return;
    }
  }

  // Export-Paket: enthält Settings + Bücher
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

    // Settings übernehmen (optional, aber gewünscht)
    if (p.settings && typeof p.settings === "object") {
      S.settings = { ...S.settings, ...p.settings };
      saveSettingsToLS();
      applySettingsToUI();
    }

    // Bücher rein in IndexedDB
    let count = 0;
    for (const b of p.books) {
      // minimal sanity
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
    chapters: [], // [{label, href, start, end}]
    toc: [],      // [{label, href}]
  },

  bookmarks: [],

  // stop logic
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

    pinHeader: false,
    pinShelf: false,
  },
};

function setStatus(msg) { if (el.status) el.status.textContent = msg; }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function show(x) { x?.classList?.remove("hidden"); }
function hide(x) { x?.classList?.add("hidden"); }

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
  el.wpm.value = String(S.settings.wpm);
  el.wpmVal.textContent = String(S.settings.wpm);

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

  el.pinHeader.checked = !!S.settings.pinHeader;
  el.pinShelf.checked = !!S.settings.pinShelf;

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

  S.settings.pinHeader = el.pinHeader.checked;
  S.settings.pinShelf = el.pinShelf.checked;
}

/* -----------------------------
   Header + progress
------------------------------ */
function syncHeaderUI() {
  el.bookTitle.textContent = S.book.title || "—";
  el.bookAuthor.textContent = S.book.author || "—";
  if (S.book.coverDataUrl) {
    el.coverImg.src = S.book.coverDataUrl;
    el.coverImg.style.display = "block";
  } else {
    el.coverImg.style.display = "none";
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

  el.prog.textContent = `${pct}%`;
  el.pos.textContent = String(idx);
  el.total.textContent = String(total);

  el.seek.max = String(Math.max(0, total - 1));
  el.seek.value = String(idx);
  el.seek.disabled = total === 0;

  const ch = getChapterByWordIndex(idx);
  el.chapVal.textContent = ch?.label || "—";

  el.btnPlay.disabled = total === 0;
  el.btnBack.disabled = total === 0;
  el.btnFwd.disabled = total === 0;
  el.btnReset.disabled = total === 0;
  el.btnBookmark.disabled = total === 0;
}

function showCurrent() {
  if (!S.words.length) {
    el.word.textContent = "—";
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
  el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
  persistCurrentBookState().catch(()=>{});
}

function checkAutoStop(currentToken, nextIdxAfterAdvance) {
  if (S.pendingStop) {
    if (isSentenceEnd(currentToken)) return true;
    return false;
  }

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

  if (S.pendingStop && isSentenceEnd(currentToken)) return true;
  return false;
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
  el.btnPlay.textContent = "Pause";
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
  if (which === "toc") {
    el.tabToc.classList.add("active");
    el.tabMarks.classList.remove("active");
    show(el.tocPane);
    hide(el.marksPane);
  } else {
    el.tabMarks.classList.add("active");
    el.tabToc.classList.remove("active");
    hide(el.tocPane);
    show(el.marksPane);
  }
}

function renderToc() {
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
    div.innerHTML = `<div><b>${escapeHtml(t.label || t.href)}</b></div><div class="small">${start !== null ? `Springe zu Wort #${start}` : "Kapitel"}</div>`;
    div.addEventListener("click", () => {
      if (start !== null) jumpToIndex(start);
      hide(el.sidebar);
    });
    el.tocList.appendChild(div);
  }
}

/* -----------------------------
   Library (save/load that MUST persist)
------------------------------ */
function stableBookId(file) {
  // iOS can change lastModified; keep it stable-ish:
  // name + size is usually enough, add type too
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
    await renderShelf();
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
  try {
    const all = await idbGetAll();
    all.sort((a,b) => (b.updatedAt||b.createdAt||0) - (a.updatedAt||a.createdAt||0));

    if (!all.length) {
      el.shelfList.classList.add("muted");
      el.shelfList.textContent = "Noch keine Bücher gespeichert.";
      return;
    }
    el.shelfList.classList.remove("muted");
    el.shelfList.innerHTML = "";

    for (const b of all) {
      const card = document.createElement("div");
        card.className = "bookCard";

        // Top row: checkbox + title
        const top = document.createElement("div");
        top.className = "bookCardTop";

        const pick = document.createElement("input");
        pick.type = "checkbox";
        pick.className = "bookPick";
        pick.setAttribute("data-id", b.id);

        const t = document.createElement("div");
        t.className = "t";
        t.textContent = b.title || "—";

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

        // Klick auf Card lädt Buch – aber Checkbox-Klick soll nicht laden:
        pick.addEventListener("click", (ev) => ev.stopPropagation());

        card.addEventListener("click", async () => {
          await loadBookFromLibrary(b.id);
          if (!S.settings.pinShelf) hide(el.shelf);
        });

        el.shelfList.appendChild(card);

    }
  } catch (e) {
    console.error("renderShelf failed", e);
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

  setStatus(`Geladen: ${S.book.title} (${S.words.length} Wörter)`);
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

  setStatus("Lade EPUB…");
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

    setStatus(`Extrahiere Kapitel ${i+1}/${spine.length}… (${kept} gesammelt)`);

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
  setStatus("Lade TXT…");
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
    else throw new Error("Bitte .epub oder .txt laden.");

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

    // Save full book so it can be reopened without file
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

    setStatus(`Geladen: ${S.book.title} (${S.words.length} Wörter)`);
  } catch (e) {
    setStatus(`Fehler: ${e?.message || e}`);
    console.error(e);
    S.words = [];
    updateProgressUI();
    showCurrent();
  }
}

/* -----------------------------
   Help modal content
------------------------------ */
function buildHelpHtml() {
  const lines = [
    `<div class="h">Schnellstart</div>
     <div class="b">Tippe <span class="k">Datei laden</span>, wähle ein <span class="k">.epub</span> oder <span class="k">.txt</span>. Danach mit <span class="k">Play</span> starten.</div>`,

    `<div class="h">Tippen im Lesefeld</div>
     <div class="b">Links = zurück, Mitte = Play/Pause, rechts = vor.</div>`,

    `<div class="h">Sidebar ☰</div>
     <div class="b"><span class="k">Kapitel</span> zeigt den Index (wenn im EPUB vorhanden). <span class="k">Lesezeichen</span> sind Sprungmarken.</div>`,

    `<div class="h">Lesezeichen 🔖</div>
     <div class="b">Setzt ein Lesezeichen bei der aktuellen Wortposition. In der Sidebar kannst du direkt hinspringen.</div>`,

    `<div class="h">Cover/Titel 🛈</div>
     <div class="b">Zeigt Cover + Titel + Fortschritt. Mit <span class="k">fixieren</span> bleibt es dauerhaft sichtbar.</div>`,

    `<div class="h">Einstellungen ⚙︎</div>
     <div class="b">WPM = Geschwindigkeit, Chunk = mehrere Wörter pro Anzeige, ORP = Fokus-Buchstabe, Satzzeichenpause = Extra-Zeit bei Punkt/Komma.</div>`,

    `<div class="h">Auto-Stop</div>
     <div class="b">Stoppt am Kapitelende oder nach X Wörtern oder nach X Minuten – aber immer erst am Satzende, damit’s nicht mitten im Satz abwürgt.</div>`,

    `<div class="h">Bibliothek 📚</div>
     <div class="b">Gelesene Bücher werden offline gespeichert (inkl. Cover & Lesezeichen). Tippe ein Buch an, um es ohne Datei neu zu öffnen.</div>`,

    `<div class="h">Wenn etwas „weg“ ist</div>
     <div class="b">Safari im privaten Modus löscht/blocked Speicher. Am besten über die Home-Bildschirm-App nutzen. Außerdem: iOS räumt manchmal auf – deshalb wird persistenter Speicher angefordert.</div>`,
  ];
  return lines.join("");
}

/* -----------------------------
   Donate modal helpers
------------------------------ */
const DONATE = {
  paypal: "https://paypal.me/rophko",
  // Du hast mir die Adresse mal geschickt – ich nehme exakt die:
  btc: "bc1qwr08y9ngmvplpr8tuk4w34rl4pkryur8u4cf5f"
};

function qrUrl(data) {
  // Online-Fallback: QR braucht Internet (Spenden-Link braucht’s eh)
  // QR server: simple, no key
  const u = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(data);
  return u;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Kopiert ✅");
  } catch {
    // iOS fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setStatus("Kopiert ✅");
  }
}

/* -----------------------------
   Bind UI
------------------------------ */
function bindUI() {
  /* ---------- helpers ---------- */
  const toggle = (node) => {
    if (!node) return;
    node.classList.toggle("hidden");
  };

  /* ---------- File ---------- */
  if (el.file) {
    el.file.addEventListener("change", (ev) => {
      const f = ev.target.files?.[0];
      if (f) setTimeout(() => handleFile(f), 0);
      ev.target.value = "";
    });
  }

  /* ---------- Export / Import ---------- */
  el.btnExportAll?.addEventListener("click", () => exportLibrary({ mode: "all" }));
  el.btnExportSelected?.addEventListener("click", () => exportLibrary({ mode: "selected" }));

  el.importFile?.addEventListener("change", (ev) => {
    const f = ev.target.files?.[0];
    if (f) importLibraryFromJsonFile(f);
    ev.target.value = "";
  });

  /* ---------- Player ---------- */
  el.btnPlay?.addEventListener("click", togglePlay);
  el.btnBack?.addEventListener("click", () => step(-1));
  el.btnFwd?.addEventListener("click", () => step(+1));
  el.btnReset?.addEventListener("click", resetPosition);
  el.btnBookmark?.addEventListener("click", addBookmarkAtCurrent);

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

  /* ---------- Sidebar ---------- */
  el.btnSidebar?.addEventListener("click", () => el.sidebar?.classList.remove("hidden"));
  el.btnSidebarClose?.addEventListener("click", () => el.sidebar?.classList.add("hidden"));
  el.tabToc?.addEventListener("click", () => setTab("toc"));
  el.tabMarks?.addEventListener("click", () => setTab("marks"));

  /* ---------- Header panel ---------- */
  el.btnHeader?.addEventListener("click", () => {
    if (!el.headerInfo) return;
    if (el.headerInfo.classList.contains("hidden")) el.headerInfo.classList.remove("hidden");
    else if (!S.settings.pinHeader) el.headerInfo.classList.add("hidden");
  });

  el.pinHeader?.addEventListener("change", () => {
    S.settings.pinHeader = !!el.pinHeader.checked;
    saveSettingsToLS();
    if (S.settings.pinHeader) el.headerInfo?.classList.remove("hidden");
    else el.headerInfo?.classList.add("hidden");
  });

  /* ---------- Shelf ---------- */
  el.btnShelf?.addEventListener("click", () => el.shelf?.classList.remove("hidden"));
  el.btnShelfClose?.addEventListener("click", () => {
    if (!S.settings.pinShelf) el.shelf?.classList.add("hidden");
  });

  el.pinShelf?.addEventListener("change", () => {
    S.settings.pinShelf = !!el.pinShelf.checked;
    saveSettingsToLS();
    if (S.settings.pinShelf) el.shelf?.classList.remove("hidden");
    else el.shelf?.classList.add("hidden");
  });

  /* ---------- Settings modal ---------- */
  el.btnSettings?.addEventListener("click", () => el.settingsModal?.classList.remove("hidden"));
  el.btnSettingsClose?.addEventListener("click", () => el.settingsModal?.classList.add("hidden"));

  el.settingsModal?.addEventListener("click", (e) => {
    if (e.target === el.settingsModal) el.settingsModal.classList.add("hidden");
  });

  // Live updates (damit Save nicht zwingend nötig ist, aber trotzdem funktioniert)
  el.wpm?.addEventListener("input", () => {
    S.settings.wpm = Number(el.wpm.value);
    el.wpmVal.textContent = String(S.settings.wpm);
  });

  el.chunk?.addEventListener("input", () => {
    S.settings.chunk = Number(el.chunk.value);
    el.chunkVal.textContent = String(S.settings.chunk);
  });

  el.orp?.addEventListener("change", () => {
    S.settings.orp = !!el.orp.checked;
    showCurrent();
  });

  el.punct?.addEventListener("change", () => {
    S.settings.punct = !!el.punct.checked;
  });

  el.punctMs?.addEventListener("input", () => {
    S.settings.punctMs = Number(el.punctMs.value);
    el.punctVal.textContent = String(S.settings.punctMs);
  });

  el.stopChapter?.addEventListener("change", () => { S.settings.stopChapter = !!el.stopChapter.checked; });
  el.stopWordsOn?.addEventListener("change", () => { S.settings.stopWordsOn = !!el.stopWordsOn.checked; });
  el.stopWords?.addEventListener("input", () => { S.settings.stopWords = Number(el.stopWords.value || 0); });
  el.stopMinsOn?.addEventListener("change", () => { S.settings.stopMinsOn = !!el.stopMinsOn.checked; });
  el.stopMins?.addEventListener("input", () => { S.settings.stopMins = Number(el.stopMins.value || 0); });

  // ✅ Save/Load Buttons (das ist der Kern deines Problems)
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

  /* ---------- Help modal ---------- */
  el.btnHelp?.addEventListener("click", () => {
    if (el.helpBody) el.helpBody.innerHTML = buildHelpHtml();
    el.helpBackdrop?.classList.remove("hidden");
  });

  el.btnHelpClose?.addEventListener("click", () => el.helpBackdrop?.classList.add("hidden"));
  el.helpBackdrop?.addEventListener("click", (e) => {
    if (e.target === el.helpBackdrop) el.helpBackdrop.classList.add("hidden");
  });

  /* ---------- Donate modal + QR ---------- */
  el.btnDonate?.addEventListener("click", () => {
    if (el.btcAddr) el.btcAddr.textContent = DONATE.btc;

    if (el.paypalQrWrap) el.paypalQrWrap.style.display = "none";
    if (el.btcQrWrap) el.btcQrWrap.style.display = "none";

    el.donateBackdrop?.classList.remove("hidden");
  });

  el.btnDonateClose?.addEventListener("click", () => el.donateBackdrop?.classList.add("hidden"));
  el.donateBackdrop?.addEventListener("click", (e) => {
    if (e.target === el.donateBackdrop) el.donateBackdrop.classList.add("hidden");
  });

  el.btnPaypalQR?.addEventListener("click", () => {
    const u = DONATE.paypal;
    if (!el.paypalQrImg || !el.paypalQrWrap) return;

    el.paypalQrImg.onload = () => {};
    el.paypalQrImg.onerror = () => {
      if (el.paypalQrHint) el.paypalQrHint.textContent = "QR konnte nicht geladen werden (Netz/Blocker).";
    };

    el.paypalQrImg.src = qrUrl(u);
    el.paypalQrWrap.style.display = "block";
    if (el.paypalQrHint) el.paypalQrHint.textContent = "";
  });

  el.btnCopyBtc?.addEventListener("click", () => copyToClipboard(DONATE.btc));

  el.btnBtcQR?.addEventListener("click", () => {
    const uri = "bitcoin:" + DONATE.btc;
    if (!el.btcQrImg || !el.btcQrWrap) return;

    el.btcQrImg.onerror = () => {
      if (el.btcQrHint) el.btcQrHint.textContent = "QR konnte nicht geladen werden (Netz/Blocker).";
    };

    el.btcQrImg.src = qrUrl(uri);
    el.btcQrWrap.style.display = "block";
    if (el.btcQrHint) el.btcQrHint.textContent = "";
  });
}


/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  // Try persistence early
  const p = await ensurePersistentStorage();
  if (p.ok && p.persisted === false) {
    // not an error, just info
    console.log("Storage not persisted (may be evicted by iOS).");
  }

  loadSettingsFromLS();
  applySettingsToUI();
  bindUI();
  setTab("toc");

  updateProgressUI();
  showCurrent();

  await renderShelf();

  if (S.settings.pinHeader) show(el.headerInfo); else hide(el.headerInfo);
  if (S.settings.pinShelf) show(el.shelf); else hide(el.shelf);

  setStatus("Warte auf Datei…");
})().catch((e) => {
  console.error(e);
  setStatus("Boot-Fehler: IndexedDB blockiert? (Privater Modus?)");
});
