import { describe, expect, it, vi } from "vitest";

import {
  BENEBOT_FLUX_KEYTERMS,
  createDeepgramAgentConfig,
} from "../../lib/deepgram/config";

describe("Spanish-first Deepgram configuration", () => {
  it("uses a Spanish recognition hint and native Spanish voice", () => {
    const config = createDeepgramAgentConfig(vi.fn(async () => "short-lived-token"));
    expect(config.agent).not.toBeTypeOf("string");
    if (typeof config.agent === "string") throw new Error("Expected inline settings");

    expect(config.agent.listen?.provider).toMatchObject({
      type: "deepgram",
      version: "v2",
      model: "flux-general-multi",
      language_hints: ["es"],
      keyterms: [...BENEBOT_FLUX_KEYTERMS],
    });
    expect(config.agent.speak?.provider).toMatchObject({
      type: "deepgram",
      model: "aura-2-selena-es",
    });
    expect(config.agent.greeting).toContain("Hola, Jane");
    expect(config.agent.greeting?.toLowerCase()).toContain("no le pediré");
    expect(config.agent.greeting).not.toContain("tu portal");
  });

  it("uses an English recognition hint, native English voice, and English-only prompt", () => {
    const config = createDeepgramAgentConfig(
      vi.fn(async () => "short-lived-token"),
      "en",
    );
    expect(config.agent).not.toBeTypeOf("string");
    if (typeof config.agent === "string") throw new Error("Expected inline settings");

    expect(config.agent.listen?.provider).toMatchObject({
      model: "flux-general-multi",
      language_hints: ["en"],
    });
    expect(config.agent.speak?.provider).toMatchObject({
      type: "deepgram",
      model: "aura-2-helena-en",
    });
    expect(config.agent.greeting).toContain("Hi, Jane");
    expect(config.agent.think?.prompt).toContain("Always respond in English");
  });
});
