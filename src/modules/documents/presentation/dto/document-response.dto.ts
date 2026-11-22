import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DocumentType } from '../../domain/document.js';

export class PatientOptionDto {
  @ApiProperty()
  public clinicalCode!: string;

  @ApiProperty({ format: 'email' })
  public email!: string;

  @ApiProperty()
  public fullName!: string;

  @ApiProperty({ format: 'uuid' })
  public id!: string;
}

export class ReplacementReferenceDto {
  @ApiProperty({ format: 'date-time' })
  public documentDate!: string;

  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ enum: ['PUBLISHED'] })
  public status!: string;

  @ApiProperty()
  public title!: string;
}

export class DocumentSummaryDto {
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  public annulledAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  public annulmentReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  public description!: string | null;

  @ApiProperty({ format: 'date-time' })
  public documentDate!: string;

  @ApiPropertyOptional({ nullable: true })
  public examType!: string | null;

  @ApiProperty()
  public fileSizeBytes!: number;

  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiPropertyOptional({ nullable: true })
  public pageCount!: number | null;

  @ApiProperty({ type: PatientOptionDto })
  public patient!: PatientOptionDto;

  @ApiPropertyOptional({ nullable: true })
  public procedureName!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  public publishedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: ReplacementReferenceDto })
  public replacement!: ReplacementReferenceDto | null;

  @ApiProperty({
    enum: ['ANNULLED', 'DRAFT', 'FAILED', 'PENDING', 'PROCESSING', 'PUBLISHED', 'READY_TO_PUBLISH'],
  })
  public status!: string;

  @ApiProperty()
  public title!: string;

  @ApiProperty({ enum: DocumentType })
  public type!: DocumentType;
}

export class DocumentPageDto {
  @ApiProperty({ isArray: true, type: DocumentSummaryDto })
  public items!: DocumentSummaryDto[];

  @ApiProperty()
  public page!: number;

  @ApiProperty()
  public pageSize!: number;

  @ApiProperty()
  public total!: number;

  @ApiProperty()
  public totalPages!: number;
}

export class DocumentPasswordDto {
  @ApiProperty()
  public password!: string;
}
