import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'World Cup 2026 · Arbitrage Terminal',
  description:
    'Aggregates prediction markets, exchanges and sportsbooks for the FIFA World Cup, normalizes prices, and surfaces cross-platform arbitrage windows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts loaded at runtime (no build-time fetch); falls back to system
            fonts gracefully if offline. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
