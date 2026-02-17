import { Module } from '@nestjs/common';
import { DatabaseImportController } from './database-import.controller';
import { DatabaseImportService } from './database-import.service';
import { UsersModule } from '../users/users.module';
import { SharedModule } from '../../core/shared/shared.module';

@Module({
  imports: [UsersModule, SharedModule],
  controllers: [DatabaseImportController],
  providers: [DatabaseImportService],
})
export class DatabaseImportModule { }
