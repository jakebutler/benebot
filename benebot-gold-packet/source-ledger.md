# Source Ledger

**Purpose:** This ledger documents the origin of every fact, concept, and content element included in the BeneBot gold packet. Every substantive claim in the runtime and canonical libraries is traceable to one of the five source packets listed below.

---

## Source 1: Fact Boundaries (Authoritative)

**Task:** Researching Billing Concepts for BeneBot
**Files:** `billing-source-of-truth.md`, `billing-fact-boundaries.json`
**Role:** Establishes the P0 canonical concept IDs and factual guardrails. All other packets must conform to these boundaries. This source takes precedence over all other sources in cases of conflict.
**Concepts covered:** `allowed-amount`, `explanation-of-benefits`, `deductible`, `coinsurance`, `copayment`, `out-of-pocket-maximum`
**Primary external sources cited:**
- CMS Glossary of Health Coverage and Medical Terms — https://www.cms.gov/cciio/resources/forms-reports-and-other-resources/downloads/uniform-glossary-final.pdf
- HealthCare.gov Glossary — https://www.healthcare.gov/glossary/
- CMS How to Read an EOB — https://www.cms.gov/medical-bill-rights/help/guides/explanation-of-benefits

---

## Source 2: English Concept Library

**Task:** Designing Health-Literacy Explanations for Insurance Concepts
**Files:** `english-concept-library.json`, `english-review-notes.md`
**Role:** Provides health-literacy explanations, definitions, comprehension checks, and utterance variants in English for the six P0 concepts.
**Concepts covered:** `allowed-amount`, `deductible`, `coinsurance`, `copayment`, `out-of-pocket-maximum` (five of six; `explanation-of-benefits` was absent)
**Extra concepts (not in P0, excluded from runtime):** `premium`
**Analogy conflicts identified:** `allowed-amount` and `coinsurance` analogies were overridden by Source 4.

---

## Source 3: Spanish Concept Library

**Task:** Creating Spanish Medical Billing Concept Library
**Files:** `spanish-concept-library.json`, `spanish-review-notes.md`
**Role:** Provides culturally natural Latin American Spanish explanations and definitions for the six P0 concepts.
**Concepts covered:** `allowed-amount`, `explanation-of-benefits`, `deductible`, `coinsurance`, `copay` (mapped to `copayment`) (five of six; `out-of-pocket-maximum` was absent)
**Extra concepts (not in P0, excluded from runtime):** `patient-responsibility`
**Analogy violations identified:** Three analogies contained hardcoded dollar amounts or percentages and were rejected.
**Primary external sources cited:**
- CMS Spanish Glossary — https://www.cms.gov/derechos-facturas-medicas/ayuda/guias/terminos-seguro-salud
- Cigna Healthcare Spanish — https://www.cigna.com/es-us/knowledge-center/copays-deductibles-coinsurance

---

## Source 4: Analogy Adjudication

**Task:** Creating Accurate Financial and Healthcare Concept Analogies
**Files:** `analogy-adjudication.json`, `analogies_draft.md`
**Role:** Provides red-teamed, safe analogies for P0 concepts. Used to override unsafe analogies in Sources 2 and 3. This source is authoritative for analogy selection.
**Concepts covered (P0-relevant):** `allowed-amount`, `coinsurance`, `deductible` (partial, all candidates rejected)
**Concepts covered (non-P0, excluded from runtime):** `billed-amount`, `contractual-adjustment`, `insurer-paid`
**Concepts not covered (gap):** `explanation-of-benefits`, `copayment`, `out-of-pocket-maximum`

---

## Source 5: Bilingual Patient Cases

**Task:** Creating Bilingual Synthetic Patient Cases for Medical Bills
**Files:** `bilingual-patient-cases.jsonl`, `case-design-notes.md`
**Role:** Provides 24 synthetic evaluation test cases (12 English, 12 Spanish) mapping patient utterances to required tool calls and expected response types.
**Concept IDs used (original):** `allowed-amount`, `eob`, `deductible`, `copay-coinsurance`, `balance-billing`, `out-of-pocket-max`
**Concept ID normalization applied:** `eob` to `explanation-of-benefits`, `out-of-pocket-max` to `out-of-pocket-maximum`, `copay-coinsurance` to `["copayment", "coinsurance"]`
**Note:** `balance-billing` appears in one case but is not a P0 concept. The case is retained in the evaluation library as it tests scoped-refusal behavior.

---

## Concept Coverage Matrix

| Concept | Boundaries | EN Library | ES Library | Analogies | Cases |
|---|---|---|---|---|---|
| `allowed-amount` | Yes | Yes | Yes | Yes (recommended) | Yes |
| `explanation-of-benefits` | Yes | **No** | Yes | **No** | Yes (as `eob`) |
| `deductible` | Yes | Yes | Yes | Partial (all rejected) | Yes |
| `coinsurance` | Yes | Yes | Yes | Yes (recommended) | Yes (combined) |
| `copayment` | Yes | Yes | Yes (as `copay`) | **No** | Yes (combined) |
| `out-of-pocket-maximum` | Yes | Yes | **No** | **No** | Yes (as `out-of-pocket-max`) |
