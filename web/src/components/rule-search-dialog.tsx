import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DatabaseSearchIcon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { CommandDialog } from "@/components/ui/command"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { isReservedCategory, loadCatalog } from "@/lib/catalog"
import type { CatalogEntry } from "@/lib/types"

type RuleSearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: Set<string>
  onSelect: (entry: CatalogEntry) => void
}

const KIND_LABELS = {
  domain: "域名",
  ip: "IP",
  mixed: "域名 + IP",
} as const

export function RuleSearchDialog({
  open,
  onOpenChange,
  selectedIds,
  onSelect,
}: RuleSearchDialogProps) {
  const [catalog, setCatalog] = React.useState<CatalogEntry[] | null>(null)
  const [error, setError] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [showAttributes, setShowAttributes] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (!open || catalog) return

    const controller = new AbortController()
    loadCatalog(controller.signal)
      .then((entries) => {
        setCatalog(entries)
        setError("")
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return
        setError(reason instanceof Error ? reason.message : String(reason))
      })

    return () => controller.abort()
  }, [open, catalog, reloadKey])

  const results = React.useMemo(() => {
    if (!catalog) return []
    const normalizedQuery = query.trim().toLocaleLowerCase()

    return catalog
      .filter((entry) => !isReservedCategory(entry))
      .filter((entry) => showAttributes || !entry.attribute)
      .filter(
        (entry) =>
          normalizedQuery === "" ||
          entry.id.toLocaleLowerCase().includes(normalizedQuery) ||
          entry.label.toLocaleLowerCase().includes(normalizedQuery)
      )
      .slice(0, normalizedQuery === "" ? 80 : 160)
  }, [catalog, query, showAttributes])

  const retry = () => {
    setCatalog(null)
    setError("")
    setReloadKey((value) => value + 1)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="搜索规则"
      description="从 rules 分支的 manifest.json 中查找完整 ruleset。"
      className="sm:max-w-2xl"
      showCloseButton
    >
      <div className="flex items-start gap-3 px-3 pt-3">
        <div className="route-icon" aria-hidden="true">
          <HugeiconsIcon icon={DatabaseSearchIcon} strokeWidth={1.8} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-heading text-base font-semibold">
            添加独立策略组
          </h2>
          <p className="text-xs text-muted-foreground">
            选中一条规则后，将自动创建同名策略组并接入完整 ruleset。
          </p>
        </div>
      </div>

      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="搜索 Netflix、Spotify、YouTube…"
          autoFocus
        />

        <div className="px-3 py-2">
          <Field orientation="horizontal">
            <Switch
              id="show-attributes"
              checked={showAttributes}
              onCheckedChange={setShowAttributes}
            />
            <FieldContent>
              <FieldLabel htmlFor="show-attributes">显示属性子集</FieldLabel>
              <FieldDescription>
                包含带有 @ads、@cn 等属性的细分规则。
              </FieldDescription>
            </FieldContent>
          </Field>
        </div>

        {error ? (
          <div className="px-3 pb-3">
            <Alert variant="destructive">
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={1.8} />
              <AlertTitle>无法读取规则清单</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" onClick={retry}>
                <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
                重新加载
              </Button>
            </Alert>
          </div>
        ) : null}

        {!catalog && !error ? (
          <div
            className="flex flex-col gap-2 px-3 pb-3"
            aria-label="正在加载规则"
          >
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : null}

        {catalog ? (
          <CommandList>
            <CommandEmpty>没有找到匹配的规则。</CommandEmpty>
            <CommandGroup heading={`规则分类 · 显示 ${results.length} 条`}>
              {results.map((entry) => {
                const selected = selectedIds.has(entry.id)
                return (
                  <CommandItem
                    key={entry.id}
                    value={`${entry.id} ${entry.label}`}
                    disabled={selected}
                    onSelect={() => {
                      if (selected) return
                      onSelect(entry)
                      onOpenChange(false)
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <FieldTitle className="truncate">
                        {entry.label}
                      </FieldTitle>
                      <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
                        {entry.id}
                      </span>
                    </div>
                    <Badge variant="outline">{KIND_LABELS[entry.kind]}</Badge>
                    <Badge variant={selected ? "secondary" : "outline"}>
                      {selected ? "已包含" : entry.rules.toLocaleString()}
                    </Badge>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        ) : null}
      </Command>
    </CommandDialog>
  )
}
