
import { motion } from 'framer-motion';
import type { ZaraStatus } from '../types';

interface Props {
  status: ZaraStatus;
}

const statusInfo: Record<ZaraStatus, { label: string; color: string }> = {
  idle: { label: 'Ready for your command', color: '#8b5cf6' },
  listening: { label: 'Listening to you...', color: '#22d3ee' },
  thinking: { label: 'Processing your request...', color: '#a78bfa' },
  speaking: { label: 'ZARA is speaking...', color: '#67e8f9' },
};

export default function StatusIndicator({ status }: Props) {
  const info = statusInfo[status];

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: '#a5b4d4',
        fontSize: 13,
        padding: '10px 16px',
      }}
    >
      <motion.span
        animate={
          status === 'idle'
            ? { opacity: 1 }
            : { opacity: [0.4, 1, 0.4] }
        }
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: info.color,
          boxShadow: `0 0 12px ${info.color}`,
        }}
      />
      {info.label}
    </motion.div>
  );
}
