import type { ReloadResult } from "@frp-manager/shared"

export async function reloadNone(): Promise<ReloadResult> {
  return {
    reloaded: false,
    message: "当前策略为「仅保存」，未执行 reload",
    strategyType: "none",
  }
}
