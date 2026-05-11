import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

/**
 * 外层只负责异步加载 profile；加载完成后通过 `key` 把一份稳定的初始值交给内层 SetupForm。
 * 这样 SetupForm 的 useState 用 props 做初始化，完全避免 useEffect + setState 同步外部状态的反模式。
 */
export function SetupPage() {
  const { data: existing, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.get,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载中…
      </div>
    )
  }

  // existing 可能是 null（未配置）；用 updatedAt 作为 key，让用户编辑完又保存后能拿到最新初始值
  return (
    <SetupForm
      key={existing?.updatedAt ?? "new"}
      initialConfigPath={existing?.configPath ?? "/etc/frp/frpc.yml"}
      initialStrategy={
        existing?.reload ?? { type: "admin-api", baseUrl: "http://127.0.0.1:7400" }
      }
    />
  )
}

function SetupForm({
  initialConfigPath,
  initialStrategy,
}: {
  initialConfigPath: string
  initialStrategy: ReloadStrategy
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [configPath, setConfigPath] = useState(initialConfigPath)
  const [strategy, setStrategy] = useState<ReloadStrategy>(initialStrategy)
  const [testResult, setTestResult] = useState<ProfileTestResult | null>(null)

  // updatedAt 只在真正提交时生成，避免在 render 中调用 Date.now（impure）
  function buildProfile(): DeploymentProfile {
    return { configPath, reload: strategy, updatedAt: Date.now() }
  }

  const testMutation = useMutation({
    mutationFn: () => profileApi.test(buildProfile()),
    onSuccess: (r) => setTestResult(r),
    onError: (e: Error) => {
      setTestResult(null)
      toast.error(e.message)
    },
  })

  const [commandConfirmOpen, setCommandConfirmOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (opts?: { confirmCommand?: boolean }) =>
      profileApi.save(buildProfile(), opts),
    onSuccess: () => {
      toast.success("配置已保存")
      setCommandConfirmOpen(false)
      qc.invalidateQueries({ queryKey: ["profile"] })
      qc.invalidateQueries({ queryKey: ["proxies"] })
      navigate("/proxies")
    },
    onError: (e: Error) => {
      // 服务端策略错误：默认密码下禁用 command
      if (e.message === "DEFAULT_PASSWORD_BLOCKS_COMMAND") {
        toast.error(
          "默认密码 admin 下禁止启用 command 策略，请先在右上角横条修改密码",
        )
        setCommandConfirmOpen(false)
        return
      }
      if (e.message === "CONFIRM_COMMAND_REQUIRED") {
        toast.error("command 策略必须二次确认才能保存")
        return
      }
      toast.error(e.message)
    },
  })

  function handleSave() {
    if (strategy.type === "command") {
      setCommandConfirmOpen(true)
      return
    }
    saveMutation.mutate(undefined)
  }

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
          onClick={handleSave}
          disabled={!canSave || saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          保存并开始使用
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <CommandConfirmDialog
        open={commandConfirmOpen}
        onOpenChange={setCommandConfirmOpen}
        command={strategy.type === "command" ? strategy.command : ""}
        loading={saveMutation.isPending}
        onConfirm={() => saveMutation.mutate({ confirmCommand: true })}
      />
    </div>
  )
}

/**
 * 二次确认弹框：要求用户重新键入完整命令才放行保存。
 * 防止 XSS / 误操作把 reload 策略改成任意 shell 命令。
 */
function CommandConfirmDialog({
  open,
  onOpenChange,
  command,
  loading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  command: string
  loading: boolean
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState("")
  const matches = typed === command && command.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        // 关闭时重置输入，放在事件回调里而不是 useEffect 里，避免 cascading render
        if (!v) setTyped("")
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            确认启用 command 策略
          </DialogTitle>
          <DialogDescription>
            command 策略本质是执行任意 shell 命令，风险很高。请确认无误后再保存。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">将要保存的命令</Label>
            <pre className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all">
              {command || "（空）"}
            </pre>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmd-confirm" className="text-xs">
              请在下方再次输入上面这条命令以确认：
            </Label>
            <Input
              id="cmd-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="逐字键入"
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={!matches || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            确认保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * admin-api 密码输入框：
 *  - 当后端返回 password === "***"（已加密保存），UI 显示空 + 占位符提示「已设置」
 *  - 用户不输入 → 提交时仍带 password: "***"，服务端识别为「保持原值」
 *  - 用户输入新值 → 覆盖
 */
function AdminPasswordInput({
  strategy,
  onChange,
}: {
  strategy: ReloadStrategy & { type: "admin-api" }
  onChange: (s: ReloadStrategy) => void
}) {
  const isMasked = strategy.password === "***"
  const [editing, setEditing] = useState(!isMasked)

  if (isMasked && !editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="password"
          value=""
          placeholder="（已设置，留空保持原值）"
          readOnly
          onFocus={() => setEditing(true)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(true)
            onChange({ ...strategy, password: "" })
          }}
        >
          修改
        </Button>
      </div>
    )
  }

  return (
    <Input
      type="password"
      value={strategy.password ?? ""}
      placeholder={isMasked ? "（留空保持原值）" : ""}
      autoFocus={editing && isMasked}
      onChange={(e) =>
        onChange({
          ...strategy,
          // 留空时回填 *** 让服务端保持原值；用户主动清空可点「修改」按钮重新进入
          password: e.target.value || (isMasked ? "***" : undefined),
        })
      }
    />
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
            <AdminPasswordInput strategy={strategy} onChange={onChange} />
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
