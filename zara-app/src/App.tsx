
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Brain, Clock3, Settings, Sparkles } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Avatar from './components/Avatar';
import StatusIndicator from './components/StatusIndicator';
import ChatInterface from './components/ChatInterface';

import type { Message, SidebarTab, ZaraStatus } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ZaraStatus>('idle');

  const pageTitles: Record<SidebarTab, string> = {
    chat: 'AI Assistant',
    memory: 'Memory Center',
    skills: 'AI Skills',
    history: 'Conversation History',
    settings: 'Settings',
  };

  const renderPage = () => {
    if (activeTab === 'chat') {
      return (
        <div style={styles.chatLayout}>
          <div style={styles.avatarPanel}>
            <Avatar status={status} />
            <StatusIndicator status={status} />
            <p style={styles.avatarCaption}>
              Your personal AI assistant
            </p>
          </div>

          <div style={styles.chatPanel}>
            <ChatInterface
              messages={messages}
              setMessages={setMessages}
              status={status}
              setStatus={setStatus}
            />
          </div>
        </div>
      );
    }

    const pageInfo = {
      memory: {
        icon: <Brain size={30} />,
        title: 'Memory Center',
        description: 'ZARA memory management will be available here.',
      },
      skills: {
        icon: <Sparkles size={30} />,
        title: 'AI Skills',
        description: 'Manage ZARA capabilities and integrations here.',
      },
      history: {
        icon: <Clock3 size={30} />,
        title: 'Conversation History',
        description: 'Your saved conversations will appear here.',
      },
      settings: {
        icon: <Settings size={30} />,
        title: 'Settings',
        description: 'Customize your ZARA experience here.',
      },
    }[activeTab];

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.placeholder}
      >
        <div style={styles.placeholderIcon}>{pageInfo.icon}</div>
        <h2>{pageInfo.title}</h2>
        <p>{pageInfo.description}</p>
        <span style={styles.comingSoon}>COMING SOON</span>
      </motion.div>
    );
  };

  return (
    <div style={styles.app}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{pageTitles[activeTab]}</h1>
            <p style={styles.subtitle}>Welcome to ZARA AI</p>
          </div>

          <div style={styles.headerBadge}>
            <span style={styles.onlineDot} />
            UI DEMO
          </div>
        </header>

        <section style={styles.content}>
          {renderPage()}
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  app: {
    display: 'flex',
    width: '100%',
    height: '100dvh',
    minHeight: '560px',
    overflow: 'hidden',
    color: '#e2e8f0',
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    minHeight: 76,
    padding: '15px 26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(10,14,30,0.65)',
  },
  title: {
    fontSize: 19,
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: '#78839f',
    fontSize: 11,
    margin: '5px 0 0',
  },
  headerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 20,
    border: '1px solid rgba(139,92,246,0.25)',
    color: '#b9a5ff',
    fontSize: 10,
    letterSpacing: 1,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#a78bfa',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chatLayout: {
    display: 'flex',
    width: '100%',
    height: '100%',
    minHeight: 0,
  },
  avatarPanel: {
    width: '35%',
    minWidth: 250,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRight: '1px solid rgba(148,163,184,0.10)',
    background: 'rgba(13,17,38,0.45)',
    padding: 20,
  },
  avatarCaption: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 12,
  },
  chatPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 24,
  },
  placeholderIcon: {
    color: '#a78bfa',
    padding: 22,
    borderRadius: 22,
    background: 'rgba(139,92,246,0.12)',
  },
  comingSoon: {
    marginTop: 15,
    padding: '7px 13px',
    borderRadius: 20,
    background: 'rgba(139,92,246,0.12)',
    color: '#c4b5fd',
    fontSize: 10,
    letterSpacing: 1,
  },
};
