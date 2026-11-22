import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { DocumentType, UploadAction } from '../../domain/document.js';

export class CreateDocumentDto {
  @ApiProperty({ enum: UploadAction })
  @IsEnum(UploadAction)
  public action!: UploadAction;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public description?: string;

  @ApiProperty({ example: '2026-11-21', format: 'date' })
  @IsDateString({ strict: true })
  public documentDate!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf((value: CreateDocumentDto) => value.type === DocumentType.LabResult)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public examType?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  public patientId!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf((value: CreateDocumentDto) => value.type === DocumentType.InformedConsent)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public procedureName?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  public replacesId?: string;

  @ApiProperty({ maxLength: 200, minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  public title!: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  public type!: DocumentType;
}
