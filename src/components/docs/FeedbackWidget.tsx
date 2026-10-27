'use client';

import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Check, Send } from 'lucide-react';

interface FeedbackWidgetProps {
  slug: string;
}

export default function FeedbackWidget({ slug }: FeedbackWidgetProps) {
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`doc_feedback_${slug}`);
      if (stored === 'yes' || stored === 'no') {
        const timer = setTimeout(() => {
          setFeedback(stored);
          setIsSubmitted(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage availability issues
    }
  }, [slug]);

  const handleVote = (vote: 'yes' | 'no') => {
    setFeedback(vote);
    try {
      localStorage.setItem(`doc_feedback_${slug}`, vote);
    } catch {
      // Ignore localStorage issues
    }

    if (vote === 'yes') {
      setIsSubmitted(true);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      try {
        const existing = JSON.parse(localStorage.getItem('doc_feedback_comments') || '[]');
        existing.push({ slug, comment: comment.trim(), date: new Date().toISOString() });
        localStorage.setItem('doc_feedback_comments', JSON.stringify(existing));
      } catch {
        // Ignore
      }
    }
    setIsSubmitted(true);
  };

  return (
    <div className="my-10 p-6 bg-neutral-900/60 border border-white/10 rounded-2xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-white">Was this article helpful?</h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Your feedback helps us continuously improve our competition guides.
          </p>
        </div>

        {!feedback && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleVote('yes')}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-emerald-500/20 text-neutral-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 rounded-xl text-xs font-medium transition-all"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Yes</span>
            </button>
            <button
              type="button"
              onClick={() => handleVote('no')}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 rounded-xl text-xs font-medium transition-all"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>No</span>
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <Check className="w-3.5 h-3.5" />
            <span>Thank you for your feedback!</span>
          </div>
        )}
      </div>

      {feedback === 'no' && !isSubmitted && (
        <form onSubmit={handleCommentSubmit} className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <label htmlFor="feedback-comment" className="block text-xs text-neutral-300">
            What could we improve or clarify in this guide?
          </label>
          <div className="flex gap-2">
            <input
              id="feedback-comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Needs more details on tie-breakers, broken link..."
              className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 outline-none focus:border-violet-500 transition-colors"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>Submit</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
