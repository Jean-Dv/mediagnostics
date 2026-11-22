import { randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import type { CredentialGenerator } from '../domain/credential-generator.js';

const clinicalCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clinicalCodeRandomLength = 6;

@Injectable()
export class NodeCredentialGenerator implements CredentialGenerator {
  public generateClinicalCode(): string {
    let randomPart = '';
    for (let index = 0; index < clinicalCodeRandomLength; index += 1) {
      randomPart += clinicalCodeAlphabet.charAt(randomInt(clinicalCodeAlphabet.length));
    }

    return `PAT-${new Date().getUTCFullYear().toString()}-${randomPart}`;
  }

  public generateTemporaryPassword(): string {
    return randomBytes(15).toString('base64url');
  }
}
