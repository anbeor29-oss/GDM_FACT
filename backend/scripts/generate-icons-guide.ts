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
  formaIcono: string;      // descripción de la forma visual (Lucide icon name)
  nombre: string;
  colorNombre: string;     // nombre legible
  colorHex: string;        // barra de color al lado
  funcion: string;
  cuandoAparece: string;
}

const ROWS: IconRow[] = [
  {
    formaIcono: 'Icono FileDown (documento con flecha hacia abajo)',
    nombre: 'Descargar PDF',
    colorNombre: 'rojo',
    colorHex: '#dc2626',
    funcion:
      'Descarga la representacion impresa del CFDI (PDF Anexo 20). Incluye QR SAT, sellos, ' +
      'cadena original, No. Certificado y desglose de impuestos.',
    cuandoAparece: 'Siempre. Si aun no timbra, genera el borrador con leyenda "sin sello del SAT".',
  },
  {
    formaIcono: 'Icono Download (flecha hacia abajo)',
    nombre: 'Descargar XML',
    colorNombre: 'verde',
    colorHex: '#16a34a',
    funcion:
      'Descarga el XML CFDI 4.0 timbrado (o reconstruido a partir de campos persistidos si viene ' +
      'de importacion antigua). Es el documento fiscal oficial.',
    cuandoAparece: 'Siempre. Sin timbre el XML no lleva TimbreFiscalDigital pero conserva el resto.',
  },
  {
    formaIcono: 'Icono Eye (ojo)',
    nombre: 'Vista previa PDF',
    colorNombre: 'azul',
    colorHex: '#2563eb',
    funcion:
      'Abre el PDF en el navegador (inline) sin descargarlo. Util para verificar antes de enviar ' +
      'por correo o de timbrar.',
    cuandoAparece: 'Siempre.',
  },
  {
    formaIcono: 'Icono Pencil (lapiz)',
    nombre: 'Editar factura',
    colorNombre: 'cielo',
    colorHex: '#0284c7',
    funcion:
      'Abre la factura en modo edicion: se pueden cambiar cliente, conceptos, cantidades, precios, ' +
      'forma y metodo de pago. Al guardar, los totales se recalculan (Anexo 20).',
    cuandoAparece: 'Solo cuando status = DRAFT y is_stamped = false. Una vez timbrada la factura es inmutable.',
  },
  {
    formaIcono: 'Icono Stamp (sello)',
    nombre: 'Timbrar factura',
    colorNombre: 'morado',
    colorHex: '#9333ea',
    funcion:
      'Envia la factura al PAC (SW Sapien). El PAC arma el XML, lo sella con el CSD del vault y ' +
      'la timbra ante el SAT. Al exito, la factura pasa a STAMPED con UUID real.',
    cuandoAparece: 'Cuando no esta timbrada, no cancelada, no ya en STAMPED. Rechaza si falta CSD o falla el PAC.',
  },
  {
    formaIcono: 'Icono Wallet (cartera)',
    nombre: 'Complemento de Pago',
    colorNombre: 'verde intenso',
    colorHex: '#15803d',
    funcion:
      'Abre el modal para timbrar un Complemento de Pago (CFDI tipo P). Precarga el saldo real ' +
      '(total - pagos - NC). Al timbrar, la factura pasa a PARTIAL_PAYMENT o PAID segun cubierto.',
    cuandoAparece:
      'Solo si la factura esta timbrada, no cancelada, no DRAFT, y tiene saldo pendiente > $0.01.',
  },
  {
    formaIcono: 'Icono Coins (monedas)',
    nombre: 'Ver saldo y aplicaciones',
    colorNombre: 'ambar',
    colorHex: '#d97706',
    funcion:
      'Modal con desglose: total facturado, pagado, NC aplicadas y saldo. Lista todos los abonos y ' +
      'NC vigentes. Boton "Enviar por correo" desde ahi.',
    cuandoAparece: 'Solo si status = PARTIAL_PAYMENT o PAID (ya tiene actividad de cobro/abono).',
  },
  {
    formaIcono: 'Icono History (reloj con flecha antihoraria)',
    nombre: 'Historia de timbres',
    colorNombre: 'indigo',
    colorHex: '#4f46e5',
    funcion:
      'Vista cronologica de los CFDIs relacionados: la factura padre, cada NC y cada Complemento de ' +
      'Pago. Descarga PDF/XML por renglon. Boton "Cancelar" en cada dependiente para permitir ' +
      'la cancelacion en cascada.',
    cuandoAparece: 'Solo si la factura esta timbrada (is_stamped = true).',
  },
  {
    formaIcono: 'Icono Ban (circulo con diagonal)',
    nombre: 'Cancelar factura',
    colorNombre: 'naranja',
    colorHex: '#ea580c',
    funcion:
      'Modal con motivos SAT (01-04). Envia la cancelacion al PAC. Si SW rebota con 404 (bug de ' +
      'vault en sandbox), ofrece bypass local para marcar solo en la BD. Si la factura ya esta ' +
      'CANCELADA con pac_id = SW_SAPIEN, el mismo boton sirve para "Reintentar en el PAC".',
    cuandoAparece:
      'Cuando la factura no esta cancelada, o cuando esta cancelada localmente pero aun vigente en SW.',
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
  let outFile = path.join(outDir, 'GUIA_ICONOS_FACTURAS.pdf');

  // Si el archivo actual está bloqueado (visor PDF abierto), caemos a un
  // nombre alternativo para no romper el flujo.
  try {
    const fd = fs.openSync(outFile, 'w');
    fs.closeSync(fd);
  } catch {
    outFile = path.join(outDir, `GUIA_ICONOS_FACTURAS-${new Date().toISOString().slice(0, 10)}.pdf`);
    console.warn(`⚠  Archivo original bloqueado por otro proceso — usando ${path.basename(outFile)}`);
  }

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
    // Nueva página si el bloque no cabe (≈75pt)
    if (doc.y > 680) doc.addPage();

    // separador
    const y0 = doc.y;
    doc.moveTo(50, y0).lineTo(562, y0).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    // Barra de color a la izquierda + título
    const rowY = doc.y;
    doc.rect(50, rowY + 1, 8, 14).fill(row.colorHex);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12)
      .text(row.nombre, 65, rowY);
    doc.moveDown(0.3);

    // Descripción visual del icono (para que sepan qué buscar en pantalla)
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b')
      .text(`${row.formaIcono}. Color: ${row.colorNombre}.`, 50);
    doc.moveDown(0.3);

    // Función
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155')
      .text('Funcion:', { continued: true })
      .font('Helvetica').fillColor('#0f172a')
      .text(' ' + row.funcion, { align: 'justify' });
    doc.moveDown(0.2);

    // Cuándo aparece
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155')
      .text('Cuando aparece:', { continued: true })
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
