import type { AgentProviderProps } from "@deepgram/ui";

import { BENEBOT_AGENT_PROMPT } from "./prompt";
import { DEEPGRAM_TOOL_DEFINITIONS } from "./tools";

export function createDeepgramAgentConfig(
  tokenFactory: () => Promise<string>,
): AgentProviderProps["config"] {
  return {
    auth: { tokenFactory },
    agent: {
      listen: {
        provider: {
          type: "deepgram",
          version: "v2",
          model: "flux-general-multi",
        },
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
        "Hi, I'm BeneBot. I can explain this bill and help with next steps. Would you prefer English or Spanish?",
    },
    audio: {
      input: { encoding: "linear16", sampleRate: 16_000 },
      output: { encoding: "linear16", sampleRate: 24_000 },
    },
    reconnect: { maxAttempts: 1 },
    tags: ["benebot", "synthetic-demo"],
  };
}
