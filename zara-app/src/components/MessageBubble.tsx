
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Message } from '../types';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isZara = message.role === 'zara';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        ...styles.row,
        justifyContent: isZara ? 'flex-start' : 'flex-end',
      }}
    >
      {isZara && (
        <div style={styles.avatar}>
          <Bot size={18} color="#c4b5fd" />
        </div>
      )}

      <div
        style={{
          ...styles.bubble,
          background: isZara
            ? 'rgba(139, 92, 246, 0.12)'
            : 'rgba(34, 211, 238, 0.10)',
          borderColor: isZara
            ? 'rgba(139, 92, 246, 0.25)'
            : 'rgba(34, 211, 238, 0.22)',
          borderRadius: isZara
            ? '5px 18px 18px 18px'
            : '18px 5px 18px 18px',
        }}
      >
        <div style={styles.content}>{message.content}</div>
        <div style={styles.time}>
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {!isZara && (
        <div style={{ ...styles.avatar, background: '#123044' }}>
          <User size={18} color="#67e8f9" />
        </div>
      )}
    </motion.div>
  );
}

const styles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
    marginBottom: 18,
  },
  avatar: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#292044',
  },
  bubble: {
    maxWidth: 'min(75%, 560px)',
    padding: '13px 16px',
    border: '1px solid',
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  content: {
    marginBottom: 5,
  },
  time: {
    textAlign: 'right',
    color: '#78839f',
    fontSize: 10,
  },
};
