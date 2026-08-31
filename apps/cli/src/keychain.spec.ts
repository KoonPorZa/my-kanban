import { describe, expect, it } from 'vitest';

import { keychainPasswordInput } from './keychain.js';

describe('macOS Keychain password input', () => {
  it('answers both new-item password prompts without placing the secret in arguments', () => {
    expect(keychainPasswordInput('secret-token')).toBe('secret-token\nsecret-token\n');
  });
});
