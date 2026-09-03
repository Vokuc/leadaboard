import React from 'react';

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5 0-1.4-.5-2.5-1.5-3.5.3-.7.3-2.2-.2-3.5 0 0-1-.3-3.3 1.2a11.3 11.3 0 0 0-6 0C6 1.5 5 1.8 5 1.8c-.5 1.3-.5 2.8-.2 3.5C3.8 6.3 3.3 7.4 3.3 8.8c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"></path>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"></path>
    <path d="M14 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"></path>
    <path d="M15 19l-1-2c-1.4.3-2.6.3-4 0l-1 2-2.5-.5a15.7 15.7 0 0 1-3.6-7.8 7.3 7.3 0 0 1 3.6-5.4l1.2-1a13 13 0 0 1 7.6 0l1.2 1a7.3 7.3 0 0 1 3.6 5.4c-.1 2.8-1.4 5.5-3.6 7.8L15 19z"></path>
  </svg>
);

export default function SocialIcons() {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <a href="#" aria-label="Twitter" className="p-2 sm:p-2.5 rounded-xl bg-neutral-900/50 border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/10 text-neutral-400 hover:text-cyan-400 transition-all cursor-pointer group shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]">
        <TwitterIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform" />
      </a>
      <a href="#" aria-label="GitHub" className="p-2 sm:p-2.5 rounded-xl bg-neutral-900/50 border border-white/5 hover:border-violet-500/40 hover:bg-violet-500/10 text-neutral-400 hover:text-violet-400 transition-all cursor-pointer group shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]">
        <GithubIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform" />
      </a>
      <a href="#" aria-label="Discord / Community" className="p-2 sm:p-2.5 rounded-xl bg-neutral-900/50 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-neutral-400 hover:text-emerald-400 transition-all cursor-pointer group shadow-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]">
        <DiscordIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform" />
      </a>
    </div>
  );
}
