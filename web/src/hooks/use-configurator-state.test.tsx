// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { useConfiguratorState } from "@/hooks/use-configurator-state"
import { DEFAULT_SETTINGS } from "@/lib/types"

const STORAGE_KEY = "proxyrules.webui.config.v1"

beforeAll(() => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size
    },
  }

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("useConfiguratorState migration", () => {
  it("migrates version 1 without discarding existing selections and settings", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        client: "loon",
        regions: ["JPN", "invalid"],
        featuredGroups: ["ai"],
        groupNames: { ai: "Machine Learning" },
        settings: {
          groupTestInterval: 420,
          mihomo: { allowLan: true, mixedPort: 7891 },
          loon: { interfaceMode: "wifi" },
          shadowrocket: { bypassSystem: true },
        },
      })
    )

    const { result } = renderHook(() => useConfiguratorState())

    expect(result.current.state).toMatchObject({
      version: 2,
      client: "loon",
      regions: ["JPN"],
      featuredGroups: ["ai"],
      groupNames: { ai: "Machine Learning" },
      settings: {
        groupTestInterval: 420,
        groupTolerance: 100,
        mihomo: { allowLan: true, mixedPort: 7891, tunStack: "mixed" },
        loon: { interfaceMode: "Auto" },
        shadowrocket: {
          subscriptionNames: "",
          fallbackDnsServers: "system",
          hijackDns: false,
          excludeCgnat: false,
        },
      },
    })
    expect(result.current.state.settings.shadowrocket).not.toHaveProperty(
      "bypassSystem"
    )

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null").version
      ).toBe(2)
    })
  })

  it.each([
    ["auto", "Auto"],
    ["cellular", "Cellular"],
    ["wifi", "Auto"],
    ["Performace", "Performace"],
    ["Balance", "Balance"],
  ] as const)("maps the Loon interface mode %s to %s", (saved, expected) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { loon: { interfaceMode: saved } },
      })
    )

    const { result } = renderHook(() => useConfiguratorState())

    expect(result.current.state.settings.loon.interfaceMode).toBe(expected)
  })

  it("restores version 2 client settings and guards malformed nested values", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        settings: {
          groupTolerance: 175,
          mihomo: {
            proxyProviderUrl: "https://example.com/provider.yaml",
            tunStack: "gvisor",
            strictRoute: true,
          },
          surge: null,
          loon: "invalid",
          shadowrocket: {
            subscriptionNames: "Primary, Backup",
            excludeCgnat: true,
          },
        },
      })
    )

    const { result } = renderHook(() => useConfiguratorState())
    const { settings } = result.current.state

    expect(settings.groupTolerance).toBe(175)
    expect(settings.mihomo).toMatchObject({
      proxyProviderUrl: "https://example.com/provider.yaml",
      tunStack: "gvisor",
      strictRoute: true,
    })
    expect(settings.surge).toEqual(DEFAULT_SETTINGS.surge)
    expect(settings.loon).toEqual(DEFAULT_SETTINGS.loon)
    expect(settings.shadowrocket).toMatchObject({
      subscriptionNames: "Primary, Backup",
      excludeCgnat: true,
    })
  })
})
