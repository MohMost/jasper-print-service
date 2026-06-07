import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { JasperExportFormat, PrintReportDto } from './dto/print-report.dto';

export interface GeneratedReport {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

interface JasperExportPayload {
  reportUnit: string;
  outputFormat: JasperExportFormat;
  parameters: Record<string, string | number | boolean | null>;
  dataSource: {
    type: 'json';
    data: Record<string, any>;
  };
}

const CONTENT_TYPES: Record<JasperExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html; charset=utf-8',
};

@Injectable()
export class PrintService {
  private readonly timeoutMs = 120_000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async generateReport(tenantId: string, dto: PrintReportDto): Promise<GeneratedReport> {
    const normalizedTenantId = tenantId?.trim();

    if (!normalizedTenantId) {
      throw new BadRequestException('tenantId is required');
    }

    const baseUrl = this.configService.get<string>('JASPER_IO_URL')?.replace(/\/+$/, '');

    if (!baseUrl) {
      throw new InternalServerErrorException('JASPER_IO_URL is not configured');
    }

    const format = dto.format ?? 'pdf';
    const exportUrl = `${baseUrl}/rest_v2/export`;
    const reportUnit = `repo:tenants/${normalizedTenantId}/${dto.reportName}`;
    const payload: JasperExportPayload = {
      reportUnit,
      outputFormat: format,
      parameters: dto.parameters ?? {},
      dataSource: {
        type: 'json',
        data: dto.data,
      },
    };

    const apiKey = this.configService.get<string>('JASPER_IO_API_KEY');
    const headers: Record<string, string> = {
      Accept: CONTENT_TYPES[format],
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<ArrayBuffer>(exportUrl, payload, {
          headers,
          responseType: 'arraybuffer',
          timeout: this.timeoutMs,
        }),
      );

      const contentTypeHeader = response.headers['content-type'];

      return {
        buffer: this.toBuffer(response),
        contentType: typeof contentTypeHeader === 'string' ? contentTypeHeader : CONTENT_TYPES[format],
        fileName: this.buildFileName(dto.reportName, format),
      };
    } catch (error: unknown) {
      this.handleJasperError(error);
    }
  }

  private toBuffer(response: AxiosResponse<ArrayBuffer>): Buffer {
    return Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
  }

  private buildFileName(reportName: string, format: JasperExportFormat): string {
    const baseName = reportName.replace(/\.(jrxml|jasper)$/i, '');
    return `${baseName}.${format}`;
  }

  private handleJasperError(error: unknown): never {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const code = axiosError.code;

    if (status === 404) {
      throw new BadRequestException('Template introuvable pour ce tenant dans le repository JasperReports');
    }

    if (status === 401 || status === 403) {
      throw new InternalServerErrorException('Authentification JasperReports IO invalide ou mal configurée');
    }

    if (code === 'ECONNREFUSED') {
      throw new InternalServerErrorException('Moteur JasperReports IO inaccessible');
    }

    if (code === 'ECONNABORTED') {
      throw new InternalServerErrorException('Timeout JasperReports IO après 120 secondes');
    }

    if (status && status >= 400) {
      throw new InternalServerErrorException(`Erreur JasperReports IO (${status})`);
    }

    throw new InternalServerErrorException('Erreur inattendue lors de la génération du rapport');
  }
}
