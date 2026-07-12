'use client'
import{useState,useEffect}from'react'
import{supabase}from'@/lib/supabase'
export default function RegisterPage(){
const[loading,setLoading]=useState(false)
const[checking,setChecking]=useState(true)
const[error,setError]=useState('')
const[token,setToken]=useState('')
const[inviteEmail,setInviteEmail]=useState('')
const[consent,setConsent]=useState(false)
const[form,setForm]=useState({stageName:'',fullName:'',password:'',confirmPassword:''})
useEffect(()=>{async function check(){
const params=new URLSearchParams(window.location.search)
const t=params.get('token')
if(!t){setError('Invalid invite link. Please contact Virtuoso Entertainment.');setChecking(false);return}
setToken(t)
const res=await fetch('/api/validate-invite?token='+t)
const data=await res.json()
if(!res.ok||!data.valid){setError(data.error||'This invite link is invalid or has expired.');setChecking(false);return}
if(data.full_name)setForm(p=>({...p,fullName:data.full_name||''}))
if(data.stage_name)setForm(p=>({...p,stageName:data.stage_name||''}))
setInviteEmail(data.email||'')
setChecking(false)};check()},[]);
function update(f,v){setForm(p=>({...p,[f]:v}))}
async function handleSubmit(e){e.preventDefault();setLoading(true);setError('');
if(!consent){setError('Please agree to the terms and privacy policy');setLoading(false);return}
if(!form.stageName.trim()){setError('Stage name is required');setLoading(false);return}
if(!form.fullName.trim()){setError('Full name is required');setLoading(false);return}
if(form.password!==form.confirmPassword){setError('Passwords do not match');setLoading(false);return}
if(form.password.length<8){setError('Password must be at least 8 characters');setLoading(false);return}
const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,email:inviteEmail,fullName:form.fullName,stageName:form.stageName,password:form.password})})
const data=await res.json()
if(!res.ok){setError(data.error||'Registration failed');setLoading(false);return}
const{error:signInError}=await supabase.auth.signInWithPassword({email:inviteEmail,password:form.password})
if(signInError){setError('Account created but could not log in. Please go to the login page.');setLoading(false);return}
window.location.href='/artist/dashboard'}
if(checking)return(<div className="min-h-screen bg-[#0E1117] flex items-center justify-center"><div className="text-[#C8A24A] text-4xl font-bold animate-pulse">VE</div></div>)
if(error&&!inviteEmail)return(<div className="min-h-screen bg-[#0E1117] flex items-center justify-center px-4"><div className="w-full max-w-md"><div className="text-center mb-8"><div className="text-5xl font-bold text-[#C8A24A] mb-3">VE</div><div className="text-white text-sm font-semibold tracking-[0.2em] uppercase">Virtuoso Entertainment</div></div><div className="bg-[#151A22] border border-[#263044] rounded-2xl p-8 text-center"><div className="text-red-400 text-4xl mb-4">✕</div><h2 className="text-white text-lg font-semibold mb-2">Invalid invite link</h2><p className="text-[#6A7A8A] text-sm mb-4">{error}</p><a href="mailto:bookings@virtuosoentertainment.co.uk" className="text-[#C8A24A] text-sm hover:underline">Contact Virtuoso Entertainment</a></div></div></div>)
return(<div className="min-h-screen bg-[#0E1117] flex items-center justify-center px-4 py-12"><div className="w-full max-w-md"><div className="text-center mb-8"><div className="text-5xl font-bold text-[#C8A24A] mb-3">VE</div><div className="text-white text-sm font-semibold tracking-[0.2em] uppercase mb-1">Virtuoso Entertainment</div><div className="text-[#6A7A8A] text-xs tracking-widest uppercase italic">Artist Portal</div></div><div className="bg-[#151A22] border border-[#263044] rounded-2xl p-8"><h1 className="text-white text-xl font-semibold mb-1">Create your account</h1><p className="text-[#6A7A8A] text-sm mb-6">You have been invited to join the Virtuoso Entertainment artist portal.</p><form onSubmit={handleSubmit} className="space-y-4">{inviteEmail&&<div className="bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3"><div className="text-[#4E5A6A] text-xs uppercase tracking-widest mb-1">Email</div><div className="text-white text-sm">{inviteEmail}</div></div>}<div><label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">Full name</label><input type="text" value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]" placeholder="e.g. Marcus Reid"/></div><div><label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">Stage name</label><input type="text" value={form.stageName} onChange={e=>update('stageName',e.target.value)} required className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]" placeholder="e.g. DJ Reide"/></div><div className="border-t border-[#263044] pt-4"><div><label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">Password</label><input type="password" value={form.password} onChange={e=>update('password',e.target.value)} required className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]" placeholder="Minimum 8 characters"/></div><div className="mt-4"><label className="block text-[#8A96A8] text-xs uppercase tracking-widest mb-2">Confirm password</label><input type="password" value={form.confirmPassword} onChange={e=>update('confirmPassword',e.target.value)} required className="w-full bg-[#1C2330] border border-[#263044] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C8A24A]" placeholder="Repeat your password"/></div></div><div className="flex items-start gap-3 pt-2"><input type="checkbox" id="consent" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#C8A24A] flex-shrink-0"/><label htmlFor="consent" className="text-[#6A7A8A] text-xs leading-relaxed">I agree to the <a href="/terms" target="_blank" className="text-[#C8A24A] hover:underline">Terms of Service</a> and <a href="/privacy-policy" target="_blank" className="text-[#C8A24A] hover:underline">Privacy Policy</a> of Virtuoso Entertainment Ltd.</label></div>{error&&<div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}<button type="submit" disabled={loading||!consent} className="w-full bg-[#C8A24A] hover:bg-[#D6B25E] disabled:opacity-40 text-[#0E1117] font-bold py-3 rounded-lg text-sm uppercase tracking-widest">{loading?'Creating account...':'Create account'}</button></form><p className="text-center text-[#4E5A6A] text-xs mt-6"><a href="/privacy-policy" target="_blank" className="text-[#C8A24A] hover:underline">Privacy Policy</a> · <a href="/terms" target="_blank" className="text-[#C8A24A] hover:underline">Terms of Service</a></p></div></div></div>)}