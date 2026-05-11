import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { PROXY_TYPES, type Proxy, type ProxyType } from "@frp-manager/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const proxySchema = z
  .object({
    name: z
      .string()
      .min(1, "名称不能为空")
      .regex(/^[a-zA-Z0-9_-]+$/, "只能包含字母、数字、下划线、横线"),
    type: z.enum(PROXY_TYPES as [ProxyType, ...ProxyType[]]),
    localIp: z.string().min(1, "本地 IP 不能为空"),
    localPort: z.coerce.number().int().min(1).max(65535),
    remotePort: z.coerce.number().int().min(1).max(65535).optional(),
    customDomains: z.string().optional(),
  })
  .refine((v) => v.type !== "tcp" || v.remotePort != null, {
    path: ["remotePort"],
    message: "tcp 类型必须填写远程端口",
  })
  .refine(
    (v) => !(v.type === "http" || v.type === "https") || !!v.customDomains?.trim(),
    {
      path: ["customDomains"],
      message: "http/https 必须配置至少一个自定义域名",
    },
  )

type FormInput = z.input<typeof proxySchema>
type FormOutput = z.output<typeof proxySchema>

interface ProxyFormProps {
  defaultValue?: Proxy
  submitText?: string
  onCancel?: () => void
  onSubmit: (proxy: Proxy) => Promise<void> | void
}

export function ProxyForm({ defaultValue, submitText = "保存", onCancel, onSubmit }: ProxyFormProps) {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      name: defaultValue?.name ?? "",
      type: defaultValue?.type ?? "tcp",
      localIp: defaultValue?.localIp ?? "127.0.0.1",
      localPort: defaultValue?.localPort ?? 80,
      remotePort: defaultValue?.remotePort,
      customDomains: defaultValue?.customDomains?.join(", ") ?? "",
    },
  })

  const type = form.watch("type")
  const isTcp = type === "tcp"
  const isWeb = type === "http" || type === "https"

  const handleSubmit = form.handleSubmit(async (values) => {
    const proxy: Proxy = {
      name: values.name,
      type: values.type,
      localIp: values.localIp,
      localPort: values.localPort,
      remotePort: isTcp ? values.remotePort : undefined,
      customDomains: isWeb
        ? values.customDomains?.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    }
    await onSubmit(proxy)
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <SectionTitle>基础信息</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="名称" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} placeholder="例如：ssh" autoComplete="off" />
          </Field>

          <Field label="类型" error={form.formState.errors.type?.message}>
            <Select
              value={type}
              onValueChange={(v: string) =>
                form.setValue("type", v as ProxyType, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROXY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <SectionTitle>端点信息</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Field label="本地 IP" error={form.formState.errors.localIp?.message}>
            <Input {...form.register("localIp")} placeholder="127.0.0.1" autoComplete="off" />
          </Field>

          <Field label="本地端口" error={form.formState.errors.localPort?.message}>
            <Input
              type="number"
              min={1}
              max={65535}
              {...form.register("localPort")}
              placeholder="22"
            />
          </Field>

          {isTcp && (
            <Field
              label="远程端口"
              error={form.formState.errors.remotePort?.message}
              className="col-span-2"
            >
              <Input
                type="number"
                min={1}
                max={65535}
                {...form.register("remotePort")}
                placeholder="6000"
              />
            </Field>
          )}

          {isWeb && (
            <Field
              label="自定义域名（逗号分隔）"
              error={form.formState.errors.customDomains?.message}
              className="col-span-2"
            >
              <Input
                {...form.register("customDomains")}
                placeholder="a.example.com, b.example.com"
              />
            </Field>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-w-24">
          {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitText}
        </Button>
      </div>
    </form>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {children}
    </h3>
  )
}

interface FieldProps {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, error, className, children }: FieldProps) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
