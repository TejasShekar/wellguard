import { create } from 'zustand';

import type { AuthUser } from '../services/auth';

type AuthState = {
  user: AuthUser | null;
  initialized: boolean;
  setUser: (user: AuthUser | null) => void;
  markInitialized: () => void;
};

export const useAuthStore = create<AuthState>()(set => ({
  user: null,
  initialized: false,
  setUser: user => set({ user }),
  markInitialized: () => set({ initialized: true }),
}));
