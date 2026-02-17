import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeBaseCategoryService } from './knowledge-base-category.service';
import { KnowledgeBaseCategory } from '../entities/knowledge-base-category.entity';
import { KnowledgeBaseArticle } from '../entities/knowledge-base-article.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('KnowledgeBaseCategoryService', () => {
    let service: KnowledgeBaseCategoryService;
    let categoryRepository: Repository<KnowledgeBaseCategory>;
    let articleRepository: Repository<KnowledgeBaseArticle>;

    const mockCategory: Partial<KnowledgeBaseCategory> = {
        id: 'cat-123',
        name: 'Getting Started',
        slug: 'getting-started',
        description: 'Basic guides for new users',
        parentId: null,
        articleCount: 10,
        order: 1,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
        })),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KnowledgeBaseCategoryService,
                {
                    provide: getRepositoryToken(KnowledgeBaseCategory),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(KnowledgeBaseArticle),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<KnowledgeBaseCategoryService>(KnowledgeBaseCategoryService);
        categoryRepository = module.get(getRepositoryToken(KnowledgeBaseCategory));
        articleRepository = module.get(getRepositoryToken(KnowledgeBaseArticle));

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getCategories', () => {
        it('should return all visible categories', async () => {
            mockRepository.find.mockResolvedValue([mockCategory]);

            const result = await service.getCategories();

            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { isVisible: true },
                order: { order: 'ASC' },
            });
            expect(result).toEqual([mockCategory]);
        });

        it('should include hidden categories when requested', async () => {
            mockRepository.find.mockResolvedValue([mockCategory, { ...mockCategory, isVisible: false }]);

            const result = await service.getCategories({ includeHidden: true });

            expect(result.length).toBe(2);
        });

        it('should filter by parent category', async () => {
            mockRepository.find.mockResolvedValue([mockCategory]);

            const result = await service.getCategories({ parentId: 'parent-123' });

            expect(mockRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ parentId: 'parent-123' }),
                }),
            );
        });
    });

    describe('getCategoriesTree', () => {
        it('should return categories in hierarchical tree structure', async () => {
            const parent = { ...mockCategory, id: 'parent', parentId: null };
            const child1 = { ...mockCategory, id: 'child1', parentId: 'parent' };
            const child2 = { ...mockCategory, id: 'child2', parentId: 'parent' };
            mockRepository.find.mockResolvedValue([parent, child1, child2]);

            const result = await service.getCategoriesTree();

            expect(result).toBeInstanceOf(Array);
            expect(result[0]).toHaveProperty('children');
            expect(result[0].children).toHaveLength(2);
        });

        it('should handle multiple levels of nesting', async () => {
            const level1 = { ...mockCategory, id: 'level1', parentId: null };
            const level2 = { ...mockCategory, id: 'level2', parentId: 'level1' };
            const level3 = { ...mockCategory, id: 'level3', parentId: 'level2' };
            mockRepository.find.mockResolvedValue([level1, level2, level3]);

            const result = await service.getCategoriesTree();

            expect(result[0].children[0]).toHaveProperty('children');
        });

        it('should handle orphaned categories', async () => {
            const orphan = { ...mockCategory, id: 'orphan', parentId: 'non-existent' };
            mockRepository.find.mockResolvedValue([orphan]);

            const result = await service.getCategoriesTree();

            expect(result).toHaveLength(1);
        });
    });

    describe('getCategory', () => {
        it('should return category by id', async () => {
            mockRepository.findOne.mockResolvedValue(mockCategory);

            const result = await service.getCategory('cat-123');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'cat-123' },
                relations: ['parent', 'children'],
            });
            expect(result).toEqual(mockCategory);
        });

        it('should throw NotFoundException if category not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.getCategory('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getCategoryBySlug', () => {
        it('should return category by slug', async () => {
            mockRepository.findOne.mockResolvedValue(mockCategory);

            const result = await service.getCategoryBySlug('getting-started');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { slug: 'getting-started' },
            });
            expect(result).toEqual(mockCategory);
        });
    });

    describe('createCategory', () => {
        it('should create new category with generated slug', async () => {
            const createDto = {
                name: 'New Category',
                description: 'Description',
            };

            mockRepository.create.mockReturnValue(mockCategory);
            mockRepository.save.mockResolvedValue(mockCategory);

            const result = await service.createCategory(createDto);

            expect(mockRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    slug: expect.any(String),
                }),
            );
            expect(result).toEqual(mockCategory);
        });

        it('should validate parent category exists', async () => {
            const createDto = {
                name: 'Child Category',
                parentId: 'parent-123',
            };

            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.createCategory(createDto)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should prevent circular parent references', async () => {
            const createDto = {
                name: 'Category',
                parentId: 'cat-123',
            };

            mockRepository.findOne.mockResolvedValue(mockCategory);

            await expect(
                service.createCategory(createDto, 'cat-123'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('updateCategory', () => {
        it('should update category', async () => {
            const updateDto = {
                name: 'Updated Name',
                description: 'Updated description',
            };

            mockRepository.findOne.mockResolvedValue(mockCategory);
            mockRepository.save.mockResolvedValue({
                ...mockCategory,
                ...updateDto,
            });

            const result = await service.updateCategory('cat-123', updateDto);

            expect(result.name).toBe('Updated Name');
            expect(mockRepository.save).toHaveBeenCalled();
        });

        it('should regenerate slug when name changes', async () => {
            const updateDto = { name: 'New Name' };

            mockRepository.findOne.mockResolvedValue(mockCategory);
            mockRepository.save.mockResolvedValue({
                ...mockCategory,
                ...updateDto,
                slug: 'new-name',
            });

            const result = await service.updateCategory('cat-123', updateDto);

            expect(result.slug).toBe('new-name');
        });
    });

    describe('deleteCategory', () => {
        it('should delete category without articles', async () => {
            mockRepository.findOne.mockResolvedValue(mockCategory);
            mockRepository.count.mockResolvedValue(0);
            mockRepository.delete.mockResolvedValue({ affected: 1 });

            await service.deleteCategory('cat-123');

            expect(mockRepository.delete).toHaveBeenCalledWith('cat-123');
        });

        it('should throw error if category has articles', async () => {
            mockRepository.findOne.mockResolvedValue(mockCategory);
            mockRepository.count.mockResolvedValue(5);

            await expect(service.deleteCategory('cat-123')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw error if category has children', async () => {
            const categoryWithChildren = {
                ...mockCategory,
                children: [{ id: 'child-1' }],
            };
            mockRepository.findOne.mockResolvedValue(categoryWithChildren);

            await expect(service.deleteCategory('cat-123')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('reorderCategories', () => {
        it('should update category order', async () => {
            const orderMap = {
                'cat-1': 1,
                'cat-2': 2,
                'cat-3': 3,
            };

            mockRepository.findOne.mockResolvedValue(mockCategory);
            mockRepository.save.mockResolvedValue(mockCategory);

            await service.reorderCategories(orderMap);

            expect(mockRepository.save).toHaveBeenCalledTimes(3);
        });
    });

    describe('getStatistics', () => {
        it('should return category statistics', async () => {
            mockRepository.count.mockResolvedValue(15);
            mockRepository.find.mockResolvedValue([mockCategory]);

            const result = await service.getStatistics();

            expect(result).toHaveProperty('totalCategories');
            expect(result).toHaveProperty('visibleCategories');
            expect(result).toHaveProperty('totalArticles');
        });
    });

    describe('edge cases', () => {
        it('should handle Turkish characters in category names', async () => {
            const turkishCategory = {
                name: 'Başlangıç Kılavuzu',
            };

            mockRepository.create.mockReturnValue({
                ...mockCategory,
                ...turkishCategory,
                slug: 'baslangic-kilavuzu',
            });
            mockRepository.save.mockResolvedValue(mockCategory);

            const result = await service.createCategory(turkishCategory);

            expect(result.slug).not.toContain('ş');
            expect(result.slug).not.toContain('ı');
        });

        it('should handle very long category names', async () => {
            const longName = 'A'.repeat(300);

            mockRepository.create.mockReturnValue(mockCategory);
            mockRepository.save.mockResolvedValue(mockCategory);

            const result = await service.createCategory({ name: longName });

            expect(result.slug.length).toBeLessThanOrEqual(255);
        });

        it('should handle duplicate slugs', async () => {
            mockRepository.findOne
                .mockResolvedValueOnce(mockCategory) // Existing category with same slug
                .mockResolvedValueOnce(null);

            mockRepository.create.mockReturnValue({
                ...mockCategory,
                slug: 'getting-started-1',
            });
            mockRepository.save.mockResolvedValue(mockCategory);

            const result = await service.createCategory({ name: 'Getting Started' });

            expect(result.slug).toMatch(/getting-started(-\d+)?/);
        });
    });
});
