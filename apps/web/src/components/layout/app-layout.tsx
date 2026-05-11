import { NavLink, Outlet } from "react-router-dom"
import { FileCode2, ListTree, Server, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/proxies", label: "Proxies", icon: ListTree },
  { to: "/preview", label: "YAML Preview", icon: FileCode2 },
  { to: "/system", label: "System", icon: Server },
]

export function AppLayout() {
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
        <div className="p-4 text-xs text-muted-foreground/80">
          Stop editing <code className="text-[10px] bg-muted/60 px-1 py-0.5 rounded">frpc.yml</code> manually.
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
