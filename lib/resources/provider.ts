import { z } from "zod";

import type { SearchResourcesResult, SupportNeed, SupportResource } from "@/lib/contracts";
import resourcesFixture from "@/data/demo-resources.json";

const resourceFixtureSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    organization: z.string(),
    needs: z.array(z.string()),
    languages: z.array(z.enum(["en", "es"])),
    type: z.string(),
    sourceType: z.enum(["practice-policy", "fictional-demo-provider", "community-reported"]),
    verification: z.enum(["practice-provided", "fictional-demo-data", "unverified"]),
    demo: z.literal(true),
    phone: z.string().optional(),
    url: z.string().url().optional(),
    summary: z.object({ en: z.string(), es: z.string() }),
    instructions: z.object({ en: z.array(z.string()), es: z.array(z.string()) }),
    disclosure: z.string(),
    priority: z.number(),
  }),
);

type FixtureResource = z.infer<typeof resourceFixtureSchema>[number];

export interface SupportResourceProvider {
  search(input: { need: SupportNeed; language: "en" | "es"; limit: number }): Promise<SearchResourcesResult>;
}

const sourceRank: Record<FixtureResource["sourceType"], number> = {
  "practice-policy": 0,
  "fictional-demo-provider": 1,
  "community-reported": 2,
};

function toSupportResource(resource: FixtureResource, language: "en" | "es"): SupportResource {
  return {
    id: resource.id,
    name: resource.name,
    organization: resource.organization,
    type: resource.type,
    summary: resource.summary[language],
    phone: resource.phone,
    url: resource.url,
    instructions: resource.instructions[language],
    sourceType: resource.sourceType,
    verification: resource.verification,
    disclosure: resource.disclosure,
  };
}

export class LocalJsonSupportResourceProvider implements SupportResourceProvider {
  private readonly resources = resourceFixtureSchema.parse(resourcesFixture);

  async search(input: { need: SupportNeed; language: "en" | "es"; limit: number }): Promise<SearchResourcesResult> {
    const limit = Math.min(Math.max(1, input.limit), 3);
    const resources = this.resources
      .filter((resource) => resource.needs.includes(input.need) && resource.languages.includes(input.language))
      .sort((a, b) => sourceRank[a.sourceType] - sourceRank[b.sourceType] || b.priority - a.priority)
      .slice(0, limit)
      .map((resource) => toSupportResource(resource, input.language));

    return {
      query: `${input.need} (${input.language})`,
      provider: "local-json",
      resources,
    };
  }
}

export const localSupportResourceProvider = new LocalJsonSupportResourceProvider();
