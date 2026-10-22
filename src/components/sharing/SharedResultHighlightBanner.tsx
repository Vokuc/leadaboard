'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Trophy, Share2, X, Swords, Crown, ShieldCheck } from 'lucide-react';
import { getAuthoritativeShareData, type ShareableResultPayload, type ShareType } from '@/lib/sharing/service';
import { ShareResultModal } from './ShareResultModal';

interface SharedResultHighlightBannerProps {
  slug?: string;
  handle?: string;
}

export const SharedResultHighlightBanner: React.FC<SharedResultHighlightBannerProps> = ({ slug, handle }) => {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<ShareableResultPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const shareType = searchParams.get('share') as ShareType | null;
  const memberId = searchParams.get('member') || undefined;
  const matchId = searchParams.get('match') || undefined;
  const fixtureId = searchParams.get('fixture') || undefined;
  const achievementId = searchParams.get('id') || searchParams.get('achievement') || undefined;
  const version = searchParams.get('v') || undefined;

  useEffect(() => {
    let active = true;

    async function loadSharedItem() {
      if (!shareType) return;

      try {
        if (handle && shareType === 'achievement') {
          const data = await getAuthoritativeShareData({
            type: 'achievement',
            handle,
            achievementId,
            version,
          });
          if (active && data && !data.isPrivate) {
            setPayload(data);
          }
          return;
        }

        if (slug && ['placement', 'champion', 'match', 'bracket', 'competition'].includes(shareType)) {
          const data = await getAuthoritativeShareData({
            type: shareType,
            slug,
            memberId,
            matchId,
            fixtureId,
            version,
          });

          if (active && data && !data.isPrivate) {
            setPayload(data);
          }
        }
      } catch (err) {
        console.error('Failed to load shared result:', err);
      }
    }

    void loadSharedItem();

    return () => {
      active = false;
    };
  }, [shareType, slug, handle, memberId, matchId, fixtureId, achievementId, version]);

  if (!payload || dismissed) return null;

  return (
    <>
      <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/60 via-neutral-900/80 to-violet-950/60 border border-violet-500/30 text-white relative shadow-xl overflow-hidden mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
              {payload.type === 'champion' ? (
                <Crown className="w-5 h-5 text-amber-400" />
              ) : payload.type === 'match' ? (
                <Swords className="w-5 h-5 text-cyan-400" />
              ) : (
                <Trophy className="w-5 h-5 text-violet-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-violet-300">
                  Shared Verified Result
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  Official
                </span>
              </div>
              <h4 className="text-sm font-bold text-white leading-tight">
                {payload.title}
              </h4>
              <p className="text-xs text-neutral-400">
                {payload.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white transition shadow-md shadow-violet-600/20 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Card</span>
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ShareResultModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          options={{
            type: payload.type,
            slug,
            handle,
            memberId,
            matchId,
            fixtureId,
            achievementId,
            version,
          }}
          preloadedPayload={payload}
        />
      )}
    </>
  );
};
