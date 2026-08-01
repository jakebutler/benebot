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

  it("returns real government Medicare help for a Medicare billing problem", async () => {
    const provider = new LocalJsonSupportResourceProvider();
    const result = await provider.search({ need: "medicare-billing-problem", language: "en", limit: 3 });

    expect(result.resources.map((resource) => resource.id)).toEqual([
      "medicare-1800",
      "ship-medicare-counseling",
      "qmb-improper-billing",
    ]);
    // These are the one tier that must not carry a fictional-demo label, because
    // a patient may actually dial them.
    for (const resource of result.resources) {
      expect(resource.sourceType).toBe("government-program");
      expect(resource.verification).toBe("government-published");
      expect(resource.phone).toBeTruthy();
    }
  });

  it("keeps the Spanish government instructions available", async () => {
    const provider = new LocalJsonSupportResourceProvider();
    const result = await provider.search({ need: "medicare-billing-problem", language: "es", limit: 1 });
    expect(result.resources[0]?.phone).toBe("1-800-633-4227");
    expect(result.resources[0]?.instructions?.[1]).toContain("español");
  });
});
