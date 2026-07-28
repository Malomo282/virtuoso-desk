/**
 * Generate lib/database.types.ts from the live schema.
 *
 *   node scripts/gen-types.mjs
 *
 * Re-run this after any migration. Types are derived from the PostgREST
 * OpenAPI description rather than the Supabase CLI, so it needs only the
 * service role key already in .env.local - no access token or DB password.
 *
 * Column NAMES and types come straight from the database and are exact.
 * Nullability is inferred: PostgREST marks a column "required" when it is
 * NOT NULL without a default, so a NOT NULL column that has a default is
 * treated here as nullable. That errs towards permissive - it will never
 * invent a column, which is the failure this is here to catch.
 */
import fs from 'fs'
import path from 'path'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

function tsType(prop) {
  const f = (prop.format || '').toLowerCase()
  if (prop.type === 'array') return (f.startsWith('json') ? 'Json' : scalar(f.replace(/\[\]$/, ''))) + '[]'
  return scalar(f, prop.type)
}

function scalar(format, jsonType) {
  if (/^(smallint|integer|bigint|numeric|real|double precision|money)$/.test(format)) return 'number'
  if (format === 'boolean') return 'boolean'
  if (format.startsWith('json')) return 'Json'
  if (format) return 'string'
  if (jsonType === 'integer' || jsonType === 'number') return 'number'
  if (jsonType === 'boolean') return 'boolean'
  return 'string'
}

const res = await fetch(URL_ + '/rest/v1/', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
if (!res.ok) {
  console.error('Could not read schema:', res.status, await res.text())
  process.exit(1)
}
const spec = await res.json()
const defs = spec.definitions || {}

const lines = []
lines.push('// AUTO-GENERATED - do not edit by hand.')
lines.push('// Regenerate with: node scripts/gen-types.mjs')
lines.push('')
lines.push('export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]')
lines.push('')
lines.push('export type Database = {')
lines.push('  public: {')
lines.push('    Tables: {')

const names = Object.keys(defs).sort()
const views = names.filter(n => n.endsWith('_view'))
const tables = names.filter(n => !n.endsWith('_view'))

for (const name of tables) {
  const def = defs[name]
  const props = def.properties || {}
  const required = new Set(def.required || [])
  const cols = Object.keys(props)

  lines.push(`      ${name}: {`)
  lines.push('        Row: {')
  for (const c of cols) {
    const t = tsType(props[c])
    lines.push(`          ${c}: ${t}${required.has(c) ? '' : ' | null'}`)
  }
  lines.push('        }')

  lines.push('        Insert: {')
  for (const c of cols) {
    const t = tsType(props[c])
    // Required and no default -> caller must supply it.
    const must = required.has(c) && props[c].default === undefined
    lines.push(`          ${c}${must ? '' : '?'}: ${t}${required.has(c) ? '' : ' | null'}`)
  }
  lines.push('        }')

  lines.push('        Update: {')
  for (const c of cols) {
    const t = tsType(props[c])
    lines.push(`          ${c}?: ${t}${required.has(c) ? '' : ' | null'}`)
  }
  lines.push('        }')
  // supabase-js requires Relationships to satisfy GenericTable, and uses it
  // to resolve embedded selects like .select('*, venues(name)'). Without the
  // real foreign keys here, every join resolves to `never`.
  lines.push('        Relationships: [')
  for (const c of cols) {
    const fk = /<fk table='([^']+)' column='([^']+)'\/>/.exec(props[c].description || '')
    if (!fk) continue
    lines.push('          {')
    lines.push(`            foreignKeyName: "${name}_${c}_fkey"`)
    lines.push(`            columns: ["${c}"]`)
    lines.push('            isOneToOne: false')
    lines.push(`            referencedRelation: "${fk[1]}"`)
    lines.push(`            referencedColumns: ["${fk[2]}"]`)
    lines.push('          },')
  }
  lines.push('        ]')
  lines.push('      }')
}
lines.push('    }')

lines.push('    Views: {')
for (const name of views) {
  const props = defs[name].properties || {}
  const required = new Set(defs[name].required || [])
  lines.push(`      ${name}: {`)
  lines.push('        Row: {')
  for (const c of Object.keys(props)) {
    lines.push(`          ${c}: ${tsType(props[c])}${required.has(c) ? '' : ' | null'}`)
  }
  lines.push('        }')
  lines.push('        Relationships: []')
  lines.push('      }')
}
lines.push('    }')
lines.push('    Functions: Record<string, never>')
lines.push('    Enums: Record<string, never>')
lines.push('    CompositeTypes: Record<string, never>')
lines.push('  }')
lines.push('}')
lines.push('')

const out = path.join('lib', 'database.types.ts')
fs.writeFileSync(out, lines.join('\n'))
console.log(`Wrote ${out}`)
console.log(`  ${tables.length} tables: ${tables.join(', ')}`)
console.log(`  ${views.length} view(s): ${views.join(', ')}`)
