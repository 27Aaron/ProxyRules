import {
  CLIENTS,
  FEATURED_GROUPS,
  REGIONS,
  type ConfiguratorState,
  type FeaturedGroupId,
  type RegionId,
  type RenderResult,
  type RuleBinding,
  type StrategyGroup,
} from "@/lib/types"

const ADS_CATEGORY = "category-ads-all@ads"
const PRIVATE_CATEGORY = "private"
const PROXY_CATEGORY = "geolocation-!cn"
const CHINA_CATEGORY = "cn"

const SKIP_PROXY = [
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "255.255.255.255/32",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
  "::ffff:0:0:0:0/96",
]

const KNOWN_REGION_PATTERN = [
  "🇭🇰",
  "香港",
  "Hong.?Kong",
  "\\bHKG\\b",
  "\\bHK\\b",
  "🇯🇵",
  "日本",
  "东京",
  "東京",
  "大阪",
  "Japan",
  "\\bJPN\\b",
  "\\bJP\\b",
  "🇺🇸",
  "美国",
  "美國",
  "United.?States",
  "America",
  "\\bUSA\\b",
  "\\bUS\\b",
  "🇸🇬",
  "新加坡",
  "狮城",
  "獅城",
  "Singapore",
  "\\bSGP\\b",
  "\\bSG\\b",
  "🇹🇼",
  "台湾",
  "臺灣",
  "Taiwan",
  "\\bTWN\\b",
  "\\bTW\\b",
  "🇰🇷",
  "韩国",
  "韓國",
  "首尔",
  "首爾",
  "Korea",
  "Seoul",
  "\\bKOR\\b",
  "\\bKR\\b",
].join("|")

const OTHER_REGION_FILTER = `(?i)^(?!.*(?:${KNOWN_REGION_PATTERN})).+$`

type PlannedRule = RuleBinding & { section: string }

function listPath(id: string) {
  return `ruleset/${id}/${id}.list`
}

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}

function ruleUrl(state: ConfiguratorState, path: string) {
  return `${cleanBaseUrl(state.settings.ruleBaseUrl)}/${path.replace(/^\/+/, "")}`
}

function cleanGroupName(value: string, fallback: string) {
  const cleaned = value
    .replace(/[\r\n,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || fallback
}

function groupName(state: ConfiguratorState, id: FeaturedGroupId) {
  const fallback = FEATURED_GROUPS.find((group) => group.id === id)?.name ?? id
  return cleanGroupName(state.groupNames[id], fallback)
}

export function buildStrategyGroups(state: ConfiguratorState): StrategyGroup[] {
  const featured: StrategyGroup[] = []

  for (const definition of FEATURED_GROUPS) {
    if (!state.featuredGroups.includes(definition.id)) continue

    const name = groupName(state, definition.id)
    if (definition.id === "ip-attribution") {
      featured.push({
        id: definition.id,
        name,
        special: "ip-attribution",
        categories: [
          {
            id: "ip-attribution-reject",
            path: "ruleset/ip-attribution/ip-attribution-reject.list",
            policy: "REJECT",
            action: "reject",
          },
          {
            id: "ip-attribution-direct",
            path: "ruleset/ip-attribution/ip-attribution-direct.list",
            policy: "DIRECT",
            action: "direct",
          },
          {
            id: "ip-attribution",
            path: "ruleset/ip-attribution/ip-attribution.list",
            policy: name,
            action: "default",
          },
        ],
      })
      continue
    }

    featured.push({
      id: definition.id,
      name,
      categories: definition.categories.map((category) => ({
        id: category,
        path: listPath(category),
        policy: name,
      })),
    })
  }

  const custom: StrategyGroup[] = state.customGroups.map((group) => {
    const name = cleanGroupName(group.name, group.categoryId)
    return {
      id: `custom-${group.categoryId}`,
      name,
      categories: [
        {
          id: group.categoryId,
          path: group.path,
          policy: name,
        },
      ],
    }
  })

  return [...featured, ...custom]
}

function buildRulePlan(state: ConfiguratorState, groups: StrategyGroup[]) {
  const rules: PlannedRule[] = []

  if (state.settings.blockAds) {
    rules.push({
      id: ADS_CATEGORY,
      path: listPath(ADS_CATEGORY),
      policy: "REJECT",
      section: "Reject",
    })
  }

  if (state.settings.directPrivate) {
    rules.push({
      id: PRIVATE_CATEGORY,
      path: listPath(PRIVATE_CATEGORY),
      policy: "DIRECT",
      section: "Private",
    })
  }

  const attribution = groups.find((group) => group.special === "ip-attribution")
  if (attribution) {
    rules.push(
      ...attribution.categories.map((binding) => ({
        ...binding,
        section: "IP Attribution",
      }))
    )
  }

  for (const group of groups) {
    if (group.special) continue
    rules.push(
      ...group.categories.map((binding) => ({
        ...binding,
        section: group.name,
      }))
    )
  }

  rules.push({
    id: PROXY_CATEGORY,
    path: listPath(PROXY_CATEGORY),
    policy: "Proxies",
    section: "Proxy",
  })

  if (state.settings.directChina) {
    rules.push({
      id: CHINA_CATEGORY,
      path: listPath(CHINA_CATEGORY),
      policy: "DIRECT",
      section: "Direct CN",
    })
  }

  return rules
}

function selectedRegions(state: ConfiguratorState) {
  return state.regions.flatMap((id) => {
    const region = REGIONS.find((item) => item.id === id)
    return region ? [region] : []
  })
}

function policyCandidates(state: ConfiguratorState) {
  return [
    "Proxies",
    "Manual",
    ...selectedRegions(state).map((region) => region.id),
  ]
}

function yaml(value: string | number | boolean | string[]) {
  return JSON.stringify(value)
}

function serverList(value: string) {
  return value
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean)
}

function systemDnsServers(servers: string[]) {
  return ["system", ...servers.filter((server) => server !== "system")].join(
    ", "
  )
}

function renderMihomo(state: ConfiguratorState): RenderResult {
  const settings = state.settings
  const groups = buildStrategyGroups(state)
  const rules = buildRulePlan(state, groups)
  const regions = selectedRegions(state)
  const candidates = policyCandidates(state)
  const providers = [...new Map(rules.map((rule) => [rule.id, rule])).values()]
  const dnsServers = serverList(settings.dnsServers)
  const dohServers = serverList(settings.dohServers)
  const lines: string[] = []

  lines.push(
    `mixed-port: ${settings.mihomo.mixedPort}`,
    `allow-lan: ${settings.mihomo.allowLan}`,
    `ipv6: ${settings.ipv6}`,
    "mode: rule",
    `log-level: ${settings.mihomo.logLevel}`,
    `external-controller: ${yaml(settings.mihomo.externalController)}`,
    `secret: ${yaml(settings.mihomo.secret)}`,
    "unified-delay: true",
    "tcp-concurrent: true",
    "profile: {store-selected: true, store-fake-ip: true}",
    "",
    "dns:",
    "  enable: true",
    `  ipv6: ${settings.ipv6}`,
    "  enhanced-mode: fake-ip",
    "  fake-ip-range: 198.18.0.1/16",
    `  default-nameserver: ${yaml(dnsServers)}`,
    `  nameserver: ${yaml(dohServers.length > 0 ? dohServers : dnsServers)}`,
    ""
  )

  if (settings.mihomo.tun) {
    lines.push(
      "tun:",
      "  enable: true",
      "  stack: system",
      "  auto-route: true",
      "  auto-detect-interface: true",
      '  dns-hijack: ["any:53", "tcp://any:53"]',
      ""
    )
  }

  lines.push(
    "proxy-groups:",
    `  - name: ${yaml("Proxies")}`,
    "    type: select",
    `    proxies: ${yaml(["Manual", ...regions.map((region) => region.id)])}`,
    `    url: ${yaml(settings.proxyTestUrl)}`,
    "",
    `  - name: ${yaml("Manual")}`,
    "    type: select",
    "    include-all: true",
    `    url: ${yaml(settings.proxyTestUrl)}`,
    ""
  )

  for (const group of groups) {
    lines.push(
      `  - name: ${yaml(group.name)}`,
      "    type: select",
      `    proxies: ${yaml(candidates)}`,
      `    url: ${yaml(settings.proxyTestUrl)}`,
      ""
    )
  }

  lines.push(
    `  - name: ${yaml("Final")}`,
    "    type: select",
    `    proxies: ${yaml(["Proxies", "DIRECT", "Manual"])}`,
    `    url: ${yaml(settings.proxyTestUrl)}`,
    ""
  )

  for (const region of regions) {
    lines.push(
      `  - name: ${yaml(region.id)}`,
      "    type: url-test",
      "    include-all: true",
      `    url: ${yaml(settings.proxyTestUrl)}`,
      `    interval: ${settings.groupTestInterval}`,
      "    tolerance: 20",
      "    hidden: true"
    )
    if (region.id === "Other") {
      lines.push(
        `    filter: ${yaml(".*")}`,
        `    exclude-filter: ${yaml(`(?i)(${KNOWN_REGION_PATTERN})`)}`
      )
    } else {
      lines.push(`    filter: ${yaml(region.filter)}`)
    }
    lines.push("")
  }

  lines.push("rule-providers:")
  for (const provider of providers) {
    lines.push(
      `  ${yaml(provider.id)}:`,
      "    type: http",
      "    behavior: classical",
      "    format: text",
      `    interval: ${settings.ruleUpdateInterval}`,
      `    url: ${yaml(ruleUrl(state, provider.path))}`,
      `    path: ${yaml(`./ruleset/${provider.id}.list`)}`
    )
  }

  lines.push("", "rules:")
  let previousSection = ""
  for (const rule of rules) {
    if (rule.section !== previousSection) {
      lines.push(`  # > ${rule.section}`)
      previousSection = rule.section
    }
    lines.push(`  - RULE-SET,${rule.id},${rule.policy}`)
  }
  lines.push("  # > Final", "  - MATCH,Final", "")

  return {
    content: lines.join("\n"),
    fileName: CLIENTS.find((client) => client.id === "mihomo")!.fileName,
    mimeType: "text/yaml;charset=utf-8",
  }
}

function renderSurge(state: ConfiguratorState): RenderResult {
  const settings = state.settings
  const groups = buildStrategyGroups(state)
  const rules = buildRulePlan(state, groups)
  const regions = selectedRegions(state)
  const candidates = policyCandidates(state)
  const dnsServers = serverList(settings.dnsServers)
  const dohServers = serverList(settings.dohServers)
  const lines: string[] = []

  lines.push(
    "[General]",
    `loglevel = ${settings.surge.logLevel}`,
    "show-error-page-for-reject = true",
    `internet-test-url = ${settings.internetTestUrl}`,
    `proxy-test-url = ${settings.proxyTestUrl}`,
    `test-timeout = ${settings.timeoutSeconds}`,
    `ipv6 = ${settings.ipv6}`,
    "ipv6-vif = auto",
    `dns-server = ${systemDnsServers(dnsServers)}`,
    `encrypted-dns-server = ${dohServers.join(", ")}`,
    "encrypted-dns-follow-outbound-mode = true",
    `skip-proxy = ${[...SKIP_PROXY, "localhost", "*.local", "captive.apple.com"].join(", ")}`,
    "udp-priority = true",
    "exclude-simple-hostnames = true",
    "udp-policy-not-supported-behaviour = reject",
    "",
    "[Proxy Group]",
    "# > Main",
    `Proxies = select, ${["Manual", ...regions.map((region) => region.id)].join(", ")}`,
    "Manual = select, include-all-proxies=true, interval=600, tolerance=20, evaluate-before-use=true"
  )

  for (const group of groups) {
    lines.push(`${group.name} = select, ${candidates.join(", ")}`)
  }
  lines.push("Final = select, Proxies, DIRECT, Manual", "")

  if (regions.length > 0) lines.push("# > Regions")
  for (const region of regions) {
    const filter = region.id === "Other" ? OTHER_REGION_FILTER : region.filter
    lines.push(
      `${region.id} = url-test, include-other-group=Manual, interval=${settings.groupTestInterval}, tolerance=20, policy-regex-filter=${filter}, evaluate-before-use=true`
    )
  }

  lines.push("", "[Rule]")
  let previousSection = ""
  for (const rule of rules) {
    if (rule.section !== previousSection) {
      lines.push(`# > ${rule.section}`)
      previousSection = rule.section
    }
    lines.push(`RULE-SET,${ruleUrl(state, rule.path)},${rule.policy}`)
  }
  lines.push("# > Final", "FINAL,Final", "", "[Host]", "")

  return {
    content: lines.join("\n"),
    fileName: CLIENTS.find((client) => client.id === "surge")!.fileName,
    mimeType: "text/plain;charset=utf-8",
  }
}

function renderLoon(state: ConfiguratorState): RenderResult {
  const settings = state.settings
  const groups = buildStrategyGroups(state)
  const rules = buildRulePlan(state, groups)
  const regions = selectedRegions(state)
  const candidates = policyCandidates(state)
  const dnsServers = serverList(settings.dnsServers)
  const dohServers = serverList(settings.dohServers)
  const lines: string[] = []

  lines.push(
    "[General]",
    `ip-mode = ${settings.ipv6 ? "dual" : "ipv4"}`,
    `interface-mode = ${settings.loon.interfaceMode}`,
    `skip-proxy = ${[...SKIP_PROXY, "localhost", "*.local", "captive.apple.com"].join(", ")}`,
    `bypass-tun = ${SKIP_PROXY.join(", ")}`,
    `dns-server = ${systemDnsServers(dnsServers)}`,
    `doh-server = ${dohServers.join(", ")}`,
    `internet-test-url = ${settings.internetTestUrl}`,
    `proxy-test-url = ${settings.proxyTestUrl}`,
    `test-timeout = ${settings.timeoutSeconds}`,
    "allow-udp-proxy = true",
    "udp-fallback-mode = REJECT",
    "sni-sniffing = true",
    "",
    "[Proxy]",
    "",
    "[Remote Proxy]",
    "",
    "[Proxy Group]",
    "# > Main",
    `Proxies = select,${["Manual", ...regions.map((region) => region.id)].join(",")},url = ${settings.proxyTestUrl},interval = 600`,
    `Manual = select,ALL_Filter,url = ${settings.proxyTestUrl},interval = 600`
  )

  for (const group of groups) {
    lines.push(
      `${group.name} = select,${candidates.join(",")},url = ${settings.proxyTestUrl},interval = 600`
    )
  }
  lines.push(
    `Final = select,Proxies,DIRECT,Manual,url = ${settings.proxyTestUrl},interval = 600`,
    ""
  )

  if (regions.length > 0) lines.push("# > Regions")
  for (const region of regions) {
    lines.push(
      `${region.id} = url-test,${region.id}_Filter,url = ${settings.proxyTestUrl},interval = ${settings.groupTestInterval},tolerance = 20`
    )
  }

  lines.push(
    "",
    "[Remote Filter]",
    "# > All",
    'ALL_Filter = NameRegex, FilterKey = ".*"'
  )
  if (regions.length > 0) lines.push("", "# > Regions")
  for (const region of regions) {
    const filter = region.id === "Other" ? OTHER_REGION_FILTER : region.filter
    lines.push(`${region.id}_Filter = NameRegex, FilterKey = "${filter}"`)
  }

  lines.push("", "[Remote Rule]")
  let previousSection = ""
  for (const rule of rules) {
    if (rule.section !== previousSection) {
      lines.push(`# > ${rule.section}`)
      previousSection = rule.section
    }
    lines.push(
      `${ruleUrl(state, rule.path)}, policy=${rule.policy}, tag=${rule.id}, enabled=true`
    )
  }
  lines.push(
    "",
    "[Rule]",
    "# > Final",
    "FINAL,Final",
    "",
    "[Rewrite]",
    "",
    "[Script]",
    "",
    "[MITM]",
    "hostname =",
    "ca-p12 =",
    "ca-passphrase =",
    "skip-server-cert-verify = false",
    ""
  )

  return {
    content: lines.join("\n"),
    fileName: CLIENTS.find((client) => client.id === "loon")!.fileName,
    mimeType: "text/plain;charset=utf-8",
  }
}

function renderShadowrocket(state: ConfiguratorState): RenderResult {
  const settings = state.settings
  const groups = buildStrategyGroups(state)
  const rules = buildRulePlan(state, groups)
  const regions = selectedRegions(state)
  const candidates = policyCandidates(state)
  const dnsServers = serverList(settings.dnsServers)
  const dohServers = serverList(settings.dohServers)
  const lines: string[] = []

  lines.push(
    "[General]",
    `ipv6 = ${settings.ipv6}`,
    `bypass-system = ${settings.shadowrocket.bypassSystem}`,
    `skip-proxy = ${[...SKIP_PROXY.slice(0, 11), "localhost", "*.local", "captive.apple.com"].join(", ")}`,
    `tun-excluded-routes = ${SKIP_PROXY.slice(0, 11).join(", ")}`,
    `dns-server = ${systemDnsServers([...dnsServers, ...dohServers])}`,
    "fallback-dns-server = 8.8.8.8, 1.1.1.1",
    "private-ip-answer = true",
    "udp-policy-not-supported-behaviour = reject",
    `test-timeout = ${settings.timeoutSeconds}`,
    `internet-test-url = ${settings.internetTestUrl}`,
    `proxy-test-url = ${settings.proxyTestUrl}`,
    "",
    "[Proxy Group]",
    "# > Main",
    `Proxies = select, ${["Manual", ...regions.map((region) => region.id)].join(", ")}, url=${settings.proxyTestUrl}, interval=600`,
    `Manual = select, include-all-proxies=true, url=${settings.proxyTestUrl}, interval=600`
  )

  for (const group of groups) {
    lines.push(
      `${group.name} = select, ${candidates.join(", ")}, url=${settings.proxyTestUrl}, interval=600`
    )
  }
  lines.push(
    `Final = select, Proxies, DIRECT, Manual, url=${settings.proxyTestUrl}, interval=600`,
    ""
  )

  if (regions.length > 0) lines.push("# > Regions")
  for (const region of regions) {
    const filter = region.id === "Other" ? OTHER_REGION_FILTER : region.filter
    lines.push(
      `${region.id} = url-test, include-other-group=Manual, url=${settings.proxyTestUrl}, interval=${settings.groupTestInterval}, tolerance=20, policy-regex-filter=${filter}`
    )
  }

  lines.push("", "[Rule]")
  let previousSection = ""
  for (const rule of rules) {
    if (rule.section !== previousSection) {
      lines.push(`# > ${rule.section}`)
      previousSection = rule.section
    }
    lines.push(`RULE-SET,${ruleUrl(state, rule.path)},${rule.policy}`)
  }
  lines.push(
    "# > Final",
    "FINAL,Final",
    "",
    "[Host]",
    "",
    "[URL Rewrite]",
    "",
    "[MITM]",
    "enable = false",
    "hostname =",
    ""
  )

  return {
    content: lines.join("\n"),
    fileName: CLIENTS.find((client) => client.id === "shadowrocket")!.fileName,
    mimeType: "text/plain;charset=utf-8",
  }
}

export function renderConfig(state: ConfiguratorState): RenderResult {
  switch (state.client) {
    case "mihomo":
      return renderMihomo(state)
    case "surge":
      return renderSurge(state)
    case "loon":
      return renderLoon(state)
    case "shadowrocket":
      return renderShadowrocket(state)
  }
}

function isHttpUrl(value: string) {
  if (/[\s,]/.test(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function validateState(state: ConfiguratorState) {
  const errors: string[] = []
  const rawNames = [
    ...state.featuredGroups.map((id) => state.groupNames[id]),
    ...state.customGroups.map((group) => group.name),
  ]
  const names = [
    "Proxies",
    "Manual",
    "Final",
    ...buildStrategyGroups(state).map((group) => group.name),
    ...state.regions,
  ]
  const normalized = names.map((name) => name.toLocaleLowerCase())

  if (new Set(normalized).size !== normalized.length) {
    errors.push("策略组名称不能重复")
  }
  if (
    rawNames.some(
      (name) => typeof name !== "string" || /[\r\n,]/.test(name) || !name.trim()
    )
  ) {
    errors.push("策略组名称不能为空，也不能包含逗号或换行")
  }
  if (!isHttpUrl(state.settings.ruleBaseUrl)) {
    errors.push("规则地址必须是有效的 HTTP 或 HTTPS 地址")
  }
  if (!isHttpUrl(state.settings.internetTestUrl)) {
    errors.push("联网测试地址格式无效")
  }
  if (!isHttpUrl(state.settings.proxyTestUrl)) {
    errors.push("代理测试地址格式无效")
  }
  if (serverList(state.settings.dnsServers).length === 0) {
    errors.push("至少需要填写一个 DNS 服务器")
  }
  const dohServers = serverList(state.settings.dohServers)
  if (
    dohServers.length === 0 ||
    dohServers.some((server) => {
      try {
        return new URL(server).protocol !== "https:"
      } catch {
        return true
      }
    })
  ) {
    errors.push("加密 DNS 必须包含至少一个有效的 HTTPS 地址")
  }
  if (
    !Number.isInteger(state.settings.ruleUpdateInterval) ||
    state.settings.ruleUpdateInterval < 60
  ) {
    errors.push("规则更新间隔不能小于 60 秒")
  }
  if (
    !Number.isInteger(state.settings.groupTestInterval) ||
    state.settings.groupTestInterval < 30
  ) {
    errors.push("地区测速间隔不能小于 30 秒")
  }
  if (
    !Number.isInteger(state.settings.timeoutSeconds) ||
    state.settings.timeoutSeconds < 1
  ) {
    errors.push("测试超时不能小于 1 秒")
  }
  if (
    !Number.isInteger(state.settings.mihomo.mixedPort) ||
    state.settings.mihomo.mixedPort < 1 ||
    state.settings.mihomo.mixedPort > 65535
  ) {
    errors.push("Mihomo Mixed Port 必须在 1 到 65535 之间")
  }

  return errors
}

export function getSelectedCategoryIds(state: ConfiguratorState) {
  const ids = new Set<string>()
  for (const featured of FEATURED_GROUPS) {
    if (!state.featuredGroups.includes(featured.id)) continue
    for (const category of featured.categories) ids.add(category)
  }
  for (const group of state.customGroups) ids.add(group.categoryId)
  return ids
}

export function isRegionId(value: string): value is RegionId {
  return REGIONS.some((region) => region.id === value)
}
