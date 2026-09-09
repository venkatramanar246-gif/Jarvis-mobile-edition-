/* =========================================================
   script.js — J.A.R.V.I.S. BUTTON + AI CONTROL SYSTEM
   ========================================================= */

const CONFIG = {
  GEMINI_API_KEY: "AQ.Ab8RN6LGXSDFszMkxd4iGtkW4HcnhogOZ822jUP2a90EAH_MaQ",
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


/* =========================
   STARTUP
   ========================= */

document.addEventListener("DOMContentLoaded", () => {

  initializeVoice();

  userInput.focus();

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

    jarvisCore.classList.add("processing");

    systemTitle.textContent = "J.A.R.V.I.S. ACTIVE";
    systemSubtitle.textContent =
      "Awaiting your command, Boss.";

    setTimeout(() => {

      if (!isProcessing && !isListening) {

        jarvisCore.classList.remove("processing");

        systemTitle.textContent = "SYSTEMS ONLINE";

        systemSubtitle.textContent =
          "All J.A.R.V.I.S. systems are operational.";

      }

    }, 1800);

    userInput.focus();

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

  const text = userInput.value.trim();

  if (!text) {

    showToast("Enter a command");

    return;

  }

  userInput.value = "";

  addMessage("user", text);

  conversation.push({
    role: "user",
    parts: [
      {
        text: text
      }
    ]
  });

  const typing = addTyping();

  setProcessing(true);

  try {

    const answer = await askGemini();

    typing.remove();

    addMessage("jarvis", answer);

    conversation.push({
      role: "model",
      parts: [
        {
          text: answer
        }
      ]
    });

    lastAIResponse = answer;

    speak(answer);

  } catch (error) {

    typing.remove();

    console.error(error);

    addMessage(
      "jarvis",
      getErrorMessage(error)
    );

  } finally {

    setProcessing(false);

  }

}


/* =========================
   GEMINI
   ========================= */

async function askGemini() {

  const key = CONFIG.GEMINI_API_KEY.trim();

  if (
    !key ||
    key === "PASTE_YOUR_GEMINI_API_KEY_HERE"
  ) {

    throw new Error("API_KEY_MISSING");

  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({

      systemInstruction: {
        parts: [
          {
            text: CONFIG.SYSTEM_PROMPT
          }
        ]
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

    throw new Error(
      data?.error?.message ||
      `HTTP ${response.status}`
    );

  }

  const answer =
    data?.candidates?.[0]?.content?.parts
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

  const element =
    document.createElement("div");

  element.className =
    type === "user"
      ? "message user-message"
      : "message jarvis-message";

  element.innerHTML = `

    <span class="message-label">
      ${type === "user" ? "YOU" : "J.A.R.V.I.S."}
    </span>

    <p>${escapeHTML(text)
      .replace(/\n/g, "<br>")}</p>

  `;

  messages.appendChild(element);

  scrollMessages();

  return element;

}


/* =========================
   TYPING
   ========================= */

function addTyping() {

  const element =
    document.createElement("div");

  element.className =
    "message jarvis-message";

  element.innerHTML = `

    <span class="message-label">
      J.A.R.V.I.S.
    </span>

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

  jarvisCore.classList.toggle(
    "processing",
    value
  );

  if (value) {

    systemTitle.textContent =
      "PROCESSING";

    systemSubtitle.textContent =
      "J.A.R.V.I.S. is processing...";

  } else {

    systemTitle.textContent =
      "SYSTEMS ONLINE";

    systemSubtitle.textContent =
      "All J.A.R.V.I.S. systems are operational.";

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

    micButton.style.opacity = "0.4";

    micButton.addEventListener("click", () => {

      showToast(
        "Voice input is not supported"
      );

    });

    return;

  }

  recognition =
    new SpeechRecognition();

  recognition.lang = "en-IN";

  recognition.continuous = false;

  recognition.interimResults = true;

  recognition.maxAlternatives = 1;


  recognition.onstart = () => {

    isListening = true;

    micButton.classList.add("active");

    voiceOverlay.classList.add("active");

    voiceText.textContent =
      "Listening...";

    jarvisCore.classList.add(
      "processing"
    );

  };


  recognition.onresult = event => {

    let finalText = "";
    let interimText = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {

      const result =
        event.results[i];

      const text =
        result[0].transcript;

      if (result.isFinal) {

        finalText += text;

      } else {

        interimText += text;

      }

    }

    const current =
      finalText || interimText;

    voiceText.textContent =
      current || "Listening...";

    if (finalText) {

      userInput.value =
        finalText.trim();

    }

  };


  recognition.onerror = event => {

    console.error(
      "Speech error:",
      event.error
    );

    isListening = false;

    micButton.classList.remove(
      "active"
    );

    voiceOverlay.classList.remove(
      "active"
    );

    jarvisCore.classList.remove(
      "processing"
    );

    if (event.error === "not-allowed") {

      showToast(
        "Microphone permission denied"
      );

    } else {

      showToast(
        "Microphone error"
      );

    }

  };


  recognition.onend = () => {

    isListening = false;

    micButton.classList.remove(
      "active"
    );

    voiceOverlay.classList.remove(
      "active"
    );

    if (!isProcessing) {

      jarvisCore.classList.remove(
        "processing"
      );

    }

    const text =
      userInput.value.trim();

    if (text) {

      setTimeout(() => {

        sendMessage();

      }, 250);

    }

  };

}


/* =========================
   MIC BUTTON
   ========================= */

micButton.addEventListener(
  "click",
  () => {

    if (!recognition) return;

    if (isListening) {

      recognition.stop();

      return;

    }

    userInput.value = "";

    try {

      recognition.start();

    } catch (error) {

      console.error(error);

    }

  }
);


/* =========================
   CANCEL VOICE
   ========================= */

if (stopVoice) {

  stopVoice.addEventListener(
    "click",
    () => {

      if (
        recognition &&
        isListening
      ) {

        recognition.stop();

      }

      voiceOverlay.classList.remove(
        "active"
      );

      micButton.classList.remove(
        "active"
      );

    }
  );

}


/* =========================
   SPEAK BUTTON
   ========================= */

if (speakButton) {

  speakButton.addEventListener(
    "click",
    () => {

      if (!lastAIResponse) {

        showToast(
          "No response available"
        );

        return;

      }

      speak(lastAIResponse);

    }
  );

}


/* =========================
   TEXT TO SPEECH
   ========================= */

function speak(text) {

  if (!("speechSynthesis" in window)) {

    showToast(
      "Voice output is not supported"
    );

    return;

  }

  speechSynthesis.cancel();

  const cleanText =
    text
      .replace(/[*#_`]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1");

  const utterance =
    new SpeechSynthesisUtterance(
      cleanText
    );

  utterance.lang = "en-IN";

  utterance.rate = 0.92;

  utterance.pitch = 0.82;

  utterance.volume = 1;

  const voices =
    speechSynthesis.getVoices();

  const voice =
    voices.find(v =>
      /en-IN/i.test(v.lang)
    ) ||
    voices.find(v =>
      /en-US/i.test(v.lang)
    );

  if (voice) {

    utterance.voice = voice;

  }

  utterance.onstart = () => {

    jarvisCore.classList.add(
      "processing"
    );

    systemTitle.textContent =
      "J.A.R.V.I.S. SPEAKING";

  };

  utterance.onend = () => {

    if (!isProcessing) {

      jarvisCore.classList.remove(
        "processing"
      );

      systemTitle.textContent =
        "SYSTEMS ONLINE";

      systemSubtitle.textContent =
        "All J.A.R.V.I.S. systems are operational.";

    }

  };

  speechSynthesis.speak(
    utterance
  );

}


/* =========================
   UTILITY
   ========================= */

function escapeHTML(text) {

  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;

}


function scrollMessages() {

  requestAnimationFrame(() => {

    messages.scrollTop =
      messages.scrollHeight;

  });

}


function showToast(text) {

  toast.textContent = text;

  toast.classList.add("show");

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 2200);

}


function getErrorMessage(error) {

  if (
    error.message ===
    "API_KEY_MISSING"
  ) {

    return "Boss, Gemini API key ఇంకా CONFIG section లో పెట్టలేదు.";

  }

  if (
    error.message ===
    "EMPTY_RESPONSE"
  ) {

    return "Boss, AI నుండి response రాలేదు.";

  }

  if (
    /429|quota/i.test(
      error.message
    )
  ) {

    return "Boss, Gemini API quota సమస్య ఉంది.";

  }

  if (
    /403|permission|api key/i.test(
      error.message
    )
  ) {

    return "Boss, Gemini API key లేదా API permission check చేయండి.";

  }

  if (
    /Failed to fetch|NetworkError/i.test(
      error.message
    )
  ) {

    return "Boss, internet connection check చేయండి.";

  }

  return "Boss, AI connection లో సమస్య వచ్చింది.";

}


/* =========================
   VOICE LIST
   ========================= */

if (
  "speechSynthesis" in window
) {

  speechSynthesis.onvoiceschanged =
    () => {

      speechSynthesis.getVoices();

    };

}


/* =========================
   ONLINE / OFFLINE
   ========================= */

window.addEventListener(
  "online",
  () => {

    systemTitle.textContent =
      "SYSTEMS ONLINE";

    systemSubtitle.textContent =
      "Network connection restored.";

  }
);


window.addEventListener(
  "offline",
  () => {

    systemTitle.textContent =
      "OFFLINE";

    systemSubtitle.textContent =
      "Internet connection unavailable.";

  }
);
