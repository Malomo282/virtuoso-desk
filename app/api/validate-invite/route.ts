import{NextResponse}from'next/server'
import{createClient}from'@supabase/supabase-js'
export async function GET(request:Request){
try{
const url=new URL(request.url)
const token=url.searchParams.get('token')
if(!token)return NextResponse.json({error:'Token required',valid:false},{status:400})
const supabaseAdmin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
const{data,error}=await supabaseAdmin.from('artist_invites').select('*').eq('token',token).eq('used',false).single()
if(error||!data)return NextResponse.json({error:'Invite not found or already used',valid:false},{status:400})
if(new Date(data.expires_at)<new Date())return NextResponse.json({error:'This invite link has expired. Please contact Virtuoso Entertainment.',valid:false},{status:400})
return NextResponse.json({valid:true,email:data.email,full_name:data.full_name,stage_name:data.stage_name})
}catch(e:any){
return NextResponse.json({error:e.message,valid:false},{status:500})
}}