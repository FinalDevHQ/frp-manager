import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Loader2, Lock, Zap } from "lucide-react"
import { toast } from "sonner"
import { authApi, authStorage } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as LocationState | null)?.from
  const redirectTo = fromState && fromState !== "/login" ? fromState : "/proxies"

  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // 已登录则直接跳走
  useEffect(() => {
    if (authStorage.get()) {
      navigate(redirectTo, { replace: true })
    }
  }, [navigate, redirectTo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) {
      toast.error("请输入密码")
      return
    }
    setSubmitting(true)
    try {
      const { token } = await authApi.login(password)
      authStorage.set(token)
      toast.success("登录成功")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "登录失败"
      // axios 包装的错误带 response.data.error
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error ?? msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-sm shadow-xl shadow-primary/5 border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-pink-400 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">FRP Manager</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">登录后进入控制台</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                登录密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="pl-9"
                  disabled={submitting}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              登录
            </Button>

            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              密码存储在服务器 <code className="bg-muted/60 px-1 py-0.5 rounded">config/auth.json</code>。
              首次启动默认密码 <code className="bg-muted/60 px-1 py-0.5 rounded">admin</code>，请尽快修改。
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
