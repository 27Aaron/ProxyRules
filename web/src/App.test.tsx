// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import App from "@/App"
import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/lib/i18n"

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
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  })
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  })
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderApp() {
  return render(
    <I18nProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </I18nProvider>
  )
}

function previewContent() {
  return document.querySelector(".config-code code")?.textContent ?? ""
}

describe("Config Studio", () => {
  it("starts with no optional regions or strategy groups", () => {
    renderApp()

    expect(
      screen.getByRole("radio", { name: "Mihomo" }).getAttribute("data-state")
    ).toBe("on")
    expect(
      screen.getByRole("button", { name: "HKG香港" }).getAttribute("data-state")
    ).toBe("off")
    expect(
      screen
        .getByRole("checkbox", { name: "Google" })
        .getAttribute("data-state")
    ).toBe("unchecked")
    expect(previewContent()).not.toContain('name: "HKG"')
    expect(previewContent()).not.toContain("ruleset/google/google.list")
  })

  it("updates the preview from region, policy, and client selections", async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole("button", { name: "HKG香港" }))
    await user.click(screen.getByRole("checkbox", { name: "Google" }))

    await waitFor(() => {
      expect(previewContent()).toContain('name: "HKG"')
      expect(previewContent()).toContain("ruleset/google/google.list")
    })

    await user.click(screen.getByRole("radio", { name: "Surge" }))
    await waitFor(() => {
      expect(screen.getByText("Surge.conf")).toBeTruthy()
      expect(previewContent()).toContain("[General]")
      expect(previewContent()).toContain("Google = select")
    })
  })

  it("restores the empty selection state", async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole("button", { name: "USA美国" }))
    expect(previewContent()).toContain("USA")

    await user.click(screen.getByRole("button", { name: "恢复默认" }))
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "USA美国" })
          .getAttribute("data-state")
      ).toBe("off")
      expect(previewContent()).not.toContain('name: "USA"')
    })
  })

  it("falls back safely when a stored group name is invalid", () => {
    localStorage.setItem(
      "proxyrules.webui.config.v1",
      JSON.stringify({
        version: 1,
        featuredGroups: ["google"],
        groupNames: { google: null },
      })
    )

    renderApp()

    expect(previewContent()).toContain('name: "Google"')
    expect(
      screen
        .getByRole("checkbox", { name: "Google" })
        .getAttribute("data-state")
    ).toBe("checked")
  })
})
