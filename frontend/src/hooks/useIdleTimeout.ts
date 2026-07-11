/**
 * useIdleTimeout — ejecuta `onIdle` tras `timeoutMs` sin actividad del usuario.
 *
 * Se considera actividad: teclado, mouse (click/movimiento con throttle),
 * scroll y toques. Cualquiera de esos reinicia el temporizador. Al desmontar
 * limpia listeners y el timer.
 *
 * Uso típico (dentro del shell autenticado):
 *   useIdleTimeout(() => { logout(); navigate('/login'); }, 10 * 60 * 1000);
 */
import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'mousemove',
] as const;

// El mousemove dispara muchísimo; solo dejamos que reinicie el timer como
// máximo una vez por segundo para no reprogramar el setTimeout sin parar.
const THROTTLE_MS = 1000;

export function useIdleTimeout(onIdle: () => void, timeoutMs: number): void {
  // Guardamos onIdle en un ref para no re-suscribir listeners en cada render.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastReset = 0;

    const fire = () => onIdleRef.current();

    const reset = () => {
      const now = Date.now();
      if (now - lastReset < THROTTLE_MS) return;
      lastReset = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, reset, { passive: true })
    );
    // Arranca el conteo desde el montaje.
    lastReset = 0;
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [timeoutMs]);
}
