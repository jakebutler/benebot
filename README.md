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
4. Ensure the client application's project membership/access policy can search, read, create, and update the demo resource types: `Patient`, `Organization`, `Coverage`, `Encounter`, `ExplanationOfBenefit`, `Invoice`, `CoverageEligibilityResponse`, `Task`, and `Communication`. Keep access limited to this synthetic demo project; review the policy by hand.
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

Open the exact demo statement:

```bash
open http://127.0.0.1:3000/bill/BENEBOT-INV-1001
```

Open the staff proof view in a second tab:

```bash
open http://127.0.0.1:3000/staff
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

The E2E test is deliberately deterministic: it uses the signed local session and text fallback, does not call Deepgram or Stedi, and does not claim a Medplum follow-up was created.

## Service behavior and honest fallbacks

- **Deepgram:** `DEEPGRAM_API_KEY` is used only by the server to mint a temporary browser token. Without it, do not start voice; the text path still explains the historical bill.
- **Stedi:** use only the fixed Jane Doe test identity in the build spec. With no test key or a failed request and `STEDI_ALLOW_FIXTURE_FALLBACK=true`, any returned current-benefit data must be visibly labeled **fixture fallback—not live**. A current snapshot never explains or validates the July claim.
- **Medplum:** demo mode can read the bundled historical EOB fixture when Medplum is unconfigured. It cannot honestly prove persistence: follow-up `Task`, summary `Communication`, and eligibility artifacts must remain unavailable or waiting until Medplum confirms their IDs.
- **Resources:** the local resource directory is synthetic. Fictional resources and community-reported tips remain labeled; no patient data is sent to a search provider.

## Recorded localhost demo script

Before recording, run the seed twice, test one Stedi refresh and one Deepgram voice connection if keys are configured, grant microphone permission, and keep `/staff` open in a second tab.

1. Open Jane's July statement and point out the **$620 amount due** and **Synthetic demo data** label.
2. Show the source note: the July EOB explains the historical claim; any current-benefit refresh is a separate timestamped snapshot.
3. Select **I wanna talk about this**. Use text first: `Why do I owe $620?`
4. Read back the deterministic explanation: $2,400 billed − $1,300 contractual discount = $1,100 allowed; $500 deductible + $120 coinsurance = $620 patient responsibility; insurer paid $480. Say this is how the claim was processed, not proof that it is correct.
5. If Deepgram is preflighted, start voice and ask the same question, then switch with `Ahora explícamelo en español.` If voice fails, stay on the text path without apology or a success claim.
6. Ask for current benefits. Show either the timestamped Stedi test response or the conspicuous **fixture fallback—not live** label. Repeat that it does not validate the historical bill.
7. Search for billing support and show the fictional/unverified source labels.
8. Confirm a follow-up only when ready. Show the server-confirmed Medplum `Task` and concise `Communication` IDs in the staff view. If Medplum is unavailable, show the honest waiting/error state instead—never narrate success.

## Emergency text-only recording

If external services are unavailable, keep `NEXT_PUBLIC_DEMO_MODE=true`, keep a valid `BENEBOT_SESSION_SECRET`, open the bill directly, and demo only the historical text explanation plus the labeled local resource/staff waiting surfaces. Do not describe fixture data as live or imply that a follow-up was persisted.
