import { useId } from 'react';

type ShadowState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function ShadowAvatar({
  state = 'idle',
  compact = false,
}: {
  state?: ShadowState;
  compact?: boolean;
}) {
  const instanceId = useId().replace(/:/g, '');
  const coreId = `shadowCore-${instanceId}`;
  const rimId = `shadowRim-${instanceId}`;
  const glowId = `shadowGlow-${instanceId}`;
  const blurId = `shadowBlur-${instanceId}`;

  return (
    <div className={`zara-shadow-avatar state-${state}${compact ? ' is-compact' : ''}`} role="img" aria-label={`ZARA faceless shadow assistant, ${state}`}>
      <div className="shadow-aura shadow-aura-one" />
      <div className="shadow-aura shadow-aura-two" />
      <div className="shadow-orbit orbit-one" />
      <div className="shadow-orbit orbit-two" />
      <svg className="shadow-figure" viewBox="0 0 420 600" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={coreId} cx="50%" cy="34%" r="68%">
            <stop offset="0" stopColor="#11182e" />
            <stop offset=".52" stopColor="#050817" />
            <stop offset="1" stopColor="#01030a" />
          </radialGradient>
          <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b7f5ff" stopOpacity=".95" />
            <stop offset=".35" stopColor="#5d8dff" stopOpacity=".85" />
            <stop offset=".72" stopColor="#a05cff" stopOpacity=".8" />
            <stop offset="1" stopColor="#36e7ff" stopOpacity=".45" />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={blurId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>
        <ellipse cx="210" cy="548" rx="112" ry="18" fill="#4c68ff" opacity=".28" filter={`url(#${blurId})`} />
        <path d="M210 34 C146 34 116 89 120 150 C123 201 151 238 210 244 C269 238 297 201 300 150 C304 89 274 34 210 34Z" fill="#060916" stroke={`url(#${rimId})`} strokeWidth="2.2" filter={`url(#${glowId})`} />
        <path d="M171 220 C178 246 176 260 158 275 C112 289 75 315 57 365 L29 489 C26 506 40 519 58 514 L105 502 L113 560 L307 560 L315 502 L362 514 C380 519 394 506 391 489 L363 365 C345 315 308 289 262 275 C244 260 242 246 249 220Z" fill={`url(#${coreId})`} stroke={`url(#${rimId})`} strokeWidth="2.5" filter={`url(#${glowId})`} />
        <path d="M157 279 C180 300 240 300 263 279 C289 301 310 328 319 365 L340 479 C301 456 266 447 210 447 C154 447 119 456 80 479 L101 365 C110 328 131 301 157 279Z" fill="#020511" opacity=".9" />
        <path d="M210 250 L210 445" stroke={`url(#${rimId})`} strokeWidth="1.6" opacity=".5" filter={`url(#${glowId})`} />
        <path d="M120 352 C151 329 174 324 210 324 C246 324 269 329 300 352" fill="none" stroke="#80a7ff" strokeOpacity=".45" strokeWidth="2" filter={`url(#${glowId})`} />
        <path d="M61 470 C112 444 154 435 210 435 C266 435 308 444 359 470" fill="none" stroke="#9b73ff" strokeOpacity=".48" strokeWidth="2" />
        <path d="M151 84 C163 50 185 38 210 38 C235 38 257 50 269 84" fill="none" stroke="#b9f8ff" strokeOpacity=".7" strokeWidth="2" filter={`url(#${glowId})`} />
      </svg>
      <span className="shadow-particle particle-one" />
      <span className="shadow-particle particle-two" />
      <span className="shadow-particle particle-three" />
      <span className="shadow-status">{state === 'idle' ? 'READY' : state.toUpperCase()}</span>
    </div>
  );
}
