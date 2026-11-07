import { FullScriptAudit, GenNASConfig } from './types';
import {
  sanitizeNarrativeFromReferenceLeakage,
  applyLanguagePurityAndSanitization,
} from './validatorAndPipeline';

export interface FinalExportGuardOptions {
  isFinalApproved?: boolean;
  stage3Status?: string;
  stage4Status?: string;
  stage8Status?: string;
  isDraftV0?: boolean;
  audit?: FullScriptAudit;
  workflowState?: {
    isFinalApproved?: boolean;
    stages?: Record<number, { status: string }>;
    draftV0?: any;
    finalScriptData?: any;
    approvalData?: any;
  };
}

export interface FinalExportEligibilityResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Memeriksa kelayakan ekspor naskah final sesuai aturan penguncian:
 * 1. Naskah harus tersedia.
 * 2. Naskah tidak boleh berstatus Draft V0.
 * 3. Workflow Tahap Final (Tahap 3) harus sudah PASSED.
 * 4. isFinalApproved harus bernilai true.
 * 5. Naskah wajib lulus audit kualitas final.
 */
export function checkFinalExportEligibility(
  cleanScript: string,
  options?: FinalExportGuardOptions
): FinalExportEligibilityResult {
  // 1. Keberadaan naskah
  if (!cleanScript || !cleanScript.trim()) {
    return {
      allowed: false,
      reason: 'Ekspor naskah final ditolak: Naskah belum tersedia.',
    };
  }

  // Jika opsi verifikasi tidak diberikan sama sekali, tolak pemanggilan langsung
  if (!options) {
    return {
      allowed: false,
      reason:
        'Ekspor naskah final ditolak: Tahap Final belum disahkan (isFinalApproved === false).',
    };
  }

  // 2. Jika naskah masih Draft V0, ekspor naskah final harus ditolak
  const isDraftV0 =
    options.isDraftV0 ??
    (options.workflowState?.stages
      ? options.workflowState.stages[2]?.status === 'PASSED' &&
        options.workflowState.stages[3]?.status !== 'PASSED' &&
        options.workflowState.stages[4]?.status !== 'PASSED' &&
        options.workflowState.stages[8]?.status !== 'PASSED'
      : false);

  if (isDraftV0) {
    return {
      allowed: false,
      reason:
        'Ekspor naskah final ditolak: Naskah masih berupa Draft V0 dan belum disahkan pada Tahap Final.',
    };
  }

  // 3. Jika Tahap Final belum PASSED, ekspor harus ditolak
  const stageStatus =
    options.stage3Status ??
    options.stage4Status ??
    options.stage8Status ??
    options.workflowState?.stages?.[3]?.status ??
    options.workflowState?.stages?.[4]?.status ??
    options.workflowState?.stages?.[8]?.status;
  if (stageStatus !== 'PASSED') {
    return {
      allowed: false,
      reason:
        'Ekspor naskah final ditolak: Workflow Tahap Final belum berstatus PASSED.',
    };
  }

  // 4. Jika isFinalApproved bernilai false, ekspor harus ditolak
  const isApproved =
    options.isFinalApproved ?? options.workflowState?.isFinalApproved;
  if (!isApproved) {
    return {
      allowed: false,
      reason:
        'Ekspor naskah final ditolak: Status pengesahan isFinalApproved bernilai false.',
    };
  }

  // 5. Jika naskah gagal audit final
  const auditToCheck =
    options.audit ?? options.workflowState?.finalScriptData?.audit;
  if (auditToCheck) {
    if (!auditToCheck.passed) {
      return {
        allowed: false,
        reason:
          'Ekspor naskah final ditolak: Naskah gagal memenuhi audit kontrak deterministik V5.1.',
      };
    }
    if (!auditToCheck.nonSaraPassed) {
      return {
        allowed: false,
        reason:
          'Ekspor naskah final ditolak: Naskah melanggar aturan batas sasaran kritik NON_SARA_HARD_GUARD.',
      };
    }
    if (auditToCheck.quoteFree && !auditToCheck.quoteFree.passed) {
      return {
        allowed: false,
        reason:
          'Ekspor naskah final ditolak: Naskah memuat tanda petik ganda (Quote-Free belum lulus).',
      };
    }
    if (auditToCheck.sourceFidelity && !auditToCheck.sourceFidelity.passed) {
      return {
        allowed: false,
        reason:
          'Ekspor naskah final ditolak: Naskah tidak sesuai kerangka sumber (Source Fidelity gagal).',
      };
    }
    if (auditToCheck.languageIntegrity && !auditToCheck.languageIntegrity.passed) {
      return {
        allowed: false,
        reason:
          'Ekspor naskah final ditolak: Naskah gagal memenuhi audit kemurnian bahasa (istilah asing dilarang, marker, atribusi peneliti, atau morfologi cacat).',
      };
    }
  }

  return { allowed: true };
}

export function validateFinalExportApproval(
  cleanScript: string,
  options?: FinalExportGuardOptions
): void {
  const result = checkFinalExportEligibility(cleanScript, options);
  if (!result.allowed) {
    throw new Error(result.reason || 'Ekspor naskah final ditolak.');
  }
}

function triggerDownload(blob: Blob, filename: string) {
  if (typeof document === 'undefined') {
    // Mode testing / server headless: bypass manipulasi DOM tanpa error
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function exportCleanScriptTxt(
  cleanScript: string,
  topik: string,
  options?: FinalExportGuardOptions
): { success: boolean; filename: string } {
  validateFinalExportApproval(cleanScript, options);
  const sanitizedScript = applyLanguagePurityAndSanitization(
    sanitizeNarrativeFromReferenceLeakage(cleanScript)
  );

  const slug = (topik || 'gennas-pro-v51')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `${slug}-clean-sctf.txt`;
  const blob = new Blob(['\uFEFF' + sanitizedScript], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, filename);
  return { success: true, filename };
}

export function exportScriptDocx(
  cleanScript: string,
  voiceScript: string,
  config: GenNASConfig,
  audit: FullScriptAudit,
  options?: FinalExportGuardOptions
): { success: boolean; filename: string } {
  validateFinalExportApproval(cleanScript, {
    ...options,
    audit: options?.audit ?? audit,
  });

  const sanitizedScript = applyLanguagePurityAndSanitization(
    sanitizeNarrativeFromReferenceLeakage(cleanScript)
  );
  const sanitizedVoice = applyLanguagePurityAndSanitization(
    sanitizeNarrativeFromReferenceLeakage(voiceScript)
  );

  const slug = (config.topik || 'gennas-pro-v51')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `${slug}-naskah.docx`;

  const blocks = sanitizedScript.split('\n').filter(Boolean);
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>GenFLOW Studio — ${escapeXml(config.topik)}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Durasi Target: ${config.durasiMenit} menit (${config.wpm} WPM) | Total Kata Aktual: ${audit.totalWords} kata | Kritik Valid: ${audit.kritikPassCount}/${audit.expectedParagraphCount} Blok</w:t></w:r></w:p>
    <w:p><w:r><w:t> </w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>A. Clean Script (5 Blok SCTF)</w:t></w:r></w:p>
    ${blocks
      .map(
        (b, i) =>
          `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>[Blok ${i + 1} - ${escapeXml(audit.stages[i]?.stageName || '')}]</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">${escapeXml(b)}</w:t></w:r></w:p>`
      )
      .join('')}
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'word/_rels/document.xml.rels', content: documentRelsXml },
    { name: 'word/document.xml', content: documentXml },
    { name: 'word/styles.xml', content: stylesXml },
  ];

  const enc = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  const computeCrc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const dataBytes = enc.encode(file.content);
    const crc = computeCrc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length + size);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localHeaders.push(localHeader);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralHeader.buffer);
    cView.setUint32(0, 0x02014b50, true);
    cView.setUint16(4, 20, true);
    cView.setUint16(6, 20, true);
    cView.setUint16(8, 0, true);
    cView.setUint16(10, 0, true);
    cView.setUint16(12, 0, true);
    cView.setUint16(14, 0, true);
    cView.setUint32(16, crc, true);
    cView.setUint32(20, size, true);
    cView.setUint32(24, size, true);
    cView.setUint16(28, nameBytes.length, true);
    cView.setUint16(30, 0, true);
    cView.setUint16(32, 0, true);
    cView.setUint16(34, 0, true);
    cView.setUint16(36, 0, true);
    cView.setUint32(38, 0, true);
    cView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  let cdSize = 0;
  for (const ch of centralHeaders) {
    cdSize += ch.length;
  }
  const cdOffset = offset;

  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, files.length, true);
  eView.setUint16(10, files.length, true);
  eView.setUint32(12, cdSize, true);
  eView.setUint32(16, cdOffset, true);
  eView.setUint16(20, 0, true);

  const totalLength = offset + cdSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const lh of localHeaders) {
    result.set(lh, pos);
    pos += lh.length;
  }
  for (const ch of centralHeaders) {
    result.set(ch, pos);
    pos += ch.length;
  }
  result.set(eocd, pos);

  const blob = new Blob([result], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerDownload(blob, filename);
  return { success: true, filename };
}

export function exportFinalScriptJson(
  cleanScript: string,
  config: GenNASConfig,
  audit: FullScriptAudit,
  options?: FinalExportGuardOptions
): { success: boolean; filename: string } {
  validateFinalExportApproval(cleanScript, {
    ...options,
    audit: options?.audit ?? audit,
  });

  const sanitizedScript = applyLanguagePurityAndSanitization(
    sanitizeNarrativeFromReferenceLeakage(cleanScript)
  );

  const slug = (config.topik || 'gennas-pro-v51')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `${slug}-final-script.json`;

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 'GenNAS Pro V5.1',
    status: 'FINAL_APPROVED',
    config,
    cleanScript: sanitizedScript,
    blocks: sanitizedScript.split('\n').filter(Boolean),
    audit,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, filename);
  return { success: true, filename };
}

export function exportAuditJsonFile(
  audit: FullScriptAudit,
  config: GenNASConfig,
  cleanScript?: string,
  options?: FinalExportGuardOptions
) {
  if (cleanScript !== undefined && options !== undefined) {
    validateFinalExportApproval(cleanScript, options);
  }

  const slug = (config.topik || 'gennas-pro-v51')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 'GenNAS Pro V5.1',
    config,
    audit,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, `${slug}-audit-v51.json`);
}

export function exportConfigJsonFile(config: GenNASConfig) {
  const blob = new Blob([JSON.stringify({ version: 'V5.1', config }, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, 'gennas-pro-v51-settings.json');
}
