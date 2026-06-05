import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { PrintReportDto } from './dto/print-report.dto';
import { PrintService } from './print.service';

describe('PrintService', () => {
  let service: PrintService;
  let httpService: { get: jest.Mock };
  let configService: { get: jest.Mock };

  const baseDto: PrintReportDto = {
    reportUri: '/reports/facture_client',
    format: 'pdf',
    parameters: {
      invoiceId: 42,
      includeDetails: true,
      emptyValue: '',
      nullValue: null,
    },
  };

  beforeEach(() => {
    httpService = {
      get: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JASPER_BASE_URL: 'http://jasperserver:8080/jasperserver/',
          JASPER_USERNAME: 'jasperadmin',
          JASPER_PASSWORD: 'password',
        };

        return values[key];
      }),
    };

    service = new PrintService(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
    );
  });

  it('returns a generated report buffer with headers after a successful JasperReports call', async () => {
    const response: AxiosResponse<Buffer> = {
      data: Buffer.from('pdf-content'),
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/pdf' },
      config: createAxiosRequestConfig(),
    };
    httpService.get.mockReturnValue(of(response));

    const result = await service.generateReport('tenant-a', baseDto);

    expect(result).toEqual({
      buffer: Buffer.from('pdf-content'),
      contentType: 'application/pdf',
      fileName: 'facture_client.pdf',
    });
    expect(httpService.get).toHaveBeenCalledWith(
      'http://jasperserver:8080/jasperserver/rest_v2/reports/organizations/tenant-a/reports/facture_client.pdf',
      {
        auth: {
          username: 'jasperadmin',
          password: 'password',
        },
        params: {
          invoiceId: 42,
          includeDetails: true,
        },
        responseType: 'arraybuffer',
        timeout: 120000,
      },
    );
  });

  it('throws BadRequestException when tenantId is missing', async () => {
    await expect(service.generateReport('', baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps a report not found response to BadRequestException', async () => {
    httpService.get.mockReturnValue(throwError(() => createAxiosError(404)));

    await expect(service.generateReport('tenant-a', baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps an authentication failure response to InternalServerErrorException', async () => {
    httpService.get.mockReturnValue(throwError(() => createAxiosError(401)));

    await expect(service.generateReport('tenant-a', baseDto)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('maps a JasperReports timeout to InternalServerErrorException', async () => {
    httpService.get.mockReturnValue(
      throwError(() => createAxiosError(undefined, 'ECONNABORTED')),
    );

    await expect(service.generateReport('tenant-a', baseDto)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

function createAxiosError(status?: number, code?: string): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'JasperReports error',
    code,
    response: status
      ? {
          data: {},
          status,
          statusText: 'Error',
          headers: {},
          config: createAxiosRequestConfig(),
        }
      : undefined,
    toJSON: () => ({}),
  } as AxiosError;
}

function createAxiosRequestConfig(): InternalAxiosRequestConfig {
  return { headers: {} } as InternalAxiosRequestConfig;
}
