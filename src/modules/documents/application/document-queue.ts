export const DOCUMENT_QUEUE = Symbol('DOCUMENT_QUEUE');
export const documentQueueName = 'document-processing';
export const processDocumentJobName = 'process-document';

export interface ProcessDocumentJobData {
  documentId: string;
  processingJobId: string;
}

export interface DocumentQueue {
  enqueue(data: ProcessDocumentJobData): Promise<void>;
}
