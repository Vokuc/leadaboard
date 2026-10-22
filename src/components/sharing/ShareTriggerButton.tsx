'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ShareUrlOptions } from '@/lib/sharing/service';
import { ShareResultModal } from './ShareResultModal';

interface ShareTriggerButtonProps {
  options: ShareUrlOptions;
  label?: string;
  size?: 'sm' | 'md' | 'icon';
  variant?: 'subtle' | 'outline' | 'solid' | 'ghost';
  className?: string;
  title?: string;
}

export const ShareTriggerButton: React.FC<ShareTriggerButtonProps> = ({
  options,
  label,
  size = 'md',
  variant = 'outline',
  className = '',
  title = 'Share verified result',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  let sizeStyles = 'px-3 py-1.5 text-xs gap-1.5';
  if (size === 'sm') sizeStyles = 'px-2 py-1 text-[11px] gap-1';
  if (size === 'icon') sizeStyles = 'p-1.5 text-xs';

  let variantStyles = 'border border-white/10 bg-neutral-900/60 hover:bg-neutral-850 hover:border-white/20 text-neutral-300 hover:text-white';
  if (variant === 'subtle') variantStyles = 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border-transparent';
  if (variant === 'solid') variantStyles = 'bg-violet-600 hover:bg-violet-500 text-white font-bold border-transparent shadow-lg shadow-violet-600/20';
  if (variant === 'ghost') variantStyles = 'hover:bg-white/5 text-neutral-400 hover:text-white border-transparent';

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={title}
        aria-label={label || title}
        className={`inline-flex items-center justify-center font-medium rounded-xl transition cursor-pointer shrink-0 ${sizeStyles} ${variantStyles} ${className}`}
      >
        <Share2 className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label && <span>{label}</span>}
      </button>

      {isOpen && (
        <ShareResultModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          options={options}
        />
      )}
    </>
  );
};
