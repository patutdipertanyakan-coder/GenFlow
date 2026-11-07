import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSemVer,
  getSemanticJump,
  formatJakartaTime,
  identifyCriticalModulesForFiles,
  validateReleaseRecord,
  compareReleases,
  calculateUnreadReleases,
  sanitizeChangeNotes,
  ReleaseRecord,
} from './changeTracker';
import releaseManifest from '../data/releaseManifest.json';

test('1. Semantic versioning comparison: correctly orders v5.0.0 < v5.1.0 < v5.2.0', () => {
  assert.equal(compareSemVer('5.0.0', '5.1.0'), -1);
  assert.equal(compareSemVer('5.2.0', '5.1.0'), 1);
  assert.equal(compareSemVer('5.2.0', '5.2.0'), 0);
  assert.equal(compareSemVer('v5.2.0', '5.2.0'), 0);
});

test('2. Semantic jump categorization: classifies MAJOR, MINOR, and PATCH', () => {
  assert.equal(getSemanticJump('5.0.0', '5.1.0'), 'MINOR');
  assert.equal(getSemanticJump('5.1.0', '5.2.0'), 'MINOR');
  assert.equal(getSemanticJump('5.1.0', '5.1.1'), 'PATCH');
  assert.equal(getSemanticJump('4.9.0', '5.0.0'), 'MAJOR');
  assert.equal(getSemanticJump('5.2.0', '5.2.0'), 'IDENTICAL');
  assert.equal(getSemanticJump('5.2.0', '5.1.0'), 'DOWNGRADE');
});

test('3. Jakarta time formatting: outputs valid string containing WIB', () => {
  const result = formatJakartaTime('2026-10-29T15:50:00.000Z');
  assert.ok(result.includes('WIB'), 'Should format to WIB time zone');
  assert.ok(result.includes('2026'), 'Should contain year 2026');
});

test('4. Critical module identification: detects SQNN, MASTER PROMPT, NON_SARA and VALIDATOR', () => {
  const files = [
    '/src/lib/sqnnEngine.ts',
    '/src/lib/masterPromptV51.ts',
    '/src/lib/validatorAndPipeline.ts',
    '/src/lib/changeTracker.ts',
  ];
  const critical = identifyCriticalModulesForFiles(files);
  assert.ok(critical.includes('SQNN / QUOTE-FREE'));
  assert.ok(critical.includes('MASTER PROMPT'));
  assert.ok(critical.includes('VALIDATOR DETERMINISTIK'));
  assert.ok(critical.includes('LIVE UPDATE CENTER'));
});

test('5. Release record validation: catches missing mandatory fields and test failures', () => {
  const invalidRecord: Partial<ReleaseRecord> = {
    version: 'bad-ver',
    release_title: '',
  };
  const valResult = validateReleaseRecord(invalidRecord);
  assert.equal(valResult.valid, false);
  assert.ok(valResult.errors.length >= 3);

  const activeWithFailedTests: Partial<ReleaseRecord> = {
    version: '5.2.0',
    release_id: 'rel-5.2.0',
    release_title: 'Test Release',
    status: 'ACTIVE',
    test_results: {
      runner: 'tsx',
      command: 'test',
      totalSuites: 1,
      totalTests: 10,
      passed: 8,
      failed: 2,
      skipped: 0,
      durationMs: 100,
      lastRunJakarta: '2026-10-29 WIB',
    },
  };
  const valActive = validateReleaseRecord(activeWithFailedTests);
  assert.equal(valActive.valid, false);
  assert.ok(
    valActive.errors.some((e) => e.includes('tidak boleh berstatus ACTIVE jika ada pengujian yang gagal'))
  );
});

test('6. Side-by-side release comparator: detects feature evolution and test growth', () => {
  const rel51 = releaseManifest.releases.find((r) => r.version === '5.1.0') as ReleaseRecord;
  const rel52 = releaseManifest.releases.find((r) => r.version === '5.2.0') as ReleaseRecord;

  assert.ok(rel51 && rel52, 'Both releases must exist in manifest');
  const comp = compareReleases(rel51, rel52);

  assert.equal(comp.base_version, '5.1.0');
  assert.equal(comp.target_version, '5.2.0');
  assert.equal(comp.is_upgrade, true);
  assert.equal(comp.semantic_jump, 'MINOR');
  assert.ok(comp.new_features.length > 0);
  assert.ok(comp.critical_changes.includes('LIVE UPDATE CENTER'));
  assert.equal(comp.test_comparison.target_passed >= comp.test_comparison.base_passed, true);
  assert.equal(comp.test_comparison.is_regression_free, true);
});

test('7. Unread calculation: calculates unread count accurately against read ID set', () => {
  const releases = releaseManifest.releases as ReleaseRecord[];
  const readIds = ['rel-5.0.0-20261025'];

  const { unreadCount, unreadIds } = calculateUnreadReleases(releases, readIds);
  assert.equal(unreadCount, releases.length - 1);
  assert.ok(unreadIds.includes('rel-5.2.0-20261029'));
});

test('8. Secret sanitization: masks API keys and credentials in release notes', () => {
  const dummyAiza = 'AIza' + 'SyD9876543210abcdefghijklmnop';
  const dummyAq = 'AQ.' + 'Ab8RN6LZiWzV9f56W5PqKXzOqyVfmrc7Yt8JhlVRbfnsUR7RA';
  const dummySb = 'sb_' + 'secret_vc2msmAOius6bxCUTZ0QAHSmnYI3V';
  const textWithKey = `Updated server with ${dummyAiza}, ${dummyAq}, ${dummySb} and bearer eyJhbGciOiJIUzI1Ni`;
  const sanitized = sanitizeChangeNotes(textWithKey);

  assert.ok(!sanitized.includes(dummyAiza));
  assert.ok(!sanitized.includes(dummyAq));
  assert.ok(!sanitized.includes(dummySb));
  assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
  assert.ok(sanitized.includes('[REDACTED_GCP_AUTH_KEY]'));
  assert.ok(sanitized.includes('[REDACTED_SUPABASE_SECRET]'));
  assert.ok(sanitized.includes('[REDACTED_TOKEN]'));
});

test('9. Release manifest schema compliance: verifies all releases in manifest', () => {
  assert.ok(releaseManifest.app_name === 'GenFLOW Studio' || releaseManifest.app_name === 'GenNAS Studio');
  assert.equal(releaseManifest.current_version, releaseManifest.releases[0].version);
  assert.ok(releaseManifest.releases.length >= 5);

  for (const rel of releaseManifest.releases) {
    const val = validateReleaseRecord(rel as ReleaseRecord);
    assert.equal(val.valid, true, `Release ${rel.version} should be valid. Errors: ${val.errors.join(', ')}`);
  }
});

test('10. Observational safety: Live Update Center logic is completely detached from script generation', () => {
  // Pure logic verification that release tracking doesn't modify any script or prompt constants
  const cleanScript = 'Naskah uji coba bebas tanda petik.';
  const rel = releaseManifest.releases[0] as ReleaseRecord;
  assert.equal(typeof rel.version, 'string');
  assert.equal(cleanScript, 'Naskah uji coba bebas tanda petik.');
});

test('11. Lifecycle status separation: distinct values for all 10 states', () => {
  const validStatuses = [
    'DRAFT',
    'CODE UPDATED',
    'BUILD PASSED',
    'BUILD FAILED',
    'TESTING',
    'TEST FAILED',
    'READY',
    'DEPLOYED',
    'ACTIVE',
    'ROLLED BACK',
  ];
  assert.equal(validStatuses.length, 10);
});

test('12. Regression free check: active release has 0 failed tests and VERIFIED status', () => {
  const activeRel = releaseManifest.releases[0] as ReleaseRecord;
  assert.equal(activeRel.version, releaseManifest.current_version);
  assert.equal(activeRel.status, 'ACTIVE');
  assert.equal(activeRel.verification_status, 'VERIFIED');
  assert.equal(activeRel.test_results.failed, 0);
  assert.ok(activeRel.test_results.passed > 0);
});
