import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileSearch, Loader2, Sparkles } from "lucide-react"
import { profileApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DiscoveryPanelProps {
  onPickPath: (path: string) => void
}

/**
 * 扫描本机 frpc 相关资源。用户点按钮后才调接口，不开页面就跑。
 */
export function DiscoveryPanel({ onPickPath }: DiscoveryPanelProps) {
  const [open, setOpen] = useState(false)
  const { data, isFetching } = useQuery({
    queryKey: ["profile-suggestions"],
    queryFn: profileApi.suggestions,
    enabled: open,
  })

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4 mr-1.5" />
        自动发现
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          扫描结果
        </h4>
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {data && (
        <>
          <Section title="常见配置路径" empty="未找到现成的 frpc.yml">
            {data.configPaths.length > 0 &&
              data.configPaths.map((c) => (
                <button
                  key={c.path}
                  type="button"
                  onClick={() => onPickPath(c.path)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-xs font-mono transition-colors",
                    c.exists
                      ? "bg-card hover:bg-accent/60 text-foreground"
                      : "bg-card/40 text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileSearch className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{c.path}</span>
                    {c.exists ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        已存在
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">候选</span>
                    )}
                  </div>
                </button>
              ))}
          </Section>

          {data.systemdServices.length > 0 && (
            <Section title="发现的 systemd 服务" empty="">
              {data.systemdServices.map((s) => (
                <div
                  key={`${s.scope}:${s.unit}`}
                  className="px-3 py-1.5 rounded-md bg-card text-xs font-mono flex items-center gap-2"
                >
                  <span className="flex-1">{s.unit}</span>
                  <span className="text-[10px] text-muted-foreground">{s.scope}</span>
                  <span
                    className={cn(
                      "text-[10px]",
                      s.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {s.active ? "running" : "inactive"}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {data.dockerContainers.length > 0 && (
            <Section title="发现的 Docker 容器" empty="">
              {data.dockerContainers.map((c) => (
                <div
                  key={c.id}
                  className="px-3 py-1.5 rounded-md bg-card text-xs font-mono flex items-center gap-2"
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">
                    {c.image}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {data.dockerCompose.length > 0 && (
            <Section title="发现的 docker-compose 文件" empty="">
              {data.dockerCompose.map((c) => (
                <div
                  key={c.composeFile}
                  className="px-3 py-2 rounded-md bg-card text-xs space-y-1"
                >
                  <div className="font-mono truncate">{c.composeFile}</div>
                  <div className="flex flex-wrap gap-1">
                    {c.services.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          收起
        </Button>
      </div>
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {hasChildren ? (
        <div className="space-y-1">{children}</div>
      ) : empty ? (
        <p className="text-xs text-muted-foreground/70 italic">{empty}</p>
      ) : null}
    </div>
  )
}
