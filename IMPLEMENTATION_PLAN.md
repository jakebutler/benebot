# BeneBot Hackathon Execution Plan

**Deadline:** August 1, 2026 at 5:00 PM Pacific  
**Planning baseline:** August 1, 2026 at approximately 11:45 AM Pacific  
**Goal:** Ship and record one flawless synthetic Jane Doe happy path before 4:15 PM; reserve the final 45 minutes for upload and submission.

## P0 demo contract — Spanish-first amendment

The demo is done only when one uninterrupted run proves all of this:

1. Jane opens a synthetic Spanish billing-email preview and selects **“Quiero hablar sobre esta factura.”**
2. The CTA opens the already-authenticated synthetic portal, visibly labeled **“Sesión segura — Jane Doe,”** **Español preferido**, and **synthetic demo**. The UI records **“Secure billing context verified.”**
3. The signed session binds the exact Patient, Invoice, EOB, Coverage, Encounter, provider, and payer. Browser tool payloads never supply those IDs.
4. BeneBot explains that the secure portal already provided the scoped billing context and it will not ask for SSN, DOB, member ID, or patient ID.
5. BeneBot explains the historical amount using the Medplum `ExplanationOfBenefit`.
6. Application code, not the model, reconciles:
   - `$2,400 - $1,300 = $1,100` allowed
   - `$500 + $120 = $620` patient responsibility
   - `$1,100 - $620 = $480` insurer paid
7. The screen separates the historical **$500 deductible applied**, the current **$620 Invoice balance**, and a separately timestamped current Stedi annual/remaining deductible result. Current eligibility never validates the historical claim.
8. Application code derives deductible met-to-date only when annual and remaining values share individual, network, and service scope; otherwise it remains unknown. The model never performs that subtraction.
9. During the Spanish explanation, Jane interrupts with **“Espere — ¿qué significa monto permitido?”** Flux emits model-level `StartOfTurn`, BeneBot stops, explains, and asks whether to continue.
10. Before ending, BeneBot asks in Spanish whether anything remains unclear. If Jane is confused, it categorizes and repeats a concise issue in Spanish and asks for confirmation.
11. Only after confirmation, Medplum confirms a billing-review `Task` containing the issue type, concise patient issue summary, and preferred contact—not the transcript. The patient sees the confirmed Task/case ID.
12. BeneBot saves a concise `Communication` without raw audio or a full transcript.
13. `/staff` shows the EOB, Invoice, current eligibility, unresolved concern, Task, and Communication with IDs and timestamps.
14. The same path remains usable through text; English remains supported and is smoke-tested separately.

Anything that does not improve this exact sequence is deferred.

## Fixed implementation choices

- Greenfield Next.js App Router, strict TypeScript, Tailwind.
- Use `@medplum/core`, `@medplum/fhirtypes`, `@deepgram/ui`, `zod`, and `jose`.
- Use current Deepgram `AgentProvider` with an inline agent configuration; do not require a separately configured agent ID unless current SDK types force it.
- Use `flux-general-multi` with `language_hints: ["es", "en"]`, the existing Spanish-capable Aura code-switching voice, and supported keyterm prompting for the billing vocabulary. Do not add Nova routing, an external VAD, or a translation pipeline.
- Start with browser/platform echo cancellation and use Flux `StartOfTurn` for the single rehearsed barge-in.
- Use a server-minted Deepgram temporary token. The long-lived API key never reaches the browser.
- Use **direct Stedi test API** for P0. Do not wait for Medplum's separately enabled Insurance Eligibility Bot.
- Use local JSON resources. Set `MOSS_ENABLED=false`.
- Use the attached fixture bundle as the canonical data definition, but seed Medplum idempotently by stable identifiers.
- Use only Jane Doe. The earlier Maria example is superseded by the fixed Stedi Aetna test identity.
- Keep five agent tools only: bill context, current benefits, resource search, billing-case follow-up, and summary.
- Limit bill context to preferred language and the bound encounter's bill-relevant provider/facility/service/date/location. Exclude unrelated encounters, diagnoses, medications, notes, and general chart questions.
- No broad component system, generalized domain layer, coverage target, or premature abstraction.

## Credentials and setup

Place secrets only in ignored `.env.local`; never paste them into chat.

Required for the live P0:

- `MEDPLUM_BASE_URL=https://api.medplum.com/`
- `MEDPLUM_CLIENT_ID`
- `MEDPLUM_CLIENT_SECRET`
- `DEEPGRAM_API_KEY`
- `STEDI_TEST_API_KEY`
- `BENEBOT_SESSION_SECRET` generated locally with at least 32 random bytes

The Medplum client must be allowed to search, create, and update the P0 FHIR resource types. The Deepgram key must be permitted to call `/v1/auth/grant` (current docs say at least Member permission).

Not required:

- OpenAI key
- Anthropic key
- Moss account/key
- Medplum Insurance Eligibility Bot access

## Execution schedule

### 11:45–12:10 — Wave 1: single-owner bootstrap

Root/integrator only:

- Copy the supplied `AGENTS.md`, build spec, start prompt, and fixtures into the repository.
- Scaffold Next.js in place and install dependencies once.
- Add `.gitignore`, environment validation, test scripts, and the directory skeleton.
- Freeze shared request/result types for all five tools.
- Freeze file ownership before parallel work begins.
- Run type-check, the empty test runner, and production build.

Hard stop: the application builds and no secret-bearing module can enter a client bundle.

### 12:10–1:30 — Wave 2: three parallel foundations

| Owner | Model | Exclusive files | Deliverable |
|---|---|---|---|
| Agent A | Terra xhigh | `lib/billing/**`, `lib/medplum/**`, `scripts/seed-medplum.ts`, bill-context route, focused billing/seed tests | Seed twice without duplicates; normalize and reconcile the exact EOB; expose grounded bill context |
| Agent B | Terra xhigh | `app/page.tsx`, `app/bill/**`, `components/bill/**`, initial `app/staff/**`, `components/staff/**` | Polished bill page, source badges, synthetic disclosure, minimal staff shell |
| Agent C | Sol xhigh | `lib/session.ts`, `lib/deepgram/**`, session/token routes, `components/voice/**` | Scoped JWT session, Deepgram temp token, current `@deepgram/ui` connection, voice/text shell |
| Root | Sol xhigh | dependency/config/shared-contract files and integration review only | Keep contracts stable, answer seam questions, run repository gates |

Rules:

- Only root edits `package.json`, lockfiles, TypeScript/Next/test configuration, global CSS, environment schema, and shared contracts.
- Agents do not install dependencies, run whole-repo formatters, add barrel files, or touch another lane.
- If an SDK contradicts the spec, use the smallest type-correct adjustment and report it to root.

Hard stops:

- Actual Medplum Patient, Coverage, EOB, and Invoice IDs resolve.
- Exact bill math passes narrow tests and fails closed on mismatch.
- Bill page renders the exact scenario.
- Signed session is bound to patient, invoice, EOB, coverage, provider, and payer.
- One Deepgram temporary token is issued without exposing the API key.

### 1:30–2:10 — Wave 3: historical text vertical slice

Integrate the bill page, scoped session, bill-context route, versioned prompt, tool bridge, and text input.

Hard stop: typing **"Why do I owe $620?"** produces the exact EOB-derived breakdown with the historical source/date. A reconciliation failure produces no numerical explanation and offers human review.

Do not polish voice until this text path works.

### 2:10–3:10 — Wave 4: parallel P0 integrations

| Owner | Model | Exclusive files | Deliverable |
|---|---|---|---|
| Agent A | Terra xhigh | `lib/stedi/**`, refresh route, focused Stedi tests | Fixed-identity guard, timeout, defensive normalization, `CoverageEligibilityResponse`, labeled fixture fallback |
| Agent B | Terra xhigh | `lib/resources/**`, resource route/cards, staff UI | Local bilingual resource search, disclosures, live artifact cards |
| Agent C | Sol xhigh | Deepgram lane only | Spanish-first English-capable voice, Flux barge-in, tool-call dispatch through BeneBot routes |
| Root | Sol xhigh | Medplum action routes and join work | Confirm-before-write `Task`, concise `Communication`, sanitized success/failure results |

Hard stops:

- Stedi sends only the exact fixed Aetna test request and fails before network access on identity mismatch.
- Current benefits have their own timestamp and never explain the July 8 historical claim.
- Fixture mode says **"Demo fallback—not a live eligibility response."**
- Voice completes the Spanish path and the rehearsed Flux barge-in; an English smoke turn and text remain available.
- Practice resource ranks first; fictional and community content remains labeled.
- No UI says Task or summary creation succeeded before Medplum confirms it.

### 3:10–3:45 — Wave 5: join and minimum validation

- Connect `/staff` to the actual Medplum artifacts.
- Run `npm run typecheck`.
- Run `npm run test` with only narrow P0 tests:
  - bill reconciliation and mismatch;
  - session validation/tampering;
  - Stedi identity guard and unknown preservation;
  - resource ranking/labels;
  - confirmed Task and Communication writes.
- Run `npm run build`.
- Run one Playwright text-path happy test.
- Run one manual English/Spanish voice smoke test.

There is no coverage target and no broad edge-case suite.

### 3:45–4:15 — Wave 6: rehearse and record

- Seed Medplum twice and confirm no duplicates.
- Run one live Stedi test before recording.
- Verify the fallback badge separately.
- Pre-authorize the browser microphone.
- Open `/staff` in a second tab.
- Rehearse the exact 3:45 script once.
- Record the demo before making any optional visual improvement.

### 4:15–5:00 — Submission buffer

Stop feature work. Upload, verify video processing/playback, complete the submission form, and submit. Fix only a reproduced submission-blocking issue.

## 3:45 Spanish-first demo script

| Time | Beat | Visible proof |
|---:|---|---|
| 0:00–0:25 | Spanish email → Spanish CTA → portal | Synthetic email, secure Jane session, preferred-language badge, verified-context event |
| 0:25–1:20 | “Me cobraron $2,400 por la resonancia, pero el monto permitido fue $1,100 y todavía debo $620. ¿Cómo llegaron a esa cantidad? ¿Y significa que todavía me quedan $500 de deducible?” | Exact deterministic historical breakdown; no claim that current deductible explains July |
| 1:20–1:50 | “Espere — ¿qué significa monto permitido?” | Flux `StartOfTurn` barge-in, prompt stop, plain Spanish answer, ask to continue |
| 1:50–2:25 | Refresh current benefits | Separately dated Stedi test or honest fallback; annual, remaining, and same-scope derived amount or unknown |
| 2:25–3:10 | Jane remains confused; repeat issue and confirm | Narrow issue type and concise Spanish summary; server-confirmed billing-case Task ID |
| 3:10–3:45 | End and switch to `/staff` | EOB, Invoice, current eligibility, unresolved concern, Task, Communication with IDs/timestamps |

## Fallback ladder

1. Voice failure: continue the identical path in visible text mode.
2. Stedi failure: use the supplied normalized fixture with its fixed capture timestamp and a conspicuous non-live badge.
3. Resource-network failure: local JSON is already the P0 provider.
4. EOB missing or math mismatch: do not explain amounts; offer a billing review.
5. Medplum Task/Communication write failure: say it was not completed; never fake success.
6. Deployment failure: record from localhost if the submission accepts a recorded demo without a live URL.

## Cut immediately

- Moss
- Medplum Stedi Bot adapter
- Raw Stedi `Binary`/`DocumentReference`
- Telephony or live transfers
- Live Reddit scraping
- Production authentication or enrollment
- Arbitrary patients, payers, bills, or languages
- General medical/chart Q&A
- Automated appeals
- Real email delivery
- Production authentication
- Dynamic STT model routing
- A separate translation pipeline
- A new case-management system
- Audio storage, playback, or full-transcript storage
- Animated tool timeline
- Demo reset
- Broad mobile polish or full localization
- Broad tests, monitoring stack, analytics, or deployment automation

## Never cut

- Deterministic EOB-derived math
- Historical/current separation and dates
- Server-only secrets and scoped signed session
- Fixed Stedi identity guard
- Synthetic-data and source disclosures
- Spanish-first English-capable voice plus text fallback
- Encounter-bound billing context and visible synthetic authentication
- Model-level Flux barge-in for the rehearsed interruption
- Confirmation before follow-up
- Server-confirmed Medplum `Task` and `Communication`
- Staff proof
- Honest fallback states
- Type-check, focused tests, production build, and one text-path E2E

## Confirmed launch assumptions

- `.env.local` contains the Medplum, Deepgram, and Stedi credentials. The BeneBot session secret is generated locally and never displayed.
- A recorded localhost demo is sufficient; deployment is not P0.
- The recording is Spanish-first for a non-native-English patient population. English is a separate smoke test, not a staged language-switch beat.
- Payment-plan resource search remains available in the product but is removed from the recording.
- The hardware translator concept is future vision only—one sentence or slide, with no P0 implementation.
