import * as React from "react"

import {
  CLIENTS,
  DEFAULT_STATE,
  FEATURED_GROUPS,
  REGIONS,
  type ClientId,
  type ConfiguratorState,
  type CustomGroup,
  type FeaturedGroupId,
  type GeneralSettings,
  type RegionId,
} from "@/lib/types"

const STORAGE_KEY = "proxyrules.webui.config.v1"

function freshState() {
  return structuredClone(DEFAULT_STATE)
}

function readStoredState() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

type StoredRecord = Record<string, unknown>

function asRecord(value: unknown): StoredRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as StoredRecord)
    : {}
}

function restoreString(source: StoredRecord, key: string, fallback: string) {
  return typeof source[key] === "string" ? source[key] : fallback
}

function restoreNumber(source: StoredRecord, key: string, fallback: number) {
  const value = source[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function restoreBoolean(source: StoredRecord, key: string, fallback: boolean) {
  return typeof source[key] === "boolean" ? source[key] : fallback
}

function restoreEnum<const Value extends string>(
  source: StoredRecord,
  key: string,
  values: readonly Value[],
  fallback: Value
) {
  const value = source[key]
  return typeof value === "string" && values.includes(value as Value)
    ? (value as Value)
    : fallback
}

function restoreLoonInterfaceMode(
  value: unknown,
  fallback: GeneralSettings["loon"]["interfaceMode"]
): GeneralSettings["loon"]["interfaceMode"] {
  switch (value) {
    case "Auto":
    case "Cellular":
    case "Performace":
    case "Balance":
      return value
    case "cellular":
      return "Cellular"
    case "auto":
    case "wifi":
      return "Auto"
    default:
      return fallback
  }
}

function restoreState(value: string | null): ConfiguratorState {
  if (!value) return freshState()

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return freshState()
    }

    const saved = parsed as StoredRecord
    if (saved.version !== 1 && saved.version !== 2) return freshState()

    const defaults = freshState()
    const client = CLIENTS.some((item) => item.id === saved.client)
      ? (saved.client as ClientId)
      : defaults.client
    const regions = Array.isArray(saved.regions)
      ? saved.regions.filter(
          (id): id is RegionId =>
            typeof id === "string" && REGIONS.some((region) => region.id === id)
        )
      : []
    const featuredGroups = Array.isArray(saved.featuredGroups)
      ? saved.featuredGroups.filter(
          (id): id is FeaturedGroupId =>
            typeof id === "string" &&
            FEATURED_GROUPS.some((group) => group.id === id)
        )
      : []
    const savedGroupNames = asRecord(saved.groupNames)
    const groupNames = { ...defaults.groupNames }
    for (const group of FEATURED_GROUPS) {
      const name = savedGroupNames[group.id]
      if (typeof name === "string") groupNames[group.id] = name
    }
    const customGroups = Array.isArray(saved.customGroups)
      ? saved.customGroups.flatMap((value): CustomGroup[] => {
          const group = asRecord(value)
          if (
            typeof group.categoryId !== "string" ||
            typeof group.name !== "string" ||
            typeof group.path !== "string" ||
            typeof group.rules !== "number" ||
            !Number.isFinite(group.rules) ||
            (group.kind !== "domain" &&
              group.kind !== "ip" &&
              group.kind !== "mixed")
          ) {
            return []
          }

          return [
            {
              categoryId: group.categoryId,
              name: group.name,
              path: group.path,
              rules: group.rules,
              kind: group.kind,
            },
          ]
        })
      : []

    const savedSettings = asRecord(saved.settings)
    const savedMihomo = asRecord(savedSettings.mihomo)
    const savedSurge = asRecord(savedSettings.surge)
    const savedLoon = asRecord(savedSettings.loon)
    const savedShadowrocket = asRecord(savedSettings.shadowrocket)

    return {
      ...defaults,
      version: 2,
      client,
      regions,
      featuredGroups,
      customGroups,
      groupNames,
      settings: {
        ruleBaseUrl: restoreString(
          savedSettings,
          "ruleBaseUrl",
          defaults.settings.ruleBaseUrl
        ),
        internetTestUrl: restoreString(
          savedSettings,
          "internetTestUrl",
          defaults.settings.internetTestUrl
        ),
        proxyTestUrl: restoreString(
          savedSettings,
          "proxyTestUrl",
          defaults.settings.proxyTestUrl
        ),
        dnsServers: restoreString(
          savedSettings,
          "dnsServers",
          defaults.settings.dnsServers
        ),
        dohServers: restoreString(
          savedSettings,
          "dohServers",
          defaults.settings.dohServers
        ),
        ruleUpdateInterval: restoreNumber(
          savedSettings,
          "ruleUpdateInterval",
          defaults.settings.ruleUpdateInterval
        ),
        groupTestInterval: restoreNumber(
          savedSettings,
          "groupTestInterval",
          defaults.settings.groupTestInterval
        ),
        groupTolerance: restoreNumber(
          savedSettings,
          "groupTolerance",
          defaults.settings.groupTolerance
        ),
        timeoutSeconds: restoreNumber(
          savedSettings,
          "timeoutSeconds",
          defaults.settings.timeoutSeconds
        ),
        ipv6: restoreBoolean(savedSettings, "ipv6", defaults.settings.ipv6),
        blockAds: restoreBoolean(
          savedSettings,
          "blockAds",
          defaults.settings.blockAds
        ),
        directPrivate: restoreBoolean(
          savedSettings,
          "directPrivate",
          defaults.settings.directPrivate
        ),
        directChina: restoreBoolean(
          savedSettings,
          "directChina",
          defaults.settings.directChina
        ),
        mihomo: {
          mixedPort: restoreNumber(
            savedMihomo,
            "mixedPort",
            defaults.settings.mihomo.mixedPort
          ),
          allowLan: restoreBoolean(
            savedMihomo,
            "allowLan",
            defaults.settings.mihomo.allowLan
          ),
          proxyProviderUrl: restoreString(
            savedMihomo,
            "proxyProviderUrl",
            defaults.settings.mihomo.proxyProviderUrl
          ),
          lanAllowedIps: restoreString(
            savedMihomo,
            "lanAllowedIps",
            defaults.settings.mihomo.lanAllowedIps
          ),
          tun: restoreBoolean(savedMihomo, "tun", defaults.settings.mihomo.tun),
          tunStack: restoreEnum(
            savedMihomo,
            "tunStack",
            ["system", "gvisor", "mixed"] as const,
            defaults.settings.mihomo.tunStack
          ),
          strictRoute: restoreBoolean(
            savedMihomo,
            "strictRoute",
            defaults.settings.mihomo.strictRoute
          ),
          respectDnsRules: restoreBoolean(
            savedMihomo,
            "respectDnsRules",
            defaults.settings.mihomo.respectDnsRules
          ),
          sniffer: restoreBoolean(
            savedMihomo,
            "sniffer",
            defaults.settings.mihomo.sniffer
          ),
          logLevel: restoreEnum(
            savedMihomo,
            "logLevel",
            ["silent", "error", "warning", "info", "debug"] as const,
            defaults.settings.mihomo.logLevel
          ),
          externalController: restoreString(
            savedMihomo,
            "externalController",
            defaults.settings.mihomo.externalController
          ),
          secret: restoreString(
            savedMihomo,
            "secret",
            defaults.settings.mihomo.secret
          ),
        },
        surge: {
          logLevel: restoreEnum(
            savedSurge,
            "logLevel",
            ["verbose", "info", "notify", "warning"] as const,
            defaults.settings.surge.logLevel
          ),
          proxyListUrl: restoreString(
            savedSurge,
            "proxyListUrl",
            defaults.settings.surge.proxyListUrl
          ),
          includeSystemDns: restoreBoolean(
            savedSurge,
            "includeSystemDns",
            defaults.settings.surge.includeSystemDns
          ),
          encryptedDnsFollowOutboundMode: restoreBoolean(
            savedSurge,
            "encryptedDnsFollowOutboundMode",
            defaults.settings.surge.encryptedDnsFollowOutboundMode
          ),
          udpPriority: restoreBoolean(
            savedSurge,
            "udpPriority",
            defaults.settings.surge.udpPriority
          ),
          evaluateBeforeUse: restoreBoolean(
            savedSurge,
            "evaluateBeforeUse",
            defaults.settings.surge.evaluateBeforeUse
          ),
        },
        loon: {
          subscriptionName: restoreString(
            savedLoon,
            "subscriptionName",
            defaults.settings.loon.subscriptionName
          ),
          subscriptionUrl: restoreString(
            savedLoon,
            "subscriptionUrl",
            defaults.settings.loon.subscriptionUrl
          ),
          interfaceMode: restoreLoonInterfaceMode(
            savedLoon.interfaceMode,
            defaults.settings.loon.interfaceMode
          ),
          includeSystemDns: restoreBoolean(
            savedLoon,
            "includeSystemDns",
            defaults.settings.loon.includeSystemDns
          ),
          hijackDns: restoreBoolean(
            savedLoon,
            "hijackDns",
            defaults.settings.loon.hijackDns
          ),
          disableStun: restoreBoolean(
            savedLoon,
            "disableStun",
            defaults.settings.loon.disableStun
          ),
          udpFallbackMode: restoreEnum(
            savedLoon,
            "udpFallbackMode",
            ["DIRECT", "REJECT"] as const,
            defaults.settings.loon.udpFallbackMode
          ),
          realIp: restoreString(
            savedLoon,
            "realIp",
            defaults.settings.loon.realIp
          ),
        },
        shadowrocket: {
          subscriptionNames: restoreString(
            savedShadowrocket,
            "subscriptionNames",
            defaults.settings.shadowrocket.subscriptionNames
          ),
          fallbackDnsServers: restoreString(
            savedShadowrocket,
            "fallbackDnsServers",
            defaults.settings.shadowrocket.fallbackDnsServers
          ),
          hijackDns: restoreBoolean(
            savedShadowrocket,
            "hijackDns",
            defaults.settings.shadowrocket.hijackDns
          ),
          excludeCgnat: restoreBoolean(
            savedShadowrocket,
            "excludeCgnat",
            defaults.settings.shadowrocket.excludeCgnat
          ),
        },
      },
    }
  } catch {
    return freshState()
  }
}

export function useConfiguratorState() {
  const [state, setState] = React.useState<ConfiguratorState>(() =>
    restoreState(readStoredState())
  )

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Generation remains available when browser storage is disabled.
    }
  }, [state])

  const reset = React.useCallback(() => setState(freshState()), [])

  return { state, setState, reset }
}
