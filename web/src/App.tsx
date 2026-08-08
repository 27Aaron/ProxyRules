import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Github01Icon,
  GlobalIcon,
  Layers01Icon,
  Moon02Icon,
  RefreshIcon,
  Route01Icon,
  Search01Icon,
  Settings02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { ConfigPreview } from "@/components/config-preview"
import { SettingsPanel } from "@/components/settings-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useConfiguratorState } from "@/hooks/use-configurator-state"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  getSelectedCategoryIds,
  isRegionId,
  renderConfig,
  validateState,
} from "@/lib/renderers"
import {
  CLIENTS,
  FEATURED_GROUPS,
  REGIONS,
  type CatalogEntry,
  type ClientId,
  type FeaturedGroupId,
} from "@/lib/types"

const REPOSITORY_URL = "https://github.com/27Aaron/ProxyRules"
const RuleSearchDialog = React.lazy(() =>
  import("@/components/rule-search-dialog").then((module) => ({
    default: module.RuleSearchDialog,
  }))
)

function uniqueGroupName(base: string, taken: string[]) {
  const normalized = new Set(taken.map((name) => name.toLocaleLowerCase()))
  if (!normalized.has(base.toLocaleLowerCase())) return base

  let index = 2
  while (normalized.has(`${base} ${index}`.toLocaleLowerCase())) index += 1
  return `${base} ${index}`
}

function AppHeader({ onReset }: { onReset: () => void }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="app-header">
      <div className="flex min-w-0 items-center gap-3">
        <div className="brand-mark" aria-hidden="true">
          <HugeiconsIcon icon={Route01Icon} strokeWidth={1.7} />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-heading text-sm font-semibold tracking-tight">
            ProxyRules
          </span>
          <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
            CONFIG STUDIO
          </span>
        </div>
        <Badge variant="outline" className="ml-1 hidden sm:inline-flex">
          纯本地生成
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onReset}>
              <HugeiconsIcon icon={RefreshIcon} />
              <span className="sr-only">恢复默认</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>恢复默认</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <HugeiconsIcon
                icon={resolvedTheme === "dark" ? Sun03Icon : Moon02Icon}
              />
              <span className="sr-only">切换主题</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>切换主题</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                <HugeiconsIcon icon={Github01Icon} />
                <span className="sr-only">打开 GitHub 仓库</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>GitHub 仓库</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

export function App() {
  const { state, setState, reset } = useConfiguratorState()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchMounted, setSearchMounted] = React.useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const result = React.useMemo(() => renderConfig(state), [state])
  const errors = React.useMemo(() => validateState(state), [state])
  const selectedCategoryIds = React.useMemo(
    () => getSelectedCategoryIds(state),
    [state]
  )

  const resetAll = () => {
    reset()
    toast.success("已恢复默认设置")
  }

  const toggleFeatured = (id: FeaturedGroupId, checked: boolean) => {
    const definition = FEATURED_GROUPS.find((group) => group.id === id)!
    const includedCategories = new Set<string>(definition.categories)
    const duplicates = state.customGroups.filter((group) =>
      includedCategories.has(group.categoryId)
    )

    if (checked && duplicates.length > 0) {
      toast.info(
        `已移除重复规则：${duplicates.map((group) => group.categoryId).join("、")}`
      )
    }

    setState((current) => {
      if (!checked) {
        return {
          ...current,
          featuredGroups: current.featuredGroups.filter(
            (group) => group !== id
          ),
        }
      }

      return {
        ...current,
        featuredGroups: current.featuredGroups.includes(id)
          ? current.featuredGroups
          : [...current.featuredGroups, id],
        customGroups: current.customGroups.filter(
          (group) => !includedCategories.has(group.categoryId)
        ),
      }
    })
  }

  const addCustomGroup = (entry: CatalogEntry) => {
    if (selectedCategoryIds.has(entry.id)) {
      toast.info(`${entry.id} 已经包含在当前策略组中`)
      return
    }

    setState((current) => {
      const takenNames = [
        "Proxies",
        "Manual",
        "Final",
        ...current.regions,
        ...current.featuredGroups.map((id) => current.groupNames[id]),
        ...current.customGroups.map((group) => group.name),
      ]
      return {
        ...current,
        customGroups: [
          ...current.customGroups,
          {
            categoryId: entry.id,
            name: uniqueGroupName(entry.label, takenNames),
            path: entry.path,
            rules: entry.rules,
            kind: entry.kind,
          },
        ],
      }
    })
    toast.success(`已添加 ${entry.label}`)
  }

  const controls = (
    <div className="control-column">
      <div className="route-stack">
        <Card className="route-step" data-step="01">
          <CardHeader>
            <CardTitle>选择客户端</CardTitle>
            <CardDescription>输出对应语法和文件后缀。</CardDescription>
            <CardAction>
              <HugeiconsIcon icon={Route01Icon} strokeWidth={1.7} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="single"
              variant="outline"
              value={state.client}
              onValueChange={(value) => {
                if (!value) return
                setState((current) => ({
                  ...current,
                  client: value as ClientId,
                }))
              }}
              className="grid w-full grid-cols-2 sm:grid-cols-4"
              spacing={1}
            >
              {CLIENTS.map((client) => (
                <ToggleGroupItem key={client.id} value={client.id}>
                  {client.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card className="route-step" data-step="02">
          <CardHeader>
            <CardTitle>选择分流地区</CardTitle>
            <CardDescription>
              未选地区不会写入配置；Other 永远排除六个已知地区。
            </CardDescription>
            <CardAction>
              <HugeiconsIcon icon={GlobalIcon} strokeWidth={1.7} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={state.regions}
              onValueChange={(values) =>
                setState((current) => ({
                  ...current,
                  regions: values.filter(isRegionId),
                }))
              }
              className="flex w-full flex-wrap"
              spacing={1}
            >
              {REGIONS.map((region) => (
                <ToggleGroupItem key={region.id} value={region.id}>
                  <span className="font-mono">{region.id}</span>
                  <span className="text-muted-foreground">{region.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card className="route-step" data-step="03">
          <CardHeader>
            <CardTitle>选择策略组</CardTitle>
            <CardDescription>
              常用组直接勾选，其余规则可从完整清单中搜索。
            </CardDescription>
            <CardAction>
              <HugeiconsIcon icon={Layers01Icon} strokeWidth={1.7} />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldSet>
              <FieldLegend className="sr-only">常用策略组</FieldLegend>
              <FieldGroup className="grid gap-2 sm:grid-cols-2">
                {FEATURED_GROUPS.map((group) => {
                  const checked = state.featuredGroups.includes(group.id)
                  return (
                    <Field
                      key={group.id}
                      orientation="horizontal"
                      className="choice-field"
                      data-selected={checked}
                    >
                      <Checkbox
                        id={`featured-${group.id}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleFeatured(group.id, value === true)
                        }
                      />
                      <FieldContent>
                        <FieldLabel htmlFor={`featured-${group.id}`}>
                          {group.name}
                        </FieldLabel>
                        <FieldDescription>{group.description}</FieldDescription>
                      </FieldContent>
                    </Field>
                  )
                })}
              </FieldGroup>
            </FieldSet>

            <Separator />

            <Button
              variant="outline"
              onClick={() => {
                setSearchMounted(true)
                setSearchOpen(true)
              }}
            >
              <HugeiconsIcon icon={Search01Icon} data-icon="inline-start" />
              搜索更多规则
            </Button>

            {state.featuredGroups.length > 0 ||
            state.customGroups.length > 0 ? (
              <FieldSet>
                <FieldLegend variant="label">已选策略组名称</FieldLegend>
                <FieldDescription>名称会直接写入生成的配置。</FieldDescription>
                <FieldGroup>
                  {state.featuredGroups.map((id) => {
                    const definition = FEATURED_GROUPS.find(
                      (group) => group.id === id
                    )!
                    return (
                      <Field key={id} orientation="responsive">
                        <FieldLabel htmlFor={`group-name-${id}`}>
                          {definition.name}
                        </FieldLabel>
                        <Input
                          id={`group-name-${id}`}
                          value={state.groupNames[id]}
                          onChange={(event) =>
                            setState((current) => ({
                              ...current,
                              groupNames: {
                                ...current.groupNames,
                                [id]: event.target.value,
                              },
                            }))
                          }
                        />
                      </Field>
                    )
                  })}

                  {state.customGroups.map((group) => (
                    <Field key={group.categoryId} orientation="responsive">
                      <FieldContent>
                        <FieldTitle>{group.categoryId}</FieldTitle>
                        <FieldDescription>
                          {group.rules.toLocaleString()} 条 · {group.kind}
                        </FieldDescription>
                      </FieldContent>
                      <div className="flex min-w-0 items-center gap-1">
                        <Input
                          aria-label={`${group.categoryId} 策略组名称`}
                          value={group.name}
                          onChange={(event) =>
                            setState((current) => ({
                              ...current,
                              customGroups: current.customGroups.map((item) =>
                                item.categoryId === group.categoryId
                                  ? { ...item, name: event.target.value }
                                  : item
                              ),
                            }))
                          }
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setState((current) => ({
                                  ...current,
                                  customGroups: current.customGroups.filter(
                                    (item) =>
                                      item.categoryId !== group.categoryId
                                  ),
                                }))
                              }
                            >
                              <HugeiconsIcon icon={Delete02Icon} />
                              <span className="sr-only">
                                移除 {group.categoryId}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>移除规则</TooltipContent>
                        </Tooltip>
                      </div>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            ) : null}
          </CardContent>
        </Card>

        <Card className="route-step" data-step="04">
          <CardHeader>
            <CardTitle>调整通用设置</CardTitle>
            <CardDescription>
              只开放模板中已定义且适合可视化编辑的字段。
            </CardDescription>
            <CardAction>
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={1.7} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <SettingsPanel state={state} setState={setState} />
          </CardContent>
          <CardFooter className="border-t">
            <p className="text-xs text-muted-foreground">
              Proxies、Manual 与 Final 为基础策略组，始终保留。
            </p>
          </CardFooter>
        </Card>
      </div>

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>配置需要修正</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader onReset={resetAll} />
      <main className="workspace-shell">
        {isDesktop ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="workspace-panels"
          >
            <ResizablePanel defaultSize="46%" minSize="34%" maxSize="62%">
              {controls}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="54%" minSize="38%">
              <div className="preview-column">
                <ConfigPreview result={result} errors={errors} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex flex-col gap-6">
            {controls}
            <ConfigPreview result={result} errors={errors} />
          </div>
        )}
      </main>

      {searchMounted ? (
        <React.Suspense fallback={null}>
          <RuleSearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            selectedIds={selectedCategoryIds}
            onSelect={addCustomGroup}
          />
        </React.Suspense>
      ) : null}
    </div>
  )
}

export default App
