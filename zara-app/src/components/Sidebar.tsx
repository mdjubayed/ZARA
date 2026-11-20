import { motion } from 'framer-motion';
import {
  MessageSquare,
  Brain,
  Sparkles,
  Clock3,
  Settings,
  Zap,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { SidebarTab } from '../types';

interface Props {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

const items = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'skills', label: 'AI Skills', icon: Sparkles },
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export default function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.logo}>
          <Zap size={23} />
        </div>
        <div>
          <h2 style={styles.brandName}>ZARA</h2>
          <span style={styles.brandCaption}>AI ASSISTANT</span>
        </div>
      </div>

      <div style={styles.sectionLabel}>WORKSPACE</div>

      <nav style={styles.nav}>
        {items.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;

          return (
            <motion.button
              key={id}
              type="button"
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onTabChange(id)}
              style={{
                ...styles.navItem,
                ...(active ? styles.activeItem : {}),
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {active && <span style={styles.activeDot} />}
            </motion.button>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <span style={styles.footerDot} />
        <span>LOCAL INTERFACE</span>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: 245,
    minWidth: 245,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '25px 16px 18px',
    background: 'rgba(9,12,27,0.96)',
    borderRight: '1px solid rgba(148,163,184,0.12)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 9px',
    marginBottom: 48,
  },
  logo: {
    width: 42,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 13,
    color: '#c4b5fd',
    background: 'rgba(139,92,246,0.16)',
    border: '1px solid rgba(139,92,246,0.3)',
  },
  brandName: {
    margin: 0,
    color: '#f1f5f9',
    fontSize: 21,
    letterSpacing: 3,
  },
  brandCaption: {
    color: '#818ba8',
    fontSize: 9,
    letterSpacing: 2,
  },
  sectionLabel: {
    padding: '0 12px',
    marginBottom: 13,
    color: '#64748b',
    fontSize: 9,
    letterSpacing: 1.8,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  navItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    padding: '12px 13px',
    border: '1px solid transparent',
    borderRadius: 10,
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'left',
    cursor: 'pointer',
  },
  activeItem: {
    color: '#ddd6fe',
    background: 'rgba(139,92,246,0.13)',
    borderColor: 'rgba(139,92,246,0.23)',
  },
  activeDot: {
    width: 6,
    height: 6,
    marginLeft: 'auto',
    borderRadius: '50%',
    background: '#a78bfa',
    boxShadow: '0 0 9px #a78bfa',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    marginTop: 'auto',
    padding: '14px 10px 3px',
    borderTop: '1px solid rgba(148,163,184,0.1)',
    color: '#64748b',
    fontSize: 9,
    letterSpacing: 1,
  },
  footerDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22d3ee',
  },
};
