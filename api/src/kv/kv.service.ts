import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KvEntry } from './kv-entry.entity';

@Injectable()
export class KvService {
  constructor(@InjectRepository(KvEntry) private readonly entries: Repository<KvEntry>) {}

  async get(namespace: string): Promise<{ exists: boolean; value: unknown }> {
    const row = await this.entries.findOneBy({ namespace });
    return row ? { exists: true, value: row.value } : { exists: false, value: null };
  }

  async put(namespace: string, value: unknown): Promise<{ saved: true }> {
    await this.entries.save(this.entries.create({ namespace, value }));
    return { saved: true };
  }
}
