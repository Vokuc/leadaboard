'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';
import { isSupabaseConfigured, supabase, DatabaseService } from '../lib/db';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (email: string, name: string, nextPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, name: string, nextPath?: string) => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapOtpAuthError(error: unknown, mode: 'login' | 'signup'): Error {
  if (!(error instanceof Error)) {
    return new Error('Authentication failed. Please try again.');
  }

  if (error.name === 'AuthRetryableFetchError') {
    return new Error('Supabase auth could not complete the request. Check Supabase Auth URL configuration: set the Site URL, add your /auth/callback redirect URL, and make sure the Email provider is enabled.');
  }

  if (error.message === 'Signups not allowed for otp') {
    if (mode === 'login') {
      return new Error('No account is available for that email yet. Use Sign Up first, then confirm the email link from your inbox.');
    }

    return new Error('Email OTP signups are disabled in Supabase. Enable email signups in Authentication settings, or use Google sign-in.');
  }

  return error;
}

function mapOAuthError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('Google sign-in failed. Please try again.');
  }

  if (error.name === 'AuthRetryableFetchError') {
    return new Error('Google sign-in could not reach a valid Supabase auth configuration. Set the Site URL, add your /auth/callback redirect URL, and enable the Google provider in Supabase Auth.');
  }

  return error;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !isSupabaseConfigured;

  useEffect(() => {
    DatabaseService.initialize();
    let isMounted = true;
    let unsubscribe = () => {};

    const syncProfile = async (hasSessionUser: boolean) => {
      if (!isMounted) {
        return;
      }

      if (!hasSessionUser) {
        setProfile(null);
        return;
      }

      const prof = await DatabaseService.getCurrentProfile();
      if (isMounted) {
        setProfile(prof);
      }
    };

    const fetchSession = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          await syncProfile(!!session?.user);

          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            queueMicrotask(() => {
              void syncProfile(!!currentSession?.user);
            });
          });
          unsubscribe = () => subscription.unsubscribe();
        } else {
          const prof = await DatabaseService.getCurrentProfile();
          if (isMounted) {
            setProfile(prof);
          }
        }
      } catch (err) {
        console.error('Error fetching auth session:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchSession();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const getAuthCallbackUrl = (nextPath = '/dashboard') => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const safeNext = nextPath.startsWith('/') ? nextPath : '/dashboard';
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  };

  const login = async (email: string, name: string, nextPath?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: getAuthCallbackUrl(nextPath),
            data: {
              full_name: name,
            },
          }
        });
        if (error) throw mapOtpAuthError(error, 'login');
      } else {
        const prof = await DatabaseService.mockLogin(email, name);
        setProfile(prof);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, name: string, nextPath?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: getAuthCallbackUrl(nextPath),
            data: {
              full_name: name,
            }
          }
        });
        if (error) throw mapOtpAuthError(error, 'signup');
      } else {
        const prof = await DatabaseService.mockLogin(email, name);
        setProfile(prof);
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (nextPath?: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: getAuthCallbackUrl(nextPath),
          }
        });
        if (error) throw mapOAuthError(error);
      } else {
        const prof = await DatabaseService.mockLogin('creator@leagueboard.com', 'Alex Mercer');
        setProfile(prof);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('leagueboard_profile');
        }
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ profile, loading, isDemoMode, login, logout, signUp, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
