import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractProtectedTokens,
  sanitizeNarrativeFromReferenceLeakage,
  enforceLockedConfig,
} from './validatorAndPipeline';
import { createValidTestSCTFScript } from './testFixtures';
import {
  analyzeNarrativeContext,
  evaluateF7CandidateInContext,
  computeF7NotesMonitor,
  runF7PostGenerationAuditAndRevision,
} from './f7ContextualGuardEngine';
import { executeStage1Sync } from './workflowEngine';

describe('7 Targeted Fixes Regression Suite (GenNAS Studio)', () => {
  describe('Perbaikan 1 — Filter Referensi, DOI, URL, dan Alamat Bukti', () => {
    const sampleSource =
      'BPS dan OJK mencatat pada 5 Februari 2026 sebesar 8,25% — Referensi 10.1111/j.1536-7150.2010.00767.x https://example.com/data';

    it('separates substantive Protected Facts from Reference Metadata (DOI, URL, Referensi)', () => {
      const protectedMap = extractProtectedTokens(sampleSource);

      // Substantive facts must be preserved in SAP Protected Tokens
      assert.ok(protectedMap.tokens.includes('BPS'), 'BPS must be in protected tokens');
      assert.ok(protectedMap.tokens.includes('OJK'), 'OJK must be in protected tokens');
      assert.ok(protectedMap.tokens.includes('5 Februari 2026'), '5 Februari 2026 must be in protected tokens');
      assert.ok(protectedMap.tokens.includes('8,25%'), '8,25% must be in protected tokens');
      assert.ok(protectedMap.tokens.includes('8,25'), '8,25 must be in protected tokens');

      // Reference metadata must NEVER enter SAP Protected Tokens
      assert.ok(
        !protectedMap.tokens.some((t) => t.includes('10.1111')),
        'DOI must never enter SAP Protected Tokens'
      );
      assert.ok(
        !protectedMap.tokens.some((t) => t.includes('https://example.com')),
        'URL must never enter SAP Protected Tokens'
      );
      assert.ok(
        !protectedMap.tokens.some((t) => /referensi/i.test(t)),
        'Referensi label must never enter SAP Protected Tokens'
      );

      // Reference metadata must be captured in isolated referenceMetadata
      const refValues = (protectedMap.referenceMetadata || []).map((r) => r.value);
      assert.ok(
        refValues.some((v) => v.includes('10.1111/j.1536-7150.2010.00767.x')),
        'DOI must be stored in isolated referenceMetadata'
      );
      assert.ok(
        refValues.some((v) => v.includes('https://example.com/data')),
        'URL must be stored in isolated referenceMetadata'
      );
    });

    it('ensures DOI, URL, and Reference labels never leak into Stage 1-8 Workflow or Final Script', () => {
      const config = enforceLockedConfig({
        faktaTerverifikasi: sampleSource,
        durasiMenit: 2,
      });

      const stage1 = executeStage1Sync(sampleSource, 'audit-bps.txt');
      assert.ok(stage1.referenceMetadata && stage1.referenceMetadata.length >= 2);
      assert.ok(!stage1.cleanedNarrativeSourceText?.includes('10.1111/j.1536-7150.2010.00767.x'));
      assert.ok(!stage1.cleanedNarrativeSourceText?.includes('https://example.com/data'));

      const draftScript = createValidTestSCTFScript('Data BPS mencatat rasio 8,25%');
      assert.ok(!draftScript.includes('10.1111/j.1536-7150.2010.00767.x'), 'Draft must not contain DOI');
      assert.ok(!draftScript.includes('https://example.com/data'), 'Draft must not contain URL');
      assert.ok(!/—\s*Referensi/i.test(draftScript), 'Draft must not contain — Referensi');
      assert.ok(draftScript.includes('BPS'), 'Substantive fact BPS must remain in narrative');
      assert.ok(draftScript.includes('8,25%'), 'Substantive fact 8,25% must remain in narrative');
    });

    it('sanitizes accidental reference leakage from narrative text', () => {
      const dirtyLine =
        'Gue lihat BPS dan OJK mencatat pada 5 Februari 2026 sebesar 8,25% — Referensi 10.1111/j.1536-7150.2010.00767.x https://example.com/data yang bikin publik kaget.';
      const cleaned = sanitizeNarrativeFromReferenceLeakage(dirtyLine);
      assert.ok(!cleaned.includes('10.1111/j.1536-7150.2010.00767.x'));
      assert.ok(!cleaned.includes('https://example.com/data'));
      assert.ok(!cleaned.includes('Referensi'));
      assert.ok(cleaned.includes('BPS'));
      assert.ok(cleaned.includes('8,25%'));
    });
  });

  describe('Perbaikan 2 & 3 — F7 Menjadi Monitoring Catatan (Read-Only) & Menjaga Gaya Informal Gue–Lo', () => {
    it('returns empty state message when no script has been generated yet', () => {
      const emptyReport = computeF7NotesMonitor('', 'Ekonomi', '');
      assert.equal(emptyReport.hasActiveScript, false);
      assert.equal(
        emptyReport.emptyStateMessage,
        'BELUM ADA NASKAH — MONITOR MENUNGGU GENERATE.'
      );
      assert.equal(emptyReport.totalDatasetEntries, 268);
      assert.ok(emptyReport.items.length > 0);
    });

    it('computes read-only F7 notes monitor on active script without mutating the script', () => {
      const originalScript =
        'Gue heran kenapa mereka masih aja ngeles dan nyindir waktu kita ngupas fakta yang udah jelas di depan mata.\nLo bisa lihat sendiri gimana kebijakan itu bikin publik makin bingung.';
      const report = computeF7NotesMonitor(originalScript, 'Kebijakan Publik', originalScript);
      assert.equal(report.hasActiveScript, true);
      assert.ok(report.allowCount > 0);
      assert.ok(report.conditionalCount > 0);
      assert.ok(report.avoidCount > 0);
      const ngupasItem = report.items.find((e) => e.word === 'ngupas');
      assert.ok(ngupasItem, 'ngupas should be present in F7 monitor entries');
      assert.equal(ngupasItem?.usedInScript, true);
      assert.ok(ngupasItem?.relevantBlockIds.includes(1));
    });

    it('preserves natural informal Gue–Lo vocabulary ("ngeles", "nyindir", "ngupas") without replacing it with formal dictionary definitions', () => {
      const ctx = analyzeNarrativeContext({
        topic: 'Ekonomi Rumah Tangga',
        outline: 'BPS mencatat pengeluaran meningkat 8,25% pada 5 Februari 2026.',
      });
      const sentence =
        'Gue heran kenapa mereka masih aja ngeles waktu fakta udah jelas di depan mata.';
      const decisionNgeles = evaluateF7CandidateInContext('ngeles', ctx, sentence);
      assert.ok(decisionNgeles.status === 'PASS' || decisionNgeles.status === 'RETAINED');
      assert.equal(decisionNgeles.allowedInDraft, true);

      const decisionNgupas = evaluateF7CandidateInContext('ngupas', ctx, sentence);
      assert.equal(decisionNgupas.status, 'RETAINED');
      assert.equal(decisionNgupas.allowedInDraft, true);

      const scriptAudit = runF7PostGenerationAuditAndRevision({
        script: sentence,
        topic: 'Ekonomi Rumah Tangga',
        outline: 'BPS mencatat pengeluaran meningkat 8,25% pada 5 Februari 2026.',
      });
      assert.equal(scriptAudit.revisedScript, sentence, 'Informal Gue-Lo sentence must remain 100% intact');
      assert.ok(!scriptAudit.revisedScript.includes('melakukan evaluasi terhadap keputusan tersebut'));
    });
  });

  describe('Perbaikan 4, 5, 6, 7 — Verifikasi Komponen UI & Pemisahan 3 Animasi', () => {
    const rootDir = process.cwd();

    it('ensures Options menu has only 3 choices and Back buttons exist in Master Lexicon, Master Prompt, and Developer Tools', () => {
      const appCode = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
      assert.ok(appCode.includes('data-testid="option-master-lexicon-btn"'));
      assert.ok(appCode.includes('data-testid="option-master-prompt-btn"'));
      assert.ok(appCode.includes('data-testid="option-dev-tools-btn"'));
      assert.ok(!appCode.includes('data-testid="option-generate-studio-btn"'), '4th item Generate Studio must be removed from Options');

      const lexiconCode = fs.readFileSync(path.join(rootDir, 'src/components/LexiconBankView.tsx'), 'utf8');
      const promptCode = fs.readFileSync(path.join(rootDir, 'src/components/MasterPromptView.tsx'), 'utf8');
      const devToolsCode = fs.readFileSync(path.join(rootDir, 'src/components/DeveloperToolsModal.tsx'), 'utf8');

      assert.ok(lexiconCode.includes('data-testid="back-to-studio-btn"'));
      assert.ok(lexiconCode.includes('MONITORING CATATAN'));
      assert.ok(promptCode.includes('data-testid="back-to-studio-btn"'));
      assert.ok(devToolsCode.includes('data-testid="back-to-studio-btn"'));
    });

    it('strictly separates the 3 animations: Speedometer mini car, Open Book SCTF, and Horizontal Racing Car Track', () => {
      const speedometerCode = fs.readFileSync(
        path.join(rootDir, 'src/components/StoryFlowSpeedometer.tsx'),
        'utf8'
      );
      const bookCode = fs.readFileSync(
        path.join(rootDir, 'src/components/BookLoadingAnimation.tsx'),
        'utf8'
      );
      const racingCode = fs.readFileSync(
        path.join(rootDir, 'src/components/RacingCarLoadingAnimation.tsx'),
        'utf8'
      );
      const editorCode = fs.readFileSync(
        path.join(rootDir, 'src/components/EditorAndQualityPanel.tsx'),
        'utf8'
      );

      // 1. Speedometer has proportional contained car indicator, unclipped viewBox, and 2-layer RPM needle
      assert.ok(speedometerCode.includes('data-testid="speedometer-car-indicator"'));
      assert.ok(speedometerCode.includes('overflow-hidden'));
      assert.ok(speedometerCode.includes('viewBox="0 0 220 130"'), 'Speedometer SVG must use full unclipped semicircular viewBox');
      assert.ok(speedometerCode.includes('data-testid="speedometer-needle-base"'), 'Speedometer must have Data Layer needle base');
      assert.ok(speedometerCode.includes('data-testid="speedometer-needle-idle"'), 'Speedometer must have separated Idle Animation Layer needle');
      assert.ok(!speedometerCode.includes('setInterval'), 'Speedometer animation must never use timer to mutate duration');

      // 2. BookLoadingAnimation is a genuine open book with flipping pages, NOT an alias to RacingCarLoadingAnimation
      assert.ok(bookCode.includes('data-testid="open-book-visual"'));
      assert.ok(bookCode.includes('data-testid="open-book-flipping-pages"'));
      assert.ok(!bookCode.includes('RacingCarLoadingAnimation as BookLoadingAnimation'));

      // 3. RacingCarLoadingAnimation has horizontal track, 2-layer moving racing car, rotating wheels, exhaust smoke, suspension, and road dashes
      assert.ok(racingCode.includes('data-testid="racing-car-track-animation"'));
      assert.ok(racingCode.includes('data-testid="racing-car-vehicle"'));
      assert.ok(racingCode.includes('data-testid="racing-car-cruise-drift"'));
      assert.ok(racingCode.includes('data-testid="racing-car-chassis-suspension"'));
      assert.ok(racingCode.includes('data-testid="racing-car-wheel-front"'));
      assert.ok(racingCode.includes('data-testid="racing-car-wheel-rear"'));
      assert.ok(racingCode.includes('data-testid="racing-car-exhaust-smoke"'));
      assert.ok(racingCode.includes('data-testid="racing-road-dashes"'));
      assert.ok(!racingCode.includes('setInterval'), 'RacingCarLoadingAnimation must never use timer to fake progress percentage');
      assert.ok(editorCode.includes('<BookLoadingAnimation'));
      assert.ok(editorCode.includes('<RacingCarLoadingAnimation'));

      // 4. Verify prefers-reduced-motion rules exist in src/index.css for all new animations
      const cssCode = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
      assert.ok(cssCode.includes('@media (prefers-reduced-motion: reduce)'));
      assert.ok(cssCode.includes('.gennas-rpm-needle-idle'));
      assert.ok(cssCode.includes('.gennas-car-cruise-drift'));
      assert.ok(cssCode.includes('.gennas-wheel-spin'));
      assert.ok(cssCode.includes('.gennas-exhaust-puff-1'));
      assert.ok(cssCode.includes('.gennas-road-dashes'));
    });

    it('preserves WPM=135, target word calculation, 5 presets, and StoryFlow allocation for all durations (2, 12, 20, 30, 50 min)', () => {
      const expectedTargets: Record<number, number> = {
        2: 270,
        12: 1620,
        20: 2700,
        30: 4050,
        50: 6750,
      };
      for (const [durStr, expectedWords] of Object.entries(expectedTargets)) {
        const dur = Number(durStr);
        const cfg = enforceLockedConfig({ durasiMenit: dur });
        assert.equal(cfg.wpm, 135, `WPM must remain locked at 135 for ${dur}m`);
        assert.equal(cfg.durasiMenit, dur, `Duration must remain ${dur}m`);
        assert.equal(cfg.durasiMenit * cfg.wpm, expectedWords, `Target words for ${dur}m must be ${expectedWords}`);
        const weightSum = cfg.struktur.reduce((acc, v) => acc + v, 0);
        assert.equal(weightSum, 100, 'StoryFlow 5-stage weights must sum to 100%');
      }
    });
  });
});

