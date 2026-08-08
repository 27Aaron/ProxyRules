import { describe, expect, it } from "vitest"

import { isReservedCategory, parseManifest } from "@/lib/catalog"

describe("rules catalog", () => {
  it("reduces manifest v2 categories into searchable entries", () => {
    const entries = parseManifest({
      schema_version: 2,
      collections: {
        ruleset: {
          categories: {
            netflix: {
              formats: {
                list: {
                  path: "ruleset/netflix/netflix.list",
                  rules: 42,
                  counts: { domain_suffix: 30, ipv4: 12 },
                },
              },
            },
            "google@ads": {
              formats: {
                list: {
                  path: "ruleset/google@ads/google@ads.list",
                  rules: 3,
                  counts: { domain: 3 },
                },
              },
            },
          },
        },
      },
    })

    expect(entries).toEqual([
      expect.objectContaining({
        id: "google@ads",
        attribute: true,
        kind: "domain",
      }),
      expect.objectContaining({
        id: "netflix",
        path: "ruleset/netflix/netflix.list",
        rules: 42,
        kind: "mixed",
      }),
    ])
  })

  it("marks infrastructure and action categories as reserved", () => {
    expect(
      isReservedCategory({
        id: "private",
        label: "Private",
        path: "ruleset/private/private.list",
        rules: 1,
        kind: "mixed",
        attribute: false,
      })
    ).toBe(true)
    expect(
      isReservedCategory({
        id: "custom-action",
        label: "Custom Action",
        path: "ruleset/custom-action/custom-action.list",
        rules: 1,
        kind: "domain",
        attribute: false,
        action: "direct",
      })
    ).toBe(true)
  })

  it("rejects unsupported manifest versions", () => {
    expect(() => parseManifest({ schema_version: 1 })).toThrow(
      "暂不支持该规则清单版本"
    )
  })
})
