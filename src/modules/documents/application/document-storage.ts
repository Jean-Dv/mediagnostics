export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface StoreObjectInput {
  body: Buffer;
  contentType: 'application/pdf' | 'image/webp';
  key: string;
}

export interface DocumentStorage {
  delete(key: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  store(input: StoreObjectInput): Promise<void>;
}
