# ADK Voice Agent - Healthcare Assistant

A real-time, multimodal healthcare assistant powered by **Google Gemini 3.1 Flash Live Preview**. This project leverages the **Google ADK (Agent Development Kit)** and **MCP (Model Context Protocol)** to provide a seamless voice and text-based interface for managing patient data and clinical appointments.

## 🚀 Features

- **Real-time Voice Interaction**: Multimodal communication using Gemini Flash Live for low-latency voice responses.
- **Multimodal Support**: Capability to handle text, audio (PCM 16-bit), and image/video inputs.
- **Clinical Tool Integration**: Built-in MCP server to interact with a SQLite clinical database.
- **Patient Management**:
  - Search patients by name.
  - Retrieve detailed medical histories and records.
  - Check active appointments.
  - Schedule new appointments.
- **Modern Web UI**: Responsive interface with real-time audio visualization and status monitoring.

## 🛠️ Architecture

- **`main.py`**: The FastAPI application serving as the central hub. It handles WebSocket connections, session management via `InMemoryRunner`, and coordinates communication between the client and the Gemini agent.
- **`healthcare_assistant/agent.py`**: Defines the `Agent` configuration, including detailed professional instructions and the toolset (MCP tools + local functions).
- **`server.py`**: An MCP (Model Context Protocol) server that exposes database operations as tools for the AI agent.
- **`db.py`**: Database layer managing a SQLite instance (`clinical_assistant.db`) with sample patient data.
- **`static/`**: Frontend assets including HTML, CSS, and modular JavaScript for audio recording/playback and visualization.

## 📋 Prerequisites

- **Python 3.12+**
- **Google Gemini API Key** (from Google AI Studio)
- **uv** (Recommended) or **pip**

## ⚙️ Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd google-adk-voice-agent
   ```

2. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```

3. **Install Dependencies**:
   Using `uv`:
   ```bash
   uv sync
   ```
   Or using `pip`:
   ```bash
   pip install "google-adk>=2.2.0" "mcp>=1.14.1" fastapi uvicorn python-dotenv google-genai
   ```

## 🏃 Running the Project

Start the application using `uvicorn`:

```bash
uv run uvicorn main:app --reload
```
*Note: The MCP server is automatically managed by the agent session; you do not need to run `server.py` separately.*

Open your browser and navigate to: **[http://localhost:8000](http://localhost:8000)**

## 🎙️ Usage Tips

- **Microphone Access**: Ensure you grant microphone permissions when prompted. If access is denied, look for the lock icon in the address bar to reset it.
- **Voice Mode**: Click the microphone icon to toggle voice mode. In voice mode, the agent responds with real-time audio.
- **Database Interaction**: Try asking things like:
  - "Search for a patient named John Doe."
  - "What is patient P1's medical history?"
  - "Schedule an appointment for Mary Smith on 2026-07-15 at 10:00 AM."

## 🔒 Security & Compliance

This application is a **demonstration** and is not HIPAA-compliant in its current state. Do not use real patient data in this environment. The instructions in `agent.py` enforce professional communication standards and privacy protocols for the AI's behavior.

## 📄 License

[Insert License Information]
# google-adk-voice-agent
