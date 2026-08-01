"use client";

import Link from "next/link";

import { HeroIllustration } from "@/components/landing/hero-illustration";
import { useLanguage } from "@/components/site/language-provider";

const invoiceId = "BENEBOT-INV-1001";

const audiences = [
  {
    id: "patients",
    kicker: "For patients and families",
    title: "Independence, not a translator",
    lede:
      "An 82-year-old on Medicare should not need her daughter to take a day off work to sit on hold with a billing office. BeneBot speaks first, listens, and lets her interrupt mid-sentence, in Spanish, at her pace, as many times as she needs to hear it again.",
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
          "Every resolved conversation writes a FHIR Task and a concise Communication into Medplum: assigned, timestamped, and auditable next to the EOB and Invoice they came from.",
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
    ask: "“Which one am I paying: the deductible, the copay, or the coinsurance?”",
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
      "The outstanding balance on the statement, which is neither the billed charge nor the allowed amount. That distinction accounts for a large share of billing calls.",
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
      "The patient chooses English or Spanish before the session opens, and Deepgram runs it with a native voice for that language and model-level turn detection, so an interruption stops the explanation mid-sentence. The browser holds only a short-lived server-issued token, and every tool call routes back through BeneBot’s server.",
  },
  {
    name: "Stedi",
    role: "Current eligibility",
    body:
      "Test-mode 270/271 eligibility against the fixed synthetic identity. Omitted benefits are preserved as unknown, and a fixture fallback is labeled conspicuously rather than passed off as live.",
  },
];

const spanish: Record<string, string> = {
  "For patients and families": "Para pacientes y familias",
  "Independence, not a translator": "Independencia, no un traductor",
  "An 82-year-old on Medicare should not need her daughter to take a day off work to sit on hold with a billing office. BeneBot speaks first, listens, and lets her interrupt mid-sentence, in Spanish, at her pace, as many times as she needs to hear it again.": "Una persona de 82 años con Medicare no debería necesitar que su hija falte al trabajo para esperar en línea con facturación. BeneBot habla, escucha y permite que ella interrumpa en español, a su ritmo, todas las veces que lo necesite.",
  "It asks for nothing you should not give": "No pide información que usted no debería compartir",
  "The session is already scoped to one bill before the conversation starts, so BeneBot never asks for a Social Security number, date of birth, or member ID. Nobody should be trained to hand those to a voice on the phone.": "La sesión ya está limitada a una factura antes de comenzar, por lo que BeneBot nunca pide número de Seguro Social, fecha de nacimiento ni ID de miembro.",
  "It keeps the past and the present apart": "Mantiene separados el pasado y el presente",
  "What your insurer decided in July and what your plan says today are two different answers. Conflating them is how a patient pays something they never owed.": "Lo que la aseguradora decidió en julio y lo que el plan informa hoy son respuestas distintas. BeneBot nunca las confunde.",
  "It points at real public help": "Señala ayuda pública real",
  "When a Medicare patient describes a bill they may not owe, BeneBot surfaces 1-800-MEDICARE, the free SHIP counselor in their own state, and the federal QMB rule that makes some of these bills illegal to send at all.": "Cuando una persona con Medicare describe una factura que quizá no deba, BeneBot muestra 1-800-MEDICARE, el asesor SHIP gratuito de su estado y la regla federal QMB.",
  "It will not guess at money": "No adivina cantidades",
  "If the claim math does not reconcile to the penny, BeneBot says it cannot explain the number rather than inventing one.": "Si las cifras de la reclamación no concuerdan al centavo, BeneBot dice que no puede explicar la cantidad en lugar de inventarla.",
  "For providers and health systems": "Para proveedores y sistemas de salud",
  "Extend the billing team without adding headcount": "Amplíe el equipo de facturación sin aumentar personal",
  "“Can you explain this bill?” is the highest-volume, lowest-margin call patient financial services takes, and the hardest one to staff bilingually. BeneBot takes the first pass and hands the team a structured case instead of a voicemail.": "“¿Puede explicarme esta factura?” es una de las llamadas más frecuentes y más difíciles de atender de forma bilingüe. BeneBot realiza la primera revisión y entrega al equipo un caso estructurado, no un mensaje de voz.",
  "Conversations end as work, not chat logs": "Las conversaciones terminan como trabajo, no como registros de chat",
  "Every resolved conversation writes a FHIR Task and a concise Communication into Medplum: assigned, timestamped, and auditable next to the EOB and Invoice they came from.": "Cada conversación resuelta guarda una Task FHIR y una Communication concisa en Medplum, asignadas, fechadas y auditables junto con el EOB y la Invoice.",
  "Bilingual without an interpreter line": "Bilingüe sin una línea de intérpretes",
  "The patient picks English or Spanish before the session opens and hears a native voice in that language throughout, so routine billing questions are not gated on interpreter availability.": "La persona elige inglés o español antes de iniciar y escucha una voz nativa durante toda la sesión.",
  "No new system of record": "Sin un nuevo sistema de registro",
  "BeneBot reads the FHIR resources already in Medplum and writes the follow-up back into them. The session is bound to one bill, not opened onto the patient’s chart.": "BeneBot lee los recursos FHIR existentes en Medplum y guarda allí el seguimiento. La sesión está limitada a una factura, no al expediente completo.",
  "Staff see exactly what the patient saw": "El personal ve exactamente lo que vio el paciente",
  "The audit view shows which figures came from the historical EOB and which came from a live eligibility check, with the timestamp of each.": "La vista de auditoría muestra qué cifras provienen del EOB histórico y cuáles de una consulta actual, con la fecha de cada una.",
  "“Didn’t Medicare cover this? Why am I getting a bill?”": "“¿Medicare no cubrió esto? ¿Por qué recibí una factura?”",
  "Part B generally pays 80% after the deductible. The remaining 20% coinsurance has no annual cap under Traditional Medicare.": "La Parte B generalmente paga el 80% después del deducible. El coseguro restante del 20% no tiene límite anual en Medicare Tradicional.",
  "“Which one am I paying: the deductible, the copay, or the coinsurance?”": "“¿Qué estoy pagando: el deducible, el copago o el coseguro?”",
  "Three different mechanisms that patients use interchangeably. Which one applies depends on the service and on how much of the year’s deductible is already met.": "Son tres mecanismos distintos. El que corresponde depende del servicio y de cuánto deducible se haya cubierto durante el año.",
  "“Why did I get one bill from the hospital and another from the doctor?”": "“¿Por qué recibí una factura del hospital y otra del médico?”",
  "Facility fees and professional fees are adjudicated separately, often with different cost sharing on the same visit.": "Los cargos del centro y los honorarios profesionales se procesan por separado y pueden tener costos compartidos distintos.",
  "“I have Medicare and Medicaid. My caseworker said I owe nothing. So why is this here?”": "“Tengo Medicare y Medicaid. Me dijeron que no debo nada. Entonces, ¿por qué recibí esto?”",
  "Federal law bars providers from billing QMB enrollees for Part A and B cost sharing. It still happens, and patients pay out of fear.": "La ley federal prohíbe cobrar a beneficiarios QMB los costos compartidos de las Partes A y B. Aun así ocurre.",
  "“Why do I owe this?”": "“¿Por qué debo esto?”",
  "Historical": "Histórico",
  "The adjudication your insurer actually performed on the July 8 claim. This is the only record that can explain a bill, and BeneBot cites its date every time.": "La adjudicación que la aseguradora realizó para la reclamación del 8 de julio. Es el único registro que puede explicar la factura y BeneBot siempre cita su fecha.",
  "“What are my benefits right now?”": "“¿Cuáles son mis beneficios actuales?”",
  "Current": "Actual",
  "A live eligibility check, timestamped at the moment it runs and stored separately. Anything the payer omits stays unknown rather than being filled in.": "Una consulta de elegibilidad actual, fechada al realizarse y guardada por separado. Todo lo que la aseguradora omite permanece desconocido.",
  "“What do I owe today?”": "“¿Cuánto debo hoy?”",
  "Live balance": "Saldo actual",
  "The outstanding balance on the statement, which is neither the billed charge nor the allowed amount. That distinction accounts for a large share of billing calls.": "El saldo pendiente del estado de cuenta, que no es ni el cargo facturado ni el monto permitido.",
  "Provider billed": "El proveedor facturó",
  "Contractual discount": "Descuento contractual",
  "Allowed amount": "Monto permitido",
  "Deductible applied": "Deducible aplicado",
  "Coinsurance": "Coseguro",
  "Insurer paid": "La aseguradora pagó",
  "Patient responsibility": "Responsabilidad del paciente",
  "Never let a current eligibility response explain or validate a historical claim.": "Nunca permitir que una respuesta de elegibilidad actual explique o valide una reclamación histórica.",
  "Never let the language model calculate a dollar amount.": "Nunca permitir que el modelo calcule una cantidad monetaria.",
  "Never explain an exact amount before the tool call that grounds it in the bill.": "Nunca explicar una cantidad exacta antes de respaldarla con la factura.",
  "Never claim an external action succeeded before the server confirms it.": "Nunca afirmar que una acción externa tuvo éxito antes de que el servidor la confirme.",
  "Never expose a Medplum, Deepgram, or Stedi key to the browser.": "Nunca exponer una clave de Medplum, Deepgram o Stedi al navegador.",
  "Never trust a patient or bill ID sent by the browser after the session is created.": "Nunca confiar en un ID de paciente o factura enviado por el navegador después de crear la sesión.",
  "Never store raw audio, and never persist a full transcript by default.": "Nunca guardar audio sin procesar ni conservar una transcripción completa de forma predeterminada.",
  "Never present a fixture as a live payer response.": "Nunca presentar datos de respaldo como una respuesta en vivo de la aseguradora.",
  "Never present a fictional demo resource without labeling it as one.": "Nunca presentar un recurso ficticio sin etiquetarlo como demostración.",
  "System of record": "Sistema de registro",
  "Real-time voice": "Voz en tiempo real",
  "Current eligibility": "Elegibilidad actual",
};

export default function Home() {
  const { language } = useLanguage();
  const isSpanish = language === "es";
  const tr = (text: string): string => isSpanish ? spanish[text] ?? text : text;

  return (
    <main className="pitch-shell" lang={language}>
      <header className="pitch-hero">
        <div className="pitch-hero-copy">
          <p className="eyebrow">{isSpanish ? "Facturación médica por voz" : "Voice-first medical billing"} · Medplum × Deepgram × Stedi</p>
          <h1 className="pitch-h1">
            <span>{isSpanish ? <>Nadie debería necesitar a su hijo para <strong>traducir una factura médica.</strong></> : <>Nobody should need their kid to <strong>translate a medical bill.</strong></>}</span>
            <small>{isSpanish ? "Una explicación clara y fundamentada, en el idioma que usted prefiera." : "A clear, grounded explanation in the language you prefer."}</small>
          </h1>
          <div className="pitch-hero-rule" aria-hidden="true" />
          <p className="pitch-lede">{isSpanish ? "BeneBot le explica su factura en voz alta usando la reclamación que su seguro realmente procesó. Sin esperar. Sin pedirle su número de Seguro Social." : "BeneBot explains your bill out loud using the claim your insurer actually processed. No hold time. No request for your Social Security number."}</p>
          <p className="pitch-lede-secondary">{isSpanish ? "Las consultas de beneficios actuales permanecen separadas y cualquier seguimiento se confirma antes de enviarse al equipo de facturación." : "Current-benefit checks stay separate, and every follow-up is confirmed before it reaches the billing team."}</p>
          <div className="pitch-cta">
            <Link className="button button-primary" href={`/bill/${invoiceId}`}>{isSpanish ? "Hablar sobre mi factura" : "Talk about my bill"}</Link>
            <a className="button button-ghost" href="#sources">{isSpanish ? "Ver cómo mantiene la precisión" : "See how it stays accurate"}</a>
          </div>
        </div>
        <div className="pitch-hero-art">
          <HeroIllustration />
        </div>
      </header>

      <section className="pitch-section pitch-section-ink" aria-labelledby="problem-heading">
        <p className="eyebrow">{isSpanish ? "El problema" : "The problem"}</p>
        <h2 id="problem-heading" className="pitch-h2">
          {isSpanish ? "Medicare no simplificó la facturación. La fragmentó." : "Medicare did not make billing simple. It made it fragmented."}
        </h2>
        <p className="pitch-body">
          {isSpanish ? "Cuatro partes, cada una con sus propios deducibles y costos compartidos, además de Medigap o una red Advantage. Quienes hablan inglés como segundo idioma a menudo dependen de un familiar que también está intentando descifrarla." : "Four parts, each with its own deductibles and cost sharing, layered with Medigap or an Advantage network. The people navigating it are the least equipped to, and the ones who speak English as a second language are navigating it through a family member who is guessing too."}
        </p>

        <ul className="stat-row">
          <li>
            <strong>8%</strong>
            <p>{isSpanish ? "de los beneficiarios de Medicare que viven en la comunidad tienen dominio limitado del inglés." : "of Medicare beneficiaries living in the community have limited English speaking proficiency."}</p>
            <cite>CMS Medicare Current Beneficiary Survey, 2023</cite>
          </li>
          <li>
            <strong>{isSpanish ? "1 de cada 5" : "1 in 5"}</strong>
            <p>{isSpanish ? "adultos con elegibilidad para Medicare y Medicaid tienen dominio limitado del inglés." : "adults dually eligible for Medicare and Medicaid have limited English proficiency."}</p>
            <cite>Commonwealth Fund, 2025</cite>
          </li>
          <li>
            <strong>{isSpanish ? "Sin límite" : "No cap"}</strong>
            <p>{isSpanish ? "Medicare Tradicional no tiene un máximo anual de gastos de bolsillo." : "Traditional Medicare has no annual out-of-pocket maximum, so 20% coinsurance is 20% of an unbounded number."}</p>
            <cite>{isSpanish ? "Característica de las Partes A y B" : "Structural feature of Parts A and B"}</cite>
          </li>
        </ul>
      </section>

      <section className="pitch-section" aria-labelledby="questions-heading">
        <p className="eyebrow">{isSpanish ? "Lo que las personas preguntan" : "What people actually ask"}</p>
        <h2 id="questions-heading" className="pitch-h2">
          {isSpanish ? "No son casos excepcionales. Son la cola de llamadas." : "These are not edge cases. They are the call queue."}
        </h2>
        <ul className="question-grid">
          {questions.map((item) => (
            <li key={item.ask}>
              <p className="question-ask">{tr(item.ask)}</p>
              <p className="question-truth">{tr(item.truth)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="pitch-section pitch-section-teal" id="audiences" aria-labelledby="audiences-heading">
        <p className="eyebrow">{isSpanish ? "Dos públicos, una conversación" : "Two audiences, one conversation"}</p>
        <h2 id="audiences-heading" className="pitch-h2">
          {isSpanish ? "La misma llamada le cuesta dignidad al paciente y margen al proveedor." : "The same call costs the patient their dignity and the provider their margin."}
        </h2>
        <div className="audience-grid">
          {audiences.map((audience) => (
            <article className="audience-card" key={audience.id}>
              <p className="audience-kicker">{tr(audience.kicker)}</p>
              <h3>{tr(audience.title)}</h3>
              <p className="audience-lede">{tr(audience.lede)}</p>
              <dl>
                {audience.points.map((point) => (
                  <div key={point.title}>
                    <dt>{tr(point.title)}</dt>
                    <dd>{tr(point.body)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="pitch-section" id="sources" aria-labelledby="sources-heading">
        <p className="eyebrow">{isSpanish ? "El principio de precisión" : "The accuracy principle"}</p>
        <h2 id="sources-heading" className="pitch-h2">
          {isSpanish ? "Tres preguntas. Tres fuentes distintas. BeneBot nunca usa una para responder otra." : "Three questions. Three different sources. BeneBot never uses one to answer another."}
        </h2>
        <div className="source-grid">
          {sources.map((item) => (
            <article className="source-card" key={item.source}>
              <span className={item.tense === "Historical" ? "tense-badge historical" : "tense-badge"}>
                {tr(item.tense)}
              </span>
              <h3>{tr(item.question)}</h3>
              <p className="source-origin">
                <strong>{item.source}</strong>
                <small>{item.system}</small>
              </p>
              <p>{tr(item.body)}</p>
            </article>
          ))}
        </div>
        <p className="pitch-callout">
          {isSpanish ? "Muchas demostraciones confunden estas fuentes porque los datos se parecen. Un deducible consultado hoy no explica una reclamación procesada hace tres semanas." : "Most bill-explainer demos blur these together because the data looks similar. A deductible reading taken today does not explain a claim adjudicated three weeks ago, and treating it as though it does is exactly how a patient ends up paying something they do not owe."}
        </p>
      </section>

      <section className="pitch-section pitch-section-gold" aria-labelledby="math-heading">
        <p className="eyebrow">{isSpanish ? "Cálculos hechos por software, no por IA" : "Math handled by software, not AI"}</p>
        <h2 id="math-heading" className="pitch-h2">
          {isSpanish ? "El modelo explica la aritmética. Nunca la calcula." : "The model explains the arithmetic. It never performs it."}
        </h2>
        <div className="math-layout">
          <dl className="math-table">
            {math.map((row) => (
              <div key={row.label} className={row.tone}>
                <dt>{tr(row.label)}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="math-note">
            <p>
              {isSpanish ? "El código normaliza el EOB y concilia las cantidades mediante reglas fijas con una tolerancia de un centavo." : "Application code normalizes the raw EOB, then reconciles it against fixed invariants: allowed equals billed minus discount, responsibility equals deductible plus copay plus coinsurance plus noncovered, insurer paid equals allowed minus responsibility, to a one-cent tolerance."}
            </p>
            <p>
              {isSpanish ? "Si las cifras no concuerdan, BeneBot se niega a producir una explicación numérica. El modelo solo recibe valores ya conciliados." : "If it does not balance, BeneBot refuses to produce a numeric explanation at all. The language model only ever receives values that already reconciled, and it is instructed to explain them rather than derive them."}
            </p>
          </div>
        </div>
      </section>

      <section className="pitch-section" aria-labelledby="guardrails-heading">
        <p className="eyebrow">{isSpanish ? "Límites del producto" : "Constraints we build against"}</p>
        <h2 id="guardrails-heading" className="pitch-h2">{isSpanish ? "Lo que BeneBot no hará" : "What BeneBot will not do"}</h2>
        <ul className="guardrail-list">
          {guardrails.map((rule) => (
            <li key={rule}>{tr(rule)}</li>
          ))}
        </ul>
      </section>

      <section className="pitch-section" aria-labelledby="stack-heading">
        <p className="eyebrow">{isSpanish ? "Construido con" : "Built on"}</p>
        <h2 id="stack-heading" className="pitch-h2">{isSpanish ? "Tres servicios, cada uno haciendo lo que mejor sabe hacer." : "Three services, each doing the part it is best at."}</h2>
        <div className="stack-grid">
          {stack.map((item) => (
            <article className="stack-card" key={item.name}>
              <h3>{item.name}</h3>
              <p className="stack-role">{tr(item.role)}</p>
              <p>{isSpanish ? item.name === "Medplum" ? "FHIR R4 como sistema de registro para la factura, la reclamación y el seguimiento." : item.name === "Deepgram" ? "Voz en tiempo real en inglés y español con interrupciones naturales y herramientas seguras del servidor." : "Consulta de elegibilidad en modo de prueba, separada de la reclamación histórica." : item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pitch-section pitch-section-pink demo-section" id="demo" aria-labelledby="email-subject">
        <p className="eyebrow">{isSpanish ? "Pruébelo" : "Try it"}</p>
        <h2 className="pitch-h2">{isSpanish ? "La demostración empieza donde empezaría la experiencia real: una factura inesperada." : "The demo starts where the real thing would: an unexpected bill."}</h2>
        <p className="pitch-body">
          {isSpanish ? "El recorrido usa una sola paciente sintética, Jane Doe, cuya identidad está fijada por los requisitos del modo de prueba de Stedi. No se envía correo real y no hay datos reales de pacientes." : "The recorded journey runs Spanish-first on one synthetic patient, Jane Doe, whose identity is fixed by Stedi’s test-mode requirements. No real email is sent, and no real patient data exists anywhere in this build."}
        </p>

        <section className="email-preview" lang={language}>
          <div className="email-chrome" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="email-meta">
            <div>
              <p className="eyebrow">{isSpanish ? "Vista previa de correo sintético" : "Synthetic email preview"}</p>
              <strong>Bayview Imaging · {isSpanish ? "Facturación" : "Billing"}</strong>
            </div>
            <time dateTime="2026-07-28">{isSpanish ? "28 de julio de 2026" : "July 28, 2026"}</time>
          </div>
          <p className="email-to">{isSpanish ? "Para: Jane Doe · Portal de demostración seguro" : "To: Jane Doe · Secure demo portal"}</p>
          <div className="email-copy">
            <h3 id="email-subject">{isSpanish ? "Tiene una factura nueva de Bayview Imaging." : "You have a new bill from Bayview Imaging."}</h3>
            <p>
              {isSpanish ? <>Su saldo actual es <strong>$620</strong> por una resonancia magnética lumbar del 8 de julio. Puede ver el desglose en su portal seguro.</> : <>Your current balance is <strong>$620</strong> for a lower-back MRI on July 8. You can review the breakdown in your secure portal.</>}
            </p>
            <p>
              {isSpanish ? "BeneBot puede explicarle esta factura en español o inglés. Este es un correo de demostración; no se envía correo real." : "BeneBot can explain this bill in English or Spanish. This is a demo email; no real email is sent."}
            </p>
            <Link className="button button-primary" href={`/bill/${invoiceId}`}>
              {isSpanish ? "Quiero hablar sobre esta factura" : "I want to talk about this bill"}
            </Link>
          </div>
          <footer className="email-footer">
            <span>{isSpanish ? "Sesión de demostración autenticada para Jane Doe" : "Authenticated demo session for Jane Doe"}</span>
            <span>{isSpanish ? "Factura" : "Invoice"} {invoiceId}</span>
          </footer>
        </section>

        <aside className="language-note" aria-label={isSpanish ? "Idiomas disponibles" : "Language availability"}>
          <strong>{isSpanish ? "Español seleccionado." : "English selected."}</strong> {isSpanish ? "También puede cambiar a inglés en cualquier momento." : "You can switch to Spanish at any time."}
        </aside>
      </section>

      <footer className="pitch-footer">
        <div>
          <strong>BeneBot</strong>
          <p>
            {isSpanish ? "Una demostración con datos sintéticos para el hackathon YC × Medplum. No se usa, guarda ni transmite información médica real." : "A synthetic-data demonstration built for the YC × Medplum hackathon. No real protected health information is used, stored, or transmitted."}
          </p>
        </div>
        <Link className="quiet-link" href="/staff">{isSpanish ? "Vista de auditoría del personal" : "Staff audit view"} →</Link>
      </footer>
    </main>
  );
}
