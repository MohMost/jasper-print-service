import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PrintController } from './print.controller';
import { PrintService } from './print.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [PrintController],
  providers: [PrintService],
  exports: [PrintService],
})
export class PrintModule {}
