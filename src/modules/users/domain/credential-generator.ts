export const CREDENTIAL_GENERATOR = Symbol('CREDENTIAL_GENERATOR');

export interface CredentialGenerator {
  generateClinicalCode(): string;
  generateTemporaryPassword(): string;
}
