import{NextResponse}from'next/server'
import{createClient}from'@supabase/supabase-js'
import{Resend}from'resend'
export async function POST(request:Request){
try{
const{email,fullName,stageName}=await request.json()
if(!email)return NextResponse.json({error:'Email required'},{status:400})
const url=process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key)return NextResponse.json({error:'Missing env vars: url='+!!url+' key='+!!key},{status:500})
const supabaseAdmin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
const token=Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2)+Date.now().toString(36)
const{error:insertError}=await supabaseAdmin.from('artist_invites').insert({email,token,full_name:fullName||null,stage_name:stageName||null})
if(insertError)return NextResponse.json({error:insertError.message,hint:insertError.hint},{status:400})
const resend=new Resend(process.env.RESEND_API_KEY)
const registerUrl=(process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000')+'/register?token='+token
const{error:emailError}=await resend.emails.send({from:'Virtuoso Entertainment <bookings@virtuosoentertainment.co.uk>',to:email,subject:'You have been invited to join Virtuoso Entertainment',html:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto"><div style="background:#151A22;padding:32px;text-align:center"><div style="font-size:36px;font-weight:bold;color:#C8A24A">VE</div><div style="color:#fff;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;margin-top:8px">Virtuoso Entertainment Ltd</div></div><div style="padding:32px;background:#0E1117"><h2 style="color:#fff">You have been invited</h2><p style="color:#8A96A8">You have been invited to join the Virtuoso Entertainment artist roster.</p><p style="color:#8A96A8">Click below to create your account. This link expires in 7 days.</p><div style="text-align:center;margin:32px 0"><a href="${registerUrl}" style="background:#C8A24A;color:#0E1117;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:14px;text-transform:uppercase">Create my account</a></div><p style="color:#4E5A6A;font-size:12px">If you were not expecting this, ignore this email.</p></div><div style="background:#151A22;padding:16px;text-align:center"><p style="color:#4E5A6A;font-size:11px;margin:0">Virtuoso Entertainment Ltd - bookings@virtuosoentertainment.co.uk</p></div></div>`})
if(emailError)return NextResponse.json({error:'Email failed: '+emailError.message},{status:400})
return NextResponse.json({success:true})
}catch(e:any){
return NextResponse.json({error:e.message},{status:500})
}}