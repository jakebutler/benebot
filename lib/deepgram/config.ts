import type { AgentProviderProps } from "@deepgram/ui";

import { BENEBOT_AGENT_PROMPT } from "./prompt";
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
  language_hints: ["es", "en"];
  keyterms: string[];
}

export function createDeepgramAgentConfig(
  tokenFactory: () => Promise<string>,
): AgentProviderProps["config"] {
  const listenProvider: FluxMultilingualListenProvider = {
    type: "deepgram",
    version: "v2",
    model: "flux-general-multi",
    language_hints: ["es", "en"],
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
        prompt: BENEBOT_AGENT_PROMPT,
        functions: DEEPGRAM_TOOL_DEFINITIONS,
      },
      speak: {
        provider: {
          type: "deepgram",
          model: "aura-2-selena-es",
        },
      },
      greeting:
        "Hola, Jane. Soy BeneBot. Como abriste BeneBot desde tu portal seguro, ya tengo el contexto de esta factura. No te pediré tu número de Seguro Social, fecha de nacimiento, número de miembro ni identificación de paciente. Puedo explicar esta factura en español; English is also available.",
    },
    audio: {
      input: { encoding: "linear16", sampleRate: 16_000 },
      output: { encoding: "linear16", sampleRate: 24_000 },
    },
    reconnect: { maxAttempts: 1 },
    tags: ["benebot", "synthetic-demo"],
  };
}
