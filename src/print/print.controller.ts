import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrintReportDto } from './dto/print-report.dto';
import { PrintService } from './print.service';

interface RequestWithTenant extends Request {
  user?: {
    tenantId?: string;
  };
}

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post('report')
  async printReportInline(
    @Req() request: RequestWithTenant,
    @Body() dto: PrintReportDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.sendReport(request, dto, response, 'inline');
  }

  @Post('report/download')
  async downloadReport(
    @Req() request: RequestWithTenant,
    @Body() dto: PrintReportDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.sendReport(request, dto, response, 'attachment');
  }

  private async sendReport(
    request: RequestWithTenant,
    dto: PrintReportDto,
    response: Response,
    disposition: 'inline' | 'attachment',
  ): Promise<void> {
    const tenantId = this.extractTenantId(request);
    const report = await this.printService.generateReport(tenantId, dto);

    response.setHeader('Content-Type', report.contentType);
    response.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${report.fileName}"`,
    );
    response.setHeader('Content-Length', report.buffer.length.toString());
    response.send(report.buffer);
  }

  private extractTenantId(request: RequestWithTenant): string {
    const userTenantId = request.user?.tenantId;
    const rawHeaderTenantId =
      request.header?.('X-Tenant-ID') ?? request.headers['x-tenant-id'];
    const headerTenantId = Array.isArray(rawHeaderTenantId)
      ? rawHeaderTenantId[0]
      : rawHeaderTenantId;
    const tenantId = userTenantId?.trim() || headerTenantId?.trim();

    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    return tenantId;
  }
}
