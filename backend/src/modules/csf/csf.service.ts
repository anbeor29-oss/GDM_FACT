/**
 * Extractor de CSF (Constancia de Situación Fiscal) del SAT.
 *
 * Soporta DOS formatos:
 *   - Persona Física (PF):  RFC + CURP + Nombre(s)/Apellidos + Régimen
 *   - Persona Moral (PM):   RFC + Denominación/Razón Social + Régimen Capital + Régimen en tabla
 *
 * IMPORTANTE: `pdf-parse` colapsa los espacios al extraer texto, así que las
 * etiquetas del SAT (que en el PDF se ven separadas: "Código Postal:") llegan
 * pegadas ("CódigoPostal:"). Por eso el matching se hace en el texto
 * SIN ESPACIOS y se recuperan los rangos al original con un mapa de índices.
 *
 * Doc del formato: wiki/procedimientos/extractor-csf-sat.md
 *                  + wiki/procedimientos/extractor-csf-sat-pm.md (2026)
 */

import pdfParse from 'pdf-parse';
import { query } from '../../config/database';

// NOTA: probamos un pagerender custom para preservar espacios entre items del
// PDF, pero el SAT genera el PDF con los valores como UN solo item de texto
// (p.ej. "PROLONGACIONADORATRICES"), así que esa estrategia no recupera espacios.
// Dejamos el extractor estándar; el usuario corrige manualmente esos campos.

export interface CSFRawData {
  // identificación
  rfc: string;
  curp: string;                  // sólo PF
  // PF
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  // PM
  denominacion: string;          // razón social
  regimen_capital: string;       // SA DE CV, SAS, etc.
  // domicilio (común)
  codigo_postal: string;
  tipo_vialidad: string;
  nombre_vialidad: string;
  numero_exterior: string;
  numero_interior: string;
  colonia: string;
  localidad: string;
  municipio: string;
  estado: string;
  // régimen fiscal (texto humano, p.ej. "Régimen General de Ley Personas Morales")
  regimen: string;
  // tipo de contribuyente detectado
  tipo: 'PF' | 'PM';
}

export interface CSFMapped {
  rfc: string;
  businessName: string;
  fiscalRegime: string | null;
  postalCode: string;
  street: string;
  extNumber: string;
  neighborhood: string;
  municipality: string;
  state: string | null;
  city: string;
  raw: CSFRawData;
  unresolvedRegimen: boolean;
  unresolvedState: boolean;
}

// ──────────────────────── Utilitarios ────────────────────────

/**
 * Construye una versión "sin espacios" del texto y un mapa de índices que
 * permite recuperar la posición en el texto original a partir de la posición
 * en el texto sin espacios.
 */
function buildNoSpaceMap(s: string): { noSpace: string; map: number[] } {
  const map: number[] = [];
  let noSpace = '';
  for (let i = 0; i < s.length; i++) {
    if (!/\s/.test(s[i])) {
      noSpace += s[i];
      map.push(i);
    }
  }
  return { noSpace, map };
}

/**
 * Devuelve la posición en el texto ORIGINAL donde aparece `label` ignorando
 * espacios. -1 si no se encuentra.
 */
function findLabelOrig(
  original: string,
  noSpace: string,
  map: number[],
  label: string,
  fromOrig = 0
): number {
  const lbl = label.replace(/\s+/g, '');
  // encontrar el índice mínimo en `noSpace` cuyo `map` apunte >= fromOrig
  let nsStart = 0;
  while (nsStart < map.length && map[nsStart] < fromOrig) nsStart++;
  const idxNS = noSpace.indexOf(lbl, nsStart);
  if (idxNS === -1) return -1;
  return map[idxNS]; // posición en original donde EMPIEZA la etiqueta
}

/** Limpia un valor extraído: espacios sobrantes, caracteres no imprimibles. */
function limpiar(s: string): string {
  return s
    .replace(/ /g, '')       // Chr(160)
    .replace(/\t/g, '')
    .replace(/[^\x20-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae el texto en el original que está entre dos etiquetas (ignorando
 * espacios al buscar las etiquetas).
 */
function extractBetween(
  original: string,
  noSpace: string,
  map: number[],
  startLabel: string,
  endLabel: string,
  fromOrig = 0
): string {
  const startPos = findLabelOrig(original, noSpace, map, startLabel, fromOrig);
  if (startPos === -1) return '';
  // posición donde TERMINA la etiqueta inicial (en original)
  const lbl = startLabel.replace(/\s+/g, '');
  // avanzamos en `noSpace` `lbl.length` posiciones desde el match
  const nsIdx = noSpace.indexOf(lbl, 0);
  const startOrigEnd = map[nsIdx + lbl.length - 1] + 1;
  const endPos = findLabelOrig(original, noSpace, map, endLabel, startOrigEnd);
  if (endPos === -1) return '';
  return limpiar(original.substring(startOrigEnd, endPos));
}

/**
 * Extrae N caracteres del texto original que siguen a `label`.
 */
function extractAfter(
  original: string,
  noSpace: string,
  map: number[],
  label: string,
  largoOriginal: number,
  fromOrig = 0
): string {
  const startPos = findLabelOrig(original, noSpace, map, label, fromOrig);
  if (startPos === -1) return '';
  const lbl = label.replace(/\s+/g, '');
  // posición en noSpace del match
  const nsIdx = (() => {
    let cnt = 0;
    for (let i = 0; i < noSpace.length; i++) {
      if (map[i] === startPos) return i;
      cnt++;
    }
    return -1;
  })();
  if (nsIdx === -1) return '';
  const startOrigEnd = map[nsIdx + lbl.length - 1] + 1;
  return limpiar(original.substring(startOrigEnd, startOrigEnd + largoOriginal));
}

// ──────────────────────── Detección PF / PM ────────────────────────

function detectarTipo(noSpace: string): 'PF' | 'PM' {
  // PM: tiene "Denominación/Razón" o "RégimenCapital"
  if (/Denominaci[oó]n\/Raz[oó]n/i.test(noSpace) || /R[eé]gimenCapital/i.test(noSpace)) {
    return 'PM';
  }
  // PF: tiene "Nombre(s):" o "PrimerApellido:" o "CURP:"
  if (/CURP:/i.test(noSpace) || /PrimerApellido/i.test(noSpace) || /Nombre\(s\)/i.test(noSpace)) {
    return 'PF';
  }
  // fallback: si no hay CURP la suponemos PM
  return /CURP:/i.test(noSpace) ? 'PF' : 'PM';
}

// ──────────────────────── Extractor por tipo ────────────────────────

interface PreText {
  original: string;
  noSpace: string;
  map: number[];
}

function makePreText(texto: string): PreText {
  const original = texto;
  const { noSpace, map } = buildNoSpaceMap(original);
  return { original, noSpace, map };
}

/**
 * RFC: 12 chars (PM) o 13 chars (PF) — siempre [A-ZÑ&0-9].
 * Reglas SAT:
 *   PM = 3 letras + 6 dígitos (YYMMDD) + 3 caracteres de homoclave  → 12 chars
 *   PF = 4 letras + 6 dígitos (YYMMDD) + 3 caracteres de homoclave  → 13 chars
 */
function extractRFC(pre: PreText, isPM: boolean): string {
  const fromAnchor = pre.noSpace.search(/DatosdeIdentificaci[oó]ndel/i);
  let fromOrig = 0;
  if (fromAnchor !== -1 && pre.map[fromAnchor]) fromOrig = pre.map[fromAnchor];

  const after = extractAfter(pre.original, pre.noSpace, pre.map, 'RFC:', 20, fromOrig);
  // Anclamos el regex al INICIO del valor para evitar agarrar la "D" que sigue
  // pegada cuando viene "GHC1707275Y0Datos…". Diferenciamos por tipo.
  const re = isPM
    ? /^([A-ZÑ&]{3}\d{6}[A-Z0-9]{3})/
    : /^([A-ZÑ&]{4}\d{6}[A-Z0-9]{3})/;
  const m = after.replace(/\s+/g, '').match(re);
  if (m) return m[1];
  // Fallback: alguno largo
  const m2 = after.match(/[A-ZÑ&0-9]{12,13}/);
  return m2 ? (isPM ? m2[0].slice(0, 12) : m2[0].slice(0, 13)) : after;
}

/* ---------------------- Extractor PF ---------------------- */

function extractPF(pre: PreText): CSFRawData {
  const { original, noSpace, map } = pre;
  return {
    rfc: extractRFC(pre, false),
    curp: extractAfter(original, noSpace, map, 'CURP:', 18).match(/[A-Z0-9]{18}/)?.[0] || '',
    nombre:           extractBetween(original, noSpace, map, 'Nombre(s):',       'PrimerApellido:'),
    apellido_paterno: extractBetween(original, noSpace, map, 'PrimerApellido:',  'SegundoApellido:'),
    apellido_materno: extractBetween(original, noSpace, map, 'SegundoApellido:', 'Fechainicio'),
    denominacion: '',
    regimen_capital: '',
    codigo_postal:   extractBetween(original, noSpace, map, 'CódigoPostal:',      'TipodeVialidad:'),
    tipo_vialidad:   extractBetween(original, noSpace, map, 'TipodeVialidad:',    'NombredeVialidad:'),
    nombre_vialidad: extractBetween(original, noSpace, map, 'NombredeVialidad:',  'NúmeroExterior:'),
    numero_exterior: extractBetween(original, noSpace, map, 'NúmeroExterior:',    'NúmeroInterior:'),
    numero_interior: extractBetween(original, noSpace, map, 'NúmeroInterior:',    'NombredelaColonia:'),
    colonia:         extractBetween(original, noSpace, map, 'NombredelaColonia:',    'NombredelaLocalidad:'),
    localidad:       extractBetween(original, noSpace, map, 'NombredelaLocalidad:',  'NombredelMunicipio'),
    municipio:       extractBetween(original, noSpace, map, 'NombredelMunicipiooDemarcaciónTerritorial:', 'NombredelaEntidad'),
    estado:          extractBetween(original, noSpace, map, 'NombredelaEntidadFederativa:', 'EntreCalle'),
    regimen:         extractBetween(original, noSpace, map, 'Régimen', 'FechaInicio'),
    tipo: 'PF',
  };
}

/* ---------------------- Extractor PM ---------------------- */

function extractPM(pre: PreText): CSFRawData {
  const { original, noSpace, map } = pre;

  // Denominación/Razón Social: el SAT escribe "Denominación/Razón Social:" y
  // termina cuando aparece la siguiente etiqueta "Régimen Capital:".
  const denominacion = extractBetween(
    original, noSpace, map,
    'Denominación/RazónSocial:',
    'RégimenCapital:'
  );

  const regimenCapital = extractBetween(
    original, noSpace, map,
    'RégimenCapital:',
    'NombreComercial:'
  );

  // Régimen fiscal: aparece en la sección "Regímenes:" como tabla
  // "RégimenFecha InicioFecha Fin / <Nombre del régimen><dd/mm/yyyy>..."
  // Estrategia: tomamos todo entre "Regímenes:" y "Obligaciones:" (o final),
  // saltamos el primer "Régimen" (que es header pegado a "Fecha") y tomamos
  // el texto hasta la primera fecha dd/mm/yyyy.
  const seccionRegimenes = extractBetween(
    original, noSpace, map,
    'Regímenes:',
    'Obligaciones:'
  ) || extractBetween(original, noSpace, map, 'Regímenes:', 'Susdatos');

  let regimenTexto = '';
  if (seccionRegimenes) {
    // En la sección puede haber:
    //   "Régimen Fecha Inicio Fecha Fin Régimen General de Ley Personas Morales 27/07/2017 …"
    // Quitamos el header inicial si aparece.
    const sinHeader = seccionRegimenes
      .replace(/^\s*R[eé]gimen\s+Fecha\s*Inicio\s*Fecha\s*Fin\s*/i, '')
      .replace(/^\s*R[eé]gimenFechaInicioFechaFin\s*/i, '');
    // Cortamos en la primera fecha dd/mm/yyyy
    const m = sinHeader.match(/(.+?)\d{2}\/\d{2}\/\d{4}/);
    regimenTexto = (m ? m[1] : sinHeader).trim();
  }

  return {
    rfc: extractRFC(pre, true),
    curp: '',
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    denominacion,
    regimen_capital: regimenCapital,
    codigo_postal:   extractBetween(original, noSpace, map, 'CódigoPostal:',      'TipodeVialidad:'),
    tipo_vialidad:   extractBetween(original, noSpace, map, 'TipodeVialidad:',    'NombredeVialidad:'),
    nombre_vialidad: extractBetween(original, noSpace, map, 'NombredeVialidad:',  'NúmeroExterior:'),
    numero_exterior: extractBetween(original, noSpace, map, 'NúmeroExterior:',    'NúmeroInterior:'),
    numero_interior: extractBetween(original, noSpace, map, 'NúmeroInterior:',    'NombredelaColonia:'),
    colonia:         extractBetween(original, noSpace, map, 'NombredelaColonia:',    'NombredelaLocalidad:'),
    localidad:       extractBetween(original, noSpace, map, 'NombredelaLocalidad:',  'NombredelMunicipio'),
    municipio:       extractBetween(original, noSpace, map, 'NombredelMunicipiooDemarcaciónTerritorial:', 'NombredelaEntidad'),
    estado:          extractBetween(original, noSpace, map, 'NombredelaEntidadFederativa:', 'EntreCalle'),
    regimen: regimenTexto,
    tipo: 'PM',
  };
}

// ──────────────────────── Extractor principal ────────────────────────

export async function extractCSFRaw(pdfBuffer: Buffer): Promise<CSFRawData> {
  const data = await pdfParse(pdfBuffer);
  const texto: string = (data.text || '').replace(/\r/g, ' ').replace(/\n/g, ' ');
  if (!texto.trim()) {
    throw new Error('El PDF no contiene texto extraíble (¿es una imagen escaneada?).');
  }

  const pre = makePreText(texto);
  const tipo = detectarTipo(pre.noSpace);
  return tipo === 'PM' ? extractPM(pre) : extractPF(pre);
}

// ──────────────────────── Mapeo a esquema del sistema ────────────────────────

function norm(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Como norm() pero sin espacios — para comparar contra texto del PDF
 *  donde los espacios se perdieron en el parsing. */
function normNS(s: string): string {
  return norm(s).replace(/\s+/g, '');
}

async function resolveRegimen(desc: string): Promise<string | null> {
  if (!desc) return null;
  const numMatch = desc.match(/\b(6\d{2})\b/);
  if (numMatch) return numMatch[1];

  const r = await query<{ catalog_key: string; description: string }>(
    `SELECT catalog_key, description FROM sat_catalogs WHERE catalog_name = 'c_RegimenFiscal'`
  );
  // Comparamos sin espacios para tolerar el "RégimenGeneraldeLeyPersonasMorales"
  // que sale del PDF cuando se pierden los espacios.
  const target   = norm(desc);
  const targetNS = normNS(desc);
  let best: { key: string; score: number } | null = null;
  for (const row of r.rows) {
    const cand   = norm(row.description);
    const candNS = normNS(row.description);
    if (cand === target || candNS === targetNS) return row.catalog_key;
    if (targetNS.includes(candNS) || candNS.includes(targetNS)) {
      const score = Math.min(candNS.length, targetNS.length);
      if (!best || score > best.score) best = { key: row.catalog_key, score };
    }
  }
  return best?.key ?? null;
}

async function resolveEstado(desc: string): Promise<string | null> {
  if (!desc) return null;
  const r = await query<{ catalog_key: string; description: string }>(
    `SELECT catalog_key, description FROM sat_catalogs WHERE catalog_name = 'c_Estado'`
  );
  const target = norm(desc);
  for (const row of r.rows) {
    if (norm(row.description) === target) return row.catalog_key;
  }
  const alias: Record<string, string> = {
    'CIUDAD DE MEXICO': 'CMX',
    'DISTRITO FEDERAL': 'CMX',
    'EDO DE MEXICO': 'MEX',
    'ESTADO DE MEXICO': 'MEX',
  };
  return alias[target] ?? null;
}

export async function mapCSFToCustomer(raw: CSFRawData): Promise<CSFMapped> {
  // Razón social: PM usa denominacion + regimen_capital concatenado;
  // PF usa nombre + apellidos.
  let businessName = '';
  if (raw.tipo === 'PM') {
    businessName = [raw.denominacion, raw.regimen_capital].filter(Boolean).join(' ').trim();
  } else {
    businessName = [raw.nombre, raw.apellido_paterno, raw.apellido_materno]
      .filter(Boolean).join(' ').trim();
  }

  const [fiscalRegime, state] = await Promise.all([
    resolveRegimen(raw.regimen),
    resolveEstado(raw.estado),
  ]);

  return {
    rfc: raw.rfc.toUpperCase(),
    businessName: businessName.toUpperCase(),
    fiscalRegime,
    postalCode: raw.codigo_postal,
    street: raw.nombre_vialidad.toUpperCase(),
    extNumber: raw.numero_exterior,
    neighborhood: raw.colonia.toUpperCase(),
    municipality: raw.municipio.toUpperCase(),
    state,
    city: raw.localidad.toUpperCase(),
    raw,
    unresolvedRegimen: !!raw.regimen && !fiscalRegime,
    unresolvedState: !!raw.estado && !state,
  };
}
