import type { Dispatch, SetStateAction } from "react"

import { Input } from "@/components/ui/input"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/lib/i18n"
import type { ConfiguratorState, GeneralSettings } from "@/lib/types"

type SettingsPanelProps = {
  state: ConfiguratorState
  setState: Dispatch<SetStateAction<ConfiguratorState>>
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function SettingsPanel({ state, setState }: SettingsPanelProps) {
  const { t } = useI18n()
  const updateSettings = (
    updater: (settings: GeneralSettings) => GeneralSettings
  ) => {
    setState((current) => ({
      ...current,
      settings: updater(current.settings),
    }))
  }

  return (
    <Tabs defaultValue="network">
      <TabsList className="w-full">
        <TabsTrigger value="network">{t("settings.network")}</TabsTrigger>
        <TabsTrigger value="rules">{t("settings.rules")}</TabsTrigger>
        <TabsTrigger value="client">{t("settings.client")}</TabsTrigger>
      </TabsList>

      <TabsContent value="network">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="rule-base-url">
              {t("settings.ruleUrl")}
            </FieldLabel>
            <Input
              id="rule-base-url"
              value={state.settings.ruleBaseUrl}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  ruleBaseUrl: event.target.value,
                }))
              }
            />
            <FieldDescription>
              {t("settings.ruleUrlDescription")}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="internet-test-url">
              {t("settings.internetUrl")}
            </FieldLabel>
            <Input
              id="internet-test-url"
              value={state.settings.internetTestUrl}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  internetTestUrl: event.target.value,
                }))
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="proxy-test-url">
              {t("settings.proxyUrl")}
            </FieldLabel>
            <Input
              id="proxy-test-url"
              value={state.settings.proxyTestUrl}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  proxyTestUrl: event.target.value,
                }))
              }
            />
          </Field>

          <FieldGroup className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="rule-interval">
                {t("settings.ruleInterval")}
              </FieldLabel>
              <Input
                id="rule-interval"
                type="number"
                min={60}
                value={state.settings.ruleUpdateInterval}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    ruleUpdateInterval: positiveInteger(
                      event.target.value,
                      settings.ruleUpdateInterval
                    ),
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="group-interval">
                {t("settings.groupInterval")}
              </FieldLabel>
              <Input
                id="group-interval"
                type="number"
                min={30}
                value={state.settings.groupTestInterval}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    groupTestInterval: positiveInteger(
                      event.target.value,
                      settings.groupTestInterval
                    ),
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="timeout">{t("settings.timeout")}</FieldLabel>
              <Input
                id="timeout"
                type="number"
                min={1}
                value={state.settings.timeoutSeconds}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    timeoutSeconds: positiveInteger(
                      event.target.value,
                      settings.timeoutSeconds
                    ),
                  }))
                }
              />
            </Field>
          </FieldGroup>
        </FieldGroup>
      </TabsContent>

      <TabsContent value="rules">
        <FieldSet>
          <FieldLegend variant="label">{t("settings.builtin")}</FieldLegend>
          <FieldDescription>
            {t("settings.builtinDescription")}
          </FieldDescription>
          <FieldGroup>
            <Field orientation="horizontal">
              <Switch
                id="block-ads"
                checked={state.settings.blockAds}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    blockAds: checked,
                  }))
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="block-ads">
                  {t("settings.blockAds")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings.blockAdsDescription")}
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <Switch
                id="direct-private"
                checked={state.settings.directPrivate}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    directPrivate: checked,
                  }))
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="direct-private">
                  {t("settings.directPrivate")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings.directPrivateDescription")}
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <Switch
                id="direct-china"
                checked={state.settings.directChina}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    directChina: checked,
                  }))
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="direct-china">
                  {t("settings.directChina")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings.directChinaDescription")}
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </FieldSet>
      </TabsContent>

      <TabsContent value="client">
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch
              id="ipv6"
              checked={state.settings.ipv6}
              onCheckedChange={(checked) =>
                updateSettings((settings) => ({ ...settings, ipv6: checked }))
              }
            />
            <FieldContent>
              <FieldLabel htmlFor="ipv6">{t("settings.ipv6")}</FieldLabel>
              <FieldDescription>
                {t("settings.ipv6Description")}
              </FieldDescription>
            </FieldContent>
          </Field>

          {state.client === "mihomo" ? (
            <>
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="mixed-port">Mixed Port</FieldLabel>
                  <Input
                    id="mixed-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={state.settings.mihomo.mixedPort}
                    onChange={(event) =>
                      updateSettings((settings) => ({
                        ...settings,
                        mihomo: {
                          ...settings.mihomo,
                          mixedPort: positiveInteger(
                            event.target.value,
                            settings.mihomo.mixedPort
                          ),
                        },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="mihomo-log-level">
                    {t("settings.logLevel")}
                  </FieldLabel>
                  <Select
                    value={state.settings.mihomo.logLevel}
                    onValueChange={(value) =>
                      updateSettings((settings) => ({
                        ...settings,
                        mihomo: {
                          ...settings.mihomo,
                          logLevel:
                            value as GeneralSettings["mihomo"]["logLevel"],
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="mihomo-log-level" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(
                          [
                            "silent",
                            "error",
                            "warning",
                            "info",
                            "debug",
                          ] as const
                        ).map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <Field>
                <FieldLabel htmlFor="external-controller">
                  External Controller
                </FieldLabel>
                <Input
                  id="external-controller"
                  value={state.settings.mihomo.externalController}
                  onChange={(event) =>
                    updateSettings((settings) => ({
                      ...settings,
                      mihomo: {
                        ...settings.mihomo,
                        externalController: event.target.value,
                      },
                    }))
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="mihomo-secret">API Secret</FieldLabel>
                <Input
                  id="mihomo-secret"
                  value={state.settings.mihomo.secret}
                  autoComplete="off"
                  onChange={(event) =>
                    updateSettings((settings) => ({
                      ...settings,
                      mihomo: {
                        ...settings.mihomo,
                        secret: event.target.value,
                      },
                    }))
                  }
                />
                <FieldDescription>
                  {t("settings.secretDescription")}
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <Switch
                  id="allow-lan"
                  checked={state.settings.mihomo.allowLan}
                  onCheckedChange={(checked) =>
                    updateSettings((settings) => ({
                      ...settings,
                      mihomo: { ...settings.mihomo, allowLan: checked },
                    }))
                  }
                />
                <FieldLabel htmlFor="allow-lan">
                  {t("settings.allowLan")}
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id="tun"
                  checked={state.settings.mihomo.tun}
                  onCheckedChange={(checked) =>
                    updateSettings((settings) => ({
                      ...settings,
                      mihomo: { ...settings.mihomo, tun: checked },
                    }))
                  }
                />
                <FieldLabel htmlFor="tun">{t("settings.tun")}</FieldLabel>
              </Field>
            </>
          ) : null}

          {state.client === "surge" ? (
            <Field>
              <FieldLabel htmlFor="surge-log-level">
                {t("settings.logLevel")}
              </FieldLabel>
              <Select
                value={state.settings.surge.logLevel}
                onValueChange={(value) =>
                  updateSettings((settings) => ({
                    ...settings,
                    surge: {
                      logLevel: value as GeneralSettings["surge"]["logLevel"],
                    },
                  }))
                }
              >
                <SelectTrigger id="surge-log-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(["verbose", "info", "notify", "warning"] as const).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {state.client === "loon" ? (
            <Field>
              <FieldLabel htmlFor="loon-interface">Interface Mode</FieldLabel>
              <Select
                value={state.settings.loon.interfaceMode}
                onValueChange={(value) =>
                  updateSettings((settings) => ({
                    ...settings,
                    loon: {
                      interfaceMode:
                        value as GeneralSettings["loon"]["interfaceMode"],
                    },
                  }))
                }
              >
                <SelectTrigger id="loon-interface" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(["auto", "cellular", "wifi"] as const).map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {state.client === "shadowrocket" ? (
            <Field orientation="horizontal">
              <Switch
                id="bypass-system"
                checked={state.settings.shadowrocket.bypassSystem}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    shadowrocket: { bypassSystem: checked },
                  }))
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="bypass-system">
                  {t("settings.bypassSystem")}
                </FieldLabel>
                <FieldDescription>
                  {t("settings.bypassSystemDescription")}
                </FieldDescription>
              </FieldContent>
            </Field>
          ) : null}
        </FieldGroup>
      </TabsContent>
    </Tabs>
  )
}
