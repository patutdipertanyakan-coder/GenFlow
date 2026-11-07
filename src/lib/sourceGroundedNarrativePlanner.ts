import {
  DocumentSemanticClassification,
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_WPM,
  SourceGroundedPlan,
  StoryFlowStagePlanItem,
} from './types';
import { calculateStageTargets } from './validatorAndPipeline';

/**
 * SOURCE-GROUNDED NARRATIVE PLANNER
 * Memetakan substansi dokumen sumber ke dalam representasi perencanaan narasi 5 tahap StoryFlow:
 * 1. Menjaga topik spesifik dokumen (mis. ungkapan "Harta Gak Dibawa Mati" dan dampak pola pikirnya)
 * 2. Merumuskan tesis utama berdasarkan kritik dan argumen yang ada di dokumen
 * 3. Menyusun 5 tahap StoryFlow dengan alokasi bobot dan target kata yang terarah
 * 4. Menentukan batasan klaim (unresolved_claims) agar AI tidak mengarang fakta palsu
 * 5. Memisahkan secara ketat batasan sasaran kritik Non-SARA agar tidak menggantikan topik atau bocor ke naskah
 */
export function buildSourceGroundedNarrativePlan(
  classification: DocumentSemanticClassification,
  config?: Partial<GenNASConfig> | string
): SourceGroundedPlan {
  const cfgObj: Partial<GenNASConfig> =
    typeof config === 'string'
      ? { topik: config, durasiMenit: 12, wpm: LOCKED_WPM }
      : (config || {});
  const durasiMenit = Math.max(1, Number(cfgObj.durasiMenit) || 12);
  const wpm = Number(cfgObj.wpm) || LOCKED_WPM;
  const stageTargets = calculateStageTargets(
    durasiMenit,
    wpm,
    cfgObj.struktur,
    cfgObj.jumlahBlok || 5
  );

  // Ambil topik spesifik dari dokumen, bukan tema generik
  const rawMainTopic =
    classification.mainTopic ||
    classification.documentTitle ||
    cfgObj.topik ||
    'Isu dan fenomena dalam kerangka dokumen';

  // Periksa apakah dokumen membahas ungkapan / fenomena keagamaan atau moral khusus (seperti "Harta Gak Dibawa Mati")
  const lowerTopic = rawMainTopic.toLowerCase();
  let refinedTopic = rawMainTopic;
  let refinedThesis = classification.centralThesis;

  if (
    lowerTopic.includes('harta gak dibawa mati') ||
    lowerTopic.includes('harta tidak dibawa mati')
  ) {
    refinedTopic =
      'ungkapan "Harta Gak Dibawa Mati" dan dampak pola pikir fatalistik finansial di masyarakat';
    if (!refinedThesis || refinedThesis.length < 20) {
      refinedThesis =
        'Ungkapan "harta gak dibawa mati" sering disalahgunakan sebagai pembenaran fatalistik atas ketidakmampuan mengelola finansial, kemalasan berusaha, dan pembiaran kemiskinan yang merusak ketahanan masa depan keluarga.';
    }
  }

  // Identifikasi argumen-argumen utama dari klasifikasi dokumen
  const candidateArguments = classification.keyArguments.filter(
    (arg) => arg.length > 10 && !arg.toLowerCase().includes('framework')
  );

  const keyArguments =
    candidateArguments.length > 0
      ? candidateArguments
      : [
          `Penyalahgunaan logika atau ungkapan terkait ${refinedTopic} yang mengabaikan tanggung jawab nyata di lapangan.`,
          `Kesalahpahaman cara bernalar yang menjustifikasi kebiasaan buruk dengan dalih pembenaran sepihak.`,
          `Dampak riil terhadap ketahanan sosial, ekonomi, atau cara berpikir masyarakat saat akal sehat dimatikan.`,
          `Kebutuhan membedakan antara nilai luhur yang benar versus tameng pembenaran yang merugikan.`,
        ];

  // Bukti pendukung dari sumber
  const supportingEvidence =
    classification.supportingEvidence.length > 0
      ? classification.supportingEvidence
      : [
          `Fakta lapangan dan contoh cara bernalar sehari-hari yang tercantum dalam kerangka dokumen.`,
        ];

  // Referensi spesifik
  const sourceReferences = [
    ...(classification.documentTitle ? [classification.documentTitle] : []),
    ...classification.topicKeywords.slice(0, 8),
  ];

  // Batasan klaim yang tidak didukung sumber (mencegah halusinasi data / tuduhan personal)
  const unresolvedClaims = [
    'Dilarang mengarang angka statistik, survei fiktif, atau persentase palsu yang tidak ada di kerangka sumber.',
    'Dilarang menuduh tokoh, individu, ormas, atau lembaga tertentu sebagai pelaku kejahatan tanpa data di kerangka.',
    'Dilarang menyerang esensi ajaran agama, kitab suci, suku, atau ras mana pun; fokus kritik HANYA pada cara bernalar, penyalahgunaan argumen, kebiasaan, dan pola pikir masyarakat yang keliru.',
  ];

  // Pemetaan 5 Blok StoryFlow Berdasarkan Substansi Sumber
  const stageDefinitions = [
    {
      id: 1,
      name: 'Hook',
      focus: `Buka dengan paradoks atau kejanggalan nyata seputar ${refinedTopic} yang langsung menyentil logika dan kebiasaan umum penonton.`,
      points: [
        `Sorot kontradiksi antara ucapan pembenaran seputar "${refinedTopic}" dengan realitas kebutuhan hidup yang dihadapi sehari-hari.`,
        `Kritik pola pikir yang merasa tindakannya otomatis benar cuma karena dibungkus tameng moral atau ungkapan pasrah.`,
      ],
    },
    {
      id: 2,
      name: 'Akar Masalah',
      focus: `Jelaskan latar belakang, salah kaprah pemahaman, dan mengapa anggapan keliru tentang ${refinedTopic} terus dipelihara di masyarakat.`,
      points: [
        `Dekonstruksi bagaimana anggapan ini diwariskan atau dijadikan alasan instan untuk ngeles dari tanggung jawab.`,
        `Jelaskan kaitan antara pemikiran fatalistik dengan kebiasaan menghindari perencanaan hidup yang matang.`,
      ],
    },
    {
      id: 3,
      name: 'Inti Masalah',
      focus: `Bedah bukti, mekanisme sebab-akibat, kontra-argumen, dan dampak sistemik nyata di masyarakat saat pola pikir ini dibiarkan.`,
      points: [
        `Tunjukkan dampak langsung pada ketahanan finansial, pendidikan anak, atau kerentanan keluarga ketika nalar kritis dimatikan.`,
        `Bongkar logika keliru yang menyamakan kepasrahan buta dengan kebijaksanaan hidup.`,
        ...keyArguments.slice(0, 2),
      ],
    },
    {
      id: 4,
      name: 'Penyelesaian',
      focus: `Evaluasi solusi realistis, perbaikan cara bernalar, dan batasan tanggung jawab nalar kritis penonton.`,
      points: [
        `Tawarkan perspektif sehat: bagaimana membedakan antara kesederhanaan sejati dengan kemalasan yang ditutupi dalih suci.`,
        `Tegaskan pentingnya literasi berpikir dan keberanian menolak pembenaran logika yang merugikan diri sendiri maupun keluarga.`,
      ],
    },
    {
      id: 5,
      name: 'Kesimpulan',
      focus: `Sintesis tajam dan ajakan refleksi kritis tanpa mengulang klise, mengunci pesan inti agar penonton tidak mudah dibohongi lagi.`,
      points: [
        `Tegaskan kembali bahwa realitas hidup tidak bisa diselesaikan dengan tameng ungkapan pasrah semata.`,
        `Ajak penonton mengambil sikap kritis dan berani membenahi cara bernalar sehari-hari.`,
      ],
    },
  ];

  const storyflow_plan: StoryFlowStagePlanItem[] = stageTargets.stages.map(
    (stg, idx) => {
      const def = stageDefinitions[idx] || stageDefinitions[0];
      return {
        blockId: stg.id,
        stageName: stg.name,
        weightPercent: stg.weightPercent,
        targetWords: stg.targetWords,
        coreFocus: def.focus,
        keyPoints: def.points,
        groundedSourcePoints: [
          ...keyArguments.slice(idx, idx + 1),
          ...supportingEvidence.slice(idx, idx + 1),
        ],
      };
    }
  );

  return {
    main_topic: refinedTopic,
    central_thesis: refinedThesis,
    key_arguments: keyArguments,
    supporting_evidence: supportingEvidence,
    source_references: sourceReferences,
    storyflow_plan,
    unresolved_claims: unresolvedClaims,
    target_word_count: stageTargets.totalTargetWords,
    wpm,
    duration_minutes: durasiMenit,
    locked_perspective_boundary: LOCKED_CRITICAL_PERSPECTIVE,
  };
}
