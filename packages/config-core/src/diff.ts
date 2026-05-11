/**
 * 简单逐行 diff，用于 UI 预览。
 * v1 不引入额外依赖，使用最基础的 LCS 行级 diff。
 */

export type DiffOp = "equal" | "add" | "remove"

export interface DiffLine {
  op: DiffOp
  text: string
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")

  const m = oldLines.length
  const n = newLines.length

  // LCS DP 表
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const result: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ op: "equal", text: oldLines[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ op: "remove", text: oldLines[i] })
      i++
    } else {
      result.push({ op: "add", text: newLines[j] })
      j++
    }
  }
  while (i < m) {
    result.push({ op: "remove", text: oldLines[i++] })
  }
  while (j < n) {
    result.push({ op: "add", text: newLines[j++] })
  }

  return result
}
