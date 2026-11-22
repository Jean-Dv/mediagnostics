import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { AuthenticatedPrincipal } from '../../../common/types/authenticated-principal.js';
import type { RequestContext } from '../../../common/types/request-context.js';
import { Permission } from '../../access-control/domain/access-control.js';
import { RequirePermissions } from '../../access-control/presentation/access-control.decorators.js';
import {
  DocumentsService,
  maximumPdfSizeBytes,
  type DocumentActionContext,
  type UploadedPdf,
} from '../application/documents.service.js';
import type {
  DocumentPage,
  ManagedDocument,
  PatientOption,
} from '../application/document.repository.js';
import { AnnulDocumentDto } from './dto/annul-document.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import {
  DocumentPageDto,
  DocumentPasswordDto,
  DocumentSummaryDto,
  PatientOptionDto,
} from './dto/document-response.dto.js';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';
import { ReplacementCandidatesQueryDto } from './dto/replacement-candidates-query.dto.js';
import { SearchPatientsQueryDto } from './dto/search-patients-query.dto.js';

@ApiTags('documents')
@ApiCookieAuth('mediagnostics.sid')
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  public constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOkResponse({ type: DocumentPageDto })
  public async list(
    @Query() query: ListDocumentsQueryDto,
    @Req() request: Request,
  ): Promise<DocumentPageDto> {
    return this.toDocumentPage(await this.documentsService.list(query, this.getPrincipal(request)));
  }

  @Get('patients')
  @RequirePermissions(Permission.DocumentCreate)
  @ApiOkResponse({ isArray: true, type: PatientOptionDto })
  public async searchPatients(@Query() query: SearchPatientsQueryDto): Promise<PatientOptionDto[]> {
    const patients = await this.documentsService.searchPatients(query.search);
    return patients.map((patient) => this.toPatientResponse(patient));
  }

  @Get('replacement-candidates')
  @RequirePermissions(Permission.DocumentCreate)
  @ApiOkResponse({ isArray: true, type: DocumentSummaryDto })
  public async findReplacementCandidates(
    @Query() query: ReplacementCandidatesQueryDto,
  ): Promise<DocumentSummaryDto[]> {
    const documents = await this.documentsService.findReplacementCandidates(
      query.patientId,
      query.type,
    );
    return documents.map((document) => this.toDocumentResponse(document));
  }

  @Get(':id')
  @ApiOkResponse({ type: DocumentSummaryDto })
  public async getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
  ): Promise<DocumentSummaryDto> {
    return this.toDocumentResponse(
      await this.documentsService.getById(documentId, this.getPrincipal(request)),
    );
  }

  @Get(':id/preview')
  @ApiProduces('image/webp')
  public async preview(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const asset = await this.documentsService.getPreview(
      documentId,
      this.getPrincipal(request),
      this.getRequestContext(request),
    );
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${asset.filename}"`,
      'Content-Length': asset.body.length.toString(),
      'Content-Type': 'image/webp',
    });
    return new StreamableFile(asset.body);
  }

  @Get(':id/download')
  @ApiProduces('application/pdf')
  public async download(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const asset = await this.documentsService.download(
      documentId,
      this.getPrincipal(request),
      this.getRequestContext(request),
    );
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${asset.filename}"`,
      'Content-Length': asset.body.length.toString(),
      'Content-Type': 'application/pdf',
    });
    return new StreamableFile(asset.body);
  }

  @Get(':id/password')
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: DocumentPasswordDto })
  public async revealPassword(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
  ): Promise<DocumentPasswordDto> {
    return {
      password: await this.documentsService.revealPassword(
        documentId,
        this.getPrincipal(request),
        this.getRequestContext(request),
      ),
    };
  }

  @Post(':id/password-copy')
  @HttpCode(204)
  @ApiNoContentResponse()
  public async recordPasswordCopy(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.documentsService.recordPasswordCopy(
      documentId,
      this.getPrincipal(request),
      this.getRequestContext(request),
    );
  }

  @Post(':id/publish')
  @RequirePermissions(Permission.DocumentPublish)
  @ApiOkResponse({ type: DocumentSummaryDto })
  public async publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
  ): Promise<DocumentSummaryDto> {
    return this.toDocumentResponse(
      await this.documentsService.publish(documentId, this.getActionContext(request)),
    );
  }

  @Post(':id/annul')
  @RequirePermissions(Permission.DocumentAnnul)
  @ApiOkResponse({ type: DocumentSummaryDto })
  public async annul(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Body() body: AnnulDocumentDto,
    @Req() request: Request,
  ): Promise<DocumentSummaryDto> {
    return this.toDocumentResponse(
      await this.documentsService.annul(documentId, body.reason, this.getActionContext(request)),
    );
  }

  @Post(':id/retry')
  @RequirePermissions(Permission.ProcessingJobRetry)
  @ApiOkResponse({ type: DocumentSummaryDto })
  public async retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
  ): Promise<DocumentSummaryDto> {
    return this.toDocumentResponse(
      await this.documentsService.retry(documentId, this.getActionContext(request)),
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.DocumentDeleteRecoverable)
  @HttpCode(204)
  @ApiNoContentResponse()
  public async deleteRecoverable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.documentsService.deleteRecoverable(documentId, this.getActionContext(request));
  }

  @Post()
  @RequirePermissions(Permission.DocumentCreate)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maximumPdfSizeBytes } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateDocumentDto })
  @ApiCreatedResponse({ type: DocumentSummaryDto })
  public async create(
    @Body() body: CreateDocumentDto,
    @UploadedFile() file: UploadedPdf | undefined,
    @Req() request: Request,
  ): Promise<DocumentSummaryDto> {
    const document = await this.documentsService.create(body, file, this.getActionContext(request));
    return this.toDocumentResponse(document);
  }

  private getActionContext(request: Request): DocumentActionContext {
    const principal = this.getPrincipal(request);
    return { actorId: principal.id, ...this.getRequestContext(request) };
  }

  private getPrincipal(request: Request): AuthenticatedPrincipal {
    const principal = request.user;
    if (principal === undefined) throw new UnauthorizedException('Authentication is required.');
    return principal;
  }

  private getRequestContext(request: Request): RequestContext {
    return {
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
    };
  }

  private toDocumentResponse(document: ManagedDocument): DocumentSummaryDto {
    return {
      annulledAt: document.annulledAt?.toISOString() ?? null,
      annulmentReason: document.annulmentReason,
      createdAt: document.createdAt.toISOString(),
      description: document.description,
      documentDate: document.documentDate.toISOString(),
      examType: document.examType,
      fileSizeBytes: document.fileSizeBytes,
      id: document.id,
      pageCount: document.pageCount,
      patient: this.toPatientResponse(document.patient),
      procedureName: document.procedureName,
      publishedAt: document.publishedAt?.toISOString() ?? null,
      replacement:
        document.replacement === null
          ? null
          : {
              documentDate: document.replacement.documentDate.toISOString(),
              id: document.replacement.id,
              status: document.replacement.status,
              title: document.replacement.title,
            },
      status: document.status,
      title: document.title,
      type: document.type,
    };
  }

  private toDocumentPage(page: DocumentPage): DocumentPageDto {
    return { ...page, items: page.items.map((document) => this.toDocumentResponse(document)) };
  }

  private toPatientResponse(patient: PatientOption): PatientOptionDto {
    return { ...patient };
  }
}
