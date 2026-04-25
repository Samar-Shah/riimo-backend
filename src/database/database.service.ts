import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from './types';
import { dialect } from '../../kysely.config';

@Injectable()
export class DatabaseService
  extends Kysely<Database>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ dialect });
  }

  async onModuleInit() {
    // Optional: test connection or similar
  }

  async onModuleDestroy() {
    await this.destroy();
  }
}
