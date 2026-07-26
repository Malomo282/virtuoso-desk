// WCAG 2.1 AA contrast audit for every theme.
//
// Parses app/globals.css so it always checks the values that actually ship.
// AA thresholds: 4.5:1 normal text, 3:1 large text and UI component boundaries.
import { readFileSync } from 'fs'

const css = readFileSync('app/globals.css', 'utf8')

function extractThemes(src) {
  const themes = {}
  // :root doubles as 'dark'
  const blockRe = /(\[data-theme='([a-z]+)'\]|:root,\s*\[data-theme='dark'\])\s*\{([^}]*)\}/g
  let m
  while ((m = blockRe.exec(src))) {
    const name = m[2] || 'dark'
    const vars = {}
    for (const line of m[3].split('\n')) {
      const v = line.match(/--([a-z-]+):\s*([^;]+);/)
      if (v && /^\d/.test(v[2].trim())) vars[v[1]] = v[2].trim()
    }
    if (Object.keys(vars).length) themes[name] = vars
  }
  return themes
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255))
}
const parse = str => { const [h, s, l] = str.split(/\s+/); return hslToRgb(+h, parseFloat(s), parseFloat(l)) }
const over = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))

function luminance([r, g, b]) {
  const a = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}
function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

const themes = extractThemes(css)
const names = Object.keys(themes)
console.log('themes found:', names.join(', ') + '\n')

let totalFails = 0

for (const name of names) {
  const t = themes[name]
  const c = k => parse(t[k])

  const checks = [
    ['foreground on background', c('foreground'), c('background'), 4.5],
    ['foreground on card', c('foreground'), c('card'), 4.5],
    ['foreground on sidebar', c('foreground'), c('sidebar'), 4.5],
    ['muted-foreground on background', c('muted-foreground'), c('background'), 4.5],
    ['muted-foreground on card', c('muted-foreground'), c('card'), 4.5],
    ['muted-foreground on sidebar', c('muted-foreground'), c('sidebar'), 4.5],
    ['muted-foreground/80 on card', over(c('muted-foreground'), c('card'), 0.8), c('card'), 4.5],
    ['muted-foreground/80 on sidebar', over(c('muted-foreground'), c('sidebar'), 0.8), c('sidebar'), 4.5],
    ['subtle-foreground on background', c('subtle-foreground'), c('background'), 4.5],
    ['subtle-foreground on card', c('subtle-foreground'), c('card'), 4.5],
    ['primary text on background', c('primary'), c('background'), 4.5],
    ['primary text on card', c('primary'), c('card'), 4.5],
    ['primary text on sidebar', c('primary'), c('sidebar'), 4.5],
    ['primary text on accent (active nav)', c('primary'), c('accent'), 4.5],
    ['button label on primary', c('primary-foreground'), c('primary'), 4.5],
    ['destructive on card', c('destructive'), c('card'), 4.5],
    ['destructive on background', c('destructive'), c('background'), 4.5],
    ['success on card', c('success'), c('card'), 4.5],
    ['info on card', c('info'), c('card'), 4.5],
    ['foreground on secondary (inputs)', c('foreground'), c('secondary'), 4.5],
    // UI component boundaries - 3:1 under 1.4.11
    ['input border on card', c('input-border'), c('card'), 3],
    ['input border on background', c('input-border'), c('background'), 3],
    ['focus ring on card', c('ring'), c('card'), 3],
    ['focus ring on background', c('ring'), c('background'), 3],
  ]

  const fails = checks.filter(([, fg, bg, need]) => ratio(fg, bg) < need)
  totalFails += fails.length

  console.log('=== ' + name + ' === ' + (fails.length ? fails.length + ' FAIL' : 'all pass'))
  for (const [label, fg, bg, need] of checks) {
    const r = ratio(fg, bg)
    if (r < need) console.log('   FAIL ' + label.padEnd(36) + r.toFixed(2) + ' (need ' + need + ')')
  }
}

console.log('\n' + (totalFails === 0 ? 'ALL THEMES PASS WCAG AA' : totalFails + ' failing pair(s) across all themes'))
process.exit(totalFails === 0 ? 0 : 1)
