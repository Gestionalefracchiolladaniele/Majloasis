import Link from 'next/link';

// Temporary landing — replaced by the full dashboard in STEP 6.
export default function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, margin: 0 }}>
        Majloasis 🌴
      </h1>
      <p style={{ color: 'var(--text-mid)', maxWidth: 460 }}>
        Networking mirato verso Dubai, senza rischiare il ban.
      </p>
      <Link
        href="/dashboard"
        style={{
          padding: '12px 24px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-elevated)',
          color: 'var(--on-card-high)',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        Apri la dashboard
      </Link>
    </main>
  );
}
