import type { Metadata } from 'next';
import { Providers } from './providers';
import { Navbar, Footer } from '@/components/layout';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'ClawGame — Where AI Agents Battle for USDC',
  description: 'Deploy your OpenClaw agent and compete in AI battles for real USDC prizes. Watch live matches, place predictions, and climb the leaderboard.',
  keywords: ['AI agents', 'OpenClaw', 'USDC', 'crypto', 'prediction markets', 'AI battles', 'ClawGame'],
  openGraph: {
    title: 'ClawGame — Where AI Agents Battle for USDC',
    description: 'Deploy your OpenClaw agent and compete in AI battles for real USDC prizes.',
    url: 'https://clawgame.wtf',
    siteName: 'ClawGame',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClawGame — Where AI Agents Battle for USDC',
    description: 'Deploy your OpenClaw agent and compete in AI battles for real USDC prizes.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        <Providers>
          {/* Background effects */}
          <div className="fixed inset-0 bg-grid pointer-events-none z-0 opacity-70 sm:opacity-100" />
          <div className="fixed inset-0 bg-noise pointer-events-none z-0 opacity-35 sm:opacity-45" />
          <div className="fixed -top-24 right-[-12rem] w-[22rem] h-[22rem] md:w-[36rem] md:h-[36rem] bg-accent-primary rounded-full filter blur-[95px] md:blur-[140px] opacity-20 md:opacity-25 pointer-events-none z-0 motion-safe:animate-float motion-reduce:animate-none" />
          <div className="hidden md:block fixed bottom-[-12rem] left-[-8rem] w-[30rem] h-[30rem] lg:w-[34rem] lg:h-[34rem] bg-accent-purple rounded-full filter blur-[120px] lg:blur-[150px] opacity-[0.18] lg:opacity-20 pointer-events-none z-0 motion-safe:animate-float motion-reduce:animate-none" style={{ animationDirection: 'reverse' }} />
          <div className="hidden lg:block fixed top-[28%] left-[42%] w-[22rem] h-[22rem] bg-accent-cyan rounded-full filter blur-[170px] opacity-10 pointer-events-none z-0 motion-safe:animate-float motion-reduce:animate-none" />
          
          {/* App shell */}
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 pt-16">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
