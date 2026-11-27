'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { subscribeToAuth, logoutUser } from '@/lib/firebase/authService';
import { getCurrentUser, resetCurrentUserRequest } from '@/lib/services/settings';
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

const MEMBERSHIP_CACHE_PREFIX = 'rovii:membership:';

function readCachedMembership(uid: string): MembershipUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`${MEMBERSHIP_CACHE_PREFIX}${uid}`);
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<MembershipUser>;
    if (
      value.id !== uid ||
      (value.role !== 'admin' && value.role !== 'staff') ||
      value.status !== 'active' ||
      typeof value.name !== 'string' ||
      typeof value.email !== 'string'
    ) {
      return null;
    }

    return {
      id: uid,
      name: value.name,
      email: value.email,
      role: value.role,
      status: 'active',
      avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    };
  } catch {
    return null;
  }
}

function cacheMembership(membership: MembershipUser | null, uid: string) {
  if (typeof window === 'undefined') return;

  try {
    const key = `${MEMBERSHIP_CACHE_PREFIX}${uid}`;
    if (membership?.id === uid && membership.status === 'active') {
      window.localStorage.setItem(key, JSON.stringify(membership));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable or full; Firebase remains the source of truth.
  }
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
  const membershipAttemptRef = useRef(0);
  const lastAuthUid = useRef<string | null | undefined>(undefined);

  useEffect(() => subscribeToAuth((currentUser) => {
    const nextUid = currentUser?.uid ?? null;
    if (lastAuthUid.current !== nextUid) {
      lastAuthUid.current = nextUid;
      resetCurrentUserRequest();

      const nextAttempt = membershipAttemptRef.current + 1;
      membershipAttemptRef.current = nextAttempt;
      setMembershipAttempt(nextAttempt);

      // A cached profile restores the shell immediately, but never grants data access.
      const cachedMembership = currentUser ? readCachedMembership(nextUid!) : null;
      setMembershipState(cachedMembership ? {
        uid: nextUid!,
        attempt: nextAttempt,
        user: cachedMembership,
        error: null,
      } : null);
    }
    setUser(currentUser);
    setLoading(false);
  }), []);

  const userId = user?.uid ?? null;

  // Refresh the cached profile from Firestore for every newly restored auth session.
  // Firestore Security Rules remain the authorization boundary for all CRM data.
  useEffect(() => {
    if (loading || !userId) return;

    let cancelled = false;
    getCurrentUser()
      .then((membership) => {
        if (!cancelled) {
          cacheMembership(membership, userId);
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
    if (userId) {
      try {
        window.localStorage.removeItem(`${MEMBERSHIP_CACHE_PREFIX}${userId}`);
      } catch {
        // Ignore unavailable browser storage; the Firestore retry still proceeds.
      }
    }
    const nextAttempt = membershipAttemptRef.current + 1;
    membershipAttemptRef.current = nextAttempt;
    setMembershipState(null);
    setMembershipAttempt(nextAttempt);
  };

  const logout = async () => {
    if (userId) cacheMembership(null, userId);
    await logoutUser();
  };

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
