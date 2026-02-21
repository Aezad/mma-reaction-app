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
  "Jab Jab Cross","Cross Body Hook", "Jab Cross Hook Low Kick"
];

const defenses = [
  "Slip Left","Slip Right","Block","Sprawl","Clinch","Pivot Out","Check Kick","Parry"
];

// simple counters mapping for counter_simple
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
// STATE & UI REFS
/////////////////////////
let audioCtx = null;
let running = false;
let paused = false;
let callTimer = null;
let roundTimer = null;
let restTimer = null;
let countdownInterval = null;
let currentRound = 0;
let roundsTotal = 0;

const app = document.getElementById("app");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");
const stopBtn = document.getElementById("stop");
const resetBtn = document.getElementById("reset");

const modeSelect = document.getElementById("mode");
const intensitySelect = document.getElementById("intensity");
const minInput = document.getElementById("minTime");
const maxInput = document.getElementById("maxTime");
const roundInput = document.getElementById("roundTime");
const restInput = document.getElementById("restTime");
const roundCountInput = document.getElementById("roundCount");
const bellSelect = document.getElementById("bellType");

const stateText = document.getElementById("stateText");
const callText = document.getElementById("callText");
const roundNumberText = document.getElementById("roundNumber");
const roundCountdownText = document.getElementById("roundCountdown");

/////////////////////////
// AUDIO / VOICE SETUP
/////////////////////////
function ensureAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}

// bell generator using WebAudio
function playBell(type='ding', when=0){
  ensureAudioCtx();
  const ctx = audioCtx;
  const now = ctx.currentTime + when;
  if(type === 'ding'){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(now); o.stop(now + 0.9);
  } else if(type === 'gong'){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.8, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    o.connect(g).connect(ctx.destination);
    o.start(now); o.stop(now + 2.2);
  } else {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1200, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.9, now + 0.01);
    g.gain.linearRampToValueAtTime(0.001, now + 0.12);
    o.connect(g).connect(ctx.destination);
    o.start(now); o.stop(now + 0.12);
  }
}

// speech helper with voice selection
let cachedVoices = [];
function refreshVoices(){
  cachedVoices = speechSynthesis.getVoices() || [];
}
window.speechSynthesis.onvoiceschanged = refreshVoices;
refreshVoices();

function speak(text){
  try{ if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
  const utt = new SpeechSynthesisUtterance(text);
  // pick a strong English voice if available
  let voice = cachedVoices.find(v=>/Google UK|Microsoft|English/.test(v.name)) || cachedVoices.find(v=>v.lang && v.lang.startsWith('en')) || cachedVoices[0];
  if(voice) utt.voice = voice;
  // intensity affects TTS rate
  const intensity = intensitySelect ? intensitySelect.value : 'normal';
  if(intensity === 'fast') utt.rate = 1.4;
  else if(intensity === 'slow') utt.rate = 0.95;
  else utt.rate = 1.05;
  utt.pitch = 0.95;
  utt.volume = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

/////////////////////////
// HELPERS
/////////////////////////
function randFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function nextDelayMs(){
  let min = parseFloat(minInput.value) || 1;
  let max = parseFloat(maxInput.value) || Math.max(min,1);
  const intensity = intensitySelect.value;
  if(intensity === 'slow'){ min += 0.8; max += 1.2; }
  if(intensity === 'fast'){ min = Math.max(0.2, min - 0.5); max = Math.max(min, max - 0.8); }
  const a = Math.min(min,max), b = Math.max(min,max);
  return (Math.random()*(b - a) + a) * 1000;
}

function flashVisual(kind='accent'){
  // small visual flash on container + callText pop
  if(kind === 'danger') app.classList.add('flash-red');
  else app.classList.add('flash-white');

  callText.classList.add('call-flash');
  setTimeout(()=>{ app.classList.remove('flash-white','flash-red'); callText.classList.remove('call-flash'); }, 220);
}

/////////////////////////
// CALL GENERATION
/////////////////////////
function getCallForMode(mode){
  if(mode === 'single') return randFrom(singles);
  if(mode === 'combo') return randFrom(combos);
  if(mode === 'mixed') return Math.random()>0.5 ? randFrom(singles) : randFrom(combos);
  if(mode === 'intensity') return randFrom(singles); // intensity uses shorter delay to simulate pads
  if(mode === 'defense') return randFrom(defenses);

  if(mode === 'counter_simple'){
    const d = randFrom(defenses);
    const c = simpleCounter[d] || randFrom(singles);
    return {type:'counter', defense:d, counter:c, text: `${d} → ${c}`};
  }

  if(mode === 'counter_combo'){
    const d = randFrom(defenses);
    const combo = randFrom(combos);
    return {type:'counter', defense:d, counter:combo, text: `${d} → ${combo}`};
  }

  // fallback
  return randFrom(singles);
}

/////////////////////////
// SCHEDULING: round / calls / rest
/////////////////////////
function clearAllTimers(){
  clearTimeout(callTimer); callTimer = null;
  clearTimeout(roundTimer); roundTimer = null;
  clearTimeout(restTimer); restTimer = null;
  clearInterval(countdownInterval); countdownInterval = null;
}

function scheduleNextCall(currentMode){
  if(!running || paused) return;

  // counters handled inside call itself (speak twice)
  const delay = currentMode === 'intensity' ? 450 : nextDelayMs();
  callTimer = setTimeout(()=>{
    if(!running || paused) return;

    const call = getCallForMode(currentMode);

    // if counter object, handle specially
    if(call && typeof call === 'object' && call.type === 'counter'){
      callText.textContent = call.text;
      flashVisual('danger');
      // speak defense then counter after small gap
      speak(call.defense);
      setTimeout(()=> speak(call.counter), 650);
    } else {
      // simple string
      callText.textContent = call;
      flashVisual('accent');
      speak(call);
    }

    // schedule next
    scheduleNextCall(currentMode);
  }, delay);
}

function startRoundSequence(){
  // prepare
  ensureAudioCtx();
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  const currentMode = modeSelect.value;
  const roundSecs = Math.max(1, parseInt(roundInput.value) || 60);
  const restSecs = Math.max(1, parseInt(restInput.value) || 20);
  roundsTotal = parseInt(roundCountInput.value) || 0;

  // clear old timers
  clearAllTimers();

  // 3 bells then start calls
  stateText.textContent = 'Get Ready...';
  callText.textContent = 'Get Ready';

  // play 3 bells with 700ms gap, then start
  playBell(bellSelect.value);
  setTimeout(()=> playBell(bellSelect.value), 700);
  setTimeout(()=> playBell(bellSelect.value), 1400);

  // start the round after last bell + short pause
  setTimeout(()=> {
    stateText.textContent = 'Training';
    // schedule calls
    scheduleNextCall(currentMode);

    // start countdown
    let remain = roundSecs;
    updateCountdownDisplay(remain);
    countdownInterval = setInterval(()=>{
      if(paused) return;
      remain--;
      updateCountdownDisplay(remain);
      if(remain <= 0){
        clearInterval(countdownInterval);
      }
    }, 1000);

    // end of round
    roundTimer = setTimeout(()=>{
      // stop call loop for this round
      clearTimeout(callTimer);
      callTimer = null;
      playBell(bellSelect.value); // end bell
      stateText.textContent = 'Round Ended';
      callText.textContent = '';

      // rest period
      let restRemain = restSecs;
      updateCountdownDisplay(restRemain);
      countdownInterval = setInterval(()=>{
        if(paused) return;
        restRemain--;
        updateCountdownDisplay(restRemain);
        if(restRemain <= 0) clearInterval(countdownInterval);
      }, 1000);

      restTimer = setTimeout(()=>{
        clearTimeout(restTimer); restTimer = null;
        // check if finished
        if(roundsTotal > 0){
          if(currentRound >= roundsTotal){
            stopTraining();
            stateText.textContent = 'Finished';
            return;
          }
        }
        // start next round
        runNextRound();
      }, restSecs * 1000);

    }, roundSecs * 1000);

  }, 1800); // wait for bells (3× ~700ms)
}

/////////////////////////
// Round control: runNextRound, start, stop, pause, resume, reset
/////////////////////////
function runNextRound(){
  if(!running) return;
  currentRound++;
  roundNumberText.textContent = currentRound;
  startRoundSequence();
}

function startTraining(){
  if(running) return;
  // resume audio context on user gesture
  ensureAudioCtx();
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  running = true;
  paused = false;
  currentRound = 0;
  roundNumberText.textContent = '0';
  stateText.textContent = 'Starting';
  runNextRound();
}

function stopTraining(){
  running = false;
  paused = false;
  clearAllTimers();
  window.speechSynthesis.cancel();
  stateText.textContent = 'Stopped';
  callText.textContent = '';
  roundNumberText.textContent = '0';
  roundCountdownText.textContent = '00:00';
}

function pauseTraining(){
  if(!running || paused) return;
  paused = true;
  stateText.textContent = 'Paused';
  window.speechSynthesis.cancel();
}

function resumeTraining(){
  if(!running || !paused) return;
  paused = false;
  stateText.textContent = 'Resumed';
  // resume calls
  scheduleNextCall(modeSelect.value);
}

function resetTraining(){
  stopTraining();
  // restore defaults
  minInput.value = 1.0;
  maxInput.value = 3.0;
  roundInput.value = 60;
  restInput.value = 20;
  roundCountInput.value = 3;
  modeSelect.value = 'single';
  intensitySelect.value = 'normal';
  bellSelect.value = 'ding';
  stateText.textContent = 'Ready';
  callText.textContent = 'Ready';
  roundCountdownText.textContent = '00:00';
  currentRound = 0;
  roundNumberText.textContent = '0';
}

function updateCountdownDisplay(sec){
  const mm = String(Math.floor(sec/60)).padStart(2,'0');
  const ss = String(sec%60).padStart(2,'0');
  roundCountdownText.textContent = `${mm}:${ss}`;
}

/////////////////////////
// Event bindings & restart-on-change
/////////////////////////
startBtn.addEventListener('click', ()=>{ ensureAudioCtx(); startTraining(); });
stopBtn.addEventListener('click', ()=> stopTraining());
pauseBtn.addEventListener('click', ()=> pauseTraining());
resumeBtn.addEventListener('click', ()=> resumeTraining());
resetBtn.addEventListener('click', ()=> resetTraining());

// restart on mode or intensity change if running
modeSelect.addEventListener('change', ()=>{
  if(running && !paused){ stopTraining(); setTimeout(()=> startTraining(), 120); }
});
intensitySelect.addEventListener('change', ()=>{
  if(running && !paused){ stopTraining(); setTimeout(()=> startTraining(), 120); }
});

// ensure voices load
window.speechSynthesis.onvoiceschanged = refreshVoices || function(){};

// initialize small UI state
resetTraining();
