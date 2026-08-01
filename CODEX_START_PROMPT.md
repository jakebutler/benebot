# Codex kickoff prompt

Read `AGENTS.md` and `BENEBOT_BUILD_SPEC.md` in full before changing any code.

You are implementing BeneBot as a synthetic-data hackathon demo. The core experience is one Jane Doe bill: explain the historical $620 patient responsibility from a Medplum `ExplanationOfBenefit`, refresh a separately dated current-benefits snapshot through Stedi test mode, support English/Spanish Deepgram voice, retrieve clearly labeled demo billing-help resources, and create a Medplum `Task` plus `Communication`.

Start with **Phase 0 only**:

1. Inspect the current repository.
2. Inspect the current Medplum AI-assistant guide and, if available, the linked Medplum source repository.
3. Inspect current Deepgram React/UI SDK types and examples.
4. Inspect Stedi’s current test-mode eligibility case.
5. Compare current APIs with the assumptions in the spec.
6. Produce a file-by-file implementation plan, dependency list, and risk/fallback table.
7. Identify any spec detail that is incompatible with current SDK or FHIR types and propose the smallest compliant adjustment.
8. Do not write implementation code yet.

After the plan, proceed phase by phase without waiting for routine confirmation. For every phase:

- State the phase and files to change.
- Implement only that bounded phase.
- Run type-check, unit tests, and production build.
- Fix failures before continuing.
- Preserve the P0 demo path and labeled fallbacks.
- Never expose keys, invent FHIR fields, or let the LLM calculate financial amounts.

Record unresolved blockers explicitly, implement the safest available fallback, and continue toward a complete P0 build.
