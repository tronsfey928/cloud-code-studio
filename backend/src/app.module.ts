import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ChatModule } from './modules/chat/chat.module';
import { FileModule } from './modules/file/file.module';
import { OpenCodeModule } from './modules/opencode/opencode.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import opencodeConfig from './config/opencode.config';
import redisConfig from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, opencodeConfig, redisConfig],
    }),
    DatabaseModule,
    AuthModule,
    WorkspaceModule,
    ChatModule,
    FileModule,
    OpenCodeModule,
  ],
})
export class AppModule {}
