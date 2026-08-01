"use client";

import { useState } from "react";

import { BeneBotPanel } from "@/components/voice/benebot-panel";

export function BillExperience({ invoiceIdentifier }: { invoiceIdentifier: string }) {
  const [sessionToken, setSessionToken] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string>();

  async function startConversation(): Promise<void> {
    setIsStarting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/benebot/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIdentifier }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !isSessionResponse(body)) {
        throw new Error("BeneBot no pudo iniciar la sesión segura de demostración.");
      }
      setSessionToken(body.sessionToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "BeneBot no pudo iniciar la sesión segura de demostración.");
    } finally {
      setIsStarting(false);
    }
  }

  if (sessionToken) return <BeneBotPanel sessionToken={sessionToken} onClose={() => setSessionToken(undefined)} />;

  return (
    <section className="conversation-launch" aria-labelledby="conversation-title">
      <div>
        <p className="eyebrow">¿Necesita ayuda?</p>
        <h2 id="conversation-title">Hable de esta factura con BeneBot.</h2>
        <p>Pregunte por qué debe $620, pida una consulta separada de sus beneficios actuales o solicite una revisión de facturación. Puede escribir o hablar en español; English is also supported.</p>
      </div>
      <div className="conversation-actions">
        <button className="button button-primary" type="button" onClick={startConversation} disabled={isStarting}>
          {isStarting ? "Iniciando sesión segura…" : "Hablar sobre esta factura"}
        </button>
        <p className="translation-line">No necesita proporcionar datos de identificación otra vez.</p>
        {error ? <p className="form-error" role="alert">{error} Puede intentar la conversación por texto cuando se abra.</p> : null}
      </div>
    </section>
  );
}

function isSessionResponse(value: unknown): value is { sessionToken: string } {
  return typeof value === "object" && value !== null && "sessionToken" in value && typeof value.sessionToken === "string";
}
