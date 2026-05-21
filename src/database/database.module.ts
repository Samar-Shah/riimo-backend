import { Global, Module, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { setDbService } from '../auth';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly databaseService: DatabaseService) {}

  onModuleInit() {
    setDbService(this.databaseService);
  }
}
