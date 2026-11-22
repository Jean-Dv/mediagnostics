import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateDocumentRecord,
  CreateDocumentOutcome,
  DeleteDocumentResult,
  DocumentAccessRecord,
  DocumentPage,
  DocumentRepository,
  ListDocumentsInput,
  ManagedDocument,
  PatientOption,
  RetryDocumentResult,
} from '../application/document.repository.js';
import { DocumentType } from '../domain/document.js';

const documentInclude = {
  patient: true,
  replacedBy: {
    select: { documentDate: true, id: true, status: true, title: true },
  },
} satisfies Prisma.DocumentInclude;

type DocumentWithPatient = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public annul(
    documentId: string,
    annulledById: string,
    annulmentReason: string,
    annulledAt: Date,
  ): Promise<ManagedDocument | null> {
    return this.prisma.$transaction(async (transaction) => {
      const transitioned = await transaction.document.updateMany({
        data: { annulledAt, annulledById, annulmentReason, status: 'ANNULLED' },
        where: { id: documentId, status: 'PUBLISHED' },
      });
      if (transitioned.count === 0) return null;
      const document = await transaction.document.findUniqueOrThrow({
        include: documentInclude,
        where: { id: documentId },
      });
      await transaction.notification.create({
        data: {
          documentId,
          type: 'DOCUMENT_ANNULLED',
          userId: document.patientId,
        },
      });
      return this.toManagedDocument(document);
    });
  }

  public create(input: CreateDocumentRecord): Promise<CreateDocumentOutcome> {
    return this.prisma.$transaction(async (transaction) => {
      const replacesId = input.replacesId ?? null;
      if (replacesId !== null) {
        const replacementCandidate = await transaction.document.findFirst({
          select: { id: true },
          where: {
            id: replacesId,
            patientId: input.patientId,
            replacedBy: { is: null },
            status: 'ANNULLED',
            type: input.type,
          },
        });
        if (replacementCandidate === null) return { kind: 'INVALID_REPLACEMENT' };
      }
      const document = await transaction.document.create({
        data: {
          description: input.description,
          documentDate: input.documentDate,
          examType: input.examType,
          fileSizeBytes: input.fileSizeBytes,
          id: input.id,
          originalObjectKey: input.originalObjectKey,
          patientId: input.patientId,
          procedureName: input.procedureName,
          replacesId,
          status: input.queueForProcessing ? 'PENDING' : 'DRAFT',
          title: input.title,
          type: input.type,
          uploadedById: input.uploadedById,
        },
        include: documentInclude,
      });
      const processingJob = input.queueForProcessing
        ? await transaction.processingJob.create({
            data: { documentId: document.id },
          })
        : null;

      return {
        document: this.toManagedDocument(document),
        kind: 'CREATED',
        processingJobId: processingJob?.id ?? null,
      };
    });
  }

  public deleteRecoverable(documentId: string): Promise<DeleteDocumentResult> {
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.document.findUnique({
        select: {
          originalObjectKey: true,
          previewObjectKey: true,
          protectedObjectKey: true,
          status: true,
        },
        where: { id: documentId },
      });
      if (document === null) return { kind: 'NOT_FOUND' };
      if (!['DRAFT', 'FAILED'].includes(document.status)) return { kind: 'INVALID_STATUS' };

      const claimed = await transaction.document.updateMany({
        data: { status: 'ANNULLED' },
        where: { id: documentId, status: { in: ['DRAFT', 'FAILED'] } },
      });
      if (claimed.count === 0) return { kind: 'INVALID_STATUS' };
      await transaction.processingJob.deleteMany({ where: { documentId } });
      await transaction.notification.deleteMany({ where: { documentId } });
      await transaction.document.delete({ where: { id: documentId } });

      return {
        kind: 'DELETED',
        objectKeys: [
          document.originalObjectKey,
          document.protectedObjectKey,
          document.previewObjectKey,
        ].filter((key): key is string => key !== null),
      };
    });
  }

  public async findActivePatientById(patientId: string): Promise<PatientOption | null> {
    const patient = await this.prisma.user.findFirst({
      where: { id: patientId, role: 'PATIENT', status: 'ACTIVE' },
      select: { clinicalCode: true, email: true, fullName: true, id: true },
    });
    return patient?.clinicalCode === null || patient?.clinicalCode === undefined
      ? null
      : { ...patient, clinicalCode: patient.clinicalCode };
  }

  public async findAccessById(documentId: string): Promise<DocumentAccessRecord | null> {
    const document = await this.prisma.document.findUnique({
      select: {
        id: true,
        passwordAuthTag: true,
        passwordCiphertext: true,
        passwordInitialization: true,
        patientId: true,
        previewObjectKey: true,
        protectedObjectKey: true,
        status: true,
        title: true,
      },
      where: { id: documentId },
    });
    return document;
  }

  public async findById(documentId: string): Promise<ManagedDocument | null> {
    const document = await this.prisma.document.findUnique({
      include: documentInclude,
      where: { id: documentId },
    });
    return document === null ? null : this.toManagedDocument(document);
  }

  public async findReplacementCandidates(
    patientId: string,
    type: DocumentType,
  ): Promise<ManagedDocument[]> {
    const documents = await this.prisma.document.findMany({
      include: documentInclude,
      orderBy: [{ annulledAt: 'desc' }, { id: 'desc' }],
      take: 50,
      where: {
        patientId,
        replacedBy: { is: null },
        status: 'ANNULLED',
        type,
      },
    });
    return documents.map((document) => this.toManagedDocument(document));
  }

  public markQueueFailed(
    documentId: string,
    processingJobId: string,
    message: string,
  ): Promise<ManagedDocument> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.processingJob.update({
        data: {
          completedAt: new Date(),
          errorCode: 'QUEUE_UNAVAILABLE',
          errorMessage: message.slice(0, 1000),
          status: 'FAILED',
        },
        where: { id: processingJobId },
      });
      const document = await transaction.document.update({
        data: { status: 'FAILED' },
        include: documentInclude,
        where: { id: documentId },
      });
      return this.toManagedDocument(document);
    });
  }

  public async list(input: ListDocumentsInput): Promise<DocumentPage> {
    const where: Prisma.DocumentWhereInput = {
      ...(input.patientId === undefined ? {} : { patientId: input.patientId }),
      ...(input.patientHistoryOnly === true ? { status: { in: ['ANNULLED', 'PUBLISHED'] } } : {}),
      ...(input.patientHistoryOnly === true || input.status === undefined
        ? {}
        : { status: input.status }),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.search === undefined
        ? {}
        : {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { examType: { contains: input.search, mode: 'insensitive' } },
              { procedureName: { contains: input.search, mode: 'insensitive' } },
              { patient: { fullName: { contains: input.search, mode: 'insensitive' } } },
              { patient: { clinicalCode: { contains: input.search, mode: 'insensitive' } } },
            ],
          }),
    };
    const [documents, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        include: documentInclude,
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where,
      }),
      this.prisma.document.count({ where }),
    ]);
    return {
      items: documents.map((document) => this.toManagedDocument(document)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  public publish(documentId: string, publishedAt: Date): Promise<ManagedDocument | null> {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.document.updateMany({
        data: { publishedAt, status: 'PUBLISHED' },
        where: { id: documentId, status: 'READY_TO_PUBLISH' },
      });
      if (result.count === 0) return null;
      const document = await transaction.document.findUniqueOrThrow({
        include: documentInclude,
        where: { id: documentId },
      });
      await transaction.notification.create({
        data: {
          documentId,
          type: document.replacesId === null ? 'DOCUMENT_PUBLISHED' : 'DOCUMENT_REPLACED',
          userId: document.patientId,
        },
      });
      return this.toManagedDocument(document);
    });
  }

  public retry(documentId: string, maximumManualRetries: number): Promise<RetryDocumentResult> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.document.findUnique({
        include: { _count: { select: { processingJobs: true } } },
        where: { id: documentId },
      });
      if (existing === null) return { kind: 'NOT_FOUND' };
      if (existing.status !== 'FAILED') return { kind: 'INVALID_STATUS' };

      const manualRetryCount = Math.max(0, existing._count.processingJobs - 1);
      if (manualRetryCount >= maximumManualRetries) return { kind: 'LIMIT_REACHED' };

      const transitioned = await transaction.document.updateMany({
        data: {
          pageCount: null,
          passwordAuthTag: null,
          passwordCiphertext: null,
          passwordInitialization: null,
          previewObjectKey: null,
          protectedObjectKey: null,
          sha256: null,
          status: 'PENDING',
        },
        where: { id: documentId, status: 'FAILED' },
      });
      if (transitioned.count === 0) return { kind: 'INVALID_STATUS' };

      const processingJob = await transaction.processingJob.create({
        data: { documentId },
      });
      const document = await transaction.document.findUniqueOrThrow({
        include: documentInclude,
        where: { id: documentId },
      });
      return {
        document: this.toManagedDocument(document),
        kind: 'CREATED',
        processingJobId: processingJob.id,
      };
    });
  }

  public async searchActivePatients(search: string): Promise<PatientOption[]> {
    const patients = await this.prisma.user.findMany({
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: { clinicalCode: true, email: true, fullName: true, id: true },
      take: 10,
      where: {
        role: 'PATIENT',
        status: 'ACTIVE',
        OR: [
          { clinicalCode: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ],
      },
    });
    return patients.flatMap((patient) =>
      patient.clinicalCode === null ? [] : [{ ...patient, clinicalCode: patient.clinicalCode }],
    );
  }

  private toManagedDocument(document: DocumentWithPatient): ManagedDocument {
    if (document.patient.clinicalCode === null) {
      throw new Error('A document patient must have a clinical code.');
    }
    return {
      annulledAt: document.annulledAt,
      annulmentReason: document.annulmentReason,
      createdAt: document.createdAt,
      description: document.description,
      documentDate: document.documentDate,
      examType: document.examType,
      fileSizeBytes: document.fileSizeBytes,
      id: document.id,
      pageCount: document.pageCount,
      patient: {
        clinicalCode: document.patient.clinicalCode,
        email: document.patient.email,
        fullName: document.patient.fullName,
        id: document.patient.id,
      },
      procedureName: document.procedureName,
      publishedAt: document.publishedAt,
      replacement:
        document.replacedBy === null
          ? null
          : {
              documentDate: document.replacedBy.documentDate,
              id: document.replacedBy.id,
              status: document.replacedBy.status,
              title: document.replacedBy.title,
            },
      status: document.status,
      title: document.title,
      type: this.toDocumentType(document.type),
    };
  }

  private toDocumentType(type: string): DocumentType {
    if (type === 'LAB_RESULT') {
      return DocumentType.LabResult;
    }
    if (type === 'INFORMED_CONSENT') {
      return DocumentType.InformedConsent;
    }
    throw new Error(`Unsupported document type: ${type}`);
  }
}
