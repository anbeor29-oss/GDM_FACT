/**
 * Texto del contrato de prestación de servicios y Términos y Condiciones.
 *
 * ⚠️ EL CONTENIDO LEGAL ESTÁ PENDIENTE. Los bloques marcados
 * `[PENDIENTE — texto legal]` deben redactarlos el abogado de Grupo HCGM: son
 * obligaciones reales de la empresa frente a sus clientes y un texto inventado
 * expone a ambas partes. La ESTRUCTURA y el flujo de firma sí están completos.
 *
 * Reglas al editar:
 *   1. SUBE LA VERSIÓN (`CONTRACT_VERSION`) en cualquier cambio de texto, por
 *      mínimo que parezca. Las firmas ya emitidas quedan atadas al texto que se
 *      firmó (se guarda íntegro), pero los clientes deben firmar la versión
 *      nueva para que el consentimiento corresponda a lo vigente.
 *   2. No metas datos variables fuera de los que inyecta `buildContractText`:
 *      el texto firmado debe ser reproducible byte a byte para verificar la
 *      firma después.
 */

/** Súbela SIEMPRE que cambie el texto. Formato: AAAA-MM-DD.N */
export const CONTRACT_VERSION = '2026-07-16.1';

export interface ContractParty {
  rfc: string;
  businessName: string;
}

/**
 * Arma el texto íntegro que se firmará. Determinista: mismos datos → mismo
 * texto → misma firma verificable. La fecha se pasa explícita (no `new Date()`
 * dentro) para poder reconstruir el documento tal cual se firmó.
 */
export function buildContractText(opts: {
  client: ContractParty;
  signedAt: Date;
}): string {
  const { client, signedAt } = opts;
  // Fecha en hora de México: el contrato es un acto jurídico local y el
  // servidor corre en UTC (error nº3 del README).
  const fecha = signedAt.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `CONTRATO DE PRESTACIÓN DE SERVICIOS
GDM FACTURACIÓN — FACTURACIÓN ELECTRÓNICA CFDI 4.0
Versión de los Términos y Condiciones: ${CONTRACT_VERSION}

PARTES

EL PRESTADOR: GRUPO HCGM, S.A. DE C.V.
  RFC: ${PROVIDER.rfc}
  En lo sucesivo, "HCGM".

EL CLIENTE: ${client.businessName.toUpperCase()}
  RFC: ${client.rfc.toUpperCase()}
  En lo sucesivo, "EL CLIENTE".

Fecha de aceptación: ${fecha}

────────────────────────────────────────────────────────────────────────

PRIMERA — OBJETO

HCGM otorga a EL CLIENTE el uso del sistema GDM Facturación para la emisión de
Comprobantes Fiscales Digitales por Internet (CFDI 4.0) ante el Servicio de
Administración Tributaria, conforme al plan fiscal contratado.

[PENDIENTE — texto legal: alcance exacto del servicio, qué incluye y qué no.]

SEGUNDA — CONTRAPRESTACIÓN Y PLAN FISCAL

EL CLIENTE pagará la renta mensual del plan contratado y, en su caso, los
timbres excedentes al precio unitario vigente.

[PENDIENTE — texto legal: precios, fecha de corte, forma y plazo de pago,
intereses por mora, política de suspensión por falta de pago.]

TERCERA — VIGENCIA Y TERMINACIÓN

[PENDIENTE — texto legal: duración, renovación automática, causales y forma de
terminación anticipada, entregables al terminar.]

CUARTA — OBLIGACIONES DE EL CLIENTE

EL CLIENTE es el único responsable del contenido fiscal de los comprobantes que
emita, de la veracidad de los datos de sus receptores y de la custodia de sus
credenciales de acceso y de su Certificado de Sello Digital (CSD).

[PENDIENTE — texto legal: obligaciones adicionales, uso permitido, prohibiciones.]

QUINTA — TRATAMIENTO DE DATOS Y CONFIDENCIALIDAD

[PENDIENTE — texto legal: aviso de privacidad, finalidades del tratamiento,
transferencias, derechos ARCO, conforme a la LFPDPPP.]

SEXTA — AUDITORÍA Y BITÁCORA DE USO

EL CLIENTE reconoce y acepta que el sistema registra la actividad realizada por
cada uno de los usuarios que EL CLIENTE dé de alta, incluyendo la emisión,
timbrado, cancelación y consulta de comprobantes, con fecha, hora y usuario que
la ejecutó. Dicha bitácora tiene fines de auditoría, seguridad y cumplimiento
fiscal, y su resguardo es obligación de HCGM conforme a la cláusula QUINTA.

EL CLIENTE, en su carácter de responsable de sus propios usuarios, podrá activar
el envío de reportes periódicos de dicha bitácora al correo que designe. EL
CLIENTE se obliga a informar a sus usuarios de esta circunstancia y a que dicho
tratamiento cumpla la normatividad laboral y de datos personales que le resulte
aplicable, liberando a HCGM de cualquier responsabilidad al respecto.

[PENDIENTE — texto legal: revisar redacción con el abogado, en particular el
deslinde de responsabilidad laboral y el plazo de conservación.]

SÉPTIMA — DISPONIBILIDAD Y LIMITACIÓN DE RESPONSABILIDAD

El timbrado depende de un Proveedor Autorizado de Certificación (PAC) y de la
disponibilidad de los servicios del SAT, ajenos al control de HCGM.

[PENDIENTE — texto legal: SLA si aplica, límites de responsabilidad,
exclusiones, fuerza mayor.]

OCTAVA — LEY APLICABLE Y JURISDICCIÓN

[PENDIENTE — texto legal: legislación aplicable y tribunales competentes.]

────────────────────────────────────────────────────────────────────────

ACEPTACIÓN

EL CLIENTE manifiesta que leyó y acepta el presente contrato y los Términos y
Condiciones en su versión ${CONTRACT_VERSION}, y lo firma con la Firma
Electrónica Avanzada (e.firma) del contribuyente ${client.rfc.toUpperCase()},
con los efectos jurídicos que le reconocen el Código de Comercio y el Código
Fiscal de la Federación.

La firma se realiza sobre el texto íntegro de este documento. Cualquier
alteración posterior invalida la firma.
`;
}

/** Datos de HCGM como prestador. El RFC real debe confirmarlo el área legal. */
export const PROVIDER: ContractParty = {
  // TODO-LEGAL: confirmar el RFC de Grupo HCGM, S.A. de C.V. antes de producción.
  rfc: process.env.PLATFORM_COMPANY_RFC || '[PENDIENTE — RFC de Grupo HCGM]',
  businessName: 'GRUPO HCGM, S.A. DE C.V.',
};
