import { useQuery } from "@tanstack/react-query"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { profileApi } from "@/lib/api"

/**
 * 包裹路由，若无 profile 则强制跳转 /setup。
 * /setup 本身不应走此守卫。
 */
export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: profileApi.get,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        加载配置...
      </div>
    )
  }

  if (!data) {
    return <Navigate to="/setup" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
