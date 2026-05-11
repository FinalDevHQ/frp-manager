import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cog,
  FileText,
  Loader2,
  Rocket,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import type {
  DeploymentProfile,
  ProfileTestResult,
  ReloadStrategy,
  ReloadStrategyType,
} from "@frp-manager/shared"
import { profileApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { StrategyCard } from "@/features/setup/strategy-card"
import { AdminEnabler } from "@/features/setup/admin-enabler"
import { DiscoveryPanel } from "@/features/setup/discovery-panel"

const strategyOptions: {
  type: ReloadStrategyType
  title: string
  description: string
  icon: React.ReactNode
  recommended?: boolean
}[] = [
  {
    type: "admin-api",
    title: "Admin API（推荐）",
    description: "调用 frpc 自带的热重载接口，无需重启进程。需要 frpc.yml 启用 webServer。",
    icon: <Zap className="h-4 w-4" />,
    recommended: true,
  },
  {
    type: "systemctl",
    title: "systemctl",
    description: "通过 systemd 管理 frpc 服务，执行 reload 或 restart。",
    icon: <Cog className="h-4 w-4" />,
  },
  {
    type: "docker",
    title: "Docker",
    description: "重启容器或发送 HUP 信号。frp-manager 需可访问 docker CLI。",
    icon: <Rocket className="h-4 w-4" />,
  },
  {
    type: "docker-compose",
    title: "Docker Compose",
    description: "通过 docker compose restart/up/kill 操作 compose 中的 frpc service。",
    icon: <Boxes className="h-4 w-4" />,
  },
  {
    type: "command",
    title: "自定义命令",
    description: "执行你自己的 shell 命令完成 reload。",
    icon: <Terminal className="h-4 w-4" />,
  },
  {
    type: "none",
    title: "仅保存",
    description: "只写 frpc.yml，不触发 reload，后续手动处理。",
    icon: <FileText className="h-4 w-4" />,
  },
]

function defaultStrategy(type: ReloadStrategyType): ReloadStrategy {
  switch (type) {
    case "admin-api":
      return { type: "admin-api", baseUrl: "http://127.0.0.1:7400" }
    case "systemctl":
      return { type: "systemctl", serviceName: "frpc", action: "reload", scope: "system" }
    case "docker":
      return { type: "docker", container: "frpc", action: "restart" }
    case "docker-compose":
      return { type: "docker-compose", composeFile: "", workingDir: "", service: "frpc", action: "restart" }
    case "command":
      return { type: "command", command: "" }
    case "none":
      return { type: "none" }
  }
}

export function SetupPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: existing } = useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.get,
  })

  const [configPath, setConfigPath] = useState("/etc/frp/frpc.yml")
  const [strategy, setStrategy] = useState<ReloadStrategy>({ type: "admin-api", baseUrl: "http://127.0.0.1:7400" })
  const [testResult, setTestResult] = useState<ProfileTestResult | null>(null)

  useEffect(() => {
    if (existing) {
      setConfigPath(existing.configPath)
      setStrategy(existing.reload)
    }
  }, [existing])

  const profile: DeploymentProfile = {
    configPath,
    reload: strategy,
    updatedAt: Date.now(),
  }

  const testMutation = useMutation({
    mutationFn: () => profileApi.test(profile),
    onSuccess: (r) => setTestResult(r),
    onError: (e: Error) => {
      setTestResult(null)
      toast.error(e.message)
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => profileApi.save(profile),
    onSuccess: () => {
      toast.success("配置已保存")
      qc.invalidateQueries({ queryKey: ["profile"] })
      qc.invalidateQueries({ queryKey: ["proxies"] })
      navigate("/proxies")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSave = !!testResult && testResult.configPathOk && testResult.reloadOk

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          告诉 frp-manager 你的 frpc.yml 在哪，以及如何触发 reload
        </p>
      </div>

      {/* Step 1: config path */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
              1
            </span>
            frpc.yml 路径
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={configPath}
            onChange={(e) => {
              setConfigPath(e.target.value)
              setTestResult(null)
            }}
            placeholder="/etc/frp/frpc.yml"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            常见位置：<code>/etc/frp/frpc.yml</code>、<code>/usr/local/etc/frp/frpc.yml</code>、<code>~/.frp/frpc.yml</code>
          </p>
          <DiscoveryPanel
            onPickPath={(p) => {
              setConfigPath(p)
              setTestResult(null)
            }}
          />
        </CardContent>
      </Card>

      {/* Step 2: strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
              2
            </span>
            Reload 策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {strategyOptions.map((opt) => (
              <StrategyCard
                key={opt.type}
                type={opt.type}
                title={opt.title}
                description={opt.description}
                icon={opt.icon}
                recommended={opt.recommended}
                selected={strategy.type === opt.type}
                onClick={() => {
                  setStrategy(defaultStrategy(opt.type))
                  setTestResult(null)
                }}
              />
            ))}
          </div>

          <Separator />

          <StrategyFields strategy={strategy} onChange={(s) => { setStrategy(s); setTestResult(null) }} />

          {strategy.type === "admin-api" && (
            <AdminEnabler
              configPath={configPath}
              strategy={strategy}
              onStrategyChange={(s) => { setStrategy(s); setTestResult(null) }}
            />
          )}
        </CardContent>
      </Card>

      {/* Step 3: test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
              3
            </span>
            测试
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !configPath}
          >
            {testMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            测试配置
          </Button>

          {testResult && (
            <div className="space-y-2 rounded-lg bg-muted/40 p-3">
              <TestRow ok={testResult.configPathOk} label="配置文件" message={testResult.configPathMessage} />
              <TestRow ok={testResult.reloadOk} label="Reload 策略" message={testResult.reloadMessage} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          保存并开始使用
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function TestRow({ ok, label, message }: { ok: boolean; label: string; message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive mt-0.5" />
      )}
      <div className="flex-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground ml-2">{message}</span>
      </div>
    </div>
  )
}

function StrategyFields({
  strategy,
  onChange,
}: {
  strategy: ReloadStrategy
  onChange: (s: ReloadStrategy) => void
}) {
  switch (strategy.type) {
    case "none":
      return <p className="text-xs text-muted-foreground">无需额外配置</p>
    case "admin-api":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Admin Base URL">
            <Input
              value={strategy.baseUrl}
              onChange={(e) => onChange({ ...strategy, baseUrl: e.target.value })}
              placeholder="http://127.0.0.1:7400"
              className="font-mono"
            />
          </FormField>
          <FormField label="用户名（可选）">
            <Input
              value={strategy.user ?? ""}
              onChange={(e) => onChange({ ...strategy, user: e.target.value || undefined })}
            />
          </FormField>
          <FormField label="密码（可选）" className="sm:col-span-2">
            <Input
              type="password"
              value={strategy.password ?? ""}
              onChange={(e) => onChange({ ...strategy, password: e.target.value || undefined })}
            />
          </FormField>
        </div>
      )
    case "systemctl":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="服务名">
            <Input
              value={strategy.serviceName}
              onChange={(e) => onChange({ ...strategy, serviceName: e.target.value })}
              placeholder="frpc"
            />
          </FormField>
          <FormField label="动作">
            <Select
              value={strategy.action}
              onValueChange={(v: string) => onChange({ ...strategy, action: v as "reload" | "restart" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reload">reload</SelectItem>
                <SelectItem value="restart">restart</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Scope">
            <Select
              value={strategy.scope}
              onValueChange={(v: string) => onChange({ ...strategy, scope: v as "system" | "user" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">system</SelectItem>
                <SelectItem value="user">user</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      )
    case "docker":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="容器名或 ID">
            <Input
              value={strategy.container}
              onChange={(e) => onChange({ ...strategy, container: e.target.value })}
              placeholder="frpc"
            />
          </FormField>
          <FormField label="动作">
            <Select
              value={strategy.action}
              onValueChange={(v: string) => onChange({ ...strategy, action: v as "restart" | "kill-hup" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restart">restart（重启）</SelectItem>
                <SelectItem value="kill-hup">kill -HUP（信号热重载）</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      )
    case "docker-compose":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="compose 文件路径（可选）" className="sm:col-span-2">
            <Input
              value={strategy.composeFile ?? ""}
              onChange={(e) => onChange({ ...strategy, composeFile: e.target.value || undefined })}
              placeholder="/opt/frp/docker-compose.yml"
              className="font-mono"
            />
          </FormField>
          <FormField label="工作目录（可选）">
            <Input
              value={strategy.workingDir ?? ""}
              onChange={(e) => onChange({ ...strategy, workingDir: e.target.value || undefined })}
              placeholder="不填则取 compose 文件所在目录"
              className="font-mono"
            />
          </FormField>
          <FormField label="Service 名">
            <Input
              value={strategy.service}
              onChange={(e) => onChange({ ...strategy, service: e.target.value })}
              placeholder="frpc"
            />
          </FormField>
          <FormField label="动作" className="sm:col-span-2">
            <Select
              value={strategy.action}
              onValueChange={(v: string) =>
                onChange({ ...strategy, action: v as "restart" | "up" | "kill-hup" })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restart">restart（重启 service）</SelectItem>
                <SelectItem value="up">up -d（应用最新配置/镜像）</SelectItem>
                <SelectItem value="kill-hup">kill -s HUP（信号热重载）</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      )
    case "command":
      return (
        <FormField label="Shell 命令">
          <Input
            value={strategy.command}
            onChange={(e) => onChange({ ...strategy, command: e.target.value })}
            placeholder="/usr/local/bin/reload-frpc.sh"
            className="font-mono"
          />
        </FormField>
      )
  }
}

function FormField({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  )
}
