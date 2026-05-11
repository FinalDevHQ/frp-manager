import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { KeyRound } from "lucide-react"
import { authApi, authStorage } from "@/lib/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  /** 触发按钮的渲染节点；不传则使用默认 ghost button */
  trigger?: React.ReactNode
  onChanged?: () => void
}

export function ChangePasswordDialog({ trigger, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [rotateSecret, setRotateSecret] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("新密码至少 6 位")
      if (newPassword !== confirmPassword) throw new Error("两次输入的新密码不一致")
      return authApi.changePassword({ oldPassword, newPassword, rotateSecret })
    },
    onSuccess: (data) => {
      // 改密后服务端会下发新 token；写入 storage 让后续请求继续用新 token
      authStorage.set(data.token)
      toast.success(
        data.rotated
          ? "密码已修改；其它设备会话已失效"
          : "密码已修改",
      )
      reset()
      setOpen(false)
      onChanged?.()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "修改失败")
    },
  })

  function reset() {
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setRotateSecret(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        if (!v) reset()
        setOpen(v)
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-2">
            <KeyRound className="h-4 w-4" />
            修改密码
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改登录密码</DialogTitle>
          <DialogDescription>
            旧密码用于校验当前会话身份；新密码至少 6 位。
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cp-old">原密码</Label>
            <Input
              id="cp-old"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">新密码</Label>
            <Input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">确认新密码</Label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rotateSecret}
              onChange={(e) => setRotateSecret(e.target.checked)}
              className="size-4 rounded border-border"
            />
            同时让其它设备的登录立即失效（轮转 token 密钥）
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                setOpen(false)
              }}
            >
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "保存中…" : "确认修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
