import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';
import zlib from 'node:zlib';
import {
  DocumentIntegrityReport,
  ProtectedTokenItem,
  ProtectedTokenMap,
} from './types';
import {
  countWordsConsistent,
  extractProtectedTokens,
  validateTextAndTokenIntegrity,
} from './validatorAndPipeline';

export interface DocumentExtractionResult {
  fileName: string;
  fileType: 'docx' | 'pdf' | 'txt';
  extractedText: string;
  wordCount: number;
  charCount: number;
  protectedTokens: string[];
  protectedTokenItems: ProtectedTokenItem[];
  protectedMap: ProtectedTokenMap;
  integrityReport: DocumentIntegrityReport;
}

/**
 * Normalisasi whitespace pasca-ekstraksi tanpa mengubah isi, angka, tanda baca, atau makna kalimat.
 */
function normalizeCleanUnicodeText(raw: string): string {
  return raw
    .replace(/\uFEFF/g, '') // Hapus BOM jika ada di awal
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // Normalisasi non-breaking/zero-width spaces ke spasi biasa
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/**
 * Cek apakah Buffer diawali dengan magic bytes ZIP (PK\x03\x04) untuk dokumen Office Open XML (.docx)
 */
function hasZipMagicHeader(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 && // 'P'
    buf[1] === 0x4b && // 'K'
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

/**
 * Cek apakah Buffer diawali dengan magic bytes PDF (%PDF-)
 */
function hasPdfMagicHeader(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  const header = buf.subarray(0, 8).toString('ascii');
  return header.includes('%PDF-');
}

/**
 * Cek apakah Buffer adalah file biner (ZIP, PDF, OLE2 .doc, PNG, JPEG, atau mengandung null byte)
 */
function isBinaryBuffer(buf: Buffer): { isBinary: boolean; reason?: string } {
  if (hasZipMagicHeader(buf)) {
    return {
      isBinary: true,
      reason: 'File memiliki header arsip biner ZIP/DOCX (PK\\x03\\x04).',
    };
  }
  if (hasPdfMagicHeader(buf)) {
    return {
      isBinary: true,
      reason: 'File memiliki header biner PDF (%PDF-).',
    };
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  ) {
    return {
      isBinary: true,
      reason: 'File memiliki header biner Microsoft Compound Document (.doc lawas OLE2).',
    };
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { isBinary: true, reason: 'File merupakan citra biner PNG.' };
  }

  // Cek apakah bukan UTF-16 BOM tetapi mengandung null bytes (\x00)
  const isUtf16Le = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
  const isUtf16Be = buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff;
  if (!isUtf16Le && !isUtf16Be) {
    const checkLen = Math.min(buf.length, 8192);
    for (let i = 0; i < checkLen; i++) {
      if (buf[i] === 0x00) {
        return {
          isBinary: true,
          reason: 'Ditemukan byte null (0x00) biner di dalam aliran teks.',
        };
      }
    }
  }

  return { isBinary: false };
}

/**
 * Ekstraksi file .docx sebagai dokumen Office Open XML menggunakan Mammoth.js.
 * DILARANG membaca byte .docx menggunakan pembacaan teks mentah (utf8 string dari byte ZIP).
 */
export async function extractDocxFromBuffer(
  buf: Buffer,
  fileName: string = 'dokumen.docx'
): Promise<string> {
  if (!buf || buf.length === 0) {
    throw new Error(`Dokumen DOCX "${fileName}" kosong (0 byte).`);
  }

  // Tolak file .doc lawas (OLE2) dengan pesan jelas
  if (
    buf.length >= 4 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  ) {
    throw new Error(
      `Gagal mengekstrak "${fileName}": File ini berformat biner .doc lawas (OLE2), bukan Office Open XML (.docx). Simpan ulang sebagai .docx terlebih dahulu.`
    );
  }

  if (!hasZipMagicHeader(buf)) {
    throw new Error(
      `Gagal mengekstrak "${fileName}": File bukan dokumen Office Open XML (.docx) yang valid atau arsip rusak.`
    );
  }

  try {
    const result = await mammoth.extractRawText({ buffer: buf });
    const cleaned = normalizeCleanUnicodeText(result.value || '');
    if (!cleaned) {
      throw new Error(
        `Dokumen DOCX "${fileName}" tidak mengandung teks yang dapat diekstrak.`
      );
    }
    return cleaned;
  } catch (err: any) {
    const msg = err?.message || 'Arsip Office Open XML rusak';
    throw new Error(
      `Gagal mengekstrak dokumen DOCX "${fileName}": ${msg}. Pastikan file .docx tidak rusak atau terenkripsi.`
    );
  }
}

/**
 * Ekstraksi file .txt / .md / .csv menggunakan TextDecoder Unicode yang ketat (fatal: true).
 */
export function extractTxtFromBuffer(
  buf: Buffer,
  fileName: string = 'dokumen.txt'
): string {
  if (!buf || buf.length === 0) {
    throw new Error(`File teks "${fileName}" kosong (0 byte).`);
  }

  const binCheck = isBinaryBuffer(buf);
  if (binCheck.isBinary) {
    throw new Error(
      `Gagal membaca file teks "${fileName}": ${binCheck.reason} Jangan mengunggah file biner sebagai teks mentah.`
    );
  }

  let decoded = '';
  try {
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      const dec16Le = new TextDecoder('utf-16le', { fatal: true });
      decoded = dec16Le.decode(buf.subarray(2));
    } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      const dec16Be = new TextDecoder('utf-16be', { fatal: true });
      decoded = dec16Be.decode(buf.subarray(2));
    } else {
      const decUtf8 = new TextDecoder('utf-8', { fatal: true });
      decoded = decUtf8.decode(buf);
    }
  } catch {
    throw new Error(
      `Gagal mendekode file teks "${fileName}": Ditemukan urutan byte non-UTF8 ilegal atau encoding rusak.`
    );
  }

  const cleaned = normalizeCleanUnicodeText(decoded);
  if (!cleaned) {
    throw new Error(`File teks "${fileName}" kosong setelah dinormalisasi.`);
  }
  return cleaned;
}

/**
 * Ekstraksi file .pdf menggunakan parser PDF kompatibel (unpdf / PDF.js) dengan penanganan error eksplisit.
 */
export async function extractPdfFromBuffer(
  buf: Buffer,
  fileName: string = 'dokumen.pdf'
): Promise<string> {
  if (!buf || buf.length === 0) {
    throw new Error(`Dokumen PDF "${fileName}" kosong (0 byte).`);
  }

  if (!hasPdfMagicHeader(buf)) {
    throw new Error(
      `Gagal mengekstrak "${fileName}": Header %PDF- tidak ditemukan atau file PDF rusak.`
    );
  }

  try {
    const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const parsed = await extractPdfText(uint8, { mergePages: true });
    const textOutput: unknown = parsed.text;
    const rawText =
      typeof textOutput === 'string'
        ? textOutput
      : Array.isArray(textOutput)
        ? textOutput.join('\n')
        : '';
    const cleaned = normalizeCleanUnicodeText(rawText);

    if (!cleaned) {
      throw new Error(
        `Dokumen PDF "${fileName}" tidak memiliki lapisan teks Unicode yang dapat dibaca (kemungkinan hasil scan gambar tanpa OCR).`
      );
    }
    return cleaned;
  } catch (err: any) {
    const msg = err?.message || 'Struktur PDF rusak';
    if (msg.includes('lapisan teks Unicode')) {
      throw err;
    }
    throw new Error(
      `Gagal mengekstrak dokumen PDF "${fileName}": Dokumen PDF rusak, terenkripsi, atau gagal diparse (${msg}).`
    );
  }
}

/**
 * Pipeline Ekstraksi & Validasi Integritas Terpadu untuk .docx, .txt, dan .pdf.
 * Menjamin:
 * - Ekstraksi sesuai format dokumen asli (Office Open XML untuk .docx, PDF parser untuk .pdf, TextDecoder ketat untuk .txt)
 * - Validasi integritas 6 tahap sebelum token SAP diekstrak dan sebelum teks dikirim ke AI
 * - Kegagalan parsing ditolak secara eksplisit tanpa klaim palsu "Berhasil mengekstrak"
 */
export async function extractAndValidateDocument(params: {
  fileName: string;
  contentBase64?: string;
  plainText?: string;
  buffer?: Buffer;
}): Promise<DocumentExtractionResult> {
  const fileName = (params.fileName || 'dokumen-sumber.txt').trim();
  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';

  let rawBuffer: Buffer | undefined = params.buffer;
  if (
    !rawBuffer &&
    typeof params.contentBase64 === 'string' &&
    params.contentBase64.trim().length > 0
  ) {
    rawBuffer = Buffer.from(params.contentBase64.trim(), 'base64');
  }

  let extractedText = '';
  let fileType: 'docx' | 'pdf' | 'txt' = 'txt';

  if (ext === 'docx' || ext === 'doc') {
    fileType = 'docx';
    if (!rawBuffer) {
      throw new Error(
        `Gagal memproses "${fileName}": File .docx wajib dikirim sebagai buffer biner Office Open XML, bukan pembacaan teks mentah.`
      );
    }
    extractedText = await extractDocxFromBuffer(rawBuffer, fileName);
  } else if (ext === 'pdf') {
    fileType = 'pdf';
    if (!rawBuffer) {
      throw new Error(
        `Gagal memproses "${fileName}": File .pdf wajib dikirim sebagai buffer biner untuk diparse oleh ekstraktor PDF.`
      );
    }
    extractedText = await extractPdfFromBuffer(rawBuffer, fileName);
  } else {
    fileType = 'txt';
    if (rawBuffer) {
      extractedText = extractTxtFromBuffer(rawBuffer, fileName);
    } else if (typeof params.plainText === 'string') {
      const cleaned = normalizeCleanUnicodeText(params.plainText);
      if (!cleaned) {
        throw new Error(`Dokumen teks "${fileName}" kosong.`);
      }
      extractedText = cleaned;
    } else {
      throw new Error(`Tidak ada konten dokumen yang dikirim untuk "${fileName}".`);
    }
  }

  // Ekstrak Protected Tokens (SAP) dan jalankan Validasi Integritas 6 tahap
  const protectedMap = extractProtectedTokens(extractedText);
  const integrityReport =
    protectedMap.integrity ||
    validateTextAndTokenIntegrity(extractedText, protectedMap);

  if (integrityReport.status === 'ERROR' || !integrityReport.valid) {
    throw new Error(
      `Validasi Integritas Dokumen "${fileName}" Gagal: ${integrityReport.errors.join(' ')}`
    );
  }

  const words = countWordsConsistent(extractedText);

  return {
    fileName,
    fileType,
    extractedText,
    wordCount: words.length,
    charCount: extractedText.length,
    protectedTokens: protectedMap.tokens,
    protectedTokenItems: protectedMap.items,
    protectedMap,
    integrityReport,
  };
}

/**
 * Helper pembangun file .docx (Office Open XML ZIP terkompresi) asli di memori untuk pengujian regresi.
 * Menggunakan kompresi DEFLATE standar sehingga menguji dekompresi ZIP & parser XML Mammoth secara nyata.
 */
export function buildValidDocxBuffer(paragraphs: string[]): Buffer {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const bodyXml = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`)
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const files: Array<{ name: string; data: Buffer }> = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypesXml, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(relsXml, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
  ];

  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const uncompressed = file.data;
    // Gunakan DEFLATE (method 8) agar byte di dalam ZIP benar-benar terkompresi biner seperti Word asli
    const compressed = zlib.deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30 + nameBuf.length + compressed.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method: 8 (DEFLATE)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);
    compressed.copy(localHeader, 30 + nameBuf.length);
    localHeaders.push(localHeader);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10); // method 8 (DEFLATE)
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Helper pembangun file PDF 1.4 minimalis yang valid untuk pengujian regresi ekstraksi PDF.
 */
export function buildValidPdfBuffer(textLines: string[]): Buffer {
  const escapePdfText = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const streamOps = [
    'BT',
    '/F1 12 Tf',
    '50 750 Td',
    '16 TL',
    ...textLines.map((line, idx) =>
      idx === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`
    ),
    'ET',
  ].join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamOps, 'utf8')} >>\nstream\n${streamOps}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
