import JSZip from 'jszip';

/**
 * Generates a valid minimal PDF-1.4 document with clean readable Spanish text.
 */
export function buildSamplePdfBytes(): Uint8Array {
  const lines = [
    'Prometheus - Documento Privado Cifrado',
    '',
    'Este documento esta almacenado dentro de tu casillero Prometheus.',
    'Cada archivo importado se cifra localmente con AES-256-GCM antes',
    'de guardarse en el almacenamiento privado de tu navegador.',
    '',
    'Fases de proteccion activas:',
    '1. Contrasena maestra de acceso inicial',
    '2. PIN numerico personal de 6 digitos',
    '3. Llave personal de verificacion criptografica',
  ];

  const textOps = lines
    .map((line, i) => {
      const escaped = line
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
      const y = 740 - i * 22;
      const fontSize = i === 0 ? 18 : 12;
      return `BT /F1 ${fontSize} Tf 56 ${y} Td (${escaped}) Tj ET`;
    })
    .join('\n');

  const streamContent = `${textOps}\n`;

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

/**
 * Generates a calm harmonic WAV audio file (PCM 16-bit mono, 22050 Hz).
 */
export function buildCalmAmbientWav(
  frequencies: number[],
  durationSeconds = 8
): Uint8Array {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Gentle swell envelope
    const fadeIn = Math.min(1, t / 1.2);
    const fadeOut = Math.min(1, (durationSeconds - t) / 1.5);
    const env = fadeIn * fadeOut;

    let sample = 0;
    for (let fIdx = 0; fIdx < frequencies.length; fIdx++) {
      const freq = frequencies[fIdx];
      const slowPulse = 0.55 + 0.45 * Math.sin(2 * Math.PI * (0.18 + fIdx * 0.07) * t);
      sample += Math.sin(2 * Math.PI * freq * t) * slowPulse;
    }
    sample = (sample / Math.max(1, frequencies.length)) * env * 0.24;
    const pcm = Math.max(-1, Math.min(1, sample)) * 32767;
    view.setInt16(44 + i * 2, pcm, true);
  }

  return new Uint8Array(buffer);
}

/**
 * Generates a real .zip archive containing nested files (an image if provided, markdown notes, and JSON).
 */
export async function buildSampleZipBytes(
  nestedImageBytes?: Uint8Array
): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file(
    'Notas_del_Viaje.md',
    [
      '# Bitácora del Lago Alpino',
      '',
      'Día 1 — Niebla matinal sobre la superficie tranquila del agua.',
      'Temperatura: 9°C. Silencio absoluto en la orilla norte.',
      '',
      'Archivos guardados dentro de este archivero ZIP:',
      '- Notas_del_Viaje.md',
      '- Inventario_Equipo.csv',
      '- Fotografia_Interior.jpg',
    ].join('\n')
  );

  zip.file(
    'Inventario_Equipo.csv',
    [
      'Elemento,Categoría,Estado',
      'Cámara 35mm,Óptica,Lista',
      'Grabadora de campo,Audio,Cargada',
      'Cuaderno de bocetos,Notas,En mochila',
    ].join('\n')
  );

  if (nestedImageBytes && nestedImageBytes.byteLength > 0) {
    zip.file('Fotografia_Interior.jpg', nestedImageBytes);
  }

  return zip.generateAsync({ type: 'uint8array' });
}
