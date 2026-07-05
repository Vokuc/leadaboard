'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';
import { isSupabaseConfigured, supabase, DatabaseService } from '../lib/db';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !isSupabaseConfigured;

  useEffect(() => {
    // Initialize mock DB
    DatabaseService.initialize();

    const fetchSession = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const prof = await DatabaseService.getCurrentProfile();
            setProfile(prof);
          } else {
            setProfile(null);
          }

          // Listen to changes
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user) {
              const prof = await DatabaseService.getCurrentProfile();
              setProfile(prof);
            } else {
              setProfile(null);
            }
          });

          return () => {
            subscription.unsubscribe();
          };
        } else {
          // Demo Mode session retrieve
          const prof = await DatabaseService.getCurrentProfile();
          setProfile(prof);
        }
      } catch (err) {
        console.error('Error fetching auth session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, []);

  const login = async (email: string, name: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + '/dashboard',
          }
        });
        if (error) throw error;
        // Suppress loading since they need to check email, or handle separately
      } else {
        const prof = await DatabaseService.mockLogin(email, name);
        setProfile(prof);
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, name: string) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signUp({
          email,
          password: 'mockPassword123!', // Using OTP or standard password
          options: {
            data: {
              full_name: name,
            }
          }
        });
        if (error) throw error;
      } else {
        const prof = await DatabaseService.mockLogin(email, name);
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
    <AuthContext.Provider value={{ profile, loading, isDemoMode, login, logout, signUp }}>
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
