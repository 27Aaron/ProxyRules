import * as React from "react"

import {
  CLIENTS,
  DEFAULT_STATE,
  FEATURED_GROUPS,
  REGIONS,
  type ConfiguratorState,
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

function restoreState(value: string | null): ConfiguratorState {
  if (!value) return freshState()

  try {
    const saved = JSON.parse(value) as Partial<ConfiguratorState>
    if (saved.version !== 1) return freshState()

    const defaults = freshState()
    const client = CLIENTS.some((item) => item.id === saved.client)
      ? saved.client!
      : defaults.client
    const regions = Array.isArray(saved.regions)
      ? saved.regions.filter((id) => REGIONS.some((region) => region.id === id))
      : []
    const featuredGroups = Array.isArray(saved.featuredGroups)
      ? saved.featuredGroups.filter((id) =>
          FEATURED_GROUPS.some((group) => group.id === id)
        )
      : []
    const savedGroupNames: Record<string, unknown> =
      saved.groupNames && typeof saved.groupNames === "object"
        ? (saved.groupNames as Record<string, unknown>)
        : {}
    const groupNames = { ...defaults.groupNames }
    for (const group of FEATURED_GROUPS) {
      const name = savedGroupNames[group.id]
      if (typeof name === "string") groupNames[group.id] = name
    }
    const customGroups = Array.isArray(saved.customGroups)
      ? saved.customGroups.filter(
          (group) =>
            group &&
            typeof group.categoryId === "string" &&
            typeof group.name === "string" &&
            typeof group.path === "string" &&
            typeof group.rules === "number" &&
            (group.kind === "domain" ||
              group.kind === "ip" ||
              group.kind === "mixed")
        )
      : []

    return {
      ...defaults,
      client,
      regions,
      featuredGroups,
      customGroups,
      groupNames,
      settings: {
        ...defaults.settings,
        ...saved.settings,
        mihomo: {
          ...defaults.settings.mihomo,
          ...saved.settings?.mihomo,
        },
        surge: {
          ...defaults.settings.surge,
          ...saved.settings?.surge,
        },
        loon: {
          ...defaults.settings.loon,
          ...saved.settings?.loon,
        },
        shadowrocket: {
          ...defaults.settings.shadowrocket,
          ...saved.settings?.shadowrocket,
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
