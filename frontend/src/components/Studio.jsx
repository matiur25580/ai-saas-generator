import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, Bookmark, Check, ChevronLeft, ChevronRight, CircleAlert, Copy, FileText, History, LoaderCircle, LogIn, LogOut, Mic, Moon, Search, Send, Sparkles, Sun, Trash2, Wallet, WandSparkles } from 'lucide-react';
import { apiFetch } from '../api';

const GUEST_HISTORY_KEY = 'draftline-guest-history';
const formats = ['General', 'Blog post', 'Social post', 'Email', 'Product description'];
const lengths = ['Short', 'Medium', 'Long'];
const personas = ['Expert Copywriter', 'Product Marketer', 'Technical Writer', 'Brand Strategist', 'Founder'];
const tones = ['Professional', 'Friendly', 'Persuasive', 'Direct', 'Playful'];

function readGuestHistory() {
  try { return JSON.parse(localStorage.getItem(GUEST_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function downloadText(text, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  if (!value) return 'Just now';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Studio({ user, credits, setCredits, onLogin, onLogout, onSessionExpired, onOpenAdmin, theme, onToggleTheme, onHome }) {
  const [activeTab, setActiveTab] = useState('studio');
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState(personas[0]);
  const [tone, setTone] = useState(tones[0]);
  const [contentType, setContentType] = useState(formats[0]);
  const [outputLength, setOutputLength] = useState('Medium');
  const [temperature, setTemperature] = useState(0.7);
  const [output, setOutput] = useState('');
  const [outputId, setOutputId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const toastTimer = useRef(null);
  const recognitionRef = useRef(null);

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  const expireSessionIfNeeded = (response) => {
    if (response.status === 401 && user) onSessionExpired();
  };

  const loadHistory = async (page = historyPage, search = historySearch) => {
    setHistoryLoading(true);
    try {
      if (!user) {
        const localItems = readGuestHistory();
        const filtered = localItems.filter((item) => `${item.prompt} ${item.response}`.toLowerCase().includes(search.toLowerCase()));
        setHistory(filtered.slice((page - 1) * 10, page * 10));
        setHistoryTotal(filtered.length);
        setHistoryPages(Math.max(1, Math.ceil(filtered.length / 10)));
        return;
      }
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      const response = await apiFetch(`/api/content?${params}`);
      expireSessionIfNeeded(response);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load your history.');
      setHistory(data.data.map((item) => ({
        id: item._id,
        prompt: item.prompt,
        response: item.response,
        date: item.createdAt,
        bookmarked: Boolean(item.bookmarked),
        contentType: item.contentType || 'General'
      })));
      setHistoryTotal(data.total);
      setHistoryPages(Math.max(1, data.pages || 1));
    } catch (requestError) {
      setError(requestError.message || 'Could not load your history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadHistory(historyPage, historySearch), 220);
    return () => window.clearTimeout(timer);
  }, [user, historyPage, historySearch]);

  useEffect(() => {
    if (activeTab !== 'credits' || !user) return;
    let active = true;
    setTransactionsLoading(true);
    apiFetch('/api/content/transactions?page=1')
      .then(async (response) => {
        expireSessionIfNeeded(response);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not load credit activity.');
        if (active) setTransactions(data.data);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setTransactionsLoading(false); });
    return () => { active = false; };
  }, [activeTab, user]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const handleGenerate = async (requestPrompt = prompt) => {
    if (!requestPrompt.trim()) {
      setError('Write a prompt before generating.');
      return;
    }
    if (user && credits < 1) {
      setError('You are out of credits. Contact an administrator for a credit grant.');
      return;
    }
    setBusy(true);
    setError('');
    setOutput('');
    try {
      const response = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: requestPrompt, persona, aiTone: tone, contentType, outputLength, temperature })
      });
      expireSessionIfNeeded(response);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Generation failed. Please try again.');
      const result = data.data?.result || data.result;
      const id = data.data?.id || data.id || `guest-${crypto.randomUUID()}`;
      const updatedCredits = data.data?.credits ?? data.credits;
      if (updatedCredits !== undefined) setCredits(updatedCredits);
      setOutput(result);
      setOutputId(data.data?.id || data.id || null);
      setActiveTab('studio');
      if (!user) {
        const item = { id, prompt: requestPrompt, response: result, date: new Date().toISOString(), bookmarked: false, contentType };
        localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify([item, ...readGuestHistory()].slice(0, 40)));
        await loadHistory(1, historySearch);
        setHistoryPage(1);
      } else {
        setHistoryPage(1);
        await loadHistory(1, historySearch);
      }
      notify('Response generated and saved.');
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the API. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const runTransformation = (instruction) => {
    if (!output) return;
    handleGenerate(`${instruction}\n\nContent to transform:\n${output}`);
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      notify('Copied to clipboard.');
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  };

  const printOutput = () => {
    if (!output) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups to print this document.');
      return;
    }
    const pre = printWindow.document.createElement('pre');
    pre.textContent = output;
    pre.style.cssText = 'white-space:pre-wrap;font:15px/1.7 sans-serif;color:#152329;max-width:760px;margin:48px auto';
    printWindow.document.title = 'Draftline document';
    printWindow.document.body.replaceChildren(pre);
    printWindow.focus();
    printWindow.print();
  };

  const toggleBookmark = async (item) => {
    const updated = { ...item, bookmarked: !item.bookmarked };
    if (user) {
      try {
        const response = await apiFetch(`/api/content/${item.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookmarked: updated.bookmarked })
        });
        expireSessionIfNeeded(response);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not update bookmark.');
      } catch (requestError) { setError(requestError.message); return; }
    } else {
      const all = readGuestHistory().map((entry) => entry.id === item.id ? updated : entry);
      localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(all));
    }
    setHistory((items) => items.map((entry) => entry.id === item.id ? updated : entry));
  };

  const deleteHistoryItem = async (item) => {
    if (user) {
      try {
        const response = await apiFetch(`/api/content/${item.id}`, { method: 'DELETE' });
        expireSessionIfNeeded(response);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Could not delete this item.');
      } catch (requestError) { setError(requestError.message); return; }
    } else {
      localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(readGuestHistory().filter((entry) => entry.id !== item.id)));
    }
    setHistory((items) => items.filter((entry) => entry.id !== item.id));
    setHistoryTotal((total) => Math.max(0, total - 1));
    if (outputId === item.id) { setOutput(''); setOutputId(null); }
    notify('History item deleted.');
  };

  const startVoiceInput = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setError('Voice input is not supported by this browser.'); return; }
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError('Voice input stopped. Please try again.'); };
    recognition.onresult = (event) => setPrompt((current) => `${current}${current ? ' ' : ''}${event.results[0][0].transcript}`);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const useHistoryItem = (item) => {
    setPrompt(item.prompt);
    setOutput(item.response);
    setOutputId(typeof item.id === 'string' && item.id.startsWith('guest-') ? null : item.id);
    setActiveTab('studio');
  };

  const wordCount = output.trim() ? output.trim().split(/\s+/).length : 0;

  return (
    <main className="studio-page">
      <header className="studio-header">
        <button className="brand-mark brand-button" onClick={onHome} aria-label="Back to home"><span className="brand-glyph">D</span><span>draftline<span className="brand-dot">.</span></span></button>
        <nav className="studio-nav" aria-label="Workspace"><button className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')}><WandSparkles size={16} /> Studio</button><button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}><History size={16} /> History <span className="nav-count">{historyTotal}</span></button><button className={activeTab === 'credits' ? 'active' : ''} onClick={() => setActiveTab('credits')}><Wallet size={16} /> Credits</button></nav>
        <div className="studio-header-actions"><span className="session-label">{user || 'Guest session'}</span><button className="icon-button" onClick={onToggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>{user ? <button className="icon-button" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button> : <button className="button button-small button-dark" onClick={onLogin}><LogIn size={15} /> Sign in</button>}<button className="icon-button" onClick={onOpenAdmin} title="Admin area" aria-label="Admin area"><KeyRound size={18} /></button></div>
      </header>

      <div className="studio-main">
        <div className="studio-heading"><div><span className="eyebrow">WRITING WORKSPACE</span><h1>{activeTab === 'studio' ? 'Make the next draft count.' : activeTab === 'history' ? 'Your work, in one place.' : 'Know where your credits go.'}</h1><p>{activeTab === 'studio' ? 'Give the model a clear brief. Shape the response before it starts.' : activeTab === 'history' ? 'Search, reopen, bookmark, or remove your saved generations.' : 'Every signed-in generation and admin grant is recorded in your ledger.'}</p></div><div className="account-metric"><span>{user ? 'ACCOUNT CREDITS' : 'ACCOUNT STATUS'}</span><strong>{user ? credits : 'Guest'}</strong><small>{user ? '1 credit per generation' : 'Sign in to sync your history'}</small></div></div>

        {error && <div className="inline-alert" role="alert"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

        {activeTab === 'studio' && <section className="workspace-grid">
          <form className="prompt-panel" onSubmit={(event) => { event.preventDefault(); handleGenerate(); }}>
            <div className="panel-heading"><div><span className="eyebrow">01 / THE BRIEF</span><h2>Start with the task</h2></div><span className="field-limit">{prompt.length}/5000</span></div>
            <label className="field-label" htmlFor="content-prompt">What do you need to create?</label>
            <textarea id="content-prompt" className="prompt-input" maxLength={5000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the audience, goal, and key details..." />
            <div className="prompt-examples"><span>Try a brief:</span><button type="button" onClick={() => setPrompt('Write a launch email for a new project management tool aimed at small design teams.')}>Launch email</button><button type="button" onClick={() => setPrompt('Explain why accessible color contrast matters to a product team, with three practical checks.')}>Product explainer</button></div>
            <div className="control-grid">
              <label className="field-label">Format<select value={contentType} onChange={(event) => setContentType(event.target.value)}>{formats.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field-label">Persona<select value={persona} onChange={(event) => setPersona(event.target.value)}>{personas.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field-label">Tone<select value={tone} onChange={(event) => setTone(event.target.value)}>{tones.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field-label">Length<select value={outputLength} onChange={(event) => setOutputLength(event.target.value)}>{lengths.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <label className="temperature-control"><span>Creativity <b>{temperature.toFixed(1)}</b></span><input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /><span className="range-ends"><span>Precise</span><span>Exploratory</span></span></label>
            <div className="prompt-actions"><button className={`icon-button voice-button ${listening ? 'is-listening' : ''}`} type="button" onClick={startVoiceInput} title="Dictate a prompt" aria-label="Dictate a prompt">{listening ? <AudioLines size={18} /> : <Mic size={18} />}</button><button className="button button-primary generate-button" disabled={busy || !prompt.trim() || Boolean(user && credits < 1)} type="submit">{busy ? <><LoaderCircle className="spin" size={17} /> Generating...</> : <><Sparkles size={17} /> Generate response <span>1 credit</span></>}</button></div>
            {!user && <p className="guest-note">Guest generations are not saved to an account or charged credits.</p>}
          </form>

          <section className="output-panel" aria-live="polite">
            <div className="panel-heading"><div><span className="eyebrow">02 / THE RESPONSE</span><h2>Draft output</h2></div>{output && <span className="response-state"><span className="live-dot" /> READY</span>}</div>
            <div className={`output-body ${busy ? 'is-busy' : ''}`}>
              {busy ? <div className="generation-skeleton" aria-label="Waiting for Gemini"><span /><span /><span /><span /></div> : output ? <p>{output}</p> : <div className="empty-output"><WandSparkles size={24} /><b>Your response will appear here</b><span>Generation uses the live Gemini API.</span></div>}
            </div>
            <div className="output-meta"><span>{output ? `${wordCount} words` : 'No response yet'}</span><span>{outputId ? 'Saved to account history' : user ? 'Not saved' : 'Guest response'}</span></div>
            <div className="output-toolbar"><button className="button button-quiet" disabled={!output} onClick={copyOutput}><Copy size={15} /> Copy</button><button className="button button-quiet" disabled={!output} onClick={() => downloadText(output, 'draftline-response.md', 'text/markdown')}><ArrowDownToLine size={15} /> Markdown</button><button className="button button-quiet" disabled={!output} onClick={() => downloadText(output, 'draftline-response.txt', 'text/plain')}><FileText size={15} /> Text</button><button className="button button-quiet" disabled={!output} onClick={printOutput}><FileText size={15} /> Print / PDF</button></div>
            {output && <div className="transform-row"><span>Continue with Gemini</span><button onClick={() => runTransformation('Rewrite this to be more concise while preserving all important meaning.')}>Shorten</button><button onClick={() => runTransformation('Expand this with useful detail, examples, and a clear structure.')}>Expand</button><button onClick={() => runTransformation('Rewrite this in a more formal, professional voice.')}>Formal</button><button onClick={() => runTransformation('Translate this into Bengali. Preserve the original meaning and formatting.')}>বাংলা</button><button onClick={() => runTransformation('Translate this into Hindi. Preserve the original meaning and formatting.')}>हिन्दी</button><button onClick={() => runTransformation('Translate this into Arabic. Preserve the original meaning and formatting.')}>العربية</button></div>}
          </section>
        </section>}

        {activeTab === 'history' && <section className="data-section"><div className="data-toolbar"><label className="search-field"><Search size={17} /><input value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} placeholder="Search prompt and response" /></label><span>{historyTotal} {historyTotal === 1 ? 'result' : 'results'}</span></div>{historyLoading ? <div className="list-skeleton"><span /><span /><span /></div> : history.length ? <div className="history-list">{history.map((item) => <article className="history-row" key={item.id}><button className="history-open" onClick={() => useHistoryItem(item)}><span className="history-type">{item.contentType || 'General'}</span><b>{item.prompt}</b><span>{item.response.slice(0, 180)}{item.response.length > 180 ? '...' : ''}</span><small>{formatDate(item.date)}</small></button><div className="history-actions"><button className={`icon-button ${item.bookmarked ? 'bookmarked' : ''}`} title={item.bookmarked ? 'Remove bookmark' : 'Bookmark'} aria-label={item.bookmarked ? 'Remove bookmark' : 'Bookmark'} onClick={() => toggleBookmark(item)}><Bookmark size={17} fill={item.bookmarked ? 'currentColor' : 'none'} /></button><button className="icon-button danger-action" title="Delete history item" aria-label="Delete history item" onClick={() => deleteHistoryItem(item)}><Trash2 size={17} /></button></div></article>)}</div> : <div className="empty-state"><History size={24} /><b>No saved work found</b><span>{user ? 'Generate a response to begin your account history.' : 'Guest history stays in this browser. Sign in to save work to your account.'}</span>{!user && <button className="button button-dark" onClick={onLogin}>Sign in</button>}</div>}<div className="pagination"><button className="icon-button" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><span>Page {historyPage} of {historyPages}</span><button className="icon-button" disabled={historyPage >= historyPages} onClick={() => setHistoryPage((page) => page + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div></section>}

        {activeTab === 'credits' && <section className="data-section credits-section">{!user ? <div className="empty-state"><Wallet size={24} /><b>Credits are attached to accounts</b><span>Sign in to view your balance and transaction history.</span><button className="button button-dark" onClick={onLogin}>Sign in</button></div> : transactionsLoading ? <div className="list-skeleton"><span /><span /><span /></div> : transactions.length ? <div className="transaction-list">{transactions.map((entry) => <article className="transaction-row" key={entry._id}><span className={`transaction-icon ${entry.amount < 0 ? 'debit' : 'credit'}`}>{entry.amount < 0 ? <ArrowRight size={17} /> : <Check size={17} />}</span><div><b>{entry.reason}</b><small>{formatDate(entry.createdAt)} · {entry.source}</small></div><strong className={entry.amount < 0 ? 'debit-text' : 'credit-text'}>{entry.amount > 0 ? '+' : ''}{entry.amount}</strong><span className="balance-after">Balance {entry.balanceAfter}</span></article>)}</div> : <div className="empty-state"><Wallet size={24} /><b>No credit activity yet</b><span>Each signed-in generation will appear here.</span></div>}</section>}
      </div>

      {toast && <div className="toast-message" role="status"><Check size={16} /> {toast}</div>}
    </main>
  );
}
