const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const MAX_TEXT_LENGTH = 10_000;
let elevenLabsClient;
const PUBLIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);
const MODELS = new Set([
  "eleven_v3",
  "eleven_multilingual_v2",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
]);

async function getElevenLabsClient() {
  if (!process.env.ELEVENLABS_API_KEY) {
    return null;
  }
  if (!elevenLabsClient) {
    const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
    elevenLabsClient = new ElevenLabsClient();
  }
  return elevenLabsClient;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

async function handleApiRequest(request, response, url) {
  const client = await getElevenLabsClient();
  if (!client) {
    sendJson(response, 503, { error: "Add your ElevenLabs API key to .env or .env.local, then restart the server." });
    return;
  }

  if (url.pathname === "/api/voices" && request.method === "GET") {
    const voices = [];
    let nextPageToken;
    do {
      const payload = await client.voices.search(
        { pageSize: 100, nextPageToken },
        { timeoutInSeconds: 30 },
      );
      voices.push(...payload.voices);
      nextPageToken = payload.hasMore ? payload.nextPageToken : undefined;
    } while (nextPageToken);

    sendJson(response, 200, {
      voices: voices.map(({ voiceId, name, category }) => ({
        id: voiceId,
        name,
        category,
      })),
    });
    return;
  }

  if (url.pathname === "/api/speech" && request.method === "POST") {
    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      if (!response.destroyed) {
        sendJson(response, 400, { error: error.message });
      }
      return;
    }
    const { text, voiceId, modelId } = payload || {};
    if (typeof text !== "string" || !text.trim()) {
      sendJson(response, 400, { error: "Enter some text to narrate." });
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      sendJson(response, 400, { error: `Text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.` });
      return;
    }
    if (typeof voiceId !== "string" || !voiceId.trim()) {
      sendJson(response, 400, { error: "Choose a voice before generating narration." });
      return;
    }
    if (!MODELS.has(modelId)) {
      sendJson(response, 400, { error: "Choose a supported narration model." });
      return;
    }

    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: "mp3_44100_128",
    }, { timeoutInSeconds: 120 });

    response.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    });
    response.end(Buffer.from(await new Response(audioStream).arrayBuffer()));
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, url);
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const file = PUBLIC_FILES.get(url.pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const [fileName, contentType] = file;
    response.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(path.join(__dirname, "public", fileName)).pipe(response);
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent && !response.destroyed) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
      const message = error?.statusCode && error.message
        ? error.message
        : "The request failed. Check the server logs and try again.";
      sendJson(response, statusCode, { error: message });
    } else if (!response.destroyed) {
      response.destroy(error);
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ElevenLabs Narrator is running at http://127.0.0.1:${PORT}`);
});
