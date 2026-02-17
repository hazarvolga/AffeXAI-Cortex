'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cmsService } from '@/lib/cms/cms-service';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface CreatePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pageId: string) => void;
}

/**
 * Generate URL-friendly slug from text (Turkish character support)
 */
function generateSlug(text: string): string {
  const turkishMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'C',
    'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'İ': 'I',
    'ö': 'o', 'Ö': 'O',
    'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U',
  };

  let slug = text;

  // Replace Turkish characters
  Object.keys(turkishMap).forEach(key => {
    slug = slug.replace(new RegExp(key, 'g'), turkishMap[key]);
  });

  // Convert to lowercase, replace spaces with hyphens, remove special characters
  slug = slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end

  return slug;
}

export function CreatePageDialog({ open, onOpenChange, onSuccess }: CreatePageDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [slug, setSlug] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(true);
  const [autoSlug, setAutoSlug] = useState(true);
  const { toast } = useToast();

  // Fetch categories on mount
  useEffect(() => {
    if (open) {
      fetchCategories();
      // Reset form
      setTitle('');
      setDescription('');
      setCategoryId('');
      setSlug('');
      setAutoSlug(true);
    }
  }, [open]);

  // Auto-generate slug when title or category changes
  useEffect(() => {
    if (autoSlug && title) {
      const selectedCategory = categories.find(c => c.id === categoryId);
      const categoryPath = selectedCategory ? `${selectedCategory.slug}/` : '';
      const titleSlug = generateSlug(title);
      setSlug(`${categoryPath}${titleSlug}`);
    }
  }, [title, categoryId, autoSlug, categories]);

  const fetchCategories = async () => {
    try {
      setFetchingCategories(true);
      const categoriesData = await cmsService.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast({
        title: 'Hata',
        description: 'Kategoriler yüklenirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setFetchingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Uyarı',
        description: 'Lütfen sayfa başlığını girin.',
        variant: 'destructive',
      });
      return;
    }

    if (!categoryId) {
      toast({
        title: 'Uyarı',
        description: 'Lütfen bir kategori seçin.',
        variant: 'destructive',
      });
      return;
    }

    if (!slug.trim()) {
      toast({
        title: 'Uyarı',
        description: 'Slug boş olamaz.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const createdPage = await cmsService.createPage({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        categoryId: categoryId,
      });

      toast({
        title: 'Başarılı',
        description: 'Sayfa başarıyla oluşturuldu.',
      });

      onOpenChange(false);
      onSuccess(createdPage.id);
    } catch (error: any) {
      console.error('Failed to create page:', error);

      const errorMessage = error.response?.data?.message || 'Sayfa oluşturulurken bir hata oluştu.';

      toast({
        title: 'Hata',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical category display
  const buildCategoryLabel = (category: Category): string => {
    const parent = categories.find(c => c.id === category.parentId);
    if (parent) {
      return `${buildCategoryLabel(parent)} → ${category.name}`;
    }
    return category.name;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Yeni Sayfa Oluştur</DialogTitle>
            <DialogDescription>
              Sayfa başlığını ve kategorisini girin. Slug otomatik olarak oluşturulacaktır.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Sayfa Başlığı <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Allplan 2024 Architecture"
                autoFocus
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label htmlFor="category">
                Kategori <span className="text-destructive">*</span>
              </Label>
              {fetchingCategories ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Kategoriler yükleniyor...</span>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {buildCategoryLabel(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Kategori slug'ı otomatik olarak URL'e eklenecektir.
              </p>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sayfa açıklaması (SEO için önemli)"
                rows={3}
              />
            </div>

            {/* Slug (Auto-generated) */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="slug">
                  Slug <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="h-auto py-1 text-xs"
                >
                  {autoSlug ? '🔒 Otomatik' : '🔓 Manuel'}
                </Button>
              </div>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setAutoSlug(false);
                }}
                placeholder="kategori-slug/sayfa-slug"
                disabled={autoSlug}
                className={autoSlug ? 'bg-muted' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {autoSlug
                  ? 'Başlık ve kategoriye göre otomatik oluşturulur.'
                  : 'Manuel düzenleme modu aktif.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading || !title.trim() || !categoryId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
