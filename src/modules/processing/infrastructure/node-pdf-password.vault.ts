import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  PDF_ENCRYPTION_KEY,
  type PdfPasswordVault,
  type ProtectedPassword,
} from '../application/pdf-password-vault.js';

@Injectable()
export class NodePdfPasswordVault implements PdfPasswordVault {
  private readonly key: Buffer;

  public constructor(@Inject(PDF_ENCRYPTION_KEY) key: Buffer) {
    this.key = key;
  }

  public protect(password: string): ProtectedPassword {
    const initialization = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, initialization);
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return {
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      initialization: initialization.toString('base64'),
    };
  }

  public unprotect(password: ProtectedPassword): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(password.initialization, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(password.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(password.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
