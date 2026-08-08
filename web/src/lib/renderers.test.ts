import { describe, expect, it } from "vitest"
import { parse } from "yaml"

import {
  buildStrategyGroups,
  getSelectedCategoryIds,
  renderConfig,
  validateState,
} from "@/lib/renderers"
import {
  DEFAULT_STATE,
  REGIONS,
  type ClientId,
  type ConfiguratorState,
} from "@/lib/types"

function state(overrides: Partial<ConfiguratorState> = {}): ConfiguratorState {
  return {
    ...structuredClone(DEFAULT_STATE),
    ...overrides,
  }
}

function fullState(client: ClientId): ConfiguratorState {
  const value = state({
    client,
    regions: REGIONS.map((region) => region.id),
    featuredGroups: ["ai", "ip-attribution"],
    customGroups: [
      {
        categoryId: "netflix",
        name: "Netflix",
        path: "ruleset/netflix/netflix.list",
        rules: 120,
        kind: "mixed",
      },
    ],
  })
  return value
}

describe("renderConfig", () => {
  it("renders a valid minimal Mihomo YAML document", () => {
    const result = renderConfig(state())
    const document = parse(result.content)

    expect(result.fileName).toBe("Clash.yaml")
    expect(document["mixed-port"]).toBe(7890)
    expect(document["proxy-groups"][0].proxies).toEqual(["Manual"])
    expect(
      document["proxy-groups"].map((group: { name: string }) => group.name)
    ).toEqual(["Proxies", "Manual", "Final"])
    expect(result.content).not.toContain('name: "HKG"')
    expect(result.content).toContain("category-ads-all@ads")
    expect(result.content).toContain("MATCH,Final")
  })

  it.each(["mihomo", "surge", "loon", "shadowrocket"] as const)(
    "keeps IP attribution actions ordered for %s",
    (client) => {
      const content = renderConfig(fullState(client)).content
      const section = content.match(/# > IP Attribution/g) ?? []
      const adsSection = content.indexOf("# > Reject")
      const privateSection = content.indexOf("# > Private")
      const attributionSection = content.indexOf("# > IP Attribution")
      const reject = content.indexOf("ip-attribution-reject")
      const direct = content.indexOf("ip-attribution-direct")
      const proxy = content.indexOf("ruleset/ip-attribution/ip-attribution.list")

      expect(section).toHaveLength(1)
      expect(adsSection).toBeGreaterThan(-1)
      expect(privateSection).toBeGreaterThan(adsSection)
      expect(attributionSection).toBeGreaterThan(privateSection)
      expect(reject).toBeGreaterThan(-1)
      expect(direct).toBeGreaterThan(reject)
      expect(proxy).toBeGreaterThan(direct)
      expect(content).toContain("Netflix")
      expect(content).toContain("ruleset/openai/openai.list")
      expect(content).not.toContain("dns-failed")
      expect(content.endsWith("\n")).toBe(true)
    }
  )

  it("builds Other independently from selected known regions", () => {
    const value = state({ client: "mihomo", regions: ["Other"] })
    const content = renderConfig(value).content

    expect(content).toContain('name: "Other"')
    expect(content).toContain("exclude-filter")
    expect(content).toContain("Hong.?Kong")
    expect(content).toContain("Singapore")
    expect(content).toContain("Korea")
    expect(content).not.toContain('name: "HKG"')
  })

  it("uses complete classical rulesets for Mihomo mixed rules", () => {
    const content = renderConfig(fullState("mihomo")).content

    expect(content).toContain("behavior: classical")
    expect(content).toContain("format: text")
    expect(content).toContain("ruleset/netflix/netflix.list")
    expect(content).not.toContain(".mrs")
  })

  it("writes shared DNS settings using each client syntax", () => {
    const settings = {
      ...DEFAULT_STATE.settings,
      dnsServers: "1.1.1.1, 8.8.8.8",
      dohServers: "https://dns.example/dns-query",
    }

    expect(renderConfig(state({ settings })).content).toContain(
      'default-nameserver: ["1.1.1.1","8.8.8.8"]'
    )
    expect(
      renderConfig(state({ client: "surge", settings })).content
    ).toContain("encrypted-dns-server = https://dns.example/dns-query")
    expect(renderConfig(state({ client: "loon", settings })).content).toContain(
      "doh-server = https://dns.example/dns-query"
    )
    const shadowrocket = renderConfig(
      state({ client: "shadowrocket", settings })
    ).content
    expect(shadowrocket).toContain(
      "dns-server = system, 1.1.1.1, 8.8.8.8, https://dns.example/dns-query"
    )
    expect(shadowrocket).not.toContain("doh-server =")
  })
})

describe("strategy model", () => {
  it("expands the AI bundle and tracks selected categories", () => {
    const value = state({ featuredGroups: ["ai"] })
    const [ai] = buildStrategyGroups(value)
    const selected = getSelectedCategoryIds(value)

    expect(ai.categories.map((category) => category.id)).toEqual([
      "anthropic",
      "google-gemini",
      "openai",
      "xai",
    ])
    expect(selected.has("openai")).toBe(true)
    expect(selected.has("netflix")).toBe(false)
  })

  it("reports invalid URLs and duplicate policy names", () => {
    const value = state({
      featuredGroups: ["google"],
      groupNames: { ...DEFAULT_STATE.groupNames, google: "Final" },
      settings: { ...DEFAULT_STATE.settings, ruleBaseUrl: "not-a-url" },
    })

    expect(validateState(value)).toEqual(
      expect.arrayContaining([
        "策略组名称不能重复",
        "规则地址必须是有效的 HTTP 或 HTTPS 地址",
      ])
    )
  })

  it("reports policy names that would need silent sanitization", () => {
    const value = state({
      featuredGroups: ["google"],
      groupNames: { ...DEFAULT_STATE.groupNames, google: "Google, Backup" },
    })

    expect(validateState(value)).toContain(
      "策略组名称不能为空，也不能包含逗号或换行"
    )
  })

  it("rejects empty DNS and non-HTTPS DoH settings", () => {
    const value = state({
      settings: {
        ...DEFAULT_STATE.settings,
        dnsServers: "",
        dohServers: "http://dns.example/dns-query",
      },
    })

    expect(validateState(value)).toEqual(
      expect.arrayContaining([
        "至少需要填写一个 DNS 服务器",
        "加密 DNS 必须包含至少一个有效的 HTTPS 地址",
      ])
    )
  })
})
