'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Trophy, Mail, User, ShieldAlert, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import HelpModal from '@/components/HelpModal';
import { loginHelp } from '@/lib/help-content';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
  const { login, signUp, signInWithGoogle, isDemoMode, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getNextPath = () => {
    if (typeof window === 'undefined') {
      return '/dashboard';
    }

    const nextParam = new URLSearchParams(window.location.search).get('next');
    return nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';
  };

  useEffect(() => {
    if (!authLoading && profile) {
      router.replace('/dashboard');
    }
  }, [authLoading, profile, router]);

  const isBusy = loading || authLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const nextPath = getNextPath();

    try {
      if (isSignUp) {
        await signUp(trimmedEmail, trimmedName, nextPath);
        if (!isDemoMode) {
          setMessage({
            type: 'success',
            text: 'Check your email for a confirmation link to complete registration.'
          });
        } else {
          router.replace('/dashboard');
        }
      } else {
        await login(trimmedEmail, trimmedName || 'Alex Mercer', nextPath);
        if (!isDemoMode) {
          setMessage({
            type: 'success',
            text: 'Magic login link sent! Check your email inbox.'
          });
        } else {
          router.replace('/dashboard');
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Authentication failed. Please try again.')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoModeLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await login('creator@leagueboard.com', 'Alex Mercer');
      router.replace('/dashboard');
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Demo login failed.')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black bg-grid flex flex-col relative overflow-hidden">
      {/* Decorative gradient glowing circles */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-[-25%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[130px]" />

      <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative z-10 px-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Back Home */}
          <div className="flex items-center justify-between mb-6">
            <Link 
              href="/" 
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Landing Page
            </Link>
            <HelpModal {...loginHelp} />
          </div>

          {/* Branding */}
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="p-2.5 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400">
              <Trophy className="w-6 h-6" />
            </div>
            <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
              LeagueBoard
            </span>
          </div>

          <h2 className="text-center text-2xl font-bold tracking-tight text-white mt-4">
            {isSignUp ? 'Create your platform account' : 'Welcome back to LeagueBoard'}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {isSignUp ? 'Get started building custom leaderboards' : 'Enter your credentials to access your dashboard'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="glass-premium p-6 sm:p-8 rounded-2xl glow-primary shadow-2xl relative overflow-hidden">
            {isDemoMode && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Demo Sandbox Mode Active</span>
                  No live database keys detected. You can log in instantly without passwords or email checks.
                </div>
              </div>
            )}

            {message && (
              <div className={`mb-5 p-3 rounded-xl border text-sm ${
                message.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignUp && (
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="e.g. Alex Mercer"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-neutral-900/60 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-neutral-900/60 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isBusy ? 'Processing...' : isSignUp ? 'Create Free Account' : 'Request Access (Magic Link)'}
                </button>
              </div>
            </form>

            <div className="mt-5 relative flex items-center justify-center">
              <div className="border-t border-neutral-800 w-full" />
              <span className="absolute bg-[#121214] px-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Or
              </span>
            </div>

            {isDemoMode ? (
              <button
                type="button"
                onClick={handleDemoModeLogin}
                disabled={isBusy}
                className="mt-5 w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-violet-500/20 rounded-xl text-sm font-semibold text-violet-300 bg-violet-500/10 hover:bg-violet-500/15 focus:outline-none transition-all cursor-pointer glow-primary"
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                Launch Instant Demo Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle(getNextPath())}
                disabled={isBusy}
                className="mt-5 w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-neutral-850 rounded-xl text-sm font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-850 focus:outline-none transition-all cursor-pointer"
              >
                Sign In with Google
              </button>
            )}

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 focus:outline-none transition-colors"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in instead' 
                  : "Don't have an account? Sign up now"
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
