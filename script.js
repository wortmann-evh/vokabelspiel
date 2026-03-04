// =====================================================
// Vokabel-Einhorn – Endversion (Baukasten)
// Features:
// - Startscreen (Name + Schwierigkeit + Modus)
// - Modus: de-en / en-de / random
// - 4 Antwortmöglichkeiten
// - Timer als Einhorn + Gewitterwolke auf Regenbogen
// - Gewonnen-Screen (nach 10 richtigen Antworten)
// - Fehler-Training (falsche Wörter wiederholen)
// - Local Highscore (auch bei Game Over) via localStorage
// =====================================================

// =====================
// Konfiguration
// =====================
const OPTIONS_COUNT = 4;
const TARGET_CORRECT = 10;

const DIFFICULTY_TIME = {
  leicht: 12_000,
  mittel: 10_000,
  schwer: 7_000,
};

// Local Highscore
const LOCAL_HS_KEY = "vokabelspiel_highscores_v1";
const LOCAL_HS_LIMIT = 10;

// =====================
// State
// =====================
let vocab = [];               // {de,en}[]
let mode = "de-en";           // de-en | en-de | random
let difficulty = "mittel";
let questionTimeMs = DIFFICULTY_TIME[difficulty];

let playerName = "Spieler:in";

let playing = false;
let trainingMode = false;     // false = normales Spiel, true = Fehler-Training

let score = 0;
let qnum = 0;

let wrongSet = new Set();     // keys "de||en" (falsch ODER Zeit abgelaufen)
let trainingQueue = [];       // Array der Einträge, die trainiert werden sollen

let current = null;           // {entry, prompt, correct, options[], direction}
let roundStart = 0;
let rafId = null;

// =====================
// Elemente
// =====================
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");

const nameInput = document.getElementById("nameInput");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const playBtn = document.getElementById("playBtn");

const restartBtn = document.getElementById("restartBtn");

const playerNameEl = document.getElementById("playerName");
const playerDiffEl = document.getElementById("playerDiff");

const scoreEl = document.getElementById("score");
const targetEl = document.getElementById("target");
const qnumEl = document.getElementById("qnum");

const questionWordEl = document.getElementById("questionWord");
const answersEl = document.getElementById("answers");
const feedbackEl = document.getElementById("feedback");

const cloudEl = document.getElementById("cloud");
const unicornEl = document.getElementById("unicorn");
const timerHintEl = document.getElementById("timerHint");

const endTitleEl = document.getElementById("endTitle");
const endTextEl = document.getElementById("endText");
const statNameEl = document.getElementById("statName");
const statScoreEl = document.getElementById("statScore");
const statWrongEl = document.getElementById("statWrong");

const playAgainBtn = document.getElementById("playAgainBtn");
const trainBtn = document.getElementById("trainBtn");

// optionales Element für Local Highscore (wenn du es in index.html ergänzt hast)
const localBoardEl = document.getElementById("localBoard");

// =====================
// Helpers
// =====================
function keyOf(entry){ return `${entry.de}||${entry.en}`; }

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function setFeedback(text, kind){
  feedbackEl.textContent = text;
  feedbackEl.classList.remove("good","bad");
  if(kind) feedbackEl.classList.add(kind);
}

function updateHud(){
  playerNameEl.textContent = playerName;
  playerDiffEl.textContent = `${difficulty} (${Math.round(questionTimeMs/1000)}s)`;

  scoreEl.textContent = String(score);
  targetEl.textContent = String(TARGET_CORRECT);
  qnumEl.textContent = String(qnum);

  timerHintEl.textContent = trainingMode
    ? "Fehler-Training: Du übst nur die falschen Wörter. Richtig beantwortet = Wort verschwindet aus der Liste."
    : "Richtige Antwort = Wolke zurücksetzen. Zeit abgelaufen = Game Over.";

  // Leaderboard im Endscreen bei Bedarf vorab laden
  renderLocalBoard(loadLocalHighscores());
}

function lockAnswers(){
  [...answersEl.querySelectorAll("button")].forEach(b => b.disabled = true);
}

function pickRandomDifferent(pool, exclude, count){
  const filtered = pool.filter(x => x !== exclude);
  shuffle(filtered);
  return filtered.slice(0, count);
}

function sanitizeName(name){
  // einfache, kinderfreundliche Säuberung
  return (name || "Spieler:in")
    .trim()
    .slice(0, 20)
    .replace(/[^\p{L}\p{N} _-]/gu, "");
}

// =====================
// Local Highscore
// =====================
function loadLocalHighscores(){
  try{
    return JSON.parse(localStorage.getItem(LOCAL_HS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalHighscores(rows){
  localStorage.setItem(LOCAL_HS_KEY, JSON.stringify(rows));
}

function addLocalHighscore({name, score, mode, difficulty, won, wrongCount}){
  const rows = loadLocalHighscores();
  rows.push({
    name: sanitizeName(name),
    score: Math.max(0, Math.min(999, score|0)),
    mode: String(mode),
    difficulty: String(difficulty),
    won: !!won,
    wrongCount: Math.max(0, wrongCount|0),
    date: new Date().toISOString()
  });

  // Sort: Score desc, dann Datum neu zuerst
  rows.sort((a,b) => (b.score - a.score) || (b.date.localeCompare(a.date)));

  const top = rows.slice(0, LOCAL_HS_LIMIT);
  saveLocalHighscores(top);
  return top;
}

function renderLocalBoard(rows){
  if(!localBoardEl) return; // falls du es nicht eingebaut hast

  if(!rows || !rows.length){
    localBoardEl.textContent = "Noch keine Einträge.";
    return;
  }

  const ol = document.createElement("ol");
  rows.forEach(r => {
    const li = document.createElement("li");
    const badge = r.won ? "🏆" : "🌩️";
    li.textContent = `${badge} ${r.name} — ${r.score} (${r.mode}, ${r.difficulty})`;
    ol.appendChild(li);
  });

  localBoardEl.innerHTML = "";
  localBoardEl.appendChild(ol);
}

// =====================
// Vokabeldatei laden
// =====================
async function loadVocab(){
  const res = await fetch("vocab.txt", { cache: "no-store" });
  if(!res.ok) throw new Error("Konnte vocab.txt nicht laden.");
  const text = await res.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  const items = [];
  for(const line of lines){
    let parts = line.split("\t");
    if(parts.length < 2) parts = line.split(";");
    if(parts.length < 2) parts = line.split(",");

    if(parts.length >= 2){
      // NEU: erst Englisch, dann Deutsch
      const en = parts[0].trim();
      const de = parts[1].trim();
      if(de && en) items.push({de, en});
    }
  }

  if(items.length < OPTIONS_COUNT){
    throw new Error(`Bitte mindestens ${OPTIONS_COUNT} Vokabeln eintragen.`);
  }
  vocab = items;
}

// =====================
// Fragenlogik
// =====================
function pickEntry(){
  if(trainingMode){
    if(trainingQueue.length === 0) return null;
    return trainingQueue[0];
  }
  return vocab[Math.floor(Math.random() * vocab.length)];
}

function buildQuestion(){
  const entry = pickEntry();
  if(!entry) return null;

  // Richtung bestimmen: de-en / en-de / random
  let direction = mode;
  if(mode === "random"){
    direction = Math.random() < 0.5 ? "de-en" : "en-de";
  }

  const prompt  = (direction === "de-en") ? entry.de : entry.en;
  const correct = (direction === "de-en") ? entry.en : entry.de;

  const allAnswers = vocab.map(v => (direction === "de-en") ? v.en : v.de);
  const distractors = pickRandomDifferent(allAnswers, correct, OPTIONS_COUNT - 1);
  const options = shuffle([correct, ...distractors]);

  return { entry, prompt, correct, options, direction };
}

function renderQuestion(q){
  questionWordEl.textContent = q.prompt;
  answersEl.innerHTML = "";

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.addEventListener("click", () => onAnswer(opt), { once: true });
    answersEl.appendChild(btn);
  });
}

// =====================
// Timer-Grafik
// =====================
function setSpritePositions(progress01){
  const unicornX = 85;
  const cloudStart = 10;
  const cloudEnd = unicornX;
  const cloudX = cloudStart + (cloudEnd - cloudStart) * progress01;

  unicornEl.style.left = `${unicornX}%`;
  cloudEl.style.left = `${cloudX}%`;
}

function startTimer(){
  roundStart = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

function stopTimer(){
  cancelAnimationFrame(rafId);
  rafId = null;
}

function tick(now){
  if(!playing) return;

  const elapsed = now - roundStart;
  const progress = clamp01(elapsed / questionTimeMs);
  setSpritePositions(progress);

  if(progress >= 1){
    // Zeit vorbei => zählt als Fehler
    registerWrong(current?.entry);
    endGame(false, "Game Over! 🌩️ Zeit ist abgelaufen.");
    return;
  }
  rafId = requestAnimationFrame(tick);
}

// =====================
// Fehler-Tracking
// =====================
function registerWrong(entry){
  if(!entry) return;
  wrongSet.add(keyOf(entry));
}

function rebuildTrainingQueue(){
  const keys = [...wrongSet];
  const map = new Map(vocab.map(v => [keyOf(v), v]));
  trainingQueue = keys.map(k => map.get(k)).filter(Boolean);
}

// =====================
// Spielablauf
// =====================
function nextRound(){
  qnum += 1;
  updateHud();
  setFeedback("", "");

  current = buildQuestion();
  if(!current){
    // Training fertig
    endTrainingWin();
    return;
  }

  renderQuestion(current);
  startTimer();
}

function removeFromTrainingIfCorrect(entry){
  const k = keyOf(entry);
  if(wrongSet.has(k)) wrongSet.delete(k);

  if(trainingQueue.length && keyOf(trainingQueue[0]) === k){
    trainingQueue.shift();
  }
}

function onAnswer(selected){
  if(!playing) return;

  lockAnswers();
  stopTimer();

  const ok = selected === current.correct;

  if(trainingMode){
    if(ok){
      setFeedback("Richtig! ✅ Dieses Wort ist geschafft.", "good");
      removeFromTrainingIfCorrect(current.entry);
      setTimeout(() => { if(playing) nextRound(); }, 350);
    } else {
      setFeedback(`Leider falsch. Richtig wäre: ${current.correct}`, "bad");
      // Wort bleibt – ans Ende schieben
      if(trainingQueue.length){
        trainingQueue.push(trainingQueue.shift());
      }
      setTimeout(() => { if(playing) nextRound(); }, 500);
    }
    return;
  }

  // Normalmodus
  if(ok){
    score += 1;
    updateHud();
    setFeedback("Richtig! 🦄✨ Wolke zurückgesetzt!", "good");

    if(score >= TARGET_CORRECT){
      endGame(true, `Gewonnen! 🎉 Du hast ${TARGET_CORRECT} richtige Antworten geschafft.`);
      return;
    }

    setTimeout(() => { if(playing) nextRound(); }, 350);
  } else {
    registerWrong(current.entry);
    setFeedback(`Leider falsch. Richtig wäre: ${current.correct}`, "bad");
    setTimeout(() => endGame(false, "Game Over! 🌩️ Falsche Antwort."), 650);
  }
}

function resetCore(){
  score = 0;
  qnum = 0;
  current = null;
  setFeedback("", "");
  setSpritePositions(0);
  questionWordEl.textContent = "—";
  answersEl.innerHTML = "";
}

function showStart(){
  startScreen.classList.remove("hidden");
  endScreen.classList.add("hidden");
  restartBtn.disabled = true;
}

function hideStart(){
  startScreen.classList.add("hidden");
}

function showEnd({ title, text }){
  endTitleEl.textContent = title;
  endTextEl.textContent = text;

  statNameEl.textContent = playerName;
  statScoreEl.textContent = String(score);
  statWrongEl.textContent = String(wrongSet.size);

  // Fehler-Training nur wenn es Fehler gibt
  trainBtn.disabled = wrongSet.size === 0;

  // Local Board anzeigen (falls eingebaut)
  renderLocalBoard(loadLocalHighscores());

  endScreen.classList.remove("hidden");
  restartBtn.disabled = false;
}

function hideEnd(){
  endScreen.classList.add("hidden");
}

function startNormalGame(){
  trainingMode = false;
  playing = true;
  resetCore();
  updateHud();
  nextRound();
}

function startTraining(){
  trainingMode = true;
  rebuildTrainingQueue();
  playing = true;
  resetCore();
  updateHud();
  nextRound();
}

function endTrainingWin(){
  playing = false;
  stopTimer();
  lockAnswers();
  showEnd({
    title: "Training fertig! 🏆",
    text: "Du hast alle falschen Wörter richtig geübt. Super!",
  });
}

function endGame(won, message){
  playing = false;
  stopTimer();
  lockAnswers();

  // Highscore: auch bei Game Over speichern
  const top = addLocalHighscore({
    name: playerName,
    score,
    mode,
    difficulty,
    won,
    wrongCount: wrongSet.size
  });
  renderLocalBoard(top);

  showEnd({
    title: won ? "Gewonnen! 🎉" : "Game Over 🌩️",
    text: message,
  });
}

async function beginFromStartScreen(){
  playerName = sanitizeName(nameInput.value) || "Spieler:in";
  difficulty = difficultySelect.value;
  mode = modeSelect.value;
  questionTimeMs = DIFFICULTY_TIME[difficulty] ?? 10_000;

  try{
    if(vocab.length === 0) await loadVocab();
  } catch(err){
    alert(
      "Fehler beim Laden der Vokabeln.\n\n" +
      String(err.message || err) +
      "\n\nTipp: Öffne das Spiel über einen lokalen Webserver (VS Code Live Server) oder GitHub Pages."
    );
    return;
  }

  wrongSet.clear();
  hideStart();
  hideEnd();
  startNormalGame();
}

// =====================
// Events
// =====================
playBtn.addEventListener("click", beginFromStartScreen);

restartBtn.addEventListener("click", () => {
  playing = false;
  stopTimer();
  wrongSet.clear();
  resetCore();
  showStart();
});

playAgainBtn.addEventListener("click", () => {
  hideEnd();
  wrongSet.clear();
  startNormalGame();
});

trainBtn.addEventListener("click", () => {
  hideEnd();
  startTraining();
});

// Initial
setSpritePositions(0);
updateHud();
showStart();
