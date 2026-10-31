import React, {useEffect,useState} from 'react';
export default function Admin(){
  const [data,setData]=useState(null); const [err,setErr]=useState('');
  const [email,setEmail]=useState('rahamanmatiur397@gmail.com'); const [password,setPassword]=useState('Admin1234');
  const [creditsEmail,setCreditsEmail]=useState(''); const [credits,setCredits]=useState(100);
  const backend=import.meta.env.VITE_BACKEND_URL||'https://ai-saas-generator-d3g8.onrender.com';
  const doLogin=async()=>{
    setErr('Logging in...');
    const r=await fetch(`${backend}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const j=await r.json();
    if(j.success){ localStorage.setItem('token',j.token); setErr(''); load(j.token); }
    else setErr(j.error||'Login failed');
  };
  const load=async(tok)=>{
    const token=tok||localStorage.getItem('token');
    if(!token){ setErr('__NEED_LOGIN__'); return; }
    const r=await fetch(`${backend}/api/admin/stats`,{headers:{Authorization:`Bearer ${token}`}});
    const j=await r.json();
    if(j.success) setData(j); else setErr(j.error||'Failed');
  };
  useEffect(()=>{load()},[]);
  const addCredits=async()=>{
    const token=localStorage.getItem('token');
    const r=await fetch(`${backend}/api/admin/add-credits`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({email:creditsEmail,credits})});
    const j=await r.json(); alert(j.message||j.error); load();
  };
  if(err==='__NEED_LOGIN__' || (err && !data)) return <div style={{padding:40,fontFamily:'sans-serif',background:'#0f172a',minHeight:'100vh',color:'#fff'}}>
    <h2>🛡️ Admin Login</h2>
    <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" style={{display:'block',padding:10,margin:'10px 0',width:'100%',maxWidth:300,borderRadius:6,border:'1px solid #334155',background:'#1e293b',color:'#fff'}}/>
    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" style={{display:'block',padding:10,margin:'10px 0',width:'100%',maxWidth:300,borderRadius:6,border:'1px solid #334155',background:'#1e293b',color:'#fff'}}/>
    <button onClick={doLogin} style={{background:'linear-gradient(90deg,#7C3AED,#06B6D4)',color:'#fff',border:'none',padding:'10px 24px',borderRadius:8,cursor:'pointer',fontWeight:'bold'}}>Login as Admin</button>
    {err && err!=='__NEED_LOGIN__' && <p style={{color:'#f87171'}}>{err}</p>}
  </div>;
  if(!data) return <div style={{padding:40,color:'#fff'}}>Loading... {err}</div>;
  return <div style={{padding:24,fontFamily:'sans-serif',background:'#0f172a',minHeight:'100vh',color:'#fff'}}>
    <h1>🛡️ Admin Command Center</h1>
    <div style={{display:'flex',gap:16,margin:'20px 0'}}>
      <div style={{background:'#1e293b',padding:20,borderRadius:12,flex:1}}><h3>Total Users</h3><h2 style={{color:'#22d3ee'}}>{data.stats.totalUsers}</h2></div>
      <div style={{background:'#1e293b',padding:20,borderRadius:12,flex:1}}><h3>Total Generations</h3><h2 style={{color:'#a78bfa'}}>{data.stats.totalGenerations}</h2></div>
    </div>
    <div style={{background:'#1e293b',padding:20,borderRadius:12,marginBottom:20}}>
      <h3>💳 Add Credits</h3>
      <input placeholder="user email" value={creditsEmail} onChange={e=>setCreditsEmail(e.target.value)} style={{padding:8,marginRight:8,borderRadius:6,border:'1px solid #334155',background:'#0f172a',color:'#fff'}}/>
      <input type="number" value={credits} onChange={e=>setCredits(e.target.value)} style={{padding:8,marginRight:8,borderRadius:6,width:100,border:'1px solid #334155',background:'#0f172a',color:'#fff'}}/>
      <button onClick={addCredits} style={{background:'linear-gradient(90deg,#7C3AED,#06B6D4)',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,cursor:'pointer'}}>Add</button>
    </div>
    <div style={{background:'#1e293b',padding:20,borderRadius:12}}>
      <h3>👥 Recent Users</h3>
      {data.recentUsers.map(u=><div key={u._id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #334155'}}><span>{u.name} ({u.email})</span><span style={{color:'#22d3ee'}}>{u.credits} credits • {u.role}</span></div>)}
    </div>
  </div>;
}
