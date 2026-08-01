import { describe, expect, it } from "vitest";

import { LocalJsonSupportResourceProvider } from "@/lib/resources/provider";

describe("local support resources", () => {
  it("puts practice-provided resources first", async () => {
    const provider = new LocalJsonSupportResourceProvider();
    const result = await provider.search({ need: "billing-advocate", language: "en", limit: 3 });
    expect(result.provider).toBe("local-json");
    expect(result.resources[0]).toMatchObject({ id: "billing-review", sourceType: "practice-policy" });
  });

  it("selects the requested language and preserves unverified labels", async () => {
    const provider = new LocalJsonSupportResourceProvider();
    const result = await provider.search({ need: "payer-contact", language: "es", limit: 3 });
    expect(result.resources[0]).toMatchObject({
      id: "aetna-test-member-services",
      verification: "unverified",
      sourceType: "community-reported",
    });
    expect(result.resources[0]?.summary).toContain("ficticio");
  });
});
