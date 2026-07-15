import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { APP_SLUG, type ITenantUser } from "@/packages/shared";

export interface ITenantAuthSession {
  accessToken: string;
  refreshToken: string;
  user: ITenantUser;
}

interface ITenantAuthState {
  accessToken: string | null;
  clearSession: () => void;
  refreshToken: string | null;
  setAccessToken: (accessToken: string) => void;
  setSession: (session: ITenantAuthSession) => void;
  setUser: (user: ITenantUser) => void;
  user: ITenantUser | null;
}

const AUTH_STORAGE_KEY = `${APP_SLUG}-tenant-auth`;

export const useAuthStore = create<ITenantAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      clearSession: () => {
        set({ accessToken: null, refreshToken: null, user: null });
      },
      refreshToken: null,
      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      setSession: ({ accessToken, refreshToken, user }) => {
        set({ accessToken, refreshToken, user });
      },
      setUser: (user) => {
        set({ user });
      },
      user: null,
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
