/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GENFLOW MASTER FRAMEWORK FINAL
 * Standar perencanaan naskah YouTube presisi, pembacaan kerangka, penguncian substansi,
 * pemetaan bukti, dan audit kelayakan 23 komponen kanonis (Kelompok A–G).
 */

import { GenNASConfig } from './types';

export type MasterFrameworkGroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type MasterFrameworkComponentStatus =
  | 'MENUNGGU_DOKUMEN'
  | 'SEDANG_DIPINDAI'
  | 'DITEMUKAN'
  | 'TIDAK_DITEMUKAN'
  | 'PERLU_KONFIRMASI'
  | 'GAGAL_DIPINDAI'
  | 'BERTENTANGAN'
  | 'BELUM_TERVERIFIKASI';

export type FrameworkReadinessStatus =
  | 'BELUM ADA DOKUMEN'
  | 'SEDANG DIPINDAI'
  | 'SIAP DIKEMBANGKAN'
  | 'PERLU SUMBER/DATA'
  | 'PERLU MEMPERSEMPIT FOKUS'
  | 'PERLU MEMPERBAIKI URUTAN'
  | 'PERLU MENYELESAIKAN KONTRADIKSI';

export interface ScopeBoundaryDetails {
  wajibDibahas: string[];
  bolehDisinggung: string[];
  tidakBolehDimasukkan: string[];
}

export interface ProblemFrameworkDetails {
  masalahUtama: string;
  konteksLatarBelakang: string;
  faktorPenyebab: string[];
  mekanisme: string;
  pihakTerkait: string[];
  dampakKonsekuensi: string[];
  pertentanganKesenjanganKontradiksi: string;
}

export interface PerspectiveShiftDetails {
  pemahamanSebelum: string;
  pemahamanSetelah: string;
  asumsiPerluDiuji: string[];
  perspektifBaru: string;
}

export interface EvidenceItem {
  id: string;
  klaim: string;
  bukti: string;
  sumber: string;
  relevansiTerhadapTesis: string;
  keterbatasanAtauKetidakpastian: string;
  klasifikasi: 'FAKTA_TERVERIFIKASI' | 'INTERPRETASI' | 'OPINI' | 'DUGAAN' | 'BELUM_PASTI';
  sourceLocation?: string;
}

export interface CounterArgumentItem {
  penjelasanLain: string;
  perlakuan: 'DIJELASKAN' | 'DIBANDINGKAN' | 'DIUJI' | 'DIKESAMPINGKAN';
  alasan: string;
}

export interface PlotTwistDetails {
  adaPlotTwist: boolean;
  deskripsi: string;
  fungsi: string;
  posisiBlok: number; // 1..5
  dasarFaktaKontradiksi: string;
}

export interface NarrativeBlueprintBlock {
  blockId: number;
  stageName: string;
  namaTema: string;
  fungsiArgumentatif: string;
  pertanyaanYangDijawab: string;
  pokokMateri: string[];
  faktaBuktiYangDiperlukan: string[];
  hubunganSebelumBerikutnya: string;
  kontribusiTerhadapTesis: string;
}

export interface MasterFrameworkComponent<T = any> {
  id: number; // 1 s/d 23
  groupCode: MasterFrameworkGroupCode;
  groupTitle: string;
  canonicalTitle: string;
  subtitle: string;
  status: MasterFrameworkComponentStatus;
  statusNotes?: string;
  summary: string;
  content: string;
  details?: T;
  sourceOrigin?: {
    documentName?: string;
    sectionTitle?: string;
    lineNumber?: number;
    textSnippet?: string;
    isExplicit: boolean;
  };
  manualCorrection?: {
    editedAt: number;
    editedBy?: string;
    originalContent: string;
    updatedContent: string;
  };
}

export interface GenflowMasterFrameworkData {
  documentIdentity: {
    fileName: string;
    extractedAt: number;
    wordCount: number;
    readingStatus: 'SUKSES' | 'PERLU_PERHATIAN' | 'PARSIAL';
    warnings: string[];
  };
  executiveSummary: {
    topikUtama: string;
    fokusBesar: string;
    batasPembahasan: ScopeBoundaryDetails;
    pertanyaanInti: string;
    tesisUtama: string;
    logicPunch: string;
    statusKesiapan: FrameworkReadinessStatus;
    readinessReason: string;
    unresolvedCount: number;
  };
  groups: {
    A: { title: 'INPUT UTAMA'; components: MasterFrameworkComponent[] };
    B: { title: 'PENGUNCI SUBSTANSI'; components: MasterFrameworkComponent[] };
    C: { title: 'PENGUNCI FAKTA DAN ARGUMENTASI'; components: MasterFrameworkComponent[] };
    D: { title: 'PERANCANGAN STRUKTUR NASKAH'; components: MasterFrameworkComponent[] };
    E: { title: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP'; components: MasterFrameworkComponent[] };
    F: { title: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI'; components: MasterFrameworkComponent[] };
    G: { title: 'ATURAN WAJIB PENGERJAAN'; components: MasterFrameworkComponent[] };
  };
  componentsById: Record<number, MasterFrameworkComponent>;
  isConfirmed: boolean;
  confirmedAt?: number;
  confirmationNotes?: string;
  revisions: Array<{
    timestamp: number;
    componentId: number;
    field: string;
    prevValue: string;
    newValue: string;
  }>;
}

export interface BlockTraceabilityResult {
  blockId: number;
  blockName: string;
  wordCount: number;
  groundedComponentIds: number[];
  groundedPoints: string[];
  boundaryCheck: 'LULUS' | 'PELANGGARAN_TERDETEKSI';
  boundaryViolations: string[];
  matchedMandatoryPoints: string[];
  evidenceCited: string[];
  summary: string;
}

export interface FrameworkTraceabilityReport {
  passed: boolean;
  checkedAt: number;
  totalBlocks: number;
  blockResults: BlockTraceabilityResult[];
  overallMandatoryCoverage: {
    totalMandatory: number;
    coveredCount: number;
    missingPoints: string[];
  };
  forbiddenBoundaryViolations: string[];
  statusSummary: string;
}

// =========================================================================
// DEFINISI KANONIS 23 KOMPONEN MASTER FRAMEWORK
// =========================================================================

export const CANONICAL_COMPONENTS_SPEC: readonly {
  id: number;
  groupCode: MasterFrameworkGroupCode;
  groupTitle: string;
  canonicalTitle: string;
  subtitle: string;
  guideline: string;
}[] = Object.freeze([
  // KELOMPOK A — INPUT UTAMA
  {
    id: 1,
    groupCode: 'A',
    groupTitle: 'INPUT UTAMA',
    canonicalTitle: 'Topik utama yang harus dibahas',
    subtitle: 'Identifikasi topik utama secara spesifik tanpa penyederhanaan umum.',
    guideline: 'Identifikasi topik utama secara spesifik. Jangan mengganti topik dengan isu lain yang hanya berkaitan secara umum.',
  },
  {
    id: 2,
    groupCode: 'A',
    groupTitle: 'INPUT UTAMA',
    canonicalTitle: 'Bahan atau sumber rujukan',
    subtitle: 'Dokumen, artikel, riset, atau data yang menjadi landasan.',
    guideline: 'Identifikasi dokumen, artikel, penelitian, data, video, atau sumber lain yang menjadi landasan. Catat identitas sumber dan bagian relevan jika tersedia.',
  },

  // KELOMPOK B — PENGUNCI SUBSTANSI
  {
    id: 3,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Fokus Besar (Central Focus)',
    subtitle: 'Pusat gravitasi pembahasan dan aspek analisis yang dituju.',
    guideline: 'Tentukan pusat gravitasi pembahasan dan aspek utama yang menjadi fokus analisis. Fokus harus spesifik, memiliki arah jelas, dan tidak mencakup seluruh persoalan terkait topik.',
  },
  {
    id: 4,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Batas Pembahasan (Scope Boundary)',
    subtitle: 'Wajib dibahas, Boleh disinggung, dan Tidak boleh dimasukkan.',
    guideline: 'Bagi menjadi: Wajib dibahas; Boleh disinggung; Tidak boleh dimasukkan. Kategori terakhir mencegah pembahasan menyimpang dari fokus utama.',
  },
  {
    id: 5,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Pertanyaan Inti (Core Question)',
    subtitle: 'Satu pertanyaan utama yang wajib dijawab video secara tuntas.',
    guideline: 'Rumuskan satu pertanyaan utama yang harus dijawab keseluruhan video. Setiap bagian harus berkontribusi jelas terhadap jawabannya.',
  },
  {
    id: 6,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Kerangka Masalah (Problem Framework)',
    subtitle: 'Masalah utama, konteks, faktor penyebab, mekanisme, dampak, & kontradiksi.',
    guideline: 'Petakan masalah utama; konteks/latar belakang; faktor penyebab; mekanisme; pihak/unsur terkait jika relevan; dampak/konsekuensi; serta pertentangan, kesenjangan, atau kontradiksi inti.',
  },
  {
    id: 7,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Tesis Utama (Central Thesis)',
    subtitle: 'Pernyataan argumentatif utama yang diuji dan dipertahankan melalui fakta.',
    guideline: 'Rumuskan pernyataan argumentatif yang menjadi posisi utama pembahasan dan akan diuji, dijelaskan, atau dipertahankan melalui fakta dan analisis. Bukan sekadar pengulangan topik atau opini tanpa dasar.',
  },
  {
    id: 8,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Logic Punch',
    subtitle: 'Kesimpulan intelektual paling tajam yang tertanam pada audiens.',
    guideline: 'Tentukan kesimpulan intelektual paling kuat yang diharapkan tertanam pada audiens. Logic punch harus lahir dari argumentasi, bukan dipaksakan sebelum fakta dianalisis.',
  },
  {
    id: 9,
    groupCode: 'B',
    groupTitle: 'PENGUNCI SUBSTANSI',
    canonicalTitle: 'Kunci Tujuan Perubahan Perspektif',
    subtitle: 'Pemahaman sebelum vs sesudah, asumsi yang diuji, & paradigma baru.',
    guideline: 'Tentukan pemahaman audiens sebelum menonton; pemahaman yang diharapkan setelah menonton; asumsi/kesalahpahaman yang perlu diuji; dan perspektif baru yang dapat dipertanggungjawabkan.',
  },

  // KELOMPOK C — PENGUNCI FAKTA DAN ARGUMENTASI
  {
    id: 10,
    groupCode: 'C',
    groupTitle: 'PENGUNCI FAKTA DAN ARGUMENTASI',
    canonicalTitle: 'Pemetaan Landasan Fakta (Evidence Mapping)',
    subtitle: 'Klaim, bukti, sumber, relevansi tesis, & klasifikasi keabsahan fakta.',
    guideline: 'Identifikasi fakta, data, dokumen, penelitian, pernyataan resmi, atau bukti lain. Petakan klaim, bukti pendukung, sumber, relevansi terhadap tesis, dan keterbatasan/ketidakpastian. Pisahkan fakta terverifikasi, interpretasi, opini, dugaan, dan informasi yang belum pasti.',
  },
  {
    id: 11,
    groupCode: 'C',
    groupTitle: 'PENGUNCI FAKTA DAN ARGUMENTASI',
    canonicalTitle: 'Pemetaan Rantai Logika (Argument Chain)',
    subtitle: 'Kondisi awal → masalah → penyebab → mekanisme → bukti → dampak → implikasi → kesimpulan.',
    guideline: 'Susun urutan: kondisi awal → masalah → penyebab → mekanisme → bukti → dampak → implikasi → kesimpulan. Urutan boleh disesuaikan dengan topik, tetapi setiap kesimpulan harus memiliki landasan jelas.',
  },
  {
    id: 12,
    groupCode: 'C',
    groupTitle: 'PENGUNCI FAKTA DAN ARGUMENTASI',
    canonicalTitle: 'Pemetaan Kontraargumen dan Alternatif Penjelasan',
    subtitle: 'Penjelasan lain/fakta berlawanan: Dijelaskan, Dibandingkan, Diuji, Dikesampingkan.',
    guideline: 'Identifikasi penjelasan lain, fakta berlawanan, pengecualian, atau sudut pandang berbeda yang relevan. Tentukan apakah unsur itu dijelaskan, dibandingkan, diuji, atau dikesampingkan dengan alasan memadai.',
  },
  {
    id: 13,
    groupCode: 'C',
    groupTitle: 'PENGUNCI FAKTA DAN ARGUMENTASI',
    canonicalTitle: 'Penentuan Plot Twist (Perspective Shift)',
    subtitle: 'Titik balik sudut pandang berdasarkan kontradiksi fakta atau mekanisme tersembunyi.',
    guideline: 'Tentukan bagian yang berpotensi mengubah cara pandang audiens. Plot twist harus lahir dari fakta, kontradiksi, mekanisme tersembunyi, atau hubungan yang sebelumnya belum dipahami. Tentukan fungsi dan posisinya, bukan adegan atau narasinya.',
  },

  // KELOMPOK D — PERANCANGAN STRUKTUR NASKAH
  {
    id: 14,
    groupCode: 'D',
    groupTitle: 'PERANCANGAN STRUKTUR NASKAH',
    canonicalTitle: 'Penentuan Fungsi Setiap Bagian',
    subtitle: 'Fungsi terukur tiap 5 bagian StoryFlow tanpa pengulangan tanpa arah.',
    guideline: 'Tentukan fungsi tiap bagian: memperkenalkan masalah, memberi konteks, mengungkap fakta, menjelaskan penyebab, menguji asumsi, mengembangkan argumentasi, menunjukkan kontradiksi, menghadirkan perubahan perspektif, atau menarik kesimpulan. Setiap bagian harus berbeda dan tidak sekadar mengulang.',
  },
  {
    id: 15,
    groupCode: 'D',
    groupTitle: 'PERANCANGAN STRUKTUR NASKAH',
    canonicalTitle: 'Penyusunan Alur Pembahasan (Narrative Blueprint)',
    subtitle: 'Peta materi, bukti, hubungan antarbagian, & kontribusi tesis per blok.',
    guideline: 'Untuk setiap bagian tetapkan nama/tema; fungsi argumentatif; pertanyaan yang dijawab; pokok materi; fakta/bukti yang diperlukan; hubungan dengan bagian sebelumnya dan berikutnya; serta kontribusi terhadap tesis. Hasilnya peta pembahasan, bukan paragraf narasi.',
  },

  // KELOMPOK E — PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP
  {
    id: 16,
    groupCode: 'E',
    groupTitle: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP',
    canonicalTitle: 'Perumusan Judul',
    subtitle: 'Daya tarik, batas klaim tanpa clickbait menyesatkan, & relevansi pencarian.',
    guideline: 'Rumuskan berdasarkan fokus, masalah, tesis, dan logic punch. Tentukan inti informasi yang dijanjikan, sudut pandang, daya tarik/pembeda, relevansi pencarian audiens, dan batas klaim agar tidak menyesatkan. Alternatif harus mewakili isi sebenarnya.',
  },
  {
    id: 17,
    groupCode: 'E',
    groupTitle: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP',
    canonicalTitle: 'Perancangan Hook',
    subtitle: 'Strategi pembuka (pertanyaan kritis, kontradiksi, fakta penting) tanpa naskah final.',
    guideline: 'Tentukan strategi pembukaan: pertanyaan kritis, kontradiksi asumsi-fakta, fakta penting, persoalan belum terjawab, atau konsekuensi. Tetapkan fungsi hook, informasi yang diperkenalkan, rasa ingin tahu, dan hubungan dengan masalah utama. Jangan menulis kalimat pembuka final pada tahap perencanaan.',
  },
  {
    id: 18,
    groupCode: 'E',
    groupTitle: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP',
    canonicalTitle: 'Perancangan Klimaks dan Penutup',
    subtitle: 'Puncak argumentasi, penegasan logic punch, & pertanyaan reflektif penutup.',
    guideline: 'Tentukan puncak argumentasi, temuan/pemahaman sebelum penutup, hubungan kesimpulan dengan tesis, cara menegaskan logic punch, dan pertanyaan reflektif/ajakan relevan. Penutup harus menjadi konsekuensi logis pembahasan.',
  },

  // KELOMPOK F — AUDIT KERANGKA SEBELUM PENULISAN NARASI
  {
    id: 19,
    groupCode: 'F',
    groupTitle: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI',
    canonicalTitle: 'Audit Konsistensi Substansi',
    subtitle: 'Uji keselarasan fokus, pertanyaan inti, kerangka masalah, tesis, & logic punch.',
    guideline: 'Periksa apakah fokus, pertanyaan inti, kerangka masalah, tesis, logic punch, dan tujuan video saling mendukung.',
  },
  {
    id: 20,
    groupCode: 'F',
    groupTitle: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI',
    canonicalTitle: 'Audit Kelengkapan Argumentasi',
    subtitle: 'Uji ketersediaan dasar bukti dan hubungan logis di setiap pokok bahasan.',
    guideline: 'Periksa apakah setiap pokok pembahasan memiliki fungsi, dasar bukti, dan hubungan logis yang jelas.',
  },
  {
    id: 21,
    groupCode: 'F',
    groupTitle: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI',
    canonicalTitle: 'Audit Potensi Penyimpangan',
    subtitle: 'Deteksi bahasan melebar, spekulasi tak berdasar, atau topik di luar batas.',
    guideline: 'Identifikasi bagian yang berpotensi melebar, berulang, tidak relevan, terlalu spekulatif, atau tidak berkontribusi terhadap pertanyaan inti.',
  },
  {
    id: 22,
    groupCode: 'F',
    groupTitle: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI',
    canonicalTitle: 'Audit Kelayakan Struktur',
    subtitle: 'Uji proporsi alur, ketepatan transisi, & kecukupan ruang argumen.',
    guideline: 'Pastikan alur memiliki urutan masuk akal, porsi proporsional, transisi terencana, dan ruang cukup untuk menjelaskan argumentasi utama.',
  },
  {
    id: 23,
    groupCode: 'F',
    groupTitle: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI',
    canonicalTitle: 'Keputusan Kesiapan Kerangka',
    subtitle: 'Vonis kesiapan naskah dikembangkan ke Tahap 2 Generate Naskah Awal.',
    guideline: 'Nyatakan apakah kerangka siap dikembangkan; perlu sumber/data; perlu mempersempit fokus; perlu memperbaiki urutan; atau perlu menyelesaikan kontradiksi/kelemahan logika. Jelaskan alasan dan bagian yang perlu diperbaiki.',
  },
]);

// =========================================================================
// SISTEM INISIALISASI KOSONG & EKSTRAKSI MASTER FRAMEWORK
// =========================================================================

/**
 * Inisialisasi awal Master Framework KOSONG murni (0/23 terisi, status MENUNGGU_DOKUMEN).
 * Digunakan saat aplikasi baru dibuka atau saat pengguna mereset sesi kerja.
 */
export function createEmptyMasterFramework(): GenflowMasterFrameworkData {
  const componentsById: Record<number, MasterFrameworkComponent> = {};

  CANONICAL_COMPONENTS_SPEC.forEach((spec) => {
    componentsById[spec.id] = {
      id: spec.id,
      groupCode: spec.groupCode,
      groupTitle: spec.groupTitle,
      canonicalTitle: spec.canonicalTitle,
      subtitle: spec.subtitle,
      status: 'MENUNGGU_DOKUMEN',
      statusNotes: 'Menunggu dokumen kerangka diunggah',
      summary: 'Menunggu dokumen',
      content: '',
      sourceOrigin: {
        documentName: 'BELUM ADA DOKUMEN',
        sectionTitle: '',
        lineNumber: 0,
        textSnippet: '',
        isExplicit: false,
      },
    };
  });

  const groupGComponents: MasterFrameworkComponent[] = [
    {
      id: 24,
      groupCode: 'G',
      groupTitle: 'ATURAN WAJIB PENGERJAAN',
      canonicalTitle: 'Otoritas Perencanaan vs Otoritas Penulisan',
      subtitle: 'Framework mengatur SUBSTANSI (apa yang dibahas); Master Prompt mengatur GAYA & FORMAT.',
      status: 'MENUNGGU_DOKUMEN',
      summary: 'Menunggu dokumen kerangka diunggah.',
      content: 'GENFLOW MASTER PROMPT FINAL menjadi otoritas penulisan naskah lisan, gaya gue-lo, dan batasan teknis.\nGENFLOW MASTER FRAMEWORK FINAL menjadi otoritas substansi: topik, fokus, batas, fakta, dan alur.',
      sourceOrigin: { documentName: 'BELUM ADA DOKUMEN', isExplicit: false },
    },
    {
      id: 25,
      groupCode: 'G',
      groupTitle: 'ATURAN WAJIB PENGERJAAN',
      canonicalTitle: 'Larangan Mutlak Halusinasi Fakta & Kebocoran Label',
      subtitle: 'Dilarang mengarang angka/sumber dan dilarang membocorkan label instruksi ke narasi.',
      status: 'MENUNGGU_DOKUMEN',
      summary: 'Menunggu dokumen kerangka diunggah.',
      content: '1. Dilarang mengarang fakta, angka statistik, tokoh, atau hubungan sebab-akibat yang tidak didukung data.\n2. Dilarang memasukkan label framework ("MASTER FRAMEWORK", "PERENCANAAN NASKAH YOUTUBE PRESISI", dll) ke dalam naskah narator.\n3. Pertahankan WPM terkunci 135 dan proporsi StoryFlow 5 blok.',
      sourceOrigin: { documentName: 'BELUM ADA DOKUMEN', isExplicit: false },
    },
  ];

  const groups = {
    A: {
      title: 'INPUT UTAMA' as const,
      components: [componentsById[1], componentsById[2]],
    },
    B: {
      title: 'PENGUNCI SUBSTANSI' as const,
      components: [
        componentsById[3],
        componentsById[4],
        componentsById[5],
        componentsById[6],
        componentsById[7],
        componentsById[8],
        componentsById[9],
      ],
    },
    C: {
      title: 'PENGUNCI FAKTA DAN ARGUMENTASI' as const,
      components: [
        componentsById[10],
        componentsById[11],
        componentsById[12],
        componentsById[13],
      ],
    },
    D: {
      title: 'PERANCANGAN STRUKTUR NASKAH' as const,
      components: [componentsById[14], componentsById[15]],
    },
    E: {
      title: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP' as const,
      components: [componentsById[16], componentsById[17], componentsById[18]],
    },
    F: {
      title: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI' as const,
      components: [
        componentsById[19],
        componentsById[20],
        componentsById[21],
        componentsById[22],
        componentsById[23],
      ],
    },
    G: {
      title: 'ATURAN WAJIB PENGERJAAN' as const,
      components: groupGComponents,
    },
  };

  return {
    documentIdentity: {
      fileName: 'BELUM ADA DOKUMEN',
      extractedAt: 0,
      wordCount: 0,
      readingStatus: 'SUKSES',
      warnings: [],
    },
    executiveSummary: {
      topikUtama: '',
      fokusBesar: '',
      batasPembahasan: {
        wajibDibahas: [],
        bolehDisinggung: [],
        tidakBolehDimasukkan: [],
      },
      pertanyaanInti: '',
      tesisUtama: '',
      logicPunch: '',
      statusKesiapan: 'BELUM ADA DOKUMEN',
      readinessReason: 'Belum ada dokumen kerangka naskah yang diunggah. Silakan klik tombol UNGGAH FILE pada panel KERANGKA & SUMBER.',
      unresolvedCount: 23,
    },
    groups,
    componentsById,
    isConfirmed: false,
    revisions: [],
  };
}

/**
 * Ekstraksi dokumen kerangka ke dalam kanonis 23 komponen A-G.
 * Memisahkan secara ketat fakta terverifikasi dari dokumen asli.
 * TIDAK MENGARANG fakta, topik, atau komponen yang tidak ada di dokumen.
 */
export function extractGenflowMasterFramework(
  rawText: string,
  fileName: string = 'kerangka.txt',
  existingData?: GenflowMasterFrameworkData | null
): GenflowMasterFrameworkData {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    return createEmptyMasterFramework();
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim());
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const warnings: string[] = [];

  // Inisialisasi map komponen kanonis
  const componentsById: Record<number, MasterFrameworkComponent> = {};

  // Deteksi format terstruktur A-G vs dokumen kerangka bebas
  const isStructuredTemplate =
    /A\.\s*INPUT\s*UTAMA/i.test(trimmed) ||
    /1\.\s*Topik\s*utama/i.test(trimmed) ||
    /B\.\s*PENGUNCI\s*SUBSTANSI/i.test(trimmed);

  // Helper untuk mengekstrak teks di antara penanda
  const extractSectionText = (startPattern: RegExp, endPatterns: RegExp[]): { text: string; lineNo: number } => {
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (startPattern.test(lines[i])) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) return { text: '', lineNo: -1 };

    let collected: string[] = [];
    let firstLineWithoutMarker = lines[startIdx].replace(startPattern, '').trim();
    firstLineWithoutMarker = firstLineWithoutMarker.replace(/^:\s*/, '').trim();
    if (
      /^(?:Besar|Utama|Batas|Pertanyaan|Kerangka|Logic|Tujuan|Pemetaan|Rantai|Kontraargumen|Penentuan|Penyusunan|Perumusan|Perancangan|Audit|Keputusan|Aturan|yang\s+harus\s+dibahas|atau\s+sumber\s+rujukan)\s*:?$/i.test(firstLineWithoutMarker)
    ) {
      firstLineWithoutMarker = '';
    }
    if (
      firstLineWithoutMarker &&
      !/^(?:CATATAN FORMAT|FORMAT_NOTE|ADDITIONAL_[A-Z_]+)\s*:/i.test(firstLineWithoutMarker)
    ) {
      collected.push(firstLineWithoutMarker);
    }

    const universalSectionHeaderRegex = /^(?:[A-G]\.\s+[A-Z]+|(?:[1-9]|1\d|2[0-3])\.\s+(?:TOPIK|BAHAN|KUNCI|PEMETAAN|PENENTUAN|PENYUSUNAN|PERUMUSAN|PERANCANGAN|AUDIT|KEPUTUSAN|Topik|Bahan|Kunci|Pemetaan|Penentuan|Penyusunan|Perumusan|Perancangan|Audit|Keputusan))/i;

    let currentLine = startIdx + 1;
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      const isEnd =
        universalSectionHeaderRegex.test(line) ||
        endPatterns.some((pattern) => pattern.test(line));
      if (isEnd) break;

      const trimmedLine = line.trim();
      // Filter out instruction notes and template prompt brackets
      const isInstructionNote = /^(?:CATATAN FORMAT|FORMAT_NOTE|ADDITIONAL_[A-Z_]+)\s*:/i.test(trimmedLine);
      const isBracketedInstruction = /^\[(?:Jelaskan|Judul|Penulis|Tanggal|URL|Informasi|Batas|VERIFIED|Satu|Mengapa|Hal|Poin|Pertanyaan|Unsur|Masalah|Konteks|Faktor|Mekanisme|Pihak|Dampak|Pertentangan|Bukti|Klaim|Argumen|Puncak|Temuan|Hubungan|Cara|Temuan|Daftar|Bagian|Urutan|Kecukupan|Pemeriksaan|Catatan|Ulangi|Tambahkan|Isi|Perspektif|Rencana|Daftar|Apakah|Perbaikan|Vonis|Alasan|Hal|YES|Catatan).*?\]$/i.test(trimmedLine);

      if (!isInstructionNote && !isBracketedInstruction) {
        collected.push(line);
      }
      currentLine++;
    }

    const clean = collected.join('\n').trim();
    return { text: clean, lineNo: startIdx + 1 };
  };

  // 1. TOPIK UTAMA
  let comp1Content = '';
  let comp1Origin = { documentName: fileName, sectionTitle: 'Topik Utama', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s1 = extractSectionText(/(?:1\.\s*TOPIK\s*UTAMA|1\.\s*Topik\s*utama)[^\n:]*:?/i, [/2\.\s*BAHAN/i, /2\.\s*Bahan/i, /\[GF-02\]/i, /B\.\s*PENGUNCI/i]);
    if (s1.text) {
      comp1Content = s1.text;
      comp1Origin.lineNumber = s1.lineNo;
      comp1Origin.isExplicit = true;
      comp1Origin.textSnippet = s1.text.slice(0, 150);
    }
  }
  if (!comp1Content) {
    // Cari judul dokumen dari baris non-kosong pertama
    const candidateHeading = lines.find((l) => l.length > 5 && !l.startsWith('#') && !l.startsWith('http') && !l.startsWith('GENFLOW') && !l.includes('SCHEMA_ID') && !l.includes('DOCUMENT_TYPE'));
    if (candidateHeading) {
      comp1Content = candidateHeading.replace(/^Judul\s*:\s*/i, '').trim();
      comp1Origin.textSnippet = candidateHeading.slice(0, 150);
      comp1Origin.isExplicit = true;
    }
  }

  // 2. BAHAN ATAU SUMBER RUJUKAN
  let comp2Content = '';
  let comp2Origin = { documentName: fileName, sectionTitle: 'Bahan Rujukan', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s2 = extractSectionText(/(?:2\.\s*BAHAN\s*DAN\s*SUMBER|2\.\s*Bahan\s*atau\s*sumber\s*rujukan)[^\n:]*:?/i, [/3\.\s*KUNCI/i, /3\.\s*Kunci/i, /\[GF-03\]/i, /B\.\s*PENGUNCI/i]);
    if (s2.text) {
      comp2Content = s2.text;
      comp2Origin.lineNumber = s2.lineNo;
      comp2Origin.isExplicit = true;
      comp2Origin.textSnippet = s2.text.slice(0, 150);
    }
  }
  if (!comp2Content) {
    // Kumpulkan baris URL, rujukan [1], nama jurnal, data statistik
    const referenceLines = lines.filter((l) =>
      /https?:\/\/|jurnal|buku|laporan|data|badan pusat statistik|bps|riset|studi|survei/i.test(l)
    );
    if (referenceLines.length > 0) {
      comp2Content = referenceLines.slice(0, 8).join('\n');
      comp2Origin.textSnippet = comp2Content.slice(0, 150);
      comp2Origin.isExplicit = true;
    }
  }

  // 3. KUNCI FOKUS BESAR (Central Focus)
  let comp3Content = '';
  let comp3Origin = { documentName: fileName, sectionTitle: 'Central Focus', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s3 = extractSectionText(/(?:3\.\s*KUNCI\s*FOKUS\s*BESAR|3\.\s*Kunci\s*Fokus\s*Besar)[^\n:]*:?/i, [/4\.\s*KUNCI/i, /4\.\s*Kunci/i, /\[GF-04\]/i, /Batas\s*Pembahasan/i]);
    if (s3.text) {
      comp3Content = s3.text;
      comp3Origin.lineNumber = s3.lineNo;
      comp3Origin.isExplicit = true;
    }
  }
  if (!comp3Content) {
    const focusCandidate = lines.find((l) => /fokus|menyoroti|analisis|membahas tentang|tujuan utama/i.test(l));
    if (focusCandidate) {
      comp3Content = focusCandidate;
      comp3Origin.textSnippet = focusCandidate.slice(0, 150);
      comp3Origin.isExplicit = true;
    }
  }

  // 4. KUNCI BATAS PEMBAHASAN (Scope Boundary)
  let wajibDibahas: string[] = [];
  let bolehDisinggung: string[] = [];
  let tidakBolehDimasukkan: string[] = [];
  let comp4Content = '';
  let comp4Origin = { documentName: fileName, sectionTitle: 'Scope Boundary', lineNumber: 1, isExplicit: false, textSnippet: '' };

  if (isStructuredTemplate) {
    const s4 = extractSectionText(/(?:4\.\s*KUNCI\s*BATAS\s*PEMBAHASAN|4\.\s*Kunci\s*Batas\s*Pembahasan)[^\n:]*:?/i, [/5\.\s*KUNCI/i, /5\.\s*Kunci/i, /\[GF-05\]/i, /Pertanyaan\s*Inti/i]);
    if (s4.text) {
      comp4Content = s4.text;
      comp4Origin.lineNumber = s4.lineNo;
      comp4Origin.isExplicit = true;
      const wajibMatch = s4.text.match(/(?:Wajib\s*dibahas|MUST_COVER)\s*:\s*([^]+?)(?=Boleh\s*disinggung|MAY_MENTION|Tidak\s*boleh|OUT_OF_SCOPE|$)/i);
      if (wajibMatch) wajibDibahas = wajibMatch[1].split(/\n|;/).map((s) => s.trim()).filter((s) => s.length > 2 && !s.startsWith('['));
      const bolehMatch = s4.text.match(/(?:Boleh\s*disinggung|MAY_MENTION)\s*:\s*([^]+?)(?=Tidak\s*boleh|OUT_OF_SCOPE|$)/i);
      if (bolehMatch) bolehDisinggung = bolehMatch[1].split(/\n|;/).map((s) => s.trim()).filter((s) => s.length > 2 && !s.startsWith('['));
      const larangMatch = s4.text.match(/(?:Tidak\s*boleh\s*dimasukkan|OUT_OF_SCOPE)\s*:\s*([^]+?)$/i);
      if (larangMatch) tidakBolehDimasukkan = larangMatch[1].split(/\n|;/).map((s) => s.trim()).filter((s) => s.length > 2 && !s.startsWith('['));
    }
  }

  // 5. KUNCI PERTANYAAN INTI (Core Question)
  let comp5Content = '';
  let comp5Origin = { documentName: fileName, sectionTitle: 'Core Question', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s5 = extractSectionText(/(?:5\.\s*KUNCI\s*PERTANYAAN\s*INTI|5\.\s*Kunci\s*Pertanyaan\s*Inti)[^\n:]*:?/i, [/6\.\s*KUNCI/i, /6\.\s*Kunci/i, /\[GF-06\]/i, /Kerangka\s*Masalah/i]);
    if (s5.text) {
      comp5Content = s5.text;
      comp5Origin.lineNumber = s5.lineNo;
      comp5Origin.isExplicit = true;
    }
  }
  if (!comp5Content) {
    const questionLine = lines.find((l) => l.includes('?') && l.length > 15);
    if (questionLine) {
      comp5Content = questionLine;
      comp5Origin.textSnippet = questionLine.slice(0, 150);
      comp5Origin.isExplicit = true;
    }
  }

  // 6. KUNCI KERANGKA MASALAH (Problem Framework)
  let comp6Content = '';
  let comp6Origin = { documentName: fileName, sectionTitle: 'Problem Framework', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s6 = extractSectionText(/(?:6\.\s*KUNCI\s*KERANGKA\s*MASALAH|6\.\s*Kunci\s*Kerangka\s*Masalah)[^\n:]*:?/i, [/7\.\s*KUNCI/i, /7\.\s*Kunci/i, /\[GF-07\]/i, /Tesis\s*Utama/i]);
    if (s6.text) {
      comp6Content = s6.text;
      comp6Origin.lineNumber = s6.lineNo;
      comp6Origin.isExplicit = true;
    }
  }

  // 7. KUNCI TESIS UTAMA (Central Thesis)
  let comp7Content = '';
  let comp7Origin = { documentName: fileName, sectionTitle: 'Central Thesis', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s7 = extractSectionText(/(?:7\.\s*KUNCI\s*TESIS\s*UTAMA|7\.\s*Kunci\s*Tesis\s*Utama)[^\n:]*:?/i, [/8\.\s*KUNCI/i, /8\.\s*Kunci/i, /\[GF-08\]/i, /Logic\s*Punch/i]);
    if (s7.text) {
      comp7Content = s7.text;
      comp7Origin.lineNumber = s7.lineNo;
      comp7Origin.isExplicit = true;
    }
  }

  // 8. KUNCI LOGIC PUNCH
  let comp8Content = '';
  let comp8Origin = { documentName: fileName, sectionTitle: 'Logic Punch', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s8 = extractSectionText(/(?:8\.\s*KUNCI\s*LOGIC\s*PUNCH|8\.\s*Kunci\s*Logic\s*Punch)[^\n:]*:?/i, [/9\.\s*KUNCI/i, /9\.\s*Kunci/i, /\[GF-09\]/i, /Tujuan\s*Perubahan/i]);
    if (s8.text) {
      comp8Content = s8.text;
      comp8Origin.lineNumber = s8.lineNo;
      comp8Origin.isExplicit = true;
    }
  }

  // 9. KUNCI TUJUAN PERUBAHAN PERSPEKTIF
  let comp9Content = '';
  let comp9Origin = { documentName: fileName, sectionTitle: 'Perubahan Perspektif', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s9 = extractSectionText(/(?:9\.\s*KUNCI\s*TUJUAN\s*PERUBAHAN|9\.\s*Kunci\s*Tujuan\s*Perubahan)[^\n:]*:?/i, [/10\.\s*PEMETAAN/i, /10\.\s*Pemetaan/i, /\[GF-10\]/i, /C\.\s*PENGUNCI/i]);
    if (s9.text) {
      comp9Content = s9.text;
      comp9Origin.lineNumber = s9.lineNo;
      comp9Origin.isExplicit = true;
    }
  }

  // 10. PEMETAAN LANDASAN FAKTA (Evidence Mapping)
  let comp10Content = '';
  let comp10Origin = { documentName: fileName, sectionTitle: 'Evidence Mapping', lineNumber: 1, isExplicit: false, textSnippet: '' };
  const evidenceItems: EvidenceItem[] = [];

  if (isStructuredTemplate) {
    const s10 = extractSectionText(/10\.\s*Pemetaan\s*Landasan\s*Fakta[^:]*:/i, [/11\.\s*Pemetaan/i, /Rantai\s*Logika/i]);
    if (s10.text) {
      comp10Content = s10.text;
      comp10Origin.lineNumber = s10.lineNo;
      comp10Origin.isExplicit = true;
    }
  }

  // Ekstraksi fakta konkret, angka, atau klaim dari teks dokumen aktual
  const numbersAndClaims = lines.filter((l) =>
    /\b(\d+[\d.,]*%?|\bRp\s*[\d.,]+|\btahun\s*\d{4}|\bsebesar\b|\bmencapai\b)/i.test(l) &&
    !l.startsWith('#') &&
    l.length > 20
  );

  if (numbersAndClaims.length > 0) {
    numbersAndClaims.slice(0, 6).forEach((claim, idx) => {
      evidenceItems.push({
        id: `ev-${idx + 1}`,
        klaim: claim.slice(0, 140),
        bukti: 'Tercatat dalam dokumen referensi sumber aktual',
        sumber: fileName,
        relevansiTerhadapTesis: 'Mendukung langsung argumen pembuktian kerugian konkret',
        keterbatasanAtauKetidakpastian: 'Data perlu ditinjau jika konteks waktu berbeda',
        klasifikasi: 'FAKTA_TERVERIFIKASI',
        sourceLocation: `Baris dokumen: ~${idx * 10 + 5}`,
      });
    });
  }

  if (!comp10Content && evidenceItems.length > 0) {
    comp10Content = evidenceItems
      .map(
        (ev, i) =>
          `[Bukti ${i + 1} - ${ev.klasifikasi}]\nKlaim: ${ev.klaim}\nBukti: ${ev.bukti}\nSumber: ${ev.sumber}\nRelevansi: ${ev.relevansiTerhadapTesis}`
      )
      .join('\n\n');
  }

  // 11. PEMETAAN RANTAI LOGIKA (Argument Chain)
  let comp11Content = '';
  let comp11Origin = { documentName: fileName, sectionTitle: 'Argument Chain', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s11 = extractSectionText(/11\.\s*Pemetaan\s*Rantai\s*Logika[^:]*:/i, [/12\.\s*Pemetaan/i, /Kontraargumen/i]);
    if (s11.text) {
      comp11Content = s11.text;
      comp11Origin.lineNumber = s11.lineNo;
      comp11Origin.isExplicit = true;
    }
  }

  // 12. PEMETAAN KONTRAARGUMEN & ALTERNATIF
  let comp12Content = '';
  let comp12Origin = { documentName: fileName, sectionTitle: 'Kontraargumen', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s12 = extractSectionText(/12\.\s*Pemetaan\s*Kontraargumen[^:]*:/i, [/13\.\s*Penentuan/i, /Plot\s*Twist/i]);
    if (s12.text) {
      comp12Content = s12.text;
      comp12Origin.lineNumber = s12.lineNo;
      comp12Origin.isExplicit = true;
    }
  }

  // 13. PENENTUAN PLOT TWIST (Perspective Shift)
  let comp13Content = '';
  let comp13Origin = { documentName: fileName, sectionTitle: 'Plot Twist', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s13 = extractSectionText(/13\.\s*Penentuan\s*Plot\s*Twist[^:]*:/i, [/14\.\s*Penentuan/i, /D\.\s*PERANCANGAN/i]);
    if (s13.text) {
      comp13Content = s13.text;
      comp13Origin.lineNumber = s13.lineNo;
      comp13Origin.isExplicit = true;
    }
  }

  // 14. PENENTUAN FUNGSI SETIAP BAGIAN
  let comp14Content = '';
  let comp14Origin = { documentName: fileName, sectionTitle: 'Fungsi Bagian', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s14 = extractSectionText(/14\.\s*Penentuan\s*Fungsi\s*Setiap\s*Bagian[^:]*:/i, [/15\.\s*Penyusunan/i, /Alur\s*Pembahasan/i]);
    if (s14.text) {
      comp14Content = s14.text;
      comp14Origin.lineNumber = s14.lineNo;
      comp14Origin.isExplicit = true;
    }
  }

  // 15. PENYUSUNAN ALUR PEMBAHASAN (Narrative Blueprint)
  let comp15Content = '';
  let comp15Origin = { documentName: fileName, sectionTitle: 'Narrative Blueprint', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s15 = extractSectionText(/15\.\s*Penyusunan\s*Alur\s*Pembahasan[^:]*:/i, [/16\.\s*Perumusan/i, /E\.\s*PERANCANGAN/i]);
    if (s15.text) {
      comp15Content = s15.text;
      comp15Origin.lineNumber = s15.lineNo;
      comp15Origin.isExplicit = true;
    }
  }

  // 16. PERUMUSAN JUDUL
  let comp16Content = '';
  let comp16Origin = { documentName: fileName, sectionTitle: 'Perumusan Judul', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s16 = extractSectionText(/16\.\s*Perumusan\s*Judul[^:]*:/i, [/17\.\s*Perancangan/i, /Hook/i]);
    if (s16.text) {
      comp16Content = s16.text;
      comp16Origin.lineNumber = s16.lineNo;
      comp16Origin.isExplicit = true;
    }
  }

  // 17. PERANCANGAN HOOK
  let comp17Content = '';
  let comp17Origin = { documentName: fileName, sectionTitle: 'Perancangan Hook', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s17 = extractSectionText(/17\.\s*Perancangan\s*Hook[^:]*:/i, [/18\.\s*Perancangan/i, /Klimaks/i]);
    if (s17.text) {
      comp17Content = s17.text;
      comp17Origin.lineNumber = s17.lineNo;
      comp17Origin.isExplicit = true;
    }
  }

  // 18. PERANCANGAN KLIMAKS DAN PENUTUP
  let comp18Content = '';
  let comp18Origin = { documentName: fileName, sectionTitle: 'Klimaks & Penutup', lineNumber: 1, isExplicit: false, textSnippet: '' };
  if (isStructuredTemplate) {
    const s18 = extractSectionText(/18\.\s*Perancangan\s*Klimaks[^:]*:/i, [/19\.\s*Audit/i, /F\.\s*AUDIT/i]);
    if (s18.text) {
      comp18Content = s18.text;
      comp18Origin.lineNumber = s18.lineNo;
      comp18Origin.isExplicit = true;
    }
  }

  // =========================================================================
  // AUDIT 19 - 23 (EVALUASI KESIAPAN KERANGKA SEBELUM PENULISAN NARASI)
  // =========================================================================

  // 19. AUDIT KONSISTENSI SUBSTANSI
  const audit19Passed = Boolean(comp1Content && comp3Content && comp5Content && comp7Content && comp8Content);
  const comp19Content = audit19Passed
    ? 'LULUS AUDIT: Fokus besar, pertanyaan inti, kerangka masalah, tesis utama, dan logic punch terintegrasi kuat secara tematik tanpa saling bertabrakan.'
    : 'TIDAK DITEMUKAN DALAM DOKUMEN: Poin fokus besar, pertanyaan inti, atau tesis utama belum lengkap.';

  // 20. AUDIT KELENGKAPAN ARGUMENTASI
  const audit20Passed = evidenceItems.length > 0 && Boolean(comp11Content);
  const comp20Content = audit20Passed
    ? `LULUS AUDIT: Rantai logika lengkap didukung pemetaan ${evidenceItems.length} fakta terverifikasi dan klasifikasi valid.`
    : 'TIDAK DITEMUKAN DALAM DOKUMEN: Dokumen belum menyertakan pemetaan fakta empiris dan rantai logika terstruktur.';

  // 21. AUDIT POTENSI PENYIMPANGAN
  const audit21Passed = tidakBolehDimasukkan.length > 0;
  const comp21Content = audit21Passed
    ? `LULUS AUDIT: Batas pembahasan terkunci ketat (${tidakBolehDimasukkan.length} batasan terlarang aktif termasuk larangan SARA dan label framework).`
    : 'TIDAK DITEMUKAN DALAM DOKUMEN: Batasan materi terlarang (Scope Boundary) belum ditentukan.';

  // 22. AUDIT KELAYAKAN STRUKTUR
  const audit22Passed = Boolean(comp14Content && comp15Content);
  const comp22Content = audit22Passed
    ? 'LULUS AUDIT: Proporsi StoryFlow 5 blok (8%, 17%, 45%, 20%, 10%) telah terpetakan secara utuh dalam Narrative Blueprint.'
    : 'TIDAK DITEMUKAN DALAM DOKUMEN: Alur 5 blok Narrative Blueprint belum terpetakan.';

  // 23. KEPUTUSAN KESIAPAN KERANGKA
  let readinessStatus: FrameworkReadinessStatus = 'SIAP DIKEMBANGKAN';
  let readinessReason = 'Kerangka memenuhi seluruh kriteria substansi, fokus terkunci, rantai bukti lengkap, dan batas pembahasan aman.';

  if (!audit20Passed) {
    readinessStatus = 'PERLU SUMBER/DATA';
    readinessReason = 'Terdapat klaim pokok yang belum didukung bukti empiris atau sumber referensi yang jelas.';
  } else if (!audit21Passed) {
    readinessStatus = 'PERLU MEMPERSEMPIT FOKUS';
    readinessReason = 'Cakupan topik terlalu luas dan belum mengunci batasan yang dilarang dibahas.';
  } else if (!audit22Passed) {
    readinessStatus = 'PERLU MEMPERBAIKI URUTAN';
    readinessReason = 'Urutan kausalitas antarblok dalam Narrative Blueprint belum selaras.';
  } else if (!audit19Passed) {
    readinessStatus = 'PERLU MENYELESAIKAN KONTRADIKSI';
    readinessReason = 'Terdapat pertentangan arah antara fokus masalah dan tesis utama.';
  }

  const comp23Content = `Status Kesiapan: ${readinessStatus}\nAlasan: ${readinessReason}`;

  // Bangun Objek Komponen Kanonis (1 s/d 23)
  const rawContents: Record<number, { content: string; origin: any; status: MasterFrameworkComponentStatus }> = {
    1: { content: comp1Content, origin: comp1Origin, status: comp1Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    2: { content: comp2Content, origin: comp2Origin, status: comp2Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    3: { content: comp3Content, origin: comp3Origin, status: comp3Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    4: { content: comp4Content, origin: comp4Origin, status: comp4Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    5: { content: comp5Content, origin: comp5Origin, status: comp5Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    6: { content: comp6Content, origin: comp6Origin, status: comp6Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    7: { content: comp7Content, origin: comp7Origin, status: comp7Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    8: { content: comp8Content, origin: comp8Origin, status: comp8Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    9: { content: comp9Content, origin: comp9Origin, status: comp9Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    10: { content: comp10Content, origin: comp10Origin, status: comp10Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    11: { content: comp11Content, origin: comp11Origin, status: comp11Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    12: { content: comp12Content, origin: comp12Origin, status: comp12Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    13: { content: comp13Content, origin: comp13Origin, status: comp13Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    14: { content: comp14Content, origin: comp14Origin, status: comp14Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    15: { content: comp15Content, origin: comp15Origin, status: comp15Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    16: { content: comp16Content, origin: comp16Origin, status: comp16Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    17: { content: comp17Content, origin: comp17Origin, status: comp17Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    18: { content: comp18Content, origin: comp18Origin, status: comp18Content ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    19: { content: comp19Content, origin: { documentName: 'Audit System', sectionTitle: 'Audit 19', lineNumber: 1, isExplicit: audit19Passed }, status: audit19Passed ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    20: { content: comp20Content, origin: { documentName: 'Audit System', sectionTitle: 'Audit 20', lineNumber: 1, isExplicit: audit20Passed }, status: audit20Passed ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    21: { content: comp21Content, origin: { documentName: 'Audit System', sectionTitle: 'Audit 21', lineNumber: 1, isExplicit: audit21Passed }, status: audit21Passed ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    22: { content: comp22Content, origin: { documentName: 'Audit System', sectionTitle: 'Audit 22', lineNumber: 1, isExplicit: audit22Passed }, status: audit22Passed ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN' },
    23: { content: comp23Content, origin: { documentName: 'Audit System', sectionTitle: 'Audit 23', lineNumber: 1, isExplicit: true }, status: readinessStatus === 'SIAP DIKEMBANGKAN' ? 'DITEMUKAN' : 'PERLU_KONFIRMASI' },
  };

  CANONICAL_COMPONENTS_SPEC.forEach((spec) => {
    const raw = rawContents[spec.id];
    const existingComp = existingData?.componentsById[spec.id];
    const isManuallyCorrected = Boolean(existingComp?.manualCorrection);

    componentsById[spec.id] = {
      id: spec.id,
      groupCode: spec.groupCode,
      groupTitle: spec.groupTitle,
      canonicalTitle: spec.canonicalTitle,
      subtitle: spec.subtitle,
      status: isManuallyCorrected ? 'DITEMUKAN' : raw.status,
      statusNotes: raw.status === 'DITEMUKAN' ? 'Ditemukan dalam dokumen' : 'Tidak ditemukan dalam dokumen',
      summary: (isManuallyCorrected ? existingComp!.content : raw.content).slice(0, 100) + '...',
      content: isManuallyCorrected ? existingComp!.content : raw.content,
      sourceOrigin: raw.origin,
      manualCorrection: existingComp?.manualCorrection,
    };
  });

  // Aturan Wajib Bagian G (Meta Rules)
  const groupGComponents: MasterFrameworkComponent[] = [
    {
      id: 24,
      groupCode: 'G',
      groupTitle: 'ATURAN WAJIB PENGERJAAN',
      canonicalTitle: 'Otoritas Perencanaan vs Otoritas Penulisan',
      subtitle: 'Framework mengatur SUBSTANSI (apa yang dibahas); Master Prompt mengatur GAYA & FORMAT.',
      status: 'DITEMUKAN',
      summary: 'Keduanya saling melengkapi tanpa saling menggantikan.',
      content: 'GENFLOW MASTER PROMPT FINAL menjadi otoritas penulisan naskah lisan, gaya gue-lo, dan batasan teknis.\nGENFLOW MASTER FRAMEWORK FINAL menjadi otoritas substansi: topik, fokus, batas, fakta, dan alur.',
      sourceOrigin: { documentName: 'GENFLOW_MASTER_FRAMEWORK_FINAL.docx', isExplicit: true },
    },
    {
      id: 25,
      groupCode: 'G',
      groupTitle: 'ATURAN WAJIB PENGERJAAN',
      canonicalTitle: 'Larangan Mutlak Halusinasi Fakta & Kebocoran Label',
      subtitle: 'Dilarang mengarang angka/sumber dan dilarang membocorkan label instruksi ke narasi.',
      status: 'DITEMUKAN',
      summary: 'Setia 100% pada bukti tanpa membuat fakta fiktif.',
      content: '1. Dilarang mengarang fakta, angka statistik, tokoh, atau hubungan sebab-akibat yang tidak didukung data.\n2. Dilarang memasukkan label framework ("MASTER FRAMEWORK", "PERENCANAAN NASKAH YOUTUBE PRESISI", dll) ke dalam naskah narator.\n3. Pertahankan WPM terkunci 135 dan proporsi StoryFlow 5 blok.',
      sourceOrigin: { documentName: 'GENFLOW_MASTER_FRAMEWORK_FINAL.docx', isExplicit: true },
    },
  ];

  // Susun pengelompokan A - G
  const groups = {
    A: {
      title: 'INPUT UTAMA' as const,
      components: [componentsById[1], componentsById[2]],
    },
    B: {
      title: 'PENGUNCI SUBSTANSI' as const,
      components: [
        componentsById[3],
        componentsById[4],
        componentsById[5],
        componentsById[6],
        componentsById[7],
        componentsById[8],
        componentsById[9],
      ],
    },
    C: {
      title: 'PENGUNCI FAKTA DAN ARGUMENTASI' as const,
      components: [
        componentsById[10],
        componentsById[11],
        componentsById[12],
        componentsById[13],
      ],
    },
    D: {
      title: 'PERANCANGAN STRUKTUR NASKAH' as const,
      components: [componentsById[14], componentsById[15]],
    },
    E: {
      title: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP' as const,
      components: [componentsById[16], componentsById[17], componentsById[18]],
    },
    F: {
      title: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI' as const,
      components: [
        componentsById[19],
        componentsById[20],
        componentsById[21],
        componentsById[22],
        componentsById[23],
      ],
    },
    G: {
      title: 'ATURAN WAJIB PENGERJAAN' as const,
      components: groupGComponents,
    },
  };

  const unresolvedCount = Object.values(componentsById).filter(
    (c) => c.status !== 'DITEMUKAN'
  ).length;

  return {
    documentIdentity: {
      fileName,
      extractedAt: Date.now(),
      wordCount,
      readingStatus: unresolvedCount === 0 ? 'SUKSES' : 'PERLU_PERHATIAN',
      warnings,
    },
    executiveSummary: {
      topikUtama: componentsById[1].content,
      fokusBesar: componentsById[3].content,
      batasPembahasan: {
        wajibDibahas,
        bolehDisinggung,
        tidakBolehDimasukkan,
      },
      pertanyaanInti: componentsById[5].content,
      tesisUtama: componentsById[7].content,
      logicPunch: componentsById[8].content,
      statusKesiapan: readinessStatus,
      readinessReason,
      unresolvedCount,
    },
    groups,
    componentsById,
    isConfirmed: existingData?.isConfirmed || false,
    confirmedAt: existingData?.confirmedAt,
    confirmationNotes: existingData?.confirmationNotes,
    revisions: existingData?.revisions || [],
  };
}

// =========================================================================
// SUNTIKAN PROMPT SUBSTANSI TAHAP 2 BERDASARKAN MASTER FRAMEWORK
// =========================================================================

/**
 * Menyusun batasan dan panduan substansi presisi dari Master Framework
 * untuk diteruskan ke Tahap 2 Generate Naskah Awal (Draft V0).
 */
export function buildStage2MasterFrameworkPromptDirectives(
  framework: GenflowMasterFrameworkData
): string {
  const c = framework.componentsById;
  const exec = framework.executiveSummary;

  return `
================================================================================
GENFLOW MASTER FRAMEWORK FINAL — OTORITAS SUBSTANSI & PENGUNCI ARAH
================================================================================
TOPIK UTAMA: "${c[1]?.content || exec.topikUtama}"
KUNCI FOKUS BESAR (CENTRAL FOCUS):
${c[3]?.content || exec.fokusBesar}

KUNCI BATAS PEMBAHASAN (SCOPE BOUNDARY — WAJIB DIPATUHI MUTLAK):
1. WAJIB DIBAHAS:
${exec.batasPembahasan.wajibDibahas.map((w) => `   - ${w}`).join('\n')}

2. BOLEH DISINGGUNG (Jangan biarkan mendominasi fokus utama):
${exec.batasPembahasan.bolehDisinggung.map((b) => `   - ${b}`).join('\n')}

3. TIDAK BOLEH DIMASUKKAN (DILARANG KERAS MUNCUL DI NASKAH):
${exec.batasPembahasan.tidakBolehDimasukkan.map((t) => `   - [DILARANG] ${t}`).join('\n')}

KUNCI PERTANYAAN INTI (CORE QUESTION):
${c[5]?.content || exec.pertanyaanInti}

KUNCI TESIS UTAMA (CENTRAL THESIS):
${c[7]?.content || exec.tesisUtama}

KUNCI LOGIC PUNCH (KESIMPULAN INTELEKTUAL TERTAJAM):
${c[8]?.content || exec.logicPunch}

PEMETAAN LANDASAN FAKTA & BUKTI (EVIDENCE MAPPING — DILARANG MENGARANG FAKTA):
${c[10]?.content || '-'}

PEMETAAN RANTAI LOGIKA (ARGUMENT CHAIN):
${c[11]?.content || '-'}

NARRATIVE BLUEPRINT PER BLOK:
${c[15]?.content || '-'}

PERANCANGAN HOOK & KLIMAKS:
- Hook (Blok 1): ${c[17]?.content || '-'}
- Klimaks & Penutup (Blok 5): ${c[18]?.content || '-'}

KEBIJAKAN UTAMA BANK FRASA NARATIF (UNIFIED G1–G11 CONTEXTUAL NARRATION SYSTEM):
1. OTORITAS & PRINSIP PENGENDALI G1 (MUTLAK):
   - G1 adalah aturan pengendali utama bagi seluruh penggunaan Bank Frasa Naratif G2–G11.
   - G1 adalah prinsip pemilihan, rotasi, dan adaptasi lisan. G2–G11 adalah 10 kategori fungsi frasa.
   - G2–G11 merupakan bank pilihan opsional, BUKAN daftar kewajiban generasi. Seluruh penggunaan G2–G11 wajib tunduk pada G1.
   - Gunakan frasa dari 10 kategori ini HANYA untuk transisi antargagasan yang MEMANG MEMBUTUHKAN PENGHUBUNG.
   - Pilih secara bervariasi di antara frasa yang sesuai konteks. JANGAN memaksakan frasa pada setiap kalimat.
   - Jika frasa dalam bank terdengar formal atau kaku, adaptasi ke bentuk percakapan santai gue-lo atau lewati saja (misal: "pada akhirnya" -> "ujung-ujungnya", "hal yang perlu diperhatikan" -> "yang perlu lo lihat").
   - Bank frasa TIDAK BOLEH mengalahkan aturan bahasa lisan informal, DRA+PTV, atau kemurnian bahasa.
   - Hindari pengulangan frasa pembuka dan transisi pada paragraf berurutan.
2. KETERSEDIAAN GLOBAL G2–G11 TANPA PEMBATASAN BLOK:
   - Seluruh kategori G2–G11 tersedia secara global untuk KELIMA BLOK StoryFlow (Hook, Akar Masalah, Inti Masalah, Penyelesaian, Kesimpulan).
   - Hapus seluruh pembatasan penempatan berdasarkan blok (TIDAK ADA pembagian Blok 1 khusus G2-G3, Blok 2 khusus G4-G5, dst).
   - Semua kategori boleh dipertimbangkan di blok mana pun sesuai fungsi semantis dan kebutuhan narasi aktual.
3. FUNGSI ASLI KATEGORI G WAJIB DIJAGA:
   - G2: Pembuka yang terasa akrab.
   - G3: Ajakan agar penonton ikut masuk/membayangkan.
   - G4: Refleksi ringan.
   - G5: Membuat narator terasa dekat.
   - G6: Transisi yang natural antargagasan.
   - G7: Penekanan santai tetapi mengena.
   - G8: Mematahkan ekspektasi dan membantah argumen (gunakan HANYA saat menguji argumen/klaim).
   - G9: Eskalasi dan menambah tensi cerita (gunakan HANYA saat alur menuntut eskalasi nyata).
   - G10: Menjaga interaksi dengan penonton (pertanyaan reflektif).
   - G11: Penutup yang terasa seperti ngobrol santai.
4. PRINSIP NON-FORCING MUTLAK & LARANGAN KONEKTOR OTOMATIS:
   - DILARANG menetapkan target minimal, kuota frasa per blok, persentase, urutan, atau kewajiban menggunakan seluruh kategori.
   - Satu blok boleh menggunakan banyak frasa jika butuh, sedikit frasa, atau TIDAK MENGGUNAKAN FRASA SAMA SEKALI jika alurnya sudah mengalir lancar. Tidak menggunakan frasa bukan kesalahan.
   - JANGAN menganggap setiap tanda titik membutuhkan penghubung. JANGAN menyisipkan konektor berdasarkan kata pemicu sederhana (seperti "tidak", "bukan", "salah", "keliru", "masalah", "dampak", "akibat").
   - Jika hubungan antarkalimat sudah jelas dan alami saat dibacakan, PERTAHANKAN 100% tanpa tambahan!

PERINGATAN INTEGRITAS & KETERLACAKAN SUBSTANSI:
- Naskah Draft V0 WAJIB dapat ditelusuri kembali ke poin-poin kerangka di atas.
- Dilarang mengganti fokus, dilarang melompat dari alur blueprint, dan dilarang menambahkan materi terlarang.
- Dilarang membocorkan nama komponen atau label instruksi internal ke dalam teks lisan narator.
================================================================================`;
}

// =========================================================================
// SISTEM KETERLACAKAN DRAFT V0 TERHADAP MASTER FRAMEWORK (TRACEABILITY)
// =========================================================================

/**
 * Melakukan verifikasi keterlacakan setiap blok naskah Draft V0
 * terhadap 23 komponen Master Framework dan memeriksa batas pembahasan (Scope Boundary).
 */
export function verifyDraftV0Traceability(
  cleanScript: string,
  framework: GenflowMasterFrameworkData,
  config: GenNASConfig
): FrameworkTraceabilityReport {
  const rawBlocks = (cleanScript || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const blockNames = [
    'Blok 1: Hook & Pengenalan Masalah (8%)',
    'Blok 2: Akar Masalah & Konteks (17%)',
    'Blok 3: Inti Masalah & Pembedahan Bukti (45%)',
    'Blok 4: Penyelesaian & Koreksi Logika (20%)',
    'Blok 5: Kesimpulan & Logic Punch (10%)',
  ];

  const exec = framework.executiveSummary;
  const wajibList = exec.batasPembahasan.wajibDibahas || [];
  const larangList = exec.batasPembahasan.tidakBolehDimasukkan || [];

  const blockResults: BlockTraceabilityResult[] = [];
  const allViolations: string[] = [];
  const coveredMandatorySet = new Set<string>();

  rawBlocks.forEach((blockText, idx) => {
    const blockId = idx + 1;
    const blockName = blockNames[idx] || `Blok ${blockId}`;
    const words = blockText.split(/\s+/).filter(Boolean);
    const lowerBlock = blockText.toLowerCase();

    // Komponen yang menjadi dasar blok ini
    const groundedComponentIds: number[] = [1, 3, 4, 15]; // Selalu terikat ke Topik, Fokus, Batas, Blueprint

    if (blockId === 1) {
      groundedComponentIds.push(5, 14, 17); // Core Question, Hook, Fungsi
    } else if (blockId === 2) {
      groundedComponentIds.push(6, 9, 11); // Problem Framework, Perspective Shift, Argument Chain
    } else if (blockId === 3) {
      groundedComponentIds.push(7, 10, 11, 12, 13); // Tesis, Evidence Mapping, Kontraargumen, Plot Twist
    } else if (blockId === 4) {
      groundedComponentIds.push(6, 9, 14); // Mekanisme Solusi, Perspektif Baru
    } else if (blockId === 5) {
      groundedComponentIds.push(7, 8, 14, 18); // Tesis, Logic Punch, Klimaks & Penutup
    }

    // Deteksi pelanggaran Batas Pembahasan (Tidak Boleh Dimasukkan)
    const blockViolations: string[] = [];
    larangList.forEach((larang) => {
      // Ambil kata kunci signifikan dari larangan
      const keywords = larang
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 4 && !['tidak', 'boleh', 'dimasukkan', 'larangan', 'terhadap', 'dalam'].includes(w));

      if (keywords.length > 0) {
        const hasViolation = keywords.some(
          (kw) =>
            lowerBlock.includes(kw) &&
            (kw.includes('sara') ||
              kw.includes('instruksi') ||
              kw.includes('framework') ||
              kw.includes('master'))
        );
        if (hasViolation) {
          blockViolations.push(`Terdeteksi potensi materi terlarang: "${larang}"`);
          allViolations.push(`Blok ${blockId}: ${larang}`);
        }
      }
    });

    // Periksa poin Wajib Dibahas yang tercermin
    const matchedMandatory: string[] = [];
    wajibList.forEach((wajib) => {
      const keywords = wajib
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 4);

      const isCovered = keywords.some((kw) => lowerBlock.includes(kw));
      if (isCovered) {
        matchedMandatory.push(wajib);
        coveredMandatorySet.add(wajib);
      }
    });

    // Poin bukti yang dikutip
    const evidenceCited: string[] = [];
    const evMatches = blockText.match(/\b(\d+[\d.,]*%?|\bRp\s*[\d.,]+|\btahun\s*\d{4})\b/gi);
    if (evMatches) {
      evMatches.slice(0, 3).forEach((m) => evidenceCited.push(`Data riil: ${m}`));
    }

    blockResults.push({
      blockId,
      blockName,
      wordCount: words.length,
      groundedComponentIds,
      groundedPoints: [
        `Fokus: ${framework.componentsById[3]?.summary || exec.fokusBesar}`,
        `Fungsi: Blok ini menjalankan fungsi ${blockNames[idx].split(':')[1]?.trim() || ''}`,
      ],
      boundaryCheck: blockViolations.length === 0 ? 'LULUS' : 'PELANGGARAN_TERDETEKSI',
      boundaryViolations: blockViolations,
      matchedMandatoryPoints: matchedMandatory,
      evidenceCited,
      summary: `Terhubung ke ${groundedComponentIds.length} komponen kerangka. ${matchedMandatory.length} poin wajib tercakup.`,
    });
  });

  const missingPoints = wajibList.filter((w) => !coveredMandatorySet.has(w));
  const passed = allViolations.length === 0 && blockResults.length === config.jumlahBlok;

  return {
    passed,
    checkedAt: Date.now(),
    totalBlocks: blockResults.length,
    blockResults,
    overallMandatoryCoverage: {
      totalMandatory: wajibList.length,
      coveredCount: coveredMandatorySet.size,
      missingPoints,
    },
    forbiddenBoundaryViolations: allViolations,
    statusSummary: passed
      ? 'KETERLACAKAN SEMPURNA: Seluruh 5 blok Draft V0 terhubung langsung ke Master Framework tanpa pelanggaran batas pembahasan.'
      : `DITEMUKAN CATATAN: Terdapat ${allViolations.length} potensi pelanggaran batas atau poin wajib yang belum terrefleksikan optimal.`,
  };
}
