import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const origin = process.env.BENEBOT_DEMO_ORIGIN ?? "http://localhost:3000";
const outputDirectory = resolve(
  process.env.BENEBOT_DEMO_OUTPUT ?? "artifacts/demo-recordings",
);
const audioDirectory = resolve(
  process.env.BENEBOT_DEMO_AUDIO ?? "/tmp/benebot-demo-audio",
);
const runId = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const runDirectory = join(outputDirectory, runId);
const rawVideoPath = join(runDirectory, "spanish-live-demo-raw.webm");
const rawAudioPath = join(runDirectory, "spanish-live-demo-audio.webm");
const finalVideoPath = join(runDirectory, "spanish-live-demo.mp4");
const metadataPath = join(runDirectory, "recording-metadata.json");
const patientVoiceModel =
  process.env.BENEBOT_DEMO_PATIENT_VOICE ?? "aura-2-estrella-es";
const keepRawArtifacts = process.env.BENEBOT_DEMO_KEEP_RAW === "1";

const patientScripts = {
  question:
    "Esta factura es demasiado complicada. ¿Por qué debo seiscientos veinte dólares por esta resonancia? Explíqueme cómo se procesó el reclamo.",
  interruption:
    "Espere. ¿Qué significa monto permitido? ¿Es lo que tengo que pagar?",
  discrepancy:
    "Sigo confundida, y hay algo más. El registro dice que recibí una resonancia, pero ese día solo me hicieron radiografías. No recibí una resonancia.",
  reviewRequest: "Sí, quiero que me ayude a revisarlo.",
  confirmation: "Sí, por favor.",
};
const audioNames = {
  question: "01-pregunta",
  interruption: "02-interrupcion",
  discrepancy: "03-discrepancia",
  reviewRequest: "04-revision",
  confirmation: "05-confirmacion-clara",
};
const patientAudioFiles = Object.fromEntries(
  Object.entries(patientScripts).map(([name, script]) => {
    const fingerprint = createHash("sha256")
      .update(`${patientVoiceModel}\0${script}`)
      .digest("hex")
      .slice(0, 12);
    return [name, join(audioDirectory, `${audioNames[name]}-${fingerprint}.wav`)];
  }),
);

function log(message) {
  process.stdout.write(`${message}\n`);
}

let localEnvironment;

async function readLocalEnvironment() {
  if (localEnvironment) return localEnvironment;
  const parsed = {};
  try {
    const envText = await readFile(resolve(".env.local"), "utf8");
    for (const line of envText.split("\n")) {
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const name = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      parsed[name] = value;
    }
  } catch {
    // The preflight reports missing required values without exposing them.
  }
  localEnvironment = parsed;
  return parsed;
}

async function configuredValue(name) {
  return process.env[name] ?? (await readLocalEnvironment())[name];
}

async function patientAudioBase64(path) {
  return (await readFile(path)).toString("base64");
}

async function deepgramApiKey() {
  const apiKey = await configuredValue("DEEPGRAM_API_KEY");
  if (apiKey) return apiKey;
  throw new Error("DEEPGRAM_API_KEY is required to generate the synthetic patient voice");
}

async function verifyRecordingPrerequisites() {
  if (process.env.BENEBOT_DEMO_ALLOW_MEDPLUM_WRITE !== "1") {
    throw new Error(
      "Set BENEBOT_DEMO_ALLOW_MEDPLUM_WRITE=1 to acknowledge that this synthetic demo creates Medplum Task and Communication resources",
    );
  }
  const originUrl = new URL(origin);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    !localHosts.has(originUrl.hostname) &&
    process.env.BENEBOT_DEMO_ALLOW_NONLOCAL_ORIGIN !== "1"
  ) {
    throw new Error(
      "BENEBOT_DEMO_ORIGIN must be local unless BENEBOT_DEMO_ALLOW_NONLOCAL_ORIGIN=1 is explicitly set",
    );
  }
  if ((await configuredValue("NEXT_PUBLIC_DEMO_MODE")) !== "true") {
    throw new Error("NEXT_PUBLIC_DEMO_MODE=true is required for the synthetic recorder");
  }
  for (const name of ["MEDPLUM_CLIENT_ID", "MEDPLUM_CLIENT_SECRET"]) {
    if (!(await configuredValue(name))) {
      throw new Error(name + " is required for the Medplum-backed recording proof");
    }
  }
  await deepgramApiKey();
  await execFileAsync("ffmpeg", ["-version"]);
  const response = await fetch(origin, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error("BeneBot origin preflight failed with HTTP " + response.status);
  }
}

async function currentGitCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

async function currentGitDirtyState() {
  try {
    const { stdout } = await execFileAsync("git", [
      "status",
      "--porcelain",
      "--untracked-files=normal",
    ]);
    return stdout.trim().length > 0;
  } catch {
    return undefined;
  }
}

async function ensurePatientAudio() {
  await mkdir(audioDirectory, { recursive: true });
  let apiKey;
  for (const [name, path] of Object.entries(patientAudioFiles)) {
    try {
      await readFile(path);
      continue;
    } catch {
      apiKey ??= await deepgramApiKey();
    }
    log(`Generating Deepgram patient audio: ${name}`);
    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(patientVoiceModel)}&encoding=linear16&container=wav&sample_rate=24000`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: patientScripts[name] }),
      },
    );
    if (!response.ok) {
      throw new Error(`Deepgram patient TTS failed with HTTP ${response.status}`);
    }
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
}

async function hold(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForText(page, text, timeout = 45_000) {
  const locator = page.getByText(text, { exact: false }).last();
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

async function keepPanelEndingVisible(page) {
  await page.locator("[data-dg-agent]").evaluate((panel) => {
    panel.scrollIntoView({ behavior: "smooth", block: "end" });
  });
  await hold(800);
}

await verifyRecordingPrerequisites();
await mkdir(runDirectory, { recursive: true });
await ensurePatientAudio();
const gitCommit = await currentGitCommit();
const gitDirty = await currentGitDirtyState();

const browser = await chromium.launch({
  headless: true,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: runDirectory,
    size: { width: 1280, height: 720 },
  },
});

await context.addInitScript(() => {
  const NativeAudioContext = window.AudioContext;
  const captureContext = new NativeAudioContext();
  const captureDestination = captureContext.createMediaStreamDestination();
  const microphoneContext = new NativeAudioContext();
  const microphoneDestination = microphoneContext.createMediaStreamDestination();
  const captureMirrors = new WeakSet();
  const mirrorBySource = new WeakMap();
  const audioChunks = [];
  let recorder;

  const nativeStart = AudioBufferSourceNode.prototype.start;
  const nativeStop = AudioBufferSourceNode.prototype.stop;

  AudioBufferSourceNode.prototype.start = function patchedStart(
    when = 0,
    offset = 0,
    duration,
  ) {
    if (!captureMirrors.has(this) && this.buffer) {
      const sourceContext = this.context;
      const scheduledDelay = Math.max(0, when - sourceContext.currentTime);
      const mirrorBuffer = captureContext.createBuffer(
        this.buffer.numberOfChannels,
        this.buffer.length,
        this.buffer.sampleRate,
      );
      for (let channel = 0; channel < this.buffer.numberOfChannels; channel += 1) {
        mirrorBuffer.copyToChannel(this.buffer.getChannelData(channel), channel);
      }
      const mirror = captureContext.createBufferSource();
      captureMirrors.add(mirror);
      mirror.buffer = mirrorBuffer;
      mirror.playbackRate.value = this.playbackRate.value;
      mirror.detune.value = this.detune.value;
      mirror.connect(captureDestination);
      mirrorBySource.set(this, mirror);
      const mirrorWhen = captureContext.currentTime + scheduledDelay;
      if (duration === undefined) {
        nativeStart.call(mirror, mirrorWhen, offset);
      } else {
        nativeStart.call(mirror, mirrorWhen, offset, duration);
      }
    }
    if (duration === undefined) {
      return nativeStart.call(this, when, offset);
    }
    return nativeStart.call(this, when, offset, duration);
  };

  AudioBufferSourceNode.prototype.stop = function patchedStop(when = 0) {
    const mirror = mirrorBySource.get(this);
    if (mirror) {
      const sourceContext = this.context;
      const scheduledDelay = Math.max(0, when - sourceContext.currentTime);
      try {
        nativeStop.call(mirror, captureContext.currentTime + scheduledDelay);
      } catch {
        // The source may already have ended naturally.
      }
    }
    return nativeStop.call(this, when);
  };

  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices,
  );
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async (constraints) => {
      if (constraints && typeof constraints === "object" && constraints.audio) {
        await microphoneContext.resume();
        return microphoneDestination.stream;
      }
      return originalGetUserMedia(constraints);
    },
  });

  window.__benebotStartCapture = async () => {
    await Promise.all([captureContext.resume(), microphoneContext.resume()]);
    const preferredMimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
    recorder = preferredMimeType
      ? new MediaRecorder(captureDestination.stream, { mimeType: preferredMimeType })
      : new MediaRecorder(captureDestination.stream);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });
    recorder.start(250);
  };

  window.__benebotPlayPatient = async (base64Audio) => {
    await microphoneContext.resume();
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const decoded = await microphoneContext.decodeAudioData(bytes.buffer);
    const source = microphoneContext.createBufferSource();
    source.buffer = decoded;
    source.connect(microphoneDestination);
    const ended = new Promise((resolvePromise) => {
      source.addEventListener("ended", resolvePromise, { once: true });
    });
    source.start();
    await ended;
  };

  window.__benebotStopCapture = async () => {
    if (!recorder) {
      throw new Error("Audio capture was not started");
    }
    const stopped = new Promise((resolvePromise) => {
      recorder.addEventListener("stop", resolvePromise, { once: true });
    });
    recorder.stop();
    await stopped;
    const blob = new Blob(audioChunks, { type: recorder.mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return {
      base64: btoa(binary),
      mimeType: recorder.mimeType,
      size: bytes.length,
    };
  };
});

let taskId;
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("response", async (response) => {
  if (
    new URL(response.url()).pathname !== "/api/tools/request-followup" ||
    !response.ok()
  ) {
    return;
  }
  try {
    const payload = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      payload.created === true &&
      typeof payload.taskId === "string"
    ) {
      taskId = payload.taskId;
    }
  } catch {
    // The visible confirmation and staff proof still fail closed below.
  }
});

const patientAudio = {
  question: await patientAudioBase64(patientAudioFiles.question),
  interruption: await patientAudioBase64(patientAudioFiles.interruption),
  discrepancy: await patientAudioBase64(patientAudioFiles.discrepancy),
  reviewRequest: await patientAudioBase64(patientAudioFiles.reviewRequest),
  confirmation: await patientAudioBase64(patientAudioFiles.confirmation),
};

let video;
let playwrightVideoPath;
let audioCapture;

try {
  log("Opening BeneBot and starting the clean capture...");
  await page.goto(origin, { waitUntil: "networkidle" });
  video = page.video();
  await page.evaluate(() => window.__benebotStartCapture());
  await hold(1_200);

  const emailLink = page.getByRole("link", {
    name: "Quiero hablar sobre esta factura",
  });
  await emailLink.scrollIntoViewIfNeeded();
  await hold(1_600);
  await emailLink.click();
  await page.waitForURL(/\/bill\/BENEBOT-INV-1001$/);
  await waitForText(page, "Sesión segura: Jane Doe");
  await hold(1_800);

  await page.getByRole("button", { name: "Hablar sobre esta factura" }).click();
  const panel = page.locator("[data-dg-agent]");
  await panel.waitFor({ state: "visible" });
  await hold(1_200);
  await page.getByRole("button", { name: "Iniciar voz" }).click();
  await waitForText(page, "Puedo explicar cómo se procesó esta factura", 45_000);
  await waitForText(page, "BeneBot está escuchando", 45_000);
  await hold(1_800);

  log("Playing the synthetic Spanish patient question into the real microphone stream...");
  await page.evaluate((audio) => window.__benebotPlayPatient(audio), patientAudio.question);
  await waitForText(page, "Leyendo la factura histórica", 45_000);
  await waitForText(page, "BeneBot está hablando", 45_000);
  await keepPanelEndingVisible(page);

  log("Interrupting BeneBot mid-answer through Deepgram Flux...");
  await hold(3_600);
  await page.evaluate((audio) => window.__benebotPlayPatient(audio), patientAudio.interruption);
  await waitForText(page, "Interrupción detectada por Flux", 45_000);
  await waitForText(page, "precio negociado", 45_000);
  await keepPanelEndingVisible(page);
  await waitForText(page, "BeneBot está escuchando", 45_000);
  await hold(1_000);

  log("Raising the MRI-versus-X-ray discrepancy...");
  await page.evaluate((audio) => window.__benebotPlayPatient(audio), patientAudio.discrepancy);
  await waitForText(page, "BeneBot está escuchando", 45_000);
  await keepPanelEndingVisible(page);
  const firstFollowupPrompt = await panel.textContent();
  if (
    !firstFollowupPrompt?.includes("caso de revisión") ||
    !firstFollowupPrompt.includes("mensaje seguro")
  ) {
    log("Asking BeneBot to make the proposed review action explicit...");
    await page.evaluate(
      (audio) => window.__benebotPlayPatient(audio),
      patientAudio.reviewRequest,
    );
    await waitForText(page, "BeneBot está escuchando", 45_000);
    await keepPanelEndingVisible(page);
  }
  await hold(1_000);

  log("Confirming the follow-up and waiting for the real Medplum write...");
  let followupStarted = false;
  for (let attempt = 1; attempt <= 3 && !followupStarted; attempt += 1) {
    await page.evaluate(
      (audio) => window.__benebotPlayPatient(audio),
      patientAudio.confirmation,
    );
    try {
      await waitForText(page, "Creando el caso de revisión", 20_000);
      followupStarted = true;
    } catch {
      if (attempt === 3) {
        throw new Error("Flux did not deliver a usable explicit confirmation after three attempts");
      }
      // If the prompt was incomplete, the gate returns a deterministic full
      // confirmation request. If Flux missed the short utterance, it simply
      // remains listening. Both cases are safe to retry with no server write.
      log("The confirmation was not actionable; retrying after the safe prompt...");
      await waitForText(page, "BeneBot está escuchando", 45_000);
      await hold(750);
    }
  }
  await waitForText(page, "El ID del caso es", 60_000);
  const taskIdDeadline = Date.now() + 5_000;
  while (!taskId && Date.now() < taskIdDeadline) {
    await hold(100);
  }
  await waitForText(page, "Guardando el resumen breve", 45_000);
  await keepPanelEndingVisible(page);
  await hold(4_500);

  const benefitRefreshCount = await page
    .getByText("Consultando beneficios actuales", { exact: false })
    .count();
  if (benefitRefreshCount !== 0) {
    throw new Error("The no-benefits-refresh recording constraint was violated");
  }
  if (!taskId) {
    throw new Error("A server-confirmed Task ID was not visible in the transcript");
  }

  // A full-page navigation creates a new document, so finish the Web Audio
  // capture while the live-agent document still owns the recorder. The visual
  // recording continues through the silent staff-proof ending.
  audioCapture = await page.evaluate(() => window.__benebotStopCapture());
  await writeFile(rawAudioPath, Buffer.from(audioCapture.base64, "base64"));

  await page.getByRole("button", { name: "Terminar voz" }).click();
  await hold(1_200);
  const englishSiteButton = page.getByRole("button", { name: "EN", exact: true });
  await englishSiteButton.click();
  await page.waitForFunction(() =>
    document.querySelector('.language-switcher button[lang="en"]')
      ?.getAttribute("aria-pressed") === "true",
  );
  // Keep this as client-side navigation so the selected site language remains
  // mounted while the backend proof loads.
  await page.getByRole("link", { name: "Staff view", exact: true }).click();
  await page.waitForURL(/\/staff$/);
  await waitForText(page, "One conversation, one auditable case", 45_000);
  const taskProof = page.locator("li").filter({ hasText: `ID ${taskId}` });
  await taskProof.waitFor({ state: "visible", timeout: 45_000 });
  await taskProof.scrollIntoViewIfNeeded();
  await page.locator("li").filter({ hasText: "Communication" }).getByText(/^ID /).waitFor({ state: "visible" });
  await hold(5_000);
  if (
    consoleErrors.length > 0 &&
    process.env.BENEBOT_DEMO_ALLOW_CONSOLE_ERRORS !== "1"
  ) {
    throw new Error(
      "Browser console errors were captured; inspect the retained run artifacts or set BENEBOT_DEMO_ALLOW_CONSOLE_ERRORS=1 to override",
    );
  }
} finally {
  await page.close();
  if (video) {
    playwrightVideoPath = await video.path();
    await video.saveAs(rawVideoPath);
  }
  await context.close();
  await browser.close();
}

log("Muxing captured product audio with the browser video...");
await execFileAsync("ffmpeg", [
  "-y",
  "-i",
  rawVideoPath,
  "-i",
  rawAudioPath,
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  finalVideoPath,
]);

const metadata = {
  recordedAt: new Date().toISOString(),
  origin,
  scenario: "Spanish MRI-versus-X-ray discrepancy with interruption",
  syntheticDataOnly: true,
  externalWrites: ["Medplum Task", "Medplum Communication"],
  gitCommit,
  gitDirty,
  taskId,
  benefitsRefreshShown: false,
  patientVoice: "Deepgram Aura synthetic Spanish voice",
  patientVoiceModel,
  beneBotVoice: "Live Deepgram Voice Agent output",
  backendLanguage: "English UI; no backend voiceover in the raw product take",
  finalVideo: basename(finalVideoPath),
  rawArtifactsKept: keepRawArtifacts,
  ...(keepRawArtifacts
    ? {
        rawVideo: basename(rawVideoPath),
        rawAudio: basename(rawAudioPath),
      }
    : {}),
  audioBytes: audioCapture?.size,
  consoleErrors,
};
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

if (!keepRawArtifacts) {
  const cleanupPaths = new Set(
    [rawVideoPath, rawAudioPath, playwrightVideoPath]
      .filter(Boolean)
      .map((path) => resolve(path)),
  );
  await Promise.all(
    [...cleanupPaths].map((path) => rm(path, { force: true })),
  );
  log("Removed raw browser and audio intermediates after successful mux.");
}

log(`Recorded Task ${taskId}`);
log(`Final video: ${finalVideoPath}`);
log(`Metadata: ${metadataPath}`);
