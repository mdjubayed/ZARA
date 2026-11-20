import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, AudioLines, Bot, ChevronDown,
  Code2, Folder, Globe, Grid2X2, Heart, Home, Info, Keyboard, Mic,
  MessageCircle, MessageSquare, Paperclip, Play, Search, Send, Settings,
  ShieldCheck, Sparkles, Volume2, X, Zap,
} from 'lucide-react';
import heroImage from './assets/zara-hero.png';
import './App.css';

type Tab = 'home' | 'chat' | 'voice' | 'memory' | 'agents' | 'tools' | 'files' | 'settings' | 'about';
type ProviderId = 'omniroute' | 'freellmapi';
type Provider = { id: ProviderId; name: string; status: string; enabled: number; model?: string };
type Thread = { id: string; title: string; updated_at?: string };
type SearchResult = { id: string; thread_id: string; thread_title: string; content: string; role: 'user' | 'assistant' | 'system' };
type MemoryEntry = { id: string; content: string; createdAt: string };
type AgentTemplate = { id: string; name: string; description: string; prompt: string };

interface WorkspaceFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
interface WorkspaceDirectoryHandle {
  kind: 'directory';
  name: string;
  entries(): AsyncIterable<[string, WorkspaceFileHandle | WorkspaceDirectoryHandle]>;
}
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode: 'readwrite' }) => Promise<WorkspaceDirectoryHandle>;
};
type WorkspaceFileItem = { path: string; handle: WorkspaceFileHandle };

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
  const [providerModels, setProviderModels] = useState<Record<ProviderId, string[]>>({ omniroute: [], freellmapi: [] });
  const [providerModelSelections, setProviderModelSelections] = useState<Record<ProviderId, string>>({ omniroute: '', freellmapi: '' });
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<Record<ProviderId, string>>({ omniroute: '', freellmapi: '' });
  const [providerKeyStored, setProviderKeyStored] = useState<Record<ProviderId, boolean>>({ omniroute: false, freellmapi: false });
  const [secureKeyStorageAvailable, setSecureKeyStorageAvailable] = useState(false);
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
  const [workspaceHandle, setWorkspaceHandle] = useState<WorkspaceDirectoryHandle | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileItem[]>([]);
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState('');
  const [workspaceContent, setWorkspaceContent] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const activeChatController = useRef<AbortController | null>(null);

  const refreshProviders = useCallback(async () => {
    try {
      const result = await api<{ providers: Provider[] }>('/providers');
      setProviders(result.providers);
      setProviderModelSelections((current) => ({ ...current, ...Object.fromEntries(result.providers.map((provider) => [provider.id, provider.model ?? ''])) }));
    } catch {
      setProviders([]);
    }
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    activeChatController.current?.abort();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    let active = true;
    const desktop = window.zaraDesktop;
    if (!desktop?.isDesktop) return () => { active = false; };
    void desktop.getProviderKeyStatus().then((status) => {
      if (!active) return;
      setSecureKeyStorageAvailable(status.available);
      setProviderKeyStored({ omniroute: status.omniroute, freellmapi: status.freellmapi });
    }).catch(() => {
      if (active) setSecureKeyStorageAvailable(false);
    });
    return () => { active = false; };
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
      .then((result) => { if (active) { setProviders(result.providers); setProviderModelSelections((current) => ({ ...current, ...Object.fromEntries(result.providers.map((provider) => [provider.id, provider.model ?? ''])) })); } })
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
          const result = await api<{ thread: Thread }>('/threads', { method: 'POST', body: JSON.stringify({ title: 'New Chat' }) });
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

    const controller = new AbortController();
    activeChatController.current = controller;
    try {
      const response = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, content, clientMessageId, providerId: selectedProvider }),
        signal: controller.signal,
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
      api<{ threads: Thread[] }>('/threads').then((result) => setThreads(result.threads)).catch(() => undefined);
      if (speakResponse && autoSpeak && finalAssistantMessage?.content && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(finalAssistantMessage.content);
        utterance.lang = voiceLanguage;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content || 'Request cancelled.' } : item));
        return;
      }
      const message = error instanceof Error ? error.message : 'CHAT_REQUEST_FAILED';
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content ? `${item.content}\n\n[Connection interrupted: ${message}]` : `I couldn't complete that request: ${message}` } : item));
    } finally {
      if (activeChatController.current === controller) activeChatController.current = null;
      setBusy(false);
    }
  }, [autoSpeak, busy, input, refreshProviders, selectedProvider, threadId, voiceLanguage]);

  const openWorkspace = async () => {
    const pickerWindow = window as DirectoryPickerWindow;
    if (!pickerWindow.showDirectoryPicker) {
      setToast('Folder access is not supported in this browser. Use the latest Chrome or Edge.');
      return;
    }
    try {
      setWorkspaceBusy(true);
      const directory = await pickerWindow.showDirectoryPicker({ mode: 'readwrite' });
      const collected: WorkspaceFileItem[] = [];
      const scan = async (folder: WorkspaceDirectoryHandle, prefix = '', depth = 0): Promise<void> => {
        if (depth > 3 || collected.length >= 200) return;
        for await (const [name, handle] of folder.entries()) {
          if (collected.length >= 200) break;
          const relativePath = prefix ? prefix + '/' + name : name;
          if (handle.kind === 'file') {
            collected.push({ path: relativePath, handle });
          } else if (depth < 3) {
            await scan(handle, relativePath, depth + 1);
          }
        }
      };
      await scan(directory);
      setWorkspaceHandle(directory);
      setWorkspaceFiles(collected.sort((a, b) => a.path.localeCompare(b.path)));
      setSelectedWorkspacePath('');
      setWorkspaceContent('');
      setToast('Folder opened. Only this selected folder is available to ZARA.');
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setToast('Could not open folder: ' + error.message);
      }
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const openWorkspaceFile = async (item: WorkspaceFileItem) => {
    try {
      setWorkspaceBusy(true);
      const file = await item.handle.getFile();
      if (!/\.(txt|md|json|csv|ts|tsx|js|jsx|py|html|css|xml|log|yml|yaml|toml|sql)$/i.test(file.name)) {
        setToast('Only supported text and source-code files can be opened.');
        return;
      }
      if (file.size > 500000) {
        setToast('This file is larger than the 500 KB editor limit.');
        return;
      }
      const content = await file.text();
      setSelectedWorkspacePath(item.path);
      setWorkspaceContent(content);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not read file');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const saveWorkspaceFile = async () => {
    const selected = workspaceFiles.find((item) => item.path === selectedWorkspacePath);
    if (!selected) return;
    if (workspaceContent.length > 500000) { setToast('Edited content exceeds the 500 KB save limit.'); return; }
    if (!window.confirm('Save changes to ' + selected.path + '? This will overwrite the selected file.')) return;
    try {
      setWorkspaceBusy(true);
      const writable = await selected.handle.createWritable();
      await writable.write(workspaceContent);
      await writable.close();
      setToast('File saved successfully.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not save file');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const saveMemories = async (next: MemoryEntry[]) => {
    await api('/settings/zara.memory.entries', { method: 'PATCH', body: JSON.stringify({ value: next }) });
    setMemories(next);
  };

  const addMemory = async () => {
    const content = memoryDraft.trim();
    if (!content) return;
    if (memories.length >= 100) { setToast('Memory limit reached. Delete an old note before adding another.'); return; }
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

  const runDesktopApp = async (appId: 'notepad' | 'calculator', label: string) => {
    const desktop = window.zaraDesktop;
    if (!desktop?.isDesktop) {
      setToast('This action is available in the installed Windows desktop app.');
      return;
    }
    try {
      const result = await desktop.launchApp(appId);
      setToast(result.ok ? `${label} opened.` : result.error === 'CANCELLED'
        ? 'Action cancelled.'
        : result.error === 'APP_NOT_SUPPORTED'
          ? 'This app is available only on Windows.'
          : 'ZARA could not open that app.');
    } catch {
      setToast('The desktop action could not be completed.');
    }
  };

  const openDesktopBrowser = async () => {
    const desktop = window.zaraDesktop;
    if (!desktop?.isDesktop) {
      setToast('Open the ZARA Windows desktop app to use this action.');
      return;
    }
    try {
      const result = await desktop.openExternal('https://www.google.com');
      setToast(result.ok ? 'Default browser opened.' : result.error === 'CANCELLED' ? 'Action cancelled.' : 'Could not open the default browser.');
    } catch {
      setToast('Could not open the default browser.');
    }
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
    recognition.onend = () => { setVoiceListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setVoiceListening(true);
    try { recognition.start(); } catch (error) { setVoiceListening(false); setVoiceError(error instanceof Error ? error.message : 'Could not start voice input.'); }
  }, [sendMessage, voiceLanguage]);
  const stopVoiceRecognition = useCallback(() => { recognitionRef.current?.stop(); setVoiceListening(false); }, []);
  const verifyProvider = async (id: ProviderId) => {
    setToast(`Checking ${id} connection...`);
    try {
      const result = await api<{ modelCount: number; models: string[]; requiresModelSelection?: boolean }>(`/providers/${id}/verify`, { method: 'POST' });
      setProviderModels((current) => ({ ...current, [id]: result.models }));
      await refreshProviders();
      setToast(result.requiresModelSelection ? `${id}: choose a model from the list, save it, then verify again.` : `${id} connected. ${result.modelCount} models found. Enable it to use it.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Provider verification failed');
    }
  };

  const saveProviderKey = async (id: ProviderId) => {
    const key = providerKeyDrafts[id].trim();
    const desktop = window.zaraDesktop;
    if (!desktop || !secureKeyStorageAvailable || !key) return;
    try {
      const result = await desktop.saveProviderKey(id, key);
      if (!result.ok) {
        setToast(result.error === 'CANCELLED' ? 'No changes were made.' : 'The key could not be stored securely. No key was saved.');
        return;
      }
      setProviderKeyDrafts((current) => ({ ...current, [id]: '' }));
      setProviderKeyStored((current) => ({ ...current, [id]: true }));
      setToast('API key saved using Windows secure storage. Verify the provider next.');
      await refreshProviders();
    } catch {
      setToast('Secure API key storage failed. No key was saved.');
    }
  };

  const clearProviderKey = async (id: ProviderId) => {
    const desktop = window.zaraDesktop;
    if (!desktop || !secureKeyStorageAvailable) return;
    try {
      const result = await desktop.clearProviderKey(id);
      if (!result.ok) {
        setToast(result.error === 'CANCELLED' ? 'No changes were made.' : 'The saved key could not be removed.');
        return;
      }
      setProviderKeyStored((current) => ({ ...current, [id]: false }));
      setProviderKeyDrafts((current) => ({ ...current, [id]: '' }));
      setToast('Saved API key removed.');
      await refreshProviders();
    } catch {
      setToast('Could not remove the saved API key.');
    }
  };

  const saveProviderModel = async (id: ProviderId) => {
    const model = providerModelSelections[id].trim();
    if (!model) { setToast('Select a model first.'); return; }
    try {
      await api('/settings/zara.provider.' + id + '.model', {
        method: 'PATCH',
        body: JSON.stringify({ value: model }),
      });
      setToast('Model saved. Verifying provider compatibility…');
      await verifyProvider(id);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not save provider model');
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
          <div className="top-actions"><button aria-label="Voice" onClick={() => setTab('voice')}><Mic /></button><button aria-label="Sound" onClick={() => { setAutoSpeak((value) => !value); if (autoSpeak && "speechSynthesis" in window) window.speechSynthesis.cancel(); }} title={autoSpeak ? "Mute spoken replies" : "Enable spoken replies"}><Volume2 /></button><button aria-label="Language" onClick={() => setVoiceLanguage((value) => value === "bn-BD" ? "en-US" : "bn-BD")}><Globe /></button><span className="window-dots">—　□　×</span></div>
        </header>

        {tab === 'home' && (
          <section className="dashboard-grid">
            <div className="hero-stage">
              <div className="hero-glow" />
              <div className="welcome-bubble"><strong>Hello! I'm ZARA <span>😊</span></strong><br /><em>How can I help</em> you today?</div>
              <img className="hero-character" src={heroImage} alt="ZARA futuristic assistant" />
              <div className="hero-brand"><b>Z</b><strong>ZARA</strong><small>Dream · Assist · Achieve</small></div>
              <div className="talk-dock"><div className="wave-icon"><AudioLines size={27} /></div><span>Tap to Talk</span><button className="mic-main" onClick={() => setTab('voice')} aria-label="Open voice assistant"><Mic size={39} /></button><button onClick={() => setTab('chat')} aria-label="Open chat"><Keyboard /></button><button onClick={() => setTab('voice')} aria-label="Open voice assistant"><Play /></button><button onClick={() => setTab('settings')} aria-label="Open settings"><Settings /></button></div>
            </div>
            <aside className="right-rail">
              <section className="glass-card quick-card"><div className="card-heading"><h2><Zap size={20} fill="#ffd34e" /> Quick Actions</h2><button onClick={() => setTab('tools')}>View All <ArrowRight size={16} /></button></div><div className="quick-actions"><button onClick={() => setTab('chat')}><MessageCircle /><span>Chat<br />Now</span></button><button onClick={() => setTab('voice')}><Mic /><span>Voice<br />Assistant</span></button><button onClick={() => setTab('memory')}><Grid2X2 /><span>Saved<br />Memory</span></button><button onClick={() => setTab('tools')}><Zap /><span>Open<br />Tools</span></button></div></section>
              <section className="glass-card skills-card"><div className="card-heading"><h2><Sparkles size={20} fill="#ffd34e" /> AI Skills</h2><button onClick={() => setTab('agents')}>View All <ArrowRight size={16} /></button></div><ul className="skill-list"><li><Search />Bengali &amp; English Chat</li><li><Mic />Browser Voice Input</li><li><Search />Conversation Search</li><li><Grid2X2 />Saved Memory</li><li><Code2 />Writing &amp; Coding Helpers</li></ul></section>
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
            <div className="composer-wrap"><div className="composer"><label className="file-attach-button" title="Attach a text file"><input type="file" accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.xml,.log" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 80000) { setToast("File is too large. Maximum chat attachment size is 80 KB."); return; } try { const text = await file.text(); setInput((current) => current + "\n\n[Attached file: " + file.name + "]\n" + text); } catch { setToast("Could not read this file."); } }} /><Paperclip size={18} /></label><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message ZARA…" rows={1} /><button className={busy ? "stop-button" : "send-button"} onClick={() => busy ? activeChatController.current?.abort() : void sendMessage()} disabled={!busy && (!input.trim() || !threadId)} aria-label={busy ? "Stop response" : "Send message"}>{busy ? <X size={19} /> : <Send size={19} />}</button></div><small>{enabledProvider ? `Using ${enabledProvider.name}` : 'Choose a verified and enabled provider in Settings. API keys stay on the backend.'}</small></div>
          </section>
        )}

        {tab === 'settings' && (
          <section className="settings-page"><div className="section-title"><h1>AI Brain Settings</h1><p>Configure the two approved providers. API keys are read only from backend environment variables.</p></div><div className="provider-cards">{(['omniroute', 'freellmapi'] as ProviderId[]).map((id) => { const provider = providers.find((item) => item.id === id); return <article className="provider-card" key={id}><div className="provider-card-top"><div className={`provider-symbol ${id}`}>{id === 'omniroute' ? 'O' : 'F'}</div><div><h2>{id === 'omniroute' ? 'OmniRoute' : 'FreeLLMAPI'}</h2><p>{id === 'omniroute' ? 'Primary AI Brain' : 'Automatic Backup Brain'}</p></div><span className={`provider-status ${provider?.status === 'ready' ? 'ready' : ''}`}>{provider?.status ?? 'not checked'}</span></div><div className="provider-meta"><span>API Key: <b>{secureKeyStorageAvailable ? (providerKeyStored[id] ? 'Saved securely' : 'Not configured') : 'Backend environment'}</b></span><span>Enabled: <b>{provider?.enabled ? 'Yes' : 'No'}</b></span></div>{secureKeyStorageAvailable && <div className="provider-key-control"><label htmlFor={id + '-api-key'}>Private API Key</label><input id={id + '-api-key'} type="password" autoComplete="new-password" spellCheck={false} value={providerKeyDrafts[id]} maxLength={4096} onChange={(event) => setProviderKeyDrafts((current) => ({ ...current, [id]: event.target.value }))} placeholder={providerKeyStored[id] ? 'Enter a new key to replace the saved key' : 'Paste key here; it is never displayed again'} /><div><button onClick={() => void saveProviderKey(id)} disabled={!providerKeyDrafts[id].trim()}>Save Securely</button>{providerKeyStored[id] && <button className="secondary-button" onClick={() => void clearProviderKey(id)}>Remove Saved Key</button>}</div><small>Encrypted by Windows DPAPI. The key is not sent to the ZARA frontend API or stored in SQLite.</small></div>}<div className="provider-model-picker"><label htmlFor={id + '-model'}>Model</label><select id={id + '-model'} value={providerModelSelections[id]} onChange={(event) => setProviderModelSelections((current) => ({ ...current, [id]: event.target.value }))} disabled={providerModels[id].length === 0}><option value="">Select after verifying connection</option><option value="auto">auto (provider-selected)</option>{providerModels[id].filter((model) => model !== 'auto').map((model) => <option value={model} key={model}>{model}</option>)}</select><button onClick={() => void saveProviderModel(id)} disabled={!providerModelSelections[id].trim()}>Save Model</button></div><div className="provider-buttons"><button onClick={() => void verifyProvider(id)}>Verify Connection</button><button className="secondary-button" disabled={!provider || provider.status !== 'ready'} onClick={() => provider && void toggleProvider(provider)}>{provider?.enabled ? 'Disable' : 'Enable'}</button></div></article>; })}</div><div className="notice-card"><ShieldCheck /><div><strong>Secret protection</strong><p>Never paste API keys into ChatGPT, browser console, or SQLite. The Windows desktop app can store keys using encrypted Windows storage; web and development builds use private backend environment variables.</p></div></div></section>
        )}

        {tab === 'voice' && (
          <section className="coming-page">
            <div className="coming-icon"><Mic /></div>
            <h1>Talk with ZARA</h1>
            <p>Speak in Bengali or English. Your browser converts speech to text and sends the transcript to the selected ZARA Brain. Browser speech recognition may use the browser provider's online service.</p>
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
            {busy && <button onClick={() => activeChatController.current?.abort()}>Stop ZARA response <X size={17} /></button>}
            {voiceError && <p role="alert">{voiceError}</p>}
            {voiceListening && <p>Listening… Speak now.</p>}
            <div className="voice-transcript">
              {messages.slice(-6).map((message) => (
                <article key={message.id}><strong>{message.role === 'user' ? 'You' : 'ZARA'}</strong><p>{message.content}</p></article>
              ))}
            </div>
            <button className="secondary-button" onClick={() => setTab('chat')}>Open Text Chat <ArrowRight size={16} /></button>
          </section>
        )}
        {tab === 'memory' && (
          <section className="module-page">
            <div className="section-title"><h1>Conversation Memory</h1><p>Save information you explicitly want ZARA to remember. Memories stay in this ZARA server's settings database.</p></div>
            <div className="memory-composer"><textarea value={memoryDraft} maxLength={2000} onChange={(event) => setMemoryDraft(event.target.value)} placeholder="Write a useful note for future conversations…" rows={3} /><button onClick={() => void addMemory()} disabled={!memoryDraft.trim()}>Save Memory</button></div>
            <div className="memory-list">{memories.map((entry) => <article className="memory-item" key={entry.id}><p>{entry.content}</p><small>{new Date(entry.createdAt).toLocaleString()}</small><button onClick={() => void deleteMemory(entry.id)}>Delete</button></article>)}{memories.length === 0 && <p>No memories saved. Add only information you want ZARA to use later.</p>}</div>
          </section>
        )}
        {tab === 'agents' && (
          <section className="module-page">
            <div className="section-title"><h1>AI Agent Templates</h1><p>Create reusable instructions for ZARA. Templates only prepare a prompt; they do not run autonomous tasks.</p></div>
            <div className="agent-form"><input maxLength={80} value={agentDraft.name} onChange={(event) => setAgentDraft((v) => ({ ...v, name: event.target.value }))} placeholder="Agent name" /><input value={agentDraft.description} onChange={(event) => setAgentDraft((v) => ({ ...v, description: event.target.value }))} placeholder="Short description (optional)" /><textarea rows={4} maxLength={4000} value={agentDraft.prompt} onChange={(event) => setAgentDraft((v) => ({ ...v, prompt: event.target.value }))} placeholder="Instructions for this agent…" /><button onClick={() => void addAgentTemplate()} disabled={!agentDraft.name.trim() || !agentDraft.prompt.trim()}>Save Template</button></div>
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
            {window.zaraDesktop?.isDesktop && <div className="desktop-actions"><h2>Windows Desktop Actions</h2><p>These actions run only after you confirm them. ZARA can open these approved apps; it cannot close or control other programs.</p><div className="desktop-action-buttons"><button onClick={() => void runDesktopApp('notepad', 'Notepad')}>Open Notepad</button><button onClick={() => void runDesktopApp('calculator', 'Calculator')}>Open Calculator</button><button onClick={() => void openDesktopBrowser()}>Open Browser</button></div></div>}
            <div className="tool-custom"><label htmlFor="custom-tool-prompt">Custom instruction</label><textarea id="custom-tool-prompt" rows={3} value={toolPrompt} onChange={(event) => setToolPrompt(event.target.value)} placeholder="Describe what you want ZARA to help with…" /><button onClick={() => runToolPrompt(toolPrompt)} disabled={!toolPrompt.trim()}>Send to Chat</button></div>
          </section>
        )}
        {tab === 'files' && (
          <section className="module-page">
            <div className="section-title"><h1>Workspace Files</h1><p>Choose one folder to let ZARA list, read, and edit text files inside it. ZARA cannot browse outside that folder or delete files.</p></div>
            <div className="workspace-toolbar"><button onClick={() => void openWorkspace()} disabled={workspaceBusy}><Folder size={17} /> {workspaceHandle ? 'Choose Another Folder' : 'Choose Folder'}</button><span>{workspaceHandle ? 'Selected folder: ' + workspaceHandle.name : 'No folder selected'}</span>{workspaceHandle && <button className="workspace-close" onClick={() => { setWorkspaceHandle(null); setWorkspaceFiles([]); setSelectedWorkspacePath(''); setWorkspaceContent(''); }}>Close Folder</button>}</div>
            {workspaceHandle && (
              <div className="workspace-layout">
                <div className="workspace-file-list">
                  <strong>Files (up to 200 items, 3 folder levels)</strong>
                  {workspaceFiles.map((item) => <button className={selectedWorkspacePath === item.path ? 'selected' : ''} key={item.path} onClick={() => void openWorkspaceFile(item)}>{item.path}</button>)}
                  {workspaceFiles.length === 0 && <p>No files found in the selected folder.</p>}
                </div>
                <div className="workspace-editor">
                  <strong>{selectedWorkspacePath || 'Select a text file'}</strong>
                  <textarea value={workspaceContent} onChange={(event) => setWorkspaceContent(event.target.value)} placeholder="Selected file contents will appear here…" disabled={!selectedWorkspacePath || workspaceBusy} />
                  <div><button onClick={() => void saveWorkspaceFile()} disabled={!selectedWorkspacePath || workspaceBusy}>Save Selected File</button><button className="secondary-button" onClick={() => { setSelectedWorkspacePath(''); setWorkspaceContent(''); }}>Close File</button></div>
                </div>
              </div>
            )}
            <p className="workspace-safety">Safety: folder access is granted by your browser. Only text content up to 500 KB can be opened. Saving always requires your confirmation. No file deletion or command execution is available.</p>
          </section>
        )}
        {tab === 'about' && (
          <section className="coming-page"><div className="coming-icon"><Info /></div><h1>About ZARA</h1><p>ZARA is one bilingual assistant with one Brain Manager. OmniRoute is primary and FreeLLMAPI is the automatic backup. Provider credentials remain private on the backend.</p><button onClick={() => setTab('settings')}>Brain Settings <ArrowRight size={16} /></button></section>
        )}
      </main>
      {toast && <div className="toast-message" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={16} /></button></div>}
    </div>
  );
}
