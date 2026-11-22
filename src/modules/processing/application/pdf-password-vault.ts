export const PDF_PASSWORD_VAULT = Symbol('PDF_PASSWORD_VAULT');
export const PDF_ENCRYPTION_KEY = Symbol('PDF_ENCRYPTION_KEY');

export interface ProtectedPassword {
  authTag: string;
  ciphertext: string;
  initialization: string;
}

export interface PdfPasswordVault {
  protect(password: string): ProtectedPassword;
  unprotect(password: ProtectedPassword): string;
}
