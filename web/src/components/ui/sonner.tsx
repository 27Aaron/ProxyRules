import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Alert02Icon,
  MultiplicationSignCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

import { useI18n, type TranslationKey } from "@/lib/i18n"

const REGION_LABELS = [
  ["HKG", "region.HKG"],
  ["JPN", "region.JPN"],
  ["USA", "region.USA"],
  ["SGP", "region.SGP"],
  ["TWN", "region.TWN"],
  ["KOR", "region.KOR"],
  ["Other", "region.Other"],
] as const satisfies readonly (readonly [string, TranslationKey])[]

const CLIENT_NAMES = ["Mihomo", "Surge", "Loon", "Shadowrocket"]
const GROUP_NAMES = [
  "AI",
  "Google",
  "Apple",
  "Telegram",
  "Twitter",
  "IP Attribution",
]

function measuredToastWidth(messages: string[]) {
  if (typeof document === "undefined") return 304
  const context = document.createElement("canvas").getContext("2d")
  if (!context) return 304
  context.font =
    '500 13px "Instrument Sans Variable", "PingFang SC", "Microsoft YaHei", sans-serif'
  const textWidth = Math.max(
    ...messages.map((message) => context.measureText(message).width)
  )
  return Math.ceil(Math.min(344, Math.max(248, textWidth + 72)))
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const { t } = useI18n()
  const messages = React.useMemo(() => {
    const regions = REGION_LABELS.map(([id, key]) => `${id} ${t(key)}`)
    return [
      t("toast.reset"),
      ...CLIENT_NAMES.map((client) =>
        t("toast.clientSwitched", { client })
      ),
      ...regions.flatMap((region) => [
        t("toast.regionAdded", { region }),
        t("toast.regionRemoved", { region }),
      ]),
      ...GROUP_NAMES.flatMap((group) => [
        t("toast.groupAdded", { group }),
        t("toast.groupRemoved", { group }),
      ]),
    ]
  }, [t])
  const width = React.useMemo(() => measuredToastWidth(messages), [messages])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-4 animate-spin"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": `${width}px`,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
