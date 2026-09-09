/* =========================================================
   script.js — J.A.R.V.I.S. BUTTON + AI CONTROL SYSTEM
   ========================================================= */

const CONFIG = {
  // ఇక్కడ మీ Gemini API Key ను పేస్ట్ చేయండి
  GEMINI_API_KEY: "AQ.Ab8RN6Ku6L_MpoAl9bz6RGAq7tRqEbaH3POY2HSV_2L184uzRQ",
  GEMINI_MODEL: "gemini-2.5-flash",

  SYSTEM_PROMPT: `
You are J.A.R.V.I.S., a personal AI assistant.
Call the user Boss when appropriate.
Give useful, accurate and concise answers.
`
};

/* =========================
   ELEMENTS
   ========================= */

const coreButton = document.getElementById("coreButton");
const jarvisCore = document.getElementById("jarvisCore");

const micButton = document.getElementById("micButton");
const sendButton = document.getElementById("sendButton");
const speakButton = document.getElementById("speakButton");

const userInput = document.getElementById("userInput");
const messages = document.getElementById("messages");

const voiceOverlay = document.getElementById("voiceOverlay");
const voiceText = document.getElementById("voiceText");
const stopVoice = document.getElementById("stopVoice");

const systemTitle = document.getElementById("systemTitle");
const systemSubtitle = document.getElementById("systemSubtitle");

const toast = document.getElementById("toast");

/* =========================
   STATE
   ========================= */

let conversation = [];
let lastAIResponse = "";
let isProcessing = false;
let isListening = false;
let recognition = null;
let availableVoices = [];

/* =========================
   STARTUP
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  initializeVoice();
  if (userInput) userInput.focus();
});

/* =========================
   CORE BUTTON
   ========================= */

if (coreButton) {
  coreButton.addEventListener("click", () => {
    coreButton.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(.82)" },
        { transform: "scale(1.12)" },
        { transform: "scale(1)" }
      ],
      {
        duration: 500,
        easing: "ease-out"
      }
    );

    if (jarvisCore) jarvisCore.classList.add("processing");

    if (systemTitle) systemTitle.textContent = "J.A.R.V.I.S. ACTIVE";
    if (systemSubtitle) systemSubtitle.textContent = "Awaiting your command, Boss.";

    setTimeout(() => {
      if (!isProcessing && !isListening) {
        if (jarvisCore) jarvisCore.classList.remove("processing");
        if (systemTitle) systemTitle.textContent = "SYSTEMS ONLINE";
        if (systemSubtitle) systemSubtitle.textContent = "All J.A.R.V.I.S. systems are operational.";
      }
    }, 1800);

    if (userInput) userInput.focus();
  });
}

/* =========================
   SEND BUTTON
   ========================= */

if (sendButton) {
  sendButton.addEventListener("click", () => {
    sendMessage();
  });
}

/* =========================
   ENTER BUTTON
   ========================= */

if (userInput) {
  userInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

/* =========================
   SEND MESSAGE
   ========================= */

async function sendMessage() {
  if (isProcessing) return;

  const text = userInput ? userInput.value.trim() : "";

  if (!text) {
    showToast("Enter a command");
    return;
  }

  if (userInput) userInput.value = "";

  addMessage("user", text);

  conversation.push({
    role: "user",
    parts: [{ text: text }]
  });

  const typing = addTyping();
  setProcessing(true);

  try {
    const answer = await askGemini();

    if (typing) typing.remove();

    addMessage("jarvis", answer);

    conversation.push({
      role: "model",
      parts: [{ text: answer }]
    });

    lastAIResponse = answer;
    speak(answer);

  } catch (error) {
    if (typing) typing.remove();
    console.error(error);
    addMessage("jarvis", getErrorMessage(error));
  } finally {
    setProcessing(false);
  }
}

/* =========================
   GEMINI API
   ========================= */

async function askGemini() {
  const key = CONFIG.GEMINI_API_KEY ? CONFIG.GEMINI_API_KEY.trim() : "";

  if (!key || key === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("API_KEY_MISSING");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: CONFIG.SYSTEM_PROMPT }]
      },
      contents: conversation,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1200
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini:", data);
    throw new Error(data?.error?.message || `HTTP ${response.status}`);
  }

  const answer = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error("EMPTY_RESPONSE");
  }

  return answer;
}

/* =========================
   MESSAGE UI
   ========================= */

function addMessage(type, text) {
  if (!messages) return null;

  const element = document.createElement("div");
  element.className = type === "user" ? "message user-message" : "message jarvis-message";

  element.innerHTML = `
    <span class="message-label">
      ${type === "user" ? "YOU" : "J.A.R.V.I.S."}
    </span>
    <p>${escapeHTML(text).replace(/\n/g, "<br>")}</p>
  `;

  messages.appendChild(element);
  scrollMessages();
  return element;
}

/* =========================
   TYPING
   ========================= */

function addTyping() {
  if (!messages) return null;

  const element = document.createElement("div");
  element.className = "message jarvis-message";

  element.innerHTML = `
    <span class="message-label">J.A.R.V.I.S.</span>
    <p class="typing">
      <span></span>
      <span></span>
      <span></span>
    </p>
  `;

  messages.appendChild(element);
  scrollMessages();
  return element;
}

/* =========================
   PROCESSING
   ========================= */

function setProcessing(value) {
  isProcessing = value;

  if (jarvisCore) {
    jarvisCore.classList.toggle("processing", value);
  }

  if (value) {
    if (systemTitle) systemTitle.textContent = "PROCESSING";
    if (systemSubtitle) systemSubtitle.textContent = "J.A.R.V.I.S. is processing...";
  } else {
    if (systemTitle) systemTitle.textContent = "SYSTEMS ONLINE";
    if (systemSubtitle) systemSubtitle.textContent = "All J.A.R.V.I.S. systems are operational.";
  }
}

/* =========================
   MICROPHONE
   ========================= */

function initializeVoice() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (micButton) {
      micButton.style.opacity = "0.4";
      micButton.addEventListener("click", () => {
        showToast("Voice input is not supported in this browser");
      });
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    if (micButton) micButton.classList.add("active");
    if (voiceOverlay) voiceOverlay.classList.add("active");
    if (voiceText) voiceText.textContent = "Listening...";
    if (jarvisCore) jarvisCore.classList.add("processing");
  };

  recognition.onresult = event => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        finalText += text;
      } else {
        interimText += text;
      }
    }

    const current = finalText || interimText;
    if (voiceText) voiceText.textContent = current || "Listening...";
    if (finalText && userInput) {
      userInput.value = finalText.trim();
    }
  };

  recognition.onerror = event => {
    console.error("Speech error:", event.error);
    isListening = false;

    if (micButton) micButton.classList.remove("active");
    if (voiceOverlay) voiceOverlay.classList.remove("active");
    if (jarvisCore) jarvisCore.classList.remove("processing");

    if (event.error === "not-allowed") {
      showToast("Microphone permission denied");
    } else {
      showToast("Microphone error");
    }
  };

  recognition.onend = () => {
    isListening = false;

    if (micButton) micButton.classList.remove("active");
    if (voiceOverlay) voiceOverlay.classList.remove("active");

    if (!isProcessing && jarvisCore) {
      jarvisCore.classList.remove("processing");
    }

    const text = userInput ? userInput.value.trim() : "";
    if (text && !isProcessing) {
      setTimeout(() => {
        sendMessage();
      }, 250);
    }
  };
}

/* =========================
   MIC BUTTON EVENT
   ========================= */

if (micButton) {
  micButton.addEventListener("click", () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      return;
    }

    if (userInput) userInput.value = "";

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
    }
  });
}

/* =========================
   CANCEL VOICE
   ========================= */

if (stopVoice) {
  stopVoice.addEventListener("click", () => {
    if (recognition && isListening) {
      recognition.stop();
    }
    if (voiceOverlay) voiceOverlay.classList.remove("active");
    if (micButton) micButton.classList.remove("active");
  });
}

/* =========================
   SPEAK BUTTON
   ========================= */

if (speakButton) {
  speakButton.addEventListener("click", () => {
    if (!lastAIResponse) {
      showToast("No response available");
      return;
    }
    speak(lastAIResponse);
  });
}

/* =========================
   TEXT TO SPEECH
   ========================= */

function updateVoiceList() {
  if ("speechSynthesis" in window) {
    availableVoices = speechSynthesis.getVoices();
  }
}

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = updateVoiceList;
  updateVoiceList();
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    showToast("Voice output is not supported");
    return;
  }

  speechSynthesis.cancel();

  const cleanText = text
    .replace(/[*#_`]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "en-IN";
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 1;

  if (!availableVoices.length) {
    availableVoices = speechSynthesis.getVoices();
  }

  const voice =
    availableVoices.find(v => /en-IN/i.test(v.lang)) ||
    availableVoices.find(v => /en-US/i.test(v.lang));

  if (voice) {
    utterance.voice = voice;
  }

  utterance.onstart = () => {
    if (jarvisCore) jarvisCore.classList.add("processing");
    if (systemTitle) systemTitle.textContent = "J.A.R.V.I.S. SPEAKING";
  };

  utterance.onend = () => {
    if (!isProcessing) {
      if (jarvisCore) jarvisCore.classList.remove("processing");
      if (systemTitle) systemTitle.textContent = "SYSTEMS ONLINE";
      if (systemSubtitle) systemSubtitle.textContent = "All J.A.R.V.I.S. systems are operational.";
    }
  };

  speechSynthesis.speak(utterance);
}

/* =========================
   UTILITY
   ========================= */

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function scrollMessages() {
  if (!messages) return;
  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });
}

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function getErrorMessage(error) {
  if (error.message === "API_KEY_MISSING") {
    return "Boss, Gemini API key ఇంకా CONFIG section లో పెట్టలేదు.";
  }
  if (error.message === "EMPTY_RESPONSE") {
    return "Boss, AI నుండి response రాలేదు.";
  }
  if (/429|quota/i.test(error.message)) {
    return "Boss, Gemini API quota సమస్య ఉంది.";
  }
  if (/403|permission|api key/i.test(error.message)) {
    return "Boss, Gemini API key లేదా API permission check చేయండి.";
  }
  if (/Failed to fetch|NetworkError/i.test(error.message)) {
    return "Boss, internet connection check చేయండి.";
  }
  return "Boss, AI connection లో సమస్య వచ్చింది: " + error.message;
}

/* =========================
   ONLINE / OFFLINE
   ========================= */

window.addEventListener("online", () => {
  if (systemTitle) systemTitle.textContent = "SYSTEMS ONLINE";
  if (systemSubtitle) systemSubtitle.textContent = "Network connection restored.";
});

window.addEventListener("offline", () => {
  if (systemTitle) systemTitle.textContent = "OFFLINE";
  if (systemSubtitle) systemSubtitle.textContent = "Internet connection unavailable.";
});
