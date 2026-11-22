import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { NodePdfPasswordVault } from './node-pdf-password.vault.js';

describe('NodePdfPasswordVault', () => {
  it('encrypts and decrypts a generated PDF password', () => {
    const vault = new NodePdfPasswordVault(randomBytes(32));
    const protectedPassword = vault.protect('AbCdEfGh23456789');

    expect(protectedPassword.ciphertext).not.toContain('AbCdEfGh23456789');
    expect(vault.unprotect(protectedPassword)).toBe('AbCdEfGh23456789');
  });

  it('cannot decrypt with a different key', () => {
    const protectedPassword = new NodePdfPasswordVault(randomBytes(32)).protect('AbCdEfGh23456789');

    expect(() => new NodePdfPasswordVault(randomBytes(32)).unprotect(protectedPassword)).toThrow();
  });
});
