import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGenflowMasterFramework,
  createEmptyMasterFramework,
  buildStage2MasterFrameworkPromptDirectives,
  verifyDraftV0Traceability,
  CANONICAL_COMPONENTS_SPEC,
} from './genflowMasterFramework';
import { enforceLockedConfig } from './validatorAndPipeline';

test('CANONICAL_COMPONENTS_SPEC memuat tepat 23 komponen wajib dalam kelompok A-F', () => {
  assert.equal(CANONICAL_COMPONENTS_SPEC.length, 23);
  const ids = CANONICAL_COMPONENTS_SPEC.map((c) => c.id);
  for (let i = 1; i <= 23; i++) {
    assert.ok(ids.includes(i), `Komponen #${i} wajib ada dalam spesifikasi kanonis`);
  }

  // Verifikasi pembagian kelompok
  const groupA = CANONICAL_COMPONENTS_SPEC.filter((c) => c.groupCode === 'A');
  const groupB = CANONICAL_COMPONENTS_SPEC.filter((c) => c.groupCode === 'B');
  const groupC = CANONICAL_COMPONENTS_SPEC.filter((c) => c.groupCode === 'C');
  const groupD = CANONICAL_COMPONENTS_SPEC.filter((c) => c.groupCode === 'D');
  const groupE = CANONICAL_COMPONENTS_SPEC.filter((c) => c.groupCode === 'E');
  const groupF = CANONICAL_COMPONENTS_SPEC.filter((c) => c.groupCode === 'F');

  assert.equal(groupA.length, 2, 'Kelompok A harus berisi 2 komponen (#1-#2)');
  assert.equal(groupB.length, 7, 'Kelompok B harus berisi 7 komponen (#3-#9)');
  assert.equal(groupC.length, 4, 'Kelompok C harus berisi 4 komponen (#10-#13)');
  assert.equal(groupD.length, 2, 'Kelompok D harus berisi 2 komponen (#14-#15)');
  assert.equal(groupE.length, 3, 'Kelompok E harus berisi 3 komponen (#16-#18)');
  assert.equal(groupF.length, 5, 'Kelompok F harus berisi 5 komponen audit (#19-#23)');
});

test('extractGenflowMasterFramework memetakan template terstruktur A-G secara presisi', () => {
  const structuredDoc = `
A. INPUT UTAMA
1. Topik utama yang harus dibahas:
Jebakan Gaya Hidup Konsumtif Generasi Muda Urban

2. Bahan atau sumber rujukan:
Laporan OJK 2024 dan Survei Katadata Insight Center

B. PENGUNCI SUBSTANSI
3. Kunci Fokus Besar (Central Focus):
Membongkar ilusi status sosial yang mendorong utang konsumtif di kalangan kelas pekerja muda.

4. Kunci Batas Pembahasan (Scope Boundary):
Wajib dibahas:
- Data rasio utang terhadap pendapatan bulanan
- Mekanisme fear of missing out (FOMO)
- Dampak gagal bayar jangka panjang
Boleh disinggung:
- Pengaruh media sosial secara ringkas
Tidak boleh dimasukkan:
- Serangan SARA
- Label instruksi internal MASTER FRAMEWORK

5. Kunci Pertanyaan Inti (Core Question):
Mengapa generasi muda rela berutang demi validasi semu di media sosial?

6. Kunci Kerangka Masalah (Problem Framework):
Masalah utama: Normalisasi utang konsumtif demi gengsi.

7. Kunci Tesis Utama (Central Thesis):
Konsumsi berlebihan bukan tanda kemakmuran melainkan tanda kegagalan menavigasi prioritas finansial.

8. Kunci Logic Punch:
Gengsi tidak bisa dicairkan saat rekening tabungan kamu nol.

9. Kunci Tujuan Perubahan Perspektif:
Sadar bahwa gaya hidup mewah dengan utang adalah pembodohan diri sendiri.

C. PENGUNCI FAKTA DAN ARGUMENTASI
10. Pemetaan Landasan Fakta (Evidence Mapping):
Sebanyak 43% pendapatan bulanan habis untuk mencicil barang non-produktif pada tahun 2023.

11. Pemetaan Rantai Logika (Argument Chain):
Gaji masuk → Belanja impulsif demi validasi → Limit habis → Pinjaman baru → Terjebak bunga.

12. Pemetaan Kontraargumen dan Alternatif Penjelasan:
Banyak yang berdalih "self-reward", namun diuji fakta bahwa reward tanpa saldo adalah hukuman masa depan.

13. Penentuan Plot Twist (Perspective Shift):
Ternyata mereka yang memamerkan gaya hidup mewah di media sosial justru memiliki skor kredit paling rentan.

D. PERANCANGAN STRUKTUR NASKAH
14. Penentuan Fungsi Setiap Bagian:
Blok 1 melempar hook, Blok 2 mengurai akar masalah, Blok 3 membedah data, Blok 4 solusi, Blok 5 logic punch.

15. Penyusunan Alur Pembahasan (Narrative Blueprint):
Blok 1 (Hook 8%) → Blok 2 (Akar 17%) → Blok 3 (Inti 45%) → Blok 4 (Solusi 20%) → Blok 5 (Punch 10%).

E. PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP
16. Perumusan Judul:
Terjebak Gengsi: Fakta Pahit di Balik Tren Flexing

17. Perancangan Hook:
Membenturkan saldo rekening dengan ilusi kemewahan di feed media sosial.

18. Perancangan Klimaks dan Penutup:
Menegaskan bahwa kebebasan finansial sejati adalah tidak perlu membuktikan apa pun kepada orang lain.
`;

  const framework = extractGenflowMasterFramework(structuredDoc, 'kerangka-konsumtif.txt');

  assert.equal(framework.componentsById[1].content, 'Jebakan Gaya Hidup Konsumtif Generasi Muda Urban');
  assert.equal(framework.executiveSummary.topikUtama, 'Jebakan Gaya Hidup Konsumtif Generasi Muda Urban');
  assert.equal(framework.executiveSummary.fokusBesar, 'Membongkar ilusi status sosial yang mendorong utang konsumtif di kalangan kelas pekerja muda.');
  assert.ok(framework.executiveSummary.batasPembahasan.wajibDibahas.length >= 3);
  assert.ok(framework.executiveSummary.batasPembahasan.tidakBolehDimasukkan.length >= 2);
  assert.equal(framework.executiveSummary.logicPunch, 'Gengsi tidak bisa dicairkan saat rekening tabungan kamu nol.');

  // Status kesiapan harus SIAP DIKEMBANGKAN
  assert.equal(framework.executiveSummary.statusKesiapan, 'SIAP DIKEMBANGKAN');
});

test('extractGenflowMasterFramework memetakan teks bebas tanpa halusinasi fakta', () => {
  const freeformText = `
Biaya Sewa Rumah Melonjak 45% di Kota-kota Besar

Berdasarkan laporan BPS tahun 2023, pengeluaran untuk tempat tinggal naik Rp1.200.000 per bulan.
Banyak keluarga muda kesulitan menabung untuk masa depan.
Mengapa kenaikan harga properti tidak diimbangi dengan perbaikan tata ruang kota?
Fokus analisis adalah mengkaji ketimpangan upah dan kebijakan kepemilikan tanah.
`;

  const framework = extractGenflowMasterFramework(freeformText, 'dokumen-sewa.txt');

  assert.ok(framework.componentsById[1].content.includes('Biaya Sewa Rumah Melonjak'));
  assert.ok(framework.componentsById[2].content.includes('BPS'));
  assert.ok(framework.componentsById[5].content.includes('Mengapa kenaikan harga properti'));
  assert.ok(framework.componentsById[10].content.includes('45%') || framework.componentsById[10].content.includes('Rp1.200.000'));
});

test('buildStage2MasterFrameworkPromptDirectives menyuntikkan fokus, batas pembahasan, tesis, dan logic punch', () => {
  const mockFramework = extractGenflowMasterFramework(`
1. Topik utama yang harus dibahas:
Bahaya Misinformasi Kesehatan di Grup Chat Keluarga

3. Kunci Fokus Besar (Central Focus):
Edukasi literasi kritis untuk memverifikasi klaim obat herbal tanpa uji klinis.

4. Kunci Batas Pembahasan (Scope Boundary):
Wajib dibahas:
- Bahaya toksisitas zat aktif tanpa dosis terukur
Tidak boleh dimasukkan:
- Menyerang keyakinan agama

7. Kunci Tesis Utama (Central Thesis):
Niat baik meneruskan info tidak mengurangi bahaya medis racun herbal.

8. Kunci Logic Punch:
Sayang keluarga bukan dengan menyebarkan racun berkedok pesan forwarded.
  `);

  const directives = buildStage2MasterFrameworkPromptDirectives(mockFramework);

  assert.ok(directives.includes('GENFLOW MASTER FRAMEWORK FINAL'));
  assert.ok(directives.includes('Bahaya Misinformasi Kesehatan'));
  assert.ok(directives.includes('Edukasi literasi kritis'));
  assert.ok(directives.includes('Bahaya toksisitas zat aktif'));
  assert.ok(directives.includes('Menyerang keyakinan agama'));
  assert.ok(directives.includes('Sayang keluarga bukan dengan menyebarkan racun'));
});

test('verifyDraftV0Traceability mendeteksi keterlacakan 5 blok dan memeriksa batas pembahasan', () => {
  const mockFramework = extractGenflowMasterFramework(`
1. Topik utama yang harus dibahas:
Gaya Hidup Flexing

4. Kunci Batas Pembahasan (Scope Boundary):
Wajib dibahas:
- Data rasio utang dan fakta finansial
Tidak boleh dimasukkan:
- Dilarang membocorkan label MASTER FRAMEWORK
- Dilarang materi SARA
  `);

  const config = enforceLockedConfig({
    topik: 'Gaya Hidup Flexing',
    faktaTerverifikasi: 'Data rasio utang 2023',
    durasiMenit: 12,
    wpm: 135,
    modeDurasi: 'FLEKSIBEL',
    jumlahBlok: 5,
    struktur: [8, 17, 45, 20, 10],
    operasi: 'NASKAH_FINAL',
    primaryModel: 'gemini-3-flash-preview',
    fallbackModel: 'gemini-3.8-flash',
  });

  const valid5BlocksScript = `Lo pernah mikir nggak kenapa orang rela makan mie instan sebulan demi pamer ponsel keluaran terbaru di tongkrongan yang sebenarnya nggak peduli sama sekali?
Akar masalahnya sederhana banget yaitu kita hidup di era di mana persepsi sosial lebih dihargai daripada kestabilan dompet sendiri dan gengsi dijadikan standar harga diri.
Berdasarkan data riil tahun 2023 tercatat pengeluaran konsumtif mencapai 45% dan utang kartu kredit melonjak drastis membuktikan bahwa ilusi kemewahan ini menelan korban nyata.
Solusinya bukan berhenti menikmati hidup tapi mulai belajar membedakan antara kebutuhan hakiki dengan nafsu pamer yang cuma bikin kantong lo bolong sia-sia.
Kesimpulannya jangan pernah mengorbankan masa depan finansial lo cuma buat tepuk tangan orang lain yang bahkan nggak bakal nolongin lo pas lo bangkrut.`;

  const report = verifyDraftV0Traceability(valid5BlocksScript, mockFramework, config);

  assert.equal(report.totalBlocks, 5);
  assert.equal(report.passed, true);
  assert.equal(report.forbiddenBoundaryViolations.length, 0);

  // Cek jika ada pelanggaran batas materi terlarang
  const violatingScript = `Lo mikir nggak ponsel ini keren banget padahal ini melanggar aturan MASTER FRAMEWORK internal.
Akar masalahnya ada di kebiasaan.
Data menunjukkan 45% pengeluaran bocor.
Solusinya berhemat.
Kesimpulannya jangan boros.`;

  const violatingReport = verifyDraftV0Traceability(violatingScript, mockFramework, config);
  assert.ok(violatingReport.forbiddenBoundaryViolations.length > 0);
  assert.equal(violatingReport.passed, false);
});

test('A. Kondisi Awal (Aplikasi dibuka tanpa upload): 0/23 komponen terisi, tanpa konten contoh, status MENUNGGU_DOKUMEN', () => {
  const emptyFw = createEmptyMasterFramework();

  assert.equal(emptyFw.documentIdentity.fileName, 'BELUM ADA DOKUMEN');
  assert.equal(emptyFw.documentIdentity.wordCount, 0);
  assert.equal(emptyFw.executiveSummary.topikUtama, '');
  assert.equal(emptyFw.executiveSummary.fokusBesar, '');
  assert.equal(emptyFw.executiveSummary.pertanyaanInti, '');
  assert.equal(emptyFw.executiveSummary.tesisUtama, '');
  assert.equal(emptyFw.executiveSummary.logicPunch, '');
  assert.equal(emptyFw.executiveSummary.batasPembahasan.wajibDibahas.length, 0);
  assert.equal(emptyFw.executiveSummary.batasPembahasan.bolehDisinggung.length, 0);
  assert.equal(emptyFw.executiveSummary.batasPembahasan.tidakBolehDimasukkan.length, 0);
  assert.equal(emptyFw.executiveSummary.statusKesiapan, 'BELUM ADA DOKUMEN');

  const comps1to23 = Object.values(emptyFw.componentsById).filter((c) => c.id <= 23);
  assert.equal(comps1to23.length, 23);

  const filledCount = comps1to23.filter(
    (c) => c.status === 'DITEMUKAN' && (c.content || '').trim().length > 0
  ).length;
  assert.equal(filledCount, 0, 'Jumlah komponen terisi wajib 0/23 sebelum upload');

  for (const comp of comps1to23) {
    assert.equal(comp.status, 'MENUNGGU_DOKUMEN', `Komponen #${comp.id} wajib berstatus MENUNGGU_DOKUMEN`);
    assert.equal(comp.content, '', `Komponen #${comp.id} wajib kosong`);
  }

  // Juga pastikan extractGenflowMasterFramework('') mengembalikan state kosong murni
  const fromEmptyText = extractGenflowMasterFramework('', 'kerangka.txt');
  assert.equal(fromEmptyText.documentIdentity.fileName, 'BELUM ADA DOKUMEN');
  assert.equal(fromEmptyText.documentIdentity.wordCount, 0);
  const filledFromEmpty = Object.values(fromEmptyText.componentsById).filter(
    (c) => c.id <= 23 && c.status === 'DITEMUKAN'
  ).length;
  assert.equal(filledFromEmpty, 0);
});

test('B & C. Sinkronisasi Ketat Antardokumen: Dokumen 1 dan Dokumen 2 tidak tercampur', () => {
  const doc1 = `
A. INPUT UTAMA
1. Topik utama yang harus dibahas:
Krisis Air Bersih di Pesisir Utara

3. Kunci Fokus Besar (Central Focus):
Penurunan muka tanah akibat eksploitasi air tanah industri.

7. Kunci Tesis Utama (Central Thesis):
Banjir rob bukan bencana alam murni melainkan akibat kelalaian tata kelola air.
`;

  const doc2 = `
A. INPUT UTAMA
1. Topik utama yang harus dibahas:
Fenomena Judi Online pada Pekerja Harian

3. Kunci Fokus Besar (Central Focus):
Algoritma kemenangan semu yang menjebak psikologi masyarakat berpenghasilan rendah.

8. Kunci Logic Punch:
Bandar tidak pernah kalah karena sistemnya memang dirancang menguras dompetmu.
`;

  const fw1 = extractGenflowMasterFramework(doc1, 'dokumen-air.txt');
  assert.equal(fw1.documentIdentity.fileName, 'dokumen-air.txt');
  assert.equal(fw1.componentsById[1].content, 'Krisis Air Bersih di Pesisir Utara');
  assert.equal(fw1.componentsById[7].content, 'Banjir rob bukan bencana alam murni melainkan akibat kelalaian tata kelola air.');
  assert.equal(fw1.componentsById[8].status, 'TIDAK_DITEMUKAN');
  assert.equal(fw1.componentsById[8].content, '');

  // Unggah dokumen kedua: hasil dokumen pertama TIDAK BOLEH terbawa
  const fw2 = extractGenflowMasterFramework(doc2, 'dokumen-judol.txt');
  assert.equal(fw2.documentIdentity.fileName, 'dokumen-judol.txt');
  assert.equal(fw2.componentsById[1].content, 'Fenomena Judi Online pada Pekerja Harian');
  assert.equal(fw2.componentsById[3].content, 'Algoritma kemenangan semu yang menjebak psikologi masyarakat berpenghasilan rendah.');
  assert.equal(fw2.componentsById[7].status, 'TIDAK_DITEMUKAN', 'Tesis dari dokumen 1 tidak boleh bocor ke dokumen 2');
  assert.equal(fw2.componentsById[7].content, '');
  assert.equal(fw2.componentsById[8].status, 'DITEMUKAN');
  assert.equal(fw2.componentsById[8].content, 'Bandar tidak pernah kalah karena sistemnya memang dirancang menguras dompetmu.');
});

test('D & E. Dokumen tidak lengkap & Reset: Komponen absen berstatus TIDAK_DITEMUKAN tanpa teks rekaan, Reset kembali ke 0/23', () => {
  const partialDoc = `
A. INPUT UTAMA
1. Topik utama yang harus dibahas:
Dampak Polusi Udara Terhadap Kesehatan Paru-Paru Anak
`;

  const partialFw = extractGenflowMasterFramework(partialDoc, 'kerangka-parsial.txt');
  assert.equal(partialFw.componentsById[1].status, 'DITEMUKAN');
  assert.equal(partialFw.componentsById[1].content, 'Dampak Polusi Udara Terhadap Kesehatan Paru-Paru Anak');

  // Komponen 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18 tidak ada di dokumen -> wajib TIDAK_DITEMUKAN & kosong
  for (const id of [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18]) {
    assert.equal(
      partialFw.componentsById[id].status,
      'TIDAK_DITEMUKAN',
      `Komponen #${id} yang tidak ada di dokumen harus berstatus TIDAK_DITEMUKAN`
    );
    assert.equal(
      partialFw.componentsById[id].content,
      '',
      `Komponen #${id} yang tidak ada di dokumen tidak boleh diisi teks karangan/dummy`
    );
  }

  // Simulasi Reset kembali ke kondisi awal 0/23
  const resetFw = createEmptyMasterFramework();
  const filledAfterReset = Object.values(resetFw.componentsById).filter(
    (c) => c.id <= 23 && c.status === 'DITEMUKAN'
  ).length;
  assert.equal(filledAfterReset, 0);
  assert.equal(resetFw.documentIdentity.fileName, 'BELUM ADA DOKUMEN');
  assert.equal(resetFw.documentIdentity.wordCount, 0);
});

