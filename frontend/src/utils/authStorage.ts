/**
 * Almacenamiento de la sesión — usa sessionStorage (no localStorage).
 *
 * Motivo (requisito de negocio): la sesión debe CERRARSE cuando el usuario
 * cierra la pestaña o la ventana del navegador (la "X" de arriba a la
 * derecha). `sessionStorage` se borra automáticamente al cerrar la pestaña,
 * pero SOBREVIVE a un refresh (F5) dentro de la misma pestaña — que es
 * justo el comportamiento deseado: recargar no debe desloguear, cerrar sí.
 *
 * Es la ÚNICA fuente de verdad del token: el store de auth, el cliente axios
 * y cualquier fetch manual deben leer/escribir desde aquí para no divergir.
 */

export const TOKEN_KEY = 'token';
export const REFRESH_KEY = 'refreshToken';

/** Storage de la sesión (per-tab, se limpia al cerrar la pestaña). */
export const sessionStore: Storage = window.sessionStorage;

export const getToken = (): string | null => sessionStore.getItem(TOKEN_KEY);

export const setToken = (t: string | null): void => {
  if (t) sessionStore.setItem(TOKEN_KEY, t);
  else sessionStore.removeItem(TOKEN_KEY);
};

export const getRefreshToken = (): string | null => sessionStore.getItem(REFRESH_KEY);

export const setRefreshToken = (t: string | null): void => {
  if (t) sessionStore.setItem(REFRESH_KEY, t);
  else sessionStore.removeItem(REFRESH_KEY);
};

/** Borra token + refresh de la sesión. */
export const clearSession = (): void => {
  sessionStore.removeItem(TOKEN_KEY);
  sessionStore.removeItem(REFRESH_KEY);
};

/**
 * Migración one-shot: si quedaron credenciales viejas en localStorage
 * (versiones previas que usaban localStorage), las limpiamos para que no
 * "revivan" una sesión que debía cerrarse al cerrar la pestaña.
 */
export const purgeLegacyLocalStorage = (): void => {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem('auth-store');
  } catch {
    /* no-op */
  }
};
