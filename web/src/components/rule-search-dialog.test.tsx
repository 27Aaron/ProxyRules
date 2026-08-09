// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RuleSearchDialog } from "@/components/rule-search-dialog"
import { I18nProvider } from "@/lib/i18n"

const catalog = vi.hoisted(() => [
  {
    id: "existing",
    label: "Existing",
    path: "ruleset/existing/existing.list",
    rules: 5,
    kind: "domain" as const,
    attribute: false,
  },
  {
    id: "locked",
    label: "Locked",
    path: "ruleset/locked/locked.list",
    rules: 6,
    kind: "domain" as const,
    attribute: false,
  },
  {
    id: "netflix",
    label: "Netflix",
    path: "ruleset/netflix/netflix.list",
    rules: 12,
    kind: "domain" as const,
    attribute: false,
  },
  {
    id: "spotify",
    label: "Spotify",
    path: "ruleset/spotify/spotify.list",
    rules: 8,
    kind: "mixed" as const,
    attribute: false,
  },
])

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>()
  return {
    ...actual,
    loadCatalog: vi.fn(async () => catalog),
  }
})

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
  vi.clearAllMocks()
})

describe("RuleSearchDialog", () => {
  it("adds multiple rules and removes a previously added rule", async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <I18nProvider>
        <RuleSearchDialog
          open
          onOpenChange={onOpenChange}
          selectedIds={new Set(["existing", "locked"])}
          removableIds={new Set(["existing"])}
          onApply={onApply}
        />
      </I18nProvider>
    )

    const existing = await screen.findByRole("checkbox", {
      name: "选择 Existing",
    })
    expect((existing as HTMLButtonElement).disabled).toBe(false)
    expect(existing.getAttribute("data-state")).toBe("checked")

    const locked = screen.getByRole("checkbox", { name: "选择 Locked" })
    expect((locked as HTMLButtonElement).disabled).toBe(true)
    expect(locked.getAttribute("data-state")).toBe("checked")

    await user.click(existing)
    await user.click(screen.getByRole("checkbox", { name: "选择 Netflix" }))
    await user.click(screen.getByRole("checkbox", { name: "选择 Spotify" }))

    expect(screen.getByText("将添加 2 个，移除 1 个")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "保存更改" }))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(
      onApply.mock.calls[0][0].map((entry: { id: string }) => entry.id)
    ).toEqual(["netflix", "spotify"])
    expect(onApply.mock.calls[0][1]).toEqual(["existing"])
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
})
