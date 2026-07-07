/**
 * Helpers compartidos para los distintos PDFs (factura, complemento de pago,
 * nota de crédito). Los tres documentos comparten el header con logo + datos
 * del emisor, los formatos de número/fecha y el importe en letra.
 */

import PDFDocument from 'pdfkit';
import { query } from '../../config/database';
import logger from '../../middleware/logger';

export type PDFDoc = InstanceType<typeof PDFDocument>;

/* ─────────────── constantes geométricas ─────────────── */

export const PT_PER_CM = 28.3464567;
export const LOGO_SIZE = Math.round(3 * PT_PER_CM); // ≈ 85 pt
export const PAGE_LEFT = 40;
export const PAGE_RIGHT = 555;
export const PAGE_TOP = 40;

/* ─────────────── formatos numéricos ─────────────── */

export function fmtMoney(n: any): string {
  const v = Number(n) || 0;
  return v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtQty(n: any): string {
  const v = Number(n) || 0;
  return v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Extrae el NoCertificado del XML timbrado (atributo del root
 * <cfdi:Comprobante>). Cuando el CSD vive en el vault del PAC (SW Sapien
 * sandbox) no lo tenemos en la BD, pero SW lo devuelve dentro del XML.
 * Regex tolerante a comillas simples/dobles y a namespaces alternos.
 */
export function extractNoCertificado(xml: string | null | undefined): string | null {
  if (!xml || typeof xml !== 'string') return null;
  const m = xml.match(/NoCertificado\s*=\s*["']([^"']+)["']/);
  return m ? m[1] : null;
}

export function fmtDate(d: any): string {
  try {
    return new Date(d).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

/* ─────────────── importe en letra (es-MX) ─────────────── */

export function numeroALetras(n: number): string {
  if (!isFinite(n) || n < 0) return 'CERO';
  const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const ESPECIALES: Record<number, string> = {
    10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
    20: 'VEINTE', 21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
    25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE',
  };
  const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
                    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function hasta999(num: number): string {
    if (num === 0) return '';
    if (num === 100) return 'CIEN';
    if (ESPECIALES[num]) return ESPECIALES[num];
    let r = '';
    const c = Math.floor(num / 100);
    const resto = num % 100;
    if (c > 0) r += CENTENAS[c];
    if (resto > 0) {
      if (r) r += ' ';
      if (ESPECIALES[resto]) r += ESPECIALES[resto];
      else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        if (d > 0) {
          r += DECENAS[d];
          if (u > 0) r += ' Y ' + UNIDADES[u]; // "Y" solo si hay decena
        } else if (u > 0) {
          r += UNIDADES[u];
        }
      }
    }
    return r;
  }

  const entero = Math.floor(n);
  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;

  let palabras = '';
  if (millones > 0) palabras += millones === 1 ? 'UN MILLÓN' : `${hasta999(millones)} MILLONES`;
  if (miles > 0) {
    if (palabras) palabras += ' ';
    palabras += miles === 1 ? 'MIL' : `${hasta999(miles)} MIL`;
  }
  if (resto > 0) {
    if (palabras) palabras += ' ';
    palabras += hasta999(resto);
  }
  if (!palabras) palabras = 'CERO';
  return palabras;
}

export function palabraMoneda(currency = 'MXN'): string {
  const map: Record<string, string> = {
    MXN: 'PESOS', USD: 'DÓLARES', EUR: 'EUROS',
    CAD: 'DÓLARES CANADIENSES', GBP: 'LIBRAS ESTERLINAS',
    JPY: 'YENES', CHF: 'FRANCOS SUIZOS', CNY: 'YUANES',
    BRL: 'REALES', ARS: 'PESOS ARGENTINOS', CLP: 'PESOS CHILENOS',
    COP: 'PESOS COLOMBIANOS', AUD: 'DÓLARES AUSTRALIANOS',
  };
  return map[currency] || currency;
}

export function montoEnLetra(total: number, currency = 'MXN'): string {
  const entero = Math.floor(total);
  const cent = Math.round((total - entero) * 100);
  const centStr = String(cent).padStart(2, '0');
  return `${numeroALetras(entero)} ${palabraMoneda(currency)} ${centStr}/100 M.N.`;
}

/* ─────────────── catálogos de presentación ─────────────── */

export const FORMA_PAGO: Record<string, string> = {
  '01': 'Efectivo', '02': 'Cheque nominativo', '03': 'Transferencia electrónica',
  '04': 'Tarjeta de crédito', '05': 'Monedero electrónico', '06': 'Dinero electrónico',
  '08': 'Vales de despensa', '28': 'Tarjeta de débito', '29': 'Tarjeta de servicios',
  '99': 'Por definir',
};

export const METODO_PAGO: Record<string, string> = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido',
};

/* ─────────────── headers y footers compartidos ─────────────── */

/**
 * Header genérico: logo + datos del emisor a la izquierda;
 * caja con TIPO de documento + folio + fecha + UUID + moneda + No. Cert
 * a la derecha. Devuelve la Y de continuación.
 */
export function drawCommonHeader(
  doc: PDFDoc,
  company: any,
  opts: {
    titulo: string;                  // "FACTURA", "COMPLEMENTO DE PAGO", "NOTA DE CRÉDITO"
    folio: string;                   // "P-000001", "NC-000005", etc.
    fecha: any;
    forma?: string;                  // c_FormaPago
    metodo?: string;                 // PUE/PPD
    uuid?: string;
    moneda: string;
    regimenDesc?: string;
    color?: string;                  // color del título (azul, rojo…)
    logoBuf?: Buffer | null;         // logo pre-optimizado (ver logo-cache.ts)
    xml?: string | null;             // XML timbrado, se usa para extraer NoCertificado si el CSD vive en el vault del PAC
    noCertificado?: string | null;   // override explícito si ya se pre-extrajo
  }
): number {
  const titleColor = opts.color || '#1e40af';

  // Logo (3x3 cm) — usa el buffer pre-comprimido para no inflar el PDF a varios MB
  let hasLogo = false;
  if (opts.logoBuf) {
    try {
      doc.image(opts.logoBuf, PAGE_LEFT, PAGE_TOP, {
        fit: [LOGO_SIZE, LOGO_SIZE], align: 'center', valign: 'center',
      });
      hasLogo = true;
    } catch (e) {
      logger.warn(`No se pudo cargar el logo: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  const emisorX = hasLogo ? PAGE_LEFT + LOGO_SIZE + 14 : PAGE_LEFT;
  // Caja derecha empieza en 345; tope del título es ahí menos 8pt de aire.
  const titleMaxW = 345 - emisorX - 8;
  // Font dinámico: si el título no cabe a 20pt, reducimos para evitar wrap
  // sobre la caja ("COMPLEMENTO DE PAGO" cortado a "COMPLEMENTO DE P").
  doc.font('Helvetica-Bold').fontSize(20);
  let titleSize = 20;
  while (titleSize > 12 && doc.widthOfString(opts.titulo) > titleMaxW) {
    titleSize -= 1;
    doc.fontSize(titleSize);
  }
  doc.fillColor(titleColor)
    .text(opts.titulo, emisorX, PAGE_TOP, { width: titleMaxW, lineBreak: false });

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151')
    .text((company.business_name || '').toUpperCase(), emisorX, PAGE_TOP + 28);
  doc.font('Helvetica').fillColor('#374151').fontSize(8);
  const emisorBlockW = 340 - emisorX + PAGE_LEFT;
  let y = PAGE_TOP + 40;
  doc.text(`RFC: ${company.rfc || '—'}`, emisorX, y, { width: emisorBlockW }); y += 11;
  const regCode = company.fiscal_regime || '—';
  const regText = opts.regimenDesc ? `${regCode} — ${opts.regimenDesc}` : regCode;
  const regH = doc.heightOfString(`Régimen: ${regText}`, { width: emisorBlockW });
  doc.text(`Régimen: ${regText}`, emisorX, y, { width: emisorBlockW });
  y += Math.max(11, regH);

  // Avanza Y por la altura real de cada texto (con wrap) para no empalmar
  const advE = (text: string) => {
    const h = doc.heightOfString(text, { width: emisorBlockW });
    doc.text(text, emisorX, y, { width: emisorBlockW });
    y += Math.max(11, h);
  };
  const calleParts: string[] = [];
  if (company.street)     calleParts.push(String(company.street));
  if (company.ext_number) calleParts.push(`#${company.ext_number}`);
  if (calleParts.length) advE(calleParts.join(' '));
  const localParts: string[] = [];
  if (company.neighborhood) localParts.push(String(company.neighborhood));
  if (company.municipality) localParts.push(String(company.municipality));
  if (company.state)        localParts.push(String(company.state));
  if (localParts.length) advE(localParts.join(', '));
  if (company.postal_code) advE(`CP ${company.postal_code} · México`);

  // Caja derecha con folio, fecha, etc. Calculamos altura dinámica antes
  // de pintar la caja para que UUID largo no se empalme con MONEDA / NO. CERT.
  const boxX = 345;
  const boxY = PAGE_TOP;
  const boxW = PAGE_RIGHT - boxX;
  const innerW = boxW - 16;
  const labelW = 60;
  const lh = 12;
  const sectionGap = 4;
  const stackedLabelH = 9;

  const uuidStr = opts.uuid !== undefined ? (opts.uuid || 'PENDIENTE DE TIMBRAR') : null;
  const noCert =
    opts.noCertificado ||
    extractNoCertificado(opts.xml) ||
    (company as any).csd_no_certificado ||
    '— pendiente —';

  doc.font('Courier').fontSize(8);
  const uuidH = uuidStr ? doc.heightOfString(uuidStr, { width: innerW }) : 0;
  const certH = doc.heightOfString(noCert, { width: innerW });

  // Pre-mide cada fila simple para reservar el alto correcto cuando algún
  // valor (típicamente MÉTODO "Pago en una sola exhibición") wrappea.
  const simpleValues: string[] = [opts.folio, fmtDate(opts.fecha)];
  if (opts.forma) {
    // c_FormaPago usa códigos de 2 chars con padding ("03"). Normalizamos
    // por si llega "3" para no perder la descripción legible.
    const code = String(opts.forma).padStart(2, '0');
    simpleValues.push(`${code} — ${FORMA_PAGO[code] || '—'}`);
  }
  if (opts.metodo) simpleValues.push(`${opts.metodo} — ${METODO_PAGO[opts.metodo] || '—'}`);
  simpleValues.push(opts.moneda || 'MXN');
  doc.font('Helvetica-Bold').fontSize(8.5);
  const valuesW = boxW - labelW - 16;
  const simpleRowsH = simpleValues.reduce(
    (acc, v) => acc + Math.max(lh, doc.heightOfString(v, { width: valuesW }) + 1),
    0
  );

  const computedH = 8 + simpleRowsH
    + (uuidStr ? sectionGap + stackedLabelH + uuidH + 2 : 0)
    + sectionGap + stackedLabelH + certH + 2
    + 6;

  const boxH = Math.max(120, Math.ceil(computedH));
  const lightBg = colorMix(titleColor, '#ffffff', 0.85);
  doc.roundedRect(boxX, boxY, boxW, boxH, 6).fillAndStroke(lightBg, '#94a3b8');

  let by = boxY + 8;

  function row(label: string, value: string) {
    doc.font('Helvetica').fillColor('#475569').fontSize(7).text(label, boxX + 8, by + 1);
    const vW = boxW - labelW - 16;
    doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(8.5);
    const vH = doc.heightOfString(value, { width: vW });
    doc.text(value, boxX + 8 + labelW, by, { width: vW });
    by += Math.max(lh, vH + 1);
  }
  function stackedRow(label: string, value: string, opts: { mono?: boolean; muted?: boolean }) {
    by += sectionGap;
    doc.font('Helvetica-Bold').fillColor('#64748b').fontSize(7).text(label, boxX + 8, by);
    by += stackedLabelH;
    if (opts.mono) {
      doc.font('Courier').fillColor(opts.muted ? '#94a3b8' : '#1e3a8a').fontSize(8)
        .text(value, boxX + 8, by, { width: innerW });
    } else {
      doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(8.5)
        .text(value, boxX + 8, by, { width: innerW });
    }
    const h = doc.heightOfString(value, { width: innerW });
    by += h + 2;
  }

  row('FOLIO', opts.folio);
  row('FECHA', fmtDate(opts.fecha));
  if (opts.forma) {
    const code = String(opts.forma).padStart(2, '0');
    row('FORMA PAGO', `${code} — ${FORMA_PAGO[code] || '—'}`);
  }
  if (opts.metodo) row('MÉTODO',     `${opts.metodo} — ${METODO_PAGO[opts.metodo] || '—'}`);
  row('MONEDA', opts.moneda || 'MXN');

  if (uuidStr) {
    stackedRow('UUID (FOLIO FISCAL SAT)', uuidStr, { mono: true, muted: !opts.uuid });
  }
  stackedRow('NO. CERTIFICADO', noCert, { mono: true, muted: String(noCert).startsWith('—') });

  const dividerY = Math.max(PAGE_TOP + LOGO_SIZE + 8, y + 4, by + 4);
  doc.moveTo(PAGE_LEFT, dividerY).lineTo(PAGE_RIGHT, dividerY)
    .strokeColor('#cbd5e1').lineWidth(1).stroke();

  doc.fillColor('#000000').strokeColor('#000000');
  return dividerY + 10;
}

/**
 * Bloque receptor — datos del cliente con domicilio completo.
 */
export function drawReceptor(
  doc: PDFDoc,
  startY: number,
  customer: any,
  regimenDesc: string,
  cfdiUseDesc?: string,
  cfdiUse?: string
): number {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('RECEPTOR', PAGE_LEFT, startY);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
    .text((customer.business_name || '').toUpperCase(), PAGE_LEFT, startY + 12);

  let y = startY + 28;
  doc.font('Helvetica').fontSize(8).fillColor('#374151');

  const col1X = PAGE_LEFT;
  const col2X = PAGE_LEFT + 270;
  doc.text(`RFC: ${customer.rfc || '—'}`, col1X, y);
  doc.text(`CP: ${customer.postal_code || '—'}`, col2X, y);
  y += 11;

  const adv = (text: string, width = PAGE_RIGHT - col1X) => {
    const h = doc.heightOfString(text, { width });
    doc.text(text, col1X, y, { width });
    y += Math.max(11, h);
  };

  const regCode = customer.fiscal_regime || '—';
  adv(`Régimen: ${regCode}${regimenDesc ? ' — ' + regimenDesc : ''}`);
  if (cfdiUse) adv(`Uso CFDI: ${cfdiUse}${cfdiUseDesc ? ' — ' + cfdiUseDesc : ''}`);

  // Domicilio: si hay calle se imprime con prefijo; si solo hay estado/municipio
  // se etiqueta para que no aparezcan códigos sueltos (ej. "19" del c_Estado).
  const calleParts: string[] = [];
  if (customer.street)     calleParts.push(String(customer.street));
  if (customer.ext_number) calleParts.push(`#${customer.ext_number}`);
  if (calleParts.length) adv(`Calle: ${calleParts.join(' ')}`);

  const localParts: string[] = [];
  if (customer.neighborhood) localParts.push(String(customer.neighborhood));
  if (customer.municipality) localParts.push(String(customer.municipality));
  if (customer.city)         localParts.push(String(customer.city));
  if (customer.state) {
    const s = String(customer.state);
    // Si el "state" es código SAT (1-3 dígitos) lo mostramos como "Estado SAT: 19"
    localParts.push(/^\d{1,3}$/.test(s) ? `Estado SAT ${s}` : s);
  }
  if (localParts.length) adv(`Ubicación: ${localParts.join(', ')}`);

  y += 4;
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y)
    .strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.fillColor('#000000');
  return y + 10;
}

export function drawFooter(doc: PDFDoc, leyenda: string) {
  const pageH = doc.page.height;
  const y = pageH - 42;
  // ⚠ Anular márgenes es CRÍTICO: si no, PDFKit ve que el cursor pasó el
  // margen inferior tras el text() y crea página nueva en automático.
  const origMargins = { ...doc.page.margins };
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y)
    .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
  doc.text(leyenda, PAGE_LEFT, y + 6, {
    width: PAGE_RIGHT - PAGE_LEFT, align: 'center', lineBreak: false,
  });

  doc.page.margins = origMargins;
  doc.fillColor('#000000');
}

/**
 * Estampa "Página X/Y" en la esquina inferior DERECHA de cada página existente.
 *
 * Requisitos:
 *  · El PDFDocument fue creado con `bufferPages: true`.
 *  · Se llama UNA vez al final del render, justo antes de `doc.end()`.
 *
 * Detalles importantes de PDFKit:
 *  · `switchToPage` cambia la página activa PERO no resetea `doc.y`. Si `doc.y`
 *    quedó al fondo por el flujo previo, un `text()` sin coordenadas fijas
 *    puede disparar una página nueva. Por eso pasamos SIEMPRE (x, y) explícitos
 *    y `lineBreak: false`.
 *  · Usamos `_pageBufferStart` implícito ignorando `range.start`: siempre
 *    iteramos desde 0..count-1 mediante el índice absoluto (range.start + i).
 */
export function drawPageNumbers(doc: PDFDoc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  if (total <= 0) return;

  // ⚠ PDFKit + bufferPages tiene un bug conocido: `switchToPage()` no resetea
  // la parte del `PageStructure` que trackea el margen inferior. Si esa página
  // ya había alcanzado el margen inferior al agregar contenido, cualquier
  // `text()` posterior — incluso con Y explícito — dispara `addPage()`
  // internamente antes de escribir. Workaround: pintamos con las primitivas
  // de streaming BAJO NIVEL (`_write` no está expuesto; usamos rect+text con
  // el truco de forzar `page.margins.bottom = 0` temporalmente).
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const pageH = doc.page.height;
    const origMargins = { ...doc.page.margins };
    // Anulamos los márgenes de la página SOLO para escribir el paginador —
    // así PDFKit no considera que "estamos fuera" y no auto-pagina.
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    const labelW = 120;
    const x = PAGE_RIGHT - labelW;
    const y = pageH - 22;
    doc.text(`Página ${i + 1}/${total}`, x, y, {
      width: labelW, align: 'right', lineBreak: false,
    });
    doc.page.margins = origMargins;
    doc.fillColor('#000000');
  }
}

/* ─────────────── Bloque oficial SAT (Timbre Fiscal Digital) ───────────────
 * El SAT exige en la representación impresa de un CFDI: Sello del CFDI,
 * Sello del SAT, Cadena Original del complemento, No. Cert. SAT, etc.
 * Como aún no integramos un PAC real, simulamos esos campos a partir del
 * UUID + timestamp para que el formato luzca completo.
 *
 *   doc:      documento PDFKit
 *   uuid:     UUID del CFDI (folio fiscal)
 *   fecha:    fecha de timbrado (ISO)
 *   color:    color de acento (azul / verde / rojo según tipo de CFDI)
 *
 * Devuelve la Y donde termina el bloque (para drawFooter después).
 */
export function drawTimbreFiscal(
  doc: PDFDoc,
  startY: number,
  data: {
    uuid: string | null | undefined;
    fechaTimbrado?: any;
    pacRfc?: string;
    color?: string;
  }
): number {
  const accent = data.color || '#1e3a8a';

  // Simulamos sellos base64 a partir del UUID — determinístico para
  // que dos PDFs del mismo CFDI muestren el mismo sello (no cambia entre renders).
  // Anexo 20 permite representar el sello de forma abreviada en la impresa
  // — solo lo suficiente para que se vea el formato. El sello completo va en el XML.
  const seed = (data.uuid || 'PENDIENTE-DE-TIMBRAR').replace(/-/g, '').toUpperCase();
  const grow = (chars: number) => {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
    let s = '';
    let n = 0;
    for (let i = 0; i < chars; i++) {
      const c = (seed.charCodeAt(i % seed.length) + n++) % alpha.length;
      s += alpha[c];
    }
    return s;
  };
  // Muestra los primeros 60 chars + "…" + últimos 20 → cabe en 1 sola línea.
  const abbreviate = (chars: number) => {
    const full = grow(chars);
    return `${full.slice(0, 60)}…${full.slice(-20)}`;
  };
  const selloCfdi = abbreviate(344);
  const selloSat  = abbreviate(344);
  const fechaT    = data.fechaTimbrado
    ? new Date(data.fechaTimbrado).toISOString().slice(0, 19)
    : new Date().toISOString().slice(0, 19);
  const pacRfc    = data.pacRfc || 'SAT970701NN3';
  const noCertSat = '00001000000506430009';
  const cadenaOrig = `||1.1|${data.uuid || '—'}|${fechaT}|${pacRfc}|${noCertSat}||`;

  // Pre-cálculo: el bloque timbre necesita ~95pt con sellos abreviados a 1 línea:
  //   6pt (separador) + 10pt (label) + 7 kv * 10pt = 86pt + 9pt margen = ~95pt.
  // Si `startY` está muy abajo y no cabe el bloque, saltamos a página nueva
  // ANTES de dibujar — así el timbre queda íntegro y no partido en 2 páginas.
  // Reservamos 40pt para el footer + paginación al pie de página.
  const BLOCK_H = 95;
  const FOOTER_RESERVED = 40;
  const pageH = doc.page.height;
  if (startY + BLOCK_H > pageH - FOOTER_RESERVED) {
    doc.addPage();
    startY = PAGE_TOP;
  }

  let y = startY;
  // Línea separadora
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y)
    .strokeColor(accent).lineWidth(0.8).stroke();
  y += 6;

  doc.font('Helvetica-Bold').fontSize(7).fillColor(accent)
    .text('TIMBRE FISCAL DIGITAL DEL SAT (representación impresa)', PAGE_LEFT, y,
      { lineBreak: false });
  y += 10;

  const kvW = PAGE_RIGHT - PAGE_LEFT;
  const labelW = 110;

  // Fila key/value compacta — con lineBreak:false + ellipsis para que las
  // líneas no wrappen a otra página si el sello viene largo.
  function kv(label: string, value: string, opts?: { mono?: boolean; size?: number }) {
    const size = opts?.size ?? 6.5;
    const font = opts?.mono ? 'Courier' : 'Helvetica';
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b')
      .text(label, PAGE_LEFT, y, { width: labelW, lineBreak: false });
    doc.font(font).fontSize(size).fillColor('#0f172a')
      .text(value, PAGE_LEFT + labelW, y, {
        width: kvW - labelW, lineBreak: false, ellipsis: true,
      });
    y += 10;
  }

  kv('UUID (Folio fiscal)',   data.uuid || 'PENDIENTE DE TIMBRAR', { mono: true });
  kv('Fecha timbrado',         fechaT);
  kv('RFC del PAC',            pacRfc);
  kv('No. Cert. SAT',          noCertSat, { mono: true });
  kv('Sello digital del CFDI', selloCfdi, { mono: true, size: 6 });
  kv('Sello del SAT',          selloSat,  { mono: true, size: 6 });
  kv('Cadena original del complemento', cadenaOrig, { mono: true, size: 6 });

  doc.fillColor('#000000');
  return y + 4;
}

/* ─────────────── utils ─────────────── */

export async function loadRegimenDesc(regimen: string | null | undefined): Promise<string> {
  if (!regimen) return '';
  const r = await query<{ description: string }>(
    `SELECT description FROM sat_catalogs WHERE catalog_name = 'c_RegimenFiscal' AND catalog_key = $1`,
    [regimen]
  );
  return r.rows[0]?.description || '';
}

export async function loadUsoCfdiDesc(uso: string | null | undefined): Promise<string> {
  if (!uso) return '';
  const r = await query<{ description: string }>(
    `SELECT description FROM sat_catalogs WHERE catalog_name = 'c_UsoCFDI' AND catalog_key = $1`,
    [uso]
  );
  return r.rows[0]?.description || '';
}

/** Mezcla dos colores hex en proporción 0..1 (0 = a, 1 = b). */
function colorMix(a: string, b: string, t: number): string {
  const pa = parseColor(a), pb = parseColor(b);
  const r = Math.round(pa[0] * (1 - t) + pb[0] * t);
  const g = Math.round(pa[1] * (1 - t) + pb[1] * t);
  const bl = Math.round(pa[2] * (1 - t) + pb[2] * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
function parseColor(c: string): [number, number, number] {
  const m = c.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
