import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuickLink } from "./quick-link.entity";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "../common/cache";

@Injectable()
export class QuickLinksService {
  constructor(
    @InjectRepository(QuickLink)
    private quickLinkRepository: Repository<QuickLink>,
    private cacheService: CacheService,
  ) {}

  /**
   * Get all active quick links (for dashboard display)
   * CACHED: 30 minutes (rarely changes)
   */
  async getActiveLinks(): Promise<QuickLink[]> {
    return this.cacheService.get(
      CACHE_KEYS.QUICK_LINKS_ACTIVE,
      async () => {
        return this.quickLinkRepository.find({
          where: { isActive: true },
          order: { sortOrder: "ASC", createdAt: "DESC" },
        });
      },
      CACHE_TTL.LONG, // 30 minutes
    );
  }

  // Get all quick links (for admin management)
  async getAllLinks(): Promise<QuickLink[]> {
    return this.quickLinkRepository.find({
      order: { sortOrder: "ASC", createdAt: "DESC" },
    });
  }

  // Get single quick link by ID
  async getById(id: number): Promise<QuickLink> {
    const link = await this.quickLinkRepository.findOne({ where: { id } });
    if (!link) {
      throw new NotFoundException(`Quick link with ID ${id} not found`);
    }
    return link;
  }

  // Create new quick link
  async create(data: Partial<QuickLink>): Promise<QuickLink> {
    // Get max sort order
    const maxOrder = await this.quickLinkRepository
      .createQueryBuilder("link")
      .select("MAX(link.sortOrder)", "max")
      .getRawOne();

    const newLink = this.quickLinkRepository.create({
      ...data,
      sortOrder: (maxOrder?.max || 0) + 1,
    });

    const saved = await this.quickLinkRepository.save(newLink);
    this.cacheService.invalidate(CACHE_KEYS.QUICK_LINKS_ACTIVE);
    return saved;
  }

  // Update quick link
  async update(id: number, data: Partial<QuickLink>): Promise<QuickLink> {
    const link = await this.getById(id);
    Object.assign(link, data);
    const saved = await this.quickLinkRepository.save(link);
    this.cacheService.invalidate(CACHE_KEYS.QUICK_LINKS_ACTIVE);
    return saved;
  }

  // Delete quick link
  async delete(id: number): Promise<void> {
    const link = await this.getById(id);
    await this.quickLinkRepository.remove(link);
    this.cacheService.invalidate(CACHE_KEYS.QUICK_LINKS_ACTIVE);
  }

  // Reorder quick links
  async reorder(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.quickLinkRepository.update(orderedIds[i], { sortOrder: i });
    }
    this.cacheService.invalidate(CACHE_KEYS.QUICK_LINKS_ACTIVE);
  }
}
