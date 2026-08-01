# BeneBot

**BeneBot explains the bill you received, refreshes the benefits you have now, and opens a real follow-up case with your provider — in the language you prefer.**

Built on Medplum, Deepgram, and Stedi. Synthetic data only.

---

## The one-sentence version

An 82-year-old on Medicare who speaks Spanish should be able to ask "why do I owe this?" out loud and get a correct answer, without waiting for her daughter to take a day off work.

---

## The problem, from two directions

### For patients — and especially elderly patients with limited English

Being on Medicare does not make billing simple. It makes it fragmented. Four parts, each with its own deductible and cost sharing, layered with either a Medigap policy or an Advantage network. Traditional Medicare has no annual out-of-pocket maximum at all, so "20% coinsurance" is 20% of an unbounded number.

The people navigating this are, on average, the least equipped to. And a meaningful share are doing it in a second language:

- **8%** of Medicare beneficiaries living in the community have limited English speaking proficiency, and 7% have limited English reading proficiency. *(CMS Medicare Current Beneficiary Survey, 2023)*
- **1 in 5** adults dually eligible for Medicare and Medicaid have limited English proficiency. *(Commonwealth Fund, 2025)*
- Roughly **25.7 million** people age 5+ in the US have limited English proficiency overall. *(KFF, 2021 data)*

Today the workaround is a family member. An adult child takes time off, sits on hold, and translates a conversation they also do not fully understand — which means the household's financial decisions are being made through a guess, in a domain where guessing is expensive.

The most painful case is the one where the patient does not owe the money at all. Federal law prohibits providers from billing Qualified Medicare Beneficiary enrollees for Part A and Part B deductibles, coinsurance, or copays. It still happens routinely, and patients pay out of confusion or fear.

### For providers, hospitals, and health systems

"Can you explain this bill?" is the highest-volume, lowest-margin call patient financial services takes. It is also the hardest one to staff bilingually — interpreter lines are slow and expensive, and hiring for language coverage in a billing queue is a luxury most practices do not have.

The call also produces nothing durable. It ends as a note, a voicemail, or nothing at all. If the patient calls back, the next rep starts over.

BeneBot takes the first pass on that call and hands the team a structured case instead.

---

## What BeneBot does

Every bill carries an **"I wanna talk about this"** button. When the patient presses it:

1. A real-time voice conversation opens, in English or Spanish, with mid-conversation switching.
2. The session is already scoped to that patient and that bill, so BeneBot never asks for an SSN, date of birth, or member ID.
3. It reads the **historical adjudication** from Medplum and explains, in plain language, how the insurer arrived at the patient-responsibility amount.
4. On request — as a separate, clearly-labeled step — it refreshes **current** eligibility through Stedi and reports it with its own timestamp.
5. It surfaces relevant help, including real government programs for Medicare patients who may have been billed something they do not owe.
6. When the patient is still confused, it narrows the issue to one sentence, reads it back, waits for explicit confirmation, and only then creates a follow-up **Task** and a concise **Communication** in Medplum.
7. Staff see the whole thing — EOB, Invoice, eligibility check, the unresolved concern, and the confirmed case — in one audit view.

---

## Why the architecture is the pitch

Anyone can put an LLM in front of a bill. Two decisions make this one trustworthy enough to put in front of a scared 82-year-old.

### 1. Three questions, three sources, never substituted

| Question | Source | Tense |
|---|---|---|
| "Why do I owe this?" | `ExplanationOfBenefit` (Medplum, FHIR R4) | Historical — dated to the claim |
| "What are my benefits now?" | `CoverageEligibilityResponse` (Stedi, X12 270/271) | Current — timestamped at the check |
| "What do I owe today?" | `Invoice` (Medplum, FHIR R4) | Live balance |

BeneBot never uses one to answer another, and it states the source and date of each out loud. This sounds pedantic until you notice that a deductible reading taken today does not explain a claim adjudicated three weeks ago — and that treating it as though it does is exactly how a patient pays something they do not owe. Most bill-explainer demos blur these together because the data looks similar.

### 2. The model never touches the arithmetic

Application code normalizes the raw EOB and reconciles it against fixed invariants to a one-cent tolerance:

```
allowed              = billed − discount
patientResponsibility = deductible + copay + coinsurance + nonCovered
insurerPaid          = allowed − patientResponsibility
```

For the demo bill: `1100 = 2400 − 1300`, `620 = 500 + 0 + 120 + 0`, `480 = 1100 − 620`.

If reconciliation fails, BeneBot produces no numeric explanation at all. The language model only ever receives values that already balanced, and it is instructed to explain them rather than derive them.

### Everything else it refuses to do

- Never let a current eligibility response explain or validate a historical claim.
- Never claim an external action succeeded before the server confirms it.
- Never expose a Medplum, Deepgram, or Stedi key to the browser.
- Never trust a patient or bill ID sent by the browser after the session is created.
- Never store raw audio, and never persist a full transcript by default.
- Never present a fixture as a live payer response.
- Never present a fictional demo resource without labeling it as one.
- Never tell a patient whether a federal protection applies to them — name who can confirm it, and let them make the call.

---

## How each service is used

**Medplum — system of record.** FHIR R4 throughout. Patient, Coverage, Encounter, ExplanationOfBenefit, and Invoice are seeded idempotently and validated against the server. Task, Communication, and CoverageEligibilityResponse are written back as the conversation resolves. Client credentials stay server-side; every patient read is scoped to the signed BeneBot session. BeneBot is a surface on the revenue cycle, not a second copy of it.

**Deepgram — real-time voice.** Multilingual English/Spanish speech with model-level turn detection, so a patient can interrupt mid-sentence and BeneBot stops, answers the interruption, and asks whether to continue. The browser receives only a short-lived server-issued token, never the API key, and every tool call routes back through BeneBot's own server. Text input stays available the whole time as a fallback.

**Stedi — current eligibility.** Test-mode 270/271 eligibility against the fixed synthetic identity. Benefits the payer omits are preserved as *unknown* rather than filled in, and a fixture fallback is labeled conspicuously rather than passed off as live.

---

## What is real and what is demo-scoped

Stated plainly, because it is the difference between a demo and a claim:

- **Real:** the FHIR resource model and the Medplum writes; the reconciliation math and its tests; the source-separation discipline; the Deepgram voice session and token handling; the Stedi test-mode call; the government resources (1-800-MEDICARE, SHIP, the QMB protection) with their actual published phone numbers.
- **Demo-scoped:** one synthetic patient, Jane Doe, whose identity is fixed by Stedi's test-mode requirements. She is 22 and commercially insured, not the elderly Medicare patient the product is built for — that identity is a constraint of the sandbox, not a design choice. The billing-help directory besides the government entries is fictional and labeled as such. No real email is sent. No real PHI exists anywhere in the build.

---

## What comes next

- Medicare-specific claim types, starting with the questions that actually dominate the queue: observation-vs-inpatient status, split facility and professional bills, and Part D coverage-phase changes.
- QMB status checks so a dual-eligible patient can be told *this bill should not have been sent* rather than *here is who to ask*.
- More languages, driven by each practice's actual patient population rather than by our guess.
- Phone entry, so the patient who does not use a portal can reach the same agent.

---

## The 90-second spoken version

> Jane gets a $620 bill for an MRI. She speaks Spanish. Today, that means calling her daughter.
>
> Instead she presses one button on the bill and asks, out loud, in Spanish: they charged $2,400, the allowed amount was $1,100, why do I still owe $620?
>
> BeneBot reads the actual claim her insurer adjudicated — from Medplum, in FHIR — and walks her through it: the negotiated discount, the $500 that went to her deductible, the $120 of coinsurance. She interrupts halfway through to ask what "allowed amount" means. It stops, answers, and asks if she wants it to continue.
>
> Then she asks a different question: what are my benefits *now*? That is a live Stedi eligibility check, and BeneBot reports it as a separate thing with its own timestamp — because today's deductible does not explain a claim from three weeks ago, and pretending it does is how people pay bills they don't owe.
>
> She is still confused. BeneBot narrows it to one sentence, reads it back, waits for her to say yes — and only then creates a real billing-review Task in Medplum. Not a chat log. Work, assigned to a human.
>
> Her provider's billing team opens the staff view and sees all of it: the EOB, the invoice, the eligibility check, her exact unresolved concern, and the case.
>
> Two audiences, one conversation. She got her independence back. They got their highest-volume call handled and documented.
>
> Nobody should need their kid to translate a medical bill.
