import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Download01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useI18n } from "@/lib/i18n"
import type { RenderResult } from "@/lib/types"

type ConfigPreviewProps = {
  result: RenderResult
  errors: string[]
}

async function copyText(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = content
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("copy failed")
}

export function ConfigPreview({ result, errors }: ConfigPreviewProps) {
  const { t } = useI18n()
  const lineCount = result.content.split("\n").length
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
    <Card className="preview-card h-full min-h-[36rem]">
      <CardHeader className="border-b border-border/60">
        <div className="flex min-w-0 items-center">
          <CardTitle className="truncate">{result.fileName}</CardTitle>
        </div>
        <CardDescription>{t("preview.description")}</CardDescription>
        <CardAction>
          <Badge variant="outline">
            {t("preview.lines", { count: lineCount })}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-0">
        <ScrollArea className="h-full max-h-[calc(100svh-13rem)] min-h-[29rem]">
          <pre className="config-code">
            <code>{result.content}</code>
          </pre>
        </ScrollArea>
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
