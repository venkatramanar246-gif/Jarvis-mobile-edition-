

/* ============================================================
   J.A.R.V.I.S. CONFIGURATION
   Paste your Gemini API key ONLY here.
   ============================================================ */

const CONFIG = {
  GEMINI_API_KEY: "",

  GEMINI_MODEL: "gemini-2.5-flash",

  SYSTEM_PROMPT: `
You are J.A.R.V.I.S., a highly capable personal AI assistant.

Address the user naturally and respectfully. You may call the user "Boss"
when appropriate.

Give accurate, useful and concise answers.

You are operating inside a mobile J.A.R.V.I.S. interface.
Do not describe the interface unless asked.

Never claim that you performed a real device action unless the browser
actually provides the required capability.

When voice mode is active, keep spoken responses natural and reasonably concise.
`
};


/* ============================================================
   ELEMENTS
   ============================================================ */

const $ = id => document.getElementById(id);

const core = $("jarvisCore");
const coreButton = $("coreButton");
const userInput = $("userInput");
const sendButton = $("sendButton");
const micButton = $("micButton");
const speakButton = $("speakButton");

const messages = $("messages");

const voiceOverlay = $("voiceOverlay");
const voiceText = $("voiceText");
const stopVoice = $("stopVoice");

const toast = $("toast");
const systemTitle = $("systemTitle");
const systemSubtitle = $("systemSubtitle");


/* ============================================================
   STATE
   ============================================================ */

let conversation = [];

let lastAIResponse = "";

let isProcessing = false;

let recognition = null;

let listening = false;

let speechEnabled = true;


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  initializeSpeechRecognition();

  systemBootAnimation();

  userInput.focus();

});


/* ============================================================
   SYSTEM BOOT
   ============================================================ */

function systemBootAnimation() {

  systemTitle.textContent = "INITIALIZING";

  systemSubtitle.textContent = "J.A.R.V.I.S. core systems starting...";

  document.body.classList.add("processing");

  setTimeout(() => {

    systemTitle.textContent = "SYSTEMS ONLINE";

    systemSubtitle.textContent =
      "All J.A.R.V.I.S. systems are operational.";

    document.body.classList.remove("processing");

  }, 1300);

}


/* ============================================================
   UI HELPERS
   ============================================================ */

function escapeHTML(text) {

  const div = document.createElement("div");

  div.textContent = text;

  return div.innerHTML;

}


function scrollMessages() {

  requestAnimationFrame(() => {

    messages.scrollTop = messages.scrollHeight;

  });

}


function showToast(text) {

  toast.textContent = text;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2200);

}


function setProcessing(state) {

  isProcessing = state;

  core.classList.toggle("processing", state);

  if (state) {

    systemTitle.textContent = "PROCESSING";

    systemSubtitle.textContent =
      "J.A.R.V.I.S. is processing your request...";

  } else {

    systemTitle.textContent = "SYSTEMS ONLINE";

    systemSubtitle.textContent =
      "All J.A.R.V.I.S. systems are operational.";

  }

}


function addMessage(type, text) {

  const message = document.createElement("div");

  message.className =
    `message ${type === "user" ? "user-message" : "jarvis-message"}`;

  const label =
    type === "user" ? "YOU" : "J.A.R.V.I.S.";

  message.innerHTML = `
    <span class="message-label">${label}</span>
    <p>${escapeHTML(text).replace(/\n/g, "<br>")}</p>
  `;

  messages.appendChild(message);

  scrollMessages();

  return message;

}


function addTypingMessage() {

  const message = document.createElement("div");

  message.className = "message jarvis-message";

  message.innerHTML = `
    <span class="message-label">J.A.R.V.I.S.</span>
    <p class="typing">
      <span></span>
      <span></span>
      <span></span>
    </p>
  `;

  messages.appendChild(message);

  scrollMessages();

  return message;

}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage() {

  if (isProcessing) return;

  const text = userInput.value.trim();

  if (!text) return;

  userInput.value = "";

  addMessage("user", text);

  conversation.push({
    role: "user",
    parts: [
      {
        text
      }
    ]
  });

  const typing = addTypingMessage();

  setProcessing(true);

  try {

    const response = await askGemini();

    typing.remove();

    addMessage("jarvis", response);

    conversation.push({
      role: "model",
      parts: [
        {
          text: response
        }
      ]
    });

    lastAIResponse = response;

    if (speechEnabled) {

      speak(response);

    }

  } catch (error) {

    typing.remove();

    const message = getReadableError(error);

    addMessage("jarvis", message);

    showToast("AI connection error");

  } finally {

    setProcessing(false);

  }

}


/* ============================================================
   GEMINI API
   ============================================================ */

async function askGemini() {

  const apiKey = CONFIG.GEMINI_API_KEY.trim();

  if (
    !apiKey ||
    apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE"
  ) {

    throw new Error(
      "Gemini API key is not configured. Paste your API key in CONFIG.GEMINI_API_KEY."
    );

  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(CONFIG.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: CONFIG.SYSTEM_PROMPT
        }
      ]
    },
    ...conversation
  ];

  const response = await fetch(endpoint, {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      contents,

      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1200
      }
    })

  });

  let data = null;

  try {

    data = await response.json();

  } catch {

    throw new Error("Invalid response from Gemini.");

  }

  if (!response.ok) {

    const apiMessage =
      data?.error?.message ||
      `Gemini request failed with HTTP ${response.status}.`;

    throw new Error(apiMessage);

  }

  const answer =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

  if (!answer) {

    throw new Error("Gemini returned an empty response.");

  }

  return answer;

}


/* ============================================================
   ERROR HANDLING
   ============================================================ */

function getReadableError(error) {

  const text = String(error?.message || error);

  if (
    text.toLowerCase().includes("api key") ||
    text.toLowerCase().includes("api_key")
  ) {

    return "Boss, the Gemini API key has not been configured yet.";

  }

  if (
    text.toLowerCase().includes("quota") ||
    text.toLowerCase().includes("429")
  ) {

    return "Boss, the Gemini API quota appears to be unavailable right now.";

  }

  if (
    text.toLowerCase().includes("permission") ||
    text.toLowerCase().includes("403")
  ) {

    return "Boss, Gemini rejected the API request. Please check the API key and API access.";

  }

  if (text.toLowerCase().includes("failed to fetch")) {

    return "Boss, I could not reach the Gemini service. Check your internet connection.";

  }

  return `Boss, I encountered an error: ${text}`;

}


/* ============================================================
   BUTTON EVENTS
   ============================================================ */

sendButton.addEventListener("click", sendMessage);


userInput.addEventListener("keydown", event => {

  if (event.key === "Enter") {

    event.preventDefault();

    sendMessage();

  }

});


coreButton.addEventListener("click", () => {

  coreButton.animate(
    [
      {
        transform: "scale(1)"
      },
      {
        transform: "scale(.86)"
      },
      {
        transform: "scale(1.08)"
      },
      {
        transform: "scale(1)"
      }
    ],
    {
      duration: 450,
      easing: "ease-out"
    }
  );

  userInput.focus();

});


speakButton.addEventListener("click", () => {

  if (!lastAIResponse) {

    showToast("No J.A.R.V.I.S. response to speak");

    return;

  }

  speechEnabled = true;

  speak(lastAIResponse);

});


/* ============================================================
   SPEECH OUTPUT
   ============================================================ */

function speak(text) {

  if (!("speechSynthesis" in window)) {

    showToast("Voice output is not supported");

    return;

  }

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/[*#_`]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1");

  const utterance =
    new SpeechSynthesisUtterance(cleanText);

  utterance.lang = "en-US";

  utterance.rate = 0.94;

  utterance.pitch = 0.86;

  utterance.volume = 1;

  const voices =
    window.speechSynthesis.getVoices();

  const preferredVoice =
    voices.find(v =>
      /Google US English/i.test(v.name)
    ) ||
    voices.find(v =>
      /Microsoft.*English/i.test(v.name)
    ) ||
    voices.find(v =>
      /^en-US/i.test(v.lang)
    );

  if (preferredVoice) {

    utterance.voice = preferredVoice;

  }

  utterance.onstart = () => {

    core.classList.add("processing");

  };

  utterance.onend = () => {

    if (!isProcessing) {

      core.classList.remove("processing");

    }

  };

  window.speechSynthesis.speak(utterance);

}


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function initializeSpeechRecognition() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {

    micButton.style.opacity = ".45";

    micButton.title =
      "Speech recognition is not supported in this browser";

    return;

  }

  recognition = new SpeechRecognition();

  recognition.lang = "en-US";

  recognition.continuous = false;

  recognition.interimResults = true;

  recognition.maxAlternatives = 1;


  recognition.onstart = () => {

    listening = true;

    micButton.classList.add("active");

    voiceOverlay.classList.add("active");

    voiceText.textContent = "Listening...";

    core.classList.add("processing");

  };


  recognition.onresult = event => {

    let finalText = "";

    let interimText = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {

      const transcript =
        event.results[i][0].transcript;

      if (event.results[i].isFinal) {

        finalText += transcript;

      } else {

        interimText += transcript;

      }

    }

    const displayed =
      finalText || interimText;

    voiceText.textContent =
      displayed || "Speak your command...";

    if (finalText) {

      userInput.value = finalText.trim();

    }

  };


  recognition.onerror = event => {

    listening = false;

    micButton.classList.remove("active");

    voiceOverlay.classList.remove("active");

    core.classList.remove("processing");

    if (event.error === "not-allowed") {

      showToast("Microphone permission denied");

    } else if (event.error !== "aborted") {

      showToast(`Voice error: ${event.error}`);

    }

  };


  recognition.onend = () => {

    const hadText =
      userInput.value.trim().length > 0;

    listening = false;

    micButton.classList.remove("active");

    voiceOverlay.classList.remove("active");

    if (!isProcessing) {

      core.classList.remove("processing");

    }

    if (hadText) {

      setTimeout(() => {

        sendMessage();

      }, 250);

    }

  };

}


/* ============================================================
   MICROPHONE
   ============================================================ */

micButton.addEventListener("click", () => {

  if (!recognition) {

    showToast("Speech recognition is not supported");

    return;

  }

  if (listening) {

    recognition.stop();

    return;

  }

  try {

    userInput.value = "";

    recognition.start();

  } catch (error) {

    showToast("Microphone is already active");

  }

});


stopVoice.addEventListener("click", () => {

  if (recognition && listening) {

    recognition.stop();

  }

  voiceOverlay.classList.remove("active");

  micButton.classList.remove("active");

});


/* ============================================================
   MOBILE VOICE / KEYBOARD BEHAVIOR
   ============================================================ */

userInput.addEventListener("focus", () => {

  document.body.classList.add("keyboard-active");

});


userInput.addEventListener("blur", () => {

  document.body.classList.remove("keyboard-active");

});


/* ============================================================
   ENTER / SPACE CORE INTERACTION
   ============================================================ */

document.addEventListener("keydown", event => {

  if (
    event.key === "/" &&
    document.activeElement !== userInput
  ) {

    event.preventDefault();

    userInput.focus();

  }

});


/* ============================================================
   ONLINE STATUS MONITOR
   ============================================================ */

window.addEventListener("online", () => {

  systemSubtitle.textContent =
    "Network connection restored.";

  setTimeout(() => {

    if (!isProcessing) {

      systemSubtitle.textContent =
        "All J.A.R.V.I.S. systems are operational.";

    }

  }, 1800);

});


window.addEventListener("offline", () => {

  systemTitle.textContent = "OFFLINE";

  systemSubtitle.textContent =
    "Network connection unavailable.";

});


/* ============================================================
   STOP SPEECH WHEN PAGE IS HIDDEN
   ============================================================ */

document.addEventListener("visibilitychange", () => {

  if (document.hidden && "speechSynthesis" in window) {

    window.speechSynthesis.cancel();

  }

});


/* ============================================================
   INITIAL VOICE LIST LOAD
   ============================================================ */

if ("speechSynthesis" in window) {

  window.speechSynthesis.onvoiceschanged = () => {

    window.speechSynthesis.getVoices();

  };

}
