import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { KnowledgeBaseCategory } from '../entities/knowledge-base-category.entity';
import { TenantService } from '../../../core/tenant/tenant.service';

export interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  articleCount: number;
  children: CategoryTreeNode[];
  level: number;
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  totalArticles: number;
  averageArticlesPerCategory: number;
  mostPopularCategories: KnowledgeBaseCategory[];
  unusedCategories: KnowledgeBaseCategory[];
}

@Injectable()
export class KnowledgeBaseCategoryService {
  private readonly logger = new Logger(KnowledgeBaseCategoryService.name);

  constructor(
    @InjectRepository(KnowledgeBaseCategory)
    private readonly categoryRepository: Repository<KnowledgeBaseCategory>,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Get current tenant ID from TenantService
   * @private
   */
  private getActiveTenantId(): string {
    return this.tenantService.getTenantId();
  }

  /**
   * Create a new category
   */
  async createCategory(dto: CreateCategoryDto, userId: string): Promise<KnowledgeBaseCategory> {
    // Validate category data
    await this.validateCategoryData(dto);

    // Generate unique slug
    const slug = await this.generateUniqueSlug(dto.name);

    // Validate parent if provided
    if (dto.parentId) {
      await this.validateParentCategory(dto.parentId);
    }

    const tenantId = this.getActiveTenantId();

    const category = this.categoryRepository.create({
      ...dto,
      slug,
      tenantId, // Explicitly set tenantId
      createdBy: userId,
      updatedBy: userId,
    });

    await this.categoryRepository.save(category);
    this.logger.log(`Created KB category: ${category.id} - ${category.name}`);

    return category;
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
  ): Promise<KnowledgeBaseCategory> {
    const tenantId = this.getActiveTenantId();
    const category = await this.categoryRepository.findOne({
      where: { id, tenantId }
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    // Validate category data
    await this.validateCategoryData(dto, id);

    // Update slug if name changed
    if (dto.name && dto.name !== category.name) {
      category.slug = await this.generateUniqueSlug(dto.name, id);
    }

    // Validate parent if provided
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        await this.validateParentCategory(dto.parentId, id);
      }
    }

    Object.assign(category, { ...dto, updatedBy: userId });
    await this.categoryRepository.save(category);

    this.logger.log(`Updated KB category: ${category.id}`);
    return category;
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const category = await this.categoryRepository.findOne({
      where: { id, tenantId },
      relations: ['articles', 'children'],
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    // Check if category has articles
    if (category.articles && category.articles.length > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category.articles.length} articles. Please move or delete articles first.`
      );
    }

    // Move child categories to parent or root level
    if (category.children && category.children.length > 0) {
      await this.categoryRepository.update(
        { parentId: id, tenantId },
        { parentId: category.parentId || null }
      );
    }

    await this.categoryRepository.delete({ id, tenantId });
    this.logger.log(`Deleted KB category: ${id}`);
  }

  /**
   * Get category by ID
   */
  async getCategory(id: string): Promise<KnowledgeBaseCategory> {
    const tenantId = this.getActiveTenantId();
    const category = await this.categoryRepository.findOne({
      where: { id, tenantId },
      relations: ['articles'],
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<KnowledgeBaseCategory[]> {
    const tenantId = this.getActiveTenantId();
    return await this.categoryRepository.find({
      where: { isActive: true, tenantId },
      order: { sortOrder: 'ASC', name: 'ASC' },
      relations: ['articles'],
    });
  }

  /**
   * Get categories with article counts
   */
  async getCategoriesWithCounts(): Promise<KnowledgeBaseCategory[]> {
    const tenantId = this.getActiveTenantId();
    return await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.tenantId = :tenantId', { tenantId })
      .leftJoinAndSelect('category.articles', 'article', 'article.isPublished = :published', { published: true })
      .andWhere('category.isActive = :active', { active: true })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getMany();
  }

  /**
   * Get category tree structure
   */
  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const tenantId = this.getActiveTenantId();
    const categories = await this.categoryRepository.find({
      where: { isActive: true, tenantId },
      relations: ['children'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Build tree structure
    const categoryMap = new Map<string, CategoryTreeNode>();
    const rootCategories: CategoryTreeNode[] = [];

    // First pass: create all nodes
    for (const category of categories) {
      const node: CategoryTreeNode = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        icon: category.icon,
        articleCount: category.articleCount,
        children: [],
        level: 0,
      };
      categoryMap.set(category.id, node);
    }

    // Second pass: build hierarchy and calculate levels
    for (const category of categories) {
      const node = categoryMap.get(category.id);
      if (!node) continue;

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(node);
          node.level = parent.level + 1;
        } else {
          // Parent not found or inactive, treat as root
          rootCategories.push(node);
        }
      } else {
        rootCategories.push(node);
      }
    }

    // Sort children recursively
    this.sortCategoryTree(rootCategories);

    return rootCategories;
  }

  /**
   * Move category to new parent
   */
  async moveCategory(categoryId: string, newParentId?: string): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, tenantId }
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    // Validate new parent if provided
    if (newParentId) {
      await this.validateParentCategory(newParentId, categoryId);
    }

    // Update parent
    category.parentId = newParentId || null;
    await this.categoryRepository.save(category);

    this.logger.log(`Moved category ${categoryId} to parent ${newParentId || 'root'}`);
  }

  /**
   * Get category with full hierarchy path
   */
  async getCategoryWithPath(id: string): Promise<KnowledgeBaseCategory & { path: string[] }> {
    const category = await this.getCategory(id);
    const path = await this.getCategoryPath(id);

    return { ...category, path };
  }

  /**
   * Get category path (breadcrumb)
   */
  async getCategoryPath(categoryId: string): Promise<string[]> {
    const path: string[] = [];
    let currentId = categoryId;

    const tenantId = this.getActiveTenantId();
    while (currentId) {
      const category = await this.categoryRepository.findOne({
        where: { id: currentId, tenantId },
        select: ['name', 'parentId'],
      });

      if (!category) break;

      path.unshift(category.name);
      currentId = category.parentId;
    }

    return path;
  }

  /**
   * Get all descendants of a category
   */
  async getCategoryDescendants(categoryId: string): Promise<KnowledgeBaseCategory[]> {
    const descendants: KnowledgeBaseCategory[] = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      const tenantId = this.getActiveTenantId();
      const children = await this.categoryRepository.find({
        where: { parentId: currentId, isActive: true, tenantId },
      });

      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  /**
   * Get all ancestors of a category
   */
  async getCategoryAncestors(categoryId: string): Promise<KnowledgeBaseCategory[]> {
    const ancestors: KnowledgeBaseCategory[] = [];
    let currentId = categoryId;

    const tenantId = this.getActiveTenantId();
    while (currentId) {
      const category = await this.categoryRepository.findOne({
        where: { id: currentId, tenantId },
        relations: ['parent'],
      });

      if (!category || !category.parent) break;

      ancestors.unshift(category.parent);
      currentId = category.parent.id;
    }

    return ancestors;
  }

  /**
   * Validate category hierarchy
   */
  async validateHierarchy(categoryId: string, parentId?: string): Promise<boolean> {
    try {
      if (parentId) {
        await this.validateParentCategory(parentId, categoryId);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Reorder categories within the same parent
   */
  async reorderCategories(categoryIds: string[]): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const categories = await this.categoryRepository.find({
      where: { id: In(categoryIds), tenantId }
    });

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('Some categories not found');
    }

    // Validate all categories have the same parent
    const parentIds = [...new Set(categories.map(c => c.parentId))];
    if (parentIds.length > 1) {
      throw new BadRequestException('All categories must have the same parent for reordering');
    }

    // Update sort orders
    const updates = categoryIds.map((id, index) => ({
      id,
      sortOrder: index,
      tenantId, // Ensure tenantId is passed for save
    }));

    await this.categoryRepository.save(updates);
    this.logger.log(`Reordered ${categoryIds.length} categories`);
  }

  /**
   * Update article counts for categories
   */
  async updateArticleCounts(): Promise<void> {
    const tenantId = this.getActiveTenantId();
    await this.categoryRepository
      .createQueryBuilder()
      .update(KnowledgeBaseCategory)
      .set({
        articleCount: () => `(
          SELECT COUNT(*) 
          FROM knowledge_base_articles 
          WHERE category_id = knowledge_base_categories.id 
          AND is_published = true
          AND tenant_id = :tenantId
        )`,
      })
      .setParameters({ tenantId })
      .where('tenantId = :tenantId', { tenantId })
      .execute();

    this.logger.log(`Updated article counts for categories`);
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<CategoryStats> {
    const tenantId = this.getActiveTenantId();
    const totalCategories = await this.categoryRepository.count({ where: { tenantId } });
    const activeCategories = await this.categoryRepository.count({ where: { isActive: true, tenantId } });

    const articleCountResult = await this.categoryRepository
      .createQueryBuilder('category')
      .select('SUM(category.articleCount)', 'totalArticles')
      .where('category.isActive = :active', { active: true })
      .andWhere('category.tenantId = :tenantId', { tenantId })
      .getRawOne();

    const totalArticles = parseInt(articleCountResult?.totalArticles || '0');
    const averageArticlesPerCategory = activeCategories > 0 ? totalArticles / activeCategories : 0;

    const mostPopularCategories = await this.categoryRepository.find({
      where: { isActive: true, tenantId },
      order: { articleCount: 'DESC' },
      take: 5,
    });

    const unusedCategories = await this.categoryRepository.find({
      where: { isActive: true, articleCount: 0, tenantId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      totalCategories,
      activeCategories,
      totalArticles,
      averageArticlesPerCategory: Math.round(averageArticlesPerCategory * 100) / 100,
      mostPopularCategories,
      unusedCategories,
    };
  }

  /**
   * Get popular categories
   */
  async getPopularCategories(limit: number = 10): Promise<KnowledgeBaseCategory[]> {
    const tenantId = this.getActiveTenantId();
    return await this.categoryRepository.find({
      where: { isActive: true, tenantId },
      order: { articleCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Bulk activate/deactivate categories
   */
  async bulkUpdateStatus(categoryIds: string[], isActive: boolean): Promise<void> {
    const tenantId = this.getActiveTenantId();
    const result = await this.categoryRepository
      .createQueryBuilder()
      .update(KnowledgeBaseCategory)
      .set({ isActive })
      .whereInIds(categoryIds)
      .andWhere('tenantId = :tenantId', { tenantId })
      .execute();

    this.logger.log(`Bulk updated status for ${result.affected} categories to ${isActive ? 'active' : 'inactive'}`);
  }

  /**
   * Bulk delete categories
   */
  async bulkDeleteCategories(categoryIds: string[]): Promise<void> {
    const tenantId = this.getActiveTenantId();
    // Check each category for articles and children
    for (const id of categoryIds) {
      const category = await this.categoryRepository.findOne({
        where: { id, tenantId },
        relations: ['articles', 'children'],
      });

      if (!category) continue;

      if (category.articles && category.articles.length > 0) {
        throw new BadRequestException(
          `Cannot delete category "${category.name}" with ${category.articles.length} articles`
        );
      }

      // Move children to parent or root
      if (category.children && category.children.length > 0) {
        await this.categoryRepository.update(
          { parentId: id },
          { parentId: category.parentId || null }
        );
      }
    }

    // Delete categories
    await this.categoryRepository.delete({ id: In(categoryIds), tenantId });
    this.logger.log(`Bulk deleted ${categoryIds.length} categories`);
  }

  /**
   * Initialize default categories
   */
  async initializeDefaultCategories(userId: string): Promise<KnowledgeBaseCategory[]> {
    const defaultCategories = [
      {
        name: 'Getting Started',
        description: 'Basic information and setup guides',
        color: 'blue',
        icon: 'info',
        sortOrder: 0,
      },
      {
        name: 'Troubleshooting',
        description: 'Common issues and solutions',
        color: 'red',
        icon: 'help',
        sortOrder: 1,
      },
      {
        name: 'Features',
        description: 'Product features and how to use them',
        color: 'green',
        icon: 'star',
        sortOrder: 2,
      },
      {
        name: 'FAQ',
        description: 'Frequently asked questions',
        color: 'yellow',
        icon: 'help',
        sortOrder: 3,
      },
    ];

    const createdCategories: KnowledgeBaseCategory[] = [];
    const tenantId = this.getActiveTenantId();

    for (const categoryData of defaultCategories) {
      // Check if category already exists for this tenant
      const existing = await this.categoryRepository.findOne({
        where: { name: categoryData.name, tenantId },
      });

      if (!existing) {
        const category = await this.createCategory(categoryData, userId);
        createdCategories.push(category);
      }
    }

    this.logger.log(`Initialized ${createdCategories.length} default categories`);
    return createdCategories;
  }

  /**
   * Search categories by name or description
   */
  async searchCategories(query: string): Promise<KnowledgeBaseCategory[]> {
    const tenantId = this.getActiveTenantId();
    return await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.isActive = :active', { active: true })
      .andWhere('category.tenantId = :tenantId', { tenantId })
      .andWhere(
        '(LOWER(category.name) LIKE LOWER(:query) OR LOWER(category.description) LIKE LOWER(:query))',
        { query: `%${query}%` }
      )
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getMany();
  }

  /**
   * Get categories by parent ID
   */
  async getCategoriesByParent(parentId?: string): Promise<KnowledgeBaseCategory[]> {
    const tenantId = this.getActiveTenantId();
    return await this.categoryRepository.find({
      where: {
        parentId: parentId || null,
        isActive: true,
        tenantId
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Get root categories (no parent)
   */
  async getRootCategories(): Promise<KnowledgeBaseCategory[]> {
    return await this.getCategoriesByParent();
  }

  /**
   * Generate URL-friendly slug from name
   */
  async generateSlug(name: string): Promise<string> {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate unique slug by checking database
   */
  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = await this.generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.isSlugTaken(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Check if slug is already taken
   */
  private async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const tenantId = this.getActiveTenantId();
    const query = this.categoryRepository.createQueryBuilder('category')
      .where('category.slug = :slug', { slug })
      .andWhere('category.tenantId = :tenantId', { tenantId });

    if (excludeId) {
      query.andWhere('category.id != :excludeId', { excludeId });
    }

    const count = await query.getCount();
    return count > 0;
  }

  /**
   * Validate category data
   */
  private async validateCategoryData(dto: CreateCategoryDto | UpdateCategoryDto, excludeId?: string): Promise<void> {
    // Validate name
    if (dto.name) {
      if (dto.name.trim().length < 2) {
        throw new BadRequestException('Category name must be at least 2 characters long');
      }
      if (dto.name.trim().length > 255) {
        throw new BadRequestException('Category name must not exceed 255 characters');
      }
    }

    // Validate color
    if (dto.color) {
      const validColors = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'indigo', 'gray'];
      if (!validColors.includes(dto.color)) {
        throw new BadRequestException(`Invalid color. Must be one of: ${validColors.join(', ')}`);
      }
    }

    // Validate icon
    if (dto.icon) {
      const validIcons = ['folder', 'book', 'file', 'tag', 'star', 'heart', 'info', 'help'];
      if (!validIcons.includes(dto.icon)) {
        throw new BadRequestException(`Invalid icon. Must be one of: ${validIcons.join(', ')}`);
      }
    }

    // Validate sort order
    if (dto.sortOrder !== undefined && dto.sortOrder < 0) {
      throw new BadRequestException('Sort order must be a non-negative number');
    }
  }

  /**
   * Validate parent category
   */
  private async validateParentCategory(parentId: string, categoryId?: string): Promise<void> {
    const tenantId = this.getActiveTenantId();
    // Check if parent exists within same tenant
    const parent = await this.categoryRepository.findOne({
      where: { id: parentId, tenantId }
    });
    if (!parent) {
      throw new NotFoundException(`Parent category ${parentId} not found`);
    }

    // Check if parent is active
    if (!parent.isActive) {
      throw new BadRequestException('Parent category must be active');
    }

    // Prevent self-reference
    if (categoryId && parentId === categoryId) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    // Check for circular reference
    if (categoryId) {
      await this.checkCircularReference(categoryId, parentId);
    }

    // Check maximum depth
    const depth = await this.getCategoryDepth(parentId);
    if (depth >= 2) { // Maximum 3 levels (0, 1, 2)
      throw new BadRequestException('Maximum category depth of 3 levels exceeded');
    }
  }

  /**
   * Check for circular reference in hierarchy
   */
  private async checkCircularReference(categoryId: string, parentId: string): Promise<void> {
    const tenantId = this.getActiveTenantId();
    let currentParentId = parentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        throw new BadRequestException('Circular reference detected in category hierarchy');
      }

      if (currentParentId === categoryId) {
        throw new BadRequestException('Cannot create circular reference: category cannot be descendant of itself');
      }

      visited.add(currentParentId);

      const parent = await this.categoryRepository.findOne({
        where: { id: currentParentId, tenantId },
        select: ['parentId'],
      });

      currentParentId = parent?.parentId || null;
    }
  }

  /**
   * Get category depth in hierarchy
   */
  private async getCategoryDepth(categoryId: string): Promise<number> {
    const tenantId = this.getActiveTenantId();
    let depth = 0;
    let currentId = categoryId;

    while (currentId) {
      const category = await this.categoryRepository.findOne({
        where: { id: currentId, tenantId },
        select: ['parentId'],
      });

      if (!category) break;

      currentId = category.parentId;
      depth++;

      // Prevent infinite loop
      if (depth > 10) {
        throw new BadRequestException('Category hierarchy too deep');
      }
    }

    return depth;
  }

  /**
   * Sort category tree recursively
   */
  private sortCategoryTree(categories: CategoryTreeNode[]): void {
    categories.sort((a, b) => {
      // Sort by name for now, could be extended to use sortOrder
      return a.name.localeCompare(b.name);
    });

    for (const category of categories) {
      if (category.children.length > 0) {
        this.sortCategoryTree(category.children);
      }
    }
  }
}