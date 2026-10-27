'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Calendar,
  Sliders,
  Bell,
  Workflow,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Bot,
  User,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AiChatMessage, AiTaskType, Leaderboard } from '@/types';

interface AiAssistantPanelProps {
  leaderboard: Leaderboard;
}

const QUICK_PROMPTS = [
  'Explain why the leader is ranked #1',
  'Summarize recent match results',
  'What fixtures are outstanding?',
  'Give me a registration and attendance summary',
  'Draft a Matchday broadcast announcement',
];

const GUIDED_TASKS: Array<{ type: AiTaskType; label: string; icon: React.ElementType }> = [
  { type: 'schedule_draft', label: 'Draft Schedule', icon: Calendar },
  { type: 'points_rules_draft', label: 'Draft Scoring Rules', icon: Sliders },
  { type: 'announcement_draft', label: 'Draft Announcement', icon: Bell },
  { type: 'pathway_proposal', label: 'Playoff Pathway', icon: Workflow },
  { type: 'venue_setup', label: 'Configure Venue', icon: MapPin },
];

let nextMessageSeq = 0;
function buildChatMessage(
  role: 'user' | 'assistant',
  content: string,
  proposal?: import('@/types').AiActionProposal,
  dataSources?: string[]
): AiChatMessage {
  nextMessageSeq += 1;
  return {
    id: `msg_seq_${nextMessageSeq}`,
    role,
    content,
    proposal,
    created_at: '2026-11-03T00:00:00.000Z',
    data_sources_used: dataSources,
  };
}

export default function AiAssistantPanel({ leaderboard }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your **AI Competition Manager** for **${leaderboard.name}**. I am grounded directly in your competition's official standings, schedule, rules, and participant data.\n\nAsk me any question or choose a guided task below. Consequential changes will always generate a preview proposal requiring your explicit confirmation.`,
      created_at: '2026-11-03T00:00:00.000Z',
      data_sources_used: ['competition_engine'],
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(null), 5000);
    } else {
      setSuccessToast(msg);
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  const handleSendMessage = React.useCallback(
    async (customPrompt?: string, taskType?: AiTaskType) => {
      const textToSend = customPrompt !== undefined ? customPrompt : inputPrompt;
      if (!textToSend.trim() && !taskType) return;

      const userMessage = buildChatMessage(
        'user',
        textToSend.trim() || `Generate proposal for ${taskType?.replace('_', ' ')}`
      );

      setMessages((prev) => [...prev, userMessage]);
      setInputPrompt('');
      setLoading(true);

      try {
        const res = await fetch(`/api/competitions/${leaderboard.id}/assistant/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage.content,
            history: messages.slice(-4),
            taskType,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to get response from AI assistant.');
        }

        const assistantMessage = buildChatMessage(
          'assistant',
          data.result.content,
          data.result.proposal,
          data.result.dataSources
        );

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'An error occurred.';
        showToast(msg, true);
      } finally {
        setLoading(false);
      }
    },
    [inputPrompt, leaderboard.id, messages]
  );

  const handleProposalAction = async (proposalId: string, action: 'confirm' | 'reject') => {
    setActionLoadingId(proposalId);
    try {
      const res = await fetch(
        `/api/competitions/${leaderboard.id}/assistant/proposals/${proposalId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} proposal.`);
      }

      // Update message state locally
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.proposal?.id === proposalId) {
            return {
              ...msg,
              proposal: {
                ...msg.proposal,
                status: action === 'confirm' ? 'approved' : 'rejected',
                applied_at: action === 'confirm' ? new Date().toISOString() : undefined,
              },
            };
          }
          return msg;
        })
      );

      showToast(
        action === 'confirm'
          ? data.execution?.message || 'Proposal confirmed and applied successfully!'
          : 'Proposal declined.',
        false
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action error.';
      showToast(msg, true);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {errorToast && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 bg-red-500/10 border-red-500/30 text-red-400">
          <AlertTriangle className="w-4 h-4" />
          {errorToast}
        </div>
      )}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          {successToast}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass p-6 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/20 via-neutral-900 to-black flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
            AI Competition Manager
          </div>
          <h2 className="text-xl font-bold text-white">Grounded Competition Assistant</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Ask questions about real standings, rules, and match results. Trigger guided proposals
            with instant previews and full authorization controls.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-neutral-400 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-white/5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Grounded in official engine data</span>
        </div>
      </div>

      {/* Guided Tasks Quick Actions */}
      <div className="glass p-4 rounded-2xl border border-white/5 space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Guided Generation Workflows
        </div>
        <div className="flex flex-wrap gap-2">
          {GUIDED_TASKS.map((task) => {
            const Icon = task.icon;
            return (
              <button
                key={task.type}
                onClick={() => handleSendMessage('', task.type)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900/90 hover:bg-violet-600/20 hover:border-violet-500/40 border border-white/10 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                <Icon className="w-3.5 h-3.5 text-violet-400" />
                {task.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="glass rounded-2xl border border-white/5 p-4 md:p-6 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs md:text-sm ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 space-y-3 ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-none'
                  : 'bg-neutral-900/90 border border-white/10 text-neutral-200 rounded-tl-none'
              }`}
            >
              <div className="prose prose-invert prose-xs max-w-none leading-relaxed">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>

              {/* Data sources used badge */}
              {msg.data_sources_used && msg.data_sources_used.length > 0 && (
                <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5 items-center text-[10px] text-neutral-400">
                  <span className="font-semibold text-neutral-500">Verified sources:</span>
                  {msg.data_sources_used.map((ds) => (
                    <span
                      key={ds}
                      className="px-2 py-0.5 rounded bg-black/40 border border-white/5 font-mono text-[9px]"
                    >
                      {ds}
                    </span>
                  ))}
                </div>
              )}

              {/* Proposal Card Preview */}
              {msg.proposal && (
                <div className="mt-3 p-4 rounded-xl bg-black/50 border border-violet-500/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      {msg.proposal.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        msg.proposal.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : msg.proposal.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {msg.proposal.status}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300">{msg.proposal.summary}</p>

                  {/* Structured Payload Diff */}
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-white/5 text-[11px] font-mono text-neutral-300 overflow-x-auto">
                    <pre>{JSON.stringify(msg.proposal.payload, null, 2)}</pre>
                  </div>

                  {/* Validation errors warning */}
                  {msg.proposal.validation_errors && msg.proposal.validation_errors.length > 0 && (
                    <div className="p-2 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" /> Validation warnings:
                      </div>
                      {msg.proposal.validation_errors.map((e, idx) => (
                        <div key={idx}>• {e}</div>
                      ))}
                    </div>
                  )}

                  {/* Actions for pending proposals */}
                  {msg.proposal.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleProposalAction(msg.proposal!.id, 'confirm')}
                        disabled={actionLoadingId === msg.proposal.id}
                        className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg text-white text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {actionLoadingId === msg.proposal.id ? 'Applying...' : 'Review & Confirm'}
                      </button>
                      <button
                        onClick={() => handleProposalAction(msg.proposal!.id, 'reject')}
                        disabled={actionLoadingId === msg.proposal.id}
                        className="py-1.5 px-3 bg-neutral-800 hover:bg-red-950/40 hover:text-red-400 border border-white/10 font-semibold rounded-lg text-neutral-300 text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  )}

                  {msg.proposal.status === 'approved' && (
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Successfully committed into competition engine.
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-white flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 text-xs items-center text-neutral-400 animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Bot className="w-4 h-4" />
            </div>
            <span>Evaluating official competition data...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white hover:border-violet-500/40 transition-all cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder={`Ask anything about ${leaderboard.name} or request a draft...`}
          disabled={loading}
          className="flex-1 bg-neutral-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={loading || !inputPrompt.trim()}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
}
