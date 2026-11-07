/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLanguagePurityAndSanitization,
  auditLanguageIntegrity,
  eliminateInternalMarkers,
  dissolveResearcherAttributions,
  replaceForeignWordsAndAcronyms,
  normalizeInformalMorphology,
} from './languageIntegrityEngine';
import {
  applyAutoEnforce,
  validateFullScript,
  compileVoiceScript,
  formatBlocksToSCTF,
} from './validatorAndPipeline';
import {
  exportCleanScriptTxt,
  exportScriptDocx,
  checkFinalExportEligibility,
} from './exportUtils';
import { GenNASConfig } from './types';

describe('REKONSTRUKSI KONTROL BAHASA, KEMURNIAN NARASI, & VALIDASI OUTPUT GENFLOW', () => {
  // =========================================================================
  // 1. KEBIJAKAN KEMURNIAN BAHASA INDONESIA
  // =========================================================================
  describe('1. Kebijakan Kemurnian Bahasa Indonesia & Pengalihan Singkatan', () => {
    it('mengganti kata "mastery" dengan padanan bahasa Indonesia "penguasaan"', () => {
      const input = 'Banyak orang ngira mastery atas keahlian finansial itu gampang, padahal butuh waktu.';
      const output = replaceForeignWordsAndAcronyms(input);
      assert.ok(!output.toLowerCase().includes('mastery'), 'Kata mastery tidak boleh ada dalam output');
      assert.ok(output.includes('penguasaan'), 'Harus diganti dengan penguasaan');
    });

    it('mengganti istilah asing tidak diperlukan (awareness, mindset, behavior, accountability) dengan padanan alami', () => {
      const input = 'Tingkat awareness warga masih rendah karena mindset lama, behavior konsumtif, dan minimnya accountability pejabat.';
      const output = replaceForeignWordsAndAcronyms(input);
      assert.ok(!output.toLowerCase().includes('awareness'), 'awareness harus diganti');
      assert.ok(!output.toLowerCase().includes('mindset'), 'mindset harus diganti');
      assert.ok(!output.toLowerCase().includes('behavior'), 'behavior harus diganti');
      assert.ok(!output.toLowerCase().includes('accountability'), 'accountability harus diganti');
      assert.ok(output.includes('kesadaran'), 'Harus memuat kesadaran');
      assert.ok(output.includes('pola pikir'), 'Harus memuat pola pikir');
      assert.ok(output.includes('perilaku'), 'Harus memuat perilaku');
      assert.ok(output.includes('pertanggungjawaban'), 'Harus memuat pertanggungjawaban');
    });

    it('mengalihkan singkatan nama lembaga asing ke bahasa Indonesia dalam narasi lisan', () => {
      const input = 'Laporan dari WHO dan World Bank sejalan dengan rilis IMF bahwa pertumbuhan ekonomi melambat.';
      const output = replaceForeignWordsAndAcronyms(input);
      assert.ok(!output.includes('WHO'), 'WHO wajib dialihkan');
      assert.ok(!output.includes('World Bank'), 'World Bank wajib dialihkan');
      assert.ok(!output.includes('IMF'), 'IMF wajib dialihkan');
      assert.ok(output.includes('Organisasi Kesehatan Dunia'), 'WHO -> Organisasi Kesehatan Dunia');
      assert.ok(output.includes('Bank Dunia'), 'World Bank -> Bank Dunia');
      assert.ok(output.includes('Dana Moneter Internasional'), 'IMF -> Dana Moneter Internasional');
    });

    it('mengalihkan singkatan percakapan asing (BTW, FYI) secara alami', () => {
      const input = 'BTW, kalian harus tahu fakta ini. FYI kondisi di lapangan jauh lebih parah.';
      const output = replaceForeignWordsAndAcronyms(input);
      assert.ok(!output.includes('BTW'), 'BTW harus dialihkan');
      assert.ok(!output.includes('FYI'), 'FYI harus dialihkan');
      assert.ok(output.includes('Ngomong-ngomong'), 'BTW -> Ngomong-ngomong');
      assert.ok(output.includes('Sebagai informasi'), 'FYI -> Sebagai informasi');
    });
  });

  // =========================================================================
  // 2. LARANGAN MUTLAK KEBOCORAN MARKER DAN METADATA INTERNAL
  // =========================================================================
  describe('2. Larangan Mutlak Kebocoran Marker Internal', () => {
    it('menghapus [GENFLOW_DOCUMENT_START] di tengah kalimat tanpa merusak substansi kalimat', () => {
      const input = 'Coba lo pikirin lagi gimana selama ini banyak orang cuma ngelihat permukaan dari [GENFLOW_DOCUMENT_START] persoalan yang sebenarnya.';
      const output = eliminateInternalMarkers(input);
      assert.strictEqual(
        output,
        'Coba lo pikirin lagi gimana selama ini banyak orang cuma ngelihat permukaan dari persoalan yang sebenarnya.'
      );
    });

    it('menghapus marker struktural internal lain [GENFLOW_DOCUMENT_END], [GF-XX], dan tag sistem', () => {
      const input = '[GENFLOW_DOCUMENT_START] Ini fakta lapangan [GF-01] yang disembunyikan [GENFLOW_DOCUMENT_END].';
      const output = eliminateInternalMarkers(input);
      assert.strictEqual(output, 'Ini fakta lapangan yang disembunyikan.');
    });
  });

  // =========================================================================
  // 3. LARANGAN MENYEBUT NAMA PENELITI & TIM DALAM NARASI FINAL
  // =========================================================================
  describe('3. Larangan Menyebut Nama Peneliti dalam Narasi Final', () => {
    it('meleburkan atribusi "Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa..." menjadi narasi substantif', () => {
      const input = 'Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa 78% pekerja mengalami penurunan daya beli riil.';
      const output = dissolveResearcherAttributions(input);
      assert.ok(!output.includes('Greig Inglis'), 'Nama peneliti tidak boleh ada dalam narasi');
      assert.ok(!output.includes('14 Desember 2022'), 'Tanggal introduksi peneliti tidak boleh ada');
      assert.ok(output.includes('78% pekerja mengalami penurunan daya beli riil'), 'Fakta dan angka wajib 100% utuh');
      assert.ok(output.startsWith('Hasil penelitian menunjukkan bahwa'), 'Wajib dileburkan ke narasi temuan substantif');
    });

    it('meleburkan varian atribusi "Menurut peneliti Smith dkk. (2021), ..."', () => {
      const input = 'Menurut peneliti Smith dkk. (2021), inflasi pangan menekan kelompok menengah ke bawah hingga 4 kali lipat.';
      const output = dissolveResearcherAttributions(input);
      assert.ok(!output.includes('Smith'), 'Nama peneliti Smith harus hilang');
      assert.ok(output.includes('inflasi pangan menekan kelompok menengah ke bawah hingga 4 kali lipat'), 'Substansi tetap utuh');
    });
  });

  // =========================================================================
  // 4. KONTROL MORFOLOGI KOSAKATA INFORMAL
  // =========================================================================
  describe('4. Kontrol Morfologi Kosakata Informal', () => {
    it('memperbaiki bentuk informal cacat "mrediksi" kembali ke "memprediksi"', () => {
      const input = 'Banyak pengamat mrediksi ekonomi bakal anjlok tahun depan.';
      const output = normalizeInformalMorphology(input);
      assert.ok(!output.includes('mrediksi'), 'Kata mrediksi dilarang');
      assert.ok(output.includes('memprediksi'), 'Harus dinormalisasi menjadi memprediksi');
    });

    it('memperbaiki "mperkirakan" dan "mperbaiki" ke bentuk formal yang sah', () => {
      const input = 'Pemerintah mperkirakan defisit anggaran membengkak dan harus mperbaiki sistem pajak.';
      const output = normalizeInformalMorphology(input);
      assert.ok(output.includes('memperkirakan'), 'mperkirakan -> memperkirakan');
      assert.ok(output.includes('memperbaiki'), 'mperbaiki -> memperbaiki');
    });

    it('mempertahankan kosakata informal alami yang sah (ngeliat, nyalahin, ngomong, mikir)', () => {
      const input = 'Gue ngeliat lo suka nyalahin keadaan tanpa mau ngomong jujur dan mikir logis.';
      const output = normalizeInformalMorphology(input);
      assert.ok(output.includes('ngeliat'), 'ngeliat tetap dipertahankan');
      assert.ok(output.includes('nyalahin'), 'nyalahin tetap dipertahankan');
      assert.ok(output.includes('ngomong'), 'ngomong tetap dipertahankan');
      assert.ok(output.includes('mikir'), 'mikir tetap dipertahankan');
    });
  });

  // =========================================================================
  // 4B. KONVERSI TANDA GARIS MIRING (/) MENJADI 'ATAU'
  // =========================================================================
  describe('4B. Konversi Tanda Garis Miring (/) Menjadi ATAU', () => {
    it('mengubah kata bersambung garis miring seperti "Doktrin/Pola Pikir" menjadi "Doktrin atau Pola Pikir"', () => {
      const input = 'Doktrin/Pola Pikir masyarakat harus dikritik secara tajam.';
      const output = applyLanguagePurityAndSanitization(input);
      assert.ok(output.includes('Doktrin atau Pola Pikir'), 'Doktrin/Pola Pikir harus menjadi Doktrin atau Pola Pikir');
    });

    it('mengubah "pria/wanita" dan "dan/atau" secara tepat', () => {
      const input = 'Hak berlaku bagi pria/wanita dan/atau wali hukum.';
      const output = applyLanguagePurityAndSanitization(input);
      assert.ok(output.includes('pria atau wanita'), 'pria/wanita -> pria atau wanita');
      assert.ok(output.includes('dan atau wali'), 'dan/atau -> dan atau');
    });

    it('tidak merusak angka, tanggal, dan pecahan (1/2, 12/05/2024)', () => {
      const input = 'Data per 12/05/2024 mencatat 1/2 populasi mengalami krisis.';
      const output = applyLanguagePurityAndSanitization(input);
      assert.ok(output.includes('12/05/2024'), 'Tanggal harus tetap utuh');
      assert.ok(output.includes('1/2'), 'Pecahan harus tetap utuh');
    });
  });

  // =========================================================================
  // 4C. DEDUPLIKASI KALIMAT REPETITIF VERBATIM
  // =========================================================================
  describe('4C. Deduplikasi Kalimat Repetitif Verbatim', () => {
    it('mengeliminasi kalimat yang diulang 3 kali secara berurutan', () => {
      const repeatedSentence =
        'Coba lo pikirin lagi gimana selama ini banyak orang cuma ngelihat permukaan dari Doktrin atau Pola Pikir banyak Anak Banyak Rezeki pada Kalangan Masyarakat, padahal begitu kita bedah datanya satu per satu, kelihatan banget ada ketimpangan yang sengaja ditutupi pakai narasi manis.';
      const input = `${repeatedSentence} ${repeatedSentence} ${repeatedSentence}`;
      const output = applyLanguagePurityAndSanitization(input);

      // Pastikan kalimat hanya muncul tepat 1 kali
      const occurrences = output.split(repeatedSentence).length - 1;
      assert.strictEqual(occurrences, 1, 'Kalimat diulang 3 kali harus dideduplikasi menjadi 1 kali');
    });
  });

  // =========================================================================
  // 5. INTEGRASI AUDIT DAN PIPELINE VALIDASI
  // =========================================================================
  describe('5. Audit Kemurnian Bahasa dan Validasi Output', () => {
    it('auditLanguageIntegrity mendeteksi seluruh pelanggaran dan lolos ketika sudah bersih', () => {
      const dirty = 'Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa [GENFLOW_DOCUMENT_START] mastery warga atas data WHO masih mrediksi hal yang keliru.';
      const auditDirty = auditLanguageIntegrity(dirty);
      assert.strictEqual(auditDirty.passed, false, 'Teks kotor harus gagal audit');
      assert.ok(auditDirty.leakedMarkersDetected.length > 0, 'Marker terdeteksi');
      assert.ok(auditDirty.foreignWordsDetected.includes('mastery'), 'mastery terdeteksi');
      assert.ok(auditDirty.oralAcronymsDetected.includes('WHO'), 'WHO terdeteksi');
      assert.ok(auditDirty.researcherAttributionsDetected.length > 0, 'Atribusi peneliti terdeteksi');
      assert.ok(auditDirty.invalidMorphologyDetected.includes('mrediksi'), 'mrediksi terdeteksi');

      const cleaned = applyLanguagePurityAndSanitization(dirty);
      const auditClean = auditLanguageIntegrity(cleaned);
      assert.strictEqual(auditClean.passed, true, 'Teks yang telah disanitasi harus lulus audit');
      assert.ok(!cleaned.includes('[GENFLOW_DOCUMENT_START]'));
      assert.ok(!cleaned.includes('mastery'));
      assert.ok(!cleaned.includes('Greig Inglis'));
      assert.ok(!cleaned.includes('mrediksi'));
    });

    it('applyAutoEnforce otomatis membersihkan pelanggaran bahasa dan marker', () => {
      const rawBlock =
        'Goblok banget kalau lo ngeliat [GENFLOW_DOCUMENT_START] mastery dari WHO ini tanpa mikir. ' +
        'Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa defisit 3,14% bikin tolol kebijakan ini. ' +
        'Mereka mrediksi hal bego yang bikin dungu berkepanjangan bagi warga miskin.';

      const enforced = applyAutoEnforce(rawBlock, { durasiMenit: 1, wpm: 135 });
      assert.ok(!enforced.includes('[GENFLOW_DOCUMENT_START]'), 'Marker harus hilang dari applyAutoEnforce');
      assert.ok(!enforced.includes('mastery'), 'mastery harus hilang dari applyAutoEnforce');
      assert.ok(!enforced.includes('Greig Inglis'), 'Nama peneliti harus hilang dari applyAutoEnforce');
      assert.ok(!enforced.includes('mrediksi'), 'mrediksi harus hilang dari applyAutoEnforce');
      assert.ok(enforced.includes('Organisasi Kesehatan Dunia'), 'WHO harus dialihkan ke nama Indonesia');
      assert.ok(enforced.includes('memprediksi'), 'memprediksi harus dipakai');
    });

    it('compileVoiceScript menghasilkan audio text yang bersih dari istilah asing dan marker', () => {
      const script = 'WHO mengumumkan bahwa [GENFLOW_DOCUMENT_START] mastery masyarakat Rp1.500.000.';
      const voice = compileVoiceScript(script);
      assert.ok(!voice.includes('WHO'), 'Voice script harus bebas WHO');
      assert.ok(!voice.includes('mastery'), 'Voice script harus bebas mastery');
      assert.ok(!voice.includes('[GENFLOW_DOCUMENT_START]'), 'Voice script harus bebas marker');
      assert.ok(voice.includes('Organisasi Kesehatan Dunia'), 'Nama Indonesia dipakai di voice script');
      assert.ok(voice.includes('penguasaan'), 'penguasaan dipakai di voice script');
    });

    it('checkFinalExportEligibility menolak jika terdapat pelanggaran kemurnian bahasa', () => {
      const mockAuditWithLanguageFailure: any = {
        passed: true,
        nonSaraPassed: true,
        quoteFree: { passed: true },
        sourceFidelity: { passed: true },
        languageIntegrity: {
          passed: false,
          findings: ['Kosakata asing mastery terdeteksi'],
        },
      };

      const result = checkFinalExportEligibility('naskah tes', {
        isFinalApproved: true,
        stage3Status: 'PASSED',
        audit: mockAuditWithLanguageFailure,
      });

      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason?.includes('kemurnian bahasa'));
    });
  });
});
