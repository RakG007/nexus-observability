import React from 'react';

/**
 * Precision geometric emblem for Cipher Logiq.
 * Combines a chamfered hyper-engineering crest with interlocking angular C + L optical conduits.
 */
export function CipherLogiqMark({ className = 'w-10 h-10', glow = true }) {
  const gradId = React.useId();
  const coreId = React.useId();

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cipher Logiq Emblem"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="55%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={coreId} x1="20" y1="18" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#00E5FF" />
        </linearGradient>
      </defs>

      {/* Outer Chamfered Hex-Shield Chassis */}
      <polygon
        points="18,4 46,4 60,18 60,46 46,60 18,60 4,46 4,18"
        fill="rgba(6, 11, 20, 0.85)"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
      />

      {/* Inner Precision CAD Bevel */}
      <polygon
        points="20,8.5 44,8.5 55.5,20 55.5,44 44,55.5 20,55.5 8.5,44 8.5,20"
        fill="none"
        stroke="rgba(0, 229, 255, 0.22)"
        strokeWidth="1"
      />

      {/* Angular 'C' Telemetry Arc */}
      <path
        d="M42 20H24L16 28V36L24 44H42"
        stroke={`url(#${gradId})`}
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        style={glow ? { filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.55))' } : undefined}
      />

      {/* Interlocking 'L' Optical Prism */}
      <path
        d="M29 24V38H46"
        stroke={`url(#${coreId})`}
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* Precision Telemetry Nodes */}
      <rect x="44" y="18.2" width="4" height="3.6" fill="#00F0FF" />
      <rect x="44" y="36.2" width="4" height="3.6" fill="#FFFFFF" />
      <circle cx="16" cy="32" r="2" fill="#00F0FF" />
    </svg>
  );
}

/**
 * Full horizontal Cipher Logiq brand lockup for headers and auth screens.
 */
export default function CipherLogiqLogo({ size = 'md', showSub = true }) {
  const sizes = {
    sm: { mark: 'w-8 h-8', title: 'text-sm', sub: 'text-[9px]' },
    md: { mark: 'w-10 h-10', title: 'text-base', sub: 'text-[10px]' },
    lg: { mark: 'w-14 h-14', title: 'text-xl', sub: 'text-[11px]' },
  }[size] || { mark: 'w-10 h-10', title: 'text-base', sub: 'text-[10px]' };

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <CipherLogiqMark className={sizes.mark} />
      <div className="leading-none">
        <div className="flex items-center gap-2">
          <span className={`font-bold tracking-[0.18em] text-white uppercase ${sizes.title}`}>
            CIPHER<span className="text-[#00E5FF]">LOGIQ</span>
          </span>
        </div>
        {showSub && (
          <p className={`font-mono uppercase tracking-[0.26em] text-slate-400 mt-1 ${sizes.sub}`}>
            NEXUS OBSERVABILITY
          </p>
        )}
      </div>
    </div>
  );
}
