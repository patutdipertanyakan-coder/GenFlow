# GenNAS Pro V5.1 — Unified Master Specification

Aplikasi studio penulisan naskah YouTube edukasi/informatif kritis bernada **ngomel anak tongkrongan gue–lo** dengan format **5 Blok SCTF (Strict Compact Text Formatting)**, **Validator Deterministik + NLP Span**, **CoreLexiconRegistry F1–F8 Utuh**, dan **Pipeline TTS ElevenLabs v4**.

## 1. Arsitektur Berjenjang (Bagian I.4)

1. **`src/lib/lexiconRegistry.ts` (`CoreLexiconRegistry`)**:
   - Menyimpan seluruh **56 entri unik wajib Lampiran F1** (`KOSAKATA INTI YANG HARUS TERSEDIA DALAM BANK`) sebagai seed permanen/immutable (`CORE_LEXICON_BANK`).
   - Mempertahankan **Lampiran F2–F8 secara utuh** (`F2` akhiran `-in`, `F3` afiks `ng-/nge-/ny-/n-`, `F4` penanda percakapan, `F5` kata kerja percakapan pengganti formal, `F6` kajian kebahasaan, `F7` 7 catatan makna & afiks, `F8` 7 aturan rotasi kosakata).
   - Memisahkan secara tegas `CORE_LEXICON_BANK` (F1) dan `EXTENDED_LEXICON_BANK` (F2–F8) dari `PROFANITY_ROOT_WORDS` (Bank Kata Kasar Bagian H).
   - Menyediakan fungsi pemeriksaan kelengkapan berbasis himpunan `auditCoreLexiconCompleteness()` (`core_expected`, `core_actual`, `core_missing = []`).
2. **`src/lib/masterPromptV51.ts` (`RUNTIME_MASTER_PROMPT_V51`)**:
   - Menyimpan konstanta runtime murni dari **BAGIAN II (A–P)** beserta **Lampiran Referensi F (F1–F8)** dan **Lampiran Referensi G (G1–G11)** tanpa mencampurkan instruksi pembangunan Bagian I.
3. **`src/lib/validatorAndPipeline.ts`**:
   - **InputGuard & SourceFacts**: Melindungi angka ribuan (`1.500.000`), desimal (`3,14`), persentase, tahun (`1990-an`), mata uang (`Rp`), URL, DOI, dan kutipan langsung (`"..."`).
   - **StoryPlanner**: Menghitung target kata berbasis WPM (`135 WPM` default: `2=270, 12=1620, 20=2700, 30=4050, 50=6750` kata) dan menormalisasi bobot 5 tahap `[8, 17, 45, 20, 10]`.
   - **SCTF Parser & Formatter**: Memvalidasi tepat `n` baris (default 5) yang dipisahkan tepat SATU `\n` tanpa baris kosong (`\n\n`).
   - **Integrated Profanity Control**: Menghitung *span* kejadian makian (`"goblok banget"` = 1 span), membedakan makna ambigu `"gila"` (intensifier `"Gila, keren"` vs kritik argumen `"pembenaran gila"`), menolak kalimat interjeksi mandiri (`"Goblok banget."`, `"Tolol banget."`), serta memastikan 3–5 kejadian valid per blok tersebar di kalimat berbeda.
   - **SAP (Syntax-Aware Punctuation) & `REVISI_KOMA`**: Memperbaiki tanda baca sesuai EYD V (anak kalimat mendahului induk kalimat vs induk mendahului anak kalimat, larangan koma subjek–predikat dan koma setelah preposisi) tanpa mengubah satu kata pun atau jumlah makian.
   - **DRA + PTV & `REVISI_TRANSISI`**: Mendeteksi pembuka metapresenter (`"Nah, dari sini kita lanjut lagi"`, `"Sekarang kita masuk ke bab"`) dan merevisi transisi antarblok secara kohesif.
   - **TargetedRepair (`AUTO_ENFORCE`) & `EXPANDER`**: Memperbaiki pelanggaran per blok tanpa membakukan bahasa informal gue–lo.
   - **VoiceScriptCompiler & ElevenLabs v4 Chunker**: Menghasilkan `voice_script` terpisah (menormalisasi angka ke teks ucap), memecah chunk pada batas kalimat alami dengan `previous_text` & `next_text`, serta menyediakan 4 varian Uji A/B Transisi (`A`, `B`, `C`, `D`).
4. **`server.ts`**:
   - Server Express + Vite yang memanggil `@google/genai` dan ElevenLabs API hanya dari sisi server (`GEMINI_API_KEY` dan `ELEVENLABS_API_KEY` tidak pernah dikirim ke browser).

## 2. Konfigurasi Secrets (Environment Variables)

Atur melalui panel **Secrets** di Google AI Studio atau file `.env` di server:
- `GEMINI_API_KEY`: Kunci API Gemini untuk pemanggilan model utama (`gemini-3.8-flash`) dan fallback (`gemini-3.1-flash-lite`).
- `ELEVENLABS_API_KEY`: Kunci API ElevenLabs untuk sintesis suara nyata (`model_id: "eleven_v4"`). Bila belum dikonfigurasi, antarmuka menampilkan status **"PERLU API KEY (Mode Simulasi Berlabel Aktif)"** secara jujur.

## 3. Cara Menjalankan & Menguji

- **Menjalankan server aplikasi**:
  ```bash
  npm run dev
  ```
- **Menjalankan pengujian unit & integrasi deterministik**:
  ```bash
  npx --yes tsx --test src/lib/gennas.test.ts
  ```
- **Memeriksa kompilasi TypeScript & bundle produksi**:
  ```bash
  npm run build
  ```

## 4. Batasan Jujur

- Bila `ELEVENLABS_API_KEY` belum dipasang di environment server, sintesis suara berjalan pada mode simulasi berlabel jelas untuk menguji pemecahan chunk, payload konteks `previous_text`/`next_text`, dan alur Uji A/B.
- Evaluasi kontinuitas prosodi akhir antarparagraf (`AudioQA`) tetap menyertakan penanda `needsEarReview: true` karena kemiripan timbre dan emosi vokal ElevenLabs v4 dipengaruhi oleh kombinasi teks, voice ID, model, dan stokastisitas generasi audio.
