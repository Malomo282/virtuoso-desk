import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether an artist has filed their signed agency agreement.
 *
 * This is the gate on gig work: an artist with no agreement on file must not
 * be offered gigs, must not be able to accept one, and must not be
 * confirmable by the agency. Both portals check through here so they cannot
 * drift apart and let a gig through one route that the other would block.
 *
 * Either party may file the agreement (it is a document between the two), so
 * the check is simply whether a row exists - not who uploaded it.
 */
export const AGREEMENT_DOC_TYPE = 'agency_agreement'

export const AGREEMENT_REQUIRED_MESSAGE =
  'A signed agency agreement must be on file before gigs can be offered or accepted.'

export async function hasSignedAgreement(admin: SupabaseClient<any>, artistId: string) {
  const { data } = await admin
    .from('artist_documents')
    .select('id')
    .eq('artist_id', artistId)
    .eq('doc_type', AGREEMENT_DOC_TYPE)
    .maybeSingle()
  return !!data
}
