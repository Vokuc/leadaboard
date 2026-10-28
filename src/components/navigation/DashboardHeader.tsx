'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Trophy,
  Building2,
  BarChart3,
  Shield,
  CreditCard,
  Code,
  Users,
  LogOut,
  Menu,
  X,
  BookOpen,
  LayoutDashboard,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Profile } from '@/types';

interface DashboardHeaderProps {
  profile: Profile | null;
  canOpenAdminPages: boolean;
  onLogout: () => void | Promise<void>;
}

export default function DashboardHeader({
  profile,
  canOpenAdminPages,
  onLogout,
}: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    queueMicrotask(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(path);
  };

  return (
    <>
      <header className="glass border-b border-white/5 py-3.5 px-4 sm:px-6 md:px-12 flex justify-between items-center sticky top-0 z-40 max-w-[100vw]">
        {/* Brand Logo & Console Tag */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Trophy className="w-5 h-5 text-violet-500 shrink-0" />
            <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent truncate">
              LeaderboardOS
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-neutral-900 border-neutral-800 text-neutral-400 shrink-0">
            Console
          </span>
        </div>

        {/* Desktop Navigation (lg+) */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/dashboard/organizations"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              isActive('/dashboard/organizations')
                ? 'border-violet-500 bg-violet-500/20 text-white'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-violet-400" /> Organizations
          </Link>
          <Link
            href="/dashboard/analytics"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              isActive('/dashboard/analytics')
                ? 'border-indigo-500 bg-indigo-500/20 text-white'
                : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> Analytics
          </Link>
          <Link
            href="/dashboard/passport"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              isActive('/dashboard/passport')
                ? 'border-violet-500 bg-violet-500/20 text-white'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-violet-400" /> Passport
          </Link>
          <Link
            href="/dashboard/billing"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              isActive('/dashboard/billing')
                ? 'border-white/20 bg-neutral-800 text-white'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Billing
          </Link>
          <Link
            href="/dashboard/developer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              isActive('/dashboard/developer')
                ? 'border-cyan-500 bg-cyan-500/20 text-white'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" /> Developer
          </Link>
          {canOpenAdminPages && (
            <Link
              href="/dashboard/admin/users"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                isActive('/dashboard/admin/users')
                  ? 'border-cyan-500 bg-cyan-500/20 text-white'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Admin Users
            </Link>
          )}

          <div className="h-4 w-px bg-white/10 mx-1" />

          <NotificationBell />

          <div className="flex items-center gap-2.5 pl-1">
            {profile?.avatar_url && (
              <SafeImage
                src={profile.avatar_url}
                alt={profile.full_name || 'Profile'}
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg border border-white/10 object-cover"
              />
            )}
            <div className="text-left max-w-[140px]">
              <h4 className="text-xs font-bold leading-none text-white truncate">
                {profile?.full_name || 'User'}
              </h4>
              <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{profile?.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 border border-neutral-800 hover:border-neutral-700 bg-neutral-900 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Log Out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Header Controls (<lg) */}
        <div className="flex lg:hidden items-center gap-2">
          <NotificationBell />

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-xl text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </header>

      {/* Accessible Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard mobile navigation"
            className="fixed top-0 right-0 bottom-0 w-[85%] max-w-xs bg-neutral-950 border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-y-auto p-5 z-50 animate-fade-in custom-scrollbar"
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  {profile?.avatar_url ? (
                    <SafeImage
                      src={profile.avatar_url}
                      alt={profile.full_name || 'Profile'}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold text-sm">
                      {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {profile?.full_name || 'User'}
                    </h4>
                    <p className="text-[10px] text-neutral-400 truncate">{profile?.email}</p>
                    {profile?.role && (
                      <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider font-semibold text-violet-400">
                        {profile.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Group 1: Competitions & Workspaces */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-2 mb-1">
                  Competitions & Workspaces
                </p>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/dashboard') && pathname === '/dashboard'
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-violet-400" />
                  <span>Leaderboards Console</span>
                </Link>
                <Link
                  href="/dashboard/organizations"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/dashboard/organizations')
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-violet-400" />
                  <span>Organizations</span>
                </Link>
                <Link
                  href="/dashboard/analytics"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/dashboard/analytics')
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>Analytics</span>
                </Link>
              </div>

              {/* Group 2: Account & Identity */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-2 mb-1">
                  Account & Identity
                </p>
                <Link
                  href="/dashboard/passport"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/dashboard/passport')
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span>Passport</span>
                </Link>
                <Link
                  href="/dashboard/billing"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/dashboard/billing')
                      ? 'bg-neutral-800 text-white border border-neutral-700'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Billing & Subscription</span>
                </Link>
                <Link
                  href="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Help & Documentation</span>
                </Link>
              </div>

              {/* Group 3: Developer & Admin */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-2 mb-1">
                  Developer & Admin
                </p>
                <Link
                  href="/dashboard/developer"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive('/dashboard/developer')
                      ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span>Developer API</span>
                </Link>
                {canOpenAdminPages && (
                  <Link
                    href="/dashboard/admin/users"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive('/dashboard/admin/users')
                        ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>Admin Users</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Logout Action */}
            <div className="pt-4 border-t border-white/10 mt-6">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
