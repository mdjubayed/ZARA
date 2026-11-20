
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, Paperclip } from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { Message, ZaraStatus } from '../types';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  status: ZaraStatus;
  setStatus: (status: ZaraStatus) => void;
}

export default function ChatInterface({
  messages,
  setMessages,
  status,
  setStatus,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || status === 'thinking') return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput('');

    // AI backend এখনো সংযুক্ত নয়।
    // এটি শুধু UI পরীক্ষা করার জন্য একটি demo reply।
    setStatus('thinking');

    window.setTimeout(() => {
      const demoMessage: Message = {
        id: crypto.randomUUID(),
        role: 'zara',
        content: 'আমি ZARA। আমার AI brain এখনো সংযুক্ত করা হয়নি। Backend যুক্ত হলে আমি তোমার প্রশ্নের উত্তর দিতে পারব।',
        timestamp: new Date(),
      };

      setMessages((previous) => [...previous, demoMessage]);
      setStatus('idle');
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 1200);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <h2>How can I help you?</h2>
            <p>I'm ZARA. Your personal AI assistant.</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {status === 'thinking' && (
          <div style={styles.thinking}>ZARA is thinking...</div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={styles.inputArea}>
        <div style={styles.inputBox}>
          <button type="button" style={styles.iconButton} aria-label="Attachment (not available yet)">
            <Paperclip size={19} />
          </button>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message ZARA..."
            rows={1}
            style={styles.textarea}
          />

          <button
            type="button"
            style={styles.iconButton}
            aria-label="Voice input (not available yet)"
            disabled
          >
            <Mic size={19} />
          </button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || status === 'thinking'}
            style={{
              ...styles.sendButton,
              opacity: !input.trim() || status === 'thinking' ? 0.45 : 1,
            }}
            aria-label="Send message"
          >
            <Send size={18} />
          </motion.button>
        </div>

        <p style={styles.note}>
          AI connection is not configured yet. Voice and attachments are coming later.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    width: '100%',
  },
  messages: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '24px 20px',
  },
  welcome: {
    textAlign: 'center',
    margin: 'auto',
    padding: '45px 10px',
    color: '#e2e8f0',
  },
  inputArea: {
    padding: '12px 20px 18px',
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
  },
  inputBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 18,
    border: '1px solid rgba(139, 92, 246, 0.3)',
    background: '#10152b',
  },
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: 'none',
    outline: 'none',
    border: 'none',
    background: 'transparent',
    color: '#f1f5f9',
    font: 'inherit',
    fontSize: 14,
    padding: '8px 2px',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#9ca3c5',
    padding: 7,
    cursor: 'pointer',
  },
  sendButton: {
    width: 40,
    height: 40,
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  thinking: {
    color: '#a78bfa',
    fontSize: 13,
    padding: 12,
  },
  note: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 10,
    margin: '10px 0 0',
  },
};
