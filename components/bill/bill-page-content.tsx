"use client";

import { BillBreakdown } from "@/components/bill/bill-breakdown";
import { BillExperience } from "@/components/bill/bill-experience";
import { useLanguage } from "@/components/site/language-provider";

export function BillPageContent({ invoiceId }: { invoiceId: string }) {
  const { language } = useLanguage();
  const isSpanish = language === "es";

  return (
    <main className="patient-shell" lang={language}>
      <div className="portal-context-strip" aria-label={isSpanish ? "Contexto de demostración autenticado" : "Authenticated demo context"}>
        <span className="secure-badge">{isSpanish ? "Sesión segura: Jane Doe" : "Secure session: Jane Doe"}</span>
        <span className="language-badge">{isSpanish ? "Idioma preferido: Español" : "Preferred language: English"}</span>
        <span className="demo-badge">{isSpanish ? "Portal de demostración sintético" : "Synthetic demo portal"}</span>
      </div>

      <section
        className="secure-context-event"
        role="status"
        aria-label={isSpanish ? "Contexto seguro de facturación verificado" : "Secure billing context verified"}
      >
        <span aria-hidden="true">✓</span>
        <div>
          <strong>{isSpanish ? "Contexto seguro de facturación verificado" : "Secure billing context verified"}</strong>
          <p>
            {isSpanish
              ? "Este portal de demostración ya está vinculado a la factura, cobertura y reclamación de Jane. BeneBot no le pedirá SSN, fecha de nacimiento, ID de miembro ni ID de paciente."
              : "This demo portal is already linked to Jane’s bill, coverage, and claim. BeneBot will not ask for a Social Security number, date of birth, member ID, or patient ID."}
          </p>
        </div>
      </section>

      <section className="statement-hero" aria-labelledby="statement-title">
        <div>
          <p className="eyebrow">Bayview Imaging</p>
          <h1 id="statement-title">{isSpanish ? "Su estado de cuenta de julio" : "Your July statement"}</h1>
          <p className="statement-number">
            {isSpanish ? `Factura ${invoiceId} · Emitida el 28 de julio de 2026` : `Invoice ${invoiceId} · Issued July 28, 2026`}
          </p>
        </div>
        <div className="amount-due" aria-label={isSpanish ? "Saldo actual de 620 dólares" : "Current balance of 620 dollars"}>
          <span>{isSpanish ? "Saldo actual" : "Current balance"}</span>
          <strong>$620</strong>
          <small>{isSpanish ? "Vence el 27 de agosto de 2026" : "Due August 27, 2026"}</small>
        </div>
      </section>

      <BillBreakdown language={language} />
      <BillExperience invoiceIdentifier={invoiceId} language={language} />

      <section className="clarity-note" aria-label={isSpanish ? "Diferencia entre fuentes" : "Difference between sources"}>
        <span className="note-icon" aria-hidden="true">i</span>
        <p>
          <strong>{isSpanish ? "Dos preguntas distintas, dos fuentes distintas." : "Two different questions, two different sources."}</strong>{" "}
          {isSpanish
            ? "El EOB histórico explica cómo se procesó la reclamación del 8 de julio. Cualquier beneficio que BeneBot consulte hoy será una instantánea actual con su propia fecha y fuente; no explica ni valida esta factura de $620."
            : "The historical EOB explains how the July 8 claim was processed. Any benefits BeneBot checks today are a current snapshot with their own date and source; they do not explain or validate this $620 bill."}
        </p>
      </section>
    </main>
  );
}
