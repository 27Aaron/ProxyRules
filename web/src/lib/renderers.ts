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

const SHADOWROCKET_SKIP_PROXY = SKIP_PROXY.slice(0, 11)
const CGNAT_RANGE = "100.64.0.0/10"
const MIHOMO_ENCRYPTED_DNS_PROTOCOLS = ["https:", "h3:", "quic:", "tls:"]
const SURGE_ENCRYPTED_DNS_PROTOCOLS = ["https:", "h3:", "quic:", "tls:"]
const LOON_ENCRYPTED_DNS_PROTOCOLS = ["https:", "h3:", "quic:"]
const SHADOWROCKET_ENCRYPTED_DNS_PROTOCOLS = ["https:", "h3:", "quic:", "tls:"]
const UNSAFE_NAME_PATTERN = /[\r\n,=#;]|\/\//

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
    .replace(/\/\//g, " ")
    .replace(/[\r\n,=#;]/g, " ")
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

function withSystemDns(servers: string[], enabled: boolean) {
  const explicit = servers.filter(
    (server) => server.toLocaleLowerCase() !== "system"
  )
  return enabled ? ["system", ...explicit] : explicit
}

function contentFrom(lines: string[]) {
  return `${lines.join("\n").replace(/\n+$/, "")}\n`
}

function isGenerate204Url(value: string) {
  try {
    return /(?:^|\/)generate_204\/?$/i.test(new URL(value).pathname)
  } catch {
    return false
  }
}

function encryptedDnsProtocol(value: string) {
  try {
    const url = new URL(value)
    return url.hostname ? url.protocol.toLocaleLowerCase() : ""
  } catch {
    return ""
  }
}

function splitEncryptedDns(servers: string[]) {
  return {
    https: servers.filter(
      (server) => encryptedDnsProtocol(server) === "https:"
    ),
    h3: servers.filter((server) => encryptedDnsProtocol(server) === "h3:"),
    quic: servers.filter((server) => encryptedDnsProtocol(server) === "quic:"),
  }
}

function shadowrocketNodeSource(names: string[]) {
  return names.length > 0 ? `${names.join(", ")}, use=true, ` : ""
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
  const primaryDns = dohServers.length > 0 ? dohServers : dnsServers
  const bootstrapDns = dnsServers.length > 0 ? dnsServers : primaryDns
  const healthCheckExpectedStatus = isGenerate204Url(settings.proxyTestUrl)
  const hasProxyProvider = isHttpUrl(settings.mihomo.proxyProviderUrl)
  const lines: string[] = []

  lines.push(
    `mixed-port: ${settings.mihomo.mixedPort}`,
    `allow-lan: ${settings.mihomo.allowLan}`
  )
  if (settings.mihomo.allowLan) {
    lines.push(
      `lan-allowed-ips: ${yaml(serverList(settings.mihomo.lanAllowedIps))}`
    )
  }
  lines.push(
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
    "  fake-ip-filter-mode: rule",
    "  fake-ip-filter:",
    `    - ${yaml("DOMAIN-SUFFIX,lan,real-ip")}`,
    `    - ${yaml("DOMAIN-SUFFIX,local,real-ip")}`
  )
  if (providers.some((provider) => provider.id === PRIVATE_CATEGORY)) {
    lines.push(`    - ${yaml("RULE-SET,private,real-ip")}`)
  }
  lines.push(
    `    - ${yaml("MATCH,fake-ip")}`,
    `  default-nameserver: ${yaml(bootstrapDns)}`,
    `  nameserver: ${yaml(primaryDns)}`
  )
  if (settings.mihomo.respectDnsRules) {
    lines.push(
      "  respect-rules: true",
      `  proxy-server-nameserver: ${yaml(primaryDns)}`
    )
  }
  lines.push("")

  if (settings.mihomo.tun) {
    lines.push(
      "tun:",
      "  enable: true",
      `  stack: ${settings.mihomo.tunStack}`,
      "  auto-route: true",
      "  auto-detect-interface: true"
    )
    if (settings.mihomo.strictRoute) lines.push("  strict-route: true")
    lines.push('  dns-hijack: ["any:53", "tcp://any:53"]', "")
  }

  if (settings.mihomo.sniffer) {
    lines.push(
      "sniffer:",
      "  enable: true",
      "  force-dns-mapping: true",
      "  parse-pure-ip: true",
      "  override-destination: false",
      "  sniff:",
      "    HTTP:",
      '      ports: [80, "8080-8880"]',
      "      override-destination: true",
      "    TLS:",
      "      ports: [443, 8443]",
      "    QUIC:",
      "      ports: [443, 8443]",
      ""
    )
  }

  if (hasProxyProvider) {
    lines.push(
      "proxy-providers:",
      `  ${yaml("Subscription")}:`,
      "    type: http",
      `    url: ${yaml(settings.mihomo.proxyProviderUrl.trim())}`,
      `    path: ${yaml("./proxy_providers/subscription.yaml")}`,
      `    interval: ${settings.ruleUpdateInterval}`,
      "    health-check:",
      "      enable: true",
      `      url: ${yaml(settings.proxyTestUrl)}`,
      `      interval: ${settings.groupTestInterval}`,
      `      timeout: ${settings.timeoutSeconds * 1000}`,
      "      lazy: true"
    )
    if (healthCheckExpectedStatus) lines.push("      expected-status: 204")
  } else {
    lines.push("proxy-providers: {}")
  }
  lines.push(
    "",
    "proxy-groups:",
    `  - name: ${yaml("Proxies")}`,
    "    type: select",
    `    proxies: ${yaml(["Manual", ...regions.map((region) => region.id)])}`,
    "",
    `  - name: ${yaml("Manual")}`,
    "    type: select"
  )
  lines.push(
    hasProxyProvider
      ? `    use: ${yaml(["Subscription"])}`
      : `    proxies: ${yaml(["DIRECT"])}`,
    ""
  )

  for (const group of groups) {
    lines.push(
      `  - name: ${yaml(group.name)}`,
      "    type: select",
      `    proxies: ${yaml(candidates)}`,
      ""
    )
  }

  lines.push(
    `  - name: ${yaml("Final")}`,
    "    type: select",
    `    proxies: ${yaml(["Proxies", "DIRECT", "Manual"])}`,
    ""
  )

  for (const region of regions) {
    lines.push(
      `  - name: ${yaml(region.id)}`,
      "    type: url-test",
      hasProxyProvider
        ? `    use: ${yaml(["Subscription"])}`
        : `    proxies: ${yaml(["DIRECT"])}`,
      `    url: ${yaml(settings.proxyTestUrl)}`,
      `    interval: ${settings.groupTestInterval}`,
      `    tolerance: ${settings.groupTolerance}`,
      `    timeout: ${settings.timeoutSeconds * 1000}`
    )
    if (healthCheckExpectedStatus) lines.push("    expected-status: 204")
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
    content: contentFrom(lines),
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
  const plainDns = withSystemDns(dnsServers, settings.surge.includeSystemDns)
  const hasProxyList = isHttpUrl(settings.surge.proxyListUrl)
  const lines: string[] = []

  lines.push(
    "[General]",
    `loglevel = ${settings.surge.logLevel}`,
    "show-error-page-for-reject = true",
    `internet-test-url = ${settings.internetTestUrl}`,
    `proxy-test-url = ${settings.proxyTestUrl}`,
    `test-timeout = ${settings.timeoutSeconds}`,
    `ipv6 = ${settings.ipv6}`,
    `ipv6-vif = ${settings.ipv6 ? "auto" : "off"}`
  )
  if (plainDns.length > 0) {
    lines.push(`dns-server = ${plainDns.join(", ")}`)
  }
  if (dohServers.length > 0) {
    lines.push(`encrypted-dns-server = ${dohServers.join(", ")}`)
  }
  if (settings.surge.encryptedDnsFollowOutboundMode) {
    lines.push("encrypted-dns-follow-outbound-mode = true")
  }
  lines.push(
    `skip-proxy = ${[...SKIP_PROXY, "localhost", "*.local", "captive.apple.com"].join(", ")}`
  )
  if (settings.surge.udpPriority) lines.push("udp-priority = true")
  lines.push(
    "exclude-simple-hostnames = true",
    "udp-policy-not-supported-behaviour = reject",
    "",
    "[Proxy Group]",
    "# > Main",
    `Proxies = select, ${["Manual", ...regions.map((region) => region.id)].join(", ")}`,
    hasProxyList
      ? `Manual = select, policy-path=${settings.surge.proxyListUrl.trim()}, update-interval=${settings.ruleUpdateInterval}`
      : "Manual = select, DIRECT"
  )

  for (const group of groups) {
    lines.push(`${group.name} = select, ${candidates.join(", ")}`)
  }
  lines.push("Final = select, Proxies, DIRECT, Manual")

  if (regions.length > 0) lines.push("", "# > Regions")
  for (const region of regions) {
    if (!hasProxyList) {
      lines.push(`${region.id} = select, DIRECT`)
      continue
    }
    const filter = region.id === "Other" ? OTHER_REGION_FILTER : region.filter
    const options = [
      "include-other-group=Manual",
      `url=${settings.proxyTestUrl}`,
      `interval=${settings.groupTestInterval}`,
      `tolerance=${settings.groupTolerance}`,
      `policy-regex-filter=${filter}`,
    ]
    if (settings.surge.evaluateBeforeUse) {
      options.push("evaluate-before-use=true")
    }
    lines.push(`${region.id} = url-test, ${options.join(", ")}`)
  }

  lines.push("", "[Rule]")
  let previousSection = ""
  const strategyStart = rules.findIndex(
    (rule) => rule.section !== "Reject" && rule.section !== "Private"
  )
  const baseRuleCount = strategyStart === -1 ? rules.length : strategyStart
  const pushRules = (plannedRules: PlannedRule[]) => {
    for (const rule of plannedRules) {
      if (rule.section !== previousSection) {
        lines.push(`# > ${rule.section}`)
        previousSection = rule.section
      }
      lines.push(`RULE-SET,${ruleUrl(state, rule.path)},${rule.policy}`)
    }
  }
  pushRules(rules.slice(0, baseRuleCount))
  if (settings.surge.encryptedDnsFollowOutboundMode) {
    lines.push(
      "# > Encrypted DNS",
      "PROTOCOL,DOH,Proxies",
      "PROTOCOL,DOH3,Proxies",
      "PROTOCOL,DOQ,Proxies"
    )
    previousSection = "Encrypted DNS"
  }
  pushRules(rules.slice(baseRuleCount))
  lines.push("# > Final", "FINAL,Final", "")

  return {
    content: contentFrom(lines),
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
  const encryptedDns = splitEncryptedDns(dohServers)
  const plainDns = withSystemDns(dnsServers, settings.loon.includeSystemDns)
  const subscriptionName = cleanGroupName(
    settings.loon.subscriptionName,
    "Subscription"
  )
  const hasSubscription = isHttpUrl(settings.loon.subscriptionUrl)
  const lines: string[] = []

  lines.push(
    "[General]",
    `ip-mode = ${settings.ipv6 ? "dual" : "ipv4-only"}`,
    `interface-mode = ${settings.loon.interfaceMode}`,
    `skip-proxy = ${[...SKIP_PROXY, "localhost", "*.local", "captive.apple.com"].join(", ")}`,
    `bypass-tun = ${[...SKIP_PROXY, "localhost", "*.local", "captive.apple.com"].join(", ")}`
  )
  if (plainDns.length > 0) lines.push(`dns-server = ${plainDns.join(", ")}`)
  if (encryptedDns.https.length > 0) {
    lines.push(`doh-server = ${encryptedDns.https.join(", ")}`)
  }
  if (encryptedDns.quic.length > 0) {
    lines.push(`doq-server = ${encryptedDns.quic.join(", ")}`)
  }
  if (encryptedDns.h3.length > 0) {
    lines.push(`doh3-server = ${encryptedDns.h3.join(", ")}`)
  }
  const realIp = serverList(settings.loon.realIp)
  if (realIp.length > 0) lines.push(`real-ip = ${realIp.join(", ")}`)
  if (settings.loon.hijackDns) lines.push("hijack-dns = *:53")
  if (settings.loon.disableStun) lines.push("disable-stun = true")
  lines.push(
    `internet-test-url = ${settings.internetTestUrl}`,
    `proxy-test-url = ${settings.proxyTestUrl}`,
    `test-timeout = ${settings.timeoutSeconds}`,
    `udp-fallback-mode = ${settings.loon.udpFallbackMode}`
  )
  if (hasSubscription) {
    lines.push(
      "",
      "[Remote Proxy]",
      `${subscriptionName} = ${settings.loon.subscriptionUrl.trim()}`
    )
  }
  lines.push(
    "",
    "[Proxy Group]",
    "# > Main",
    `Proxies = select,${["Manual", ...regions.map((region) => region.id)].join(",")}`,
    hasSubscription ? "Manual = select,ALL_Filter" : "Manual = select,DIRECT"
  )

  for (const group of groups) {
    lines.push(`${group.name} = select,${candidates.join(",")}`)
  }
  lines.push("Final = select,Proxies,DIRECT,Manual")

  if (regions.length > 0) lines.push("", "# > Regions")
  for (const region of regions) {
    lines.push(
      hasSubscription
        ? `${region.id} = url-test,${region.id}_Filter,url = ${settings.proxyTestUrl},interval = ${settings.groupTestInterval},tolerance = ${settings.groupTolerance}`
        : `${region.id} = select,DIRECT`
    )
  }

  if (hasSubscription) {
    lines.push(
      "",
      "[Remote Filter]",
      "# > All",
      `ALL_Filter = NameRegex,${subscriptionName}, FilterKey = ".*"`
    )
    if (regions.length > 0) lines.push("", "# > Regions")
    for (const region of regions) {
      const filter = region.id === "Other" ? OTHER_REGION_FILTER : region.filter
      lines.push(
        `${region.id}_Filter = NameRegex,${subscriptionName}, FilterKey = "${filter}"`
      )
    }
  }

  lines.push("", "[Remote Rule]")
  let previousSection = ""
  for (const rule of rules) {
    if (rule.section !== previousSection) {
      lines.push(`# > ${rule.section}`)
      previousSection = rule.section
    }
    lines.push(
      `${ruleUrl(state, rule.path)}, policy=${rule.policy}, enabled=true`
    )
  }
  lines.push("", "[Rule]", "# > Final", "FINAL,Final", "")

  return {
    content: contentFrom(lines),
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
  const primaryDns = dohServers.length > 0 ? dohServers : dnsServers
  const fallbackDns = serverList(settings.shadowrocket.fallbackDnsServers)
  const subscriptionNames = serverList(settings.shadowrocket.subscriptionNames)
  const nodeSource = shadowrocketNodeSource(subscriptionNames)
  const excludedRoutes = settings.shadowrocket.excludeCgnat
    ? SHADOWROCKET_SKIP_PROXY
    : SHADOWROCKET_SKIP_PROXY.filter((route) => route !== CGNAT_RANGE)
  const lines: string[] = []

  lines.push(
    "[General]",
    `ipv6 = ${settings.ipv6}`,
    `skip-proxy = ${[...excludedRoutes, "localhost", "*.local", "captive.apple.com"].join(", ")}`,
    `tun-excluded-routes = ${excludedRoutes.join(", ")}`,
    `dns-server = ${primaryDns.join(", ")}`
  )
  if (fallbackDns.length > 0) {
    lines.push(`fallback-dns-server = ${fallbackDns.join(", ")}`)
  }
  if (settings.shadowrocket.hijackDns) lines.push("hijack-dns = :53")
  lines.push(
    "private-ip-answer = true",
    "udp-policy-not-supported-behaviour = reject",
    "",
    "[Proxy Group]",
    "# > Main",
    `Proxies = select, ${["Manual", ...regions.map((region) => region.id)].join(", ")}`,
    `Manual = select, ${nodeSource}policy-regex-filter=.*`
  )

  for (const group of groups) {
    lines.push(`${group.name} = select, ${candidates.join(", ")}`)
  }
  lines.push("Final = select, Proxies, DIRECT, Manual")

  if (regions.length > 0) lines.push("", "# > Regions")
  for (const region of regions) {
    const filter = region.id === "Other" ? OTHER_REGION_FILTER : region.filter
    lines.push(
      `${region.id} = url-test, ${nodeSource}url=${settings.proxyTestUrl}, interval=${settings.groupTestInterval}, tolerance=${settings.groupTolerance}, timeout=${settings.timeoutSeconds}, policy-regex-filter=${filter}`
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
  lines.push("# > Final", "FINAL,Final", "")

  return {
    content: contentFrom(lines),
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

function isIpLiteral(value: string) {
  const candidate = value.trim()
  const ipv4 = candidate.split(".")
  if (
    ipv4.length === 4 &&
    ipv4.every(
      (part) =>
        /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255
    )
  ) {
    return true
  }
  if (!candidate.includes(":")) return false

  try {
    return new URL(`http://[${candidate}]/`).hostname.length > 0
  } catch {
    return false
  }
}

function isPlainDnsServer(value: string, allowSystem = true) {
  const candidate = value.trim()
  if (allowSystem && candidate.toLocaleLowerCase() === "system") return true
  if (isIpLiteral(candidate)) return true

  const bracketed = candidate.match(/^\[([^\]]+)]:(\d+)$/)
  const ipv4WithPort = candidate.match(/^([^:]+):(\d+)$/)
  const host = bracketed?.[1] ?? ipv4WithPort?.[1]
  const rawPort = bracketed?.[2] ?? ipv4WithPort?.[2]
  if (!host || !rawPort || !isIpLiteral(host)) return false
  const port = Number(rawPort)
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function isEncryptedDnsServer(value: string, protocols: readonly string[]) {
  if (/[\s,]/.test(value)) return false
  const protocol = encryptedDnsProtocol(value)
  return protocol !== "" && protocols.includes(protocol)
}

function controllerEndpoint(value: string) {
  const candidate = value.trim()
  const ipv6 = candidate.match(/^\[([^\]]+)]:(\d+)$/)
  const regular = candidate.match(/^([^:\s/]+):(\d+)$/)
  const host = ipv6?.[1] ?? regular?.[1]
  const rawPort = ipv6?.[2] ?? regular?.[2]
  if (!host || !rawPort) return null
  if (ipv6 && !isIpLiteral(host)) return null
  if (/^\d+(?:\.\d+){3}$/.test(host) && !isIpLiteral(host)) return null

  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return { host: host.toLocaleLowerCase().replace(/\.$/, ""), port }
}

function isLoopbackHost(host: string) {
  return (
    host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host)
  )
}

function hasUnsafeName(value: string) {
  return !value.trim() || UNSAFE_NAME_PATTERN.test(value)
}

function hasPrimaryDns(dnsServers: string[], encryptedServers: string[]) {
  return dnsServers.length > 0 || encryptedServers.length > 0
}

function validateEncryptedDnsServers(
  errors: string[],
  clientName: string,
  servers: string[],
  protocols: readonly string[],
  protocolDescription: string
) {
  if (servers.some((server) => !isEncryptedDnsServer(server, protocols))) {
    errors.push(`${clientName} 加密 DNS 仅支持${protocolDescription}`)
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
    rawNames.some((name) => typeof name !== "string" || hasUnsafeName(name))
  ) {
    errors.push("策略组名称不能为空，也不能包含逗号、等号、注释符或换行")
  }
  if (!isHttpUrl(state.settings.ruleBaseUrl)) {
    errors.push("规则地址必须是有效的 HTTP 或 HTTPS 地址")
  }
  if (!isHttpUrl(state.settings.proxyTestUrl)) {
    errors.push("代理测试地址格式无效")
  }
  if (
    (state.client === "surge" || state.client === "loon") &&
    !isHttpUrl(state.settings.internetTestUrl)
  ) {
    errors.push("联网测试地址格式无效")
  }

  const dnsServers = serverList(state.settings.dnsServers)
  const dohServers = serverList(state.settings.dohServers)
  if (/[\r\n]/.test(state.settings.dnsServers)) {
    errors.push("DNS 服务器不能包含换行")
  }
  if (
    !Number.isInteger(state.settings.groupTestInterval) ||
    state.settings.groupTestInterval < 30
  ) {
    errors.push("地区测速间隔不能小于 30 秒")
  }
  if (
    !Number.isInteger(state.settings.groupTolerance) ||
    state.settings.groupTolerance < 0
  ) {
    errors.push("地区测速容差不能小于 0 毫秒")
  }
  if (
    !Number.isInteger(state.settings.timeoutSeconds) ||
    state.settings.timeoutSeconds < 1
  ) {
    errors.push("测试超时不能小于 1 秒")
  }

  switch (state.client) {
    case "mihomo": {
      const validEncryptedDns = dohServers.filter((server) =>
        isEncryptedDnsServer(server, MIHOMO_ENCRYPTED_DNS_PROTOCOLS)
      )
      const validBootstrapDns = dnsServers.filter(
        (server) =>
          isIpLiteral(server) ||
          isEncryptedDnsServer(server, MIHOMO_ENCRYPTED_DNS_PROTOCOLS)
      )
      validateEncryptedDnsServers(
        errors,
        "Mihomo",
        dohServers,
        MIHOMO_ENCRYPTED_DNS_PROTOCOLS,
        " HTTPS、HTTP/3、QUIC 或 TLS URI"
      )
      if (!hasPrimaryDns(validBootstrapDns, validEncryptedDns)) {
        errors.push("至少需要配置一个主 DNS 服务器")
      }
      if (
        dnsServers.some(
          (server) =>
            !isIpLiteral(server) &&
            !isEncryptedDnsServer(server, MIHOMO_ENCRYPTED_DNS_PROTOCOLS)
        )
      ) {
        errors.push("Mihomo 默认 DNS 只能使用 IP 地址或支持的加密 DNS URI")
      }
      if (!isHttpUrl(state.settings.mihomo.proxyProviderUrl)) {
        errors.push("Mihomo 节点订阅地址必须是有效的 HTTP 或 HTTPS 地址")
      }
      if (
        !Number.isInteger(state.settings.ruleUpdateInterval) ||
        state.settings.ruleUpdateInterval < 60
      ) {
        errors.push("规则更新间隔不能小于 60 秒")
      }
      if (
        !Number.isInteger(state.settings.mihomo.mixedPort) ||
        state.settings.mihomo.mixedPort < 1 ||
        state.settings.mihomo.mixedPort > 65535
      ) {
        errors.push("Mihomo Mixed Port 必须在 1 到 65535 之间")
      }
      if (
        state.settings.mihomo.allowLan &&
        serverList(state.settings.mihomo.lanAllowedIps).length === 0
      ) {
        errors.push("Mihomo 开放局域网时至少需要一个允许网段")
      }
      if (/[\r\n]/.test(state.settings.mihomo.lanAllowedIps)) {
        errors.push("Mihomo 局域网允许网段不能包含换行")
      }
      const endpoint = controllerEndpoint(
        state.settings.mihomo.externalController
      )
      if (!endpoint) {
        errors.push("Mihomo External Controller 必须使用 host:port 格式")
      } else if (
        !isLoopbackHost(endpoint.host) &&
        !state.settings.mihomo.secret.trim()
      ) {
        errors.push("Mihomo External Controller 非本机地址时必须设置 Secret")
      }
      break
    }
    case "surge": {
      const validEncryptedDns = dohServers.filter((server) =>
        isEncryptedDnsServer(server, SURGE_ENCRYPTED_DNS_PROTOCOLS)
      )
      const effectivePlainDns = withSystemDns(
        dnsServers,
        state.settings.surge.includeSystemDns
      )
      const validPlainDns = effectivePlainDns.filter((server) =>
        isPlainDnsServer(server)
      )
      validateEncryptedDnsServers(
        errors,
        "Surge",
        dohServers,
        SURGE_ENCRYPTED_DNS_PROTOCOLS,
        " HTTPS、HTTP/3、QUIC 或 TLS URI"
      )
      if (!hasPrimaryDns(validPlainDns, validEncryptedDns)) {
        errors.push("至少需要配置一个主 DNS 服务器")
      }
      if (dnsServers.some((server) => !isPlainDnsServer(server))) {
        errors.push("Surge 普通 DNS 只能使用 system 或 IP 地址")
      }
      if (!isHttpUrl(state.settings.surge.proxyListUrl)) {
        errors.push("Surge 节点列表地址必须是有效的 HTTP 或 HTTPS 地址")
      }
      if (
        !Number.isInteger(state.settings.ruleUpdateInterval) ||
        state.settings.ruleUpdateInterval < 60
      ) {
        errors.push("规则更新间隔不能小于 60 秒")
      }
      if (
        state.settings.surge.encryptedDnsFollowOutboundMode &&
        validEncryptedDns.length === 0
      ) {
        errors.push("Surge 加密 DNS 跟随代理时至少需要一个加密 DNS 服务器")
      }
      break
    }
    case "loon": {
      const validEncryptedDns = dohServers.filter((server) =>
        isEncryptedDnsServer(server, LOON_ENCRYPTED_DNS_PROTOCOLS)
      )
      const effectivePlainDns = withSystemDns(
        dnsServers,
        state.settings.loon.includeSystemDns
      )
      const validPlainDns = effectivePlainDns.filter((server) =>
        isPlainDnsServer(server)
      )
      validateEncryptedDnsServers(
        errors,
        "Loon",
        dohServers,
        LOON_ENCRYPTED_DNS_PROTOCOLS,
        " HTTPS、HTTP/3 或 QUIC URI"
      )
      if (!hasPrimaryDns(validPlainDns, validEncryptedDns)) {
        errors.push("至少需要配置一个主 DNS 服务器")
      }
      if (dnsServers.some((server) => !isPlainDnsServer(server))) {
        errors.push("Loon 普通 DNS 只能使用 system 或 IP 地址")
      }
      if (!isHttpUrl(state.settings.loon.subscriptionUrl)) {
        errors.push("Loon 节点订阅地址必须是有效的 HTTP 或 HTTPS 地址")
      }
      if (hasUnsafeName(state.settings.loon.subscriptionName)) {
        errors.push("Loon 订阅别名不能为空，也不能包含配置分隔符或注释符")
      }
      if (/[\r\n=]/.test(state.settings.loon.realIp)) {
        errors.push("Loon Real IP 域名不能包含等号或换行")
      }
      break
    }
    case "shadowrocket": {
      const validEncryptedDns = dohServers.filter((server) =>
        isEncryptedDnsServer(server, SHADOWROCKET_ENCRYPTED_DNS_PROTOCOLS)
      )
      const validPlainDns = dnsServers.filter((server) =>
        isPlainDnsServer(server)
      )
      validateEncryptedDnsServers(
        errors,
        "Shadowrocket",
        dohServers,
        SHADOWROCKET_ENCRYPTED_DNS_PROTOCOLS,
        " HTTPS、HTTP/3、QUIC 或 TLS URI"
      )
      if (!hasPrimaryDns(validPlainDns, validEncryptedDns)) {
        errors.push("至少需要配置一个主 DNS 服务器")
      }
      if (dnsServers.some((server) => !isPlainDnsServer(server))) {
        errors.push("Shadowrocket 普通 DNS 只能使用 system 或 IP 地址")
      }
      const rawSubscriptionNames =
        state.settings.shadowrocket.subscriptionNames.trim()
      if (rawSubscriptionNames) {
        const subscriptions = rawSubscriptionNames
          .split(",")
          .map((name) => name.trim())
        if (subscriptions.some((name) => hasUnsafeName(name))) {
          errors.push("Shadowrocket 订阅名称不能留空或包含配置分隔符、注释符")
        }
      }
      const fallbackDnsServers = serverList(
        state.settings.shadowrocket.fallbackDnsServers
      )
      if (
        fallbackDnsServers.some(
          (server) =>
            !isPlainDnsServer(server) &&
            !isEncryptedDnsServer(server, SHADOWROCKET_ENCRYPTED_DNS_PROTOCOLS)
        )
      ) {
        errors.push(
          "Shadowrocket 备用 DNS 只能使用 system、IP 地址或支持的加密 DNS URI"
        )
      }
      break
    }
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
