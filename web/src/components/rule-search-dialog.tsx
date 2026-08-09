import * as React from "react"
import { CircleAlertIcon, ListChecksIcon, RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { isReservedCategory, loadCatalog } from "@/lib/catalog"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import type { CatalogEntry } from "@/lib/types"

type RuleSearchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: Set<string>
  removableIds: Set<string>
  onApply: (additions: CatalogEntry[], removedIds: string[]) => void
}

export function RuleSearchDialog({
  open,
  onOpenChange,
  selectedIds,
  removableIds,
  onApply,
}: RuleSearchDialogProps) {
  const { t } = useI18n()
  const [catalog, setCatalog] = React.useState<CatalogEntry[] | null>(null)
  const [error, setError] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [showAttributes, setShowAttributes] = React.useState(false)
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set())
  const [removedIds, setRemovedIds] = React.useState<Set<string>>(new Set())
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

  const isLocked = React.useCallback(
    (id: string) => selectedIds.has(id) && !removableIds.has(id),
    [removableIds, selectedIds]
  )
  const isChecked = React.useCallback(
    (id: string) => {
      if (removableIds.has(id)) return !removedIds.has(id)
      if (selectedIds.has(id)) return true
      return addedIds.has(id)
    },
    [addedIds, removableIds, removedIds, selectedIds]
  )
  const selectableResults = React.useMemo(
    () => results.filter((entry) => !isLocked(entry.id)),
    [isLocked, results]
  )
  const selectedVisibleCount = selectableResults.filter((entry) =>
    isChecked(entry.id)
  ).length
  const allVisibleSelected =
    selectableResults.length > 0 &&
    selectedVisibleCount === selectableResults.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected
  const additions = React.useMemo(
    () => catalog?.filter((entry) => addedIds.has(entry.id)) ?? [],
    [addedIds, catalog]
  )
  const removals = React.useMemo(
    () => [...removedIds].filter((id) => removableIds.has(id)),
    [removableIds, removedIds]
  )
  const hasChanges = additions.length > 0 || removals.length > 0

  const retry = () => {
    setCatalog(null)
    setError("")
    setReloadKey((value) => value + 1)
  }

  const setEntrySelected = (entry: CatalogEntry, checked: boolean) => {
    if (isLocked(entry.id)) return

    if (removableIds.has(entry.id)) {
      setRemovedIds((current) => {
        const next = new Set(current)
        if (checked) next.delete(entry.id)
        else next.add(entry.id)
        return next
      })
      return
    }

    setAddedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(entry.id)
      else next.delete(entry.id)
      return next
    })
  }

  const setVisibleSelected = (checked: boolean) => {
    setAddedIds((current) => {
      const next = new Set(current)
      selectableResults.forEach((entry) => {
        if (removableIds.has(entry.id)) return
        if (checked) next.add(entry.id)
        else next.delete(entry.id)
      })
      return next
    })
    setRemovedIds((current) => {
      const next = new Set(current)
      selectableResults.forEach((entry) => {
        if (!removableIds.has(entry.id)) return
        if (checked) next.delete(entry.id)
        else next.add(entry.id)
      })
      return next
    })
  }

  const resetChanges = () => {
    setAddedIds(new Set())
    setRemovedIds(new Set())
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("")
      resetChanges()
    }
    onOpenChange(nextOpen)
  }

  const saveChanges = () => {
    if (!hasChanges) return
    onApply(additions, removals)
    handleOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("search.heading")}
      description={t("search.help")}
      className="top-1/2 max-h-[calc(100svh-2rem)] -translate-y-1/2 sm:max-w-3xl"
      showCloseButton
      showHeader
    >
      <Command shouldFilter={false} className="min-h-0 rounded-none p-0">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("search.placeholder")}
          wrapperClassName="px-4 py-3"
          autoFocus
        />

        <div className="px-4 py-3">
          <Field orientation="horizontal">
            <Switch
              id="show-attributes"
              checked={showAttributes}
              onCheckedChange={setShowAttributes}
            />
            <FieldContent>
              <FieldLabel htmlFor="show-attributes">
                {t("search.attributes")}
              </FieldLabel>
              <FieldDescription>
                {t("search.attributesDescription")}
              </FieldDescription>
            </FieldContent>
          </Field>
        </div>

        <Separator />

        {error ? (
          <div className="px-4 pb-4">
            <Alert variant="destructive">
              <CircleAlertIcon strokeWidth={1.8} />
              <AlertTitle>{t("search.loadFailed")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCwIcon data-icon="inline-start" />
                {t("search.reload")}
              </Button>
            </Alert>
          </div>
        ) : null}

        {!catalog && !error ? (
          <div
            className="flex flex-col gap-2 px-4 pb-4"
            aria-label={t("search.loading")}
          >
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : null}

        {catalog ? (
          <FieldSet className="min-h-0 flex-1 gap-0">
            <FieldLegend className="sr-only">
              {t("search.results", { count: results.length })}
            </FieldLegend>
            <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
              <Field
                orientation="horizontal"
                className="w-auto"
                data-disabled={selectableResults.length === 0 || undefined}
              >
                <Checkbox
                  id="select-visible-rules"
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  disabled={selectableResults.length === 0}
                  onCheckedChange={(value) =>
                    setVisibleSelected(value === true)
                  }
                />
                <FieldLabel htmlFor="select-visible-rules">
                  {t("search.selectVisible")}
                </FieldLabel>
              </Field>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {t("search.ruleCount", { count: results.length })}
              </span>
            </div>
            <Separator />
            <CommandList className="max-h-[min(50svh,32rem)] min-h-64">
              <CommandEmpty>{t("search.empty")}</CommandEmpty>
              <CommandGroup>
                {results.map((entry) => {
                  const locked = isLocked(entry.id)
                  const added = removableIds.has(entry.id)
                  const checked = isChecked(entry.id)
                  return (
                    <CommandItem
                      key={entry.id}
                      value={`${entry.id} ${entry.label}`}
                      disabled={locked}
                      className="min-h-12 items-start py-2.5"
                      onSelect={() => setEntrySelected(entry, !checked)}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={locked}
                        className="mt-0.5"
                        aria-label={t("search.selectRule", {
                          name: entry.label,
                        })}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(value) =>
                          setEntrySelected(entry, value === true)
                        }
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <FieldTitle className="truncate">
                          {entry.label}
                        </FieldTitle>
                        <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
                          {entry.id}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="outline">
                          {t(`kind.${entry.kind}` as TranslationKey)}
                        </Badge>
                        <Badge
                          variant={
                            locked || (added && checked)
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {locked
                            ? t("search.included")
                            : added && checked
                              ? t("search.added")
                              : t("search.ruleCount", { count: entry.rules })}
                        </Badge>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </FieldSet>
        ) : null}

        <Separator />
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="min-w-0 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {hasChanges
              ? t("search.changeSummary", {
                  added: additions.length,
                  removed: removals.length,
                })
              : t("search.noChanges")}
          </p>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasChanges}
              onClick={resetChanges}
            >
              {t("search.resetChanges")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              {t("search.cancel")}
            </Button>
            <Button size="sm" disabled={!hasChanges} onClick={saveChanges}>
              <ListChecksIcon data-icon="inline-start" />
              {t("search.saveChanges")}
            </Button>
          </div>
        </div>
      </Command>
    </CommandDialog>
  )
}
