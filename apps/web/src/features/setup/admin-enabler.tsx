import { useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"
import type { AdminApiStrategy } from "@frp-manager/shared"
import { profileApi } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface AdminEnablerProps {
  configPath: string
  strategy: AdminApiStrategy
  onStrategyChange: (s: AdminApiStrategy) => void
}

/**
 * 在选中 admin-api 策略时展示：
 * - 如果 frpc.yml 已配 webServer，自动填入 baseUrl/user/password
 * - 如果未配，提供「一键启用」按钮
 */
export function AdminEnabler({ configPath, strategy, onStrategyChange }: AdminEnablerProps) {
  const { data: info, refetch, isFetching } = useQuery({
    queryKey: ["admin-inspect", configPath],
    queryFn: () => profileApi.inspectAdmin(configPath),
    enabled: !!configPath,
  })

  useEffect(() => {
    if (info?.enabled && info.baseUrl && info.baseUrl !== strategy.baseUrl) {
      onStrategyChange({
        type: "admin-api",
        baseUrl: info.baseUrl,
        user: info.user,
        password: info.password,
      })
    }
    // 只在 info 变化时同步，避免 onStrategyChange 引起循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.enabled, info?.baseUrl])

  const enable = useMutation({
    mutationFn: () =>
      profileApi.enableAdmin({
        configPath,
        addr: "127.0.0.1",
        port: 7400,
      }),
    onSuccess: (res) => {
      toast.success("webServer 已启用，请手动重启一次 frpc 让新配置生效")
      if (res.baseUrl) {
        onStrategyChange({
          type: "admin-api",
          baseUrl: res.baseUrl,
          user: res.user,
          password: res.password,
        })
      }
      refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!configPath) return null
  if (isFetching && !info) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        检查 frpc.yml 中的 webServer 配置...
      </div>
    )
  }

  if (info?.enabled) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          检测到 <code>webServer</code> 已启用，已自动填入 <code>{info.baseUrl}</code>。
          {info.user && <> 用户名 <code>{info.user}</code> 也已自动填入。</>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>
          当前 frpc.yml 未启用 <code>webServer</code>，Admin API 无法使用。
          可以自动写入默认配置（监听 <code>127.0.0.1:7400</code>）。
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => enable.mutate()}
          disabled={enable.isPending}
        >
          {enable.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
          一键启用 webServer
        </Button>
      </div>
    </div>
  )
}
