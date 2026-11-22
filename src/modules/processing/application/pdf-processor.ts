export const PDF_PROCESSOR = Symbol('PDF_PROCESSOR');

export interface ProcessedPdf {
  pageCount: number;
  preview: Buffer;
  protectedPdf: Buffer;
  sha256: string;
}

export interface PdfProcessor {
  process(originalPdf: Buffer, password: string): Promise<ProcessedPdf>;
}

export class PermanentProcessingError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PermanentProcessingError';
  }
}
