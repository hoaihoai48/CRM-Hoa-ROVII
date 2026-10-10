'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { subscribeToAuth, logoutUser } from '@/lib/firebase/authService';
import { getCurrentUser } from '@/lib/services/settings';
import { User as MembershipUser } from '@/types';

interface MembershipState {
  uid: string;
  attempt: number;
  user: MembershipUser | null;
  error: string | null;
}

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
  user: null,
  loading: true,
  membership: null,
  membershipUserId: null,
  membershipLoading: true,
  membershipError: null,
  retryMembership: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipAttempt, setMembershipAttempt] = useState(0);
  const [membershipState, setMembershipState] = useState<MembershipState | null>(null);

  useEffect(() => subscribeToAuth((currentUser) => {
    setUser(currentUser);
    setLoading(false);
  }), []);

  const userId = user?.uid ?? null;

  // Resolve membership once per authenticated UID; route changes reuse this state.
  // Loading is derived from the UID/attempt key so no synchronous state reset is needed in this effect.
  useEffect(() => {
    if (loading || !userId) return;

    let cancelled = false;
    getCurrentUser()
      .then((membership) => {
        if (!cancelled) {
          setMembershipState({ uid: userId, attempt: membershipAttempt, user: membership, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMembershipState({
            uid: userId,
            attempt: membershipAttempt,
            user: null,
            error: error instanceof Error ? error.message : 'Không thể xác minh quyền truy cập do lỗi kết nối.',
          });
        }
      });

    return () => { cancelled = true; };
  }, [loading, userId, membershipAttempt]);

  const retryMembership = () => {
    setMembershipAttempt((attempt) => attempt + 1);
  };

  const logout = async () => { await logoutUser(); };

  const stateMatchesCurrentAttempt = Boolean(
    userId && membershipState?.uid === userId && membershipState.attempt === membershipAttempt
  );
  const membershipLoading = loading || Boolean(userId && !stateMatchesCurrentAttempt);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      membership: stateMatchesCurrentAttempt ? membershipState?.user ?? null : null,
      membershipUserId: stateMatchesCurrentAttempt ? membershipState?.uid ?? null : null,
      membershipLoading,
      membershipError: stateMatchesCurrentAttempt ? membershipState?.error ?? null : null,
      retryMembership,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
