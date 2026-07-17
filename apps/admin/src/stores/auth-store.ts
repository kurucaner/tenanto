import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { APP_SLUG, type IUser } from "@/packages/shared";

export interface IAuthSession {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

interface IAuthState {
  accessToken: string | null;
  clearSession: () => void;
  refreshToken: string | null;
  setAccessToken: (accessToken: string) => void;
  setSession: (session: IAuthSession) => void;
  setUser: (user: IUser) => void;
  user: IUser | null;
}

const AUTH_STORAGE_KEY = `${APP_SLUG}-admin-auth`;

export const useAuthStore = create<IAuthState>()(
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
