import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Pencil, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { profileApi, systemApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const strategyLabel: Record<string, string> = {
  "admin-api": "Admin API",
  systemctl: "systemctl",
  docker: "Docker",
  command: "自定义命令",
  none: "仅保存",
}

export function SystemPage() {
  const navigate = useNavigate()
  const { data: status, refetch } = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
  })
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.get,
  })

  const reload = useMutation({
    mutationFn: systemApi.reload,
    onSuccess: (res) => {
      if (res.reloaded) toast.success(res.message)
      else toast.info(res.message)
      refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground mt-1">
          部署配置与 frpc 控制
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>部署 Profile</CardTitle>
            <CardDescription>当前 frpc.yml 路径与 reload 策略</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/setup")}>
            <Pencil className="h-4 w-4 mr-1.5" />
            编辑
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row
            label="配置文件"
            value={<code className="text-xs">{profile?.configPath ?? "-"}</code>}
          />
          <Row
            label="Reload 策略"
            value={
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {strategyLabel[profile?.reload.type ?? ""] ?? "-"}
              </span>
            }
          />
          <Row
            label="上次保存"
            value={
              status?.lastSavedAt
                ? new Date(status.lastSavedAt).toLocaleString()
                : "（尚未保存）"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reload</CardTitle>
          <CardDescription>根据当前策略触发 frpc 重新加载配置</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => reload.mutate()} disabled={reload.isPending}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (reload.isPending ? "animate-spin" : "")} />
            {reload.isPending ? "Reloading..." : "Reload frpc"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
