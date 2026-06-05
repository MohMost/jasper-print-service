import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { JasperExportFormat, PrintReportDto } from './dto/print-report.dto';

export interface GeneratedReport {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

type JasperParameterValue = string | number | boolean;

@Injectable()
export class PrintService {
  private static readonly timeoutMs = 120_000;

  private static readonly contentTypes: Record<JasperExportFormat, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    html: 'text/html; charset=utf-8',
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async generateReport(
    tenantId: string,
    dto: PrintReportDto,
  ): Promise<GeneratedReport> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId is required');
    }

    const baseUrl = this.getRequiredConfig('JASPER_BASE_URL').replace(/\/+$/, '');
    const username = this.getRequiredConfig('JASPER_USERNAME');
    const password = this.getRequiredConfig('JASPER_PASSWORD');
    const format = dto.format ?? 'pdf';
    const url = `${baseUrl}/rest_v2/reports/organizations/${encodeURIComponent(
      tenantId.trim(),
    )}${dto.reportUri}.${format}`;

    const requestConfig: AxiosRequestConfig = {
      auth: {
        username,
        password,
      },
      params: this.cleanParameters(dto.parameters),
      responseType: 'arraybuffer',
      timeout: PrintService.timeoutMs,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get<ArrayBuffer | Buffer>(url, requestConfig),
      );

      return {
        buffer: Buffer.from(response.data),
        contentType: this.resolveContentType(response, format),
        fileName: this.buildFileName(dto.reportUri, format),
      };
    } catch (error) {
      this.handleJasperError(error);
    }
  }

  private getRequiredConfig(name: string): string {
    const value = this.configService.get<string>(name);

    if (!value?.trim()) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value.trim();
  }

  private cleanParameters(
    parameters?: PrintReportDto['parameters'],
  ): Record<string, JasperParameterValue> {
    if (!parameters) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parameters).filter(
        (entry): entry is [string, JasperParameterValue] => {
          const [, value] = entry;
          return value !== null && value !== undefined && value !== '';
        },
      ),
    );
  }

  private resolveContentType(
    response: AxiosResponse<ArrayBuffer | Buffer>,
    format: JasperExportFormat,
  ): string {
    const contentTypeHeader = response.headers?.['content-type'];

    if (typeof contentTypeHeader === 'string' && contentTypeHeader.trim()) {
      return contentTypeHeader;
    }

    return PrintService.contentTypes[format];
  }

  private buildFileName(reportUri: string, format: JasperExportFormat): string {
    const reportName = reportUri.split('/').filter(Boolean).pop() ?? 'report';
    const sanitizedReportName = reportName.replace(/[^a-zA-Z0-9._-]/g, '_');

    return `${sanitizedReportName}.${format}`;
  }

  private handleJasperError(error: unknown): never {
    if (this.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 401 || status === 403) {
        throw new InternalServerErrorException(
          'JasperReports Server authentication failed. Check configured credentials.',
        );
      }

      if (status === 404) {
        throw new BadRequestException('Report not found on JasperReports Server');
      }

      if (status && status >= 400) {
        throw new InternalServerErrorException(
          'JasperReports Server returned an error while generating the report',
        );
      }

      if (error.code === 'ECONNREFUSED') {
        throw new InternalServerErrorException(
          'JasperReports Server is unreachable',
        );
      }

      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'JasperReports Server request timed out',
        );
      }
    }

    throw new InternalServerErrorException('Unable to generate report');
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return typeof error === 'object' && error !== null && 'isAxiosError' in error;
  }
}
