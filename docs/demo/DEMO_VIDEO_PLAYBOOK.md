# BeneBot Spanish-first demo-video playbook

**Phase:** Demo preparation only

**Data:** Synthetic Jane Doe scenario only

**Machine-readable source:** `docs/demo/demo-scenarios.json`

## Recommendation

Build the demo around one strong Spanish conversation, recorded as six small storyboard modules and assembled afterward. The central story is:

1. Jane opens a confusing $620 bill.
2. BeneBot retrieves the historical EOB and explains the reconciled amounts.
3. Jane interrupts to ask what “monto permitido” means.
4. Jane then says the record shows an MRI she did not receive; she remembers receiving only X-rays.
5. BeneBot identifies a real unresolved discrepancy without declaring the bill wrong, repeats it, and asks permission to create a human-review case.
6. After Jane confirms, the server creates a Medplum `Task`; BeneBot tells Jane that Bayview’s billing team has been assigned the case and asked to contact her by secure message.
7. The final shot proves the case exists in Medplum.

Do not spend recording time on a current-benefits refresh. The flagship value is grounded explanation, fluent Spanish conversation, interruption handling, careful escalation, and a real practice workflow.

## Why this storyline works

- The $620 explanation is fully supported by the historical EOB and deterministic application math.
- The interruption demonstrates conversational quality instead of merely showing translation.
- “The record says MRI; the patient says no MRI occurred” is a concrete reason for human review.
- BeneBot can say the difference **needs review** without saying the bill is incorrect, fraudulent, or already resolved.
- The confirmed Medplum Task proves value to the practice, while the secure-message follow-up gives the patient a concrete next step.
- Six small capture modules reduce reruns and can be reused as FAQ clips, social clips, or a polished hackathon cut.

## Voice cast

| Role | English | Spanish | Notes |
|---|---|---|---|
| Jane / patient | `aura-2-andromeda-en` | `aura-2-estrella-es` | Conversational and clearly distinct from BeneBot |
| BeneBot | `aura-2-helena-en` | `aura-2-selena-es` | Matches the application configuration |
| Optional narrator | `aura-2-orpheus-en` | `aura-2-nestor-es` | Opening and closing only |

Use Deepgram for both roles; a second provider is unnecessary for the first batch. Generate each patient turn as its own file so timing can be adjusted without regenerating the whole conversation.

## Safety boundary for the escalation

Approved BeneBot framing:

> “El registro muestra una resonancia magnética lumbar el 8 de julio, pero usted dice que ese día solo recibió radiografías y que no recibió una resonancia. Esa diferencia necesita revisión. No puedo confirmar desde aquí que la factura sea incorrecta.”

Approved post-confirmation framing:

> “El servidor confirmó el caso de revisión. El equipo de facturación de Bayview tiene asignado el caso y se le pidió que se comunique con usted por mensaje seguro. El ID del caso es [TASK_ID].”

Do not say:

- “Encontré un error.”
- “La factura está mal.”
- “Bayview ya se comunicó con usted.”
- “El problema se resolverá.”
- “No tiene que pagar.”

The Task proves that a review was requested and assigned. It does not prove that the bill is wrong or that the follow-up has already occurred.

### Implemented pre-recording copy

Both the live-voice function-call response and the text-fallback response now use the approved post-confirmation framing above. The backend contract supports that wording because the confirmed Task is `requested`, owned by Bayview’s organization, and records `secure-message` as the preferred contact. The recording must still fail if those Task fields are not present.

## Six-module storyboard

### Module 1 — The bill arrives

**Target:** 8–12 seconds

- Start on the synthetic Spanish billing-email preview.
- Hold on Bayview Imaging and the $620 amount.
- Select **Quiero hablar sobre esta factura**.
- Land on Jane’s secure portal with the synthetic-demo label visible.

Optional narrator:

> “Jane recibió una factura de 620 dólares por un servicio que no entiende.”

End cue: the bill page is loaded and **Hablar sobre esta factura** is visible.

### Module 2 — Jane asks for help

**Target:** 12–18 seconds

- Open BeneBot.
- Keep **Español** selected.
- Show **Secure billing context verified** and that BeneBot will not ask for SSN, DOB, member ID, or patient ID.
- Jane asks:

> “Esta factura es demasiado complicada. ¿Por qué debo seiscientos veinte dólares por esta resonancia? Explíqueme cómo se procesó el reclamo.”

End cue: Jane’s full utterance appears in the transcript and BeneBot begins retrieving information.

### Module 3 — BeneBot retrieves the grounded record

**Target:** 8–14 seconds

- Keep the patient and BeneBot transcript visible.
- Show the real in-panel tool activity changing from running to succeeded.
- Prefer the product’s patient-friendly activity label over an editor-created animation.
- Briefly highlight the historical EOB source and reconciled bill math.

On-screen callouts, if needed:

- Historical EOB retrieved
- Bill math reconciled in application code
- No model-calculated amounts

End cue: the historical response begins.

### Module 4 — Explanation and interruption

**Target:** 30–45 seconds

- BeneBot explains the $2,400 billed amount, $1,300 adjustment, $1,100 allowed amount, $500 deductible, $120 coinsurance, $480 insurer payment, and $620 responsibility.
- Cut the long response after the allowed amount is introduced.
- Jane interrupts:

> “Espere — ¿qué significa monto permitido? ¿Es lo que tengo que pagar?”

- Show the Flux interruption indicator and BeneBot audio stopping.
- BeneBot answers concisely:

> “El monto permitido es el precio negociado que el plan usó para procesar este reclamo. El registro muestra 1,100 dólares, no los 2,400 que facturó el proveedor. No es necesariamente lo que paga usted ni lo que paga el plan. ¿Quiere que continúe con el desglose?”

End cue: BeneBot asks whether Jane wants to continue.

### Module 5 — Unresolved discrepancy and confirmed case

**Target:** 35–50 seconds

Jane says:

> “Sigo confundida, y hay algo más. El registro dice que recibí una resonancia, pero ese día solo me hicieron radiografías. No recibí una resonancia.”

BeneBot should:

1. Repeat the difference between the record and Jane’s report.
2. Say it needs human review.
3. Avoid declaring the bill wrong.
4. Ask whether Jane wants a billing-review case created for secure-message follow-up.
5. State that nothing has been created yet.

Jane confirms with one clean turn:

> “Sí.”

Only after the server returns a Task ID may BeneBot say:

> “El servidor confirmó el caso de revisión. El equipo de facturación de Bayview tiene asignado el caso y se le pidió que se comunique con usted por mensaje seguro. El ID del caso es [TASK_ID].”

End cue: the confirmed case ID and saved concise-summary status are visible.

### Module 6 — Medplum proof

**Target:** 12–20 seconds

- Start with BeneBot’s `/staff` timeline to connect the patient experience to the workflow.
- Show `ExplanationOfBenefit`, `Invoice`, `Task`, and `Communication` with real IDs. A current eligibility artifact is not required for this story.
- Do not dwell on the staff page's empty eligibility placeholder; crop or move past it because no benefits refresh occurs in this scenario.
- Then switch to the signed-in Medplum project.
- Search for the exact Task ID returned in Module 5.
- Open the Task resource and show only synthetic fields:
  - `status: requested`
  - owner: Bayview Imaging organization
  - issue type: `service-not-recognized`
  - concise patient issue summary
  - preferred contact: `secure-message`
  - Invoice focus and encounter reference
- Hold for three seconds on the Medplum Task.

Optional narrator:

> “La conversación termina en un caso real y auditable para el equipo de facturación, no en una promesa vacía.”

## Three reusable videos

The same footage produces three useful outputs:

| Video | Content | Target length |
|---|---|---:|
| Spanish flagship | All six modules | 1:45–2:15 |
| Spanish FAQ: unrecognized service | Modules 3–6 with a short setup card | 50–70 sec |
| English smoke: explain the bill | English version of Modules 2–4; no case creation | 35–50 sec |

Suggested FAQ titles:

- **¿Cómo ayuda BeneBot cuando no reconozco un servicio de mi factura?**
- **¿Puede BeneBot crear un caso para el equipo de facturación?**
- **How does BeneBot explain a complicated medical bill?**

## Recording method

Use two lanes:

1. **Flagship live proof:** record the Spanish conversation with system audio and microphone capture. Use headphones for BeneBot audio so the patient microphone does not create echo. This is the proof of live voice, interruption handling, and tool execution.
2. **Automated cutdowns:** Playwright drives the same signed text path and captures clean visuals. Deepgram Aura generates Jane and BeneBot dialogue from the exact scenario. Label these **Scripted demo · synthetic data**.

For automated clips, generate BeneBot audio only from the response observed in that run. Never synthesize a Task-success line from the script before the UI returns a real Task ID.

## Modular capture workflow

Record each module as a separate take:

```text
01-bill-arrives
02-jane-asks
03-retrieval-stream
04-interruption
05-confirmed-case
06-medplum-proof
```

For each take, save:

- picture track;
- Jane audio stem;
- BeneBot audio stem;
- caption file;
- screenshot of the final frame;
- app commit SHA;
- Task ID when applicable.

This lets the editor replace a weak module without rerunning the entire conversation or spending another long agent context window.

## Fast recording sequence when the backend is ready

1. Run the seed twice and confirm stable IDs.
2. Run one Spanish voice connection smoke test.
3. Open the bill, `/staff`, and the Medplum project in separate tabs.
4. Confirm the Medplum project contains only synthetic demo data in the fields that will be shown.
5. Record Modules 1–4.
6. Start a fresh BeneBot session and record Module 5 through the confirmed Task ID.
7. Immediately find that exact ID in Medplum and record Module 6.
8. Record the short English Modules 2–4 only if the Spanish flagship is safely captured.

If Task creation fails, show the failure honestly and rerun Module 5. Do not use an older Task ID with a newer conversation.

## Edit and caption rules

- Preserve Spanish punctuation and accents in captions.
- Use speaker labels: **Jane** and **BeneBot**.
- Keep the transcript and tool stream visible during retrieval and interruption.
- Use a split-screen or gentle crop to keep the patient turn, BeneBot response, and tool activity in one visual context.
- Do not speed up spoken Spanish. Trim silence and tool latency instead.
- Never splice a Task ID, confirmation line, or Medplum resource from a different take.
- Keep **Synthetic demo** visible or add a persistent corner label.
- Do not show API keys, browser profiles, project credentials, raw payer payloads, or unrelated Medplum resources.

## Approval checklist

- [ ] No current-benefits refresh appears in the flagship story.
- [ ] Jane’s reported MRI/X-ray discrepancy is the reason for escalation.
- [ ] BeneBot says the difference needs review but does not declare the bill wrong.
- [ ] The interruption visibly stops BeneBot and receives a concise answer.
- [ ] Nothing is claimed created before explicit patient confirmation.
- [ ] The Task ID in BeneBot matches the Task ID shown in Medplum.
- [ ] The Task owner is Bayview Imaging and preferred contact is secure message.
- [ ] BeneBot says the team was assigned/asked to follow up, not that follow-up already happened.
- [ ] The saved Communication is concise and contains no raw audio or full transcript.
- [ ] All data shown in the patient and Medplum screens is synthetic.
- [ ] Spanish pronunciation and captions receive a fluent-speaker review.
- [ ] The final video records the app commit SHA and recording date.

## Current technical references

- [Deepgram multilingual Voice Agent guidance](https://developers.deepgram.com/docs/multilingual-voice-agent)
- [Deepgram Aura voices and languages](https://developers.deepgram.com/docs/tts-models)
- [Deepgram Aura TTS getting started](https://developers.deepgram.com/docs/text-to-speech)
- [Playwright video recording](https://playwright.dev/docs/videos)
