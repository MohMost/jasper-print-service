import { IsIn, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export type JasperExportFormat = 'pdf' | 'xlsx' | 'docx' | 'html';

export class PrintReportDto {
  @IsString()
  @Matches(/^\/[^?#]*$/, {
    message: 'reportUri must start with / and must not contain query string fragments',
  })
  reportUri!: string;

  @IsOptional()
  @IsIn(['pdf', 'xlsx', 'docx', 'html'])
  format: JasperExportFormat = 'pdf';

  @IsOptional()
  @IsObject()
  parameters?: Record<string, string | number | boolean | null>;
}
