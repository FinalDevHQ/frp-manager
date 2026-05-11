import { useEffect } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { AUTH_EXPIRED_EVENT, authStorage } from "@/lib/auth"

/**
 * 全站登录守卫：未持有 token 则跳转 /login。
 * 同时监听 axios 拦截器广播的「auth:expired」事件，自动跳回登录页。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const token = authStorage.get()

  useEffect(() => {
    const onExpired = () => {
      navigate("/login", { replace: true, state: { from: location.pathname } })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [navigate, location.pathname])

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
