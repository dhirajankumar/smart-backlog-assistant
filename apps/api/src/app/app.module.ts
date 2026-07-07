import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join, dirname } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyseModule } from '../analyse/analyse.module';
import { RegenerateModule } from '../regenerate/regenerate.module';
import { LoggerModule } from '../common/logger/logger.module';

const isProduction = process.env['NODE_ENV'] === 'production';
// pkg bundles into a virtual snapshot fs; express.static needs a real OS path
const isPkg = typeof (process as any).pkg !== 'undefined';
const webRoot = isPkg
  ? join(dirname(process.execPath), 'web', 'browser')
  : join(__dirname, '..', 'web', 'browser');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    AnalyseModule,
    RegenerateModule,
    ...(isProduction || isPkg
      ? [
          ServeStaticModule.forRoot({
            rootPath: webRoot,
            exclude: ['/api*'],
            renderPath: '/*',
          }),
        ]
      : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
