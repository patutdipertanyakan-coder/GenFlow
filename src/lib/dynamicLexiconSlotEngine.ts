import {
  EXPANSION_CATEGORY_LABELS,
  ExpansionLexiconEntry,
  getCanonicalDedupKey,
  normalizeDisplayExpansionEntry,
} from './expansionLexiconBank';
import { CustomLexiconState, getCustomLexiconState } from './customLexiconStore';

export type LexiconSourceCategory =
  | 'F1_CORE'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'EXPANSION'
  | 'CUSTOM';

export interface MasterLexiconEntry {
  /** Identitas permanen berbasis ID kosakata (bukan nomor slot) */
  id: string;
  /** Kata atau frasa tampilan asli */
  word: string;
  /** Kunci kanonik deduplikasi (lowercase, normalisasi spasi/tanda hubung) */
  canonicalKey: string;
  /** Sumber kategori di dalam MASTER_LEXICON_REGISTRY */
  source: LexiconSourceCategory;
  /** Label sumber yang ramah pengguna di UI */
  sourceLabel: string;
  /** Indeks slot asli 0..55 jika merupakan bagian dari 56 entri inti F1, selain itu null */
  coreSlotIndex: number | null;
  /** True jika merupakan penanda percakapan umum F4 (seperti gue, lo, nggak, udah) */
  isConversationalMarker: boolean;
}

export interface MasterLexiconRegistry {
  /** Seluruh entri permanen F1–F8 + Bank Ekspansi + Kustom */
  readonly allEntries: readonly MasterLexiconEntry[];
  /** 56 entri inti wajib F1 secara berurutan (indeks 0..55) */
  readonly core56Entries: readonly MasterLexiconEntry[];
  /** Peta pencarian cepat berdasarkan canonicalKey */
  readonly byCanonicalKey: ReadonlyMap<string, MasterLexiconEntry>;
  /** Peta pencarian cepat berdasarkan ID kosakata */
  readonly byId: ReadonlyMap<string, MasterLexiconEntry>;
  /** Status kelengkapan 56/56 kosakata inti F1 */
  readonly coreAvailableCount: number;
  readonly coreExpectedCount: number;
  readonly isCoreComplete: boolean;
}

export interface UsedLexiconMatch {
  entry: MasterLexiconEntry;
  /** Posisi indeks karakter pertama kemunculan di dalam clean_script */
  firstOccurrenceIndex: number;
  /** Jumlah total kemunculan di dalam clean_script */
  occurrenceCount: number;
  /** Potongan token yang cocok di dalam clean_script */
  matchedSurface: string;
}

export interface DynamicLexiconSlot {
  /** Nomor urut slot tampilan (1..56) */
  slotNumber: number;
  /** Indeks slot 0-based (0..55) */
  slotIndex: number;
  /** Identitas unik kosakata yang saat ini menempati slot ini */
  entryId: string;
  /** Kata/frasa yang ditampilkan pada slot */
  word: string;
  /** Kunci kanonik kata yang ditampilkan */
  canonicalKey: string;
  /** Kategori asal kosakata yang sedang tampil */
  source: LexiconSourceCategory;
  /** Label sumber kategori (mis. "F1 Inti", "F2 (-in)", "Ekspansi") */
  sourceLabel: string;
  /** Apakah kosakata ini benar-benar digunakan dalam clean_script aktif */
  isUsed: boolean;
  /** Jumlah kemunculan kata ini di dalam clean_script aktif */
  occurrenceCount: number;
  /** Indeks kemunculan pertama di dalam clean_script (null jika tidak digunakan) */
  firstOccurrenceIndex: number | null;
  /** Kata inti F1 asli yang memiliki slot ini secara default (mis. Slot 1 = "ngitungin") */
  originalCoreWord: string;
  /** ID kosakata inti F1 asli pada slot ini */
  originalCoreEntryId: string;
  /** True jika slot ini sedang menampilkan kata pengganti dari F1–F8/Ekspansi karena kata inti aslinya tidak dipakai di naskah */
  isReplacedSlot: boolean;
}

export interface DynamicDisplayLexiconResult {
  /** Kapasitas daftar slot tampilan utama (16 slot F1 Core) */
  readonly slotCapacity: number;
  /** Slot tampilan dinamis yang siap dirender di UI */
  readonly slots: readonly DynamicLexiconSlot[];
  /** Jumlah kosakata inti F1 yang tersedia di MASTER_LEXICON_REGISTRY (16) */
  readonly coreAvailableCount: number;
  /** Jumlah kosakata inti F1 yang diharapkan (16) */
  readonly coreExpectedCount: number;
  /** Jumlah total entri unik dari MASTER_LEXICON_REGISTRY yang benar-benar digunakan di clean_script */
  readonly totalUsedCount: number;
  /** Jumlah slot yang saat ini berisi kata yang digunakan */
  readonly displayedUsedCount: number;
  /** Jumlah kata inti F1 asli yang digunakan dalam clean_script */
  readonly coreUsedCount: number;
  /** Jumlah slot yang digantikan oleh kata lain dari F1–F8 / Ekspansi karena kata F1 aslinya tidak dipakai */
  readonly replacedSlotCount: number;
  /** Seluruh kosakata yang terdeteksi digunakan di clean_script (diurutkan berdasarkan prioritas & urutan kemunculan) */
  readonly allUsedEntries: readonly UsedLexiconMatch[];
  /** Kosakata yang digunakan namun berada di luar kapasitas slot utama (ketika totalUsedCount > slotCapacity) */
  readonly overflowUsedEntries: readonly UsedLexiconMatch[];
  /** Total seluruh kosakata permanen yang tersimpan di MASTER_LEXICON_REGISTRY */
  readonly totalMasterRegistryCount: number;
}

export const DYNAMIC_SLOT_CAPACITY = 16;

export interface BuildMasterRegistryInput {
  coreF1: readonly string[];
  f2Entries: readonly string[];
  f3Entries: readonly string[];
  f4Entries: readonly string[];
  f5Entries: readonly string[];
  f6Entries: readonly string[];
  expansionEntries: readonly ExpansionLexiconEntry[];
  customState?: CustomLexiconState;
}

/**
 * Membangun MASTER_LEXICON_REGISTRY permanen.
 * Tidak pernah menghapus atau memodifikasi 56 entri inti F1 maupun bank F2–F8 dan Ekspansi.
 */
export function createMasterLexiconRegistry(
  input: BuildMasterRegistryInput
): MasterLexiconRegistry {
  const allEntries: MasterLexiconEntry[] = [];
  const core56Entries: MasterLexiconEntry[] = [];
  const byCanonicalKey = new Map<string, MasterLexiconEntry>();
  const byId = new Map<string, MasterLexiconEntry>();

  const registerEntry = (
    wordRaw: string,
    source: LexiconSourceCategory,
    sourceLabel: string,
    coreSlotIndex: number | null,
    isConversationalMarker: boolean
  ) => {
    const word = normalizeDisplayExpansionEntry(wordRaw);
    if (!word) return;
    const canonicalKey = getCanonicalDedupKey(word);
    if (!canonicalKey) return;

    if (byCanonicalKey.has(canonicalKey)) {
      return;
    }

    const id =
      coreSlotIndex !== null
        ? `f1-core-${String(coreSlotIndex + 1).padStart(2, '0')}-${canonicalKey}`
        : `lex-${source.toLowerCase()}-${canonicalKey}`;

    const entry: MasterLexiconEntry = Object.freeze({
      id,
      word,
      canonicalKey,
      source,
      sourceLabel,
      coreSlotIndex,
      isConversationalMarker,
    });

    allEntries.push(entry);
    byCanonicalKey.set(canonicalKey, entry);
    byId.set(id, entry);

    if (coreSlotIndex !== null) {
      core56Entries.push(entry);
    }
  };

  // 1. 56 Entri Inti Wajib F1 (Slot 0..55)
  input.coreF1.forEach((word, idx) => {
    registerEntry(word, 'F1_CORE', 'F1 Inti', idx, false);
  });

  // 2. Bank F2 (Akhiran -in, termasuk "nyontohin")
  input.f2Entries.forEach((word) => {
    registerEntry(word, 'F2', 'F2 (-in)', null, false);
  });

  // 3. Bank F3 (Afiks ng-, nge-, ny-, n-)
  input.f3Entries.forEach((word) => {
    registerEntry(word, 'F3', 'F3 (ng-/nge-/ny-/n-)', null, false);
  });

  // 4. Bank F5 (Kata Kerja Percakapan Pengganti Formal)
  input.f5Entries.forEach((word) => {
    registerEntry(word, 'F5', 'F5 (Verba Lisan)', null, false);
  });

  // 5. Bank F6 (Contoh Ragam Informal Kajian Kebahasaan)
  input.f6Entries.forEach((word) => {
    registerEntry(word, 'F6', 'F6 (Kajian Lisan)', null, false);
  });

  // 6. Bank Ekspansi 299 Entri (Koleksi Tambahan Terpisah)
  input.expansionEntries.forEach((exp) => {
    registerEntry(
      exp.word,
      'EXPANSION',
      `Ekspansi (${EXPANSION_CATEGORY_LABELS[exp.category].replace(/^Kelompok\s+/i, '')})`,
      null,
      false
    );
  });

  // 7. Bank F4 (Penanda Percakapan & Kata Penghubung)
  input.f4Entries.forEach((word) => {
    registerEntry(word, 'F4', 'F4 (Penanda Lisan)', null, true);
  });

  // 8. Kosakata Kustom Pengguna (jika ada)
  const custom = input.customState || getCustomLexiconState();
  (['F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as const).forEach((sec) => {
    const list = custom[sec] || [];
    list.forEach((word) => {
      registerEntry(
        word,
        'CUSTOM',
        `Kustom (${sec})`,
        null,
        sec === 'F4'
      );
    });
  });

  return Object.freeze({
    allEntries: Object.freeze(allEntries),
    core56Entries: Object.freeze(core56Entries),
    byCanonicalKey,
    byId,
    coreAvailableCount: core56Entries.length,
    coreExpectedCount: DYNAMIC_SLOT_CAPACITY,
    isCoreComplete: core56Entries.length === DYNAMIC_SLOT_CAPACITY,
  });
}

function escapeRegexLiteral(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Membuat RegExp pencocokan kata/frasa penuh dengan batas token Unicode Bahasa Indonesia.
 * Aturan ketat:
 * - "mikir" TIDAK boleh cocok pada "mikirin" atau "pemikiran".
 * - "buat" TIDAK boleh cocok pada "ngebuat" atau "buatan".
 * - "ngitungin" TIDAK boleh cocok pada "nyontohin" atau "ngitung".
 * - Mendukung bentuk berstrip seperti "nge-scroll" / "ngescroll" tanpa merusak batas kata di kiri dan kanan.
 * - Mendukung pola berelipsis pada F4 seperti "bukannya ... malah ...".
 */
const REGEX_CACHE = new Map<string, RegExp>();

export function buildTokenBoundaryRegex(word: string): RegExp {
  const cached = REGEX_CACHE.get(word);
  if (cached) {
    cached.lastIndex = 0;
    return cached;
  }

  const trimmed = word.trim().toLowerCase();

  // Tangani frasa korelatif dengan elipsis "..." seperti "bukannya ... malah ..."
  if (trimmed.includes('...')) {
    const parts = trimmed
      .split(/\s*\.\.\.\s*/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => escapeRegexLiteral(p).replace(/\s+/g, '\\s+'));

    const pattern = `(?<![\\p{L}\\p{N}_-])${parts.join(
      '[\\s\\S]{1,120}?'
    )}(?![\\p{L}\\p{N}_-])`;
    const rx = new RegExp(pattern, 'giu');
    REGEX_CACHE.set(word, rx);
    return rx;
  }

  // Untuk kata/frasa normal:
  // Jika entri mengandung tanda hubung (mis. "nge-scroll", "nyampur-baurin"),
  // izinkan kecocokan baik dengan tanda hubung, spasi, maupun tersambung ("ngescroll") untuk prefiks "nge-",
  // namun tetap dikunci dengan batas kata Unicode di awal dan akhir token!
  const tokens = trimmed.split(/\s+/).map((tok) => {
    if (tok.includes('-')) {
      const subParts = tok.split('-').map(escapeRegexLiteral);
      if (subParts[0] === 'nge' && subParts.length === 2) {
        return `nge[-\\s]?${subParts[1]}`;
      }
      return subParts.join('[-\\s]+');
    }
    return escapeRegexLiteral(tok);
  });

  const innerPattern = tokens.join('\\s+');
  // Batas token Bahasa Indonesia: tidak boleh diawali atau diikuti oleh huruf Unicode, angka, underscore, atau tanda hubung kata majemuk
  const fullPattern = `(?<![\\p{L}\\p{N}_-])${innerPattern}(?![\\p{L}\\p{N}_-])`;
  const rx = new RegExp(fullPattern, 'giu');
  REGEX_CACHE.set(word, rx);
  return rx;
}

/**
 * Memindai clean_script secara akurat untuk mendeteksi seluruh kosakata dari MASTER_LEXICON_REGISTRY
 * yang benar-benar muncul di dalam clean_script.
 *
 * Hanya isi clean_script yang menentukan status penggunaan.
 */
export function scanCleanScriptForLexicon(
  cleanScript: string,
  registry: MasterLexiconRegistry
): UsedLexiconMatch[] {
  if (!cleanScript || !cleanScript.trim()) {
    return [];
  }

  const matches: UsedLexiconMatch[] = [];

  for (const entry of registry.allEntries) {
    const rx = buildTokenBoundaryRegex(entry.word);
    rx.lastIndex = 0;

    let count = 0;
    let firstOccurrenceIndex = -1;
    let firstSurface = entry.word;

    let m: RegExpExecArray | null;
    while ((m = rx.exec(cleanScript)) !== null) {
      if (count === 0) {
        firstOccurrenceIndex = m.index;
        firstSurface = m[0];
      }
      count += 1;
      if (rx.lastIndex === m.index) {
        rx.lastIndex += 1;
      }
    }

    if (count > 0 && firstOccurrenceIndex >= 0) {
      matches.push({
        entry,
        firstOccurrenceIndex,
        occurrenceCount: count,
        matchedSurface: firstSurface,
      });
    }
  }

  // Urutkan berdasarkan:
  // 1) Kosakata leksikal/morfologis (F1, F2, F3, F5, F6, Ekspansi, Kustom) lebih dulu daripada partikel F4 umum,
  //    agar kata kerja/bentuk informal seperti "nyontohin" langsung menduduki slot pengganti utama (mis. No. 1).
  // 2) Urutan kemunculan pertama di dalam clean_script (firstOccurrenceIndex ascending).
  matches.sort((a, b) => {
    const aMarkerRank = a.entry.isConversationalMarker ? 1 : 0;
    const bMarkerRank = b.entry.isConversationalMarker ? 1 : 0;
    if (aMarkerRank !== bMarkerRank) {
      return aMarkerRank - bMarkerRank;
    }
    if (a.firstOccurrenceIndex !== b.firstOccurrenceIndex) {
      return a.firstOccurrenceIndex - b.firstOccurrenceIndex;
    }
    return a.entry.id.localeCompare(b.entry.id);
  });

  return matches;
}

export interface DynamicLexiconOptions {
  /**
   * Daftar ID entri dari 56 slot sebelumnya (opsional) untuk menjaga stabilitas nomor slot
   * saat pengguna mengetik/mengedit naskah karakter demi karakter.
   */
  previousSlotEntryIds?: readonly string[];
}

/**
 * Membangun DYNAMIC_DISPLAY_LEXICON (56 slot utama + daftar overflow) secara reaktif dari clean_script.
 *
 * Aturan Prioritas & Stabilitas:
 * 1. Saat clean_script kosong: tampilkan 56 entri inti F1 asli di slot 1..56, semuanya gelap (isUsed = false), totalUsedCount = 0.
 * 2. Saat clean_script berisi naskah:
 *    - Pertahankan kata dari 56 entri inti F1 yang benar-benar ditemukan di clean_script pada nomor slot aslinya (0..55).
 *    - Jika previousSlotEntryIds diberikan (saat edit real-time), pertahankan posisi slot dari kata pengganti yang MASIH digunakan di clean_script selama slot tersebut tidak sedang diklaim kembali oleh kata F1 aslinya yang baru dipakai.
 *    - Isi slot yang tidak aktif (kata F1 aslinya tidak dipakai di naskah) dengan kata lain dari MASTER_LEXICON_REGISTRY (F1–F8 & Ekspansi) yang benar-benar muncul di clean_script berdasarkan urutan kemunculannya.
 *    - Contoh wajib: Jika "ngitungin" (No. 1) tidak dipakai di naskah dan "nyontohin" dipakai di naskah, maka No. 1 otomatis diganti menjadi "nyontohin" (Kuning — Dipakai di Naskah).
 *    - Jangan pernah mengganti kata yang sedang digunakan dengan kata yang tidak digunakan.
 *    - Jika masih ada slot kosong (ketika total kata yang dipakai < 56), isi dengan entri inti F1 asli yang belum digunakan dan biarkan berwarna gelap.
 *    - Jika lebih dari 56 kosakata digunakan, tampilkan 56 kosakata yang digunakan di slot utama dan simpan sisanya di overflowUsedEntries tanpa memalsukan totalUsedCount.
 */
export function buildDynamicDisplayLexicon(
  cleanScript: string,
  registry: MasterLexiconRegistry,
  options?: DynamicLexiconOptions
): DynamicDisplayLexiconResult {
  const core56 = registry.core56Entries;

  // Kondisi awal / setelah Reset: belum ada clean_script yang valid
  if (!cleanScript || !cleanScript.trim()) {
    const initialSlots: DynamicLexiconSlot[] = core56.map((coreEntry, idx) => ({
      slotNumber: idx + 1,
      slotIndex: idx,
      entryId: coreEntry.id,
      word: coreEntry.word,
      canonicalKey: coreEntry.canonicalKey,
      source: coreEntry.source,
      sourceLabel: coreEntry.sourceLabel,
      isUsed: false,
      occurrenceCount: 0,
      firstOccurrenceIndex: null,
      originalCoreWord: coreEntry.word,
      originalCoreEntryId: coreEntry.id,
      isReplacedSlot: false,
    }));

    return {
      slotCapacity: DYNAMIC_SLOT_CAPACITY,
      slots: initialSlots,
      coreAvailableCount: registry.coreAvailableCount,
      coreExpectedCount: registry.coreExpectedCount,
      totalUsedCount: 0,
      displayedUsedCount: 0,
      coreUsedCount: 0,
      replacedSlotCount: 0,
      allUsedEntries: [],
      overflowUsedEntries: [],
      totalMasterRegistryCount: registry.allEntries.length,
    };
  }

  // Pindai seluruh kosakata dari MASTER_LEXICON_REGISTRY yang muncul di clean_script
  const allUsedMatches = scanCleanScriptForLexicon(cleanScript, registry);
  const usedById = new Map<string, UsedLexiconMatch>();
  const usedByCanonical = new Map<string, UsedLexiconMatch>();

  for (const match of allUsedMatches) {
    usedById.set(match.entry.id, match);
    usedByCanonical.set(match.entry.canonicalKey, match);
  }

  const assignedEntries: (MasterLexiconEntry | null)[] = Array.from(
    { length: DYNAMIC_SLOT_CAPACITY },
    () => null
  );
  const placedIds = new Set<string>();
  const placedCanonicalKeys = new Set<string>();

  const assignToSlot = (slotIdx: number, entry: MasterLexiconEntry) => {
    assignedEntries[slotIdx] = entry;
    placedIds.add(entry.id);
    placedCanonicalKeys.add(entry.canonicalKey);
  };

  // TAHAP 1: Pertahankan seluruh entri dari 56 F1 Inti Asli yang BENAR-BENAR DIGUNAKAN pada nomor slot aslinya (0..55)
  let coreUsedCount = 0;
  for (let i = 0; i < DYNAMIC_SLOT_CAPACITY; i++) {
    const coreEntry = core56[i];
    if (coreEntry && usedById.has(coreEntry.id)) {
      assignToSlot(i, coreEntry);
      coreUsedCount += 1;
    }
  }

  // TAHAP 2 (Stabilitas Edit Real-Time):
  // Jika ada previousSlotEntryIds, pertahankan kata pengganti yang sebelumnya sudah tampil di slot i
  // DAN saat ini MASIH digunakan di dalam clean_script (selama slot i belum terisi oleh kata F1 aslinya).
  const prevIds = options?.previousSlotEntryIds;
  if (prevIds && prevIds.length === DYNAMIC_SLOT_CAPACITY) {
    for (let i = 0; i < DYNAMIC_SLOT_CAPACITY; i++) {
      if (assignedEntries[i] !== null) continue;
      const prevId = prevIds[i];
      if (!prevId) continue;
      const stillUsedMatch = usedById.get(prevId);
      if (
        stillUsedMatch &&
        !placedIds.has(stillUsedMatch.entry.id) &&
        !placedCanonicalKeys.has(stillUsedMatch.entry.canonicalKey)
      ) {
        assignToSlot(i, stillUsedMatch.entry);
      }
    }
  }

  // TAHAP 3: Isi slot yang belum memiliki kata aktif dengan kosakata lain dari F1–F8 / Ekspansi / Kustom
  // yang benar-benar muncul di clean_script, sesuai urutan kemunculannya di naskah!
  let nextMatchIdx = 0;
  for (let i = 0; i < DYNAMIC_SLOT_CAPACITY; i++) {
    if (assignedEntries[i] !== null) continue;

    while (
      nextMatchIdx < allUsedMatches.length &&
      (placedIds.has(allUsedMatches[nextMatchIdx].entry.id) ||
        placedCanonicalKeys.has(allUsedMatches[nextMatchIdx].entry.canonicalKey))
    ) {
      nextMatchIdx += 1;
    }

    if (nextMatchIdx < allUsedMatches.length) {
      assignToSlot(i, allUsedMatches[nextMatchIdx].entry);
      nextMatchIdx += 1;
    }
  }

  // TAHAP 4: Jika masih ada slot kosong (karena total kosakata yang digunakan < 56),
  // isi dengan entri inti F1 asli yang belum digunakan (tetap di slot aslinya jika memungkinkan) dan biarkan berwarna gelap.
  for (let i = 0; i < DYNAMIC_SLOT_CAPACITY; i++) {
    if (assignedEntries[i] !== null) continue;
    const nativeCore = core56[i];
    if (
      nativeCore &&
      !placedIds.has(nativeCore.id) &&
      !placedCanonicalKeys.has(nativeCore.canonicalKey)
    ) {
      assignToSlot(i, nativeCore);
    }
  }

  // Jika karena pergeseran stabilitas masih ada slot null, isi dengan entri F1 inti yang belum ditempatkan
  let fallbackCoreIdx = 0;
  for (let i = 0; i < DYNAMIC_SLOT_CAPACITY; i++) {
    if (assignedEntries[i] !== null) continue;
    while (
      fallbackCoreIdx < core56.length &&
      (placedIds.has(core56[fallbackCoreIdx].id) ||
        placedCanonicalKeys.has(core56[fallbackCoreIdx].canonicalKey))
    ) {
      fallbackCoreIdx += 1;
    }
    if (fallbackCoreIdx < core56.length) {
      assignToSlot(i, core56[fallbackCoreIdx]);
      fallbackCoreIdx += 1;
    }
  }

  // Bangun 56 DynamicLexiconSlot final
  let displayedUsedCount = 0;
  let replacedSlotCount = 0;

  const finalSlots: DynamicLexiconSlot[] = assignedEntries.map((entry, idx) => {
    const originalCore = core56[idx];
    const safeEntry = entry || originalCore;
    const usedMatch = usedById.get(safeEntry.id) || null;
    const isUsed = Boolean(usedMatch);
    const isReplacedSlot = safeEntry.id !== originalCore.id;

    if (isUsed) {
      displayedUsedCount += 1;
    }
    if (isReplacedSlot) {
      replacedSlotCount += 1;
    }

    return {
      slotNumber: idx + 1,
      slotIndex: idx,
      entryId: safeEntry.id,
      word: safeEntry.word,
      canonicalKey: safeEntry.canonicalKey,
      source: safeEntry.source,
      sourceLabel: safeEntry.sourceLabel,
      isUsed,
      occurrenceCount: usedMatch ? usedMatch.occurrenceCount : 0,
      firstOccurrenceIndex: usedMatch ? usedMatch.firstOccurrenceIndex : null,
      originalCoreWord: originalCore.word,
      originalCoreEntryId: originalCore.id,
      isReplacedSlot,
    };
  });

  // Kumpulkan kosakata yang digunakan namun tidak muat di 56 slot utama (ketika totalUsedCount > 56)
  const displayedEntryIds = new Set(finalSlots.map((s) => s.entryId));
  const overflowUsedEntries = allUsedMatches.filter(
    (m) => !displayedEntryIds.has(m.entry.id)
  );

  return {
    slotCapacity: DYNAMIC_SLOT_CAPACITY,
    slots: finalSlots,
    coreAvailableCount: registry.coreAvailableCount,
    coreExpectedCount: registry.coreExpectedCount,
    totalUsedCount: allUsedMatches.length,
    displayedUsedCount,
    coreUsedCount,
    replacedSlotCount,
    allUsedEntries: allUsedMatches,
    overflowUsedEntries,
    totalMasterRegistryCount: registry.allEntries.length,
  };
}
