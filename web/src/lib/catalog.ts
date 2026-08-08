import type { CatalogEntry, RuleKind } from "@/lib/types"

const MANIFEST_URLS = [
  "https://raw.githubusercontent.com/27Aaron/ProxyRules/rules/manifest.json",
  "https://fastly.jsdelivr.net/gh/27Aaron/ProxyRules@rules/manifest.json",
]
const CATALOG_CACHE_KEY = "proxyrules.webui.catalog.v1"
const CATALOG_CACHE_TTL = 6 * 60 * 60 * 1000

const DOMAIN_KEYS = [
  "domain",
  "domain_suffix",
  "domain_keyword",
  "domain_regex",
] as const
const IP_KEYS = ["ipv4", "ipv6"] as const

export const RESERVED_CATEGORIES = new Set([
  "category-ads-all@ads",
  "cn",
  "geolocation-!cn",
  "ip-attribution",
  "ip-attribution-direct",
  "ip-attribution-reject",
  "private",
])

type ManifestFormat = {
  path?: unknown
  rules?: unknown
  counts?: Record<string, unknown>
}

type ManifestCategory = {
  formats?: { list?: ManifestFormat }
  source_counts?: Record<string, unknown>
  action?: unknown
}

type RulesManifest = {
  schema_version?: unknown
  collections?: {
    ruleset?: {
      categories?: Record<string, ManifestCategory>
    }
  }
}

function sumCounts(
  counts: Record<string, unknown> | undefined,
  keys: readonly string[]
) {
  return keys.reduce((total, key) => {
    const value = counts?.[key]
    return total + (typeof value === "number" ? value : 0)
  }, 0)
}

function getRuleKind(counts: Record<string, unknown> | undefined): RuleKind {
  const hasDomain = sumCounts(counts, DOMAIN_KEYS) > 0
  const hasIp = sumCounts(counts, IP_KEYS) > 0

  if (hasDomain && hasIp) return "mixed"
  if (hasIp) return "ip"
  return "domain"
}

export function formatCategoryLabel(id: string) {
  const acronyms: Record<string, string> = {
    ai: "AI",
    api: "API",
    cdn: "CDN",
    cn: "CN",
    dns: "DNS",
    fcm: "FCM",
    hk: "HK",
    ip: "IP",
    jp: "JP",
    tv: "TV",
    uk: "UK",
    us: "US",
  }

  return id
    .split("-")
    .map(
      (part) =>
        acronyms[part] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    )
    .join(" ")
}

export function parseManifest(value: unknown): CatalogEntry[] {
  if (!value || typeof value !== "object") {
    throw new Error("规则清单格式无效")
  }

  const manifest = value as RulesManifest
  if (manifest.schema_version !== 2) {
    throw new Error("暂不支持该规则清单版本")
  }

  const categories = manifest.collections?.ruleset?.categories
  if (!categories || typeof categories !== "object") {
    throw new Error("规则清单缺少 ruleset 分类")
  }

  return Object.entries(categories)
    .flatMap(([id, category]) => {
      const list = category.formats?.list
      if (typeof list?.path !== "string" || typeof list.rules !== "number") {
        return []
      }

      const action =
        category.action === "default" ||
        category.action === "direct" ||
        category.action === "reject"
          ? category.action
          : undefined

      return [
        {
          id,
          label: formatCategoryLabel(id),
          path: list.path,
          rules: list.rules,
          kind: getRuleKind(list.counts ?? category.source_counts),
          attribute: id.includes("@"),
          action,
        } satisfies CatalogEntry,
      ]
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

export async function loadCatalog(signal?: AbortSignal) {
  const cached = readCatalogCache()
  if (cached && Date.now() - cached.savedAt < CATALOG_CACHE_TTL) {
    return cached.entries
  }

  const errors: string[] = []

  for (const url of MANIFEST_URLS) {
    try {
      const response = await fetch(url, { signal, cache: "no-cache" })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const entries = parseManifest(await response.json())
      writeCatalogCache(entries)
      return entries
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (cached) return cached.entries
  throw new Error(`规则清单加载失败：${errors.join("；")}`)
}

export function isReservedCategory(entry: CatalogEntry) {
  return RESERVED_CATEGORIES.has(entry.id) || entry.action !== undefined
}

type CatalogCache = {
  savedAt: number
  entries: CatalogEntry[]
}

function readCatalogCache(): CatalogCache | null {
  try {
    const value = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) ?? "null")
    if (
      !value ||
      typeof value.savedAt !== "number" ||
      !Array.isArray(value.entries)
    ) {
      return null
    }
    return value as CatalogCache
  } catch {
    return null
  }
}

function writeCatalogCache(entries: CatalogEntry[]) {
  try {
    localStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), entries } satisfies CatalogCache)
    )
  } catch {
    // The catalog still works when storage is disabled or full.
  }
}
