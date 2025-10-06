// CONFIG
// mode: "mock" | "rest" | "websocket"
const CONFIG = {
  mode: "mock", // change to "rest" to fetch from an HTTP API, or "websocket" to use realtime WS
  restEndpoint: "https://example.com/api/soil", // replace with real endpoint returning { moisture: 45 }
  websocketUrl: "ws://192.168.4.1:81/", // replace with your device websocket URL
  autoRefreshMs: 10000 // used in mock/rest modes
};

// DOM elements
const moistureValueEl = document.getElementById("moistureValue");
const statusEl = document.getElementById("status");
const refreshButton = document.querySelector("button");

// Utility: set UI
function updateUI(moisture) {
  moistureValueEl.textContent = `${moisture}%`;
  statusEl.className = "status"; // reset classes

  if (moisture > 60) {
    statusEl.textContent = "Good Moisture";
    statusEl.classList.add("good");
  } else if (moisture > 30) {
    statusEl.textContent = "Dry";
    statusEl.classList.add("dry");
  } else {
    statusEl.textContent = "Very Dry - Water Needed";
    statusEl.classList.add("very-dry");
  }
}

// Utility: show error
function showError(msg) {
  moistureValueEl.textContent = "--%";
  statusEl.textContent = msg;
  statusEl.className = "status";
  statusEl.style.color = "darkred";
  console.error(msg);
}

// MOCK mode: simulate sensor reading
function fetchMock() {
  // simulate a sensor reading from 0 to 100
  const moisture = Math.floor(Math.random() * 101);
  updateUI(moisture);
}

// REST mode: fetch from HTTP API expected to return JSON { moisture: number }
async function fetchFromRest() {
  try {
    const resp = await fetch(CONFIG.restEndpoint, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    // Accept either data.moisture or data.value depending on backend
    const moisture = Number(data.moisture ?? data.value ?? data.soil_moisture);
    if (Number.isFinite(moisture)) {
      updateUI(Math.round(moisture));
    } else {
      throw new Error("Invalid response format: missing numeric moisture");
    }
  } catch (err) {
    showError("Failed to fetch data");
    console.error(err);
  }
}

// WEBSOCKET mode: connect and listen for messages
let ws;
function startWebsocket() {
  try {
    ws = new WebSocket(CONFIG.websocketUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      statusEl.style.color = ""; // reset color
      statusEl.textContent = "Connected (waiting for data...)";
    };

    ws.onmessage = (ev) => {
      // expect either a simple number "45" or JSON like {"moisture":45}
      let payload = ev.data;
      try {
        const parsed = JSON.parse(payload);
        const moisture = Number(parsed.moisture ?? parsed.value ?? parsed.soil_moisture);
        if (Number.isFinite(moisture)) {
          updateUI(Math.round(moisture));
          return;
        }
      } catch (e) {
        // not JSON, maybe plain number text
      }

      const num = Number(payload);
      if (Number.isFinite(num)) {
        updateUI(Math.round(num));
      } else {
        console.warn("Unhandled websocket message:", payload);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
      showError("WebSocket error");
    };

    ws.onclose = (ev) => {
      console.warn("WebSocket closed", ev);
      statusEl.textContent = "Disconnected";
      // try reconnect after delay
      setTimeout(startWebsocket, 3000);
    };
  } catch (err) {
    showError("WebSocket init failed");
    console.error(err);
  }
}

// Primary refresh function chosen by mode
function refresh() {
  statusEl.style.color = ""; // clear error color
  if (CONFIG.mode === "mock") {
    fetchMock();
  } else if (CONFIG.mode === "rest") {
    fetchFromRest();
  } else {
    // websocket mode uses events; if ws not connected, show message
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      statusEl.textContent = "Connecting to websocket...";
    }
  }
}

// Button handler
refreshButton.addEventListener("click", () => {
  refresh();
});

// Init on page load
(function init() {
  if (CONFIG.mode === "websocket") {
    startWebsocket();
  } else {
    refresh();
    setInterval(() => {
      if (CONFIG.mode === "mock" || CONFIG.mode === "rest") refresh();
    }, CONFIG.autoRefreshMs);
  }
})();