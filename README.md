# BeneBot

**Nobody should need their kid to translate a medical bill.**

BeneBot is a voice-first medical-bill explainer: it explains the bill you received, refreshes the benefits you have now, and opens a real follow-up case with your provider — in English or Spanish. It serves two audiences at once. Patients, especially elderly patients with limited English proficiency, get independence instead of a family translator. Providers get their highest-volume billing call handled and returned as a structured FHIR `Task` rather than a voicemail.

See [PITCH.md](PITCH.md) for the full pitch, the market case, and what is real versus demo-scoped.

This repository is a synthetic-data hackathon demo. It keeps historical claim adjudication separate from current benefits, supports English/Spanish voice plus text, and persists billing follow-up artifacts in Medplum.

The localhost demo uses only Jane Doe and statement `BENEBOT-INV-1001`. Never use real patient data.

## Fast setup

Prerequisites: Node.js 20+, npm, and accounts for [Medplum](https://app.medplum.com/register), [Deepgram](https://console.deepgram.com/), and [Stedi](https://www.stedi.com/app). Deepgram and Stedi are optional for the deterministic text demo, but Medplum is required to prove persisted workflow artifacts.

Install dependencies:

```bash
npm install
```

Install the Playwright browser once:

```bash
npx playwright install chromium
```

Create the ignored local environment file:

```bash
touch .env.local
```

Generate a local session secret:

```bash
openssl rand -base64 48
```

Put the result and your service credentials in `.env.local`:

```dotenv
NEXT_PUBLIC_APP_NAME=BeneBot
NEXT_PUBLIC_DEMO_MODE=true

MEDPLUM_BASE_URL=https://api.medplum.com/
MEDPLUM_CLIENT_ID=
MEDPLUM_CLIENT_SECRET=

DEEPGRAM_API_KEY=

STEDI_MODE=test
STEDI_TEST_API_KEY=
STEDI_ELIGIBILITY_ENDPOINT=https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3
STEDI_PROVIDER_NPI=1999999984
STEDI_PAYER_ID=60054
STEDI_ALLOW_FIXTURE_FALLBACK=true
STEDI_PROVIDER=direct

BENEBOT_SESSION_SECRET=replace-with-the-openssl-output
BENEBOT_SESSION_TTL_SECONDS=900

MOSS_ENABLED=false
```

Do not commit `.env.local`, paste its contents into chat, or expose any key in browser code.

## Medplum: account, project, and client credentials

This app follows Medplum's [AI coding-assistant guidance](https://www.medplum.com/docs/building-with-ai-coding-assistants): use Medplum docs and FHIR R4 types as the source of truth, validate on the server, and review access-sensitive work. Its backend uses Medplum's recommended [client credentials flow](https://www.medplum.com/docs/auth/client-credentials).

1. Register at [app.medplum.com](https://app.medplum.com/register), sign in, and create or select a project.
2. Open the project's Admin page and create a `ClientApplication` named `BeneBot local demo`.
3. Copy its **ID** and **Secret** into `MEDPLUM_CLIENT_ID` and `MEDPLUM_CLIENT_SECRET`. The secret stays server-side.
4. Ensure the client application's project membership/access policy can search, read, create, and update the demo resource types: `Patient`, `Organization`, `Coverage`, `Encounter`, `ExplanationOfBenefit`, `Invoice`, `CoverageEligibilityRequest`, `CoverageEligibilityResponse`, `Task`, and `Communication`. Keep access limited to this synthetic demo project; review the policy by hand.
5. Leave `MEDPLUM_BASE_URL=https://api.medplum.com/` for Medplum Cloud.

The seed validates every resource against Medplum, searches by stable BeneBot identifiers, resolves real references, and fails on duplicates or incorrect bill math.

Run the seed once:

```bash
npm run seed
```

Run it a second time to prove idempotency:

```bash
npm run seed
```

Both runs should print the same Medplum IDs. If the seed returns `401` or `403`, re-check the client ID/secret and the client application's access policy. Do not bypass validation.

## Run and verify

Start the localhost app:

```bash
npm run dev
```

Open the synthetic Spanish billing-email preview:

```bash
open http://localhost:3000
```

Open the staff proof view in a second tab:

```bash
open http://localhost:3000/staff
```

Run each local gate separately:

```bash
npm run typecheck
```

```bash
npm run test
```

```bash
npm run build
```

```bash
npm run test:e2e
```

The E2E rehearsal uses the signed local session and text fallback. It never sends browser-selected patient or bill IDs. Live service checks are reported separately; a fixture fallback is always labeled rather than presented as live.

## Service behavior and honest fallbacks

- **Deepgram:** `DEEPGRAM_API_KEY` is used only by the server to mint a temporary browser token through `/v1/auth/grant`; the key needs at least Deepgram Member permission. Without a grant-capable key, do not start voice; the text path still explains the historical bill.
- **Stedi:** use only the fixed Jane Doe test identity in the build spec. With no test key or a failed request and `STEDI_ALLOW_FIXTURE_FALLBACK=true`, any returned current-benefit data must be visibly labeled **fixture fallback—not live**. A current snapshot never explains or validates the July claim.
- **Medplum:** demo mode can read the bundled historical EOB fixture when Medplum is unconfigured. It cannot honestly prove persistence: follow-up `Task`, summary `Communication`, and eligibility artifacts must remain unavailable or waiting until Medplum confirms their IDs.
- **Resources:** the local resource directory is synthetic except for one tier. Fictional resources and community-reported tips remain labeled; no patient data is sent to a search provider. The `medicare-billing-problem` need returns **real** government programs — 1-800-MEDICARE, the SHIP counseling network, and the federal QMB improper-billing protection — carrying their actual published phone numbers and marked `government-program` / `government-published`. BeneBot never contacts an agency on a patient's behalf and never tells a patient whether a federal protection applies to them; it names who can confirm it.

## Recorded localhost demo script (Spanish-first)

The canonical modular storyboard and exact English/Spanish turns are in [`docs/demo/DEMO_VIDEO_PLAYBOOK.md`](docs/demo/DEMO_VIDEO_PLAYBOOK.md) and [`docs/demo/demo-scenarios.json`](docs/demo/demo-scenarios.json).

Before recording, run the seed twice, test one Deepgram voice connection, grant microphone permission, and keep `/staff` plus the signed-in Medplum project open in separate tabs. The recorded story does not use the current-benefits refresh.

1. Open `/`. The landing page opens with the pitch: the two audiences, the three-source accuracy principle, and the reconciled bill math. Select the hero CTA **Hablar sobre mi factura**, or scroll to the synthetic bill preview and select **Quiero hablar sobre esta factura**. No real email is sent.
2. In the portal, show **Sesión segura — Jane Doe**, **Idioma preferido: Español**, the synthetic-demo label, and **Secure billing context verified**. Explain that demo portal authentication has already scoped BeneBot to this bill; it will not ask for SSN, DOB, member ID, or patient ID.
3. Point out the **$620** current Invoice balance and the historical EOB breakdown: $2,400 billed − $1,300 discount = $1,100 allowed; **$500 deductible applied to the July claim** + $120 coinsurance = $620 responsibility; insurer paid $480.
4. Select **Hablar sobre esta factura**. Say: `Esta factura es demasiado complicada. ¿Por qué debo seiscientos veinte dólares por esta resonancia? Explíqueme cómo se procesó el reclamo.`
5. Keep the transcript and tool-activity stream visible while BeneBot retrieves the historical record and begins the deterministic explanation.
6. Interrupt with: `Espere — ¿qué significa monto permitido? ¿Es lo que tengo que pagar?` BeneBot should stop, answer concisely, and ask whether to continue.
7. Escalate with: `Sigo confundida, y hay algo más. El registro dice que recibí una resonancia, pero ese día solo me hicieron radiografías. No recibí una resonancia.` BeneBot should repeat the record/patient difference, say it needs human review without declaring the bill wrong, and ask whether to create a secure-message case. It must say that nothing has been created yet.
8. Confirm with only `Sí.` Show the server-confirmed Task ID. BeneBot may then say Bayview's billing team has been assigned the case and asked to contact Jane by secure message; if Medplum does not confirm the Task, do not narrate success or outreach.
9. Switch to `/staff`, show the confirmed `Task` and concise `Communication`, then open the exact Task ID in Medplum and show its `requested` status, Bayview owner, `service-not-recognized` issue, and `secure-message` preference.

The current-benefits refresh and local billing-resource directory remain available in the product, but neither is part of this recording. English remains a short explanation/interruption smoke clip after the Spanish flagship is safely captured.

## Automated live-demo recording

The Playwright recorder in `scripts/record-live-demo.mjs` drives the same Spanish-first story through a real Deepgram Voice Agent session. It generates a synthetic patient voice, injects it into Chromium's microphone stream, captures both sides of the conversation, verifies the server-confirmed Medplum `Task` and `Communication`, switches the staff proof to English, and muxes the result into an MP4 with FFmpeg.

The recorder is intentionally write-gated because every successful run creates synthetic workflow resources in the configured Medplum project. Use only the Jane Doe demo project described above. Never point it at real patient data.

Install FFmpeg if it is not already available:

```bash
brew install ffmpeg
```

Start BeneBot in one terminal:

```bash
npm run dev
```

In another terminal, explicitly acknowledge the synthetic Medplum writes and start the recording:

```bash
BENEBOT_DEMO_ALLOW_MEDPLUM_WRITE=1 npm run demo:record
```

Successful runs write `spanish-live-demo.mp4` plus `recording-metadata.json` under a timestamped directory in `artifacts/demo-recordings/`. The metadata records the exact git commit and dirty-tree state, Deepgram patient voice model, authoritative server-returned Task ID, and browser-console result. Raw browser video and captured audio are removed after a successful mux.

To retain raw WebM intermediates for debugging a capture, opt in explicitly:

```bash
BENEBOT_DEMO_ALLOW_MEDPLUM_WRITE=1 BENEBOT_DEMO_KEEP_RAW=1 npm run demo:record
```

Patient TTS is cached in `/tmp/benebot-demo-audio` using a hash of the exact script and voice model, so changing either input cannot silently reuse stale speech. Set `BENEBOT_DEMO_PATIENT_VOICE` to choose another compatible Spanish Aura model. Non-local origins and runs containing browser console errors fail closed. `BENEBOT_DEMO_ALLOW_NONLOCAL_ORIGIN=1` and `BENEBOT_DEMO_ALLOW_CONSOLE_ERRORS=1` exist only for explicitly reviewed exceptional runs; neither should be used for the canonical capture.

## Emergency text-only recording

If external services are unavailable, keep `NEXT_PUBLIC_DEMO_MODE=true`, keep a valid `BENEBOT_SESSION_SECRET`, open the bill directly, and demo only the historical text explanation plus the labeled local resource/staff waiting surfaces. Do not describe fixture data as live or imply that a follow-up was persisted.
