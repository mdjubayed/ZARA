
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { ZaraStatus } from '../types';

interface Props {
  status: ZaraStatus;
}

const statusColors: Record<ZaraStatus, string> = {
  idle: '#8b5cf6',
  listening: '#22d3ee',
  thinking: '#a78bfa',
  speaking: '#67e8f9',
};

export default function Avatar({ status }: Props) {
  const color = statusColors[status];
  const active = status !== 'idle';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      style={styles.wrapper}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          ...styles.outerRing,
          borderColor: `${color}55`,
        }}
      />

      {active && (
        <motion.div
          animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeOut',
          }}
          style={{ ...styles.pulseRing, borderColor: color }}
        />
      )}

      <div
        style={{
          ...styles.core,
          boxShadow: `0 0 60px ${color}55`,
        }}
      >
        <div style={styles.glow} />

        <svg viewBox="0 0 120 150" width="76%" height="82%">
          <defs>
            <linearGradient id="zaraFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>

          {/* Hair / helmet */}
          <path
            d="M27 58 Q20 10 60 8 Q100 10 93 58 L88 83 L32 83 Z"
            fill="url(#zaraFace)"
          />

          {/* Face */}
          <ellipse cx="60" cy="61" rx="27" ry="34" fill="#11172e" />

          {/* Futuristic eye lights */}
          <path
            d="M43 56 L53 56 M67 56 L77 56"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Face details */}
          <path
            d="M52 75 Q60 80 68 75"
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Neck */}
          <path d="M48 91 L72 91 L77 105 L43 105 Z" fill="#28365b" />

          {/* Armor / shoulders */}
          <path
            d="M18 150 Q18 106 43 102 L60 114 L77 102 Q102 106 102 150 Z"
            fill="url(#zaraFace)"
          />

          <path
            d="M43 111 L60 126 L77 111"
            stroke="#dbeafe"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>

      <motion.div
        key={status}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.status}
      >
        <span
          style={{
            ...styles.dot,
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
        {status === 'idle'
          ? 'Standby'
          : status.charAt(0).toUpperCase() + status.slice(1)}
      </motion.div>
    </motion.div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    width: '280px',
    flexShrink: 0,
  },
  outerRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '220px',
    height: '220px',
    marginTop: '-110px',
    marginLeft: '-110px',
    borderRadius: '50%',
    border: '1px dashed',
  },
  pulseRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '180px',
    height: '180px',
    marginTop: '-90px',
    marginLeft: '-90px',
    borderRadius: '50%',
    border: '2px solid',
  },
  core: {
    position: 'relative',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#0a0d1f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 30%,rgba(139,92,246,0.3),transparent 70%)',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#7a85a8',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
};
