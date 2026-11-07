import {
  DocumentSemanticCategory,
  DocumentSemanticClassification,
  SemanticSectionItem,
} from './types';
import { stripReferenceMetadataFromSourceText } from './validatorAndPipeline';

/**
 * Daftar pola instruksi dokumen, master framework, dan metadata internal aplikasi
 * yang WAJIB diisolasi dan TIDAK BOLEH dianggap sebagai isi narasi atau klaim faktual.
 */
export const DOCUMENT_INSTRUCTION_PATTERNS: RegExp[] = [
  /^(?:\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\])/i,
  /^(?:master\s+framework|master\s+template|framework\s+penulisan|framework\s+naskah)(?:\s*[:=-]|\s*$)/i,
  /^(?:perencanaan\s+naskah\s*(?:youtube)?\s*presisi|perencanaan\s+presisi)(?:\s*[:=-]|\s*$)/i,
  /^(?:dokumen\s+kerangka\s*(?:kerja)?|kerangka\s+kerja\s+naskah|kerangka\s+tulisan)(?:\s*[:=-]|\s*$)/i,
  /^(?:petunjuk\s+pengerjaan|panduan\s+penulisan|panduan\s+pengerjaan|instruksi\s+penulisan|instruksi\s+khusus)(?:\s*[:=-]|\s*$)/i,
  /^(?:aturan\s+sistem|konfigurasi\s+sistem|kontrak\s+penulisan|guidelines?)(?:\s*[:=-]|\s*$)/i,
  /^(?:non[_\s-]sara[_\s-]hard[_\s-]guard|sudut\s*pandang\s*kritis\s*terkunci)(?:\s*[:=-]|\s*$)/i,
  /^(?:perilaku\s*&\s*pola\s*pikir\s*masyarakat\s*\(non-sara\))(?:\s*[:=-]|\s*$)/i,
  /^(?:target\s+durasi|durasi|wpm|target\s+kata|mode\s+durasi|jumlah\s+blok|struktur|operasi|model|seed)\s*[:=]/i,
  /^(?:aturan\s*\d+|rule\s*\d+|poin\s*\d+\s*kontrak|pasal\s*kontrak)\s*[:=]/i,
  /^(?:tahap\s*\d+|blok\s*\d+|hook\s*\(\d+%\)|akar\s+masalah\s*\(\d+%\)|inti\s+masalah\s*\(\d+%\)|penyelesaian\s*\(\d+%\)|kesimpulan\s*\(\d+%\))\s*[:=]/i,
  /^(?:tulis\s+naskah|hasilkan\s+narasi|gunakan\s+gaya|jangan\s+gunakan|note\s+for\s+ai|prompt\s*[:=])/i,
];

/**
 * Daftar frasa metadata/instruksi terlarang yang tidak boleh bocor ke naskah narasi.
 */
export const FORBIDDEN_LEAKED_PHRASES: Array<{ phrase: string; regex: RegExp; label: string }> = [
  {
    phrase: '[GENFLOW_DOCUMENT_START]',
    regex: /\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/i,
    label: 'Tag Penanda Dokumen Framework',
  },
  {
    phrase: '[GF-XX]',
    regex: /\[GF-[0-9A-Z_-]+\]/i,
    label: 'Tag Komponen Framework',
  },
  {
    phrase: 'MASTER FRAMEWORK',
    regex: /\bmaster\s+framework\b/i,
    label: 'Header Master Framework',
  },
  {
    phrase: 'PERENCANAAN NASKAH YOUTUBE PRESISI',
    regex: /\bperencanaan\s+naskah\s*youtube\s*presisi\b/i,
    label: 'Header Perencanaan Presisi',
  },
  {
    phrase: 'DOKUMEN KERANGKA KERJA',
    regex: /\bdokumen\s+kerangka\s*(?:kerja)?\b/i,
    label: 'Header Dokumen Kerangka',
  },
  {
    phrase: 'NON_SARA_HARD_GUARD',
    regex: /\bnon[_\s-]sara[_\s-]hard[_\s-]guard\b/i,
    label: 'Konstanta Penjaga Sistem Non-SARA',
  },
  {
    phrase: 'Perilaku & Pola Pikir Masyarakat (Non-SARA)',
    regex: /\bperilaku\s*(?:&|dan)\s*pola\s*pikir\s*masyarakat\s*\(non-sara\)\b/i,
    label: 'Label Konfigurasi Internal Sudut Pandang Terkunci',
  },
  {
    phrase: 'LOCKED_CRITICAL_PERSPECTIVE',
    regex: /\blocked_critical_perspective\b/i,
    label: 'Variabel Sistem Internal',
  },
  {
    phrase: 'FAKTA_TERVERIFIKASI',
    regex: /\bfakta_terverifikasi\b/i,
    label: 'Variabel Sistem Fakta',
  },
  {
    phrase: 'NASKAH_FINAL',
    regex: /\bnaskah_final\b/i,
    label: 'Variabel Operasi Internal',
  },
  {
    phrase: 'SCTF 5 Blok',
    regex: /\bsctf\s*5\s*blok\b/i,
    label: 'Penanda Format Internal',
  },
  {
    phrase: 'KONTRAK KONTEN',
    regex: /\bkontrak\s+konten\b/i,
    label: 'Penanda Kontrak Internal',
  },
];

/**
 * Ekstraksi kata-kata kunci topik bernilai semantis tinggi (mengabaikan stopword umum).
 */
export function extractThematicKeywords(text: string): string[] {
  if (!text) return [];
  const stopwords = new Set([
    'dan', 'atau', 'yang', 'ini', 'itu', 'di', 'ke', 'dari', 'untuk', 'pada',
    'dengan', 'adalah', 'yaitu', 'yakni', 'sebagai', 'oleh', 'karena', 'maka',
    'namun', 'tetapi', 'tapi', 'jika', 'kalau', 'bila', 'ketika', 'saat', 'sudah',
    'telah', 'akan', 'bisa', 'dapat', 'harus', 'wajib', 'ada', 'tidak', 'nggak',
    'bukan', 'gue', 'lo', 'kita', 'mereka', 'orang', 'masyarakat', 'hanya', 'cuma',
    'secara', 'lebih', 'paling', 'sangat', 'amat', 'sebuah', 'suatu', 'para',
    'banyak', 'sedikit', 'semua', 'seluruh', 'hal', 'soal', 'tentang', 'terkait',
    'pembahasan', 'naskah', 'narasi', 'video', 'youtube', 'blok', 'tahap',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim().replace(/^[-']+|[-']+$/g, ''))
    .filter((w) => w.length >= 3 && !stopwords.has(w));

  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

/**
 * Ekstraksi judul dokumen dari nama file atau baris teratas.
 */
export function cleanDocumentTitle(titleOrFileName: string): string {
  if (!titleOrFileName) return '';
  let cleaned = titleOrFileName
    .replace(/\.(?:docx|pdf|txt|md|csv)$/i, '')
    .replace(/^\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]\s*/i, '')
    .replace(/^\d+[\s._-]+/, '') // Hilangkan prefix nomor urut seperti "04. " atau "10_ "
    .trim();

  // Rapikan spasi ganda
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

/**
 * DOCUMENT SEMANTIC CLASSIFIER:
 * Mengklasifikasikan seluruh bagian dokumen menjadi 6 kategori semantik:
 * A. DOCUMENT_INSTRUCTIONS
 * B. MAIN_TOPIC
 * C. ARGUMENT_STRUCTURE
 * D. SOURCE_EVIDENCE
 * E. EDITORIAL_NOTES
 * F. UNCERTAIN_CONTENT
 *
 * Menjamin:
 * - Tidak menghapus teks asli (tetap utuh untuk referensi audit)
 * - Metadata & instruksi master framework TIDAK pernah masuk ke narasi
 * - Subjek & topik asli dokumen (mis. "Harta Gak Dibawa Mati") dipertahankan secara akurat
 */
export function classifyDocumentSemantics(
  rawText: string,
  fileName?: string
): DocumentSemanticClassification {
  const safeText = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = safeText.split('\n');

  const sections: SemanticSectionItem[] = [];
  const instructions: string[] = [];
  const keyArguments: string[] = [];
  const supportingEvidence: string[] = [];
  const editorialNotes: string[] = [];
  const uncertainContent: string[] = [];
  const instructionSignpostsFound: string[] = [];

  let mainTopic = '';
  let documentTitle: string | null = null;
  let centralThesis = '';

  // 1. Ekstraksi Judul dari Nama File jika ada
  if (fileName) {
    const fromFile = cleanDocumentTitle(fileName);
    if (fromFile && fromFile.length >= 4) {
      documentTitle = fromFile;
    }
  }

  // Pola Bukti / Evidence: angka, mata uang, persen, kutipan, referensi
  const evidencePattern =
    /\b(?:Rp\.?\s*\d+|\d+%\b|\d+,\d+|\b(?:18|19|20)\d{2}\b|\bUU\s+No\.|\bPasal\s+\d+|\bQ\.?S\.?|\bHR\.|\bdata\s+menunjukkan|\bstatistik|\bsurvei|\bhasil\s+riset|\bbukti\s+lapangan|\bcontoh\s+kasus|\bkasus\s+riil)/i;

  // Pola Catatan Editorial:
  const editorialPattern =
    /^(?:catatan(?:\s+penulis|\s+editorial)?|note|tone|target\s+audiens|suasana|pesan\s+kunci|arahan\s+visual|disclaimer)\s*[:=]/i;

  // Pola Penanda Topik / Judul Eksplisit:
  const topicPrefixPattern =
    /^(?:judul(?:\s+naskah|\s+video)?|topik(?:\s+utama)?|tema|tesis(?:\s+utama)?|persoalan\s+utama|fokus\s+bahasan)\s*[:=]\s*(.+)$/i;

  // Pola Argumentasi & Sebab-Akibat:
  const argumentPattern =
    /\b(?:karena|sebab|akibatnya|dampaknya|mengapa|kenapa|logika\s+yang|argumen|alasan|masalahnya|kelemahan|kekeliruan|kesalahan\s+pikir|pembodohan|menjustifikasi|pembenaran|normalisasi|menyalahkan|merugikan|kontradiksi|ilusi|sanggahan|kritik|paradoks)/i;

  rawLines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const id = `SEC-${lineIndex + 1}`;

    // A. Periksa apakah baris adalah DOCUMENT_INSTRUCTIONS
    let isInstruction = false;
    for (const rx of DOCUMENT_INSTRUCTION_PATTERNS) {
      if (rx.test(trimmed)) {
        isInstruction = true;
        instructionSignpostsFound.push(trimmed.slice(0, 60));
        break;
      }
    }

    // Cek juga apakah baris memuat frasa terlarang sistem atau metadata konfigurasi
    if (!isInstruction) {
      for (const item of FORBIDDEN_LEAKED_PHRASES) {
        if (item.regex.test(trimmed)) {
          isInstruction = true;
          instructionSignpostsFound.push(trimmed.slice(0, 60));
          break;
        }
      }
    }

    if (
      !isInstruction &&
      /^(?:target\s+(?:audit|sasaran|kritik|analisis)|konfigurasi\s+sistem|konfigurasi\s+naskah|metadata\s+dokumen)/i.test(
        trimmed
      )
    ) {
      isInstruction = true;
      instructionSignpostsFound.push(trimmed.slice(0, 60));
    }

    if (isInstruction) {
      instructions.push(trimmed);
      sections.push({
        id,
        category: 'DOCUMENT_INSTRUCTIONS',
        rawText: trimmed,
        lineIndex,
        summary: `Instruksi Framework: ${trimmed.slice(0, 70)}`,
        isInstruction: true,
      });
      return;
    }

    // B. Periksa apakah baris memuat TOPIC / JUDUL
    const topicMatch = trimmed.match(topicPrefixPattern);
    if (topicMatch && topicMatch[1]) {
      const parsedTopic = cleanDocumentTitle(topicMatch[1]);
      if (!mainTopic) {
        mainTopic = parsedTopic;
      }
      if (!documentTitle) {
        documentTitle = parsedTopic;
      }
      sections.push({
        id,
        category: 'MAIN_TOPIC',
        rawText: trimmed,
        lineIndex,
        summary: `Topik Utama: ${parsedTopic}`,
        isInstruction: false,
      });
      return;
    }

    // Jika baris pertama dokumen belum di-set sebagai topik dan menyerupai judul/heading
    if (
      lineIndex === 0 ||
      (!documentTitle && lineIndex <= 3 && trimmed.length <= 130 && !/[.!?]$/.test(trimmed))
    ) {
      const candidateHeading = cleanDocumentTitle(trimmed);
      // Pastikan bukan baris instruksi
      if (
        candidateHeading.length >= 6 &&
        !candidateHeading.toLowerCase().includes('framework') &&
        !candidateHeading.toLowerCase().includes('perencanaan')
      ) {
        if (!documentTitle) {
          documentTitle = candidateHeading;
        }
        if (!mainTopic) {
          mainTopic = candidateHeading;
        }
        sections.push({
          id,
          category: 'MAIN_TOPIC',
          rawText: trimmed,
          lineIndex,
          summary: `Judul Dokumen: ${candidateHeading}`,
          isInstruction: false,
        });
        return;
      }
    }

    // E. Periksa apakah baris adalah EDITORIAL_NOTES
    if (editorialPattern.test(trimmed)) {
      editorialNotes.push(trimmed);
      sections.push({
        id,
        category: 'EDITORIAL_NOTES',
        rawText: trimmed,
        lineIndex,
        summary: `Catatan Editorial: ${trimmed.slice(0, 70)}`,
        isInstruction: false,
      });
      return;
    }

    const cleanedNarrativeLine = stripReferenceMetadataFromSourceText(trimmed);

    // Jika baris hanya berisi referensi/DOI/URL/sitasi tanpa kalimat substantif, isolasi ke EDITORIAL_NOTES
    if (!cleanedNarrativeLine || cleanedNarrativeLine.length < 4) {
      editorialNotes.push(trimmed);
      sections.push({
        id,
        category: 'EDITORIAL_NOTES',
        rawText: trimmed,
        lineIndex,
        summary: `Metadata Referensi Diisolasi: ${trimmed.slice(0, 70)}`,
        isInstruction: false,
      });
      return;
    }

    // D. Periksa apakah baris memuat SOURCE_EVIDENCE
    if (evidencePattern.test(cleanedNarrativeLine)) {
      supportingEvidence.push(cleanedNarrativeLine);
      sections.push({
        id,
        category: 'SOURCE_EVIDENCE',
        rawText: cleanedNarrativeLine,
        lineIndex,
        summary: `Bukti/Fakta Pendukung: ${cleanedNarrativeLine.slice(0, 70)}`,
        isInstruction: false,
      });
      return;
    }

    // C. Periksa apakah baris memuat ARGUMENT_STRUCTURE
    if (argumentPattern.test(cleanedNarrativeLine) || cleanedNarrativeLine.length > 35) {
      keyArguments.push(cleanedNarrativeLine);
      if (
        !centralThesis &&
        (cleanedNarrativeLine.includes('hancur') ||
          cleanedNarrativeLine.includes('pembodohan') ||
          cleanedNarrativeLine.includes('sesat') ||
          cleanedNarrativeLine.includes('keliru') ||
          cleanedNarrativeLine.includes('logika'))
      ) {
        centralThesis = cleanedNarrativeLine;
      }
      sections.push({
        id,
        category: 'ARGUMENT_STRUCTURE',
        rawText: cleanedNarrativeLine,
        lineIndex,
        summary: `Struktur Argumentasi: ${cleanedNarrativeLine.slice(0, 70)}`,
        isInstruction: false,
      });
      return;
    }

    // F. UNCERTAIN_CONTENT
    uncertainContent.push(cleanedNarrativeLine);
    sections.push({
      id,
      category: 'UNCERTAIN_CONTENT',
      rawText: cleanedNarrativeLine,
      lineIndex,
      summary: `Teks Terbuka: ${cleanedNarrativeLine.slice(0, 70)}`,
      isInstruction: false,
    });
  });

  // Tentukan mainTopic jika masih kosong atau memuat system marker
  const isSystemMarker = (t: string) => !t || /^\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/i.test(t.trim());

  if (isSystemMarker(mainTopic)) {
    if (documentTitle && !isSystemMarker(documentTitle)) {
      mainTopic = documentTitle;
    } else if (keyArguments.length > 0) {
      mainTopic = keyArguments[0].slice(0, 100);
    } else {
      mainTopic = 'Topik Dokumen Sumber';
    }
  }

  // Tentukan centralThesis jika masih kosong
  if (!centralThesis) {
    if (keyArguments.length > 0) {
      centralThesis = keyArguments[0];
    } else {
      centralThesis = `Analisis kritis terhadap ${mainTopic} yang mengungkap kelemahan logika dan dampaknya pada masyarakat.`;
    }
  }

  const topicKeywords = extractThematicKeywords(
    `${documentTitle || ''} ${mainTopic} ${centralThesis} ${keyArguments.slice(0, 3).join(' ')}`
  );

  return {
    rawText: safeText,
    fileName,
    sections,
    instructions,
    mainTopic,
    documentTitle,
    centralThesis,
    keyArguments,
    supportingEvidence,
    editorialNotes,
    uncertainContent,
    topicKeywords,
    hasInstructions: instructions.length > 0,
    instructionSignpostsFound,
  };
}
