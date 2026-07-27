import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// The anon key is public (it ships in the browser bundle). If anon can read a
// table, RLS is off or permissive there - which means ANY signed-in artist can
// read every row too. Anon being blocked does not by itself prove per-artist
// scoping, but anon succeeding definitely proves there is none.
const tables = [
  ['bookings', 'fee_venue = agency margin, all artists'],
  ['artists', 'stage names, min fees, bios of every artist'],
  ['profiles', 'names and email addresses'],
  ['venues', 'venue contacts and phone numbers'],
  ['available_gigs', 'open gig listings'],
  ['gig_responses', 'who accepted/declined what'],
  ['artist_availability', 'other artists blackout dates'],
  ['artist_documents', 'identity document metadata'],
  ['agreements', 'contract metadata'],
  ['invoices', 'invoice amounts'],
  ['notifications', 'other users notifications'],
  ['artist_invites', 'pending invite tokens'],
]

console.log('table                 rows via public anon key   risk')
console.log('-'.repeat(78))
const leaky = []
for (const [t, why] of tables) {
  const { data, error } = await anon.from(t).select('*')
  const { count } = await admin.from(t).select('*', { count: 'exact', head: true })
  let verdict
  if (error) verdict = 'blocked'
  else if ((data?.length ?? 0) > 0) { verdict = '*** ' + data.length + ' ROWS READABLE ***'; leaky.push([t, why]) }
  else if ((count ?? 0) > 0) verdict = 'blocked (table has ' + count + ' rows)'
  else verdict = 'empty - inconclusive'
  console.log(t.padEnd(22) + verdict)
}

console.log('\n' + '-'.repeat(78))
if (leaky.length === 0) {
  console.log('No table is readable with the public key.')
} else {
  console.log('LEAKY TABLES:')
  for (const [t, why] of leaky) console.log('  ' + t + ' -> ' + why)
}
