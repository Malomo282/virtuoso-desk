import{NextResponse}from'next/server'
import{createClient}from'@supabase/supabase-js'
export async function POST(request:Request){
try{
const{token,email,fullName,stageName,password}=await request.json()
if(!token||!email||!password)return NextResponse.json({error:'Missing required fields'},{status:400})
const supabaseAdmin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
const{data:invite,error:inviteError}=await supabaseAdmin.from('artist_invites').select('*').eq('token',token).eq('used',false).single()
if(inviteError||!invite)return NextResponse.json({error:'Invalid or expired invite'},{status:400})
if(new Date(invite.expires_at)<new Date())return NextResponse.json({error:'Invite has expired'},{status:400})
const{data:authData,error:authError}=await supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true})
if(authError)return NextResponse.json({error:authError.message},{status:400})
const userId=authData.user.id
await supabaseAdmin.from('profiles').insert({id:userId,role:'artist',full_name:fullName,email})
await supabaseAdmin.from('artists').insert({user_id:userId,stage_name:stageName,full_name:fullName})
await supabaseAdmin.from('artist_invites').update({used:true}).eq('token',token)
return NextResponse.json({success:true})
}catch(e:any){
return NextResponse.json({error:e.message},{status:500})
}}