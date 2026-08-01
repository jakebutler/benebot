import type { AgentProviderProps } from "@deepgram/ui";

import type { Language } from "@/lib/contracts";

import { createBeneBotAgentPrompt } from "./prompt";
import { DEEPGRAM_TOOL_DEFINITIONS } from "./tools";

export const BENEBOT_FLUX_KEYTERMS = [
  "deductible",
  "coinsurance",
  "adjudication",
  "MRI",
  "lumbar",
  "deducible",
  "coaseguro",
  "monto permitido",
  "resonancia magnetica",
] as const;

// Deepgram's current Flux V2 API accepts language_hints. The Voice Agent SDK's
// generated provider type has not exposed that documented field yet, so keep
// this one compatibility addition isolated and structurally typed.
interface FluxMultilingualListenProvider {
  type: "deepgram";
  version: "v2";
  model: "flux-general-multi";
  language_hints: [Language, Language];
  keyterms: string[];
}

export function createDeepgramAgentConfig(
  tokenFactory: () => Promise<string>,
  language: Language = "es",
): AgentProviderProps["config"] {
  const listenProvider: FluxMultilingualListenProvider = {
    type: "deepgram",
    version: "v2",
    model: "flux-general-multi",
    // Keep the selected session language first for accuracy while allowing
    // Flux to identify either supported BeneBot language in every session.
    language_hints: language === "es" ? ["es", "en"] : ["en", "es"],
    keyterms: [...BENEBOT_FLUX_KEYTERMS],
  };

  return {
    auth: { tokenFactory },
    agent: {
      listen: {
        provider: listenProvider,
      },
      think: {
        provider: {
          type: "open_ai",
          model: "gpt-4o-mini",
          temperature: 0.2,
        },
        prompt: createBeneBotAgentPrompt(language),
        functions: DEEPGRAM_TOOL_DEFINITIONS,
      },
      speak: {
        provider: {
          type: "deepgram",
          model: language === "es" ? "aura-2-selena-es" : "aura-2-helena-en",
        },
      },
      greeting: language === "es"
        ? "Hola, Jane. Soy BeneBot. Como abrió BeneBot desde su portal seguro, ya tengo el contexto de esta factura. No le pediré su número de Seguro Social, fecha de nacimiento, número de miembro ni identificación de paciente. Puedo explicar cómo se procesó esta factura y revisar por separado los beneficios que su plan devuelve hoy."
        : "Hi, Jane. I'm BeneBot. Because you opened BeneBot from your secure portal, I already have the context for this bill. I won't ask for your Social Security number, date of birth, member ID, or patient ID. I can explain how this bill was processed and separately check the benefits your plan returns today.",
    },
    audio: {
      input: { encoding: "linear16", sampleRate: 16_000 },
      output: { encoding: "linear16", sampleRate: 24_000 },
    },
    reconnect: { maxAttempts: 1 },
    tags: ["benebot", "synthetic-demo"],
  };
}
