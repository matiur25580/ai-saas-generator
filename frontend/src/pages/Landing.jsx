import React from 'react';
import { ArrowDownRight, ArrowRight, Check, ChevronDown, CircleHelp, FileText, KeyRound, MailCheck, WandSparkles } from 'lucide-react';

const features = [
  { icon: WandSparkles, title: 'Real model responses', detail: 'Generation runs through the configured Gemini API. Failed requests stay errors; no filler output is substituted.' },
  { icon: FileText, title: 'A focused writing studio', detail: 'Choose a format, voice, length, and creativity level, then refine or translate with another model request.' },
  { icon: KeyRound, title: 'Account-backed history', detail: 'Signed-in generations, bookmarks, credit changes, and account history are stored with your account.' }
];

const questions = [
  ['Does generation work without an account?', 'Yes. Guest generations are not saved to an account and do not spend account credits. Sign in to keep history and use tracked credits.'],
  ['How are credits used?', 'A new account starts with 50 credits. Each signed-in generation deducts one credit. Admins can grant additional credits; checkout and subscriptions are not available yet.'],
  ['How is email verification sent?', 'Signup and password-reset codes are sent through the configured Brevo API and expire after three minutes.'],
  ['What happens when the AI provider is unavailable?', 'The studio shows a clear error and does not add a generated result to history or deduct credits.']
];

export default function Landing({ onOpenStudio, onLogin }) {
  return (
    <main className="landing-page">
      <nav className="landing-nav page-gutter" aria-label="Main navigation">
        <a className="brand-mark" href="#top" aria-label="Draftline home"><span className="brand-glyph">D</span><span>draftline<span className="brand-dot">.</span></span></a>
        <div className="landing-nav-links"><a href="#product">Product</a><a href="#trust">How it works</a><a href="#faq">FAQ</a></div>
        <div className="landing-nav-actions"><button className="button button-quiet" onClick={onLogin}>Sign in</button><button className="button button-dark" onClick={onOpenStudio}>Open the studio <ArrowRight size={16} /></button></div>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-photo" role="img" aria-label="A writer working at a desk" />
        <div className="hero-shade" />
        <div className="hero-copy page-gutter">
          <span className="hero-kicker"><span className="live-dot" /> REAL AI. CLEAR LIMITS. YOUR WORKFLOW.</span>
          <h1>Good ideas deserve<br /><em>better words.</em></h1>
          <p>Turn a rough brief into useful content with a real Gemini response, deliberate controls, and an account history you can keep.</p>
          <div className="hero-actions"><button className="button button-acid" onClick={onOpenStudio}>Open the writing studio <ArrowRight size={17} /></button><a className="hero-secondary" href="#product">Explore the workflow <ArrowDownRight size={17} /></a></div>
          <div className="hero-footnote"><Check size={15} /> 50 starter credits on signup <span className="footnote-divider" /> No subscription checkout is offered yet</div>
        </div>
        <div className="hero-index"><span>01</span><span className="index-line" /><span>04</span></div>
      </section>

      <section className="integration-strip page-gutter" aria-label="Current integrations"><span>CONNECTED TO</span><b>Google Gemini</b><i /><b>Brevo</b><i /><b>MongoDB Atlas</b><i /><b>Vercel + Render</b></section>

      <section className="feature-section page-gutter" id="product">
        <div className="section-heading"><div><span className="eyebrow">A small, honest toolkit</span><h2>From first draft<br />to finished thought.</h2></div><p>One workspace for creating, refining, and revisiting content. The controls change the real request; the history belongs to your account.</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, title, detail }, index) => <article className="feature-item" key={title}><span className="feature-number">0{index + 1}</span><Icon size={22} strokeWidth={1.7} /><h3>{title}</h3><p>{detail}</p></article>)}</div>
      </section>

      <section className="workflow-section page-gutter" id="trust">
        <div className="workflow-copy"><span className="eyebrow">How the workflow works</span><h2>Every click has<br />a real job.</h2><p>Pick a content format, set the voice and length, and send your brief to Gemini. Refine or translate by making another request, then return to saved work when you sign in.</p><button className="text-link" onClick={onOpenStudio}>Try the studio <ArrowRight size={16} /></button></div>
        <div className="workflow-list"><div><span>01</span><div><b>Describe the task</b><p>Use your own brief or start from an editable prompt.</p></div><CircleHelp size={18} /></div><div><span>02</span><div><b>Shape the response</b><p>Format, tone, length, and temperature are sent to the model.</p></div><WandSparkles size={18} /></div><div><span>03</span><div><b>Keep what matters</b><p>Account history and credit events are saved on the backend.</p></div><MailCheck size={18} /></div></div>
      </section>

      <section className="proof-section page-gutter"><div className="proof-heading"><span className="eyebrow">Proof in the plumbing</span><h2>Built around real services,<br />not demo screens.</h2></div><div className="proof-grid"><div><span className="proof-check"><Check size={16} /></span><b>Gemini REST API</b><p>Model failures surface clearly; no generated-looking fallback text.</p></div><div><span className="proof-check"><Check size={16} /></span><b>Brevo transactional email</b><p>OTP delivery is confirmed before the UI reports success.</p></div><div><span className="proof-check"><Check size={16} /></span><b>MongoDB-backed accounts</b><p>History, password resets, and credit events use persisted records.</p></div></div></section>

      <section className="usage-section page-gutter"><div><span className="eyebrow">Straightforward usage</span><h2>Start with room<br />to find your voice.</h2><p>New accounts receive 50 credits. Each signed-in generation costs one credit. No paid plans or checkout are advertised until billing is implemented.</p></div><div className="usage-count"><strong>50</strong><span>starter credits<br />per new account</span><button className="button button-dark" onClick={onOpenStudio}>Create your account <ArrowRight size={16} /></button></div></section>

      <section className="faq-section page-gutter" id="faq"><div><span className="eyebrow">Useful details</span><h2>Questions,<br />answered plainly.</h2></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></section>

      <footer className="landing-footer page-gutter"><a className="brand-mark" href="#top"><span className="brand-glyph">D</span><span>draftline<span className="brand-dot">.</span></span></a><span>AI writing studio · Gemini · Brevo · MongoDB</span><div><a href="#product">Product</a><a href="#faq">FAQ</a><button onClick={onLogin}>Sign in</button></div></footer>
    </main>
  );
}
