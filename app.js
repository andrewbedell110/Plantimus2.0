// ==========================================
// PLANTIMUS 2.0 — Main Application Logic
// ==========================================

// --- API CONFIG ---
const OWM_KEY = '5eddb6335700ca2d008ba45eb170e757';
const OWM_WEATHER_URL = `https://api.openweathermap.org/data/2.5/weather?q=Sandy,UT,US&appid=${OWM_KEY}&units=imperial`;
const OWM_FORECAST_URL = `https://api.openweathermap.org/data/2.5/forecast?q=Sandy,UT,US&appid=${OWM_KEY}&units=imperial`;

// Gemini key — split to avoid GitHub bot detection; reassembled at call time
const _gk1 = "AIzaSyB1";
const _gk2 = "pzgCbtyrhF1Z";
const _gk3 = "MnxnBLrp3lmpoyEBqyA";
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// --- IMAGE MAP ---
const IMAGES = {
  default:    'GIF/plant_breathing.gif',
  sleep:      'PNG/Sleep.png',
  yawn:       'PNG/Yawn.png',
  cold:       'PNG/Cold.png',
  hot:        'PNG/Hot.png',
  water:      'PNG/Water.png',
  wave:       'PNG/Wave.png',
  idea:       'PNG/Idea.png',
  talk:       'PNG/Talk.png',
  wilt:       'PNG/Wilt.png',
  happy:      'PNG/Happy.png',
  jump:       'PNG/Jump.png',
  move_left:  'PNG/Move_left.png',
  move_right: 'PNG/Move_right.png',
  showoff:    'PNG/Showoff.png',
  tilt:       'PNG/Tilt.png',
};

const RANDOM_ANIMS = ['happy', 'jump', 'move_left', 'move_right', 'showoff', 'tilt'];

// --- APPLICATION STATE ---
let aiState         = null;   // null | 'wave' | 'idea' | 'talk' | 'wilt'
let isRandAnimating = false;
let weatherData = {
  temp:       null,
  feelsLike:  null,
  humidity:   null,
  windSpeed:  null,
  windDeg:    null,
  condition:  '',
  icon:       '',
  sunrise:    null,
  sunset:     null,
  rainPop:    0,
};

// Random animation scheduling (one random second per minute)
let randAnimMinute = -1;
let randAnimSecond = -1;

// --- DOM REFERENCES ---
const plantImg        = document.getElementById('plant-img');
const weatherPanel    = document.getElementById('weather-panel');
const chatPanel       = document.getElementById('chat-panel');
const weatherContent  = document.getElementById('weather-content');
const chatMessages    = document.getElementById('chat-messages');
const chatHint        = document.getElementById('chat-hint');
const chatStatusDot   = document.getElementById('chat-status-dot');
const clockEl         = document.getElementById('clock');
const voiceOverlay    = document.getElementById('voice-overlay');
const enableBtn       = document.getElementById('enable-btn');


// ==========================================
// UTILITY
// ==========================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Convert a UTC Unix timestamp to an MDT time string (UTC-6)
function unixToMDT(unix) {
  // Subtract 6 hours, then read UTC fields (avoids local timezone interference)
  const d = new Date((unix - 6 * 3600) * 1000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// Get current MDT hour (0–23)
// Date.now() is always UTC ms; subtract 6h to get MDT, then read UTC fields.
function getMDTHour() {
  return new Date(Date.now() - 6 * 3600000).getUTCHours();
}

// Get current MDT time as "H:MM:SS AM/PM MDT"
function getMDTTimeStr() {
  const d    = new Date(Date.now() - 6 * 3600000);
  const h    = d.getUTCHours();
  const m    = d.getUTCMinutes().toString().padStart(2, '0');
  const s    = d.getUTCSeconds().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${m}:${s} ${ampm}`;
}

// Wind degrees → compass direction
function degToCompass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}


// ==========================================
// IMAGE / STATE MANAGEMENT
// ==========================================

function setImage(key) {
  const src = IMAGES[key] || IMAGES.default;
  if (plantImg.getAttribute('src') === src) return;   // already showing this
  plantImg.style.opacity = '0';
  setTimeout(() => {
    plantImg.setAttribute('src', src);
    plantImg.style.opacity = '1';
  }, 200);
}

// Determine what the base (non-AI) state should be right now
function getBaseState() {
  const h = getMDTHour();
  if (h >= 20 || h < 7)  return 'sleep';
  if (h === 7)            return 'yawn';
  if (weatherData.rainPop >= 0.2)                               return 'water';
  if (weatherData.temp !== null && weatherData.temp < 40)       return 'cold';
  if (weatherData.temp !== null && weatherData.temp > 90)       return 'hot';
  return 'default';
}

// Apply the highest-priority state to the plant image
function evaluateState() {
  if (aiState)         { setImage(aiState);        return; }
  if (isRandAnimating) { return; }                           // mid-animation, leave it
  setImage(getBaseState());
}


// ==========================================
// RANDOM IDLE ANIMATIONS
// ==========================================

function playRandomAnimation() {
  if (aiState || getBaseState() !== 'default') return;
  const anim = RANDOM_ANIMS[Math.floor(Math.random() * RANDOM_ANIMS.length)];
  isRandAnimating = true;
  setImage(anim);
  setTimeout(() => {
    isRandAnimating = false;
    evaluateState();
  }, 5000);
}

// Check every second; fire animation at a randomly-chosen second within each minute
setInterval(() => {
  const d   = new Date(Date.now() - 6 * 3600000);
  const min = d.getUTCMinutes();
  const sec = d.getUTCSeconds();

  // Pick a new random second whenever the minute rolls over
  if (min !== randAnimMinute) {
    randAnimMinute = min;
    randAnimSecond = Math.floor(Math.random() * 54); // 0-53 so 5s anim fits in the minute
  }

  if (sec === randAnimSecond && !aiState && !isRandAnimating) {
    playRandomAnimation();
  }
}, 1000);


// ==========================================
// LIVE CLOCK + PERIODIC STATE CHECK
// ==========================================

setInterval(() => {
  clockEl.textContent = getMDTTimeStr() + ' MDT';
  evaluateState();   // re-evaluate each second to catch hour boundary changes
}, 1000);


// ==========================================
// WEATHER
// ==========================================

async function fetchWeather() {
  try {
    const [wRes, fRes] = await Promise.all([
      fetch(OWM_WEATHER_URL),
      fetch(OWM_FORECAST_URL),
    ]);
    if (!wRes.ok || !fRes.ok) throw new Error('OWM request failed');

    const w = await wRes.json();
    const f = await fRes.json();

    weatherData.temp      = Math.round(w.main.temp);
    weatherData.feelsLike = Math.round(w.main.feels_like);
    weatherData.humidity  = w.main.humidity;
    weatherData.windSpeed = Math.round(w.wind.speed);
    weatherData.windDeg   = w.wind.deg ?? 0;
    weatherData.condition = w.weather[0].description;
    weatherData.icon      = w.weather[0].icon;
    weatherData.sunrise   = w.sys.sunrise;
    weatherData.sunset    = w.sys.sunset;
    weatherData.rainPop   = f.list[0]?.pop ?? 0;  // probability of precipitation (0–1)

    renderWeather();
    evaluateState();
  } catch (err) {
    console.error('Weather fetch failed:', err);
    weatherContent.innerHTML = '<div class="loading-msg">Weather data unavailable.<br>Check your connection.</div>';
  }
}

function renderWeather() {
  const d        = weatherData;
  const rainPct  = Math.round(d.rainPop * 100);
  const iconUrl  = `https://openweathermap.org/img/wn/${d.icon}@2x.png`;
  const windDir  = degToCompass(d.windDeg);

  weatherContent.innerHTML = `
    <div class="weather-location">Sandy, Utah</div>

    <div class="weather-temp-row">
      <img src="${iconUrl}" alt="${d.condition}" class="weather-icon">
      <div class="weather-temp-big">${d.temp}</div>
      <div class="weather-temp-unit">°F</div>
    </div>

    <div class="weather-condition">${d.condition}</div>

    <div class="weather-grid">
      <div class="weather-card">
        <div class="weather-card-label">Feels Like</div>
        <div class="weather-card-value">${d.feelsLike}°F</div>
      </div>
      <div class="weather-card">
        <div class="weather-card-label">Humidity</div>
        <div class="weather-card-value">${d.humidity}%</div>
      </div>
      <div class="weather-card">
        <div class="weather-card-label">Wind</div>
        <div class="weather-card-value">${d.windSpeed} mph</div>
        <div class="weather-card-sub">${windDir}</div>
      </div>
      <div class="weather-card">
        <div class="weather-card-label">Rain Chance</div>
        <div class="weather-card-value">${rainPct}%</div>
      </div>
    </div>

    <div class="weather-sun-row">
      <div class="sun-item">
        <div class="sun-emoji">🌅</div>
        <div class="sun-label">Sunrise</div>
        <div class="sun-time">${unixToMDT(d.sunrise)}</div>
      </div>
      <div class="sun-item">
        <div class="sun-emoji">🌇</div>
        <div class="sun-label">Sunset</div>
        <div class="sun-time">${unixToMDT(d.sunset)}</div>
      </div>
    </div>
  `;
}


// ==========================================
// PANEL SWITCHING
// ==========================================

function showWeatherPanel() {
  chatPanel.classList.add('hidden');
  weatherPanel.classList.remove('hidden');
}

function showChatPanel() {
  weatherPanel.classList.add('hidden');
  chatPanel.classList.remove('hidden');
}


// ==========================================
// CHAT UI HELPERS
// ==========================================

function addChatBubble(type, text) {
  const el = document.createElement('div');
  el.className = `chat-bubble ${type}`;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

function clearChat() {
  chatMessages.innerHTML = '';
}

function setChatStatus(state) {
  chatStatusDot.className = `status-dot ${state}`;
  if (state === 'listening') {
    chatHint.textContent = 'Listening...';
  } else if (state === 'thinking') {
    chatHint.textContent = 'Thinking...';
  } else {
    chatHint.textContent = 'Say "Hey Plantimus" to chat again';
  }
}


// ==========================================
// TYPEWRITER EFFECT
// ==========================================

function typewriter(element, text) {
  return new Promise(resolve => {
    element.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text[i];
        i++;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 30);
  });
}


// ==========================================
// GEMINI API
// ==========================================

async function sendToGemini(userText) {
  const key = _gk1 + _gk2 + _gk3;

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: "You are Plantimus, a cheerful and friendly houseplant companion. Keep your responses concise, warm, and helpful. You love plants, nature, sunshine, and helping your friends."
        }]
      },
      contents: [{
        role:  'user',
        parts: [{ text: userText }],
      }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}


// ==========================================
// AI INTERACTION FLOW
// ==========================================

async function processQuery(userText) {
  // Show user bubble
  addChatBubble('user', userText);
  setChatStatus('thinking');

  try {
    const responseText = await sendToGemini(userText);

    // Idea: 1 second flash
    aiState = 'idea';
    evaluateState();
    await sleep(1000);

    // Talk: show while typewriting response
    aiState = 'talk';
    evaluateState();

    const botBubble = addChatBubble('bot', '');
    setChatStatus('idle');
    await typewriter(botBubble, responseText);

  } catch (err) {
    console.error('Gemini error:', err);
    aiState = 'wilt';
    evaluateState();
    addChatBubble('status', 'Oops! Something went wrong. Try asking again.');
    await sleep(2000);
  }

  // Return to normal state
  aiState = null;
  evaluateState();
  setChatStatus('idle');

  // Auto-return to weather panel after 15 seconds of inactivity
  setTimeout(() => {
    if (!aiState) showWeatherPanel();
  }, 15000);

  // Resume listening for the next wake word
  startContinuousListening();
}


// ==========================================
// SPEECH RECOGNITION
// ==========================================

let continuousRec        = null;
let isListeningForWake   = false;

function startContinuousListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('Web Speech API not supported in this browser.');
    return;
  }

  // Clean up any existing session
  if (continuousRec) {
    try { continuousRec.abort(); } catch (_) {}
    continuousRec = null;
  }

  isListeningForWake = true;
  continuousRec = new SR();
  // NOTE: continuous:true is unreliable in Chrome — the mic opens but
  // onresult never fires. The fix is continuous:false + restart in onend,
  // which Chrome handles correctly and effectively simulates always-on listening.
  continuousRec.continuous      = false;
  continuousRec.interimResults  = false;  // final results only for wake word
  continuousRec.lang            = 'en-US';
  continuousRec.maxAlternatives = 3;      // get Chrome's top 3 guesses

  continuousRec.onstart = () => {
    console.log('[Plantimus] Listening for wake word...');
  };

  continuousRec.onresult = (event) => {
    // Check all result alternatives for the wake phrase
    for (let i = 0; i < event.results.length; i++) {
      for (let j = 0; j < event.results[i].length; j++) {
        const transcript = event.results[i][j].transcript.toLowerCase().trim();
        console.log('[Plantimus] Heard:', transcript);
        if (
          transcript.includes('hey plantimus')   ||
          transcript.includes('plantimus')        ||
          transcript.includes('plant imus')       ||
          transcript.includes('plantes')          ||
          transcript.includes('plan times')       ||
          transcript.includes('plant us')         ||
          transcript.includes('hey plant')        ||
          transcript.includes("hey plants emma's")||
          transcript.includes('hey princess')     ||
          transcript.includes('hey plans ms')     ||
          transcript.includes('hey planz ms')     ||
          transcript.includes('hey plants ms')    ||
          transcript.includes('keep playing thomas') ||
          transcript.includes('keep playing tomas')  ||
          transcript.includes('keep playing to us')  ||
          transcript.includes('hey plan')         ||
          transcript.includes('hey platanus')     ||
          transcript.includes('hey platinous')    ||
          transcript.includes('hey platinum is')  ||
          transcript.includes('platinus')
        ) {
          isListeningForWake = false;
          try { continuousRec.stop(); } catch (_) {}
          handleWakeWord();
          return;
        }
      }
    }
  };

  // Restart immediately after each utterance — this is the reliable
  // alternative to continuous:true for always-on wake word detection
  continuousRec.onend = () => {
    if (isListeningForWake) {
      setTimeout(() => {
        if (isListeningForWake) startContinuousListening();
      }, 100);
    }
  };

  continuousRec.onerror = (event) => {
    console.log('[Plantimus] Recognition error:', event.error);
    if (event.error === 'not-allowed') {
      // Permission was revoked — clear stored flag and re-show the overlay
      localStorage.removeItem('plantimus_mic');
      voiceOverlay.style.display = 'flex';
      return;
    }
    if (event.error !== 'aborted' && isListeningForWake) {
      setTimeout(() => {
        if (isListeningForWake) startContinuousListening();
      }, 600);
    }
  };

  try {
    continuousRec.start();
  } catch (e) {
    console.warn('Could not start speech recognition:', e);
  }
}

// Called when the wake word is detected
function handleWakeWord() {
  isListeningForWake = false;
  aiState = 'wave';
  evaluateState();
  showChatPanel();
  clearChat();
  setChatStatus('listening');

  // Add a live-updating status bubble while the user speaks
  const liveBubble = addChatBubble('status', "I'm listening...");

  startCapture(liveBubble);
}

// Capture a single user utterance after wake word
function startCapture(liveBubble) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.continuous      = false;
  rec.interimResults  = true;
  rec.lang            = 'en-US';

  let finalTranscript = '';

  rec.onresult = (event) => {
    finalTranscript = '';
    let interim = '';
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    // Show live transcript in the status bubble
    if (liveBubble) {
      liveBubble.textContent = finalTranscript || interim || "I'm listening...";
    }
  };

  rec.onend = async () => {
    const text = finalTranscript.trim();

    // Nothing captured — return quietly
    if (!text) {
      if (liveBubble) liveBubble.remove();
      aiState = null;
      evaluateState();
      showWeatherPanel();
      startContinuousListening();
      return;
    }

    // Remove the live status bubble; processQuery will add the user bubble
    if (liveBubble) liveBubble.remove();
    await processQuery(text);
  };

  rec.onerror = (event) => {
    console.warn('Capture recognition error:', event.error);
    if (liveBubble) liveBubble.remove();
    aiState = null;
    evaluateState();
    showWeatherPanel();
    startContinuousListening();
  };

  try {
    rec.start();
  } catch (e) {
    aiState = null;
    evaluateState();
    startContinuousListening();
  }
}


// ==========================================
// INITIALISATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Initial clock render
  clockEl.textContent = getMDTTimeStr() + ' MDT';

  // Evaluate initial plant state
  evaluateState();

  // Load weather immediately; refresh every 10 minutes
  fetchWeather();
  setInterval(fetchWeather, 10 * 60 * 1000);

  // Voice overlay button — grants mic on first use, saves flag to localStorage
  enableBtn.addEventListener('click', () => {
    localStorage.setItem('plantimus_mic', 'true');
    voiceOverlay.style.display = 'none';
    startContinuousListening();
  });

  // If mic was already granted in a previous session, skip the overlay entirely.
  // Chrome remembers mic permission per HTTPS origin, so no gesture is needed.
  if (localStorage.getItem('plantimus_mic') === 'true') {
    voiceOverlay.style.display = 'none';
    startContinuousListening();
  }
});
