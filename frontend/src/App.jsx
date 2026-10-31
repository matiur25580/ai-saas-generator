import React, { useState, useEffect } from 'react';
import './App.css';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import AuthModal from './components/AuthModal';

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState('');
  const [contentType, setContentType] = useState('');
  const [outputLength, setOutputLength] = useState('');
  const [aiTone, setAiTone] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(2);
  
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('saas_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [isListening, setIsListening] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('customApiKey') || '');

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [user, setUser] = useState(localStorage.getItem('loggedInUser') || null);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('saas_history', JSON.stringify(history));
  }, [history]);

  const isDark = theme === 'dark';
  const themeStyles = {
    appBg: isDark ? '#0f172a' : '#f8fafc',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    textColor: isDark ? '#fff' : '#0f172a',
    mutedText: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#cbd5e1',
    inputBg: isDark ? '#0f172a' : '#f1f5f9',
    inputColor: isDark ? '#fff' : '#0f172a',
  };

  const handleQuickTag = (tagText) => {
    setPrompt(tagText);
  };

  const typeWriterEffect = (text, i = 0) => {
    if (i < text.length) {
      setOutput((prev) => prev + text.charAt(i));
      setTimeout(() => typeWriterEffect(text, i + 1), 10);
    } else {
      setLoading(false);
    }
  };

  // Main Generator Function connecting to Express Backend Server
  const handleGenerate = async (customInstruction = '') => {
    const activePrompt = customInstruction || prompt;
    if (!activePrompt.trim()) {
      alert('Please enter a prompt here...');
      return;
    }

    setLoading(true);
    if (!customInstruction) setOutput('');

    


          try {
        const response = await fetch('https://ai-saas-generator-d3g8.onrender.com/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: activePrompt,
            persona: persona,
            aiTone: aiTone
          })
        });


      const data = await response.json();

      if (response.ok && data.success) {
        const aiResult = data.result;

        const now = new Date();
        const formattedDate = now.toLocaleDateString(); 
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); 
        const dateTimeString = `${formattedDate}, ${formattedTime}`;

        setCredits(prev => Math.max(0, prev - 1));
        setHistory(prev => [{ id: Date.now(), prompt: activePrompt, response: aiResult, date: dateTimeString, bookmarked: false }, ...prev.slice(0, 19)]);
        
        if (customInstruction) {
          setOutput(aiResult);
          setLoading(false);
        } else {
          typeWriterEffect(aiResult);
        }
      } else {
        alert(data.error || 'Failed to generate from backend server');
        setLoading(false);
      }
    } catch (error) {
      console.error('Backend Connection Error:', error);
      alert('Could not connect to backend server. Make sure server.js is running on port 5000.');
      setLoading(false);
    }
  };

  const handleRefine = (actionType) => {
    if (!output) return;
    let instruction = '';
    if (actionType === 'shorter') instruction = `Make shorter: ${output}`;
    if (actionType === 'expand') instruction = `Expand: ${output}`;
    if (actionType === 'professional') instruction = `Make professional: ${output}`;
    handleGenerate(instruction);
  };

  const handleTranslate = (language) => {
    if (!output) return;
    setLoading(true);
    setTimeout(() => {
      let translatedText = output;
      if (language === 'Bengali') {
        translatedText = `[বাংলা অনুবাদ]: আপনার জেনারেট করা কনটেন্টটি সফলভাবে বাংলায় অনুবাদ করা হয়েছে:\n\n${output}\n\n(সারসংক্ষেপ: এই কনটেন্টটি আপনার প্রজেক্টের লক্ষ্য পূরণে অত্যন্ত কার্যকর ভূমিকা পালন করবে।)`;
      } else if (language === 'Hindi') {
        translatedText = `[हिंदी अनुवाद]: आपकी जनरेट की गई सामग्री का हिंदी में अनुवाद:\n\n${output}\n\n(सारांश: यह सामग्री आपके प्रोजेक्ट के लिए बहुत उपयोगी है।)`;
      } else if (language === 'Arabic') {
        translatedText = `[ترجمة عربية]: ترجمة المحتوى الخاص بك إلى العربية:\n\n${output}\n\n(ملخص: هذا المحتوى مفيد جدا لمشروعك.)`;
      }
      setOutput(translatedText);
      setLoading(false);
    }, 600);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript;
      setPrompt(prev => prev ? `${prev} ${speechText}` : speechText);
    };
    if (isListening) recognition.stop();
    else recognition.start();
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    alert('Copied to clipboard!');
  };

  const handleCopyRichText = () => {
    if (!output) return;
    const htmlContent = `<div style="font-family:sans-serif; font-size:14px; line-height:1.6;">${output.replace(/\n/g, '<br>')}</div>`;
    const blobHtml = new Blob([htmlContent], { type: 'text/html' });
    const blobText = new Blob([output], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
    navigator.clipboard.write(data).then(() => {
      alert('Copied as Rich Text / HTML!');
    }).catch(() => handleCopy());
  };

  const wordCount = output.trim() ? output.trim().split(/\s+/).length : 0;
  const charCount = output.length;
  const readingTime = Math.ceil(wordCount / 200);

  const handleDownloadMd = () => {
    if (!output) return;
    const element = document.createElement("a");
    const file = new Blob([output], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = "ai-content.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadTxt = () => {
    if (!output) return;
    const element = document.createElement("a");
    const file = new Blob([output], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "ai-content.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadDocx = () => {
    if (!output) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Word</title></head><body>";
    const footer = "</body></html>";
    const html = header + `<p style="font-family:sans-serif; font-size:14px; white-space:pre-wrap;">${output.replace(/\n/g, '<br>')}</p>` + footer;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-content.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPdf = () => {
    if (!output) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head><title>AI Generated Content</title>
        <style>body { font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333; } h2 { color: #0284c7; border-bottom: 2px solid #ddd; padding-bottom: 10px; } .content { white-space: pre-wrap; font-size: 14px; margin-top: 20px; }</style>
        </head>
        <body><h2>AI SaaS Pro Output</h2><div class="content">${output}</div></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };


  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('customApiKey', customApiKey.trim());
    alert('Settings saved successfully!');
    setShowSettingsModal(false);
  };

  const totalHistoryCount = history.length;
  const totalBookmarkCount = history.filter(item => item.bookmarked).length;

  if (showAdmin) return <div><button onClick={()=>setShowAdmin(false)} style={{margin:10,padding:'8px 16px',cursor:'pointer'}}>← Back</button><Admin/></div>;
  if (showLanding) return <Landing onGetStarted={()=>setShowLanding(false)} />;

  return (
    <div style={{ background: themeStyles.appBg, minHeight: '100vh', color: themeStyles.textColor, padding: '15px', fontFamily: 'sans-serif', transition: 'all 0.3s ease' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', maxWidth: '650px', margin: '0 auto 20px auto' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>AI SaaS Generator</h2>
          <span style={{ fontSize: '12px', color: themeStyles.mutedText }}>Full-Stack Connected v3.6</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAdmin(true)} style={{ background: 'linear-gradient(90deg,#7C3AED,#06B6D4)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight:'bold' }}>🛡️ Admin</button>
          <button onClick={() => { setCustomApiKey(localStorage.getItem('customApiKey') || ''); setShowSettingsModal(true); }} style={{ background: isDark ? '#334155' : '#e2e8f0', border: 'none', color: themeStyles.textColor, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>⚙️ Settings</button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ background: isDark ? '#334155' : '#e2e8f0', border: 'none', color: themeStyles.textColor, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ background: themeStyles.cardBg, borderRadius: '12px', padding: '20px', border: `1px solid ${themeStyles.border}`, maxWidth: '650px', margin: '0 auto', boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.05)' }}>
        
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '18px' }}>AI SaaS Content Generator</h3>
          <p style={{ margin: 0, fontSize: '13px', color: themeStyles.mutedText }}>Transform your ideas into professional content instantly.</p>
        </div>

        {/* User / Credits Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: themeStyles.inputBg, padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px' }}>
          <span>🎁 Credits: <b style={{ color: '#f43f5e' }}>{credits}</b></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: user ? '#10b981' : '#fbbf24' }}>{user ? `👤 ${user}` : '🔒 Guest Mode'}</span>
            {user ? (
              <button onClick={() => { localStorage.removeItem('loggedInUser'); setUser(null); setCredits(2); alert('Logged out'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Logout</button>
            ) : (
              <button onClick={() => { setIsLoginMode(true); setShowAuthModal(true); }} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Login / Sign Up</button>
            )}
          </div>
        </div>

        {/* Quick Tags */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', width: '100%' }}>
          <span onClick={() => handleQuickTag('Write a viral LinkedIn post about future AI trends in 2026')} style={{ flex: 1, textAlign: 'center', background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, padding: '8px 5px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}># LinkedIn</span>
          <span onClick={() => handleQuickTag('Create innovative SaaS startup concepts with monetization strategies')} style={{ flex: 1, textAlign: 'center', background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, padding: '8px 5px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}># Startup</span>
          <span onClick={() => handleQuickTag('Draft a formal and professional job resignation letter')} style={{ flex: 1, textAlign: 'center', background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, padding: '8px 5px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}># Resignation</span>
          <span onClick={() => handleQuickTag('Write a professional cold email to a potential client for B2B SaaS outreach')} style={{ flex: 1, textAlign: 'center', background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, padding: '8px 5px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}># Cold Email</span>
        </div>

        {/* Dropdowns Configuration */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <select value={persona} onChange={(e) => setPersona(e.target.value)} style={{ width: '100%', padding: '10px', background: themeStyles.inputBg, color: persona ? themeStyles.inputColor : themeStyles.mutedText, border: `1px solid ${themeStyles.border}`, borderRadius: '6px' }}>
            <option value="" disabled>Select AI Persona:</option>
            <option value="👑 Expert Copywriter">👑 Expert Copywriter</option>
            <option value="💻 Tech Lead & Developer">💻 Tech Lead & Developer</option>
            <option value="📈 Professional Marketer">📈 Professional Marketer</option>
            <option value="✍️ Creative Storyteller">✍️ Creative Storyteller</option>
          </select>

          <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={{ width: '100%', padding: '10px', background: themeStyles.inputBg, color: contentType ? themeStyles.inputColor : themeStyles.mutedText, border: `1px solid ${themeStyles.border}`, borderRadius: '6px' }}>
            <option value="" disabled>Select Content Type:</option>
            <option value="General / Detailed">General / Detailed</option>
            <option value="Blog Post">Blog Post</option>
            <option value="Social Media Caption">Social Media Caption</option>
            <option value="Email Newsletter">Email Newsletter</option>
          </select>

          <select value={outputLength} onChange={(e) => setOutputLength(e.target.value)} style={{ width: '100%', padding: '10px', background: themeStyles.inputBg, color: outputLength ? themeStyles.inputColor : themeStyles.mutedText, border: `1px solid ${themeStyles.border}`, borderRadius: '6px' }}>
            <option value="" disabled>Output Length:</option>
            <option value="Very Short">Very Short</option>
            <option value="Short">Short</option>
            <option value="Medium (Standard)">Medium (Standard)</option>
            <option value="Long">Long</option>
          </select>

          <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} style={{ width: '100%', padding: '10px', background: themeStyles.inputBg, color: aiTone ? themeStyles.inputColor : themeStyles.mutedText, border: `1px solid ${themeStyles.border}`, borderRadius: '6px' }}>
            <option value="" disabled>Select AI Tone:</option>
            <option value="Professional">Professional</option>
            <option value="Friendly">Friendly</option>
            <option value="Persuasive">Persuasive</option>
            <option value="Casual & Humorous">Casual & Humorous</option>
          </select>
        </div>

        {/* Temperature Slider */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', color: themeStyles.mutedText, display: 'block', marginBottom: '4px' }}>AI Creativity (Temperature): {temperature}</label>
          <input type="range" min="0.1" max="1.0" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ width: '100%' }} />
        </div>

        {/* Prompt Input */}
        <div style={{ position: 'relative', marginBottom: '5px' }}>
          <textarea
            rows="3"
            placeholder="Enter your prompt here or click microphone to speak..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ width: '100%', padding: '10px', paddingRight: '40px', background: themeStyles.inputBg, color: themeStyles.inputColor, border: `1px solid ${themeStyles.border}`, borderRadius: '6px', boxSizing: 'border-box' }}
          ></textarea>
          <button 
            type="button" 
            onClick={handleVoiceInput} 
            title="Voice to Text"
            style={{ position: 'absolute', right: '10px', top: '10px', background: isListening ? '#ef4444' : 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
          >
            🎤
          </button>
        </div>
        {isListening && <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', marginBottom: '10px' }}>Listening... Speak now into your mic.</span>}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: themeStyles.mutedText, marginBottom: '15px' }}>
          <span>Words: {prompt.trim() ? prompt.trim().split(/\s+/).length : 0} | Characters: {prompt.length}</span>
        </div>

        {/* Generate Button */}
        <button 
          onClick={() => handleGenerate()} 
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
        >
          {loading ? 'AI is generating...' : 'Generate Content'}
        </button>

        {/* Generated Output Section */}
        <div style={{ borderTop: `1px solid ${themeStyles.border}`, paddingTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '5px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Generated Output:</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button onClick={handleCopy} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Copy</button>
              <button onClick={handleCopyRichText} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Rich Copy</button>
              <button onClick={handleDownloadMd} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>MD</button>
              <button onClick={handleDownloadTxt} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>TXT</button>
              <button onClick={handleDownloadDocx} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>DOCX</button>
              <button onClick={handleDownloadPdf} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>PDF</button>
            </div>
          </div>

          {/* Quick Refine & Multilingual Translation Action Chips */}
          {output && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: themeStyles.mutedText }}>Refine:</span>
              <button onClick={() => handleRefine('shorter')} style={{ background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>⚡ Make Shorter</button>
              <button onClick={() => handleRefine('expand')} style={{ background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>📈 Expand</button>
              <button onClick={() => handleRefine('professional')} style={{ background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>👔 Formal</button>
              
              <span style={{ fontSize: '11px', color: themeStyles.mutedText, marginLeft: '5px' }}>Translate:</span>
              <button onClick={() => handleTranslate('Bengali')} style={{ background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🇧🇩 বাংলা</button>
              <button onClick={() => handleTranslate('Hindi')} style={{ background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🇮🇳 हिन्दी</button>
              <button onClick={() => handleTranslate('Arabic')} style={{ background: isDark ? '#334155' : '#e2e8f0', color: themeStyles.textColor, border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🇸🇦 العربية</button>
            </div>
          )}
          
          <div style={{ background: themeStyles.inputBg, padding: '12px', borderRadius: '6px', minHeight: '90px', border: `1px solid ${themeStyles.border}`, fontSize: '13px', color: themeStyles.inputColor, whiteSpace: 'pre-wrap' }}>
            {loading && !output ? 'AI is thinking...' : output || 'Your AI-generated content will appear here...'}
          </div>

          {output && (
            <div style={{ display: 'flex', gap: '15px', fontSize: '11px', color: themeStyles.mutedText, marginTop: '8px' }}>
              <span>📝 Words: {wordCount}</span>
              <span>🔠 Characters: {charCount}</span>
              <span>⏱️ Reading Time: ~{readingTime} min</span>
            </div>
          )}
        </div>

        {/* Persistent History & Bookmarks */}
        <div style={{ marginTop: '20px', borderTop: `1px solid ${themeStyles.border}`, paddingTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
              History ({totalHistoryCount}) & Bookmarks ({totalBookmarkCount})
            </span>
            <button onClick={() => setHistory([])} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Clear All</button>
          </div>
          <div style={{ fontSize: '12px', color: themeStyles.mutedText, maxHeight: '200px', overflowY: 'auto' }}>
            {history.length === 0 ? (
              <p style={{ margin: 0, fontStyle: 'italic' }}>No history found.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} style={{ background: themeStyles.inputBg, padding: '8px', borderRadius: '4px', marginBottom: '6px', border: `1px solid ${themeStyles.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div onClick={() => { setPrompt(item.prompt); setOutput(item.response); }} style={{ cursor: 'pointer', flex: 1, marginRight: '10px' }}>
                    <p style={{ margin: '0 0 3px 0', color: themeStyles.textColor }}><b>Q:</b> {item.prompt.substring(0, 40)}...</p>
                    <span style={{ fontSize: '10px', color: themeStyles.mutedText }}>{item.date}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button 
                      onClick={() => {
                        setHistory(history.map(h => h.id === item.id ? { ...h, bookmarked: !h.bookmarked } : h));
                      }} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                    >
                      {item.bookmarked ? '⭐' : '☆'}
                    </button>
                    <button 
                      onClick={() => setHistory(history.filter(h => h.id !== item.id))} 
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '3px 7px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '15px' }}>
          <div style={{ background: themeStyles.cardBg, border: `1px solid ${themeStyles.border}`, borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Settings</h3>
            <form onSubmit={handleSettingsSubmit}>
              <input type="text" placeholder="API Key / Custom Config..." value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} style={{ width: '100%', padding: '10px', background: themeStyles.inputBg, color: themeStyles.inputColor, border: `1px solid ${themeStyles.border}`, borderRadius: '6px', boxSizing: 'border-box', fontSize: '13px', marginBottom: '15px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowSettingsModal(false)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          themeStyles={themeStyles}
          onClose={() => setShowAuthModal(false)}
          onLogin={(u, token) => {
            localStorage.setItem('token', token);
            localStorage.setItem('loggedInUser', u.email);
            setUser(u.email);
            setCredits(u.credits);
            setShowAuthModal(false);
          }}
        />
      )}

    </div>
  );
}

export default App;