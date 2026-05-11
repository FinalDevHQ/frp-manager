import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, RefreshCw } from "lucide-react"
import { configApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { YamlLine } from "@/features/preview/yaml-line"
import { cn } from "@/lib/utils"

export function PreviewPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["config-preview"],
    queryFn: () => configApi.preview(),
  })

  const hasChanges = data?.diff.some((l) => l.op !== "equal") ?? false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">YAML Preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            对比当前 frpc.yml 与下次保存内容的差异
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", isFetching && "animate-spin")} />
          刷新
        </Button>
      </div>

      {isLoading && (
        <Card className="py-16 text-center text-sm text-muted-foreground">加载中...</Card>
      )}
      {error && (
        <Card className="py-16 text-center text-sm text-destructive">
          {(error as Error).message}
        </Card>
      )}

      {data && (
        <div className="grid lg:grid-cols-2 gap-4">
          <CodeCard title="当前文件" subtitle={`${countLines(data.current)} 行`}>
            <CodeBlock>
              {(data.current || "").split("\n").map((line, i) => (
                <CodeLine key={i} lineNo={i + 1}>
                  <YamlLine text={line} />
                </CodeLine>
              ))}
            </CodeBlock>
          </CodeCard>

          <CodeCard
            title="下次保存"
            subtitle={
              hasChanges ? (
                <span className="text-amber-600 dark:text-amber-400">有变更</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">无变更</span>
              )
            }
          >
            {!hasChanges ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm font-medium">当前配置已是最新</p>
                <p className="text-xs text-muted-foreground">没有等待保存的变更</p>
              </div>
            ) : (
              <CodeBlock>
                {(() => {
                  let lineNo = 0
                  return data.diff.map((line, i) => {
                    if (line.op !== "remove") lineNo++
                    return (
                      <CodeLine
                        key={i}
                        lineNo={line.op === "remove" ? null : lineNo}
                        marker={line.op === "add" ? "+" : line.op === "remove" ? "-" : " "}
                        className={cn(
                          line.op === "add" &&
                            "bg-emerald-500/10 hover:bg-emerald-500/20",
                          line.op === "remove" &&
                            "bg-rose-500/10 hover:bg-rose-500/20 line-through opacity-70",
                        )}
                      >
                        <YamlLine text={line.text} />
                      </CodeLine>
                    )
                  })
                })()}
              </CodeBlock>
            )}
          </CodeCard>
        </div>
      )}
    </div>
  )
}

function CodeCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="shadow-sm overflow-hidden p-0">
      <CardHeader className="border-b bg-muted/30 py-3 px-4 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="text-xs font-mono leading-6 overflow-x-auto">
      <code>{children}</code>
    </pre>
  )
}

function CodeLine({
  lineNo,
  marker = " ",
  className,
  children,
}: {
  lineNo: number | null
  marker?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex hover:bg-muted/40", className)}>
      <span className="select-none text-right pr-3 pl-4 w-12 text-muted-foreground/60 border-r">
        {lineNo ?? ""}
      </span>
      <span className="select-none w-5 text-center text-muted-foreground/70">{marker}</span>
      <span className="flex-1 pr-4 whitespace-pre">{children}</span>
    </div>
  )
}

function countLines(text: string): number {
  if (!text) return 0
  return text.split("\n").length
}
