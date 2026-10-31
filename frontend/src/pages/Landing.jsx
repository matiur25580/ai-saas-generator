import React from 'react';
export default function Landing({onGetStarted}){
  return (
  <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0A0F2C 0%,#1e1b4b 50%,#0e7490 100%)',color:'#fff',fontFamily:'sans-serif'}}>
    <nav style={{display:'flex',justifyContent:'space-between',padding:'20px 40px',alignItems:'center'}}>
      <h2>🚀 AI SaaS Generator</h2>
      <button onClick={onGetStarted} style={{background:'linear-gradient(90deg,#7C3AED,#06B6D4)',border:'none',color:'#fff',padding:'10px 24px',borderRadius:'8px',cursor:'pointer',fontWeight:'bold'}}>Login / Get Started</button>
    </nav>
    <div style={{textAlign:'center',padding:'80px 20px'}}>
      <h1 style={{fontSize:'48px',margin:'0 0 20px'}}>Generate Smart Content<br/>with <span style={{background:'linear-gradient(90deg,#A78BFA,#22D3EE)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>AI Power</span></h1>
      <p style={{color:'#cbd5e1',fontSize:'18px',maxWidth:'600px',margin:'0 auto 30px'}}>10+ Personas, 6 Tones, Real-time History, PDF Export. Enterprise-grade MERN + AI SaaS.</p>
      <button onClick={onGetStarted} style={{background:'linear-gradient(90deg,#7C3AED,#06B6D4)',border:'none',color:'#fff',padding:'16px 40px',borderRadius:'12px',fontSize:'18px',cursor:'pointer',fontWeight:'bold'}}>⚡ Start Generating Free</button>
      <div style={{marginTop:'20px',color:'#94a3b8'}}>✅ 50 Free Credits • No Card Required</div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:'20px',padding:'40px',maxWidth:'1000px',margin:'0 auto'}}>
      {[['🤖','AI Personas','10+ expert personas for any use case'],['🎨','6 Tones','Professional to Funny, full control'],['📚','Smart History','Search, filter, download PDF/TXT'],['💳','SaaS Credits','Free/Pro/Enterprise plans']].map((f,i)=>(
        <div key={i} style={{background:'rgba(255,255,255,0.08)',padding:'24px',borderRadius:'16px',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:'32px'}}>{f[0]}</div><h3>{f[1]}</h3><p style={{color:'#cbd5e1'}}>{f[2]}</p>
        </div>
      ))}
    </div>
    <div style={{textAlign:'center',padding:'40px'}}>
      <h2>Pricing</h2>
      <div style={{display:'flex',gap:'20px',justifyContent:'center',flexWrap:'wrap',marginTop:'20px'}}>
        {[['Free','₹0','50 credits/mo'],['Pro','₹499/mo','2000 credits/mo'],['Enterprise','Custom','Unlimited']].map((p,i)=>(
          <div key={i} style={{background:i===1?'linear-gradient(135deg,#7C3AED,#06B6D4)':'rgba(255,255,255,0.08)',padding:'30px',borderRadius:'16px',minWidth:'200px'}}>
            <h3>{p[0]}</h3><h2>{p[1]}</h2><p>{p[2]}</p>
            <button onClick={onGetStarted} style={{background:'#fff',color:'#0A0F2C',border:'none',padding:'10px 20px',borderRadius:'8px',cursor:'pointer',fontWeight:'bold',marginTop:'10px'}}>Choose</button>
          </div>
        ))}
      </div>
    </div>
    <footer style={{textAlign:'center',padding:'20px',color:'#64748b',borderTop:'1px solid rgba(255,255,255,0.1)'}}>Built by Matiur Rahman • MERN Full Stack Developer • 2026</footer>
  </div>);
}
