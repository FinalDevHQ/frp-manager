import { useMutation, useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { systemApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function SystemPage() {
  const { data, refetch } = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
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
          frpc 进程控制与状态
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>状态</CardTitle>
          <CardDescription>当前 frpc.yml 路径与最近一次保存</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="配置文件" value={<code className="text-xs">{data?.configPath ?? "-"}</code>} />
          <Row
            label="进程状态"
            value={
              <Badge variant={data?.running ? "default" : "secondary"}>
                {data?.running ? "running" : "unknown"}
              </Badge>
            }
          />
          <Row
            label="上次保存"
            value={
              data?.lastSavedAt
                ? new Date(data.lastSavedAt).toLocaleString()
                : "（尚未保存）"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reload</CardTitle>
          <CardDescription>触发 frpc 重新加载配置（v1 占位，暂未生效）</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => reload.mutate()} disabled={reload.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />
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
