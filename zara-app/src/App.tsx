import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
type Thread = { id: string; title: string; updated_at?: string };
type SearchResult = { id: string; thread_id: string; thread_title: string; content: string; role: 'user' | 'assistant' | 'system' };
type MemoryEntry = { id: string; content: string; createdAt: string };
type AgentTemplate = { id: string; name: string; description: string; prompt: string };
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; created_at?: string };

interface BrowserSpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null; start(): void; stop(): void;
}
type SpeechRecognitionWindow = Window & { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition };

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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([]);
  const [agentDraft, setAgentDraft] = useState({ name: '', description: '', prompt: '' });
  const [toolPrompt, setToolPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

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
    api<{ value: MemoryEntry[] }>('/settings/zara.memory.entries')
      .then((result) => { if (active && Array.isArray(result.value)) setMemories(result.value); })
      .catch(() => { if (active) setMemories([]); });
    api<{ value: AgentTemplate[] }>('/settings/zara.agent.templates')
      .then((result) => { if (active && Array.isArray(result.value)) setAgentTemplates(result.value); })
      .catch(() => { if (active) setAgentTemplates([]); });

    api<{ providers: Provider[] }>('/providers')
      .then((result) => { if (active) setProviders(result.providers); })
      .catch(() => { if (active) setProviders([]); });
    api<{ threads: Thread[] }>('/threads')
      .then(async ({ threads: loadedThreads }) => {
        if (active) setThreads(loadedThreads);
        if (!active) return;
        if (loadedThreads[0]?.id) {
          setThreadId(loadedThreads[0].id);
          const result = await api<{ messages: Message[] }>(`/threads/${loadedThreads[0].id}/messages`);
          if (active) setMessages(result.messages);
        } else {
          const result = await api<{ thread: { id: string } }>('/threads', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) });
          if (active) { setThreadId(result.thread.id); setThreads([result.thread]); }
        }
      })
      .catch(() => setOnline(false));
    return () => { active = false; };
  }, []);

  const startNewChat = useCallback(async () => {
    try {
      const result = await api<{ thread: { id: string } }>('/threads', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) });
      setThreadId(result.thread.id);
      setThreads((current) => [result.thread, ...current]);
      setMessages([]);
      setTab('chat');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not create chat');
    }
  }, []);

  const sendMessage = useCallback(async (messageText?: string, speakResponse = false) => {
    const content = (messageText ?? input).trim();
    if (!content || busy || !threadId) return;
    const clientMessageId = crypto.randomUUID();
    const userMessage: Message = { id: clientMessageId, role: 'user', content };
    const assistantId = `pending-${clientMessageId}`;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    if (!speakResponse) setTab('chat');

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
      let finalAssistantMessage: Message | undefined;
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
                finalAssistantMessage = data.assistantMessage;
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
      if (speakResponse && autoSpeak && finalAssistantMessage?.content && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(finalAssistantMessage.content);
        utterance.lang = voiceLanguage;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CHAT_REQUEST_FAILED';
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content ? `${item.content}\n\n[Connection interrupted: ${message}]` : `I couldn't complete that request: ${message}` } : item));
    } finally {
      setBusy(false);
    }
  }, [autoSpeak, busy, input, refreshProviders, selectedProvider, threadId, voiceLanguage]);

  const saveMemories = async (next: MemoryEntry[]) => {
    await api('/settings/zara.memory.entries', { method: 'PATCH', body: JSON.stringify({ value: next }) });
    setMemories(next);
  };

  const addMemory = async () => {
    const content = memoryDraft.trim();
    if (!content) return;
    try {
      await saveMemories([{ id: crypto.randomUUID(), content, createdAt: new Date().toISOString() }, ...memories]);
      setMemoryDraft('');
      setToast('Memory saved on this ZARA server.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not save memory');
    }
  };

  const deleteMemory = async (id: string) => {
    try { await saveMemories(memories.filter((entry) => entry.id !== id)); }
    catch (error) { setToast(error instanceof Error ? error.message : 'Could not delete memory'); }
  };

  const saveAgents = async (next: AgentTemplate[]) => {
    await api('/settings/zara.agent.templates', { method: 'PATCH', body: JSON.stringify({ value: next }) });
    setAgentTemplates(next);
  };

  const addAgentTemplate = async () => {
    const name = agentDraft.name.trim();
    const prompt = agentDraft.prompt.trim();
    if (!name || !prompt) return;
    try {
      await saveAgents([{ id: crypto.randomUUID(), name, description: agentDraft.description.trim(), prompt }, ...agentTemplates]);
      setAgentDraft({ name: '', description: '', prompt: '' });
      setToast('Agent template saved. It does not run background actions.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Could not save agent template'); }
  };

  const runToolPrompt = (prompt: string) => {
    setInput(prompt);
    setTab('chat');
  };

  const openThread = async (id: string) => {
    try {
      const result = await api<{ messages: Message[] }>(`/threads/${id}/messages`);
      setThreadId(id);
      setMessages(result.messages);
      setHistoryOpen(false);
      setTab('chat');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not load conversation');
    }
  };

  const searchHistory = async () => {
    const query = historyQuery.trim();
    if (!query) { setSearchResults([]); return; }
    try {
      const result = await api<{ data: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}&limit=30`);
      setSearchResults(result.data);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Search failed');
    }
  };

  const renameThread = async (thread: Thread) => {
    const title = window.prompt('Conversation title', thread.title)?.trim();
    if (!title || title === thread.title) return;
    try {
      const result = await api<{ thread: Thread }>(`/threads/${thread.id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      setThreads((current) => current.map((item) => item.id === thread.id ? result.thread : item));
    } catch (error) { setToast(error instanceof Error ? error.message : 'Could not rename conversation'); }
  };

  const removeThread = async (id: string) => {
    if (!window.confirm('Delete this conversation and its messages? This cannot be undone.')) return;
    try {
      await api(`/threads/${id}`, { method: 'DELETE' });
      const remaining = threads.filter((thread) => thread.id !== id);
      setThreads(remaining);
      if (threadId === id) {
        if (remaining[0]) await openThread(remaining[0].id);
        else await startNewChat();
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not delete conversation');
    }
  };

  const startVoiceRecognition = useCallback(() => {
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setVoiceError('Voice input is not supported in this browser. Try the latest Chrome or Edge.'); return; }
    setVoiceError(''); recognitionRef.current?.stop();
    const recognition = new Recognition(); recognition.lang = voiceLanguage; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim(); if (transcript) void sendMessage(transcript, true); };
    recognition.onerror = (event) => { setVoiceError('Voice input error: ' + event.error); setVoiceListening(false); };
    recognition.onend = () => setVoiceListening(false); recognitionRef.current = recognition; setVoiceListening(true); recognition.start();
  }, [sendMessage, voiceLanguage]);
  const stopVoiceRecognition = useCallback(() => { recognitionRef.current?.stop(); setVoiceListening(false); }, []);
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
          <div className="top-actions"><button aria-label="Voice" onClick={() => setTab('voice')}><Mic /></button><button aria-label="Sound" onClick={() => setAutoSpeak((value) => !value)} title={autoSpeak ? "Mute spoken replies" : "Enable spoken replies"}><Volume2 /></button><button aria-label="Language" onClick={() => setVoiceLanguage((value) => value === "bn-BD" ? "en-US" : "bn-BD")}><Globe /></button><span className="window-dots">—　□　×</span></div>
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
            <div className="chat-toolbar"><div><h1>Chat with ZARA</h1><p>One assistant · two AI providers · automatic backup</p></div><button className="new-chat-button" onClick={() => setHistoryOpen((value) => !value)}>History</button><div className="provider-select"><label htmlFor="provider-choice">Brain</label><select id="provider-choice" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value as ProviderId)}><option value="omniroute">OmniRoute · Primary</option><option value="freellmapi">FreeLLMAPI · Backup</option></select></div><button className="new-chat-button" onClick={startNewChat}>+ New Chat</button></div>
            {historyOpen && (
              <section className="history-drawer">
                <div className="history-search">
                  <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchHistory(); }} placeholder="Search conversations…" />
                  <button onClick={() => void searchHistory()}><Search size={16} /> Search</button>
                </div>
                {searchResults.length > 0 && <div className="history-results">{searchResults.map((result) => <button key={result.id} onClick={() => void openThread(result.thread_id)}><strong>{result.thread_title}</strong><span>{result.content.slice(0, 120)}</span></button>)}</div>}
                <div className="history-list">
                  {threads.map((thread) => (
                    <div className={`history-item ${thread.id === threadId ? 'selected' : ''}`} key={thread.id}>
                      <button className="history-open" onClick={() => void openThread(thread.id)}>{thread.title}</button>
                      <button className="history-delete" aria-label="Rename conversation" onClick={() => void renameThread(thread)}>✎</button>
                      <button className="history-delete" aria-label="Delete conversation" onClick={() => void removeThread(thread.id)}>×</button>
                    </div>
                  ))}
                  {threads.length === 0 && <p>No saved conversations yet.</p>}
                </div>
              </section>
            )}
            <div className="chat-messages">{messages.length === 0 && <div className="chat-empty"><div className="empty-orb"><Zap size={35} /></div><h2>How can I help you?</h2><p>Ask ZARA anything. Replies use your configured AI provider.</p><div className="suggestion-row"><button onClick={() => setInput('Explain something in simple Bengali.')}>Explain in Bengali</button><button onClick={() => setInput('Help me write a TypeScript function.')}>Write code</button></div></div>}{messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'user' ? 'You' : 'Z'}</div><div className="message-content"><strong>{message.role === 'user' ? 'You' : 'ZARA'}</strong><p>{message.content || (busy ? 'ZARA is thinking…' : '')}</p></div></article>)}</div>
            <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message ZARA…" rows={1} /><button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim() || busy || !threadId}><Send size={19} /></button></div><small>{enabledProvider ? `Using ${enabledProvider.name}` : 'Choose a verified and enabled provider in Settings. API keys stay on the backend.'}</small></div>
          </section>
        )}

        {tab === 'settings' && (
          <section className="settings-page"><div className="section-title"><h1>AI Brain Settings</h1><p>Configure the two approved providers. API keys are read only from backend environment variables.</p></div><div className="provider-cards">{(['omniroute', 'freellmapi'] as ProviderId[]).map((id) => { const provider = providers.find((item) => item.id === id); return <article className="provider-card" key={id}><div className="provider-card-top"><div className={`provider-symbol ${id}`}>{id === 'omniroute' ? 'O' : 'F'}</div><div><h2>{id === 'omniroute' ? 'OmniRoute' : 'FreeLLMAPI'}</h2><p>{id === 'omniroute' ? 'Primary AI Brain' : 'Automatic Backup Brain'}</p></div><span className={`provider-status ${provider?.status === 'ready' ? 'ready' : ''}`}>{provider?.status ?? 'not checked'}</span></div><div className="provider-meta"><span>API Key: <b>Backend environment</b></span><span>Enabled: <b>{provider?.enabled ? 'Yes' : 'No'}</b></span></div><div className="provider-buttons"><button onClick={() => void verifyProvider(id)}>Verify Connection</button><button className="secondary-button" disabled={!provider || provider.status !== 'ready'} onClick={() => provider && void toggleProvider(provider)}>{provider?.enabled ? 'Disable' : 'Enable'}</button></div></article>; })}</div><div className="notice-card"><ShieldCheck /><div><strong>Secret protection</strong><p>Never paste API keys into ChatGPT, browser console, or SQLite. Configure <code>OMNIROUTE_API_KEY</code> and <code>FREELLMAPI_API_KEY</code> in your private server environment.</p></div></div></section>
        )}

        {tab === 'voice' && (
          <section className="coming-page">
            <div className="coming-icon"><Mic /></div>
            <h1>Talk with ZARA</h1>
            <p>Speak in Bengali or English. Your voice is converted to text in this browser and sent to the selected ZARA Brain.</p>
            <div className="provider-select">
              <label htmlFor="voice-language">Language</label>
              <select id="voice-language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as 'bn-BD' | 'en-US')}>
                <option value="bn-BD">বাংলা</option><option value="en-US">English</option>
              </select>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '18px 0' }}>
              <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} /> Speak ZARA's replies aloud
            </label>
            <button onClick={voiceListening ? stopVoiceRecognition : startVoiceRecognition} disabled={busy}>{voiceListening ? 'Stop Listening' : 'Start Speaking'} <Mic size={17} /></button>
            {voiceError && <p role="alert">{voiceError}</p>}
            {voiceListening && <p>Listening… Speak now.</p>}
            <button className="secondary-button" onClick={() => setTab('chat')}>Open Text Chat <ArrowRight size={16} /></button>
          </section>
        )}
        {tab === 'memory' && (
          <section className="module-page">
            <div className="section-title"><h1>Conversation Memory</h1><p>Save information you explicitly want ZARA to remember. Memories stay in this ZARA server's settings database.</p></div>
            <div className="memory-composer"><textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} placeholder="Write a useful note for future conversations…" rows={3} /><button onClick={() => void addMemory()} disabled={!memoryDraft.trim()}>Save Memory</button></div>
            <div className="memory-list">{memories.map((entry) => <article className="memory-item" key={entry.id}><p>{entry.content}</p><small>{new Date(entry.createdAt).toLocaleString()}</small><button onClick={() => void deleteMemory(entry.id)}>Delete</button></article>)}{memories.length === 0 && <p>No memories saved. Add only information you want ZARA to use later.</p>}</div>
          </section>
        )}
        {tab === 'agents' && (
          <section className="module-page">
            <div className="section-title"><h1>AI Agent Templates</h1><p>Create reusable instructions for ZARA. Templates only prepare a prompt; they do not run autonomous tasks.</p></div>
            <div className="agent-form"><input value={agentDraft.name} onChange={(event) => setAgentDraft((v) => ({ ...v, name: event.target.value }))} placeholder="Agent name" /><input value={agentDraft.description} onChange={(event) => setAgentDraft((v) => ({ ...v, description: event.target.value }))} placeholder="Short description (optional)" /><textarea rows={4} value={agentDraft.prompt} onChange={(event) => setAgentDraft((v) => ({ ...v, prompt: event.target.value }))} placeholder="Instructions for this agent…" /><button onClick={() => void addAgentTemplate()} disabled={!agentDraft.name.trim() || !agentDraft.prompt.trim()}>Save Template</button></div>
            <div className="agent-list">{agentTemplates.map((agent) => <article className="agent-item" key={agent.id}><h3>{agent.name}</h3><p>{agent.description}</p><pre>{agent.prompt}</pre><div><button onClick={() => runToolPrompt(agent.prompt)}>Use in Chat</button><button onClick={() => void saveAgents(agentTemplates.filter((item) => item.id !== agent.id))}>Delete</button></div></article>)}{agentTemplates.length === 0 && <p>No agent templates created yet.</p>}</div>
          </section>
        )}
        {tab === 'tools' && (
          <section className="module-page">
            <div className="section-title"><h1>ZARA Tools</h1><p>Safe prompt helpers for common tasks. Nothing runs on your computer automatically.</p></div>
            <div className="tool-grid">
              {[
                ['Explain & Learn', 'Explain a topic step by step in simple Bengali or English.'],
                ['Writing Assistant', 'Help me draft or improve a clear, well-structured message.'],
                ['Coding Helper', 'Help me understand, write, and review code. Explain changes before suggesting them.'],
                ['Research Planner', 'Help me plan research and identify reliable sources to consult.']
              ].map(([name, prompt]) => <article className="tool-card" key={name}><h3>{name}</h3><p>{prompt}</p><button onClick={() => runToolPrompt(prompt)}>Use Tool</button></article>)}
            </div>
            <div className="tool-custom"><label htmlFor="custom-tool-prompt">Custom instruction</label><textarea id="custom-tool-prompt" rows={3} value={toolPrompt} onChange={(event) => setToolPrompt(event.target.value)} placeholder="Describe what you want ZARA to help with…" /><button onClick={() => runToolPrompt(toolPrompt)} disabled={!toolPrompt.trim()}>Send to Chat</button></div>
          </section>
        )}
        {tab === 'files' && (
          <section className="coming-page"><div className="coming-icon"><Folder /></div><h1>Workspace Files</h1><p>Direct file and desktop access is not enabled in this browser build. It needs a restricted workspace boundary and explicit permission before files can be read or changed.</p><button onClick={() => setTab('chat')}>Go to Chat <ArrowRight size={16} /></button></section>
        )}
        {tab === 'about' && (
          <section className="coming-page"><div className="coming-icon"><Info /></div><h1>About ZARA</h1><p>ZARA is one bilingual assistant with one Brain Manager. OmniRoute is primary and FreeLLMAPI is the automatic backup. Provider credentials remain private on the backend.</p><button onClick={() => setTab('settings')}>Brain Settings <ArrowRight size={16} /></button></section>
        )}
      </main>
      {toast && <div className="toast-message" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={16} /></button></div>}
    </div>
  );
}
