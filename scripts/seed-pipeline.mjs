/**
 * Seed venue_pipeline from the outreach spreadsheet.
 *
 *   node scripts/seed-pipeline.mjs "C:/Users/jesse/Downloads/Virtuoso-Venue-Outreach-200.xlsx"
 *
 * Idempotent: skips any brand_name already in the table, so re-running after
 * adding rows to the sheet tops up rather than duplicating.
 *
 * Two spreadsheet columns are deliberately NOT imported:
 *   - "Contact Name" holds the literal 23 on all 200 rows (a stray formula
 *     result, not a name). The real role lives in "Key Contact".
 *   - "Frequency/Proximity since last Contact" holds incrementing numbers
 *     with no meaning outside the sheet.
 * The category banners (PUB & BAR GROUPS, HOTELS ..., etc.) are kept as a
 * Category line in notes, since that segmentation is worth having.
 */
import fs from 'fs'
import { execSync } from 'child_process'
import os from 'os'
import path from 'path'

const xlsx = process.argv[2]
if (!xlsx || !fs.existsSync(xlsx)) {
  console.error('Usage: node scripts/seed-pipeline.mjs <path-to-xlsx>')
  process.exit(1)
}

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

// Unzip the workbook to a temp dir (xlsx is just a zip of XML).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-'))
execSync(`unzip -o -q "${xlsx}" -d "${tmp}"`)

const ssXml = fs.readFileSync(path.join(tmp, 'xl/sharedStrings.xml'), 'utf8')
const strings = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
  [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
)

const colIdx = ref => {
  const m = /^([A-Z]+)/.exec(ref)[1]
  let n = 0
  for (const c of m) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

const sheet = fs.readFileSync(path.join(tmp, 'xl/worksheets/sheet1.xml'), 'utf8')
const rows = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => {
  const cells = {}
  for (const m of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const t = /t="([^"]+)"/.exec(m[2])?.[1]
    const v = /<v>([\s\S]*?)<\/v>/.exec(m[3])?.[1]
    cells[colIdx(m[1])] = (v == null ? '' : (t === 's' ? strings[+v] : v)).toString().trim()
  }
  return cells
})

const clean = s => (s && s.length ? s : null)
const records = []
let category = null

for (const r of rows) {
  const first = r[0] || ''
  const isData = /^\d+$/.test(first) && (r[2] || '').length > 0
  // A banner row: text in the first column, nothing much else.
  if (!isData && first.length > 0 && Object.keys(r).length <= 2) {
    if (!/Virtuoso|Checklist|Bars ·/i.test(first)) category = first.trim()
    continue
  }
  if (!isData) continue

  records.push({
    holding_company: clean(r[1]),
    brand_name: r[2],
    venue_type: clean(r[3]),
    area: clean(r[4]),
    priority: ['High', 'Medium', 'Low'].includes(r[5]) ? r[5] : null,
    contact_title: clean(r[6]),   // "Key Contact" is the role
    contact_name: null,           // sheet column is junk (see header comment)
    linkedin_url: clean(r[8]),
    email: clean(r[9]),
    status: 'Not Contacted',
    notes: category ? 'Category: ' + category : null,
  })
}

console.log('parsed ' + records.length + ' venues from the sheet')

const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }

const existingRes = await fetch(URL_ + '/rest/v1/venue_pipeline?select=brand_name', { headers: h })
if (!existingRes.ok) {
  console.error('Cannot read venue_pipeline (' + existingRes.status + '). Has CREATE-VENUE-PIPELINE.sql been run?')
  console.error(await existingRes.text())
  process.exit(1)
}
const existing = new Set((await existingRes.json()).map(r => r.brand_name))
const fresh = records.filter(r => !existing.has(r.brand_name))
console.log('already present: ' + existing.size + ' | inserting: ' + fresh.length)

if (fresh.length === 0) {
  console.log('nothing to do')
  process.exit(0)
}

// Chunked so one oversized request cannot fail the whole seed.
let inserted = 0
for (let i = 0; i < fresh.length; i += 50) {
  const chunk = fresh.slice(i, i + 50)
  const res = await fetch(URL_ + '/rest/v1/venue_pipeline', {
    method: 'POST',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify(chunk),
  })
  if (!res.ok) {
    console.error('chunk ' + i + ' failed: ' + res.status + ' ' + (await res.text()).slice(0, 300))
    process.exit(1)
  }
  inserted += chunk.length
  console.log('  inserted ' + inserted + '/' + fresh.length)
}

const count = (await (await fetch(URL_ + '/rest/v1/venue_pipeline?select=id', { headers: h })).json()).length
console.log('done. venue_pipeline now holds ' + count + ' rows.')
