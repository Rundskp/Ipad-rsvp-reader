// iPad RSVP Reader (EPUB/TXT) – alles clientseitig
// - EPUB über epub.js
// - Text wird aus allen Spine-Items extrahiert (Safari/iPad robust via item.load())
// - RSVP Anzeige mit WPM / Chunk / ORP / Satzzeichen-Pausen
// - Position & Settings in localStorage

const $ = (id) => document.getElementById(id);

const el = {
  file: $("file"),
  status: $("status"),
  prog: $("prog"),
  wpm: $("wpm"),
  wpmVal: $("wpmVal"),
  chunk: $("chunk"),
  chunkVal: $("chunkVal"),
  orp: $("orp"),
  punct: $("punct"),
  punctMs: $("punctMs"),
  punctVal: $("punctVal"),

  display: $("display"),
  word: $("word"),

  btnPlay: $("btnPlay"),
  btnBack: $("btnBack"),
  btnFwd: $("btnFwd"),
  btnReset: $("btnReset"),
  btnMark: $("btnMark"),

  seek: $("seek"),
  pos: $("pos"),
  total: $("total"),
};

const LS_KEY = "rsvp_reader_v1";

const S = {
  words: [],
  idx: 0,
  playing: false,
  timer: null,
  lastLoadedName: null,

  settings: {
    wpm: 360,
    chunk: 1,
    orp: true,
    punct: true,
    punctMs: 200,
  },

  mark: null, // bookmark word index
};

function saveState() {
  const payload = {
    idx: S.idx,
    mark: S.mark,
    lastLoadedName: S.lastLoadedName,
    settings: S.settings,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p?.settings) S.settings = { ...S.settings, ...p.settings };
    if (typeof p?.idx === "number") S.idx = p.idx;
    if (typeof p?.mark === "number") S.mark = p.mark;
    if (typeof p?.lastLoadedName === "string") S.lastLoadedName = p.lastLoadedName;
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
}

function setStatus(msg) {
  el.status.textContent = msg;
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function wordsFromText(txt) {
  const cleaned = String(txt || "")
    .replace(/\u00AD/g, "")                // soft hyphen
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];
  return cleaned.split(" ").filter(Boolean);
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderToken(token) {
  if (!S.settings.orp) {
    el.word.innerHTML = escapeHtml(token);
    return;
  }

  const safe = escapeHtml(token);
  const m = token.match(/[A-Za-zÄÖÜäöüß0-9]+/);
  if (!m) {
    el.word.innerHTML = safe;
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

  el.btnPlay.disabled = total === 0;
  el.btnBack.disabled = total === 0;
  el.btnFwd.disabled = total === 0;
  el.btnReset.disabled = total === 0;
  el.btnMark.disabled = total === 0;
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
  saveState();
}

function stop() {
  S.playing = false;
  if (S.timer) clearTimeout(S.timer);
  S.timer = null;
  el.btnPlay.textContent = "Play";
}

function scheduleNext() {
  if (!S.playing) return;

  const total = S.words.length;
  if (!total) { stop(); return; }

  const chunk = S.settings.chunk;
  const start = S.idx;
  const end = clamp(start + chunk, start, total);

  const token = S.words.slice(start, end).join(" ");
  renderToken(token);

  updateProgressUI();

  // Advance
  S.idx = end;

  // Timing
  let delay = msPerToken(S.settings.wpm, chunk);
  if (S.settings.punct && isPunctHeavy(token)) {
    delay += S.settings.punctMs;
  }

  saveState();

  // End handling
  if (end >= total) {
    stop();
    return;
  }

  S.timer = setTimeout(scheduleNext, delay);
}

function togglePlay() {
  if (!S.words.length) return;

  if (S.playing) {
    stop();
    return;
  }
  S.playing = true;
  el.btnPlay.textContent = "Pause";
  scheduleNext();
}

function step(deltaChunks) {
  if (!S.words.length) return;
  stop();

  const chunk = S.settings.chunk;
  const delta = deltaChunks * chunk;
  S.idx = clamp(S.idx + delta, 0, Math.max(0, S.words.length - 1));
  showCurrent();
}

function resetPosition() {
  stop();
  S.idx = 0;
  showCurrent();
}

function toggleBookmark() {
  if (!S.words.length) return;
  if (typeof S.mark === "number") {
    stop();
    S.idx = clamp(S.mark, 0, Math.max(0, S.words.length - 1));
    showCurrent();
  } else {
    S.mark = S.idx;
    saveState();
    setStatus(`Lesezeichen gesetzt bei Wort #${S.mark}`);
    setTimeout(() => setStatus(S.lastLoadedName ? `Geladen: ${S.lastLoadedName}` : "Bereit"), 1200);
  }
}

async function loadTxt(file) {
  setStatus("Lade TXT…");
  const txt = await file.text();
  return wordsFromText(txt);
}

/* -----------------------------
   EPUB Extraktion (robust iPad)
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

async function loadEpub(file) {
  if (typeof window.ePub !== "function") {
    throw new Error("EPUB Engine (epub.js) nicht geladen. Internet nötig beim ersten Start.");
  }

  setStatus("Lade EPUB… (Extrahiere Text)");
  const buf = await file.arrayBuffer();

  const book = ePub(buf);
  await book.ready;

  const spine = book.spine?.spineItems || [];
  if (!spine.length) throw new Error("EPUB: Keine Kapitel (Spine) gefunden.");

  const all = [];
  let kept = 0;

  for (let i = 0; i < spine.length; i++) {
    const item = spine[i];

    // Skip non-linear items (Cover, etc.)
    if (item?.linear === "no") continue;

    // Skip navigation doc
    if (isNavItem(item)) continue;

    // Only HTML/XHTML-like
    if (!looksLikeHtmlItem(item)) continue;

    setStatus(`Lade Kapitel ${i + 1}/${spine.length}… (${kept} gesammelt)`);

    // Robust: item.load() -> item.document
    await item.load(book.load.bind(book));

    const doc = item.document;
    const rawText = cleanDocText(doc);

    // Free memory
    item.unload();

    // Filter out tiny fragments (copyright, menu)
    if (rawText.length > 400) {
      all.push(rawText);
      kept++;
    }
  }

  const combined = all.join("\n\n");

  // Falls alles weggefiltert wurde: versuche wenigstens irgendwas zu liefern
  if (!combined.trim()) {
    throw new Error("Kein Text gefunden (EPUB evtl. Scan/Bild oder ungewöhnliche Struktur).");
  }

  return wordsFromText(combined);
}

async function handleFile(file) {
  try {
    stop();
    S.words = [];
    S.idx = 0;
    S.mark = null;

    const name = file.name || "Datei";
    S.lastLoadedName = name;

    const ext = (name.split(".").pop() || "").toLowerCase();

    let words = [];
    if (ext === "txt") {
      words = await loadTxt(file);
    } else if (ext === "epub") {
      words = await loadEpub(file);
    } else {
      throw new Error("Bitte .epub oder .txt laden.");
    }

    if (!words.length) throw new Error("Kein Text gefunden (oder nur Bilder/Scans).");

    S.words = words;

    // Position übernehmen (aus LS), aber clampen
    S.idx = clamp(S.idx, 0, Math.max(0, S.words.length - 1));

    setStatus(`Geladen: ${name} (${S.words.length} Wörter)`);
    showCurrent();
  } catch (e) {
    setStatus(`Fehler: ${e?.message || e}`);
    console.error(e);
    S.words = [];
    updateProgressUI();
    stop();
  }
}

function bindUI() {
  // Settings
  el.wpm.addEventListener("input", () => {
    S.settings.wpm = Number(el.wpm.value);
    el.wpmVal.textContent = String(S.settings.wpm);
    saveState();
  });

  el.chunk.addEventListener("input", () => {
    S.settings.chunk = Number(el.chunk.value);
    el.chunkVal.textContent = String(S.settings.chunk);
    saveState();
  });

  el.orp.addEventListener("change", () => {
    S.settings.orp = el.orp.checked;
    showCurrent();
  });

  el.punct.addEventListener("change", () => {
    S.settings.punct = el.punct.checked;
    saveState();
  });

  el.punctMs.addEventListener("input", () => {
    S.settings.punctMs = Number(el.punctMs.value);
    el.punctVal.textContent = String(S.settings.punctMs);
    saveState();
  });

  // Transport
  el.btnPlay.addEventListener("click", togglePlay);
  el.btnBack.addEventListener("click", () => step(-1));
  el.btnFwd.addEventListener("click", () => step(+1));
  el.btnReset.addEventListener("click", resetPosition);
  el.btnMark.addEventListener("click", toggleBookmark);

  // Seek
  el.seek.addEventListener("input", () => {
    stop();
    S.idx = Number(el.seek.value);
    showCurrent();
  });

  // File
  el.file.addEventListener("change", (ev) => {
    const f = ev.target.files?.[0];
    if (f) handleFile(f);
    ev.target.value = ""; // allow reselect same file
  });

  // Tap zones: left/back, middle/play, right/fwd
  el.display.addEventListener("click", (ev) => {
    const r = el.display.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const third = r.width / 3;

    if (x < third) step(-1);
    else if (x > 2 * third) step(+1);
    else togglePlay();
  });

  // Keyboard (optional)
  window.addEventListener("keydown", (e) => {
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(+1);
    if (e.key.toLowerCase() === "b") toggleBookmark();
  });
}

// Boot
loadState();
applySettingsToUI();
bindUI();
updateProgressUI();
setStatus("Warte auf Datei…");
showCurrent();
