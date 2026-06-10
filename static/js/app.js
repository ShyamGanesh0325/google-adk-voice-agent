// Connect the server with a WebSocket connection
const sessionId = Math.random().toString().substring(10);
const ws_url =
  "ws://" + window.location.host + "/ws/" + sessionId;
let websocket = null;
let is_audio = false;
let is_video = false;

// Check microphone permissions on load
async function checkPermissions() {
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      handlePermissionStatus(permissionStatus.state);
      permissionStatus.onchange = () => handlePermissionStatus(permissionStatus.state);
    } catch (e) {
      console.warn("Permissions API not supported for microphone query", e);
    }
  }
}

function handlePermissionStatus(state) {
  const statusMessage = document.getElementById("status-message");
  if (!statusMessage) return;

  if (state === 'denied') {
    statusMessage.innerHTML = '<span style="color: #ff4444; font-weight: bold;">Microphone Blocked! Click the lock icon in the address bar to allow.</span>';
    const micButton = document.getElementById("micButton");
    if (micButton) micButton.style.opacity = "0.5";
  } else if (state === 'prompt') {
    statusMessage.textContent = "Click the mic icon to start (permission required)";
  }
}

checkPermissions();

// Get DOM elements
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("message");
const messagesDiv = document.getElementById("messages");
const videoElement = document.getElementById("videoElement");
let currentMessageId = null;

// WebSocket handlers
function connectWebsocket() {
  // Connect websocket
  websocket = new WebSocket(ws_url + "?is_audio=" + is_audio + "&is_video=" + is_video);

  // Handle connection open
  websocket.onopen = function () {
    // Connection opened messages
    console.log("WebSocket connection opened.");
    const statusMessage = document.getElementById("status-message");
    if (statusMessage) {
      statusMessage.textContent = "Connection opened";
    }

    // Enable the Send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.disabled = false;
    }
    addSubmitHandler();
  };

  // Handle incoming messages
  websocket.onmessage = function (event) {
    // Parse the incoming message
    const message_from_server = JSON.parse(event.data);
    console.log("[AGENT TO CLIENT] ", message_from_server);

    // Check if the turn is complete
    // if turn complete, add new message
    if (
      message_from_server.turn_complete &&
      message_from_server.turn_complete == true
    ) {
      currentMessageId = null;
      return;
    }

    // Check for interrupt message
    if (
      message_from_server.interrupted &&
      message_from_server.interrupted === true
    ) {
      // Stop audio playback if it's playing
      if (audioPlayerNode) {
        audioPlayerNode.port.postMessage({ command: "endOfAudio" });
      }
      return;
    }

    // If it's audio, play it
    if (message_from_server.mime_type == "audio/pcm" && audioPlayerNode) {
      audioPlayerNode.port.postMessage(base64ToArray(message_from_server.data));
    }

    // If it's a text, print it
    if (message_from_server.mime_type == "text/plain") {
      // add a new message for a new turn
      if (currentMessageId == null) {
        currentMessageId = Math.random().toString(36).substring(7);
        const message = document.createElement("div");
        message.id = currentMessageId;
        message.classList.add("message", "agent");
        // Append the message element to the messagesDiv
        if (messagesDiv) {
          messagesDiv.appendChild(message);
        }
      }

      // Add message text to the existing message element
      const message = document.getElementById(currentMessageId);
      if (message) {
        message.textContent += message_from_server.data;
      }

      // Scroll down to the bottom of the messagesDiv
      if (messagesDiv) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    }
  };

  // Handle connection close
  websocket.onclose = function () {
    console.log("WebSocket connection closed.");
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      sendButton.disabled = true;
    }
    const statusMessage = document.getElementById("status-message");
    if (statusMessage) {
      statusMessage.textContent = "Connection closed";
    }
    setTimeout(function () {
      console.log("Reconnecting...");
      connectWebsocket();
    }, 5000);
  };

  websocket.onerror = function (e) {
    console.log("WebSocket error: ", e);
  };
}
connectWebsocket();

// Add submit handler to the form
function addSubmitHandler() {
  if (messageForm) {
    messageForm.onsubmit = function (e) {
      e.preventDefault();
      const message = messageInput ? messageInput.value : "";
      if (message) {
        const p = document.createElement("div");
        p.classList.add("message", "user");
        p.textContent = message;
        if (messagesDiv) {
          messagesDiv.appendChild(p);
        }
        if (messageInput) {
          messageInput.value = "";
        }
        sendMessage({
          mime_type: "text/plain",
          data: message,
        });
        console.log("[CLIENT TO AGENT] " + message);
      }
      return false;
    };
  }
}

// Send a message to the server as a JSON string
function sendMessage(message) {
  if (websocket && websocket.readyState == WebSocket.OPEN) {
    const messageJson = JSON.stringify(message);
    websocket.send(messageJson);
  }
}

// Decode Base64 data to Array
function base64ToArray(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Audio handling
 */

let audioPlayerNode;
let audioPlayerContext;
let audioRecorderNode;
let audioRecorderContext;
let micStream;


let blobTime = 0;

// Video handling
let videoStream;
let videoInterval;
let isVideoActive = false;


// Audio buffering for 0.2s intervals
let audioBuffer = [];
let bufferTimer = null;

let visualizerCtx;
let visualizerCanvas;
let analyser;
let dataArray;
let visualizerAnimationId;
let visualizerMicSource;

const PARTICLE_COUNT = 600; // Shell, so fewer particles still look great
let membraneParticles = [];
let membraneTime = 0;

// Import the audio worklets
import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet } from "./audio-recorder.js";

// Start audio
async function startAudio() {
  try {
    const [playerData, recorderData] = await Promise.all([
      startAudioPlayerWorklet(),
      startAudioRecorderWorklet(audioRecorderHandler)
    ]);

    audioPlayerNode = playerData[0];
    audioPlayerContext = playerData[1];

    audioRecorderNode = recorderData[0];
    audioRecorderContext = recorderData[1];
    micStream = recorderData[2];

    setupVisualizer(audioPlayerContext, audioPlayerNode, micStream);
  } catch (e) {
    console.error("Error starting audio:", e);
    const statusMessage = document.getElementById("status-message");
    if (statusMessage) {
      if (e.name === "NotAllowedError") {
        statusMessage.textContent = "Microphone access denied. Please allow it in your browser.";
      } else if (e.name === "NotFoundError") {
        statusMessage.textContent = "No microphone found on your system.";
      } else {
        statusMessage.textContent = "Error starting audio: " + e.message;
      }
    }
    
    // Reset button state if audio fails to start
    if (micButton) {
      is_audio = false;
      micButton.classList.remove("active");
    }
  }
}

// Start the audio only when the user clicked the button
// (due to the gesture requirement for the Web Audio API)
const micButton = document.getElementById("micButton");
if (micButton) {
  micButton.addEventListener("click", () => {
    is_audio = !is_audio;
    if (is_audio) {
      micButton.classList.add("active");
      startAudio();
    } else {
      micButton.classList.remove("active");
      stopAudioRecording();
    }

    // Re-connect websocket with the new is_audio value
    if (websocket) {
      // Set a one-time onclose handler to reconnect
      websocket.onclose = () => {
        connectWebsocket();
      };
      websocket.close();
    } else {
      // If no websocket, just connect.
      connectWebsocket();
    }
  });
}

// Audio recorder handler
function audioRecorderHandler(pcmData) {
  // Add audio data to buffer
  audioBuffer.push(new Uint8Array(pcmData));

  // Start timer if not already running
  if (!bufferTimer) {
    bufferTimer = setInterval(sendBufferedAudio, 200); // 0.2 seconds
  }
}

// Send buffered audio data every 0.2 seconds
function sendBufferedAudio() {
  if (audioBuffer.length === 0) {
    return;
  }

  // Calculate total length
  let totalLength = 0;
  for (const chunk of audioBuffer) {
    totalLength += chunk.length;
  }

  // Combine all chunks into a single buffer
  const combinedBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioBuffer) {
    combinedBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  // Send the combined audio data
  sendMessage({
    mime_type: "audio/pcm",
    data: arrayBufferToBase64(combinedBuffer.buffer),
  });
  console.log("[CLIENT TO AGENT] sent %s bytes", combinedBuffer.byteLength);

  // Clear the buffer
  audioBuffer = [];
}

// Stop audio recording and cleanup
function stopAudioRecording() {
  if (bufferTimer) {
    clearInterval(bufferTimer);
    bufferTimer = null;
  }

  // Send any remaining buffered audio
  if (audioBuffer.length > 0) {
    sendBufferedAudio();
  }

  // Stop microphone stream
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }

  // Stop audio contexts
  if (audioRecorderContext && audioRecorderContext.state !== "closed") {
    audioRecorderContext.close();
    audioRecorderContext = null;
  }
  if (audioPlayerContext && audioPlayerContext.state !== "closed") {
    audioPlayerContext.close();
    audioPlayerContext = null;
  }

  // Nullify nodes
  audioRecorderNode = null;
  audioPlayerNode = null;

  stopVisualizer();
}

// Encode an array buffer with Base64
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Video handling
 */

// Start video capture
async function startVideo() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    if (videoElement) {
      videoElement.srcObject = videoStream;
      videoElement.style.display = "block";
    }
    isVideoActive = true;
    is_video = true;
    connectWebsocket(); // reconnect with the video mode

    // Start sending frames every 1 second
    videoInterval = setInterval(captureAndSendFrame, 1000);
    console.log("Video capture started");
  } catch (error) {
    console.error("Error accessing webcam:", error);
  }
}

// Stop video capture
function stopVideo() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.style.display = "none";
    }
    isVideoActive = false;
  }
  if (videoInterval) {
    clearInterval(videoInterval);
    videoInterval = null;
  }
  console.log("Video capture stopped");
}

// Capture and send a frame
function captureAndSendFrame() {
  if (!isVideoActive || !videoElement) return;

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0);

  canvas.toBlob((blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(',')[1]; // Remove data:image/jpeg;base64,
      sendMessage({
        mime_type: "image/jpeg",
        data: base64Data
      });
      console.log("[CLIENT TO AGENT] sent video frame");
    };
    reader.readAsDataURL(blob);
  }, "image/jpeg", 0.7); // 70% quality
}

// Event listener for video button
const startVideoButton = document.getElementById("startVideoButton");
if (startVideoButton) {
  startVideoButton.addEventListener("click", () => {
    if (isVideoActive) {
      stopVideo();
      startVideoButton.textContent = "Start Video";
    } else {
      startVideo();
      startVideoButton.textContent = "Stop Video";
    }
  });
}

function setupVisualizer(audioContext, playerNode, stream) {
  visualizerCanvas = document.getElementById("visualizer");
  const container = document.getElementById("visualizer-container");
  
  if (!visualizerCanvas || !container) return;

  visualizerCtx = visualizerCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  visualizerCanvas.width = container.clientWidth * dpr;
  visualizerCanvas.height = container.clientHeight * dpr;
  visualizerCanvas.style.width = container.clientWidth + "px";
  visualizerCanvas.style.height = container.clientHeight + "px";
  visualizerCtx.scale(dpr, dpr);

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  if (playerNode) {
    try { playerNode.connect(analyser); } catch (e) {}
  }
  if (stream) {
    try {
      visualizerMicSource = audioContext.createMediaStreamSource(stream);
      visualizerMicSource.connect(analyser);
    } catch (e) {}
  }

  // ---- Create particle membrane ----
  membraneParticles = [];
  const radius = Math.min(container.clientWidth, container.clientHeight) * 0.33;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);

    membraneParticles.push({
      xBase: x,
      yBase: y,
      theta,
      phi,
      offset: Math.random() * 1000
    });
  }

  if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
  drawVisualizer();
}


function drawVisualizer() {
  visualizerAnimationId = requestAnimationFrame(drawVisualizer);

  if (!analyser || !visualizerCanvas) return;

  analyser.getByteFrequencyData(dataArray);

  // volume 0–1
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
  const volume = (sum / dataArray.length) / 255;

  membraneTime += 0.02 + volume * 0.05;

  const ctx = visualizerCtx;
  const container = document.getElementById("visualizer-container");
  if (!container || !ctx) return;
  const w = container.clientWidth;
  const h = container.clientHeight;

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";

  const cx = w / 2;
  const cy = h / 2;

  const baseRadius = Math.min(w, h) * 0.33;
  const breathing = 1 + Math.sin(membraneTime * 1.3) * 0.04 + volume * 0.25;

  for (let i = 0; i < membraneParticles.length; i++) {
    const p = membraneParticles[i];

    const freqIndex = Math.floor((i / PARTICLE_COUNT) * dataArray.length);
    const amp = dataArray[freqIndex] / 255;

    // ripple movement across sphere
    const ripple = Math.sin(membraneTime + p.theta * 4 + p.phi * 3) * amp * 12;

    const r = baseRadius * breathing + ripple;

    const x = cx + r * Math.sin(p.phi) * Math.cos(p.theta);
    const y = cy + r * Math.sin(p.phi) * Math.sin(p.theta);

    const size = 1.2 + amp * 2;

    ctx.beginPath();
    ctx.fillStyle = `rgba(0, 200, 255, ${0.4 + amp * 0.6})`;
    ctx.shadowColor = `rgba(0, 200, 255, ${0.35 + amp * 0.7})`;
    ctx.shadowBlur = 6 + amp * 12;
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

function stopVisualizer() {
  if (visualizerAnimationId) {
    cancelAnimationFrame(visualizerAnimationId);
    visualizerAnimationId = null;
  }
  if (visualizerMicSource) {
    try { visualizerMicSource.disconnect(); } catch (e) {}
    visualizerMicSource = null;
  }
  if (analyser) {
    try { analyser.disconnect(); } catch (e) {}
    analyser = null;
  }
  if (visualizerCtx && visualizerCanvas) {
    visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
  }
}



