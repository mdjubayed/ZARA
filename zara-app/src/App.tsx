import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, AudioLines, Bot, ChevronDown,
  Code2, Folder, Globe, Grid2X2, Heart, Home, Info, Keyboard, Mic,
  MessageCircle, MessageSquare, Monitor, Play, Search, Send, Settings,
  ShieldCheck, Sparkles, Volume2, X, Zap,
} from 'lucide-react';
import heroImage from './assets/zara-hero.png';
import './App.css';

type Tab = 'home' | 'chat' | 'voice' | 'memory' | 'agents' | 'tools' | 'files' | 'settings' | 'about';
type ProviderId = 'omniroute' | 'freellmapi';
type Provider = { id: ProviderId; name: string; status: string; enabled: number };
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; created_at?: string };

const API = '/api/v1';
const navItems: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'memory', label: 'Memory', icon: Grid2X2 },
  { id: 'agents', label: 'AI Agents', icon: Bot },
  { id: 'tools', label: 'Tools', icon: Zap },
  { id: 'files', label: 'Files', icon: Folder },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP_${response.status}`);
  return body as T;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [online, setOnline] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('omniroute');
  const [threadId, setThreadId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const refreshProviders = useCallback(async () => {
    try {
      const result = await api<{ providers: Provider[] }>('/providers');
      setProviders(result.providers);
    } catch {
      setProviders([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api('/health').then(() => { if (active) setOnline(true); }).catch(() => { if (active) setOnline(false); });
    api<{ providers: Provider[] }>('/providers')
      .then((result) => { if (active) setProviders(result.providers); })
      .catch(() => { if (active) setProviders([]); });
    api<{ threads: Array<{ id: string }> }>('/threads')
      .then(async ({ threads }) => {
        if (!active) return;
        if (threads[0]?.id) {
          setThreadId(threads[0].id);
          const result = await api<{ messages: Message[] }>(`/threads/${threads[0].id}/messages`);
          if (active) setMessages(result.messages);
        } else {
          const result = await api<{ thread: { id: string } }>('/threads', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) });
          if (active) setThreadId(result.thread.id);
        }
      })
      .catch(() => setOnline(false));
    return () => { active = false; };
  }, []);

  const startNewChat = useCallback(async () => {
    try {
      const result = await api<{ thread: { id: string } }>('/threads', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) });
      setThreadId(result.thread.id);
      setMessages([]);
      setTab('chat');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not create chat');
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || busy || !threadId) return;
    const clientMessageId = crypto.randomUUID();
    const userMessage: Message = { id: clientMessageId, role: 'user', content };
    const assistantId = `pending-${clientMessageId}`;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    setTab('chat');

    try {
      const response = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, content, clientMessageId, providerId: selectedProvider }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP_${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const eventText = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const eventName = eventText.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
          const dataText = eventText.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
          if (dataText) {
            const data = JSON.parse(dataText) as { token?: string; error?: string; assistantMessage?: Message };
            if (eventName === 'token' && data.token) {
              setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + data.token } : message));
            }
            if (eventName === 'error') throw new Error(data.error || 'CHAT_REQUEST_FAILED');
            if (eventName === 'done') {
              if (data.assistantMessage) {
                setMessages((current) => current.map((message) => message.id === assistantId ? data.assistantMessage! : message));
              }
              finished = true;
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
      if (!finished) throw new Error('STREAM_CLOSED_BEFORE_COMPLETION');
      refreshProviders();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CHAT_REQUEST_FAILED';
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content ? `${item.content}\n\n[Connection interrupted: ${message}]` : `I couldn't complete that request: ${message}` } : item));
    } finally {
      setBusy(false);
    }
  }, [busy, input, refreshProviders, selectedProvider, threadId]);

  const verifyProvider = async (id: ProviderId) => {
    setToast(`Checking ${id} connection...`);
    try {
      const result = await api<{ modelCount: number }>(`/providers/${id}/verify`, { method: 'POST' });
      await refreshProviders();
      setToast(`${id} connected. ${result.modelCount} models found. Enable it to use it.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Provider verification failed');
    }
  };

  const toggleProvider = async (provider: Provider) => {
    try {
      await api(`/providers/${provider.id}/enabled`, { method: 'PATCH', body: JSON.stringify({ enabled: provider.enabled !== 1 }) });
      await refreshProviders();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Provider update failed');
    }
  };

  const pageTitle = useMemo(() => navItems.find((item) => item.id === tab)?.label ?? 'Home', [tab]);
  const enabledProvider = providers.find((provider) => provider.id === selectedProvider && provider.enabled === 1 && provider.status === 'ready');

  return (
    <div className="zara-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Zap size={28} fill="currentColor" /></div>
          <div><div className="brand-name">ZARA</div><div className="brand-subtitle">Your Personal AI Assistant</div></div>
        </div>
        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${tab === id ? 'active' : ''}`} key={id} onClick={() => setTab(id)}>
              <Icon size={21} strokeWidth={2.1} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-love"><Heart size={20} fill="currentColor" /> <span>Always with you</span></div>
        <div className="profile-card"><div className="profile-avatar"><img src={heroImage} alt="ZARA assistant avatar" /></div><div><strong>ZARA <ShieldCheck size={15} /></strong><small><i /> Ready to Assist</small></div><ArrowRight className="profile-arrow" size={20} /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">ZARA <span>{pageTitle}</span></div>
          <div className={`online-pill ${online ? 'is-online' : 'is-offline'}`}><i />{online ? 'Online' : 'Offline'}<ChevronDown size={15} /></div>
          <div className="top-actions"><button aria-label="Voice"><Mic /></button><button aria-label="Sound"><Volume2 /></button><button aria-label="Language"><Globe /></button><span className="window-dots">—　□　×</span></div>
        </header>

        {tab === 'home' && (
          <section className="dashboard-grid">
            <div className="hero-stage">
              <div className="hero-glow" />
              <div className="welcome-bubble"><strong>Hello! I'm ZARA <span>😊</span></strong><br /><em>How can I help</em> you today?</div>
              <img className="hero-character" src={heroImage} alt="ZARA futuristic assistant" />
              <div className="hero-brand"><b>Z</b><strong>ZARA</strong><small>Dream · Assist · Achieve</small></div>
              <div className="talk-dock"><div className="wave-icon"><AudioLines size={27} /></div><span>Tap to Talk</span><button className="mic-main" onClick={() => setTab('voice')} aria-label="Open voice assistant"><Mic size={39} /></button><button onClick={() => setTab('chat')} aria-label="Open chat"><Keyboard /></button><button onClick={() => setTab('voice')} aria-label="Play voice"><Play /></button><button onClick={() => setTab('settings')} aria-label="Open settings"><Settings /></button></div>
            </div>
            <aside className="right-rail">
              <section className="glass-card quick-card"><div className="card-heading"><h2><Zap size={20} fill="#ffd34e" /> Quick Actions</h2><button onClick={() => setTab('tools')}>View All <ArrowRight size={16} /></button></div><div className="quick-actions"><button onClick={() => setTab('chat')}><MessageCircle /><span>Chat<br />Now</span></button><button onClick={() => setTab('voice')}><Mic /><span>Voice<br />Assistant</span></button><button onClick={() => setToast('Media playback will be connected in the media tools phase.')}><Play /><span>Play<br />Music</span></button><button onClick={() => setTab('tools')}><Grid2X2 /><span>Open<br />Apps</span></button></div></section>
              <section className="glass-card skills-card"><div className="card-heading"><h2><Sparkles size={20} fill="#ffd34e" /> AI Skills</h2><button onClick={() => setTab('agents')}>View All <ArrowRight size={16} /></button></div><ul className="skill-list"><li><Search />Research &amp; Information</li><li><Code2 />Code &amp; Development</li><li><Monitor />Control Your PC</li><li><Zap />Create Content</li><li><Grid2X2 />And Much More...</li></ul></section>
              <section className="glass-card status-card"><div className="card-heading"><h2><Activity size={20} /> System Status</h2></div><div className="status-row"><span>AI Backend</span><b className={online ? 'green-text' : 'red-text'}>{online ? 'Connected' : 'Offline'}</b></div><div className="status-row"><span>Primary Brain</span><b>{providers.find((p) => p.id === 'omniroute')?.status ?? 'Unknown'}</b></div><div className="status-row"><span>Backup Brain</span><b>{providers.find((p) => p.id === 'freellmapi')?.status ?? 'Unknown'}</b></div></section>
            </aside>
          </section>
        )}

        {tab === 'chat' && (
          <section className="chat-page">
            <div className="chat-toolbar"><div><h1>Chat with ZARA</h1><p>One assistant · two AI providers · automatic backup</p></div><div className="provider-select"><label htmlFor="provider-choice">Brain</label><select id="provider-choice" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as ProviderId)}><option value="omniroute">OmniRoute · Primary</option><option value="freellmapi">FreeLLMAPI · Backup</option></select></div><button className="new-chat-button" onClick={startNewChat}>+ New Chat</button></div>
            <div className="chat-messages">{messages.length === 0 && <div className="chat-empty"><div className="empty-orb"><Zap size={35} /></div><h2>How can I help you?</h2><p>Ask ZARA anything. Replies use your configured AI provider.</p><div className="suggestion-row"><button onClick={() => setInput('Explain something in simple Bengali.')}>Explain in Bengali</button><button onClick={() => setInput('Help me write a TypeScript function.')}>Write code</button></div></div>}{messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'user' ? 'You' : 'Z'}</div><div className="message-content"><strong>{message.role === 'user' ? 'You' : 'ZARA'}</strong><p>{message.content || (busy ? 'ZARA is thinking…' : '')}</p></div></article>)}</div>
            <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message ZARA…" rows={1} /><button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim() || busy || !threadId}><Send size={19} /></button></div><small>{enabledProvider ? `Using ${enabledProvider.name}` : 'Choose a verified and enabled provider in Settings. API keys stay on the backend.'}</small></div>
          </section>
        )}

        {tab === 'settings' && (
          <section className="settings-page"><div className="section-title"><h1>AI Brain Settings</h1><p>Configure the two approved providers. API keys are read only from backend environment variables.</p></div><div className="provider-cards">{(['omniroute', 'freellmapi'] as ProviderId[]).map((id) => { const provider = providers.find((item) => item.id === id); return <article className="provider-card" key={id}><div className="provider-card-top"><div className={`provider-symbol ${id}`}>{id === 'omniroute' ? 'O' : 'F'}</div><div><h2>{id === 'omniroute' ? 'OmniRoute' : 'FreeLLMAPI'}</h2><p>{id === 'omniroute' ? 'Primary AI Brain' : 'Automatic Backup Brain'}</p></div><span className={`provider-status ${provider?.status === 'ready' ? 'ready' : ''}`}>{provider?.status ?? 'not checked'}</span></div><div className="provider-meta"><span>API Key: <b>Backend environment</b></span><span>Enabled: <b>{provider?.enabled ? 'Yes' : 'No'}</b></span></div><div className="provider-buttons"><button onClick={() => void verifyProvider(id)}>Verify Connection</button><button className="secondary-button" disabled={!provider || provider.status !== 'ready'} onClick={() => provider && void toggleProvider(provider)}>{provider?.enabled ? 'Disable' : 'Enable'}</button></div></article>; })}</div><div className="notice-card"><ShieldCheck /><div><strong>Secret protection</strong><p>Never paste API keys into ChatGPT, browser console, or SQLite. Configure <code>OMNIROUTE_API_KEY</code> and <code>FREELLMAPI_API_KEY</code> in your private server environment.</p></div></div></section>
        )}

        {tab !== 'home' && tab !== 'chat' && tab !== 'settings' && (
          <section className="coming-page"><div className="coming-icon">{tab === 'voice' ? <Mic /> : tab === 'memory' ? <Grid2X2 /> : tab === 'agents' ? <Bot /> : tab === 'tools' ? <Zap /> : tab === 'files' ? <Folder /> : <Info />}</div><h1>{pageTitle}</h1><p>{tab === 'voice' ? 'Voice controls will be connected after the chat brain is verified.' : 'This module is planned for a later integration phase. Its controls will be enabled only when the required service and permissions are ready.'}</p><button onClick={() => setTab('chat')}>Go to Chat <ArrowRight size={16} /></button></section>
        )}
      </main>
      {toast && <div className="toast-message" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={16} /></button></div>}
    </div>
  );
}
