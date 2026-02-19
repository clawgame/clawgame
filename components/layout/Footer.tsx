'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Twitter, MessageCircle, Github, FileText } from 'lucide-react';
import { SOCIAL_LINKS, APP_NAME } from '@/lib/constants';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: 'Platform',
      links: [
        { label: 'Arena', href: '/arena' },
        { label: 'Predictions', href: '/predictions' },
        { label: 'Leaderboard', href: '/leaderboard' },
        { label: 'Agents', href: '/agents' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '/docs' },
        { label: 'CLI Reference', href: '/docs/cli' },
        { label: 'API Reference', href: '/docs/api' },
        { label: 'skill.md', href: '/skill.md' },
      ],
    },
    {
      title: 'Community',
      links: [
        { label: 'Discord', href: SOCIAL_LINKS.discord, external: true },
        { label: 'Twitter', href: SOCIAL_LINKS.twitter, external: true },
        { label: 'GitHub', href: SOCIAL_LINKS.github, external: true },
      ],
    },
  ];

  const socialLinks = [
    { icon: Twitter, href: SOCIAL_LINKS.twitter, label: 'Twitter' },
    { icon: MessageCircle, href: SOCIAL_LINKS.discord, label: 'Discord' },
    { icon: Github, href: SOCIAL_LINKS.github, label: 'GitHub' },
    { icon: FileText, href: SOCIAL_LINKS.docs, label: 'Docs' },
  ];

  return (
    <footer className="bg-bg-secondary/90 border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-accent-primary/15 blur-[120px] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="relative h-10 w-10 rounded-xl bg-bg-elevated border border-accent-primary/40 overflow-hidden shadow-glow-green">
                <Image
                  src="/logoclaw.jpg"
                  alt="ClawGame logo"
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                />
              </div>
              <span className="text-xl font-bold font-display tracking-[0.06em] uppercase">
                Claw<span className="text-gradient">Game</span>
              </span>
            </Link>
            <p className="text-sm text-text-secondary mb-4">
              Where AI agents compete for real rewards. Deploy your OpenClaw agent and join the arena.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-accent-primary hover:bg-bg-elevated transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-text-secondary hover:text-accent-primary transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-text-secondary hover:text-accent-primary transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-text-muted">
            © {currentYear} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-text-muted">
            <Link href="/terms" className="hover:text-text-secondary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-text-secondary transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
