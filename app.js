/* -----------------------------
   RSVP Reader V2 (iPad / Offline)
------------------------------ */

const $ = (id) => document.getElementById(id);

const el = {
  // file + status
  file: $("file"),
  status: $("status"),

  // header info
  headerInfo: $("headerInfo"),
  coverImg: $("coverImg"),
  bookTitle: $("bookTitle"),
  bookAuthor: $("bookAuthor"),
  prog: $("prog"),
  wpmVal: $("wpmVal"),
  chapVal: $("chapVal"),
  pinHeader: $("pinHeader"),

  // reader
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
};

const LS_KEY = "rsvp_reader_v2_settings";

/* -----------------------------
   IndexedDB (Library storage)
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

async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* -----------------------------
   State
------------------------------ */
const S = {
  words: [],
  idx: 0,
  playing: false,
  timer: null,

  // book meta / id
  book: {
    id: null,
    title: "—",
    author: "—",
    coverDataUrl: "",
    chapters: [], // [{label, href, start, end}]
    toc: [],      // [{label, href}]
  },

  // bookmarks: [{id, label, idx, createdAt}]
  bookmarks: [],

  // stop logic
  playStartedAt: 0,        // ms
  wordsAtPlayStart: 0,     // idx snapshot
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

function setStatus(msg) { el.status.textContent = msg; }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

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

function isSentenceEnd(token) {
  return /[.!?…。！？]/.test(token);
}
function isPunctHeavy(token) {
  return /[.!?…。！？;:]/.test(token) || /[,，]/.test(token);
}

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

  el.word.innerHTML =
    `${before}${segBefore}<span class="orp">${segOrp}</span>${segAfter}${after}`;
}

/* -----------------------------
   UI helpers (sidebar/shelf/header)
------------------------------ */
function show(elm) { elm.classList.remove("hidden"); }
function hide(elm) { elm.classList.add("hidden"); }

function syncHeaderUI() {
  el.bookTitle.textContent = S.book.title || "—";
  el.bookAuthor.textContent = S.book.author || "—";
  el.coverImg.src = S.book.coverDataUrl || "";
  el.coverImg.style.display = S.book.coverDataUrl ? "block" : "none";
  el.pinHeader.checked = !!S.settings.pinHeader;
}

function syncShelfUI() {
  el.pinShelf.checked = !!S.settings.pinShelf;
}

function openHeader() { show(el.headerInfo); }
function closeHeader() { if (!S.settings.pinHeader) hide(el.headerInfo); }

function openShelf() { show(el.shelf); }
function closeShelf() { if (!S.settings.pinShelf) hide(el.shelf); }

function openSidebar() { show(el.sidebar); }
function closeSidebar() { hide(el.sidebar); }

function openSettings() { show(el.settingsModal); }
function closeSettings() { hide(el.settingsModal); }

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
    if (p && typeof p === "object") {
      S.settings = { ...S.settings, ...p };
    }
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

  syncHeaderUI();
  syncShelfUI();
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
   Progress + chapter tracking
------------------------------ */
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
   Player
------------------------------ */
function stopPlayback(reason = "") {
  S.playing = false;
  if (S.timer) clearTimeout(S.timer);
  S.timer = null;
  S.pendingStop = false;
  el.btnPlay.textContent = "Play";
  if (reason) setStatus(reason);
  persistCurrentBookState(); // save idx/bookmarks to DB
}

function checkAutoStop(nextToken, nextIdxAfterAdvance) {
  // If already pending, stop at sentence end
  if (S.pendingStop) {
    if (isSentenceEnd(nextToken)) return true;
    return false;
  }

  // Stop after minutes
  if (S.settings.stopMinsOn && S.playStartedAt) {
    const elapsedMs = Date.now() - S.playStartedAt;
    const limitMs = S.settings.stopMins * 60 * 1000;
    if (limitMs > 0 && elapsedMs >= limitMs) {
      S.pendingStop = true;
    }
  }

  // Stop after words
  if (S.settings.stopWordsOn) {
    const limit = S.settings.stopWords;
    if (limit > 0) {
      const readWords = nextIdxAfterAdvance - S.wordsAtPlayStart;
      if (readWords >= limit) {
        S.pendingStop = true;
      }
    }
  }

  // Stop at chapter end
  if (S.settings.stopChapter) {
    const ch = getChapterByWordIndex(nextIdxAfterAdvance);
    const prevCh = getChapterByWordIndex(nextIdxAfterAdvance - 1);
    // If we crossed into a new chapter => pending stop
    if (prevCh && ch && prevCh.href !== ch.href) {
      S.pendingStop = true;
    }
  }

  if (S.pendingStop && isSentenceEnd(nextToken)) return true;
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

  // advance
  S.idx = end;

  // auto stop logic (use current token and new idx)
  if (checkAutoStop(token, S.idx)) {
    stopPlayback("Auto-Stop ✅");
    return;
  }

  let delay = msPerToken(S.settings.wpm, chunk);
  if (S.settings.punct && isPunctHeavy(token)) delay += S.settings.punctMs;

  // end
  if (end >= total) {
    stopPlayback("Ende ✅");
    return;
  }

  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;

  if (S.playing) {
    stopPlayback();
    return;
  }
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
  persistCurrentBookState();
}

function resetPosition() {
  stopPlayback();
  S.idx = 0;
  showCurrent();
  persistCurrentBookState();
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
  persistCurrentBookState();
  setStatus("Lesezeichen gesetzt 🔖");
}

function jumpToIndex(idx) {
  stopPlayback();
  S.idx = clamp(idx, 0, Math.max(0, S.words.length - 1));
  showCurrent();
  persistCurrentBookState();
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

/* -----------------------------
   TOC / Chapters list
------------------------------ */
function renderToc() {
  const toc = S.book.toc || [];
  if (!toc.length) {
    el.tocList.classList.add("muted");
    el.tocList.textContent = "Kein Kapitelindex gefunden.";
    return;
  }
  el.tocList.classList.remove("muted");
  el.tocList.innerHTML = "";

  // Map href->chapter start word
  const hrefToStart = new Map();
  for (const ch of (S.book.chapters || [])) hrefToStart.set(ch.href, ch.start);

  for (const t of toc) {
    const start = hrefToStart.get(t.href) ?? null;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div><b>${escapeHtml(t.label || t.href)}</b></div><div class="small">${start !== null ? `Springe zu Wort #${start}` : "Kapitel (ohne Mapping)"}</div>`;
    div.addEventListener("click", () => {
      if (start !== null) jumpToIndex(start);
      closeSidebar();
    });
    el.tocList.appendChild(div);
  }
}

/* -----------------------------
   Load / Save current book state
------------------------------ */
function computeBookIdFromFile(file) {
  // Not cryptographically stable, but good enough for a library key
  return `f_${file.name}_${file.size}_${file.lastModified || 0}`;
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

    // update shelf view
    await renderShelf();
  } catch {}
}

async function saveBookToLibrary(payload) {
  await idbPut(payload);
  await renderShelf();
}

async function renderShelf() {
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

    const img = document.createElement("img");
    img.alt = "Cover";
    img.src = b.coverDataUrl || "";
    img.style.display = b.coverDataUrl ? "block" : "none";

    const t = document.createElement("div");
    t.className = "t";
    t.textContent = b.title || "—";

    const a = document.createElement("div");
    a.className = "a";
    a.textContent = b.author || "";

    card.appendChild(img);
    card.appendChild(t);
    card.appendChild(a);

    card.addEventListener("click", async () => {
      await loadBookFromLibrary(b.id);
      if (!S.settings.pinShelf) closeShelf();
    });

    el.shelfList.appendChild(card);
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
  if (S.settings.pinHeader) openHeader();
  if (S.settings.pinShelf) openShelf();
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
  try {
    doc.querySelectorAll("script,style,noscript,svg,math,iframe").forEach(n => n.remove());
  } catch {}

  let txt = "";
  if (doc?.body?.textContent) txt = doc.body.textContent;
  else if (doc?.documentElement?.textContent) txt = doc.documentElement.textContent;

  return String(txt || "").replace(/\s+/g, " ").trim();
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

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(blob);
  });
}

async function loadEpubFromFile(file) {
  if (typeof window.ePub !== "function") {
    throw new Error("EPUB Engine (epub.js) nicht geladen.");
  }

  setStatus("Lade EPUB…");
  const buf = await file.arrayBuffer();

  const book = ePub(buf);
  await book.ready;

  // metadata
  let title = file.name;
  let author = "";
  try {
    const md = await book.loaded.metadata;
    title = md?.title || title;
    author = md?.creator || md?.author || "";
  } catch {}

  const coverDataUrl = await extractCoverDataUrl(book);

  // toc
  let toc = [];
  try {
    const nav = await book.loaded.navigation;
    toc = (nav?.toc || []).map(x => ({ label: x.label, href: x.href }));
  } catch {}

  const spine = book.spine?.spineItems || [];
  if (!spine.length) throw new Error("EPUB: Keine Spine-Items gefunden.");

  // Build word stream + chapter boundaries
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
    const doc = item.document;
    const rawText = cleanDocText(doc);
    item.unload();

    if (rawText.length < 400) continue;

    const words = wordsFromText(rawText);
    if (words.length < 80) continue;

    const chStart = wordCursor;
    wordCursor += words.length;
    const chEnd = wordCursor;

    const labelGuess = (toc.find(t => (t.href || "").split("#")[0] === item.href)?.label)
      || `Kapitel ${chapters.length + 1}`;

    chapters.push({
      label: labelGuess,
      href: item.href,
      start: chStart,
      end: chEnd,
    });

    allParts.push(rawText);
    kept++;
  }

  const combined = allParts.join("\n\n");
  const words = wordsFromText(combined);

  if (!words.length) throw new Error("Kein Text gefunden (EPUB evtl. Scan/Bild oder ungewöhnlich).");

  // map toc hrefs: normalize (# anchors weg)
  toc = toc.map(t => ({ ...t, href: (t.href || "").split("#")[0] }));

  return {
    id: computeBookIdFromFile(file),
    title, author, coverDataUrl,
    words, chapters, toc,
  };
}

/* -----------------------------
   File handling
------------------------------ */
async function loadTxtFromFile(file) {
  setStatus("Lade TXT…");
  const txt = await file.text();
  const words = wordsFromText(txt);
  return {
    id: computeBookIdFromFile(file),
    title: file.name,
    author: "",
    coverDataUrl: "",
    words,
    chapters: [],
    toc: [],
  };
}

async function handleFile(file) {
  try {
    stopPlayback();
    S.words = [];
    S.idx = 0;
    S.bookmarks = [];

    const ext = (file.name.split(".").pop() || "").toLowerCase();

    let parsed;
    if (ext === "epub") parsed = await loadEpubFromFile(file);
    else if (ext === "txt") parsed = await loadTxtFromFile(file);
    else throw new Error("Bitte .epub oder .txt laden.");

    // If exists in library, merge stored bookmarks/progress
    const existing = await idbGet(parsed.id);
    const idx = existing?.idx ?? 0;
    const marks = existing?.bookmarks ?? [];

    // set state
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

    // save full book into library (so it can be reopened without file)
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
    // auto open header if pinned
    if (S.settings.pinHeader) openHeader();
  } catch (e) {
    setStatus(`Fehler: ${e?.message || e}`);
    console.error(e);
    S.words = [];
    updateProgressUI();
    showCurrent();
  }
}

/* -----------------------------
   Events
------------------------------ */
function bindUI() {
  // top buttons
  el.btnSidebar.addEventListener("click", () => openSidebar());
  el.btnSidebarClose.addEventListener("click", closeSidebar);

  el.btnHeader.addEventListener("click", () => {
    if (el.headerInfo.classList.contains("hidden")) openHeader();
    else closeHeader();
  });

  el.btnSettings.addEventListener("click", openSettings);
  el.btnSettingsClose.addEventListener("click", closeSettings);

  el.btnShelf.addEventListener("click", () => openShelf());
  el.btnShelfClose.addEventListener("click", closeShelf);

  // tabs
  el.tabToc.addEventListener("click", () => setTab("toc"));
  el.tabMarks.addEventListener("click", () => setTab("marks"));

  // settings controls
  el.wpm.addEventListener("input", () => {
    S.settings.wpm = Number(el.wpm.value);
    el.wpmVal.textContent = String(S.settings.wpm);
  });
  el.chunk.addEventListener("input", () => {
    S.settings.chunk = Number(el.chunk.value);
    el.chunkVal.textContent = String(S.settings.chunk);
  });
  el.orp.addEventListener("change", () => { S.settings.orp = el.orp.checked; showCurrent(); });
  el.punct.addEventListener("change", () => { S.settings.punct = el.punct.checked; });
  el.punctMs.addEventListener("input", () => { S.settings.punctMs = Number(el.punctMs.value); el.punctVal.textContent = String(S.settings.punctMs); });

  el.stopChapter.addEventListener("change", () => { S.settings.stopChapter = el.stopChapter.checked; });
  el.stopWordsOn.addEventListener("change", () => { S.settings.stopWordsOn = el.stopWordsOn.checked; });
  el.stopWords.addEventListener("input", () => { S.settings.stopWords = Number(el.stopWords.value || 0); });
  el.stopMinsOn.addEventListener("change", () => { S.settings.stopMinsOn = el.stopMinsOn.checked; });
  el.stopMins.addEventListener("input", () => { S.settings.stopMins = Number(el.stopMins.value || 0); });

  el.pinHeader.addEventListener("change", () => {
    S.settings.pinHeader = el.pinHeader.checked;
    saveSettingsToLS();
    if (S.settings.pinHeader) openHeader();
    else closeHeader();
  });
  el.pinShelf.addEventListener("change", () => {
    S.settings.pinShelf = el.pinShelf.checked;
    saveSettingsToLS();
    if (S.settings.pinShelf) openShelf();
    else closeShelf();
  });

  el.btnSaveSettings.addEventListener("click", () => {
    readSettingsFromUI();
    saveSettingsToLS();
    applySettingsToUI();
    setStatus("Einstellungen gespeichert ✅");
  });

  el.btnLoadSettings.addEventListener("click", () => {
    loadSettingsFromLS();
    applySettingsToUI();
    setStatus("Einstellungen geladen ✅");
  });

  // player
  el.btnPlay.addEventListener("click", togglePlay);
  el.btnBack.addEventListener("click", () => step(-1));
  el.btnFwd.addEventListener("click", () => step(+1));
  el.btnReset.addEventListener("click", resetPosition);
  el.btnBookmark.addEventListener("click", () => addBookmarkAtCurrent());

  // seek
  el.seek.addEventListener("input", () => {
    stopPlayback();
    S.idx = Number(el.seek.value);
    showCurrent();
    persistCurrentBookState();
  });

  // file
  el.file.addEventListener("change", (ev) => {
    const f = ev.target.files?.[0];
    if (f) setTimeout(() => handleFile(f), 0);
    ev.target.value = "";
  });

  // tap zones
  el.display.addEventListener("click", (ev) => {
    const r = el.display.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const third = r.width / 3;
    if (x < third) step(-1);
    else if (x > 2*third) step(+1);
    else togglePlay();
  });

  // keyboard (optional)
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(+1);
    if (e.key.toLowerCase() === "b") addBookmarkAtCurrent();
  });

  // close modals on backdrop click
  el.settingsModal.addEventListener("click", (e) => {
    if (e.target === el.settingsModal) closeSettings();
  });
}

/* -----------------------------
   Boot
------------------------------ */
(async function boot() {
  loadSettingsFromLS();
  applySettingsToUI();
  bindUI();
  updateProgressUI();
  showCurrent();
  await renderShelf();

  // If pinned UI, show it at start
  if (S.settings.pinHeader) openHeader();
  if (S.settings.pinShelf) openShelf();

  setTab("toc");
  setStatus("Warte auf Datei…");
})();
