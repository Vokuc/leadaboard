import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  hideText?: boolean;
}

export default function Logo({ className = '', hideText = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 ${className}`}>
      <div className="relative flex-shrink-0 rounded-xl overflow-hidden border border-violet-500/40 shadow-[0_0_20px_rgba(168,85,247,0.35)] animate-pulse-glow group">
        <Image 
          src="/logo.jpg" 
          alt="LeaderboardOS" 
          width={40} 
          height={40} 
          className="w-7 h-7 sm:w-9 sm:h-9 object-cover transition-transform group-hover:scale-110 duration-500" 
          priority
        />
      </div>
      {!hideText && (
        <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-violet-100 to-neutral-400 bg-clip-text text-transparent">
          LeaderboardOS
        </span>
      )}
    </div>
  );
}
