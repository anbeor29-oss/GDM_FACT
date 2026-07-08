/**
 * Genera el PDF "GUIA_ICONOS_FACTURAS.pdf" con la descripción de cada
 * icono que puede aparecer en la lista de facturas del ERP (incluidos
 * los ocultos condicionalmente).
 *
 * Uso:
 *   npm run docs:icons
 *
 * Salida:
 *   docs/GUIA_ICONOS_FACTURAS.pdf
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface IconRow {
  simbolo: string;         // representación textual del icono
  nombre: string;
  color: string;
  funcion: string;
  cuandoAparece: string;
}

const ROWS: IconRow[] = [
  {
    simbolo: '⬇  PDF',
    nombre: 'Descargar PDF',
    color: 'rojo',
    funcion:
      'Descarga la representación impresa del CFDI (PDF Anexo 20). Incluye QR SAT, sellos, ' +
      'cadena original, No. Certificado y desglose de impuestos.',
    cuandoAparece: 'Siempre. Si aún no timbra, genera el borrador con leyenda "sin sello del SAT".',
  },
  {
    simbolo: '⬇  XML',
    nombre: 'Descargar XML',
    color: 'verde',
    funcion:
      'Descarga el XML CFDI 4.0 timbrado (o reconstruido a partir de campos persistidos si viene ' +
      'de importación antigua). Es el documento fiscal oficial.',
    cuandoAparece: 'Siempre. Sin timbre el XML no lleva TimbreFiscalDigital pero conserva el resto.',
  },
  {
    simbolo: '👁  Vista previa',
    nombre: 'Vista previa PDF',
    color: 'azul',
    funcion:
      'Abre el PDF en el navegador (inline) sin descargarlo. Útil para verificar antes de enviar ' +
      'por correo o de timbrar.',
    cuandoAparece: 'Siempre.',
  },
  {
    simbolo: '✏  Editar',
    nombre: 'Editar factura',
    color: 'cielo',
    funcion:
      'Abre la factura en modo edición: se pueden cambiar cliente, conceptos, cantidades, precios, ' +
      'forma y método de pago. Al guardar, los totales se recalculan (Anexo 20).',
    cuandoAparece: 'Solo cuando status = DRAFT y is_stamped = false. Una vez timbrada la factura es inmutable.',
  },
  {
    simbolo: '🔖  Timbrar',
    nombre: 'Timbrar factura',
    color: 'morado',
    funcion:
      'Envía la factura al PAC (SW Sapien). El PAC arma el XML, lo sella con el CSD del vault y ' +
      'la timbra ante el SAT. Al éxito, la factura pasa a STAMPED con UUID real.',
    cuandoAparece: 'Cuando no está timbrada, no cancelada, no ya en STAMPED. Rechaza si falta CSD o falla el PAC.',
  },
  {
    simbolo: '💳  Pago',
    nombre: 'Complemento de Pago',
    color: 'verde intenso',
    funcion:
      'Abre el modal para timbrar un Complemento de Pago (CFDI tipo P). Precarga el saldo real ' +
      '(total − pagos − NC). Al timbrar, la factura pasa a PARTIAL_PAYMENT o PAID según cubierto.',
    cuandoAparece:
      'Solo si la factura está timbrada, no cancelada, no DRAFT, y tiene saldo pendiente > $0.01.',
  },
  {
    simbolo: '🪙  Saldo',
    nombre: 'Ver saldo y aplicaciones',
    color: 'ámbar',
    funcion:
      'Modal con desglose: total facturado, pagado, NC aplicadas y saldo. Lista todos los abonos y ' +
      'NC vigentes. Botón "Enviar por correo" desde ahí.',
    cuandoAparece: 'Solo si status = PARTIAL_PAYMENT o PAID (ya tiene actividad de cobro/abono).',
  },
  {
    simbolo: '⏱  Historia',
    nombre: 'Historia de timbres',
    color: 'índigo',
    funcion:
      'Vista cronológica de los CFDIs relacionados: la factura padre, cada NC y cada Complemento de ' +
      'Pago. Descarga PDF/XML por renglón. Botón "Cancelar" en cada dependiente para permitir ' +
      'la cancelación en cascada.',
    cuandoAparece: 'Solo si la factura está timbrada (is_stamped = true).',
  },
  {
    simbolo: '🚫  Cancelar',
    nombre: 'Cancelar factura',
    color: 'naranja',
    funcion:
      'Modal con motivos SAT (01–04). Envía la cancelación al PAC. Si SW rebota con 404 (bug de ' +
      'vault en sandbox), ofrece bypass local para marcar solo en la BD. Si la factura ya está ' +
      'CANCELADA con pac_id = SW_SAPIEN, el mismo botón sirve para "Reintentar en el PAC".',
    cuandoAparece:
      'Cuando la factura no está cancelada, o cuando está cancelada localmente pero aún vigente en SW.',
  },
];

const REGLAS: Array<{ titulo: string; texto: string }> = [
  {
    titulo: 'Regla de cancelación en cascada',
    texto:
      'Si una factura tiene NC o Complementos de Pago vigentes, el sistema exige cancelar primero ' +
      'esos comprobantes desde el ícono Historia. La factura solo se puede cancelar cuando no tiene ' +
      'dependientes vivos.',
  },
  {
    titulo: 'Cálculo de saldo real',
    texto:
      'Saldo = Total − Suma(pagos vigentes) − Suma(NC vigentes). Los pagos/NC cancelados NO se ' +
      'descuentan. Cuando saldo ≤ $0.01, la factura pasa a PAID automáticamente.',
  },
  {
    titulo: 'Regla de edición',
    texto:
      'Solo facturas en estado DRAFT pueden editarse. Una vez timbradas, cualquier cambio requiere ' +
      'cancelar y emitir un nuevo CFDI (SAT no permite alterar comprobantes vivos).',
  },
  {
    titulo: 'Envío por correo',
    texto:
      'Desde el modal Saldo → "Enviar por correo". Se pueden marcar por separado el PDF y el XML de ' +
      'la factura, de cada NC y de cada Complemento de Pago. Adjuntos que fallen se listan en el ' +
      'toast; los que sí generen se envían igual (mailer tolerante).',
  },
];

async function main() {
  const outDir = path.resolve(__dirname, '..', '..', 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'GUIA_ICONOS_FACTURAS.pdf');

  const doc = new PDFDocument({ size: 'letter', margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(outFile);
  doc.pipe(stream);

  /* ─────────────── Portada ─────────────── */
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#1e40af')
    .text('GDM_FAC — ERP CFDI 4.0', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(16).fillColor('#334155')
    .text('Guía de íconos del listado de Facturas', { align: 'center' });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor('#64748b')
    .text(`Generado ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
  doc.moveDown(2);

  doc.font('Helvetica').fontSize(11).fillColor('#0f172a')
    .text(
      'Este documento describe cada uno de los íconos que aparecen en la columna de acciones ' +
      'de una factura, incluidos los que solo se muestran bajo ciertas condiciones (canStamp, ' +
      'canPay, canEdit, etc.). Están en el orden real en que aparecen en la UI, de izquierda ' +
      'a derecha.',
      { align: 'justify' }
    );
  doc.moveDown(1.5);

  /* ─────────────── Tabla de íconos ─────────────── */
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e40af')
    .text('Íconos disponibles (en el orden en que aparecen)');
  doc.moveDown(0.5);

  for (const row of ROWS) {
    // separador
    const y0 = doc.y;
    doc.moveTo(50, y0).lineTo(562, y0).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    // fila
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
      .text(`${row.simbolo}  ·  ${row.nombre}`, { continued: false });
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b')
      .text(`Color: ${row.color}`);
    doc.moveDown(0.2);

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155')
      .text('Función:', { continued: true })
      .font('Helvetica').fillColor('#0f172a')
      .text(' ' + row.funcion, { align: 'justify' });
    doc.moveDown(0.2);

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155')
      .text('Cuándo aparece:', { continued: true })
      .font('Helvetica').fillColor('#0f172a')
      .text(' ' + row.cuandoAparece, { align: 'justify' });
    doc.moveDown(0.8);
  }

  /* ─────────────── Reglas ─────────────── */
  if (doc.y > 620) doc.addPage();
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e40af')
    .text('Reglas de negocio relacionadas');
  doc.moveDown(0.5);

  for (const regla of REGLAS) {
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a')
      .text(regla.titulo);
    doc.font('Helvetica').fontSize(10).fillColor('#334155')
      .text(regla.texto, { align: 'justify' });
    doc.moveDown(0.7);
  }

  /* ─────────────── Pie ─────────────── */
  doc.moveDown(1);
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#64748b')
    .text(
      'Documento auto-generado por scripts/generate-icons-guide.ts. Para actualizarlo, edita ese ' +
      'archivo y vuelve a correr `npm run docs:icons`.',
      { align: 'center' }
    );

  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));

  console.log(`✅ Generado: ${outFile}`);
  const stat = fs.statSync(outFile);
  console.log(`   ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
