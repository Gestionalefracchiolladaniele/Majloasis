'use client';

import { useMemo } from 'react';

/**
 * Decorative background: slow-drifting soft white "aurora" blobs plus gently
 * rising white particles ("stardust") over deep black — the luxury B/W look
 * from DESIGN.md. Sits behind content (zIndex 0), purely cosmetic, and
 * collapses under prefers-reduced-motion via the CSS media query.
 */
export function AuroraBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        left: `${(i * 53) % 100}%`,
        size: 2 + ((i * 7) % 3),
        delay: (i * 1.3) % 16,
        duration: 16 + ((i * 3) % 12),
        opacity: 0.3 + ((i * 11) % 28) / 100,
      })),
    [],
  );

  return (
    <div
      aria-hidden
      data-aurora
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* subtle white gradient wash for depth (no colour) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 90% at 12% 6%, rgba(255,255,255,0.05) 0%, transparent 46%),' +
            'radial-gradient(100% 80% at 92% 22%, rgba(255,255,255,0.04) 0%, transparent 50%),' +
            'radial-gradient(110% 90% at 78% 100%, rgba(255,255,255,0.04) 0%, transparent 52%)',
        }}
      />

      {/* aurora blobs — soft grey/white */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-8%',
          width: 'clamp(360px,42vw,640px)',
          height: 'clamp(360px,42vw,640px)',
          background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 68%)',
          filter: 'blur(50px)',
          animation: 'su-aurora1 18s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '18%',
          right: '-12%',
          width: 'clamp(320px,38vw,560px)',
          height: 'clamp(320px,38vw,560px)',
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 68%)',
          filter: 'blur(56px)',
          animation: 'su-aurora2 22s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-12%',
          left: '30%',
          width: 'clamp(340px,40vw,600px)',
          height: 'clamp(340px,40vw,600px)',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 68%)',
          filter: 'blur(58px)',
          animation: 'su-aurora3 26s ease-in-out infinite',
        }}
      />

      {/* rising white particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            bottom: -10,
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `rgba(255,255,255,${p.opacity})`,
            boxShadow: `0 0 7px rgba(255,255,255,${Math.min(0.6, p.opacity + 0.12)})`,
            animation: `su-particle ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
