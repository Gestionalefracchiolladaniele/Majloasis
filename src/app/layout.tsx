import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import { AuroraBackground } from '@/components/AuroraBackground';
import './globals.css';

// Font self-hosted via next/font (ottimizzato, niente <link> esterni).
// Le CSS variables --font-inter / --font-sora sono usate dai token in globals.css.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});
const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Majloasis 🌴',
  description: 'Networking mirato verso Dubai — senza rischiare il ban.',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <AuroraBackground />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
