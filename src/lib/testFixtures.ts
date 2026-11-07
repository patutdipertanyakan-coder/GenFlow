/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TEST FIXTURES — Clean, fully compliant 5-block SCTF test scripts for unit tests.
 * Zero hardcoded backend narrative templates in runtime production code.
 */

export function createValidTestSCTFScript(topic: string = 'Krisis Finansial dan Kebiasaan Konsumtif'): string {
  const b1 = `Coba lo perhatiin gimana di sekitar kita banyak orang buru-buru membenarkan kebiasaan ngutang konsumtif terkait ${topic} seolah masa depan bisa dibayar pakai janji manis. Padahal begitu kita bedah faktanya secara jernih, ada logika goblok yang sengaja nutupin data bahwa biaya hidup naik Rp1.500.000 per bulan sejak tahun 1990-an tanpa diimbangi kenaikan upah riil sebesar 3,14% per tahun. Banyak orang masih terjebak anggapan tolol kalau kerja keras tanpa perencanaan matang pasti otomatis beres. Keputusan bego yang cuma ngejar gengsi semu di tongkrongan ini makin bikin keuangan remuk, diperparah sama asumsi bodoh bahwa pinjaman konsumtif bisa ditutup pakai utang baru. Kalau argumen dungu kayak gitu terus dibela tanpa evaluasi jujur, masyarakat bakal terus muter di lingkaran persoalan yang sama.`;

  const b2 = `Masalahnya makin kelihatan waktu kita telusuri akar kebiasaan pembiaran ini sampai ke mekanisme pengambilan keputusan warga sehari-hari. Kebiasaan meremehkan literasi finansial melahirkan logika goblok yang menganggap investasi bodong sebagai jalan pintas keluar dari kemiskinan. Mereka yang terjebak anggapan tolol sering nyalahin nasib buruk, padahal keputusan bego menaruh modal di platform ilegal jelas-jelas melanggar akal sehat. Argumen dungu yang membenarkan spekulasi liar tanpa perlindungan hukum terbukti merugikan ribuan keluarga, apalagi ditambah asumsi bodoh bahwa risiko kerugian nggak bakal menimpa diri sendiri. Akar persoalan ini bukan sekadar ketidaktahuan teknis, melainkan keengganan kolektif buat menguji ulang pola pikir yang cacat.`;

  const b3 = `Begitu lo masuk ke inti persoalan di lapangan, benturan antara retorika manis dan realitas ekonomi makin terasa menyesakkan. Banyak keluarga terjerat bunga pinjaman harian karena logika goblok yang menyamakan utang berbunga tinggi dengan bantuan darurat keluarga. Sikap membiarkan kerabat terjebak anggapan tolol soal uang gampang justru mempercepat kehancuran aset produktif mereka. Kita ngelihat sendiri gimana keputusan bego meminjam modal kerja buat kebutuhan konsumtif bikin usaha kecil gulung tikar dalam hitungan bulan. Menghadapi situasi genting ini, argumen dungu yang menolak audit keuangan keluarga harus segera dihentikan sebelum asumsi bodoh bahwa keadaan bakal membaik dengan sendirinya menghancurkan sisa tabungan yang ada.`;

  const b4 = `Buat memutus rantai masalah ini, langkah penyelesaian yang masuk akal harus berani mendobrak kebiasaan lama dan membangun disiplin baru yang berbasis fakta empiris. Kita wajib menyingkirkan logika goblok yang menganggap pencatatan pengeluaran harian sebagai hal ribet yang buang-buang waktu. Langkah koreksi dimulai dengan meninggalkan anggapan tolol bahwa perencanaan anggaran cuma perlu buat orang kaya dengan aset melimpah. Warga harus berhenti mengambil keputusan bego yang mencampuradukkan kas rumah tangga dengan pinjaman online ilegal. Argumen dungu yang menolak transparansi keuangan keluarga nggak boleh lagi dikasih tempat, begitu juga asumsi bodoh yang meremehkan dana darurat sebelum krisis berikutnya datang melanda.`;

  const b5 = `Ujung-ujungnya, seluruh pembahasan ini kembali ke kesadaran kita sendiri buat berdiri di atas akal sehat dan data nyata. Perubahan kondisi ekonomi masyarakat nggak bakal pernah lahir dari logika goblok yang terus-terusan memaklumi kesalahan berpikir yang sama. Kita harus berani membuang anggapan tolol bahwa nasib finansial seseorang sepenuhnya diatur keberuntungan tanpa ada andil disiplin nalar. Menghindari keputusan bego dalam mengelola pendapatan adalah bentuk tanggung jawab moral paling dasar bagi masa depan keluarga kita. Jangan biarkan argumen dungu dan asumsi bodoh kembali mengaburkan pandangan kita saat peluang perbaikan sudah ada di depan mata.`;

  return [b1, b2, b3, b4, b5].join('\n');
}
