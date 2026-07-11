/**
 * Auth Store
 * Global state management for authentication
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthState, User } from '@/types';
import {
  sessionStore, setToken as ssSetToken, setRefreshToken as ssSetRefresh,
  clearSession, purgeLegacyLocalStorage,
} from '@/utils/authStorage';

// Limpia credenciales viejas de localStorage al cargar (ver authStorage).
purgeLegacyLocalStorage();

interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  /** Marca la cuenta como "ya cambió su password" (tras flujo forzado). */
  markPasswordChanged: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setUser: (user) => {
        set({ user, isAuthenticated: user !== null });
      },

      setToken: (token) => {
        set({ token });
        ssSetToken(token);
      },

      setRefreshToken: (refreshToken) => {
        set({ refreshToken });
        ssSetRefresh(refreshToken);
      },

      login: (user, token, refreshToken) => {
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
        });
        ssSetToken(token);
        ssSetRefresh(refreshToken);
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        clearSession();
      },

      markPasswordChanged: () => {
        const u = (useAuthStore.getState() as any).user as User | null;
        if (u) set({ user: { ...u, passwordChangeRequired: false } });
      },
    }),
    {
      name: 'auth-store',
      // sessionStorage: la sesión se borra al cerrar la pestaña/ventana (la
      // "X"), pero sobrevive a un refresh. Ver src/utils/authStorage.ts.
      storage: createJSONStorage(() => sessionStore),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
