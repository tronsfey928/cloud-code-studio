import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileRecord } from './entities/file-record.entity';
import { Workspace } from '../workspace/entities/workspace.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord, Workspace])],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
