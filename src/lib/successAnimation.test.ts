import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSoundNotificationPreference,
  setSoundNotificationPreference,
  playGenerationSuccessSound,
  playFireworkBurstSound,
} from './soundNotification';

test('soundNotification: handles sound preferences and triggers sound functions safely', async () => {
  // Mock simple localStorage if running in node environment
  const mockStorage: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    },
  };

  // 1. Default sound preference is true
  setSoundNotificationPreference(true);
  assert.equal(getSoundNotificationPreference(), true);

  // 2. Toggling sound preference to false
  setSoundNotificationPreference(false);
  assert.equal(getSoundNotificationPreference(), false);

  // 3. Sound functions return or complete safely without throwing in Node environment
  const result = await playGenerationSuccessSound(false);
  assert.equal(result, false);

  assert.doesNotThrow(() => {
    playFireworkBurstSound(false);
  });
});

