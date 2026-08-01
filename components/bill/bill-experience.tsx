"use client";

import { useState } from "react";

import { BeneBotPanel } from "@/components/voice/benebot-panel";
import type { Language } from "@/lib/contracts";

export function BillExperience({ invoiceIdentifier, language }: { invoiceIdentifier: string; language: Language }) {
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
        throw new Error(language === "es" ? "BeneBot no pudo iniciar la sesión segura de demostración." : "BeneBot could not start the secure demo session.");
      }
      setSessionToken(body.sessionToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : language === "es" ? "BeneBot no pudo iniciar la sesión segura de demostración." : "BeneBot could not start the secure demo session.");
    } finally {
      setIsStarting(false);
    }
  }

  if (sessionToken) {
    return (
      <div id="benebot-demo">
        <BeneBotPanel sessionToken={sessionToken} initialLanguage={language} onClose={() => setSessionToken(undefined)} />
      </div>
    );
  }

  return (
    <section id="benebot-demo" className="conversation-launch" aria-labelledby="conversation-title">
      <div>
        <p className="eyebrow">{language === "es" ? "¿Necesita ayuda?" : "Need help?"}</p>
        <h2 id="conversation-title">{language === "es" ? "Hable de esta factura con BeneBot." : "Talk through this bill with BeneBot."}</h2>
        <p>{language === "es" ? "Pregunte por qué debe $620, pida una consulta separada de sus beneficios actuales o solicite una revisión de facturación. Puede escribir o hablar en español; también se admite inglés." : "Ask why you owe $620, request a separate current-benefits check, or ask for a billing review. You can type or speak in English; Spanish is also supported."}</p>
      </div>
      <div className="conversation-actions">
        <button className="button button-primary" type="button" onClick={startConversation} disabled={isStarting}>
          {isStarting ? language === "es" ? "Iniciando sesión segura…" : "Starting secure session…" : language === "es" ? "Hablar sobre esta factura" : "Talk about this bill"}
        </button>
        <p className="translation-line">{language === "es" ? "No necesita proporcionar datos de identificación otra vez." : "You do not need to provide identifying information again."}</p>
        {error ? <p className="form-error" role="alert">{error} {language === "es" ? "Puede intentar la conversación por texto cuando se abra." : "You can try the text conversation when it opens."}</p> : null}
      </div>
    </section>
  );
}

function isSessionResponse(value: unknown): value is { sessionToken: string } {
  return typeof value === "object" && value !== null && "sessionToken" in value && typeof value.sessionToken === "string";
}
