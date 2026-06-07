import { IsIn, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export type JasperExportFormat = 'pdf' | 'xlsx' | 'docx' | 'html';

export class PrintReportDto {
  @IsString()
  @Matches(/^[^/\\]+\.(jrxml|jasper)$/i, {
    message: 'reportName must be a .jrxml or .jasper file name without path separators',
  })
  reportName!: string;

  @IsOptional()
  @IsIn(['pdf', 'xlsx', 'docx', 'html'])
  format: JasperExportFormat = 'pdf';

  @IsObject()
  data!: Record<string, any>;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, string | number | boolean | null>;
}
