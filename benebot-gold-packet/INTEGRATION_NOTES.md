# BeneBot gold-packet integration notes

**Integration date:** 2026-08-01
**Runtime authority:** `AGENTS.md`, `BENEBOT_BUILD_SPEC.md`, and `CONVERSATION_RELIABILITY_PLAN.md`
**Research source:** the eight original files in this directory

The product owner approved this packet for incorporation. The original packet files remain unchanged. This note records the transformations and conflicts found while promoting the research into the bounded Jane Doe P0.

## Promoted into runtime

- The six concept IDs are the closed P0 concept set: allowed amount, Explanation of Benefits, deductible, coinsurance, copayment, and out-of-pocket maximum.
- English and Spanish preferred terms and recognized alternatives inform the language-scoped prompt guidance.
- Number-free analogies, analogy boundaries, forbidden claims, and required qualifiers were compiled into `lib/deepgram/concept-guidance.ts`.
- The packet's approved-project-budget, detailed-receipt, car-repair, park-entry, and safety-cap analogy families were retained. The Spanish coinsurance analogy was repaired from the unnatural word `comanejador` to `copiloto`.
- The fixed P0 service label is rendered deterministically as “an MRI of the lower back” in English and “una resonancia magnética lumbar” in Spanish so the Spanish narration does not inject an English clinical phrase.
- Source files, rejected content, all twenty-four bilingual cases, the research rubric spec, and the research tool matrix are retained as provenance and evaluation inputs.

## Patient-specific content kept out of the prompt

`runtime-concepts.json` and `canonical-concepts.json` contain synthetic Jane/demo values and assertions, including specific billed, allowed, deductible, coinsurance, copay, provider, and date examples. Those values remain in research/evaluation artifacts but are not imported by the patient runtime.

Patient-specific historical values now enter the conversation only through the deterministic `requiredSpokenSummary` returned after a successful, reconciled `get_bill_context` call. Current values enter only through the separately timestamped deterministic summary returned by `refresh_current_benefits`.

The code-owned compiled guidance deliberately replaces or qualifies these unsafe generalizations:

- Allowed amount is the negotiated amount used to calculate shares, not what the insurer promises to pay.
- An EOB reports claim processing and is not proof of correctness; the demo already has a separate current Invoice.
- Deductible, coinsurance, copay, and out-of-pocket rules are plan-specific and retain their exceptions and scope limits.

## Rubric conflict

`eight-rubric-spec.json` reuses `R1` through `R8` with meanings that conflict with the executable reliability plan and omits native voice consistency, authenticated scope/privacy, uncertainty handling, and confirmed persistence.

Resolution:

- The executable evaluation schema keeps the reliability plan's R1-R8 definitions.
- The packet rubric file is parsed as research-only.
- All eight definition conflicts are returned explicitly by `researchRubricConflicts`; none is silently overwritten.
- Packet criteria such as semantic equivalence, natural language, analogy safety, brevity, and warmth remain useful secondary research dimensions, principally under executable R6.

## Tool-matrix conflict

`tool-prerequisite-matrix.json` references `get_eob_details` and `get_current_benefits`, neither of which is a BeneBot P0 tool. It also asks current tools for network, family-plan, remark-code, payment-history, and legal conclusions that they do not return.

Resolution:

- No sixth tool or alias was added.
- The closed runtime tools remain exactly `get_bill_context`, `refresh_current_benefits`, `search_support_resources`, `request_human_followup`, and `save_conversation_summary`.
- The executable prerequisite matrix is encoded in application-owned prompt/tool metadata.
- Evaluation loading classifies packet tool references as `runtime`, `deferred`, or `unsupported` without silently remapping them.
- Unsupported facts remain unknown and out of scope.
- The synthetic portal discloses secure message as the P0 default preferred contact. Phone is used only when the patient explicitly requests it; the repeated issue confirmation includes the selected contact before any Task call.

## Evaluation-case boundary

The twenty-four bilingual cases are preserved and strictly parsed as adversarial research seeds. They are not used as live Jane fixtures because some contain arbitrary amounts, unsupported tools, unsupported legal/network conclusions, or promises outside P0.

Final case normalization and judge execution remain deferred. The current scaffold records applicability, scores of zero through two, hard failures, evidence turn/tool references, and separate Information and Procedural Compliance without raw audio or transcript text.

## Implementation-review reconciliations

The bounded implementation received independent Sol-medium, Sol-high, and Terra review while it was being integrated. The following issues were repaired before final validation:

- Combined historical/current questions now require `get_bill_context` first and `refresh_current_benefits` second. The grounded historical narration remains usable if the separately dated current check fails, but no historical/current comparison or invented current value is allowed. This preserves the recorded historical explanation, interruption, then current-check sequence.
- Historical summaries and allowed-amount interruptions use deterministic bilingual application output; the agent is not asked to copy, calculate, or translate financial figures.
- Current speech is deliberately limited to source, timestamp, coverage status, and same-scope deductible values. Unsupported current copay, coinsurance, network, and out-of-pocket conclusions remain unknown.
- Patient-facing text, tool status, cards, follow-up confirmation, and transcript labels follow the selected session language. A new voice session clears prior session evidence, while a transport reconnect preserves the active session.
- Spanish patient-facing copy uses the formal `usted` register consistently across the greeting, deterministic explanations, prompts, and controls.
- Language selectors remain locked during connect, connected, and reconnecting states. A fresh English text session no longer inherits the Spanish default.
- Retry activity reports only the final aggregate result, avoiding a false visible failure followed by success.
- Evaluation records now prove the selected native voice, use one ordered event sequence with timestamps, restrict tool names to the closed runtime set, require IDs for confirmed Task and Communication writes, and attach bounded evidence excerpts instead of full transcripts.
- Runtime response validation also requires a Task ID for any created follow-up and a Communication ID for any saved summary before success is shown or recorded.
- The generic fallback issue summary no longer inserts the demo balance unless that fact was actually returned in the current session.

## Provenance limitations

- The source ledger names upstream files that are not included in this directory, so the original merge cannot be replayed from this packet alone.
- The packet records an AI adjudicator but does not include evidence of the billing-domain and native-Spanish human approvals contemplated by the reliability plan.
- Product-owner approval authorizes this bounded incorporation; it does not manufacture those absent review records.

These limitations should be stated if the research is presented as clinically, legally, or linguistically validated beyond a synthetic hackathon demo.
