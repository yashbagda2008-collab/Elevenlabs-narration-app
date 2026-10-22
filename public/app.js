const textInput = document.querySelector("#text-input");
const characterCount = document.querySelector("#character-count");
const voiceSelect = document.querySelector("#voice-select");
const modelSelect = document.querySelector("#model-select");
const voiceCaption = document.querySelector("#voice-caption");
const playButton = document.querySelector("#play-button");
const buttonLabel = document.querySelector("#button-label");
const statusMessage = document.querySelector("#status-message");
const audioSection = document.querySelector("#audio-section");
const audioPlayer = document.querySelector("#audio-player");
const downloadLink = document.querySelector("#download-link");
let audioUrl;

function showStatus(message, type = "error") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.hidden = false;
}

async function loadVoices() {
  try {
    const response = await fetch("/api/voices");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load your voices.");
    }
    if (!payload.voices.length) {
      throw new Error("No voices are available on this ElevenLabs account.");
    }

    voiceSelect.replaceChildren();
    for (const voice of payload.voices) {
      const option = document.createElement("option");
      option.value = voice.id;
      option.textContent = voice.category ? `${voice.name} · ${voice.category}` : voice.name;
      voiceSelect.append(option);
    }
    voiceSelect.disabled = false;
    playButton.disabled = !textInput.value.trim();
    voiceCaption.textContent = `${payload.voices.length} voice${payload.voices.length === 1 ? "" : "s"} available`;
  } catch (error) {
    voiceSelect.replaceChildren(new Option("Unable to load voices", ""));
    showStatus(error.message);
    voiceCaption.textContent = "Check your API key and restart the server";
  }
}

textInput.addEventListener("input", () => {
  characterCount.textContent = `${textInput.value.length.toLocaleString()} / 10,000`;
  playButton.disabled = !textInput.value.trim() || voiceSelect.disabled;
});

document.querySelector("#clear-button").addEventListener("click", () => {
  textInput.value = "";
  textInput.dispatchEvent(new Event("input"));
  textInput.focus();
});

playButton.addEventListener("click", async () => {
  playButton.disabled = true;
  buttonLabel.textContent = "Creating your narration...";
  statusMessage.hidden = true;
  audioSection.hidden = true;

  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: textInput.value,
        voiceId: voiceSelect.value,
        modelId: modelSelect.value,
      }),
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || "Could not create narration.");
    }

    const audioBlob = await response.blob();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    downloadLink.href = audioUrl;
    audioSection.hidden = false;
    showStatus("Your narration is ready. Press play to listen.", "success");
    await audioPlayer.play();
  } catch (error) {
    showStatus(error.message);
  } finally {
    buttonLabel.textContent = "Create narration";
    playButton.disabled = !textInput.value.trim() || voiceSelect.disabled;
  }
});

loadVoices();
