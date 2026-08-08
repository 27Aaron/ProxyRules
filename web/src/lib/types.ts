export const CLIENTS = [
  { id: "mihomo", label: "Mihomo", fileName: "Clash.yaml" },
  { id: "surge", label: "Surge", fileName: "Surge.conf" },
  { id: "loon", label: "Loon", fileName: "Loon.conf" },
  {
    id: "shadowrocket",
    label: "Shadowrocket",
    fileName: "Shadowrocket.conf",
  },
] as const

export type ClientId = (typeof CLIENTS)[number]["id"]

export const REGIONS = [
  {
    id: "HKG",
    label: "香港",
    filter: "(?i)(🇭🇰|香港|Hong.?Kong|\\bHKG\\b|\\bHK\\b)",
  },
  {
    id: "JPN",
    label: "日本",
    filter: "(?i)(🇯🇵|日本|东京|東京|大阪|Japan|\\bJPN\\b|\\bJP\\b)",
  },
  {
    id: "USA",
    label: "美国",
    filter: "(?i)(🇺🇸|美国|美國|United.?States|America|\\bUSA\\b|\\bUS\\b)",
  },
  {
    id: "SGP",
    label: "新加坡",
    filter: "(?i)(🇸🇬|新加坡|狮城|獅城|Singapore|\\bSGP\\b|\\bSG\\b)",
  },
  {
    id: "TWN",
    label: "台湾",
    filter: "(?i)(🇹🇼|台湾|臺灣|Taiwan|\\bTWN\\b|\\bTW\\b)",
  },
  {
    id: "KOR",
    label: "韩国",
    filter: "(?i)(🇰🇷|韩国|韓國|首尔|首爾|Korea|Seoul|\\bKOR\\b|\\bKR\\b)",
  },
  { id: "Other", label: "其他", filter: ".*" },
] as const

export type RegionId = (typeof REGIONS)[number]["id"]

export const FEATURED_GROUPS = [
  {
    id: "ai",
    name: "AI",
    description: "Anthropic、Gemini、OpenAI 与 xAI",
    categories: ["anthropic", "google-gemini", "openai", "xai"],
  },
  {
    id: "google",
    name: "Google",
    description: "Google 相关服务",
    categories: ["google"],
  },
  {
    id: "apple",
    name: "Apple",
    description: "Apple 与 Push 相关服务",
    categories: ["apple", "apple-push"],
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Telegram 相关服务",
    categories: ["telegram"],
  },
  {
    id: "twitter",
    name: "Twitter",
    description: "X（Twitter）相关服务",
    categories: ["twitter"],
  },
  {
    id: "ip-attribution",
    name: "IP Attribution",
    description: "IP 归属与分流检测",
    categories: ["ip-attribution"],
  },
] as const

export type FeaturedGroupId = (typeof FEATURED_GROUPS)[number]["id"]

export type RuleKind = "domain" | "ip" | "mixed"

export type CatalogEntry = {
  id: string
  label: string
  path: string
  rules: number
  kind: RuleKind
  attribute: boolean
  action?: "default" | "direct" | "reject"
}

export type CustomGroup = {
  categoryId: string
  name: string
  path: string
  rules: number
  kind: RuleKind
}

export type GeneralSettings = {
  ruleBaseUrl: string
  internetTestUrl: string
  proxyTestUrl: string
  dnsServers: string
  dohServers: string
  ruleUpdateInterval: number
  groupTestInterval: number
  groupTolerance: number
  timeoutSeconds: number
  ipv6: boolean
  blockAds: boolean
  directPrivate: boolean
  directChina: boolean
  mihomo: {
    mixedPort: number
    allowLan: boolean
    proxyProviderUrl: string
    lanAllowedIps: string
    tun: boolean
    tunStack: "system" | "gvisor" | "mixed"
    strictRoute: boolean
    respectDnsRules: boolean
    sniffer: boolean
    logLevel: "silent" | "error" | "warning" | "info" | "debug"
    externalController: string
    secret: string
  }
  surge: {
    logLevel: "verbose" | "info" | "notify" | "warning"
    proxyListUrl: string
    includeSystemDns: boolean
    encryptedDnsFollowOutboundMode: boolean
    udpPriority: boolean
    evaluateBeforeUse: boolean
  }
  loon: {
    subscriptionName: string
    subscriptionUrl: string
    interfaceMode: "Auto" | "Cellular" | "Performace" | "Balance"
    includeSystemDns: boolean
    hijackDns: boolean
    disableStun: boolean
    udpFallbackMode: "DIRECT" | "REJECT"
    realIp: string
  }
  shadowrocket: {
    subscriptionNames: string
    fallbackDnsServers: string
    hijackDns: boolean
    excludeCgnat: boolean
  }
}

export type ConfiguratorState = {
  version: 2
  client: ClientId
  regions: RegionId[]
  featuredGroups: FeaturedGroupId[]
  groupNames: Record<FeaturedGroupId, string>
  customGroups: CustomGroup[]
  settings: GeneralSettings
}

export type StrategyGroup = {
  id: string
  name: string
  categories: RuleBinding[]
  special?: "ip-attribution"
}

export type RuleBinding = {
  id: string
  path: string
  policy: string
  action?: "default" | "direct" | "reject"
}

export type RenderResult = {
  content: string
  fileName: string
  mimeType: string
}

export const DEFAULT_SETTINGS: GeneralSettings = {
  ruleBaseUrl: "https://fastly.jsdelivr.net/gh/27Aaron/ProxyRules@rules",
  internetTestUrl: "https://cp.cloudflare.com/generate_204",
  proxyTestUrl: "https://www.gstatic.com/generate_204",
  dnsServers: "223.5.5.5, 119.29.29.29",
  dohServers: "https://doh.pub/dns-query, https://dns.alidns.com/dns-query",
  ruleUpdateInterval: 86400,
  groupTestInterval: 600,
  groupTolerance: 100,
  timeoutSeconds: 5,
  ipv6: true,
  blockAds: true,
  directPrivate: true,
  directChina: true,
  mihomo: {
    mixedPort: 7890,
    allowLan: false,
    proxyProviderUrl: "",
    lanAllowedIps: "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16",
    tun: true,
    tunStack: "mixed",
    strictRoute: false,
    respectDnsRules: false,
    sniffer: false,
    logLevel: "info",
    externalController: "127.0.0.1:9090",
    secret: "",
  },
  surge: {
    logLevel: "notify",
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
}

export const DEFAULT_GROUP_NAMES = Object.fromEntries(
  FEATURED_GROUPS.map((group) => [group.id, group.name])
) as Record<FeaturedGroupId, string>

export const DEFAULT_STATE: ConfiguratorState = {
  version: 2,
  client: "mihomo",
  regions: [],
  featuredGroups: [],
  groupNames: { ...DEFAULT_GROUP_NAMES },
  customGroups: [],
  settings: structuredClone(DEFAULT_SETTINGS),
}
