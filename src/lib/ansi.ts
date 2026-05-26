// Minimal ANSI renderer for the build-log console. Parses SGR colour/style
// escapes into styled segments and strips other control sequences (cursor
// moves, erase-line, OSC). No terminal-grade emulation — just enough to make
// Docker/BuildKit output readable. No external dependency.

export interface AnsiSegment {
  text: string
  style: string
}

// 16-colour palette (Tailwind hues, tuned to stay legible on the dark console).
const PALETTE = [
  '#6b7280', '#ef4444', '#22c55e', '#eab308', // black red green yellow
  '#3b82f6', '#a855f7', '#06b6d4', '#d1d5db', // blue magenta cyan white
  '#9ca3af', '#f87171', '#4ade80', '#facc15', // bright black/red/green/yellow
  '#60a5fa', '#c084fc', '#22d3ee', '#f3f4f6', // bright blue/magenta/cyan/white
]

function xterm256(n: number): string {
  if (n < 16) return PALETTE[n] ?? ''
  if (n >= 232) {
    const v = 8 + (n - 232) * 10
    return `rgb(${v},${v},${v})`
  }
  const i = n - 16
  const conv = (x: number) => (x === 0 ? 0 : 55 + x * 40)
  return `rgb(${conv(Math.floor(i / 36))},${conv(Math.floor((i % 36) / 6))},${conv(i % 6)})`
}

// Matches an SGR sequence (capturing its params) OR any other CSI/OSC sequence
// (to be stripped). SGR is listed first so colour codes win the alternation.
const ANSI =
  // eslint-disable-next-line no-control-regex
  /\x1b\[([0-9;]*)m|\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g

export function parseAnsi(input: string): AnsiSegment[] {
  // Collapse carriage-return redraws: keep the last non-empty overwrite.
  let line = input
  if (input.indexOf('\r') !== -1) {
    const parts = input.split('\r').filter((p) => p !== '')
    line = parts.length ? parts[parts.length - 1] : ''
  }

  let fg: string | null = null
  let bg: string | null = null
  let bold = false
  let dim = false
  let italic = false
  let underline = false

  const styleOf = () => {
    const p: string[] = []
    if (fg) p.push(`color:${fg}`)
    if (bg) p.push(`background-color:${bg}`)
    if (bold) p.push('font-weight:600')
    if (dim) p.push('opacity:.65')
    if (italic) p.push('font-style:italic')
    if (underline) p.push('text-decoration:underline')
    return p.join(';')
  }

  function applySgr(paramStr: string) {
    const codes = paramStr === '' ? [0] : paramStr.split(';').map((n) => Number(n) || 0)
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]
      if (c === 0) {
        fg = bg = null
        bold = dim = italic = underline = false
      } else if (c === 1) bold = true
      else if (c === 2) dim = true
      else if (c === 3) italic = true
      else if (c === 4) underline = true
      else if (c === 22) bold = dim = false
      else if (c === 23) italic = false
      else if (c === 24) underline = false
      else if (c === 39) fg = null
      else if (c === 49) bg = null
      else if (c >= 30 && c <= 37) fg = PALETTE[c - 30]
      else if (c >= 90 && c <= 97) fg = PALETTE[c - 90 + 8]
      else if (c >= 40 && c <= 47) bg = PALETTE[c - 40]
      else if (c >= 100 && c <= 107) bg = PALETTE[c - 100 + 8]
      else if (c === 38 || c === 48) {
        const mode = codes[i + 1]
        let col: string | null = null
        if (mode === 5) {
          col = xterm256(codes[i + 2] ?? 0)
          i += 2
        } else if (mode === 2) {
          col = `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})`
          i += 4
        }
        if (c === 38) fg = col
        else bg = col
      }
    }
  }

  const segments: AnsiSegment[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      segments.push({ text: buf, style: styleOf() })
      buf = ''
    }
  }

  let last = 0
  let m: RegExpExecArray | null
  ANSI.lastIndex = 0
  while ((m = ANSI.exec(line)) !== null) {
    buf += line.slice(last, m.index)
    last = ANSI.lastIndex
    if (m[1] !== undefined) {
      flush()
      applySgr(m[1])
    }
    // other matched sequences are control codes → dropped
  }
  buf += line.slice(last)
  flush()

  return segments.length ? segments : [{ text: line, style: '' }]
}
