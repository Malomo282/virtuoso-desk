import{NextResponse}from'next/server'
import type{NextRequest}from'next/server'
export function middleware(request:NextRequest){
const{pathname}=request.nextUrl
const pub=['/login','/reset-password','/update-password','/auth/callback','/register']
if(pub.some(r=>pathname.startsWith(r)))return NextResponse.next()
return NextResponse.next()}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']}