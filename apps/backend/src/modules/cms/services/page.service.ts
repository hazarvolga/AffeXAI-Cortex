import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Page } from '../entities/page.entity';
import { PageStatus } from '@affexai/shared-types';
import { Component } from '../entities/component.entity';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { EventBusService } from '../../platform-integration/services/event-bus.service';
import { TenantService } from '../../../core/tenant/tenant.service';

@Injectable()
export class PageService {
  constructor(
    @InjectRepository(Page)
    private pageRepository: Repository<Page>,
    private eventBusService: EventBusService,
    private tenantService: TenantService,
  ) { }

  private get tenantId(): string {
    return this.tenantService.getTenantId();
  }

  async create(createPageDto: CreatePageDto): Promise<Page> {
    const { title, ...rest } = createPageDto;
    const page = this.pageRepository.create({
      ...rest,
      name: title,
      tenantId: this.tenantId
    });
    return this.pageRepository.save(page);
  }

  async findAll(status?: PageStatus): Promise<Page[]> {
    const queryBuilder = this.pageRepository.createQueryBuilder('page');
    queryBuilder.where('page.tenantId = :tenantId', { tenantId: this.tenantId });

    if (status) {
      queryBuilder.andWhere('page.status = :status', { status });
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Page | null> {
    const page = await this.pageRepository.findOne({
      where: { id, tenantId: this.tenantId },
      relations: ['components'],
    });

    // Explicitly ensure components are loaded
    if (page && (!page.components || page.components.length === 0)) {
      page.components = await this.pageRepository.manager
        .createQueryBuilder(Component, 'component')
        .where('component.pageId = :pageId', { pageId: id })
        .getMany() as Component[];
    }

    return page;
  }

  async findBySlug(slug: string): Promise<Page | null> {
    const page = await this.pageRepository.findOne({
      where: { slug, tenantId: this.tenantId },
      relations: ['components'],
    });

    // Explicitly ensure components are loaded
    if (page && (!page.components || page.components.length === 0)) {
      page.components = await this.pageRepository.manager
        .createQueryBuilder(Component, 'component')
        .where('component.pageId = :pageId', { pageId: page.id })
        .getMany() as Component[];
    }

    return page;
  }

  async update(id: string, updatePageDto: UpdatePageDto): Promise<Page> {
    const { title, ...rest } = updatePageDto;
    const updateData: any = { ...rest };
    if (title) {
      updateData.name = title;
    }

    await this.pageRepository.update({ id, tenantId: this.tenantId }, updateData);
    const page = await this.findOne(id);
    if (!page) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }
    return page;
  }

  async remove(id: string): Promise<void> {
    await this.pageRepository.delete({ id, tenantId: this.tenantId });
  }

  async publish(id: string): Promise<Page> {
    const page = await this.findOne(id);
    if (!page) {
      throw new Error('Page not found');
    }

    page.status = PageStatus.PUBLISHED;
    page.publishedAt = new Date();

    const publishedPage = await this.pageRepository.save(page);

    // Publish platform event
    await this.eventBusService.publishPagePublished(
      publishedPage.id,
      publishedPage.slug,
      'system', // NOTE: Uses 'system' for CMS operations; user context available via request
    );

    return publishedPage;
  }

  async unpublish(id: string): Promise<Page> {
    const page = await this.findOne(id);
    if (!page) {
      throw new Error('Page not found');
    }

    page.status = PageStatus.DRAFT;
    page.publishedAt = null;

    return this.pageRepository.save(page);
  }

  async clone(id: string): Promise<Page> {
    const originalPage = await this.findOne(id);
    if (!originalPage) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    // Create a clone with modified title and slug
    const clonedPage = this.pageRepository.create({
      name: `${originalPage.name} (Kopya)`,
      slug: `${originalPage.slug}-copy-${Date.now()}`,
      description: originalPage.description,
      status: PageStatus.DRAFT, // Always start as draft
      categoryId: originalPage.categoryId,
      layoutOptions: originalPage.layoutOptions,
      tenantId: this.tenantId,
    });

    const savedPage = await this.pageRepository.save(clonedPage);

    // Clone components if any exist
    if (originalPage.components && originalPage.components.length > 0) {
      const clonedComponents = originalPage.components.map(component => {
        const { id, createdAt, updatedAt, ...componentData } = component as any;
        return this.pageRepository.manager.create(Component, {
          ...componentData,
          pageId: savedPage.id,
        });
      });

      await this.pageRepository.manager.save(Component, clonedComponents);
    }

    return this.findOne(savedPage.id) as Promise<Page>;
  }

  // ============ BULK OPERATIONS ============

  /**
   * Bulk publish multiple pages - Optimized single query
   */
  async bulkPublish(ids: string[]): Promise<{ successCount: number; failedCount: number }> {
    const result = await this.pageRepository.update(
      { id: In(ids), tenantId: this.tenantId },
      { status: PageStatus.PUBLISHED, publishedAt: new Date() }
    );

    // Emit events for each published page
    for (const id of ids) {
      await this.eventBusService.publishPagePublished(id, '', 'system');
    }

    return {
      successCount: result.affected || 0,
      failedCount: ids.length - (result.affected || 0), // Note: This implies requested count - actual affected
    };
  }

  /**
   * Bulk unpublish (set to draft) multiple pages - Optimized single query
   */
  async bulkUnpublish(ids: string[]): Promise<{ successCount: number; failedCount: number }> {
    const result = await this.pageRepository.update(
      { id: In(ids), tenantId: this.tenantId },
      { status: PageStatus.DRAFT, publishedAt: null as any }
    );

    return {
      successCount: result.affected || 0,
      failedCount: ids.length - (result.affected || 0),
    };
  }

  /**
   * Bulk archive multiple pages - Optimized single query
   */
  async bulkArchive(ids: string[]): Promise<{ successCount: number; failedCount: number }> {
    const result = await this.pageRepository.update(
      { id: In(ids), tenantId: this.tenantId },
      { status: PageStatus.ARCHIVED }
    );

    return {
      successCount: result.affected || 0,
      failedCount: ids.length - (result.affected || 0),
    };
  }

  /**
   * Bulk delete multiple pages - Optimized single query
   */
  async bulkDelete(ids: string[]): Promise<{ successCount: number; failedCount: number }> {
    const result = await this.pageRepository.delete({ id: In(ids), tenantId: this.tenantId });

    return {
      successCount: result.affected || 0,
      failedCount: ids.length - (result.affected || 0),
    };
  }

  /**
   * Bulk update status for multiple pages
   */
  async bulkUpdateStatus(ids: string[], status: PageStatus): Promise<{ successCount: number; failedCount: number }> {
    const result = await this.pageRepository.update(
      { id: In(ids), tenantId: this.tenantId },
      {
        status,
        publishedAt: status === PageStatus.PUBLISHED ? new Date() : null,
      }
    );

    return {
      successCount: result.affected || 0,
      failedCount: ids.length - (result.affected || 0),
    };
  }
}