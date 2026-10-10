'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { subscribeToAuth, logoutUser } from '@/lib/firebase/authService';
import { getCurrentUser } from '@/lib/services/settings';
import { User as MembershipUser } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  membership: MembershipUser | null;
  membershipUserId: string | null;
  membershipLoading: boolean;
  membershipError: string | null;
  retryMembership: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, membership: null, membershipUserId: null,
  membershipLoading: true, membershipError: null, retryMembership: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipUser | null>(null);
  const [membershipUserId, setMembershipUserId] = useState<string | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [membershipAttempt, setMembershipAttempt] = useState(0);

  useEffect(() => subscribeToAuth((currentUser) => {
    setUser(currentUser);
    setLoading(false);
    if (!currentUser) {
      setMembership(null);
      setMembershipUserId(null);
      setMembershipLoading(false);
      setMembershipError(null);
    }
  }), []);

  const userId = user?.uid ?? null;

  // Membership belongs to the auth session, not an individual route.
  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setMembership(null);
      setMembershipUserId(null);
      setMembershipLoading(false);
      setMembershipError(null);
      return;
    }

    let cancelled = false;
    setMembershipLoading(true);
    setMembershipError(null);
    setMembership(null);
    setMembershipUserId(userId);

    getCurrentUser()
      .then((result) => { if (!cancelled) setMembership(result); })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMembership(null);
          setMembershipError(error instanceof Error ? error.message : 'Không thể xác minh quyền truy cập do lỗi kết nối.');
        }
      })
      .finally(() => { if (!cancelled) setMembershipLoading(false); });

    return () => { cancelled = true; };
  }, [loading, userId, membershipAttempt]);

  const retryMembership = () => {
    setMembershipLoading(true);
    setMembershipError(null);
    setMembershipAttempt((attempt) => attempt + 1);
  };

  const logout = async () => { await logoutUser(); };

  return (
    <AuthContext.Provider value={{
      user, loading, membership, membershipUserId, membershipLoading,
      membershipError, retryMembership, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
