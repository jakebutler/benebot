# BeneBot

BeneBot is a synthetic-data hackathon demo that explains one medical bill, keeps historical claim adjudication separate from current benefits, supports English/Spanish voice plus text, and can persist a billing follow-up in Medplum.

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
- **Resources:** the local resource directory is synthetic. Fictional resources and community-reported tips remain labeled; no patient data is sent to a search provider.

## Recorded localhost demo script (Spanish-first)

Before recording, run the seed twice, test one Stedi refresh and one Deepgram voice connection if keys are configured, grant microphone permission, and keep `/staff` open in a second tab.

1. Open `/` and show the **Vista previa de correo sintético**. Select **Quiero hablar sobre esta factura**. No real email is sent.
2. In the portal, show **Sesión segura — Jane Doe**, **Idioma preferido: Español**, the synthetic-demo label, and **Secure billing context verified**. Explain that demo portal authentication has already scoped BeneBot to this bill; it will not ask for SSN, DOB, member ID, or patient ID.
3. Point out the **$620** current Invoice balance and the historical EOB breakdown: $2,400 billed − $1,300 discount = $1,100 allowed; **$500 deductible applied to the July claim** + $120 coinsurance = $620 responsibility; insurer paid $480.
4. Select **Hablar sobre esta factura**. Use text or voice: `Me cobraron $2,400 por la resonancia, pero el monto permitido fue $1,100 y todavia debo $620. Como llegaron a esa cantidad? Y significa que todavia me quedan $500 de deducible?`
5. During the explanation, use the rehearsed interruption: `Espere — que significa monto permitido?` BeneBot should stop, explain it, and ask whether to continue. Browser/platform echo cancellation is used; the P0 demo does not add custom VAD.
6. Ask for current benefits in a separate step. Show the timestamp and source for the Stedi test response, or the conspicuous **fixture fallback—not live** label. The current annual/remaining deductible is a current snapshot; it does not explain or validate the July claim. If scope is missing or ambiguous, it remains unknown.
7. Say Jane is still confused about the $620 and deductible. BeneBot should restate a narrow issue in Spanish and request confirmation. Confirm it only when ready. Show the **server-confirmed billing-review case ID**; if Medplum does not confirm it, show the error and do not narrate success.
8. Switch to `/staff` and show the EOB, Invoice, current eligibility result, unresolved concern, confirmed `Task`, and concise `Communication` together. English remains supported as a smoke test, but the recorded journey is Spanish-first.

The local billing-resource directory remains available, but the payment-plan search is intentionally not part of the P0 recording. A hardware translator is future vision only, not a current feature.

## Emergency text-only recording

If external services are unavailable, keep `NEXT_PUBLIC_DEMO_MODE=true`, keep a valid `BENEBOT_SESSION_SECRET`, open the bill directly, and demo only the historical text explanation plus the labeled local resource/staff waiting surfaces. Do not describe fixture data as live or imply that a follow-up was persisted.
