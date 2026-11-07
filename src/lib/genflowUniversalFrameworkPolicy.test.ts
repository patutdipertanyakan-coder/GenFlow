import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveUniversalFrameworkPolicy,
  classifyDocumentType,
  processUniversalFrameworkDocument,
  exportCanonicalFrameworkText,
  calculatePolicyHash,
} from './genflowUniversalFrameworkPolicy';

test('1. Policy aktif persisten tersimpan di backend dengan Schema ID dan metadata lengkap', () => {
  const policy = getActiveUniversalFrameworkPolicy();
  assert.equal(policy.policy_id, 'GENFLOW_UNIVERSAL_FRAMEWORK_POLICY');
  assert.equal(policy.schema_id, 'GF-NARRATIVE-FRAMEWORK-1.0');
  assert.equal(policy.version, '1.0.0');
  assert.equal(policy.active_status, true);
  assert.ok(policy.rules.length >= 15, 'Minimal 15 aturan wajib pemrosesan kerangka');
  assert.ok(policy.content_hash.length > 0, 'Hash policy harus terhitung');
});

test('2. Klasifikasi dokumen mendeteksi format baku (NARRATIVE_FRAMEWORK_STANDARD) via Schema ID dan marker GF', () => {
  const standardDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
DOCUMENT_TYPE: NARRATIVE_FRAMEWORK
TOPIC_TITLE: Kebiasaan Konsumtif Paylater Generasi Z
[GENFLOW_METADATA_END]

A. INPUT UTAMA
[GF-01]
TOPIC_STATEMENT: Mengapa paylater menjebak gaya hidup impulsif anak muda.
TOPIC_OBJECT: Perilaku finansial dan paylater

[GF-02]
[GF-02-SOURCE-01]
SOURCE_TITLE: OJK Report 2024
SOURCE_URL_OR_IDENTIFIER: https://ojk.go.id/report-2024
[END_GF-02-SOURCE-01]

B. PENGUNCI SUBSTANSI
[GF-03]
CENTRAL_FOCUS: Ilusi daya beli semu pada fitur belanja instan.

[GF-04]
MUST_COVER_01: Bunga terselubung dan denda keterlambatan
OUT_OF_SCOPE_01: Sejarah industri kartu kredit era 1970

[GF-05]
CORE_QUESTION: Kenapa kemudahan cicilan kecil justru melumpuhkan cashflow?

[GF-07]
CENTRAL_THESIS: Paylater mengeksploitasi bias present hedonism di mana kesenangan instan mengaburkan biaya jangka panjang.

[GF-08]
LOGIC_PUNCH: Yang murah bukan bunganya, tapi hambatan psikologis untuk ngutang yang sengaja dihilangkan.

[GENFLOW_DOCUMENT_END]`;

  const classification = classifyDocumentType(standardDoc, 'KERANGKA_PAYLATER.txt');
  assert.equal(classification.documentType, 'NARRATIVE_FRAMEWORK_STANDARD');
  assert.equal(classification.isFramework, true);
  assert.ok(classification.confidence >= 0.9);
});

test('3. Klasifikasi dokumen mendeteksi dokumen sumber biasa dan TIDAK memaksakan 23 komponen', () => {
  const plainArticle = `Laporan Khusus: Tren Ekspor Komoditas Karet Indonesia 2025.
Volume ekspor karet alam tercatat mencapai 1,2 juta ton pada kuartal ketiga.
Menteri Perdagangan menyatakan bahwa stabilitas harga dipengaruhi oleh permintaan global dari Tiongkok dan Amerika Serikat.
Menurut data BPS, sentimen pasar tetap optimis di tengah fluktuasi nilai tukar rupiah.`;

  const classification = classifyDocumentType(plainArticle, 'laporan-karet-bps.txt');
  assert.equal(classification.documentType, 'SOURCE_DOCUMENT_ONLY');
  assert.equal(classification.isFramework, false);

  const result = processUniversalFrameworkDocument(plainArticle, 'laporan-karet-bps.txt');
  assert.equal(result.classification.isFramework, false);
  assert.equal(result.validationReport.totalDetectedComponents, 0, 'Dokumen sumber biasa tidak dipaksa jadi kerangka 23 komponen');
});

test('4. Pemetaan dokumen lama (LEGACY) ke 23 komponen kanonis tanpa kehilangan substansi', () => {
  const legacyOutline = `KELOMPOK A: INPUT UTAMA
1. TOPIK UTAMA: Bahaya Normalisasi Lembur Tanpa Kompensasi
2. BAHAN SUMBER: Riset ILO 2023 & UU Ketenagakerjaan

KELOMPOK B: PENGUNCI SUBSTANSI
3. KUNCI FOKUS BESAR: Eksploitasi waktu kerja yang dibungkus loyalitas
4. BATAS PEMBAHASAN:
Wajib Dibahas: Beban ganda pekerja lepas, dampak burn-out
Tidak Boleh Dimasukkan: Teori manajemen era industri 1.0
5. KUNCI PERTANYAAN INTI: Siapa yang diuntungkan dari budaya hustle culture palsu?
7. KUNCI TESIS UTAMA: Lembur gratisan bukan tanda loyalitas melainkan kegagalan alokasi sumber daya.
8. KUNCI LOGIC PUNCH: Pekerja mengorbankan kesehatan demi apresiasi semu yang tak sebanding.`;

  const result = processUniversalFrameworkDocument(legacyOutline, 'kerangka-lama-lembur.docx');
  assert.equal(result.classification.documentType, 'NARRATIVE_FRAMEWORK_LEGACY');
  assert.equal(result.classification.isFramework, true);
  assert.ok(result.framework, 'Framework data berhasil diekstrak');
  assert.equal(result.framework?.executiveSummary.topikUtama.includes('Lembur'), true);
});

test('5. Validasi silang mendeteksi referensi bukti yang rusak (broken reference) ke sumber', () => {
  const brokenDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
DOCUMENT_TYPE: NARRATIVE_FRAMEWORK
TOPIC_TITLE: Mitos Superfood

[GF-02]
[GF-02-SOURCE-01]
SOURCE_TITLE: Journal of Nutrition 2022
[END_GF-02-SOURCE-01]

[GF-10]
[GF-10-EVIDENCE-01]
CLAIM_ID: C-01
CLAIM_TO_CHECK: Kale mengandung vitamin C tertinggi dibanding semua sayur
SOURCE_ID: S99
EVIDENCE_OR_DATA: Studi menemukan brokoli memiliki kandungan setara
[END_GF-10-EVIDENCE-01]
[GENFLOW_DOCUMENT_END]`;

  const result = processUniversalFrameworkDocument(brokenDoc, 'superfood.txt');
  assert.ok(result.validationReport.crossReferenceCheck.brokenReferences.length > 0, 'Harus mendeteksi S99 tidak terdaftar pada GF-02');
  assert.equal(result.validationReport.readinessStatus, 'PERLU SUMBER/DATA');
});

test('6. Deteksi pertentangan Batas Pembahasan (Scope Boundary Conflict)', () => {
  const conflictDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
TOPIC_TITLE: Uji Batas

[GF-04]
MUST_COVER_01: Dampak kecanduan judi online
OUT_OF_SCOPE_01: Dampak kecanduan judi online
[GENFLOW_DOCUMENT_END]`;

  const result = processUniversalFrameworkDocument(conflictDoc, 'uji-konflik.txt');
  assert.equal(result.validationReport.scopeBoundaryCheck.hasConflict, true);
  assert.equal(result.validationReport.readinessStatus, 'PERLU MENYELESAIKAN KONTRADIKSI');
});

test('7. Ekspor format baku menghasilkan dokumen kanonis GF-NARRATIVE-FRAMEWORK-1.0 lengkap', () => {
  const sampleDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
TOPIC_TITLE: Krisis Air Bersih Perkotaan
[GF-01]
TOPIC_STATEMENT: Krisis air tanah di Jakarta
[GF-03]
CENTRAL_FOCUS: Penurunan muka tanah akibat penyedotan air ilegal
[GF-04]
MUST_COVER_01: Pipa PAM belum mencakup seluruh kawasan
OUT_OF_SCOPE_01: Pengeboran minyak lepas pantai
[GF-07]
CENTRAL_THESIS: Penyedotan air tanah ilegal adalah dampak dari kegagalan infrastruktur publik.
[GF-08]
LOGIC_PUNCH: Kota tenggelam bukan kutukan alam tapi akibat tata kelola air yang abai.
[GENFLOW_DOCUMENT_END]`;

  const processed = processUniversalFrameworkDocument(sampleDoc, 'krisis-air.txt');
  assert.ok(processed.framework);
  const exported = exportCanonicalFrameworkText(processed.framework!);

  assert.ok(exported.includes('[GENFLOW_DOCUMENT_START]'));
  assert.ok(exported.includes('SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0'));
  assert.ok(exported.includes('Krisis Air Bersih Perkotaan'));
  assert.ok(exported.includes('[GF-01]'));
  assert.ok(exported.includes('[GF-23]'));
  assert.ok(exported.includes('[GENFLOW_PROCESSING_RULES_START]'));
  assert.ok(exported.includes('[GENFLOW_DOCUMENT_END]'));
  assert.equal(exported.includes('PREPARED_DATE'), false, 'Tidak boleh ada PREPARED_DATE otomatis sesuai Aturan B7');
});

test('8. Pengujian satu sumber dengan satu bukti valid (0 referensi rusak)', () => {
  const singlePairDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
TOPIC_TITLE: Dampak Kebijakan Moneter
[GF-01]
1. TOPIK UTAMA
TOPIC_STATEMENT: Pengaruh suku bunga suku BI terhadap kredit UMKM.
[GF-02]
2. BAHAN DAN SUMBER RUJUKAN
FORMAT_NOTE: Ulangi blok SOURCE untuk setiap sumber.
[GF-02-SOURCE-01]
SOURCE_ID: S01
SOURCE_TITLE: Laporan Tahunan Bank Indonesia 2024
SOURCE_AUTHOR_OR_ORGANIZATION: Bank Indonesia
SOURCE_STATUS: VERIFIED
[END_GF-02-SOURCE-01]
[GF-10]
10. PEMETAAN LANDASAN FAKTA
[GF-10-EVIDENCE-01]
EVIDENCE_ID: EVIDENCE-01
CLAIM_ID: C-01
CLAIM_TO_CHECK: Penyaluran kredit UMKM turun 3,2% setelah kenaikan BI Rate
EVIDENCE_OR_DATA: Data Statistik Perbankan BI Menunjukkan penurunan penyaluran kredit dari Rp1.200 T menjadi Rp1.161 T
SOURCE_ID: S01
EVIDENCE_STATUS: VERIFIED
[END_GF-10-EVIDENCE-01]
[GENFLOW_DOCUMENT_END]`;

  const res = processUniversalFrameworkDocument(singlePairDoc, 'moneter.txt');
  assert.equal(res.validationReport.crossReferenceCheck.totalSources, 1);
  assert.equal(res.validationReport.crossReferenceCheck.totalEvidences, 1);
  assert.equal(res.validationReport.crossReferenceCheck.validReferences, 1);
  assert.equal(res.validationReport.crossReferenceCheck.brokenReferences.length, 0);
  assert.equal(res.framework?.componentsById[1].content.includes('FORMAT_NOTE'), false, 'Teks instruksi FORMAT_NOTE tidak boleh tercampur di GF-01');
});

test('9. Pengujian beberapa sumber dengan beberapa bukti valid (0 referensi rusak)', () => {
  const multiPairDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
TOPIC_TITLE: Krisis Sampah Plastik Lautan
[GF-01]
1. TOPIK UTAMA
TOPIC_STATEMENT: Penanganan sampah plastik di pesisir Indonesia.
[GF-02]
[GF-02-SOURCE-01]
SOURCE_ID: S01
SOURCE_TITLE: Laporan KLHK 2023
SOURCE_STATUS: VERIFIED
[END_GF-02-SOURCE-01]
[GF-02-SOURCE-02]
SOURCE_ID: S02
SOURCE_TITLE: Studi Nature Communications 2022
SOURCE_STATUS: VERIFIED
[END_GF-02-SOURCE-02]
[GF-10]
[GF-10-EVIDENCE-01]
EVIDENCE_ID: EVIDENCE-01
CLAIM_ID: C-01
CLAIM_TO_CHECK: Indonesia menyumbang 0,5 juta ton sampah plastik ke laut per tahun
SOURCE_ID: S01
EVIDENCE_STATUS: VERIFIED
[END_GF-10-EVIDENCE-01]
[GF-10-EVIDENCE-02]
EVIDENCE_ID: EVIDENCE-02
CLAIM_ID: C-02
CLAIM_TO_CHECK: Mikroplastik terdeteksi di 80% sampel ikan komersial
SOURCE_ID: S02
EVIDENCE_STATUS: VERIFIED
[END_GF-10-EVIDENCE-02]
[GENFLOW_DOCUMENT_END]`;

  const res = processUniversalFrameworkDocument(multiPairDoc, 'krisis-sampah.txt');
  assert.equal(res.validationReport.crossReferenceCheck.totalSources, 2);
  assert.equal(res.validationReport.crossReferenceCheck.totalEvidences, 2);
  assert.equal(res.validationReport.crossReferenceCheck.validReferences, 2);
  assert.equal(res.validationReport.crossReferenceCheck.brokenReferences.length, 0);
});

test('10. Deteksi ID duplikat pada GF-02 dan GF-10', () => {
  const duplicateIdDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
TOPIC_TITLE: Uji Duplikat ID
[GF-02]
[GF-02-SOURCE-01]
SOURCE_ID: S01
SOURCE_TITLE: Sumber A
[END_GF-02-SOURCE-01]
[GF-02-SOURCE-02]
SOURCE_ID: S01
SOURCE_TITLE: Sumber B
[END_GF-02-SOURCE-02]
[GF-10]
[GF-10-EVIDENCE-01]
EVIDENCE_ID: EVIDENCE-01
SOURCE_ID: S01
[END_GF-10-EVIDENCE-01]
[GF-10-EVIDENCE-02]
EVIDENCE_ID: EVIDENCE-01
SOURCE_ID: S01
[END_GF-10-EVIDENCE-02]
[GENFLOW_DOCUMENT_END]`;

  const res = processUniversalFrameworkDocument(duplicateIdDoc, 'duplikat.txt');
  const conflictIssues = res.validationReport.issues.filter((i) => i.type === 'CONFLICT');
  assert.ok(conflictIssues.length >= 2, 'Harus mendeteksi duplikat SOURCE_ID dan EVIDENCE_ID');
});

test('11. Pemisahan steril instruksi format template dari data aktual', () => {
  const templateDoc = `[GENFLOW_DOCUMENT_START]
SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
TOPIC_TITLE: Analisis Efisiensi Energi
[GF-01]
1. TOPIK UTAMA
TOPIC_STATEMENT: Efisiensi energi sektor manufaktur otomotif.
TOPIC_OBJECT: Konsumsi listrik pabrik perakitan
[GF-02]
2. BAHAN DAN SUMBER RUJUKAN
CATATAN FORMAT: Ulangi blok SOURCE untuk setiap sumber.
[GF-02-SOURCE-01]
SOURCE_ID: S01
SOURCE_TITLE: Laporan Kementerian ESDM 2024
[END_GF-02-SOURCE-01]
[GENFLOW_DOCUMENT_END]`;

  const res = processUniversalFrameworkDocument(templateDoc, 'energi.txt');
  assert.equal(res.framework?.componentsById[1].content.includes('CATATAN FORMAT'), false);
  assert.equal(res.framework?.componentsById[2].content.includes('CATATAN FORMAT'), false);
});

