import{NextResponse}from'next/server'
import{createClient}from'@supabase/supabase-js'
export async function GET(request:Request){
const url=new URL(request.url)
const token_hash=url.searchParams.get('token_hash')
const type=url.searchParams.get('type')
const code=url.searchParams.get('code')
if(token_hash&&type==='recovery')return NextResponse.redirect(new URL('/update-password?token_hash='+token_hash+'&type=recovery',url.origin))
if(token_hash&&(type==='invite'||type==='signup'))return NextResponse.redirect(new URL('/update-password?token_hash='+token_hash+'&type='+type,url.origin))
if(code)return NextResponse.redirect(new URL('/update-password?code='+code,url.origin))
return NextResponse.redirect(new URL('/login',url.origin))}