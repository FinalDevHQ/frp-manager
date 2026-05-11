import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  FileCode2,
  KeyRound,
  ListTree,
  LogOut,
  Server,
  Settings,
  Zap,
} from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { authApi, authStorage } from "@/lib/auth"
import { ChangePasswordDialog } from "./change-password-dialog"

const navItems = [
  { to: "/proxies", label: "Proxies", icon: ListTree },
  { to: "/preview", label: "YAML Preview", icon: FileCode2 },
  { to: "/system", label: "System", icon: Server },
  { to: "/setup", label: "Setup", icon: Settings },
]

export function AppLayout() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  // 暴露给页面：当前是否仍是默认密码（用于显示横条警告 + 阻止 command 类型）
  const statusQuery = useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => authApi.status(),
    staleTime: 30_000,
  })
  const passwordIsDefault = !!statusQuery.data?.passwordIsDefault

  function handleLogout() {
    authStorage.clear()
    qc.clear()
    navigate("/login", { replace: true })
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-card/50 backdrop-blur-md border-r border-border/40 flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-pink-400 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">FRP Manager</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all",
                  isActive
                    ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border/40 space-y-2">
          <ChangePasswordDialog
            onChanged={() => qc.invalidateQueries({ queryKey: ["auth", "status"] })}
            trigger={
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all"
              >
                <KeyRound className="h-4 w-4" />
                修改密码
              </button>
            }
          />
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
          <p className="px-1 text-xs text-muted-foreground/80">
            Stop editing <code className="text-[10px] bg-muted/60 px-1 py-0.5 rounded">frpc.yml</code> manually.
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {passwordIsDefault && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300">
            <div className="max-w-[1200px] mx-auto px-8 py-3 flex items-center gap-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                当前仍在使用默认密码 <code className="font-mono">admin</code>
                ，强烈建议立即修改。在密码未修改前，<code className="font-mono">command</code>{" "}
                reload 策略将被服务端禁用。
              </span>
              <ChangePasswordDialog
                onChanged={() => qc.invalidateQueries({ queryKey: ["auth", "status"] })}
                trigger={
                  <button
                    type="button"
                    className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 text-xs font-medium transition-colors"
                  >
                    立即修改
                  </button>
                }
              />
            </div>
          </div>
        )}
        <div className="max-w-[1200px] mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
