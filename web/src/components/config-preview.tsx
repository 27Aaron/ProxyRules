import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Download01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"
import type { RenderResult } from "@/lib/types"

type ConfigPreviewProps = {
  result: RenderResult
  errors: string[]
}

async function copyText(content: string) {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable")
  await navigator.clipboard.writeText(content)
}

export function ConfigPreview({ result, errors }: ConfigPreviewProps) {
  const { t } = useI18n()
  const lines = result.content.split("\n")
  const lineCount = lines.length
  const disabled = errors.length > 0

  const copy = async () => {
    try {
      await copyText(result.content)
      toast.success(t("preview.copied"))
    } catch {
      toast.error(t("preview.copyFailed"))
    }
  }

  const download = () => {
    const blob = new Blob([result.content], { type: result.mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = result.fileName
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(t("preview.downloaded", { file: result.fileName }))
  }

  return (
    <Card className="preview-card h-[calc(100svh-6rem)] min-h-[32rem] lg:h-full lg:min-h-0">
      <CardHeader className="border-b border-border/60">
        <div className="flex min-w-0 items-center">
          <CardTitle className="truncate">{result.fileName}</CardTitle>
        </div>
        <CardAction>
          <Badge variant="outline">
            {t("preview.lines", { count: lineCount })}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden px-0">
        <div className="config-scroll size-full">
          <pre className="config-code">
            <code>
              {lines.map((line, index) => (
                <span className="config-line" key={index}>
                  <span className="config-line-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="config-line-text">{line}</span>
                </span>
              ))}
            </code>
          </pre>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t border-border/60">
        <Button variant="outline" onClick={copy} disabled={disabled}>
          <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
          {t("preview.copy")}
        </Button>
        <Button onClick={download} disabled={disabled}>
          <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
          {t("preview.download")}
        </Button>
      </CardFooter>
    </Card>
  )
}
