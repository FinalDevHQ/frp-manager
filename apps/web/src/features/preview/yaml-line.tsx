/**
 * 轻量 YAML 行内 token 着色：key、字符串、数字、连字符。
 * 不引入额外依赖，足以让预览页更接近 IDE 的可读性。
 */
export function YamlLine({ text }: { text: string }) {
  if (!text) return <span>&nbsp;</span>
  return <span dangerouslySetInnerHTML={{ __html: highlight(text) }} />
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))
}

function highlight(line: string): string {
  // 注释整行优先
  const commentIdx = line.indexOf("#")
  if (commentIdx >= 0 && !/['"]/.test(line.slice(0, commentIdx))) {
    return (
      highlightNonComment(line.slice(0, commentIdx)) +
      `<span class="text-muted-foreground/70 italic">${escape(line.slice(commentIdx))}</span>`
    )
  }
  return highlightNonComment(line)
}

function highlightNonComment(line: string): string {
  const indentMatch = line.match(/^(\s*)(.*)$/)!
  const indent = indentMatch[1]
  let rest = indentMatch[2]
  let prefix = ""

  // list dash
  if (rest.startsWith("- ")) {
    prefix = `<span class="text-fuchsia-500">- </span>`
    rest = rest.slice(2)
  }

  // key: value
  const kv = rest.match(/^([A-Za-z_][\w-]*)(\s*:\s*)(.*)$/)
  if (kv) {
    const [, key, sep, value] = kv
    return (
      indent +
      prefix +
      `<span class="text-sky-600 dark:text-sky-400">${escape(key)}</span>` +
      escape(sep) +
      colorValue(value)
    )
  }
  return escape(line)
}

function colorValue(v: string): string {
  if (!v) return ""
  // 引号字符串
  if (/^['"].*['"]$/.test(v)) {
    return `<span class="text-amber-600 dark:text-amber-400">${escape(v)}</span>`
  }
  // 数字
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    return `<span class="text-orange-600 dark:text-orange-400">${escape(v)}</span>`
  }
  // 布尔/null
  if (/^(true|false|null|~)$/i.test(v)) {
    return `<span class="text-violet-600 dark:text-violet-400">${escape(v)}</span>`
  }
  return escape(v)
}
