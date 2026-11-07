import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runIsolatedEdgeValidatorSuite,
  inspectSentenceIntegrityAndTruncation,
  VALIDATOR_CATEGORIES,
  captureProjectStateSnapshot,
  verifyProjectStateIsolation,
} from './isolatedEdgeValidator';
import {
  enforceLockedConfig,
  applyAutoEnforce,
  validateFullScript,
} from './validatorAndPipeline';
import { createValidTestSCTFScript } from './testFixtures';

test('Isolated Edge Validator Suite executes all 37 tests across Categories A–H and achieves 100% pass rate', () => {
  const result = runIsolatedEdgeValidatorSuite();

  assert.equal(result.allPassed, true, `Expected all tests to pass, but failed: ${result.failedCount}`);
  assert.equal(result.failedCount, 0);
  assert.equal(result.totalTests, 37, `Expected 37 test cases across Categories A–H, got ${result.totalTests}`);
  assert.equal(result.passedCount, 37);
  assert.ok(result.durationMs < 1000, `Execution should be fast, took ${result.durationMs}ms`);

  // Ensure each category has results and all pass
  VALIDATOR_CATEGORIES.forEach((cat) => {
    const list = result.resultsByCategory[cat.key];
    assert.ok(Array.isArray(list), `Category ${cat.key} should have array of results`);
    assert.ok(list.length >= 3, `Category ${cat.key} should have at least 3 test cases, got ${list.length}`);
    list.forEach((tc) => {
      assert.equal(
        tc.passed,
        true,
        `Test case ${tc.id} (${tc.name}) in category ${tc.categoryTitle} failed. Actual: ${tc.actualOutcome}`
      );
    });
  });
});

test('Negative test case philosophy: validator rejection of deliberately invalid fixture counts as PASS', () => {
  const result = runIsolatedEdgeValidatorSuite();
  const negativeCases = result.allResults.filter((r) => r.caseType === 'NEGATIF');
  assert.ok(negativeCases.length >= 18, `Expected at least 18 negative cases, got ${negativeCases.length}`);

  negativeCases.forEach((nc) => {
    assert.equal(
      nc.passed,
      true,
      `Negative case ${nc.id} should pass when validator correctly rejects invalid fixture: ${nc.actualOutcome}`
    );
  });
});

test('Sentence Integrity (PTV) validator detects truncated words/prefixes and heals them', () => {
  const valid = inspectSentenceIntegrityAndTruncation(
    'Kebijakan publik harus dievaluasi secara berkala berdasarkan data empiris.'
  );
  assert.equal(valid.hasTruncation, false);
  assert.equal(valid.issues.length, 0);

  const choppedStartWord = inspectSentenceIntegrityAndTruncation(
    'nyelesaiannya kita harus menguji ulang seluruh asumsi kebijakan tersebut.'
  );
  assert.equal(choppedStartWord.hasTruncation, true);
  assert.equal(choppedStartWord.healedText.startsWith('Penyelesaiannya'), true);

  const choppedSuffix = inspectSentenceIntegrityAndTruncation(
    'nya kita harus mencari jalan keluar yang realistis.'
  );
  assert.equal(choppedSuffix.hasTruncation, true);
  assert.ok(choppedSuffix.issues.some((i) => i.includes('nya')));
  assert.equal(choppedSuffix.healedText.startsWith('Sebenarnya'), true);

  const choppedConnector = inspectSentenceIntegrityAndTruncation(
    'kan masalahnya kita nggak tahu apa-apa sejak awal.'
  );
  assert.equal(choppedConnector.hasTruncation, true);

  const choppedMidWord = inspectSentenceIntegrityAndTruncation(
    'Pola pikir semacam ini bakal melahirkan kebiasaan merug-'
  );
  assert.equal(choppedMidWord.hasTruncation, true);
});

test('Project State Isolation Proof: running isolated validator suite does not alter empty state or active script state', () => {
  // 1. Kondisi Tanpa Naskah Pengguna (BELUM ADA NASKAH)
  const emptyBefore = captureProjectStateSnapshot({
    cleanScript: '',
    blocks: ['', '', '', '', ''],
    faktaTerverifikasi: '',
    durasiMenit: 12,
    wpm: 135,
    modeDurasi: 'FLEKSIBEL',
    struktur: [8, 17, 45, 20, 10],
    dashboardStatus: 'BELUM ADA NASKAH',
  });

  const suiteRun1 = runIsolatedEdgeValidatorSuite();
  assert.equal(suiteRun1.allPassed, true);

  const emptyAfter = captureProjectStateSnapshot({
    cleanScript: '',
    blocks: ['', '', '', '', ''],
    faktaTerverifikasi: '',
    durasiMenit: 12,
    wpm: 135,
    modeDurasi: 'FLEKSIBEL',
    struktur: [8, 17, 45, 20, 10],
    dashboardStatus: 'BELUM ADA NASKAH',
  });

  const proofEmpty = verifyProjectStateIsolation(emptyBefore, emptyAfter);
  assert.equal(proofEmpty.isolated, true);
  assert.equal(emptyAfter.dashboardStatus, 'BELUM ADA NASKAH');
  assert.equal(emptyAfter.activeLexiconUsedCount, 0);
  assert.equal(emptyAfter.protectedTokens.length, 0);

  // 2. Kondisi Ketika Sudah Ada Naskah Pengguna
  const cfg = enforceLockedConfig({
    faktaTerverifikasi:
      'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun.',
  });
  const activeScript = applyAutoEnforce(createValidTestSCTFScript(cfg.faktaTerverifikasi), cfg);
  const activeAudit = validateFullScript(activeScript, cfg);
  assert.equal(activeAudit.passed, true);

  const populatedBefore = captureProjectStateSnapshot({
    cleanScript: activeScript,
    blocks: activeScript.split('\n'),
    faktaTerverifikasi: cfg.faktaTerverifikasi,
    durasiMenit: cfg.durasiMenit,
    wpm: cfg.wpm,
    modeDurasi: cfg.modeDurasi,
    struktur: cfg.struktur,
    dashboardStatus: 'LULUS SEMUA KONTRAK V5.1',
  });

  const suiteRun2 = runIsolatedEdgeValidatorSuite();
  assert.equal(suiteRun2.allPassed, true);

  const populatedAfter = captureProjectStateSnapshot({
    cleanScript: activeScript,
    blocks: activeScript.split('\n'),
    faktaTerverifikasi: cfg.faktaTerverifikasi,
    durasiMenit: cfg.durasiMenit,
    wpm: cfg.wpm,
    modeDurasi: cfg.modeDurasi,
    struktur: cfg.struktur,
    dashboardStatus: 'LULUS SEMUA KONTRAK V5.1',
  });

  const proofPopulated = verifyProjectStateIsolation(populatedBefore, populatedAfter);
  assert.equal(proofPopulated.isolated, true);
  assert.deepEqual(populatedBefore, populatedAfter);
});

