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
  refreshToken: string | null;
  user: IUser | null;
  clearSession: () => void;
  setAccessToken: (accessToken: string) => void;
  setSession: (session: IAuthSession) => void;
  setUser: (user: IUser) => void;
}

const AUTH_STORAGE_KEY = `${APP_SLUG}-admin-auth`;
const LEGACY_AUTH_STORAGE_KEY = "tenanto-admin-auth";

const authStorage = createJSONStorage(() => ({
  getItem: (name) => {
    const value = localStorage.getItem(name);
    if (value !== null) return value;
    const legacy = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (legacy === null) return null;
    localStorage.setItem(name, legacy);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    return legacy;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
}));

export const useAuthStore = create<IAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      clearSession: () => {
        set({ accessToken: null, refreshToken: null, user: null });
      },
      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      setSession: ({ accessToken, refreshToken, user }) => {
        set({ accessToken, refreshToken, user });
      },
      setUser: (user) => {
        set({ user });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      storage: authStorage,
    }
  )
);
