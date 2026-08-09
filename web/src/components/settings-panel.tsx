import {
  useMemo,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react"

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  errors: string[]
}

type SwitchSettingProps = {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

type ValidatedFieldProps = ComponentProps<typeof Field> & {
  controlId: string
  errors?: string[]
}

const VALIDATION_FIELD_RULES: Array<{
  pattern: RegExp
  fieldIds: string[]
}> = [
  { pattern: /规则地址/, fieldIds: ["rule-base-url"] },
  { pattern: /规则更新间隔/, fieldIds: ["rule-interval"] },
  { pattern: /联网测试地址/, fieldIds: ["internet-test-url"] },
  { pattern: /代理测试地址/, fieldIds: ["proxy-test-url"] },
  { pattern: /地区测速间隔/, fieldIds: ["group-interval"] },
  { pattern: /地区测速容差/, fieldIds: ["group-tolerance"] },
  { pattern: /测试超时/, fieldIds: ["timeout"] },
  { pattern: /Mihomo 节点订阅地址/, fieldIds: ["mihomo-provider-url"] },
  { pattern: /Mihomo Mixed Port/, fieldIds: ["mixed-port"] },
  {
    pattern: /Mihomo External Controller 必须/,
    fieldIds: ["external-controller"],
  },
  { pattern: /Mihomo External Controller 非本机/, fieldIds: ["mihomo-secret"] },
  { pattern: /Mihomo (开放局域网|局域网)/, fieldIds: ["lan-allowed-ips"] },
  { pattern: /Surge 节点列表地址/, fieldIds: ["surge-proxy-list-url"] },
  { pattern: /Loon 节点订阅地址/, fieldIds: ["loon-subscription-url"] },
  { pattern: /Loon 订阅别名/, fieldIds: ["loon-subscription-name"] },
  { pattern: /Loon Real IP/, fieldIds: ["loon-real-ip"] },
  {
    pattern: /Shadowrocket 订阅名称/,
    fieldIds: ["shadowrocket-subscription-names"],
  },
  {
    pattern: /Shadowrocket 备用 DNS/,
    fieldIds: ["shadowrocket-fallback-dns"],
  },
  {
    pattern: /(加密 DNS|主 DNS)/,
    fieldIds: ["dns-servers", "encrypted-dns-servers"],
  },
  {
    pattern: /(DNS 服务器不能|默认 DNS|普通 DNS)/,
    fieldIds: ["dns-servers"],
  },
]

function ValidatedField({
  controlId,
  errors = [],
  children,
  ...props
}: ValidatedFieldProps) {
  const invalid = errors.length > 0

  return (
    <Field data-invalid={invalid} {...props}>
      {children}
      <FieldError
        id={`${controlId}-error`}
        errors={errors.map((message) => ({ message }))}
      />
    </Field>
  )
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function SwitchSetting({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: SwitchSettingProps) {
  return (
    <Field orientation="horizontal">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
    </Field>
  )
}

export function SettingsPanel({ state, setState, errors }: SettingsPanelProps) {
  const { t } = useI18n()
  const errorsByField = useMemo(() => {
    const entries = new Map<string, string[]>()

    for (const error of errors) {
      for (const rule of VALIDATION_FIELD_RULES) {
        if (!rule.pattern.test(error)) continue
        for (const fieldId of rule.fieldIds) {
          const messages = entries.get(fieldId) ?? []
          if (!messages.includes(error)) messages.push(error)
          entries.set(fieldId, messages)
        }
      }
    }

    return entries
  }, [errors])
  const fieldErrors = (fieldId: string) => errorsByField.get(fieldId) ?? []
  const controlValidation = (fieldId: string) => {
    const invalid = fieldErrors(fieldId).length > 0
    return {
      "aria-invalid": invalid || undefined,
      "aria-errormessage": invalid ? `${fieldId}-error` : undefined,
    }
  }
  const updateSettings = (
    updater: (settings: GeneralSettings) => GeneralSettings
  ) => {
    setState((current) => ({
      ...current,
      settings: updater(current.settings),
    }))
  }

  const dnsDescriptionKeys = {
    mihomo: "settings.dnsServersDescriptionMihomo",
    surge: "settings.dnsServersDescriptionSurge",
    loon: "settings.dnsServersDescriptionLoon",
    shadowrocket: "settings.dnsServersDescriptionShadowrocket",
  } as const
  const dnsDescriptionKey = dnsDescriptionKeys[state.client]

  return (
    <Tabs defaultValue="network" className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="network">{t("settings.network")}</TabsTrigger>
        <TabsTrigger value="rules">{t("settings.rules")}</TabsTrigger>
        <TabsTrigger value="client">{t("settings.client")}</TabsTrigger>
      </TabsList>

      <TabsContent value="network">
        <FieldGroup>
          <ValidatedField
            controlId="rule-base-url"
            errors={fieldErrors("rule-base-url")}
          >
            <FieldLabel htmlFor="rule-base-url">
              {t("settings.ruleUrl")}
            </FieldLabel>
            <Input
              id="rule-base-url"
              {...controlValidation("rule-base-url")}
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
          </ValidatedField>

          {state.client === "mihomo" || state.client === "surge" ? (
            <ValidatedField
              controlId="rule-interval"
              errors={fieldErrors("rule-interval")}
            >
              <FieldLabel htmlFor="rule-interval">
                {t("settings.ruleInterval")}
              </FieldLabel>
              <Input
                id="rule-interval"
                {...controlValidation("rule-interval")}
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
              <FieldDescription>
                {t("settings.ruleIntervalDescription")}
              </FieldDescription>
            </ValidatedField>
          ) : null}

          {state.client === "surge" || state.client === "loon" ? (
            <ValidatedField
              controlId="internet-test-url"
              errors={fieldErrors("internet-test-url")}
            >
              <FieldLabel htmlFor="internet-test-url">
                {t("settings.internetUrl")}
              </FieldLabel>
              <Input
                id="internet-test-url"
                {...controlValidation("internet-test-url")}
                value={state.settings.internetTestUrl}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    internetTestUrl: event.target.value,
                  }))
                }
              />
            </ValidatedField>
          ) : null}

          <ValidatedField
            controlId="dns-servers"
            errors={fieldErrors("dns-servers")}
          >
            <FieldLabel htmlFor="dns-servers">
              {t("settings.dnsServers")}
            </FieldLabel>
            <Input
              id="dns-servers"
              {...controlValidation("dns-servers")}
              value={state.settings.dnsServers}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  dnsServers: event.target.value,
                }))
              }
            />
            <FieldDescription>{t(dnsDescriptionKey)}</FieldDescription>
          </ValidatedField>

          <ValidatedField
            controlId="encrypted-dns-servers"
            errors={fieldErrors("encrypted-dns-servers")}
          >
            <FieldLabel htmlFor="encrypted-dns-servers">
              {t("settings.encryptedDns")}
            </FieldLabel>
            <Input
              id="encrypted-dns-servers"
              {...controlValidation("encrypted-dns-servers")}
              value={state.settings.dohServers}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  dohServers: event.target.value,
                }))
              }
            />
            <FieldDescription>
              {t(
                state.client === "loon"
                  ? "settings.encryptedDnsDescriptionLoon"
                  : "settings.encryptedDnsDescription"
              )}
            </FieldDescription>
          </ValidatedField>

          {state.client === "surge" ? (
            <SwitchSetting
              id="surge-include-system-dns"
              label={t("settings.includeSystemDns")}
              description={t("settings.includeSystemDnsDescription")}
              checked={state.settings.surge.includeSystemDns}
              onCheckedChange={(checked) =>
                updateSettings((settings) => ({
                  ...settings,
                  surge: { ...settings.surge, includeSystemDns: checked },
                }))
              }
            />
          ) : null}

          {state.client === "loon" ? (
            <SwitchSetting
              id="loon-include-system-dns"
              label={t("settings.includeSystemDns")}
              description={t("settings.includeSystemDnsDescription")}
              checked={state.settings.loon.includeSystemDns}
              onCheckedChange={(checked) =>
                updateSettings((settings) => ({
                  ...settings,
                  loon: { ...settings.loon, includeSystemDns: checked },
                }))
              }
            />
          ) : null}

          {state.client === "shadowrocket" ? (
            <ValidatedField
              controlId="shadowrocket-fallback-dns"
              errors={fieldErrors("shadowrocket-fallback-dns")}
            >
              <FieldLabel htmlFor="shadowrocket-fallback-dns">
                {t("settings.fallbackDns")}
              </FieldLabel>
              <Input
                id="shadowrocket-fallback-dns"
                {...controlValidation("shadowrocket-fallback-dns")}
                value={state.settings.shadowrocket.fallbackDnsServers}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    shadowrocket: {
                      ...settings.shadowrocket,
                      fallbackDnsServers: event.target.value,
                    },
                  }))
                }
              />
              <FieldDescription>
                {t("settings.fallbackDnsDescription")}
              </FieldDescription>
            </ValidatedField>
          ) : null}

          <SwitchSetting
            id="ipv6"
            label={t("settings.ipv6")}
            description={t("settings.ipv6Description")}
            checked={state.settings.ipv6}
            onCheckedChange={(checked) =>
              updateSettings((settings) => ({ ...settings, ipv6: checked }))
            }
          />
        </FieldGroup>
      </TabsContent>

      <TabsContent value="rules">
        <FieldSet>
          <FieldLegend variant="label">{t("settings.builtin")}</FieldLegend>
          <FieldDescription>
            {t("settings.builtinDescription")}
          </FieldDescription>
          <FieldGroup>
            <SwitchSetting
              id="block-ads"
              label={t("settings.blockAds")}
              description={t("settings.blockAdsDescription")}
              checked={state.settings.blockAds}
              onCheckedChange={(checked) =>
                updateSettings((settings) => ({
                  ...settings,
                  blockAds: checked,
                }))
              }
            />
            <SwitchSetting
              id="direct-private"
              label={t("settings.directPrivate")}
              description={t("settings.directPrivateDescription")}
              checked={state.settings.directPrivate}
              onCheckedChange={(checked) =>
                updateSettings((settings) => ({
                  ...settings,
                  directPrivate: checked,
                }))
              }
            />
            <SwitchSetting
              id="direct-china"
              label={t("settings.directChina")}
              description={t("settings.directChinaDescription")}
              checked={state.settings.directChina}
              onCheckedChange={(checked) =>
                updateSettings((settings) => ({
                  ...settings,
                  directChina: checked,
                }))
              }
            />
          </FieldGroup>
        </FieldSet>
      </TabsContent>

      <TabsContent value="client">
        <FieldGroup>
          {state.client === "mihomo" ? (
            <ValidatedField
              controlId="mihomo-provider-url"
              errors={fieldErrors("mihomo-provider-url")}
            >
              <FieldLabel htmlFor="mihomo-provider-url">
                {t("settings.providerUrl")}
              </FieldLabel>
              <Input
                id="mihomo-provider-url"
                {...controlValidation("mihomo-provider-url")}
                type="url"
                required
                aria-required="true"
                value={state.settings.mihomo.proxyProviderUrl}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    mihomo: {
                      ...settings.mihomo,
                      proxyProviderUrl: event.target.value,
                    },
                  }))
                }
              />
              <FieldDescription>
                {t("settings.providerUrlDescription")}
              </FieldDescription>
            </ValidatedField>
          ) : null}

          {state.client === "surge" ? (
            <ValidatedField
              controlId="surge-proxy-list-url"
              errors={fieldErrors("surge-proxy-list-url")}
            >
              <FieldLabel htmlFor="surge-proxy-list-url">
                {t("settings.proxyListUrl")}
              </FieldLabel>
              <Input
                id="surge-proxy-list-url"
                {...controlValidation("surge-proxy-list-url")}
                type="url"
                required
                aria-required="true"
                value={state.settings.surge.proxyListUrl}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    surge: {
                      ...settings.surge,
                      proxyListUrl: event.target.value,
                    },
                  }))
                }
              />
              <FieldDescription>
                {t("settings.proxyListUrlDescription")}
              </FieldDescription>
            </ValidatedField>
          ) : null}

          {state.client === "loon" ? (
            <FieldGroup className="field-grid-two grid gap-3">
              <ValidatedField
                controlId="loon-subscription-name"
                errors={fieldErrors("loon-subscription-name")}
              >
                <FieldLabel htmlFor="loon-subscription-name">
                  {t("settings.subscriptionName")}
                </FieldLabel>
                <Input
                  id="loon-subscription-name"
                  {...controlValidation("loon-subscription-name")}
                  value={state.settings.loon.subscriptionName}
                  onChange={(event) =>
                    updateSettings((settings) => ({
                      ...settings,
                      loon: {
                        ...settings.loon,
                        subscriptionName: event.target.value,
                      },
                    }))
                  }
                />
                <FieldDescription>
                  {t("settings.subscriptionNameDescription")}
                </FieldDescription>
              </ValidatedField>
              <ValidatedField
                controlId="loon-subscription-url"
                errors={fieldErrors("loon-subscription-url")}
              >
                <FieldLabel htmlFor="loon-subscription-url">
                  {t("settings.subscriptionUrl")}
                </FieldLabel>
                <Input
                  id="loon-subscription-url"
                  {...controlValidation("loon-subscription-url")}
                  type="url"
                  required
                  aria-required="true"
                  value={state.settings.loon.subscriptionUrl}
                  onChange={(event) =>
                    updateSettings((settings) => ({
                      ...settings,
                      loon: {
                        ...settings.loon,
                        subscriptionUrl: event.target.value,
                      },
                    }))
                  }
                />
                <FieldDescription>
                  {t("settings.subscriptionUrlDescription")}
                </FieldDescription>
              </ValidatedField>
            </FieldGroup>
          ) : null}

          {state.client === "shadowrocket" ? (
            <ValidatedField
              controlId="shadowrocket-subscription-names"
              errors={fieldErrors("shadowrocket-subscription-names")}
            >
              <FieldLabel htmlFor="shadowrocket-subscription-names">
                {t("settings.subscriptionNames")}
              </FieldLabel>
              <Input
                id="shadowrocket-subscription-names"
                {...controlValidation("shadowrocket-subscription-names")}
                value={state.settings.shadowrocket.subscriptionNames}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    shadowrocket: {
                      ...settings.shadowrocket,
                      subscriptionNames: event.target.value,
                    },
                  }))
                }
              />
              <FieldDescription>
                {t("settings.subscriptionNamesDescription")}
              </FieldDescription>
            </ValidatedField>
          ) : null}

          <ValidatedField
            controlId="proxy-test-url"
            errors={fieldErrors("proxy-test-url")}
          >
            <FieldLabel htmlFor="proxy-test-url">
              {t("settings.proxyUrl")}
            </FieldLabel>
            <Input
              id="proxy-test-url"
              {...controlValidation("proxy-test-url")}
              value={state.settings.proxyTestUrl}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  proxyTestUrl: event.target.value,
                }))
              }
            />
          </ValidatedField>

          <FieldGroup className="field-grid-three grid gap-3">
            <ValidatedField
              controlId="group-interval"
              errors={fieldErrors("group-interval")}
            >
              <FieldLabel htmlFor="group-interval">
                {t("settings.groupInterval")}
              </FieldLabel>
              <Input
                id="group-interval"
                {...controlValidation("group-interval")}
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
            </ValidatedField>
            <ValidatedField
              controlId="group-tolerance"
              errors={fieldErrors("group-tolerance")}
            >
              <FieldLabel htmlFor="group-tolerance">
                {t("settings.groupTolerance")}
              </FieldLabel>
              <Input
                id="group-tolerance"
                {...controlValidation("group-tolerance")}
                type="number"
                min={0}
                value={state.settings.groupTolerance}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    groupTolerance: positiveInteger(
                      event.target.value,
                      settings.groupTolerance
                    ),
                  }))
                }
              />
            </ValidatedField>
            <ValidatedField controlId="timeout" errors={fieldErrors("timeout")}>
              <FieldLabel htmlFor="timeout">{t("settings.timeout")}</FieldLabel>
              <Input
                id="timeout"
                {...controlValidation("timeout")}
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
            </ValidatedField>
          </FieldGroup>

          {state.client === "mihomo" ? (
            <>
              <FieldGroup className="field-grid-two grid gap-3">
                <ValidatedField
                  controlId="mixed-port"
                  errors={fieldErrors("mixed-port")}
                >
                  <FieldLabel htmlFor="mixed-port">
                    {t("settings.mixedPort")}
                  </FieldLabel>
                  <Input
                    id="mixed-port"
                    {...controlValidation("mixed-port")}
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
                </ValidatedField>
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

              <FieldGroup className="field-grid-two grid gap-3">
                <ValidatedField
                  controlId="external-controller"
                  errors={fieldErrors("external-controller")}
                >
                  <FieldLabel htmlFor="external-controller">
                    {t("settings.externalController")}
                  </FieldLabel>
                  <Input
                    id="external-controller"
                    {...controlValidation("external-controller")}
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
                </ValidatedField>
                <ValidatedField
                  controlId="mihomo-secret"
                  errors={fieldErrors("mihomo-secret")}
                >
                  <FieldLabel htmlFor="mihomo-secret">
                    {t("settings.apiSecret")}
                  </FieldLabel>
                  <Input
                    id="mihomo-secret"
                    {...controlValidation("mihomo-secret")}
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
                </ValidatedField>
              </FieldGroup>

              <SwitchSetting
                id="allow-lan"
                label={t("settings.allowLan")}
                description={t("settings.allowLanDescription")}
                checked={state.settings.mihomo.allowLan}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    mihomo: { ...settings.mihomo, allowLan: checked },
                  }))
                }
              />

              {state.settings.mihomo.allowLan ? (
                <ValidatedField
                  controlId="lan-allowed-ips"
                  errors={fieldErrors("lan-allowed-ips")}
                >
                  <FieldLabel htmlFor="lan-allowed-ips">
                    {t("settings.lanAllowedIps")}
                  </FieldLabel>
                  <Input
                    id="lan-allowed-ips"
                    {...controlValidation("lan-allowed-ips")}
                    value={state.settings.mihomo.lanAllowedIps}
                    onChange={(event) =>
                      updateSettings((settings) => ({
                        ...settings,
                        mihomo: {
                          ...settings.mihomo,
                          lanAllowedIps: event.target.value,
                        },
                      }))
                    }
                  />
                  <FieldDescription>
                    {t("settings.lanAllowedIpsDescription")}
                  </FieldDescription>
                </ValidatedField>
              ) : null}

              <SwitchSetting
                id="tun"
                label={t("settings.tun")}
                description={t("settings.tunDescription")}
                checked={state.settings.mihomo.tun}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    mihomo: { ...settings.mihomo, tun: checked },
                  }))
                }
              />

              {state.settings.mihomo.tun ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="tun-stack">
                      {t("settings.tunStack")}
                    </FieldLabel>
                    <Select
                      value={state.settings.mihomo.tunStack}
                      onValueChange={(value) =>
                        updateSettings((settings) => ({
                          ...settings,
                          mihomo: {
                            ...settings.mihomo,
                            tunStack:
                              value as GeneralSettings["mihomo"]["tunStack"],
                          },
                        }))
                      }
                    >
                      <SelectTrigger id="tun-stack" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(["system", "gvisor", "mixed"] as const).map(
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
                  <SwitchSetting
                    id="strict-route"
                    label={t("settings.strictRoute")}
                    description={t("settings.strictRouteDescription")}
                    checked={state.settings.mihomo.strictRoute}
                    onCheckedChange={(checked) =>
                      updateSettings((settings) => ({
                        ...settings,
                        mihomo: { ...settings.mihomo, strictRoute: checked },
                      }))
                    }
                  />
                </>
              ) : null}

              <SwitchSetting
                id="respect-dns-rules"
                label={t("settings.respectDnsRules")}
                description={t("settings.respectDnsRulesDescription")}
                checked={state.settings.mihomo.respectDnsRules}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    mihomo: { ...settings.mihomo, respectDnsRules: checked },
                  }))
                }
              />
              <SwitchSetting
                id="sniffer"
                label={t("settings.sniffer")}
                description={t("settings.snifferDescription")}
                checked={state.settings.mihomo.sniffer}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    mihomo: { ...settings.mihomo, sniffer: checked },
                  }))
                }
              />
            </>
          ) : null}

          {state.client === "surge" ? (
            <>
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
                        ...settings.surge,
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
              <SwitchSetting
                id="surge-encrypted-dns-follow-outbound"
                label={t("settings.encryptedDnsFollowOutbound")}
                description={t(
                  "settings.encryptedDnsFollowOutboundDescription"
                )}
                checked={state.settings.surge.encryptedDnsFollowOutboundMode}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    surge: {
                      ...settings.surge,
                      encryptedDnsFollowOutboundMode: checked,
                    },
                  }))
                }
              />
              <SwitchSetting
                id="surge-udp-priority"
                label={t("settings.udpPriority")}
                description={t("settings.udpPriorityDescription")}
                checked={state.settings.surge.udpPriority}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    surge: { ...settings.surge, udpPriority: checked },
                  }))
                }
              />
              <SwitchSetting
                id="surge-evaluate-before-use"
                label={t("settings.evaluateBeforeUse")}
                description={t("settings.evaluateBeforeUseDescription")}
                checked={state.settings.surge.evaluateBeforeUse}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    surge: { ...settings.surge, evaluateBeforeUse: checked },
                  }))
                }
              />
            </>
          ) : null}

          {state.client === "loon" ? (
            <>
              <FieldGroup className="field-grid-two grid gap-3">
                <Field>
                  <FieldLabel htmlFor="loon-interface">
                    {t("settings.interfaceMode")}
                  </FieldLabel>
                  <Select
                    value={state.settings.loon.interfaceMode}
                    onValueChange={(value) =>
                      updateSettings((settings) => ({
                        ...settings,
                        loon: {
                          ...settings.loon,
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
                        {(
                          ["Auto", "Cellular", "Performace", "Balance"] as const
                        ).map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="loon-udp-fallback">
                    {t("settings.udpFallback")}
                  </FieldLabel>
                  <Select
                    value={state.settings.loon.udpFallbackMode}
                    onValueChange={(value) =>
                      updateSettings((settings) => ({
                        ...settings,
                        loon: {
                          ...settings.loon,
                          udpFallbackMode:
                            value as GeneralSettings["loon"]["udpFallbackMode"],
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="loon-udp-fallback" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(["DIRECT", "REJECT"] as const).map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t("settings.udpFallbackDescription")}
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <ValidatedField
                controlId="loon-real-ip"
                errors={fieldErrors("loon-real-ip")}
              >
                <FieldLabel htmlFor="loon-real-ip">
                  {t("settings.realIp")}
                </FieldLabel>
                <Input
                  id="loon-real-ip"
                  {...controlValidation("loon-real-ip")}
                  value={state.settings.loon.realIp}
                  onChange={(event) =>
                    updateSettings((settings) => ({
                      ...settings,
                      loon: { ...settings.loon, realIp: event.target.value },
                    }))
                  }
                />
                <FieldDescription>
                  {t("settings.realIpDescription")}
                </FieldDescription>
              </ValidatedField>
              <SwitchSetting
                id="loon-hijack-dns"
                label={t("settings.hijackDns")}
                description={t("settings.hijackDnsDescription")}
                checked={state.settings.loon.hijackDns}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    loon: { ...settings.loon, hijackDns: checked },
                  }))
                }
              />
              <SwitchSetting
                id="loon-disable-stun"
                label={t("settings.disableStun")}
                description={t("settings.disableStunDescription")}
                checked={state.settings.loon.disableStun}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    loon: { ...settings.loon, disableStun: checked },
                  }))
                }
              />
            </>
          ) : null}

          {state.client === "shadowrocket" ? (
            <>
              <SwitchSetting
                id="shadowrocket-hijack-dns"
                label={t("settings.hijackDns")}
                description={t("settings.hijackDnsDescription")}
                checked={state.settings.shadowrocket.hijackDns}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    shadowrocket: {
                      ...settings.shadowrocket,
                      hijackDns: checked,
                    },
                  }))
                }
              />
              <SwitchSetting
                id="shadowrocket-exclude-cgnat"
                label={t("settings.excludeCgnat")}
                description={t("settings.excludeCgnatDescription")}
                checked={state.settings.shadowrocket.excludeCgnat}
                onCheckedChange={(checked) =>
                  updateSettings((settings) => ({
                    ...settings,
                    shadowrocket: {
                      ...settings.shadowrocket,
                      excludeCgnat: checked,
                    },
                  }))
                }
              />
            </>
          ) : null}
        </FieldGroup>
      </TabsContent>
    </Tabs>
  )
}
