/* Pro trainer script
   - modes: single, combo, mixed, intensity, defense, counter_simple, counter_combo
   - 3 bells before each round
   - visual flash for each call
   - restart on mode/intensity change
*/

/////////////////////////
// DATA / VOCABULARY
/////////////////////////
const singles = [
  "Jab","Cross","Hook","Uppercut","Low Kick","High Kick","Elbow",
  "Teep","Knee","Slip","Block","Sprawl"
];

const combos = [
  "Jab Cross","Jab Cross Hook","Cross Hook Low Kick","Jab Cross Uppercut",
  "Jab Jab Cross","Cross Body Hook","Jab Cross Hook Low Kick"
];

const defenses = [
  "Slip Left","Slip Right","Block","Sprawl","Clinch","Pivot Out","Check Kick","Parry"
];

const simpleCounter = {
  "Slip Left": "Cross",
  "Slip Right": "Cross",
  "Block": "Uppercut",
  "Sprawl": "Cross",
  "Clinch": "Knee",
  "Pivot Out": "Jab",
  "Check Kick": "Jab Cross",
  "Parry": "Jab Cross Hook"
};

/////////////////////////
// STATE
/////////////////////////
let audioCtx = null;
let running = false;
let paused = false;
let callTimer = null;

/////////////////////////
// AUDIO / VOICE SETUP
/////////////////////////
function ensureAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}

function playBell(){
  ensureAudioCtx();
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(0.8, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1);
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + 1);
}

/////////////////////////
// MALE VOICE SELECTION
/////////////////////////
let cachedVoices = [];

function loadVoices() {
  cachedVoices = speechSynthesis.getVoices();
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function getMaleVoice(){
  if(!cachedVoices.length) return null;

  // 1️⃣ Explicit male voices
  let male = cachedVoices.find(v => /male/i.test(v.name));
  if(male) return male;

  // 2️⃣ Common male voice names
  male = cachedVoices.find(v =>
    /David|Mark|James|John|Paul|Daniel|Google UK English Male/i.test(v.name)
  );
  if(male) return male;

  // 3️⃣ Any English voice fallback
  male = cachedVoices.find(v => v.lang && v.lang.startsWith('en'));
  if(male) return male;

  return cachedVoices[0] || null;
}

function speak(text){
  ensureAudioCtx();

  const utterance = new SpeechSynthesisUtterance(text);
  const maleVoice = getMaleVoice();

  if(maleVoice) utterance.voice = maleVoice;

  // Deeper tone
  utterance.pitch = 0.75;
  utterance.rate = 1.05;
  utterance.volume = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

/////////////////////////
// RANDOM CALL GENERATOR
/////////////////////////
function randomItem(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCall(){
  const mode = document.getElementById("mode")?.value || "single";

  if(mode === "single"){
    return randomItem(singles);
  }
  if(mode === "combo"){
    return randomItem(combos);
  }
  if(mode === "mixed"){
    return Math.random() > 0.5 ? randomItem(singles) : randomItem(combos);
  }
  if(mode === "defense"){
    return randomItem(defenses);
  }
  if(mode === "counter_simple"){
    const def = randomItem(defenses);
    return def + " then " + simpleCounter[def];
  }

  return randomItem(singles);
}

/////////////////////////
// TRAINING LOOP
/////////////////////////
function startTraining(){
  if(running) return;
  running = true;
  playBell();
  nextCall();
}

function stopTraining(){
  running = false;
  clearTimeout(callTimer);
  speechSynthesis.cancel();
}

function nextCall(){
  if(!running) return;

  const call = generateCall();
  const callText = document.getElementById("callText");
  if(callText) callText.textContent = call;

  speak(call);

  const min = parseFloat(document.getElementById("minTime")?.value || 2);
  const max = parseFloat(document.getElementById("maxTime")?.value || 4);
  const delay = (Math.random() * (max - min) + min) * 1000;

  callTimer = setTimeout(nextCall, delay);
}

/////////////////////////
// BUTTON EVENTS
/////////////////////////
document.getElementById("start")?.addEventListener("click", startTraining);
document.getElementById("stop")?.addEventListener("click", stopTraining);