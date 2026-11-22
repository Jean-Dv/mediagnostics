import { describe, expect, it } from 'vitest';

import { NodePasswordHasher } from './node-password-hasher.js';

describe('NodePasswordHasher', () => {
  const hasher = new NodePasswordHasher();

  it('hashes and verifies a password with Argon2id', async () => {
    const hash = await hasher.hash('a sufficiently long passphrase');

    expect(hash).toMatch(/^\$argon2id\$v=19\$/);
    await expect(hasher.verify(hash, 'a sufficiently long passphrase')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'a different passphrase')).resolves.toBe(false);
  });

  it('rejects malformed hashes without throwing', async () => {
    await expect(hasher.verify('not-a-valid-hash', 'a sufficiently long passphrase')).resolves.toBe(
      false,
    );
  });
});
