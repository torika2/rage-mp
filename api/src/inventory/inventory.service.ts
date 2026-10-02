import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

export const INVENTORY_SIZE = 28; // default grid size (matches the current inventory.json)
const MAX_SLOT = 60;              // hard cap so a client can't claim huge slot indices

type Slot = { id: string; qty: number } | null;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private readonly items: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  /** Dense slot array (index = slot), empty slots as null. */
  async getGrid(characterId: number): Promise<Slot[]> {
    const rows = await this.items.findBy({ characterId });
    const size = Math.max(INVENTORY_SIZE, ...rows.map((r) => r.slot + 1));
    const grid: Slot[] = new Array(size).fill(null);
    for (const row of rows) grid[row.slot] = { id: row.itemId, qty: row.qty };
    return grid;
  }

  /** Replace the whole grid for a character from a dense slot array. */
  async replaceGrid(characterId: number, slots: Slot[]): Promise<Slot[]> {
    if (!Array.isArray(slots)) throw new BadRequestException('slots must be an array');
    const rows: Partial<InventoryItem>[] = [];
    slots.forEach((slot, index) => {
      if (slot == null) return;
      if (index > MAX_SLOT) throw new BadRequestException(`slot ${index} exceeds max ${MAX_SLOT}`);
      const itemId = String(slot.id || '').trim();
      const qty = Math.floor(Number(slot.qty));
      if (!itemId || !Number.isFinite(qty) || qty <= 0) throw new BadRequestException(`invalid item at slot ${index}`);
      rows.push({ characterId, slot: index, itemId, qty });
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(InventoryItem, { characterId });
      if (rows.length) await manager.insert(InventoryItem, rows);
    });
    return this.getGrid(characterId);
  }
}
