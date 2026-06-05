import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrintModule } from './print/print.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrintModule],
})
export class AppModule {}
