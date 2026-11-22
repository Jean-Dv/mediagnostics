import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { DocumentType, type DocumentStatus } from '../../domain/document.js';

const documentStatuses: DocumentStatus[] = [
  'ANNULLED',
  'DRAFT',
  'FAILED',
  'PENDING',
  'PROCESSING',
  'PUBLISHED',
  'READY_TO_PUBLISH',
];

export class ListDocumentsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  public page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  public pageSize = 20;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  public search?: string;

  @IsIn(documentStatuses)
  @IsOptional()
  public status?: DocumentStatus;

  @IsIn(Object.values(DocumentType))
  @IsOptional()
  public type?: DocumentType;
}
