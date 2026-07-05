import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { IUser } from "@/packages/shared";

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
      name: "tenanto-admin-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
