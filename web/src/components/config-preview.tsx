import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Download01Icon,
  FileCodeIcon,
} from "@hugeicons/core-free-icons"
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
  const lineCount = result.content.split("\n").length
  const disabled = errors.length > 0

  const copy = async () => {
    try {
      await copyText(result.content)
      toast.success("配置已复制")
    } catch {
      toast.error("复制失败，请使用下载功能")
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
    toast.success(`已下载 ${result.fileName}`)
  }

  return (
    <Card className="preview-card h-full min-h-[36rem]">
      <CardHeader className="border-b">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={FileCodeIcon} strokeWidth={1.8} />
          <CardTitle className="truncate">{result.fileName}</CardTitle>
        </div>
        <CardDescription>配置会随左侧选择实时更新。</CardDescription>
        <CardAction>
          <Badge variant="outline">{lineCount} 行</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-0">
        <ScrollArea className="h-full max-h-[calc(100svh-13rem)] min-h-[29rem]">
          <pre className="config-code">
            <code>{result.content}</code>
          </pre>
        </ScrollArea>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t">
        <Button variant="outline" onClick={copy} disabled={disabled}>
          <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
          复制
        </Button>
        <Button onClick={download} disabled={disabled}>
          <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
          下载
        </Button>
      </CardFooter>
    </Card>
  )
}
