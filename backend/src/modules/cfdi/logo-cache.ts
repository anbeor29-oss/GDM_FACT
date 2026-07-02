/**
 * Caché en memoria de logos pre-optimizados para incrustar en PDFs.
 *
 *   - PDFKit no recomprime imágenes; si pasamos el JPG original (4000×2667, 3 MB)
 *     el PDF resultante pesa 3 MB y el navegador hace timeout al descargar.
 *   - Aquí redimensionamos a un thumbnail apto para el header (300×300 px,
 *     calidad JPEG 78) y cacheamos por mtime del archivo origen para que cada
 *     factura solo pague el costo de compresión una vez.
 */

import * as fs from 'fs';
import sharp from 'sharp';
import logger from '../../middleware/logger';

interface LogoCacheEntry {
  mtimeMs: number;
  buffer: Buffer;
}

const cache = new Map<string, LogoCacheEntry>();

/** Lado máximo en píxeles del thumbnail (se ajusta dentro de un cuadrado). */
const MAX_PX = 300;
/** Calidad JPEG del thumbnail — suficiente para impresión a 3×3 cm. */
const JPEG_QUALITY = 78;

/**
 * Devuelve un Buffer JPEG comprimido del logo. Si el archivo no existe o
 * sharp falla, regresa null y el caller debe seguir sin logo.
 */
export async function getOptimizedLogo(logoPath: string | null | undefined): Promise<Buffer | null> {
  if (!logoPath || typeof logoPath !== 'string') return null;
  try {
    const stat = fs.statSync(logoPath);
    const hit = cache.get(logoPath);
    if (hit && hit.mtimeMs === stat.mtimeMs) {
      return hit.buffer;
    }
    const buffer = await sharp(logoPath)
      .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    cache.set(logoPath, { mtimeMs: stat.mtimeMs, buffer });
    logger.info(`Logo optimizado: ${logoPath} → ${buffer.length} bytes`);
    return buffer;
  } catch (e) {
    logger.warn(`getOptimizedLogo falló para ${logoPath}: ${e instanceof Error ? e.message : 'desconocido'}`);
    return null;
  }
}
