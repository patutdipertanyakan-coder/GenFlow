export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export type TooltipStateBadge = 'NORMAL' | 'DISABLED' | 'LOADING';

export interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
  right?: number;
  bottom?: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface ComputedTooltipPosition {
  top: number;
  left: number;
  side: TooltipSide;
  arrowLeft: number;
  arrowTop: number;
}

export const TOOLTIP_HOVER_DELAY_MS = 230;
export const TOOLTIP_MAX_WIDTH = 300;
export const TOOLTIP_OFFSET_PX = 8;
export const TOOLTIP_VIEWPORT_MARGIN_PX = 12;

/**
 * Katalog terpusat keterangan spesifik untuk seluruh tombol dan kontrol GenNAS Pro V5.1.
 * Setiap elemen memiliki keterangan fungsi yang spesifik (bukan teks umum).
 */
export const GENNAS_TOOLTIP_CATALOG = Object.freeze({
  // Navigasi Utama & Header
  NAV_HOME: 'Kembali ke ruang kerja utama Studio Naskah SCTF GenNAS Pro.',
  NAV_STUDIO: 'Buka ruang kerja penulisan dan validasi 5 blok naskah SCTF.',
  NAV_LEXICON: 'Lihat kosakata informal F1–F8 dan penggunaannya dalam naskah.',
  NAV_VOICE_TTS: 'Siapkan teks khusus voice-over dan sintesis audio ElevenLabs v4 tanpa mengubah naskah asli.',
  NAV_MASTER_PROMPT: 'Lihat aturan utama yang digunakan generator narasi.',

  // Failover & Model Bar
  FAILOVER_TIER: 'Klik untuk merotasi tier kunci API cadangan pada sistem failover 22-tier.',
  MODEL_SWITCH: 'Klik untuk mengganti model Gemini yang aktif.',

  // Panel Konfigurasi (01. Parameter & Sumber Naskah)
  LOCKED_PERSPECTIVE:
    'Terkunci permanen pada Perilaku & Pola Pikir Masyarakat (Non-SARA) demi mencegah serangan terhadap SARA, institusi, atau individu.',
  RESET_WORKSPACE:
    'Kosongkan hasil kerja aktif sesuai cakupan reset (Kerangka Naskah, Token Terlindungi SAP, area teks Blok 1–5, dan reset 6 indikator ke 0/0).',
  UPLOAD_DOCUMENT:
    'Unggah dokumen sumber (.txt, .docx, atau .pdf) untuk diekstrak otomatis ke area Kerangka Naskah.',
  UPLOAD_DOCUMENT_LOADING:
    'Sedang mengekstrak isi dokumen dan memvalidasi integritas token SAP...',
  OUTLINE_TEXTAREA:
    'Ketik atau tempel kerangka naskah, argumen utama, angka, tanggal, dan fakta sumber yang akan dikembangkan.',
  SAP_TOKENS_PANEL:
    'Lihat angka, istilah, dan informasi penting yang dilindungi agar tidak berubah saat revisi tanda baca.',
  SAP_TOKENS_TOGGLE:
    'Tampilkan atau ringkas seluruh daftar token angka, mata uang, persentase, dan periode yang dilindungi SAP.',
  DURATION_PRESET: (min: number, wpm: number) =>
    `Tetapkan target durasi naskah ${min} menit (~${min * wpm} kata pada kecepatan bicara ${wpm} WPM).`,
  DURATION_CUSTOM_INPUT:
    'Atur target durasi naskah kustom dalam satuan menit (1 hingga 90 menit).',
  LOCKED_WPM:
    'Dikunci sistem pada 135 WPM (standar kecepatan narasi lisan YouTube Indonesia) dan tidak dapat diedit.',
  LOCKED_TOLERANCE:
    'Dikunci sistem pada mode FLEKSIBEL agar keutuhan argumen tetap terjaga dan tidak dapat diedit.',
  STORYFLOW_UBAH:
    'Kunci perubahan persentase 5 tahap StoryFlow yang Anda edit dan paksa AI menulis panjang blok sesuai bobot tersebut.',
  STORYFLOW_INPUT: (stageId: number, stageName: string) =>
    `Ubah bobot persentase untuk tahap ${stageId}. ${stageName}, lalu klik tombol Ubah untuk mengunci.`,
  EDITORIAL_REWRITE_CHECKBOX:
    'Izinkan penataan ulang kalimat secara editorial selama tidak mengubah fakta sumber atau kuota kritik.',
  INCLUDE_TITLE_CHECKBOX:
    'Sertakan baris judul referensi di luar 5 blok utama narasi SCTF.',

  // Panel Editor & Kualitas (02. Dashboard Kualitas & Operasi)
  UJI_VALIDATOR:
    'Suntikkan kasus uji pelanggaran ke Blok 1 & 2 untuk menguji ketajaman validator dan fitur Auto-Enforce.',
  GENERATE_ADVANCED:
    'Kembangkan kerangka menjadi lima blok narasi SCTF.',
  GENERATE_ADVANCED_LOADING:
    'Sedang menyusun 5 blok naskah SCTF dan memvalidasi 6 indikator kualitas secara bertahap...',
  AUTO_ENFORCE:
    'Perbaiki naskah agar memenuhi aturan Master Prompt GenNAS.',
  AUTO_ENFORCE_LOADING:
    'Sedang memulihkan kepatuhan 5 blok SCTF, kuota 4–5 kritik terintegrasi, gaya gue–lo, dan tanda baca...',
  EXPANDER:
    'Perdalam substansi naskah tanpa mengarang fakta.',
  EXPANDER_LOADING:
    'Sedang memperdalam argumen dan bukti penalaran di setiap blok naskah...',
  REVISI_KOMA:
    'Perbaiki tanda baca berdasarkan struktur kalimat bahasa Indonesia.',
  REVISI_KOMA_LOADING:
    'Sedang memperbaiki penempatan koma EYD V tanpa mengubah kata atau token angka SAP...',
  REVISI_TRANSISI:
    'Perbaiki kesinambungan antarblok agar narasi lebih mengalir.',
  REVISI_TRANSISI_LOADING:
    'Sedang menghapus kalimat pembuka gaya presenter dan menyambung kohesi antarblok...',
  AUDIT_VALIDASI:
    'Periksa kepatuhan naskah terhadap seluruh aturan GenNAS.',
  AUDIT_VALIDASI_LOADING:
    'Sedang menjalankan audit deterministik dan semantik pada seluruh blok naskah...',
  PREPARE_VOICE_SCRIPT:
    'Siapkan teks khusus voice-over tanpa mengubah naskah asli.',
  PREPARE_VOICE_SCRIPT_DISABLED:
    'Selesaikan Generate Naskah sebelum menyiapkan Voice Script.',

  // Mode Tampilan & Ekspor
  VIEW_VISUAL_5_BLOCKS:
    'Tampilkan editor per blok (Blok 1 s.d. Blok 5) beserta status audit masing-masing tahap.',
  VIEW_RAW_SCTF:
    'Tampilkan dan edit naskah mentah dalam kontrak SCTF (tepat 5 baris, dipisahkan 1 newline).',
  VIEW_JSON_AUDIT:
    'Tampilkan laporan lengkap hasil audit validator deterministik dalam format JSON.',
  COPY_CLEAN_SCRIPT:
    'Salin seluruh naskah bersih (clean_script) ke clipboard.',
  COPY_CLEAN_SCRIPT_DISABLED:
    'Selesaikan Generate Naskah terlebih dahulu sebelum menyalin naskah.',
  EXPORT_TXT:
    'Unduh naskah bersih (clean_script) dalam format file teks (.txt).',
  EXPORT_TXT_DISABLED:
    'Selesaikan Generate Naskah terlebih dahulu sebelum mengunduh file .TXT.',
  EXPORT_DOCX:
    'Unduh naskah dalam format Microsoft Word.',
  EXPORT_DOCX_DISABLED:
    'Selesaikan Generate Naskah terlebih dahulu sebelum mengunduh dokumen Microsoft Word (.docx).',
  EXPORT_JSON:
    'Unduh laporan audit kualitas dan metadata validator dalam format .json.',
  BLOCK_DETAIL_TOGGLE: (blockNum: number) =>
    `Buka atau tutup rincian audit tanda baca, gaya bahasa, dan transisi untuk Blok ${blockNum}.`,
  BLOCK_REPAIR_SINGLE: (blockNum: number) =>
    `Perbaiki otomatis khusus Blok ${blockNum} tanpa mengubah isi blok lainnya.`,
});

export interface ResolveTooltipTextInput {
  tooltip?: string | null;
  disabledReason?: string | null;
  loadingReason?: string | null;
  isDisabled?: boolean;
  isLoading?: boolean;
}

export interface ResolvedTooltipText {
  text: string;
  badge: TooltipStateBadge;
  badgeLabel: string | null;
}

/**
 * Menentukan teks keterangan dan status badge yang tepat untuk kondisi tombol
 * (normal, sedang memproses/loading, atau sedang dikunci/disabled).
 */
export function resolveTooltipContent(
  input: ResolveTooltipTextInput
): ResolvedTooltipText | null {
  const baseText = (input.tooltip || '').trim();
  const disabledText = (input.disabledReason || '').trim();
  const loadingText = (input.loadingReason || '').trim();

  if (input.isLoading) {
    const chosen = loadingText || disabledText || baseText;
    if (!chosen) return null;
    return {
      text: chosen,
      badge: 'LOADING',
      badgeLabel: 'Sedang Memproses',
    };
  }

  if (input.isDisabled) {
    const chosen = disabledText || baseText;
    if (!chosen) return null;
    return {
      text: chosen,
      badge: 'DISABLED',
      badgeLabel: 'Terkunci / Nonaktif',
    };
  }

  if (!baseText) return null;
  return {
    text: baseText,
    badge: 'NORMAL',
    badgeLabel: null,
  };
}

/**
 * Menghitung posisi optimal Tooltip (top, bottom, left, atau right) secara otomatis
 * berdasarkan ruang layar yang tersedia agar tidak pernah terpotong tepi viewport.
 */
export function computeSmartTooltipPosition(
  triggerRect: RectBox,
  tooltipSize: Size2D,
  viewportSize: Size2D,
  preferredSide: TooltipSide = 'top'
): ComputedTooltipPosition {
  const triggerRight = triggerRect.right ?? triggerRect.left + triggerRect.width;
  const triggerBottom =
    triggerRect.bottom ?? triggerRect.top + triggerRect.height;
  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  const spaceTop = triggerRect.top - TOOLTIP_VIEWPORT_MARGIN_PX;
  const spaceBottom =
    viewportSize.height - triggerBottom - TOOLTIP_VIEWPORT_MARGIN_PX;
  const spaceLeft = triggerRect.left - TOOLTIP_VIEWPORT_MARGIN_PX;
  const spaceRight =
    viewportSize.width - triggerRight - TOOLTIP_VIEWPORT_MARGIN_PX;

  const needVertical = tooltipSize.height + TOOLTIP_OFFSET_PX;
  const needHorizontal = tooltipSize.width + TOOLTIP_OFFSET_PX;

  let side: TooltipSide = preferredSide;

  if (side === 'top' && spaceTop < needVertical) {
    if (spaceBottom >= needVertical) {
      side = 'bottom';
    } else if (spaceRight >= needHorizontal) {
      side = 'right';
    } else if (spaceLeft >= needHorizontal) {
      side = 'left';
    } else {
      side = spaceBottom >= spaceTop ? 'bottom' : 'top';
    }
  } else if (side === 'bottom' && spaceBottom < needVertical) {
    if (spaceTop >= needVertical) {
      side = 'top';
    } else if (spaceRight >= needHorizontal) {
      side = 'right';
    } else if (spaceLeft >= needHorizontal) {
      side = 'left';
    } else {
      side = spaceTop >= spaceBottom ? 'top' : 'bottom';
    }
  } else if (side === 'left' && spaceLeft < needHorizontal) {
    if (spaceRight >= needHorizontal) {
      side = 'right';
    } else if (spaceTop >= needVertical) {
      side = 'top';
    } else {
      side = 'bottom';
    }
  } else if (side === 'right' && spaceRight < needHorizontal) {
    if (spaceLeft >= needHorizontal) {
      side = 'left';
    } else if (spaceTop >= needVertical) {
      side = 'top';
    } else {
      side = 'bottom';
    }
  }

  let top = 0;
  let left = 0;

  if (side === 'top') {
    top = triggerRect.top - tooltipSize.height - TOOLTIP_OFFSET_PX;
    left = triggerCenterX - tooltipSize.width / 2;
  } else if (side === 'bottom') {
    top = triggerBottom + TOOLTIP_OFFSET_PX;
    left = triggerCenterX - tooltipSize.width / 2;
  } else if (side === 'left') {
    top = triggerCenterY - tooltipSize.height / 2;
    left = triggerRect.left - tooltipSize.width - TOOLTIP_OFFSET_PX;
  } else {
    top = triggerCenterY - tooltipSize.height / 2;
    left = triggerRight + TOOLTIP_OFFSET_PX;
  }

  // Clamp di dalam batas layar agar tidak pernah keluar viewport
  const maxLeft = Math.max(
    TOOLTIP_VIEWPORT_MARGIN_PX,
    viewportSize.width - tooltipSize.width - TOOLTIP_VIEWPORT_MARGIN_PX
  );
  const maxTop = Math.max(
    TOOLTIP_VIEWPORT_MARGIN_PX,
    viewportSize.height - tooltipSize.height - TOOLTIP_VIEWPORT_MARGIN_PX
  );

  const clampedLeft = Math.min(
    Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, Math.round(left)),
    Math.round(maxLeft)
  );
  const clampedTop = Math.min(
    Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, Math.round(top)),
    Math.round(maxTop)
  );

  const arrowLeft = Math.min(
    Math.max(12, Math.round(triggerCenterX - clampedLeft)),
    Math.max(12, Math.round(tooltipSize.width - 12))
  );
  const arrowTop = Math.min(
    Math.max(10, Math.round(triggerCenterY - clampedTop)),
    Math.max(10, Math.round(tooltipSize.height - 10))
  );

  return {
    top: clampedTop,
    left: clampedLeft,
    side,
    arrowLeft,
    arrowTop,
  };
}
