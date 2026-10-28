'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  Trophy,
  RefreshCw,
  Megaphone,
  X,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';
import { CompetitionNotification, NotificationPreference, NotificationType } from '@/types';
import { CompetitionNotificationService } from '@/lib/competition/notifications/service';

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'registration_received':
    case 'registration_approved':
    case 'registration_waitlisted':
      return <Trophy className="w-4 h-4 text-violet-400" />;
    case 'registration_rejected':
      return <X className="w-4 h-4 text-red-400" />;
    case 'fixture_scheduled':
    case 'match_reminder':
      return <Calendar className="w-4 h-4 text-cyan-400" />;
    case 'match_rescheduled':
      return <RefreshCw className="w-4 h-4 text-amber-400" />;
    case 'result_updated':
      return <Trophy className="w-4 h-4 text-emerald-400" />;
    case 'competition_announcement':
      return <Megaphone className="w-4 h-4 text-pink-400" />;
    default:
      return <Bell className="w-4 h-4 text-neutral-400" />;
  }
}

export function NotificationBell() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<CompetitionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshData = useCallback(async () => {
    if (!profile) return;
    try {
      const [list, count, prefs] = await Promise.all([
        CompetitionNotificationService.getUserNotifications(profile.id),
        CompetitionNotificationService.getUnreadCount(profile.id),
        CompetitionNotificationService.getPreferences(profile.id),
      ]);
      setNotifications(list);
      setUnreadCount(count);
      setPreferences(prefs);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [profile]);

  useEffect(() => {
    let active = true;

    if (profile) {
      Promise.all([
        CompetitionNotificationService.getUserNotifications(profile.id),
        CompetitionNotificationService.getUnreadCount(profile.id),
        CompetitionNotificationService.getPreferences(profile.id),
      ])
        .then(([list, count, prefs]) => {
          if (active) {
            setNotifications(list);
            setUnreadCount(count);
            setPreferences(prefs);
          }
        })
        .catch((err) => {
          console.error('Failed to load notifications:', err);
        });
    }

    const interval = setInterval(() => {
      void refreshData();
    }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [profile, refreshData]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    if (!profile) return;
    try {
      await CompetitionNotificationService.markAsRead(id, profile.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, delivery_status: 'read', read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile) return;
    try {
      await CompetitionNotificationService.markAllAsRead(profile.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, delivery_status: 'read', read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      showToast('All notifications marked as read.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !preferences) return;
    setSavingPrefs(true);
    try {
      const updated = await CompetitionNotificationService.updatePreferences(profile.id, {
        in_app_opt_in: preferences.in_app_opt_in,
        email_opt_in: preferences.email_opt_in,
        match_reminders: preferences.match_reminders,
        result_updates: preferences.result_updates,
        announcements: preferences.announcements,
      });
      setPreferences(updated);
      setShowSettingsModal(false);
      showToast('Notification preferences saved.');
    } catch (err) {
      console.error(err);
      showToast('Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (!profile) {
    return null;
  }

  const displayedNotifications =
    activeTab === 'unread' ? notifications.filter((n) => !n.read_at) : notifications;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-3 rounded-xl bg-violet-950/90 border border-violet-500/30 text-violet-200 text-xs shadow-2xl animate-fade-in flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-violet-400" />
          {toastMessage}
        </div>
      )}

      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="relative p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-900/60 hover:bg-neutral-800 border border-white/5 hover:border-white/10 transition-all cursor-pointer focus:outline-none"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Drawer */}
      {isOpen && (
        <div className="absolute -right-2 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950/95 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  title="Mark all as read"
                  className="p-1 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="Notification Settings"
                className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-white/5 bg-neutral-900/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'unread' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5 custom-scrollbar">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs flex flex-col items-center gap-2">
                <Bell className="w-8 h-8 text-neutral-600 mb-1" />
                <span className="font-semibold text-neutral-400">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </span>
                <span className="text-[11px]">
                  {activeTab === 'unread' ? "You're all caught up! 🎉" : "You'll be alerted when match schedules, registrations, or results update."}
                </span>
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors flex items-start gap-3 hover:bg-white/[0.02] ${
                      isUnread ? 'bg-violet-950/15' : ''
                    }`}
                  >
                    <div className="mt-0.5 p-2 rounded-xl bg-neutral-900 border border-white/5 shrink-0">
                      {getNotificationIcon(n.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-neutral-300'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] text-neutral-500 shrink-0">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        {n.action_url && (
                          <Link
                            href={n.action_url}
                            onClick={() => {
                              if (isUnread) void handleMarkAsRead(n.id);
                              setIsOpen(false);
                            }}
                            className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                          >
                            View details <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => void handleMarkAsRead(n.id)}
                            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showSettingsModal && preferences && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-400" />
                <h3 className="font-bold text-sm text-white">Notification Preferences</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePreferences} className="mt-4 space-y-4 text-xs">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">In-App Notifications</div>
                    <div className="text-[11px] text-neutral-400">Receive alerts in your notification drawer</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.in_app_opt_in}
                    onChange={(e) => setPreferences({ ...preferences, in_app_opt_in: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">Match & Fixture Reminders</div>
                    <div className="text-[11px] text-neutral-400">Alerts when matches are scheduled or rescheduled</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.match_reminders}
                    onChange={(e) => setPreferences({ ...preferences, match_reminders: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">Result & Standing Updates</div>
                    <div className="text-[11px] text-neutral-400">Alerts when scores and table rankings are posted</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.result_updates}
                    onChange={(e) => setPreferences({ ...preferences, result_updates: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">Competition Announcements</div>
                    <div className="text-[11px] text-neutral-400">Broadcasts and operational updates from organizers</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.announcements}
                    onChange={(e) => setPreferences({ ...preferences, announcements: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                  <div>
                    <div className="font-semibold text-white">Email Delivery (When configured)</div>
                    <div className="text-[11px] text-neutral-400">Receive email notifications if an external mail transport is set up</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.email_opt_in}
                    onChange={(e) => setPreferences({ ...preferences, email_opt_in: e.target.checked })}
                    className="w-4 h-4 accent-violet-600 rounded"
                  />
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-white"
                >
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
