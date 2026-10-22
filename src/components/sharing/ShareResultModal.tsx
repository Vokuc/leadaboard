'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Trophy,
  Crown,
  Swords,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import {
  buildSocialShareIntents,
  getAuthoritativeShareData,
  type ShareableResultPayload,
  type ShareUrlOptions,
} from '@/lib/sharing/service';

interface ShareResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ShareUrlOptions;
  preloadedPayload?: ShareableResultPayload | null;
}

export const ShareResultModal: React.FC<ShareResultModalProps> = ({
  isOpen,
  onClose,
  options,
  preloadedPayload,
}) => {
  const [payload, setPayload] = useState<ShareableResultPayload | null>(preloadedPayload || null);
  const [loading, setLoading] = useState(!preloadedPayload);
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (preloadedPayload) {
        setPayload(preloadedPayload);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getAuthoritativeShareData(options);
        if (active) {
          setPayload(data);
        }
      } catch (err) {
        console.error('Failed to resolve share payload:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (isOpen) {
      void loadData();
    }

    return () => {
      active = false;
    };
  }, [isOpen, options, preloadedPayload]);

  const shareIntents = useMemo(() => {
    if (!payload) return null;
    return buildSocialShareIntents(payload);
  }, [payload]);

  // QR Code Rendering
  useEffect(() => {
    if (isOpen && qrCanvasRef.current && payload?.canonicalUrl) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        payload.canonicalUrl,
        {
          width: 140,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('QR Render err:', err);
        }
      );
    }
  }, [isOpen, payload?.canonicalUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (!payload?.canonicalUrl) return;
    try {
      await navigator.clipboard.writeText(payload.canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (!payload || !navigator.share) return;
    try {
      await navigator.share({
        title: `${payload.title} | LeaderboardOS`,
        text: shareIntents?.copyText || `${payload.title} on LeaderboardOS`,
        url: payload.canonicalUrl,
      });
    } catch (err: unknown) {
      // User cancelled or aborted, safe to ignore
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Native share failed:', err);
      }
    }
  };

  const handleCopyEmbed = () => {
    if (!payload) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://leaderboardos.com';
    const embedUrl = options.slug ? `${origin}/embed/${options.slug}?theme=dark` : payload.canonicalUrl;
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="450" frameborder="0" style="border-radius: 16px; overflow: hidden; max-width: 640px; margin: 0 auto; display: block;" title="${payload.title}"></iframe>`;
    void navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative glass-premium max-w-xl w-full p-6 sm:p-7 rounded-3xl shadow-2xl border border-white/10 glow-primary z-10 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition cursor-pointer"
          aria-label="Close share dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Share Competition Result
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                Official
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Verified competitive results link back directly to LeaderboardOS.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-neutral-400 flex flex-col items-center gap-3">
            <Trophy className="w-8 h-8 text-violet-500 animate-bounce" />
            <span>Generating authoritative share card...</span>
          </div>
        ) : !payload ? (
          <div className="py-12 text-center text-sm text-neutral-400">
            Unable to load share card for this selection.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visual Share Card Preview */}
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900/90 via-neutral-950 to-black p-5 sm:p-6 overflow-hidden shadow-2xl">
              {/* Radial glow background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Card Header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    LeaderboardOS
                  </span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider truncate max-w-[200px]">
                    {payload.competitionName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{payload.verificationBadgeText || 'Verified'}</span>
                </div>
              </div>

              {/* Card Main Body */}
              <div className="flex items-center gap-4 py-2">
                {payload.type === 'champion' ? (
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                    <Crown className="w-8 h-8 animate-pulse" />
                  </div>
                ) : payload.type === 'match' ? (
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                    <Swords className="w-8 h-8" />
                  </div>
                ) : payload.type === 'achievement' ? (
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-3xl shrink-0">
                    {payload.badgeIcon || '🏆'}
                  </div>
                ) : (
                  <div className="relative shrink-0">
                    <SafeImage
                      src={
                        payload.avatarUrl ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(payload.actorName)}`
                      }
                      alt={payload.actorName}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-2xl border-2 border-violet-500/40 object-cover"
                    />
                    {payload.rank && (
                      <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-violet-600 border border-violet-400 text-[10px] font-black text-white">
                        #{payload.rank}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-lg sm:text-xl text-white truncate">
                      {payload.title}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                    {payload.subtitle}
                  </p>
                  {payload.detailScore && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono font-bold text-violet-300">
                      <span>{payload.detailScore}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500">
                <span>Real-time authoritative sync</span>
                <span>leaderboardos.com</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold text-xs text-white transition shadow-lg shadow-violet-600/20 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Public Share Link'}</span>
              </button>

              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl font-bold text-xs text-white transition cursor-pointer"
                  title="Open system share sheet"
                >
                  <Send className="w-4 h-4" />
                  <span>Share...</span>
                </button>
              )}
            </div>

            {/* Social Platform Direct Intent Links */}
            <div>
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Share Directly to Platform</span>
                <span className="text-[10px] text-neutral-500 font-normal">Opens official web composer</span>
              </div>

              {shareIntents && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {/* WhatsApp */}
                  <a
                    href={shareIntents.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-semibold transition hover:scale-[1.02]"
                  >
                    <span className="text-lg mb-1">💬</span>
                    <span>WhatsApp</span>
                  </a>

                  {/* X / Twitter */}
                  <a
                    href={shareIntents.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-white/10 text-neutral-200 text-xs font-semibold transition hover:scale-[1.02]"
                  >
                    <span className="text-lg mb-1">𝕏</span>
                    <span>X / Twitter</span>
                  </a>

                  {/* LinkedIn */}
                  <a
                    href={shareIntents.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 text-xs font-semibold transition hover:scale-[1.02]"
                  >
                    <span className="text-lg mb-1">💼</span>
                    <span>LinkedIn</span>
                  </a>

                  {/* Facebook */}
                  <a
                    href={shareIntents.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-xs font-semibold transition hover:scale-[1.02]"
                  >
                    <span className="text-lg mb-1">📘</span>
                    <span>Facebook</span>
                  </a>

                  {/* Telegram */}
                  <a
                    href={shareIntents.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-xs font-semibold transition hover:scale-[1.02]"
                  >
                    <span className="text-lg mb-1">✈️</span>
                    <span>Telegram</span>
                  </a>
                </div>
              )}
            </div>

            {/* QR Code & Embed Section */}
            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 bg-white rounded-xl shadow-inner border border-neutral-200 shrink-0">
                <canvas ref={qrCanvasRef} />
              </div>

              <div className="flex-1 w-full space-y-2 text-xs">
                <div className="text-neutral-400 font-medium">
                  Scan QR code with a phone camera to jump directly to this verified competition record.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyEmbed}
                    className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{embedCopied ? 'Embed Code Copied!' : 'Copy Embed HTML'}</span>
                  </button>
                  <a
                    href={payload.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Link</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Transparency / Privacy Note */}
            <p className="text-[10px] text-neutral-500 text-center leading-relaxed">
              Social share links use standard browser intents with pre-formatted summaries. LeaderboardOS does not request social account credentials or post without your explicit action.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
