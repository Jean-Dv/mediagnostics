import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

import type { PasswordHasher } from '../domain/password-hasher.js';

const deriveKey = promisify(argon2);
const algorithm = 'argon2id';
const memory = 65_536;
const parallelism = 1;
const passes = 3;
const saltLength = 16;
const tagLength = 32;
const encodedHashPattern =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

@Injectable()
export class NodePasswordHasher implements PasswordHasher {
  public async hash(password: string): Promise<string> {
    const salt = randomBytes(saltLength);
    const hash = await this.derive(password, salt, memory, passes, parallelism, tagLength);

    return `$argon2id$v=19$m=${memory.toString()},t=${passes.toString()},p=${parallelism.toString()}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  }

  public async verify(encodedHash: string, password: string): Promise<boolean> {
    const match = encodedHashPattern.exec(encodedHash);
    if (match === null) {
      return false;
    }

    const [, encodedMemory, encodedPasses, encodedParallelism, encodedSalt, encodedTag] = match;
    if (
      encodedMemory === undefined ||
      encodedPasses === undefined ||
      encodedParallelism === undefined ||
      encodedSalt === undefined ||
      encodedTag === undefined
    ) {
      return false;
    }

    const expectedHash = Buffer.from(encodedTag, 'base64url');
    if (expectedHash.length === 0) {
      return false;
    }

    try {
      const actualHash = await this.derive(
        password,
        Buffer.from(encodedSalt, 'base64url'),
        Number(encodedMemory),
        Number(encodedPasses),
        Number(encodedParallelism),
        expectedHash.length,
      );

      return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
    } catch {
      return false;
    }
  }

  private async derive(
    password: string,
    salt: Buffer,
    hashMemory: number,
    hashPasses: number,
    hashParallelism: number,
    hashTagLength: number,
  ): Promise<Buffer> {
    const result = await deriveKey(algorithm, {
      memory: hashMemory,
      message: password,
      nonce: salt,
      parallelism: hashParallelism,
      passes: hashPasses,
      tagLength: hashTagLength,
    });

    return Buffer.from(result);
  }
}
