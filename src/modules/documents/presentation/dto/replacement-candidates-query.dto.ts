import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

import { DocumentType } from '../../domain/document.js';

export class ReplacementCandidatesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  public patientId!: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  public type!: DocumentType;
}
