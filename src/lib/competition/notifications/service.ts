'use client';

import { isSupabaseConfigured, supabase } from '@/lib/db';
import {
  CompetitionNotification,
  NotificationDeliveryStatus,
  NotificationPreference,
  NotificationType,
} from '@/types';

const NOTIFICATIONS_STORAGE_KEY = 'competition_notifications';
const PREFERENCES_STORAGE_KEY = 'notification_preferences';

const inMemoryStore = new Map<string, string>();

function getStorageBackend() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

function localGet<T>(key: string, defaults: T): T {
  const backend = getStorageBackend();
  let value: string | null = null;
  if (backend) {
    value = backend.getItem(`leaderboardos_${key}`);
  } else {
    value = inMemoryStore.get(`leaderboardos_${key}`) || null;
  }

  if (!value) {
    localSet(key, defaults);
    return defaults;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaults;
  }
}

function localSet<T>(key: string, value: T): void {
  const backend = getStorageBackend();
  const serialized = JSON.stringify(value);
  if (backend) {
    backend.setItem(`leaderboardos_${key}`, serialized);
  } else {
    inMemoryStore.set(`leaderboardos_${key}`, serialized);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SendNotificationInput {
  leaderboard_id?: string | null;
  user_id: string;
  recipient_email?: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  action_url?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
}

export const CompetitionNotificationService = {
  /**
   * Fetch notification preferences for a user, optionally scoped to a competition.
   */
  async getPreferences(userId: string, leaderboardId?: string | null): Promise<NotificationPreference> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId);

      if (leaderboardId) {
        query = query.eq('leaderboard_id', leaderboardId);
      } else {
        query = query.is('leaderboard_id', null);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return data as NotificationPreference;
      }
    } else {
      const allPrefs = localGet<NotificationPreference[]>(PREFERENCES_STORAGE_KEY, []);
      const found = allPrefs.find(
        (p) => p.user_id === userId && (leaderboardId ? p.leaderboard_id === leaderboardId : !p.leaderboard_id)
      );
      if (found) return found;
    }

    // Default preferences if none set
    return {
      id: `pref-${userId}`,
      user_id: userId,
      leaderboard_id: leaderboardId || null,
      email_opt_in: true,
      in_app_opt_in: true,
      match_reminders: true,
      result_updates: true,
      announcements: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
  },

  /**
   * Update notification preferences for a user.
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
    leaderboardId?: string | null
  ): Promise<NotificationPreference> {
    const existing = await this.getPreferences(userId, leaderboardId);
    const updated: NotificationPreference = {
      ...existing,
      ...updates,
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: userId,
            leaderboard_id: leaderboardId || null,
            email_opt_in: updated.email_opt_in,
            in_app_opt_in: updated.in_app_opt_in,
            match_reminders: updated.match_reminders,
            result_updates: updated.result_updates,
            announcements: updated.announcements,
            updated_at: updated.updated_at,
          },
          { onConflict: 'user_id,leaderboard_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as NotificationPreference;
    }

    const allPrefs = localGet<NotificationPreference[]>(PREFERENCES_STORAGE_KEY, []);
    const filtered = allPrefs.filter(
      (p) => !(p.user_id === userId && (leaderboardId ? p.leaderboard_id === leaderboardId : !p.leaderboard_id))
    );
    localSet(PREFERENCES_STORAGE_KEY, [...filtered, updated]);
    return updated;
  },

  /**
   * Check if a notification type is allowed by user preferences.
   */
  isNotificationAllowed(prefs: NotificationPreference, type: NotificationType): boolean {
    if (!prefs.in_app_opt_in) return false;
    if (type === 'match_reminder' && !prefs.match_reminders) return false;
    if (type === 'result_updated' && !prefs.result_updates) return false;
    if (type === 'competition_announcement' && !prefs.announcements) return false;
    return true;
  },

  /**
   * Send a notification safely, respecting user opt-outs and preventing accidental duplicate sends.
   */
  async sendNotification(input: SendNotificationInput): Promise<CompetitionNotification | null> {
    const {
      leaderboard_id,
      user_id,
      recipient_email,
      notification_type,
      title,
      message,
      action_url,
      idempotency_key,
      metadata = {},
    } = input;

    // 1. Check user preferences for opt-outs
    const prefs = await this.getPreferences(user_id, leaderboard_id);
    if (!this.isNotificationAllowed(prefs, notification_type)) {
      return null;
    }

    // 2. Check idempotency to prevent duplicate sends
    if (idempotency_key) {
      if (isSupabaseConfigured && supabase) {
        const { data: existing } = await supabase
          .from('competition_notifications')
          .select('*')
          .eq('idempotency_key', idempotency_key)
          .maybeSingle();

        if (existing) {
          return existing as CompetitionNotification;
        }
      } else {
        const all = localGet<CompetitionNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
        const existing = all.find((n) => n.idempotency_key === idempotency_key);
        if (existing) {
          return existing;
        }
      }
    }

    // 3. Delivery status resolution (In-app delivery + external email check)
    // If an external email provider is configured, it would be dispatched here.
    // If none is configured, safe in-app delivery is active and documented.
    const delivery_status: NotificationDeliveryStatus = 'delivered';

    const newNotification: CompetitionNotification = {
      id: makeUuid(),
      leaderboard_id: leaderboard_id || null,
      user_id,
      recipient_email: recipient_email || null,
      notification_type,
      title,
      message,
      action_url: action_url || null,
      delivery_status,
      idempotency_key: idempotency_key || null,
      read_at: null,
      metadata,
      created_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_notifications')
        .insert({
          id: newNotification.id,
          leaderboard_id: newNotification.leaderboard_id,
          user_id: newNotification.user_id,
          recipient_email: newNotification.recipient_email,
          notification_type: newNotification.notification_type,
          title: newNotification.title,
          message: newNotification.message,
          action_url: newNotification.action_url,
          delivery_status: newNotification.delivery_status,
          idempotency_key: newNotification.idempotency_key,
          metadata: newNotification.metadata,
          created_at: newNotification.created_at,
        })
        .select()
        .single();

      if (error) {
        // If conflict on idempotency_key due to concurrent insert, return existing
        if (error.code === '23505' && idempotency_key) {
          const { data: existing } = await supabase
            .from('competition_notifications')
            .select('*')
            .eq('idempotency_key', idempotency_key)
            .maybeSingle();
          if (existing) return existing as CompetitionNotification;
        }
        throw error;
      }
      const result = data as CompetitionNotification;
      this.dispatchExternalEmail(recipient_email, prefs.email_opt_in, title, message, action_url);
      return result;
    }

    const all = localGet<CompetitionNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
    localSet(NOTIFICATIONS_STORAGE_KEY, [newNotification, ...all]);
    this.dispatchExternalEmail(recipient_email, prefs.email_opt_in, title, message, action_url);
    return newNotification;
  },

  /**
   * Helper to dispatch external email asynchronously without blocking.
   */
  dispatchExternalEmail(
    recipientEmail?: string | null,
    optIn?: boolean,
    title?: string,
    message?: string,
    actionUrl?: string | null
  ) {
    if (!recipientEmail || optIn === false || !title || !message) return;
    if (typeof window !== 'undefined') {
      void fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          title,
          message,
          action_url: actionUrl,
        }),
      }).catch((err) => {
        console.warn('External email dispatch skipped or failed:', err);
      });
    }
  },

  /**
   * Retrieve in-app notifications for a user.
   */
  async getUserNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<CompetitionNotification[]> {
    const limit = options?.limit || 50;

    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('competition_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options?.unreadOnly) {
        query = query.is('read_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CompetitionNotification[];
    }

    const all = localGet<CompetitionNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
    let filtered = all.filter((n) => n.user_id === userId);
    if (options?.unreadOnly) {
      filtered = filtered.filter((n) => !n.read_at);
    }
    return filtered
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (isSupabaseConfigured && supabase) {
      const { count, error } = await supabase
        .from('competition_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) return 0;
      return count || 0;
    }

    const all = localGet<CompetitionNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
    return all.filter((n) => n.user_id === userId && !n.read_at).length;
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const readAt = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('competition_notifications')
        .update({
          delivery_status: 'read',
          read_at: readAt,
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      return;
    }

    const all = localGet<CompetitionNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
    const updated = all.map((n) =>
      n.id === notificationId && n.user_id === userId
        ? { ...n, delivery_status: 'read' as NotificationDeliveryStatus, read_at: readAt }
        : n
    );
    localSet(NOTIFICATIONS_STORAGE_KEY, updated);
  },

  /**
   * Mark all notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<void> {
    const readAt = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('competition_notifications')
        .update({
          delivery_status: 'read',
          read_at: readAt,
        })
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) throw error;
      return;
    }

    const all = localGet<CompetitionNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
    const updated = all.map((n) =>
      n.user_id === userId && !n.read_at
        ? { ...n, delivery_status: 'read' as NotificationDeliveryStatus, read_at: readAt }
        : n
    );
    localSet(NOTIFICATIONS_STORAGE_KEY, updated);
  },

  /**
   * Helper to dispatch registration status notification.
   */
  async notifyRegistrationStatus(params: {
    leaderboard_id: string;
    competitionName: string;
    user_id: string;
    participant_email?: string;
    status: 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'confirmed';
    reason?: string | null;
    slug: string;
  }): Promise<void> {
    const { leaderboard_id, competitionName, user_id, participant_email, status, reason, slug } = params;

    const titles: Record<string, string> = {
      pending: 'Registration Received',
      approved: 'Registration Approved! 🎉',
      rejected: 'Registration Update',
      waitlisted: 'Added to Competition Waitlist ⏳',
      confirmed: 'Registration Confirmed! 🏆',
    };

    const messages: Record<string, string> = {
      pending: `Your registration for "${competitionName}" has been received and is pending organizer review.`,
      approved: `Congratulations! Your registration for "${competitionName}" was approved. You are on the roster.`,
      rejected: `Your registration for "${competitionName}" could not be accepted${reason ? `: ${reason}` : '.'}`,
      waitlisted: `"${competitionName}" is currently at capacity. You have been placed on the priority waitlist.`,
      confirmed: `Your entry for "${competitionName}" is officially confirmed and ready for match play.`,
    };

    const typeMap: Record<string, NotificationType> = {
      pending: 'registration_received',
      approved: 'registration_approved',
      rejected: 'registration_rejected',
      waitlisted: 'registration_waitlisted',
      confirmed: 'registration_approved',
    };

    await this.sendNotification({
      leaderboard_id,
      user_id,
      recipient_email: participant_email,
      notification_type: typeMap[status] || 'registration_received',
      title: titles[status] || 'Registration Update',
      message: messages[status] || `Your registration status is now: ${status}`,
      action_url: `/leaderboards/${slug}`,
      idempotency_key: `reg-status-${leaderboard_id}-${user_id}-${status}-${nowIso().slice(0, 10)}`,
      metadata: { status, reason },
    });
  },

  /**
   * Helper to notify participants of a scheduled or rescheduled fixture.
   */
  async notifyFixtureScheduled(params: {
    leaderboard_id: string;
    competitionName: string;
    userIds: string[];
    fixtureTitle: string;
    scheduledAt: string;
    venueName?: string | null;
    isReschedule?: boolean;
    slug: string;
  }): Promise<void> {
    const {
      leaderboard_id,
      competitionName,
      userIds,
      fixtureTitle,
      scheduledAt,
      venueName,
      isReschedule,
      slug,
    } = params;

    const formattedDate = new Date(scheduledAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const venuePart = venueName ? ` at ${venueName}` : '';
    const title = isReschedule ? 'Fixture Rescheduled 🔄' : 'New Match Scheduled 📅';
    const message = isReschedule
      ? `Fixture "${fixtureTitle}" in "${competitionName}" has been rescheduled to ${formattedDate}${venuePart}.`
      : `Your match "${fixtureTitle}" in "${competitionName}" is scheduled for ${formattedDate}${venuePart}.`;

    for (const uid of userIds) {
      if (!uid) continue;
      await this.sendNotification({
        leaderboard_id,
        user_id: uid,
        notification_type: isReschedule ? 'match_rescheduled' : 'fixture_scheduled',
        title,
        message,
        action_url: `/leaderboards/${slug}`,
        idempotency_key: `fixture-${leaderboard_id}-${fixtureTitle}-${scheduledAt}-${uid}`,
        metadata: { scheduledAt, venueName },
      });
    }
  },

  /**
   * Helper to notify participants of an updated score or result.
   */
  async notifyResultUpdated(params: {
    leaderboard_id: string;
    competitionName: string;
    userIds: string[];
    matchTitle: string;
    scoreSummary: string;
    slug: string;
  }): Promise<void> {
    const { leaderboard_id, competitionName, userIds, matchTitle, scoreSummary, slug } = params;

    for (const uid of userIds) {
      if (!uid) continue;
      await this.sendNotification({
        leaderboard_id,
        user_id: uid,
        notification_type: 'result_updated',
        title: 'Match Result Recorded 📊',
        message: `Result posted for "${matchTitle}" (${scoreSummary}) in "${competitionName}".`,
        action_url: `/leaderboards/${slug}`,
        idempotency_key: `result-${leaderboard_id}-${matchTitle}-${scoreSummary}-${uid}`,
        metadata: { matchTitle, scoreSummary },
      });
    }
  },

  /**
   * Helper to broadcast a posted result for an event/match.
   */
  async notifyResultPosted(params: {
    leaderboard_id: string;
    competitionName: string;
    matchTitle: string;
    scoreSummary: string;
    slug: string;
    userIds?: string[];
  }): Promise<void> {
    const { leaderboard_id, competitionName, matchTitle, scoreSummary, slug, userIds } = params;
    const targetUsers = userIds && userIds.length > 0 ? userIds : [];
    if (targetUsers.length > 0) {
      await this.notifyResultUpdated({
        leaderboard_id,
        competitionName,
        userIds: targetUsers,
        matchTitle,
        scoreSummary,
        slug,
      });
    }
  },
};
