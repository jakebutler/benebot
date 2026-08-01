import Link from "next/link";

const invoiceId = "BENEBOT-INV-1001";

const audiences = [
  {
    id: "patients",
    kicker: "For patients and families",
    title: "Independence, not a translator",
    lede:
      "An 82-year-old on Medicare should not need her daughter to take a day off work to sit on hold with a billing office. BeneBot speaks first, listens, and lets her interrupt mid-sentence — in Spanish, at her pace, as many times as she needs to hear it again.",
    points: [
      {
        title: "It asks for nothing you should not give",
        body:
          "The session is already scoped to one bill before the conversation starts, so BeneBot never asks for a Social Security number, date of birth, or member ID. Nobody should be trained to hand those to a voice on the phone.",
      },
      {
        title: "It keeps the past and the present apart",
        body:
          "What your insurer decided in July and what your plan says today are two different answers. Conflating them is how a patient pays something they never owed.",
      },
      {
        title: "It points at real public help",
        body:
          "When a Medicare patient describes a bill they may not owe, BeneBot surfaces 1-800-MEDICARE, the free SHIP counselor in their own state, and the federal QMB rule that makes some of these bills illegal to send at all.",
      },
      {
        title: "It will not guess at money",
        body:
          "If the claim math does not reconcile to the penny, BeneBot says it cannot explain the number rather than inventing one.",
      },
    ],
  },
  {
    id: "providers",
    kicker: "For providers and health systems",
    title: "Extend the billing team without adding headcount",
    lede:
      "“Can you explain this bill?” is the highest-volume, lowest-margin call patient financial services takes, and the hardest one to staff bilingually. BeneBot takes the first pass and hands the team a structured case instead of a voicemail.",
    points: [
      {
        title: "Conversations end as work, not chat logs",
        body:
          "Every resolved conversation writes a FHIR Task and a concise Communication into Medplum — assigned, timestamped, and auditable next to the EOB and Invoice they came from.",
      },
      {
        title: "Bilingual without an interpreter line",
        body:
          "The patient picks English or Spanish before the session opens and hears a native voice in that language throughout, so routine billing questions are not gated on interpreter availability.",
      },
      {
        title: "No new system of record",
        body:
          "BeneBot reads the FHIR resources already in Medplum and writes the follow-up back into them. The session is bound to one bill, not opened onto the patient’s chart.",
      },
      {
        title: "Staff see exactly what the patient saw",
        body:
          "The audit view shows which figures came from the historical EOB and which came from a live eligibility check, with the timestamp of each.",
      },
    ],
  },
];

const questions = [
  {
    ask: "“Didn’t Medicare cover this? Why am I getting a bill?”",
    truth:
      "Part B generally pays 80% after the deductible. The remaining 20% coinsurance has no annual cap under Traditional Medicare.",
  },
  {
    ask: "“Which one am I paying — the deductible, the copay, or the coinsurance?”",
    truth:
      "Three different mechanisms that patients use interchangeably. Which one applies depends on the service and on how much of the year’s deductible is already met.",
  },
  {
    ask: "“Why did I get one bill from the hospital and another from the doctor?”",
    truth:
      "Facility fees and professional fees are adjudicated separately, often with different cost sharing on the same visit.",
  },
  {
    ask: "“I have Medicare and Medicaid. My caseworker said I owe nothing. So why is this here?”",
    truth:
      "Federal law bars providers from billing QMB enrollees for Part A and B cost sharing. It still happens, and patients pay out of fear.",
  },
];

const sources = [
  {
    question: "“Why do I owe this?”",
    source: "ExplanationOfBenefit",
    system: "Medplum · FHIR R4",
    tense: "Historical",
    body:
      "The adjudication your insurer actually performed on the July 8 claim. This is the only record that can explain a bill, and BeneBot cites its date every time.",
  },
  {
    question: "“What are my benefits right now?”",
    source: "CoverageEligibilityResponse",
    system: "Stedi · X12 270/271",
    tense: "Current",
    body:
      "A live eligibility check, timestamped at the moment it runs and stored separately. Anything the payer omits stays unknown rather than being filled in.",
  },
  {
    question: "“What do I owe today?”",
    source: "Invoice",
    system: "Medplum · FHIR R4",
    tense: "Live balance",
    body:
      "The outstanding balance on the statement, which is neither the billed charge nor the allowed amount — a distinction that accounts for a large share of billing calls.",
  },
];

const math = [
  { label: "Provider billed", value: "$2,400", tone: "" },
  { label: "Contractual discount", value: "−$1,300", tone: "" },
  { label: "Allowed amount", value: "$1,100", tone: "rule" },
  { label: "Deductible applied", value: "$500", tone: "" },
  { label: "Coinsurance", value: "$120", tone: "" },
  { label: "Insurer paid", value: "$480", tone: "" },
  { label: "Patient responsibility", value: "$620", tone: "total" },
];

const guardrails = [
  "Never let a current eligibility response explain or validate a historical claim.",
  "Never let the language model calculate a dollar amount.",
  "Never explain an exact amount before the tool call that grounds it in the bill.",
  "Never claim an external action succeeded before the server confirms it.",
  "Never expose a Medplum, Deepgram, or Stedi key to the browser.",
  "Never trust a patient or bill ID sent by the browser after the session is created.",
  "Never store raw audio, and never persist a full transcript by default.",
  "Never present a fixture as a live payer response.",
  "Never present a fictional demo resource without labeling it as one.",
];

const stack = [
  {
    name: "Medplum",
    role: "System of record",
    body:
      "FHIR R4 throughout. Patient, Coverage, Encounter, ExplanationOfBenefit, and Invoice are seeded idempotently; Task, Communication, and CoverageEligibilityResponse are written back as the conversation resolves.",
  },
  {
    name: "Deepgram",
    role: "Real-time voice",
    body:
      "The patient chooses English or Spanish before the session opens, and Deepgram runs it with a native voice for that language and model-level turn detection — so an interruption stops the explanation mid-sentence. The browser holds only a short-lived server-issued token, and every tool call routes back through BeneBot’s server.",
  },
  {
    name: "Stedi",
    role: "Current eligibility",
    body:
      "Test-mode 270/271 eligibility against the fixed synthetic identity. Omitted benefits are preserved as unknown, and a fixture fallback is labeled conspicuously rather than passed off as live.",
  },
];

export default function Home() {
  return (
    <div className="pitch-shell">
      <nav className="topline" aria-label="BeneBot">
        <Link className="wordmark" href="/">Bene<span>Bot</span></Link>
        <div className="topline-links">
          <a href="#audiences">Who it serves</a>
          <a href="#sources">How it works</a>
          <Link href="/staff">Staff view</Link>
        </div>
        <span className="demo-badge">Synthetic data only</span>
      </nav>

      <header className="pitch-hero">
        <p className="eyebrow">Voice-first medical billing · Medplum × Deepgram × Stedi</p>
        <h1 className="pitch-h1">Nobody should need their kid to translate a medical bill.</h1>
        <p className="pitch-lede">
          BeneBot answers “why do I owe this?” out loud, in English or Spanish, using the claim your insurer
          actually adjudicated. Then it opens a real follow-up case inside your provider’s system — one the
          billing team can see, own, and close.
        </p>
        <div className="pitch-cta">
          <a className="button button-primary" href="#demo">Start the patient demo</a>
          <Link className="button button-ghost" href="/staff">See the staff workflow</Link>
        </div>
      </header>

      <section className="pitch-section" aria-labelledby="problem-heading">
        <p className="eyebrow">The problem</p>
        <h2 id="problem-heading" className="pitch-h2">
          Medicare did not make billing simple. It made it fragmented.
        </h2>
        <p className="pitch-body">
          Four parts, each with its own deductibles and cost sharing, layered with Medigap or an Advantage
          network. The people navigating it are the least equipped to, and the ones who speak English as a
          second language are navigating it through a family member who is guessing too.
        </p>

        <ul className="stat-row">
          <li>
            <strong>8%</strong>
            <p>of Medicare beneficiaries living in the community have limited English speaking proficiency.</p>
            <cite>CMS Medicare Current Beneficiary Survey, 2023</cite>
          </li>
          <li>
            <strong>1 in 5</strong>
            <p>adults dually eligible for Medicare and Medicaid have limited English proficiency.</p>
            <cite>Commonwealth Fund, 2025</cite>
          </li>
          <li>
            <strong>No cap</strong>
            <p>
              Traditional Medicare has no annual out-of-pocket maximum, so 20% coinsurance is 20% of an
              unbounded number.
            </p>
            <cite>Structural feature of Parts A and B</cite>
          </li>
        </ul>
      </section>

      <section className="pitch-section" aria-labelledby="questions-heading">
        <p className="eyebrow">What people actually ask</p>
        <h2 id="questions-heading" className="pitch-h2">
          These are not edge cases. They are the call queue.
        </h2>
        <ul className="question-grid">
          {questions.map((item) => (
            <li key={item.ask}>
              <p className="question-ask">{item.ask}</p>
              <p className="question-truth">{item.truth}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="pitch-section" id="audiences" aria-labelledby="audiences-heading">
        <p className="eyebrow">Two audiences, one conversation</p>
        <h2 id="audiences-heading" className="pitch-h2">
          The same call costs the patient their dignity and the provider their margin.
        </h2>
        <div className="audience-grid">
          {audiences.map((audience) => (
            <article className="audience-card" key={audience.id}>
              <p className="audience-kicker">{audience.kicker}</p>
              <h3>{audience.title}</h3>
              <p className="audience-lede">{audience.lede}</p>
              <dl>
                {audience.points.map((point) => (
                  <div key={point.title}>
                    <dt>{point.title}</dt>
                    <dd>{point.body}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="pitch-section" id="sources" aria-labelledby="sources-heading">
        <p className="eyebrow">The accuracy principle</p>
        <h2 id="sources-heading" className="pitch-h2">
          Three questions. Three different sources. BeneBot never uses one to answer another.
        </h2>
        <div className="source-grid">
          {sources.map((item) => (
            <article className="source-card" key={item.source}>
              <span className={item.tense === "Historical" ? "tense-badge historical" : "tense-badge"}>
                {item.tense}
              </span>
              <h3>{item.question}</h3>
              <p className="source-origin">
                <strong>{item.source}</strong>
                <small>{item.system}</small>
              </p>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        <p className="pitch-callout">
          Most bill-explainer demos blur these together because the data looks similar. A deductible reading
          taken today does not explain a claim adjudicated three weeks ago, and treating it as though it does
          is exactly how a patient ends up paying something they do not owe.
        </p>
      </section>

      <section className="pitch-section" aria-labelledby="math-heading">
        <p className="eyebrow">Math handled by software, not AI</p>
        <h2 id="math-heading" className="pitch-h2">
          The model explains the arithmetic. It never performs it.
        </h2>
        <div className="math-layout">
          <dl className="math-table">
            {math.map((row) => (
              <div key={row.label} className={row.tone}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="math-note">
            <p>
              Application code normalizes the raw EOB, then reconciles it against fixed invariants — allowed
              equals billed minus discount, responsibility equals deductible plus copay plus coinsurance plus
              noncovered, insurer paid equals allowed minus responsibility — to a one-cent tolerance.
            </p>
            <p>
              If it does not balance, BeneBot refuses to produce a numeric explanation at all. The language
              model only ever receives values that already reconciled, and it is instructed to explain them
              rather than derive them.
            </p>
          </div>
        </div>
      </section>

      <section className="pitch-section" aria-labelledby="guardrails-heading">
        <p className="eyebrow">Constraints we build against</p>
        <h2 id="guardrails-heading" className="pitch-h2">What BeneBot will not do</h2>
        <ul className="guardrail-list">
          {guardrails.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="pitch-section" aria-labelledby="stack-heading">
        <p className="eyebrow">Built on</p>
        <h2 id="stack-heading" className="pitch-h2">Three services, each doing the part it is best at.</h2>
        <div className="stack-grid">
          {stack.map((item) => (
            <article className="stack-card" key={item.name}>
              <h3>{item.name}</h3>
              <p className="stack-role">{item.role}</p>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pitch-section demo-section" id="demo" aria-labelledby="email-subject">
        <p className="eyebrow">Try it</p>
        <h2 className="pitch-h2">The demo starts where the real thing would: an unexpected bill.</h2>
        <p className="pitch-body">
          The recorded journey runs Spanish-first on one synthetic patient, Jane Doe, whose identity is fixed
          by Stedi’s test-mode requirements. No real email is sent, and no real patient data exists anywhere
          in this build.
        </p>

        <section className="email-preview" lang="es">
          <div className="email-chrome" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="email-meta">
            <div>
              <p className="eyebrow">Vista previa de correo sintético</p>
              <strong>Bayview Imaging · Facturación</strong>
            </div>
            <time dateTime="2026-07-28">28 de julio de 2026</time>
          </div>
          <p className="email-to">Para: Jane Doe · Portal de demostración seguro</p>
          <div className="email-copy">
            <h3 id="email-subject">Tiene una factura nueva de Bayview Imaging.</h3>
            <p>
              Su saldo actual es <strong>$620</strong> por una resonancia magnética lumbar del 8 de julio.
              Puede ver el desglose de la factura en su portal seguro.
            </p>
            <p>
              BeneBot puede explicarle esta factura en español o inglés. Este es un correo de demostración: no
              se envía correo real.
            </p>
            <Link className="button button-primary" href={`/bill/${invoiceId}`}>
              Quiero hablar sobre esta factura
            </Link>
          </div>
          <footer className="email-footer">
            <span>Sesión de demostración autenticada para Jane Doe</span>
            <span>Factura {invoiceId}</span>
          </footer>
        </section>

        <aside className="language-note" aria-label="Language availability">
          <strong>Español primero.</strong> English is also available in the conversation.
        </aside>
      </section>

      <footer className="pitch-footer">
        <div>
          <strong>BeneBot</strong>
          <p>
            A synthetic-data demonstration built for the YC × Medplum hackathon. No real protected health
            information is used, stored, or transmitted.
          </p>
        </div>
        <Link className="quiet-link" href="/staff">Staff audit view →</Link>
      </footer>
    </div>
  );
}
