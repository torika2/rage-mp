import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Item, ITEM_STATUSES, ITEM_ORIGINS } from './item.entity';
import { FraudLog } from './fraud-log.entity';
import { Character } from '../characters/character.entity';
import { User } from '../users/user.entity';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

const DROP_TTL_MS = 2 * 60 * 1000;   // dropped items are removed 2 minutes after being dropped
const SWEEP_INTERVAL_MS = 30 * 1000; // how often the sweeper runs

@Injectable()
export class ItemsService implements OnModuleInit {
  private readonly logger = new Logger('Items');

  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(FraudLog) private readonly fraud: Repository<FraudLog>,
    @InjectRepository(Character) private readonly characters: Repository<Character>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Periodically remove items that have been dropped for longer than the TTL.
  onModuleInit(): void {
    setInterval(() => this.sweepDropped().catch(() => {}), SWEEP_INTERVAL_MS);
  }

  private async sweepDropped(): Promise<void> {
    const cutoff = new Date(Date.now() - DROP_TTL_MS);
    const result = await this.items.delete({ status: 'dropped', droppedAt: LessThanOrEqual(cutoff) });
    if (result.affected) this.logger.log(`swept ${result.affected} expired dropped item(s)`);
  }

  // Keep dropped_at in sync with the status: stamped when dropped, cleared otherwise.
  private applyDropTimestamp(item: Item): void {
    if (item.status === 'dropped') {
      if (!item.droppedAt) item.droppedAt = new Date();
    } else {
      item.droppedAt = null;
    }
  }

  /**
   * Record a potential-fraud event and refuse the write: write fraud_log, print to the server
   * console, flag the owning account, and throw.
   */
  private async reportFraud(ownerCharacterId: number, itemId: string | null, badValue: string, details: string): Promise<never> {
    const character = await this.characters.findOne({
      where: { id: ownerCharacterId },
      select: { id: true, userId: true },
    });
    const userId = character ? character.userId : null;

    await this.fraud.save(this.fraud.create({ userId, characterId: ownerCharacterId, itemId, badStatus: badValue, details }));
    this.logger.error(`[FRAUD] ${details}`);
    if (userId) await this.users.update(userId, { isFlagged: true });

    throw new ForbiddenException(`${details} — flagged as potential fraud.`);
  }

  // Reject an item whose status is outside the known set (inventory | dropped).
  private async guardStatus(ownerCharacterId: number, itemId: string | null, status: string): Promise<void> {
    if ((ITEM_STATUSES as string[]).includes(status)) return;
    await this.reportFraud(ownerCharacterId, itemId, status, `invalid item status '${status}' for character ${ownerCharacterId} item '${itemId}'`);
  }

  // Reject a new item that didn't appear through a legitimate origin (bought | traded).
  private async guardOrigin(ownerCharacterId: number, itemId: string | null, origin: string): Promise<void> {
    if ((ITEM_ORIGINS as string[]).includes(origin)) return;
    await this.reportFraud(ownerCharacterId, itemId, origin, `illegitimate item origin '${origin}' for character ${ownerCharacterId} item '${itemId}'`);
  }

  findByCharacter(ownerCharacterId: number): Promise<Item[]> {
    return this.items.findBy({ ownerCharacterId });
  }

  async findOne(id: number): Promise<Item> {
    const item = await this.items.findOneBy({ id });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  async create(ownerCharacterId: number, dto: CreateItemDto): Promise<Item> {
    await this.guardOrigin(ownerCharacterId, dto.itemId, dto.origin); // items only appear if bought/traded
    await this.guardStatus(ownerCharacterId, dto.itemId, dto.status);
    const item = this.items.create({ ...dto, ownerCharacterId });
    this.applyDropTimestamp(item);
    return this.items.save(item);
  }

  async update(id: number, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id);
    if (dto.status !== undefined) await this.guardStatus(item.ownerCharacterId, item.itemId, dto.status);
    this.items.merge(item, dto);
    this.applyDropTimestamp(item);
    return this.items.save(item);
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const result = await this.items.delete(id);
    if (!result.affected) throw new NotFoundException(`Item ${id} not found`);
    return { deleted: true };
  }

  recentFraud(limit = 100): Promise<FraudLog[]> {
    return this.fraud.find({ order: { createdAt: 'DESC' }, take: Math.min(500, Math.max(1, limit)) });
  }
}
