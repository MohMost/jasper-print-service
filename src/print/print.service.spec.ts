import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { PrintReportDto } from './dto/print-report.dto';
import { PrintService } from './print.service';

describe('PrintService', () => {
  let service: PrintService;
  let httpService: { post: jest.Mock };
  let configService: { get: jest.Mock };

  const dto: PrintReportDto = {
    reportName: 'facture_client.jrxml',
    format: 'pdf',
    data: { invoiceId: 'INV-001', total: 100 },
    parameters: { title: 'Facture client' },
  };

  beforeEach(() => {
    httpService = {
      post: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JASPER_IO_URL: 'http://localhost:8080/jrio',
          JASPER_IO_API_KEY: 'test-api-key',
        };

        return values[key];
      }),
    };
    service = new PrintService(httpService as unknown as HttpService, configService as unknown as ConfigService);
  });

  it('retourne le buffer généré par JasperReports IO', async () => {
    const generatedBuffer = Buffer.from('%PDF-1.4');
    const response: AxiosResponse<ArrayBuffer> = {
      data: generatedBuffer as unknown as ArrayBuffer,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/pdf' },
      config: { headers: undefined },
    } as AxiosResponse<ArrayBuffer>;

    httpService.post.mockReturnValue(of(response));

    const result = await service.generateReport('tenant-a', dto);

    expect(result.buffer).toEqual(generatedBuffer);
    expect(result.contentType).toBe('application/pdf');
    expect(result.fileName).toBe('facture_client.pdf');
    expect(httpService.post).toHaveBeenCalledWith(
      'http://localhost:8080/jrio/rest_v2/export',
      {
        reportUnit: 'repo:tenants/tenant-a/facture_client.jrxml',
        outputFormat: 'pdf',
        parameters: { title: 'Facture client' },
        dataSource: {
          type: 'json',
          data: { invoiceId: 'INV-001', total: 100 },
        },
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        }),
        responseType: 'arraybuffer',
        timeout: 120000,
      }),
    );
  });

  it('rejette un tenantId manquant', async () => {
    await expect(service.generateReport('', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforme un template introuvable pour ce tenant (404) en BadRequestException', async () => {
    httpService.post.mockReturnValue(throwError(() => ({ response: { status: 404 } })));

    await expect(service.generateReport('tenant-a', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforme un échec de connexion en InternalServerErrorException', async () => {
    httpService.post.mockReturnValue(throwError(() => ({ code: 'ECONNREFUSED' })));

    await expect(service.generateReport('tenant-a', dto)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('transforme un timeout en InternalServerErrorException', async () => {
    httpService.post.mockReturnValue(throwError(() => ({ code: 'ECONNABORTED' })));

    await expect(service.generateReport('tenant-a', dto)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
