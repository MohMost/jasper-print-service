import { BadRequestException, Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrintReportDto } from './dto/print-report.dto';
import { PrintService } from './print.service';

interface TenantRequest extends Request {
  user?: {
    tenantId?: string;
  };
}

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post('report')
  async renderInline(
    @Body() dto: PrintReportDto,
    @Req() req: TenantRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.sendReport(dto, req, res, 'inline');
  }

  @Post('report/download')
  async download(
    @Body() dto: PrintReportDto,
    @Req() req: TenantRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.sendReport(dto, req, res, 'attachment');
  }

  private async sendReport(
    dto: PrintReportDto,
    req: TenantRequest,
    res: Response,
    disposition: 'inline' | 'attachment',
  ): Promise<void> {
    const tenantId = this.extractTenantId(req);
    const report = await this.printService.generateReport(tenantId, dto);

    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Content-Length', report.buffer.length.toString());
    res.setHeader('Content-Disposition', `${disposition}; filename="${report.fileName}"`);
    res.send(report.buffer);
  }

  private extractTenantId(req: TenantRequest): string {
    const authenticatedTenantId = req.user?.tenantId?.trim();

    if (authenticatedTenantId) {
      return authenticatedTenantId;
    }

    const headerValue = req.headers['x-tenant-id'];
    const tenantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const normalizedTenantId = tenantId?.trim();

    if (!normalizedTenantId) {
      throw new BadRequestException('tenantId is required. Provide req.user.tenantId or X-Tenant-ID header');
    }

    return normalizedTenantId;
  }
}
