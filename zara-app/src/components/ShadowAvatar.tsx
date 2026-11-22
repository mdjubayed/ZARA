import { useId } from 'react';

type ShadowState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function ShadowAvatar({ state = 'idle', compact = false }: { state?: ShadowState; compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <div className={`zara-shadow-avatar state-${state}${compact ? ' is-compact' : ''}`} role="img" aria-label={`ZARA luminous faceless hologram, ${state}`}>
      <div className="shadow-aura shadow-aura-one" />
      <div className="shadow-aura shadow-aura-two" />
      <svg className="shadow-figure" viewBox="0 0 520 620" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`smoke-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c8ffff" stopOpacity=".12" />
            <stop offset=".38" stopColor="#52efff" stopOpacity=".48" />
            <stop offset=".72" stopColor="#087e91" stopOpacity=".23" />
            <stop offset="1" stopColor="#d5ffff" stopOpacity=".08" />
          </linearGradient>
          <radialGradient id={`mist-${id}`}>
            <stop offset="0" stopColor="#65f5ff" stopOpacity=".58" />
            <stop offset="1" stopColor="#00a9bd" stopOpacity="0" />
          </radialGradient>
          <filter id={`soft-${id}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <filter id={`glow-${id}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <ellipse cx="270" cy="310" rx="190" ry="245" fill={`url(#mist-${id})`} filter={`url(#soft-${id})`} />
        <g fill="none" stroke={`url(#smoke-${id})`} strokeLinecap="round" filter={`url(#glow-${id})`}>
          <path strokeWidth="30" d="M180 540 C110 474 112 400 150 337 C184 281 172 214 209 139 C239 78 322 61 369 112 C419 169 391 238 374 285 C359 331 407 354 432 408 C456 461 427 510 390 550" />
          <path strokeWidth="17" d="M151 500 C91 438 145 382 191 344 C232 310 215 264 240 211 C267 155 329 139 356 183 C387 234 335 285 355 331 C375 375 430 402 440 455" />
          <path strokeWidth="12" d="M123 414 C183 394 190 341 206 297 C221 253 213 202 257 157 C292 120 343 126 365 160" />
          <path strokeWidth="24" d="M104 510 C173 469 224 482 270 453 C320 421 349 381 403 384 C449 387 468 426 453 465" />
          <path strokeWidth="11" d="M80 455 C150 427 174 448 221 426 C275 401 298 360 353 348" />
          <path strokeWidth="8" d="M170 570 C230 530 276 548 330 520 C380 494 405 467 461 482" />
          <path strokeWidth="7" d="M202 93 C244 35 328 35 378 92" />
        </g>
        <g fill="none" stroke="#9effff" strokeLinecap="round" filter={`url(#glow-${id})`} opacity=".72">
          <path strokeWidth="4" d="M176 268 C208 209 214 151 269 113 C308 86 351 102 367 130" />
          <path strokeWidth="3" d="M135 433 C197 405 204 355 224 310" />
          <path strokeWidth="3" d="M256 492 C315 474 355 420 415 417" />
        </g>
      </svg>
      <span className="shadow-particle particle-one" />
      <span className="shadow-particle particle-two" />
      <span className="shadow-particle particle-three" />
      <span className="shadow-status">{state === 'idle' ? 'READY' : state.toUpperCase()}</span>
    </div>
  );
}
