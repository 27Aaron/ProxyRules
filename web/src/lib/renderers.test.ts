import { describe, expect, it } from "vitest"
import { parse } from "yaml"

import {
  buildStrategyGroups,
  getSelectedCategoryIds,
  renderConfig,
  validateState,
} from "@/lib/renderers"
import {
  DEFAULT_SETTINGS,
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

function validState(client: ClientId): ConfiguratorState {
  const value = state({ client })
  value.settings.mihomo.proxyProviderUrl =
    "https://example.com/mihomo-provider.yaml"
  value.settings.surge.proxyListUrl = "https://example.com/surge-proxies.conf"
  value.settings.loon.subscriptionUrl =
    "https://example.com/loon-subscription.list"
  return value
}

function fullState(client: ClientId): ConfiguratorState {
  const value = validState(client)
  value.regions = REGIONS.map((region) => region.id)
  value.featuredGroups = ["ai", "ip-attribution"]
  value.customGroups = [
    {
      categoryId: "netflix",
      name: "Netflix",
      path: "ruleset/netflix/netflix.list",
      rules: 120,
      kind: "mixed",
    },
  ]
  return value
}

function matchingLine(content: string, prefix: string) {
  return content.split("\n").find((line) => line.startsWith(prefix)) ?? ""
}

describe("version 2 defaults", () => {
  it("uses the documented safe and portable defaults", () => {
    expect(DEFAULT_STATE.version).toBe(2)
    expect(DEFAULT_SETTINGS).toMatchObject({
      internetTestUrl: "https://cp.cloudflare.com/generate_204",
      proxyTestUrl: "https://www.gstatic.com/generate_204",
      groupTestInterval: 600,
      groupTolerance: 100,
      timeoutSeconds: 5,
      mihomo: {
        allowLan: false,
        proxyProviderUrl: "",
        tunStack: "mixed",
        strictRoute: false,
        respectDnsRules: false,
        sniffer: false,
      },
      surge: {
        proxyListUrl: "",
        includeSystemDns: true,
        encryptedDnsFollowOutboundMode: false,
        udpPriority: false,
        evaluateBeforeUse: false,
      },
      loon: {
        subscriptionName: "Subscription",
        subscriptionUrl: "",
        interfaceMode: "Auto",
        includeSystemDns: true,
        hijackDns: false,
        disableStun: false,
        udpFallbackMode: "REJECT",
        realIp: "*.apple.com, *.icloud.com",
      },
      shadowrocket: {
        subscriptionNames: "",
        fallbackDnsServers: "system",
        hijackDns: false,
        excludeCgnat: false,
      },
    })
  })
})

describe("Mihomo rendering", () => {
  it("renders a provider-backed YAML configuration with safe group semantics", () => {
    const value = fullState("mihomo")
    value.regions = ["JPN"]
    value.settings.mihomo = {
      ...value.settings.mihomo,
      allowLan: true,
      lanAllowedIps: "10.0.0.0/8, 192.168.0.0/16",
      tunStack: "gvisor",
      strictRoute: true,
      respectDnsRules: true,
      sniffer: true,
    }

    const result = renderConfig(value)
    const document = parse(result.content)
    const groups = document["proxy-groups"] as Array<Record<string, unknown>>
    const subscription = document["proxy-providers"].Subscription

    expect(result.fileName).toBe("Clash.yaml")
    expect(document["allow-lan"]).toBe(true)
    expect(document["lan-allowed-ips"]).toEqual([
      "10.0.0.0/8",
      "192.168.0.0/16",
    ])
    expect(document.tun).toMatchObject({
      stack: "gvisor",
      "strict-route": true,
    })
    expect(document.sniffer.enable).toBe(true)
    expect(document.dns).toMatchObject({
      "fake-ip-filter-mode": "rule",
      "respect-rules": true,
    })
    expect(document.dns["fake-ip-filter"]).toEqual(
      expect.arrayContaining([
        "DOMAIN-SUFFIX,lan,real-ip",
        "DOMAIN-SUFFIX,local,real-ip",
        "RULE-SET,private,real-ip",
        "MATCH,fake-ip",
      ])
    )
    expect(subscription).toMatchObject({
      type: "http",
      url: "https://example.com/mihomo-provider.yaml",
      interval: 86400,
      "health-check": {
        enable: true,
        url: "https://www.gstatic.com/generate_204",
        interval: 600,
        timeout: 5000,
        lazy: true,
        "expected-status": 204,
      },
    })
    expect(groups.find((group) => group.name === "Manual")?.use).toEqual([
      "Subscription",
    ])
    expect(groups.find((group) => group.name === "JPN")).toMatchObject({
      type: "url-test",
      use: ["Subscription"],
      interval: 600,
      tolerance: 100,
      timeout: 5000,
      "expected-status": 204,
    })

    for (const group of groups.filter((item) => item.type === "select")) {
      expect(group).not.toHaveProperty("url")
      expect(group).not.toHaveProperty("interval")
      expect(group).not.toHaveProperty("tolerance")
      expect(group).not.toHaveProperty("timeout")
    }
  })

  it("does not expose LAN allowlists while LAN access is disabled", () => {
    const document = parse(renderConfig(validState("mihomo")).content)

    expect(document["allow-lan"]).toBe(false)
    expect(document).not.toHaveProperty("lan-allowed-ips")
  })

  it("builds Other independently from selected known regions", () => {
    const value = validState("mihomo")
    value.regions = ["Other"]
    const content = renderConfig(value).content

    expect(content).toContain('name: "Other"')
    expect(content).toContain("exclude-filter")
    expect(content).toContain("Hong.?Kong")
    expect(content).toContain("Singapore")
    expect(content).toContain("Korea")
    expect(content).not.toContain('name: "HKG"')
  })

  it("uses complete classical text rulesets", () => {
    const content = renderConfig(fullState("mihomo")).content

    expect(content).toContain("behavior: classical")
    expect(content).toContain("format: text")
    expect(content).toContain("ruleset/netflix/netflix.list")
    expect(content).not.toContain(".mrs")
  })
})

describe("Surge rendering", () => {
  it("renders policy-path, optional behaviours, and the disabled IPv6 VIF", () => {
    const value = validState("surge")
    value.regions = ["USA"]
    value.settings.ipv6 = false
    value.settings.surge = {
      ...value.settings.surge,
      includeSystemDns: false,
      encryptedDnsFollowOutboundMode: true,
      udpPriority: true,
      evaluateBeforeUse: true,
    }

    const content = renderConfig(value).content
    const manual = matchingLine(content, "Manual = ")
    const region = matchingLine(content, "USA = ")

    expect(content).toContain("ipv6 = false")
    expect(content).toContain("ipv6-vif = off")
    expect(content).toContain("dns-server = 223.5.5.5, 119.29.29.29")
    expect(content).not.toContain("dns-server = system")
    expect(content).toContain("encrypted-dns-follow-outbound-mode = true")
    expect(content).toContain("udp-priority = true")
    expect(manual).toBe(
      "Manual = select, policy-path=https://example.com/surge-proxies.conf, update-interval=86400"
    )
    expect(manual).not.toContain("tolerance")
    expect(manual).not.toContain("evaluate-before-use")
    expect(region).toContain("url=https://www.gstatic.com/generate_204")
    expect(region).toContain("interval=600")
    expect(region).toContain("tolerance=100")
    expect(region).toContain("evaluate-before-use=true")
    expect(content).toContain("PROTOCOL,DOH,Proxies")
    expect(content).toContain("PROTOCOL,DOH3,Proxies")
    expect(content).toContain("PROTOCOL,DOQ,Proxies")
    expect(content).not.toMatch(/^\[Host\]$/m)
  })

  it("keeps system DNS and omits opt-in behaviours by default", () => {
    const content = renderConfig(validState("surge")).content

    expect(content).toContain("dns-server = system, 223.5.5.5, 119.29.29.29")
    expect(content).toContain("ipv6-vif = auto")
    expect(content).not.toContain("encrypted-dns-follow-outbound-mode")
    expect(content).not.toContain("udp-priority")
    expect(content).not.toContain("evaluate-before-use")
  })

  it("renders a DIRECT-only preview until a node list is configured", () => {
    const value = state({ client: "surge" })
    value.regions = ["JPN"]
    const content = renderConfig(value).content

    expect(matchingLine(content, "Manual = ")).toBe("Manual = select, DIRECT")
    expect(matchingLine(content, "JPN = ")).toBe("JPN = select, DIRECT")
    expect(content).not.toContain("policy-path=")
  })
})

describe("Loon rendering", () => {
  it("uses documented enums, a real subscription source, and protocol-specific DNS keys", () => {
    const value = validState("loon")
    value.regions = ["JPN"]
    value.settings.ipv6 = false
    value.settings.dohServers =
      "https://dns.example/dns-query, h3://h3.example/dns-query, quic://doq.example"
    value.settings.loon = {
      ...value.settings.loon,
      subscriptionName: "Primary",
      interfaceMode: "Balance",
      includeSystemDns: false,
      hijackDns: true,
      disableStun: true,
      udpFallbackMode: "DIRECT",
      realIp: "*.apple.com, *.icloud.com, time.apple.com",
    }

    const content = renderConfig(value).content

    expect(content).toContain("ip-mode = ipv4-only")
    expect(content).toContain("interface-mode = Balance")
    expect(content).toContain("dns-server = 223.5.5.5, 119.29.29.29")
    expect(content).not.toContain("dns-server = system")
    expect(content).toContain("doh-server = https://dns.example/dns-query")
    expect(content).toContain("doh3-server = h3://h3.example/dns-query")
    expect(content).toContain("doq-server = quic://doq.example")
    expect(content).toContain(
      "real-ip = *.apple.com, *.icloud.com, time.apple.com"
    )
    expect(content).toContain("hijack-dns = *:53")
    expect(content).toContain("disable-stun = true")
    expect(content).toContain("udp-fallback-mode = DIRECT")
    expect(content).toContain(
      "Primary = https://example.com/loon-subscription.list"
    )
    expect(content).toContain(
      'ALL_Filter = NameRegex,Primary, FilterKey = ".*"'
    )
    expect(content).toContain("JPN_Filter = NameRegex,Primary")
    expect(matchingLine(content, "Manual = ")).toBe(
      "Manual = select,ALL_Filter"
    )
    expect(content).not.toContain("sni-sniffing")
    expect(content).not.toContain("allow-udp-proxy")
    expect(content).not.toContain("tag=")
    expect(content).not.toMatch(/^\[Proxy\]$/m)
    expect(content).not.toMatch(/^\[(Rewrite|Script|MITM)\]$/m)
  })

  it("renders a DIRECT-only preview until a subscription is configured", () => {
    const value = state({ client: "loon" })
    value.regions = ["JPN"]
    const content = renderConfig(value).content

    expect(matchingLine(content, "Manual = ")).toBe("Manual = select,DIRECT")
    expect(matchingLine(content, "JPN = ")).toBe("JPN = select,DIRECT")
    expect(content).not.toMatch(/^\[(Remote Proxy|Remote Filter)\]$/m)
    expect(content).not.toContain("Subscription =")
  })
})

describe("Shadowrocket rendering", () => {
  it("uses native subscription filters and keeps encrypted DNS separate from fallback DNS", () => {
    const value = validState("shadowrocket")
    value.regions = ["HKG"]
    value.settings.dnsServers = "1.1.1.1, 8.8.8.8"
    value.settings.dohServers = "https://dns.example/dns-query"
    value.settings.shadowrocket = {
      ...value.settings.shadowrocket,
      subscriptionNames: "Primary, Backup",
      fallbackDnsServers: "system",
      hijackDns: true,
    }

    const content = renderConfig(value).content
    const excludedRoutes = matchingLine(content, "tun-excluded-routes = ")

    expect(content).toContain("dns-server = https://dns.example/dns-query")
    expect(content).toContain("fallback-dns-server = system")
    expect(content).toContain("hijack-dns = :53")
    expect(content).toContain(
      "Manual = select, Primary, Backup, use=true, policy-regex-filter=.*"
    )
    expect(matchingLine(content, "HKG = ")).toContain(
      "Primary, Backup, use=true"
    )
    expect(matchingLine(content, "HKG = ")).toContain("policy-regex-filter=")
    expect(excludedRoutes).not.toContain("100.64.0.0/10")
    expect(content).not.toContain("bypass-system")
    expect(content).not.toContain("include-all-proxies")
    expect(content).not.toContain("include-other-group")
    expect(content).not.toContain("test-timeout")
    expect(content).not.toContain("internet-test-url")
    expect(content).not.toMatch(/^\[(Host|URL Rewrite|MITM)\]$/m)
  })

  it("only excludes CGNAT routes when explicitly enabled", () => {
    const value = validState("shadowrocket")
    value.settings.shadowrocket.excludeCgnat = true

    expect(
      matchingLine(renderConfig(value).content, "tun-excluded-routes = ")
    ).toContain("100.64.0.0/10")
  })
})

describe("shared rule and strategy model", () => {
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
      const proxy = content.indexOf(
        "ruleset/ip-attribution/ip-attribution.list"
      )

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
})

describe("validation", () => {
  it.each(["mihomo", "surge", "loon", "shadowrocket"] as const)(
    "accepts a valid %s configuration",
    (client) => {
      expect(validateState(validState(client))).toEqual([])
    }
  )

  it.each([
    ["mihomo", "Mihomo 节点订阅地址必须是有效的 HTTP 或 HTTPS 地址"],
    ["surge", "Surge 节点列表地址必须是有效的 HTTP 或 HTTPS 地址"],
    ["loon", "Loon 节点订阅地址必须是有效的 HTTP 或 HTTPS 地址"],
  ] as const)("requires a valid node source for %s", (client, error) => {
    expect(validateState(state({ client }))).toContain(error)
  })

  it.each([
    [
      "mihomo",
      "ftp://dns.example",
      "Mihomo 加密 DNS 仅支持 HTTPS、HTTP/3、QUIC 或 TLS URI",
    ],
    [
      "surge",
      "ftp://dns.example",
      "Surge 加密 DNS 仅支持 HTTPS、HTTP/3、QUIC 或 TLS URI",
    ],
    [
      "loon",
      "tls://dns.example",
      "Loon 加密 DNS 仅支持 HTTPS、HTTP/3 或 QUIC URI",
    ],
    [
      "shadowrocket",
      "ftp://dns.example",
      "Shadowrocket 加密 DNS 仅支持 HTTPS、HTTP/3、QUIC 或 TLS URI",
    ],
  ] as const)(
    "rejects unsupported encrypted DNS protocols for %s",
    (client, dohServers, error) => {
      const value = validState(client)
      value.settings.dohServers = dohServers

      expect(validateState(value)).toContain(error)
    }
  )

  it("requires a valid and secured external controller", () => {
    const malformed = validState("mihomo")
    malformed.settings.mihomo.externalController = "127.0.0.1"
    expect(validateState(malformed)).toContain(
      "Mihomo External Controller 必须使用 host:port 格式"
    )

    const exposed = validState("mihomo")
    exposed.settings.mihomo.externalController = "0.0.0.0:9090"
    exposed.settings.mihomo.secret = ""
    expect(validateState(exposed)).toContain(
      "Mihomo External Controller 非本机地址时必须设置 Secret"
    )

    exposed.settings.mihomo.secret = "strong-secret"
    expect(validateState(exposed)).not.toContain(
      "Mihomo External Controller 非本机地址时必须设置 Secret"
    )
  })

  it("rejects duplicate and configuration-breaking policy names", () => {
    const duplicate = validState("mihomo")
    duplicate.featuredGroups = ["google"]
    duplicate.groupNames.google = "Final"
    expect(validateState(duplicate)).toContain("策略组名称不能重复")

    duplicate.groupNames.google = "Google=REJECT"
    expect(validateState(duplicate)).toContain(
      "策略组名称不能为空，也不能包含逗号、等号、注释符或换行"
    )
  })

  it("validates Loon aliases and Mihomo bootstrap DNS semantics", () => {
    const loon = validState("loon")
    loon.settings.loon.subscriptionName = "Primary#Injected"
    expect(validateState(loon)).toContain(
      "Loon 订阅别名不能为空，也不能包含配置分隔符或注释符"
    )

    const mihomo = validState("mihomo")
    mihomo.settings.dnsServers = "dns.example.com"
    expect(validateState(mihomo)).toContain(
      "Mihomo 默认 DNS 只能使用 IP 地址或支持的加密 DNS URI"
    )
  })

  it.each([
    ["surge", "Surge 普通 DNS 只能使用 system 或 IP 地址"],
    ["loon", "Loon 普通 DNS 只能使用 system 或 IP 地址"],
    ["shadowrocket", "Shadowrocket 普通 DNS 只能使用 system 或 IP 地址"],
  ] as const)("rejects hostname-based plain DNS for %s", (client, error) => {
    const value = validState(client)
    value.settings.dnsServers = "dns.example.com"

    expect(validateState(value)).toContain(error)
  })

  it("validates Shadowrocket subscription names and fallback DNS", () => {
    const value = validState("shadowrocket")
    value.settings.shadowrocket.subscriptionNames = "Primary,,Backup"
    value.settings.shadowrocket.fallbackDnsServers = "dns.example.com"

    expect(validateState(value)).toEqual(
      expect.arrayContaining([
        "Shadowrocket 订阅名称不能留空或包含配置分隔符、注释符",
        "Shadowrocket 备用 DNS 只能使用 system、IP 地址或支持的加密 DNS URI",
      ])
    )
  })

  it("only applies the remote update interval constraint to clients that use it", () => {
    const mihomo = validState("mihomo")
    mihomo.settings.ruleUpdateInterval = 30
    expect(validateState(mihomo)).toContain("规则更新间隔不能小于 60 秒")

    const surge = validState("surge")
    surge.settings.ruleUpdateInterval = 30
    expect(validateState(surge)).toContain("规则更新间隔不能小于 60 秒")

    const loon = validState("loon")
    loon.settings.ruleUpdateInterval = 30
    expect(validateState(loon)).not.toContain("规则更新间隔不能小于 60 秒")

    const shadowrocket = validState("shadowrocket")
    shadowrocket.settings.ruleUpdateInterval = 30
    expect(validateState(shadowrocket)).not.toContain(
      "规则更新间隔不能小于 60 秒"
    )
  })

  it("requires at least one usable primary DNS route", () => {
    const value = validState("surge")
    value.settings.dnsServers = ""
    value.settings.dohServers = ""
    value.settings.surge.includeSystemDns = false

    expect(validateState(value)).toContain("至少需要配置一个主 DNS 服务器")
  })
})
