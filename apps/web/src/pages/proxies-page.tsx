import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Inbox, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Proxy } from "@frp-manager/shared"
import { proxyApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ProxyForm } from "@/features/proxy/proxy-form"
import { ProxyTypeBadge } from "@/features/proxy/proxy-type-badge"
import { DeleteProxyDialog } from "@/features/proxy/delete-proxy-dialog"

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; proxy: Proxy }

export function ProxiesPage() {
  const qc = useQueryClient()
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" })
  const [deleteTarget, setDeleteTarget] = useState<Proxy | null>(null)

  const { data: proxies = [], isLoading, error } = useQuery({
    queryKey: ["proxies"],
    queryFn: proxyApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (proxy: Proxy) => proxyApi.create(proxy),
    onSuccess: () => {
      toast.success("Proxy 已创建")
      qc.invalidateQueries({ queryKey: ["proxies"] })
      qc.invalidateQueries({ queryKey: ["config-preview"] })
      setEditor({ mode: "closed" })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ name, proxy }: { name: string; proxy: Proxy }) =>
      proxyApi.update(name, proxy),
    onSuccess: () => {
      toast.success("Proxy 已更新")
      qc.invalidateQueries({ queryKey: ["proxies"] })
      qc.invalidateQueries({ queryKey: ["config-preview"] })
      setEditor({ mode: "closed" })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => proxyApi.remove(name),
    onSuccess: () => {
      toast.success("Proxy 已删除")
      qc.invalidateQueries({ queryKey: ["proxies"] })
      qc.invalidateQueries({ queryKey: ["config-preview"] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = async (proxy: Proxy) => {
    if (editor.mode === "create") {
      await createMutation.mutateAsync(proxy)
    } else if (editor.mode === "edit") {
      await updateMutation.mutateAsync({ name: editor.proxy.name, proxy })
    }
  }

  const isEmpty = !isLoading && !error && proxies.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proxies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            可视化管理 frpc.yml 中的代理映射
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1" />
          新增 Proxy
        </Button>
      </div>

      <Card className="overflow-hidden p-0 shadow-sm">
        {isLoading && (
          <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
        )}
        {error && (
          <div className="py-16 text-center text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}
        {isEmpty && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">暂无 Proxy</p>
              <p className="text-xs text-muted-foreground mt-1">
                点击右上角「新增 Proxy」开始配置你的第一条代理
              </p>
            </div>
            <Button size="sm" onClick={() => setEditor({ mode: "create" })} className="mt-2">
              <Plus className="h-4 w-4 mr-1" />
              新增 Proxy
            </Button>
          </div>
        )}
        {!isLoading && !error && proxies.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[28%]">名称</TableHead>
                <TableHead className="w-[12%]">类型</TableHead>
                <TableHead>本地</TableHead>
                <TableHead>远程 / 域名</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxies.map((p) => (
                <TableRow key={p.name} className="group">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        className="relative inline-flex h-2 w-2"
                        title="已配置"
                      >
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProxyTypeBadge type={p.type} />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {p.localIp}:{p.localPort}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {p.type === "tcp"
                      ? `:${p.remotePort ?? "-"}`
                      : p.customDomains?.join(", ") ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditor({ mode: "edit", proxy: p })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={editor.mode !== "closed"}
        onOpenChange={(open: boolean) => !open && setEditor({ mode: "closed" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.mode === "create" ? "新增 Proxy" : "编辑 Proxy"}
            </DialogTitle>
            <DialogDescription>
              填写完成后自动保存到 frpc.yml 并备份原文件
            </DialogDescription>
          </DialogHeader>
          {editor.mode !== "closed" && (
            <ProxyForm
              defaultValue={editor.mode === "edit" ? editor.proxy : undefined}
              onCancel={() => setEditor({ mode: "closed" })}
              onSubmit={handleSubmit}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteProxyDialog
        name={deleteTarget?.name}
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.name)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
