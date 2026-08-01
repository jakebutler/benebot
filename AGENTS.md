# AGENTS.md — BeneBot

## Mission

Build BeneBot as a polished synthetic-data hackathon demo that explains one medical bill, refreshes current benefits, supports English/Spanish voice, and creates a real Medplum follow-up workflow.

The canonical specification is `BENEBOT_BUILD_SPEC.md`.

## Non-negotiable product rules

1. Historical bill explanation comes from `ExplanationOfBenefit` or `ClaimResponse`.
2. Current eligibility comes from Stedi and must be timestamped separately.
3. Never imply that a current eligibility response explains or validates a historical claim.
4. Never let the LLM calculate financial amounts.
5. Never claim an external action succeeded until the server confirms it.
6. Never expose API keys to the browser.
7. Use synthetic data only.
8. Store no raw audio and no full transcript by default.
9. Label all fictional and community-reported resources.
10. Support a text fallback even when voice is the primary interface.

## Working method

Before editing code:

1. Read `BENEBOT_BUILD_SPEC.md`.
2. Inspect the relevant official documentation.
3. Inspect existing repository code and tests.
4. State the phase being implemented and list the files that will change.
5. Implement only that phase.
6. Run type-check, tests, and build.
7. Fix all errors before moving to another phase.

Do not perform a broad rewrite when a bounded change is sufficient.

## Medplum rules

- Use FHIR R4.
- Import resource types from `@medplum/fhirtypes`.
- Use the current `@medplum/core` SDK APIs.
- Do not invent fields, resource types, extensions, search parameters, or coding systems.
- Prefer standard fields and official terminologies.
- Search by stable identifiers.
- Make seed and write operations idempotent where practical.
- Validate references before writing dependent resources.
- Scope every patient data read to the signed BeneBot session.
- Use client credentials only on the server.
- Keep `medplum-link`, if present, read-only.

## Deepgram rules

- Use a server-issued temporary access token.
- The browser must never receive `DEEPGRAM_API_KEY`.
- Prefer current `@deepgram/ui` and current official examples.
- Inspect SDK types instead of forcing outdated configuration.
- Keep text input available.
- Use multilingual English/Spanish recognition and a compatible voice.
- Tool calls must go through BeneBot server routes.
- No Medplum or Stedi calls from client components.

## Stedi rules

- Use the test endpoint and test key.
- Never send real PHI.
- The P0 test identity is fixed:
  - Jane Doe
  - DOB 20040404
  - Member ID AETNA12345
  - Provider NPI 1999999984
  - Trading partner 60054
  - Service type 30
- Fail before the network call if the identity does not match.
- Preserve omitted benefits as unknown.
- Never invent copays, deductible values, network status, or service applicability.
- A fixture fallback must be visibly labeled and never called live.

## Resource-search rules

- Do not send patient data to Moss.
- Preserve source metadata.
- Prefer practice-provided resources.
- Always label fictional demo resources.
- Always label community-reported phone-tree tips unverified.
- Fall back to local JSON when Moss is unavailable.

## TypeScript and React rules

- `strict: true`.
- Avoid `any`; use `unknown` plus validation where external data is untyped.
- Validate route inputs and external responses with `zod`.
- Keep server-only modules out of client bundles.
- Use semantic HTML and accessible controls.
- Support keyboard navigation.
- Add loading, empty, error, and fallback states.
- Do not suppress TypeScript or lint errors to make a build pass.

## Financial calculation rules

- Convert raw EOB data into a normalized deterministic structure.
- Reconcile:
  - allowed = billed − discount
  - patient responsibility = deductible + copay + coinsurance + noncovered
  - insurer paid = allowed − patient responsibility
- Use a $0.01 tolerance.
- If reconciliation fails, do not produce a numerical explanation.
- Unit-test all calculations.

## Security rules

- No API secrets in client code, logs, screenshots, fixtures, or commits.
- Validate JWT signature, issuer, audience, expiration, and claims.
- Bind the session to patient, invoice, EOB, and coverage.
- Do not trust patient IDs sent by the browser after session creation.
- Sanitize errors.
- Rate-limit session and token endpoints.
- Do not log raw payer responses or full transcripts.

## Testing gates

After each phase, run these separately:

```bash
npm run typecheck
```

```bash
npm run test
```

```bash
npm run build
```

Before final delivery, also run:

```bash
npm run test:e2e
```

Do not declare the task complete unless failures are resolved or explicitly documented with evidence and a safe fallback.

## Scope control

P0 is the single Jane Doe happy path. Do not add telephony, live Reddit scraping, production auth, automated appeals, or generalized chart Q&A before P0 passes.

## Final review checklist

- No exposed keys.
- No real PHI.
- Exact bill math reconciles.
- Historical/current distinction appears in agent language and UI.
- English/Spanish flow works.
- Stedi live or visibly labeled fallback works.
- Fictional resources are labeled.
- Task and Communication are persisted.
- Staff page proves the workflow.
- Type-check, tests, build, and E2E pass.
