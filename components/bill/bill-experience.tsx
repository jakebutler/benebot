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
        throw new Error("BeneBot could not start the secure demo session.");
      }
      setSessionToken(body.sessionToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "BeneBot could not start the secure demo session.");
    } finally {
      setIsStarting(false);
    }
  }

  if (sessionToken) return <BeneBotPanel sessionToken={sessionToken} onClose={() => setSessionToken(undefined)} />;

  return (
    <section className="conversation-launch" aria-labelledby="conversation-title">
      <div>
        <p className="eyebrow">Need a hand?</p>
        <h2 id="conversation-title">Talk through this statement with BeneBot.</h2>
        <p>Ask why you owe $620, refresh the plan information returned today, or find billing support.</p>
      </div>
      <div className="conversation-actions">
        <button className="button button-primary" type="button" onClick={startConversation} disabled={isStarting}>
          {isStarting ? "Starting secure session…" : "I wanna talk about this"}
        </button>
        <p className="translation-line" lang="es">También puede escribir o hablar en español.</p>
        {error ? <p className="form-error" role="alert">{error} Try the text-only conversation when it opens.</p> : null}
      </div>
    </section>
  );
}

function isSessionResponse(value: unknown): value is { sessionToken: string } {
  return typeof value === "object" && value !== null && "sessionToken" in value && typeof value.sessionToken === "string";
}
