import{NextResponse}from'next/server'
import type { Database } from '@/lib/database.types'
import{createClient}from'@supabase/supabase-js'
import{notifyAgency}from'@/lib/notify'
import{passwordError}from'@/lib/password'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function POST(request:Request){
try{
const{token,email,fullName,stageName,password}=await request.json()
if(!token||!email||!password)return NextResponse.json({error:'Missing required fields'},{status:400})
// Enforced here as well as in the form: this endpoint can be called directly,
// so the browser check is a convenience, not the control.
const weak=passwordError(password)
if(weak)return NextResponse.json({error:weak},{status:400})
const supabaseAdmin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
const{data:invite,error:inviteError}=await supabaseAdmin.from('artist_invites').select('*').eq('token',token).eq('used',false).single()
if(inviteError||!invite)return NextResponse.json({error:'Invalid or expired invite'},{status:400})
if(new Date(invite.expires_at)<new Date())return NextResponse.json({error:'Invite has expired'},{status:400})
const{data:authData,error:authError}=await supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true})
if(authError)return NextResponse.json({error:authError.message},{status:400})
const userId=authData.user.id
await supabaseAdmin.from('profiles').insert({id:userId,role:'artist',full_name:fullName,email})
const{error:artistError}=await supabaseAdmin.from('artists').insert({user_id:userId,stage_name:stageName});if(artistError)return NextResponse.json({error:'Artist profile creation failed: '+artistError.message},{status:500})
await supabaseAdmin.from('artist_invites').update({used:true}).eq('token',token)

// The invite is sent and then goes quiet - without this the agency has no
// way of knowing an artist actually finished signing up, short of checking
// the roster. Never let a notification failure fail the registration
// itself: the account already exists by this point.
try{
await notifyAgency(supabaseAdmin,{
type:'artist_registered',
message:(stageName||fullName||email)+' has completed registration and joined your roster.',
})
}catch(e){
console.error('artist_registered notification failed',e)
}

return NextResponse.json({success:true})
}catch(e:any){
return NextResponse.json({error:e.message},{status:500})
}}