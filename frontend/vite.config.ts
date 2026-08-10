import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/* Identificador de ESTA compilación.
 *
 * Se incrusta en el código y se escribe en `version.json`. Al arrancar, la
 * aplicación compara los dos: si el servidor anuncia otro, hay versión nueva y
 * se recarga sola. Ver src/utils/version-guard.ts.
 *
 * Es la hora de compilación en base 36 —corto y siempre creciente—. No sirve
 * el hash del bundle porque el archivo tiene que escribirse ANTES de saberlo. */
const BUILD_ID = Date.now().toString(36);

/** Deja `version.json` junto al index.html en cada build. */
function pluginVersion() {
  return {
    name: 'gdmfac-version',
    generateBundle() {
      (this as any).emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig({
  /* El identificador viaja al código como variable de entorno de Vite. */
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  // Base path del deploy:
  //   · Render (raíz):            sin env → '/'
  //   · Hosting México (/erp):    VITE_BASE_PATH=/erp/ (script build:hosting)
  // App.tsx pasa import.meta.env.BASE_URL como basename del Router para que
  // las rutas SPA funcionen igual en ambos.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), pluginVersion()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // El cliente ahora envía /api/v1/... directamente, así que el proxy
      // solo cambia origen. Cuando el frontend corre en Render, no pasa por
      // este proxy y VITE_API_BASE apunta directo al backend.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
