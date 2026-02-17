'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Edit3, 
  Filter,
  Search,
  Clock,
  TrendingUp,
  MessageSquare,
  User,
  Calendar,
  Tag,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface FaqReviewItem {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  status: 'pending_review' | 'approved' | 'rejected';
  source: 'chat' | 'ticket';
  sourceId: string;
  category?: string;
  keywords: string[];
  usageCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ReviewFilters {
  status: string[];
  confidence: { min: number; max: number };
  source: string[];
  category: string[];
  search: string;
}

export default function ReviewQueuePage() {
  const [reviewItems, setReviewItems] = useState<FaqReviewItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState<FaqReviewItem | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<ReviewFilters>({
    status: ['pending_review'],
    confidence: { min: 0, max: 100 },
    source: [],
    category: [],
    search: ''
  });
  
  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    averageConfidence: 0
  });

  // Review form state
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'edit'>('approve');
  const [reviewReason, setReviewReason] = useState('');
  const [editedAnswer, setEditedAnswer] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [editedKeywords, setEditedKeywords] = useState<string[]>([]);

  useEffect(() => {
    loadReviewQueue();
    loadStats();
  }, [currentPage, filters]);

  const loadStats = async () => {
    try {
      const { FaqLearningService } = await import('@/services/faq-learning.service');
      const data = await FaqLearningService.getReviewStats();
      setStats(data);
    } catch (error) {
      console.error('Review stats yüklenemedi:', error);
    }
  };

  const loadReviewQueue = async () => {
    setIsLoading(true);
    try {
      const { FaqLearningService } = await import('@/services/faq-learning.service');
      const data = await FaqLearningService.getReviewQueue({
        status: filters.status,
        confidence: filters.confidence,
        source: filters.source,
        category: filters.category,
        page: currentPage,
        limit: 10
      });

      setReviewItems(data.items as FaqReviewItem[]);
      setTotalPages(data.totalPages);
      setIsLoading(false);
    } catch (error) {
      console.error('Review queue yüklenemedi:', error);
      setReviewItems([]);
      setTotalPages(1);
      setIsLoading(false);
    }
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(reviewItems.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const openReviewModal = (item: FaqReviewItem) => {
    setCurrentItem(item);
    setEditedAnswer(item.answer);
    setEditedCategory(item.category || '');
    setEditedKeywords(item.keywords);
    setReviewAction('approve');
    setReviewReason('');
    setIsReviewModalOpen(true);
  };

  const handleReview = async () => {
    if (!currentItem) return;

    try {
      const { FaqLearningService } = await import('@/services/faq-learning.service');
      
      const result = await FaqLearningService.reviewFaq(
        currentItem.id,
        reviewAction,
        {
          reason: reviewReason,
          editedAnswer: reviewAction === 'edit' ? editedAnswer : undefined,
          editedCategory: reviewAction === 'edit' ? editedCategory : undefined,
          editedKeywords: reviewAction === 'edit' ? editedKeywords : undefined
        }
      );

      if (result.success) {
        console.log('FAQ başarıyla incelendi:', result.message);
        setIsReviewModalOpen(false);
        loadReviewQueue(); // Refresh the list
        loadStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Review işlemi başarısız:', error);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedItems.length === 0) return;

    try {
      const { FaqLearningService } = await import('@/services/faq-learning.service');
      
      const result = await FaqLearningService.bulkReview(
        selectedItems,
        action,
        `Toplu ${action === 'approve' ? 'onay' : 'red'}`
      );

      if (result.success) {
        console.log('Toplu işlem başarılı:', result.message);
        setSelectedItems([]);
        loadReviewQueue(); // Refresh the list
        loadStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Toplu işlem başarısız:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-600 bg-green-50';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSourceIcon = (source: string) => {
    return source === 'chat' ? <MessageSquare className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">İnceleme kuyruğu yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FAQ İnceleme Kuyruğu</h1>
          <p className="text-muted-foreground">
            AI tarafından oluşturulan FAQ'ları inceleyin ve onaylayın
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReviewQueue}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold">{stats.pendingReview}</div>
                <div className="text-sm text-muted-foreground">İnceleme Bekleyen</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.approved}</div>
                <div className="text-sm text-muted-foreground">Onaylanmış</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{stats.averageConfidence}%</div>
                <div className="text-sm text-muted-foreground">Ortalama Güven</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.published}</div>
                <div className="text-sm text-muted-foreground">Yayınlanmış</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Arama</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Soru veya cevap ara..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Durum</Label>
              <Select value={filters.status[0]} onValueChange={(value) => setFilters({...filters, status: [value]})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">İnceleme Bekleyen</SelectItem>
                  <SelectItem value="approved">Onaylanmış</SelectItem>
                  <SelectItem value="rejected">Reddedilmiş</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kaynak</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm kaynaklar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kategori</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm kategoriler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Hesap Yönetimi</SelectItem>
                  <SelectItem value="technical">Teknik Destek</SelectItem>
                  <SelectItem value="billing">Faturalandırma</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{selectedItems.length} öğe seçildi</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleBulkAction('approve')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Toplu Onayla
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction('reject')}>
                <XCircle className="h-4 w-4 mr-2" />
                Toplu Reddet
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Review Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>FAQ Listesi</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedItems.length === reviewItems.length && reviewItems.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label>Tümünü Seç</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reviewItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={(checked) => handleItemSelect(item.id, checked as boolean)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.question}</h3>
                        <Badge className={getConfidenceColor(item.confidence)}>
                          {item.confidence}% güven
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.answer}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getSourceIcon(item.source)}
                          <span className="capitalize">{item.source}</span>
                        </div>
                        
                        {item.category && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-4 w-4" />
                            <span>{item.category}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{item.createdAt.toLocaleDateString('tr-TR')}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{item.usageCount} görüntüleme</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {item.keywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openReviewModal(item)}>
                      <Eye className="h-4 w-4 mr-2" />
                      İncele
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Toplam {reviewItems.length} öğe
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Sayfa {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>FAQ İncelemesi</DialogTitle>
            <DialogDescription>
              Bu FAQ'yı inceleyin ve uygun eylemi seçin
            </DialogDescription>
          </DialogHeader>

          {currentItem && (
            <div className="space-y-6">
              {/* FAQ Details */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Soru</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    {currentItem.question}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Mevcut Cevap</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    {currentItem.answer}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Güven Skoru</Label>
                    <Badge className={getConfidenceColor(currentItem.confidence)}>
                      {currentItem.confidence}%
                    </Badge>
                  </div>
                  <div>
                    <Label>Kaynak</Label>
                    <div className="flex items-center gap-2">
                      {getSourceIcon(currentItem.source)}
                      <span className="capitalize">{currentItem.source}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Actions */}
              <Tabs value={reviewAction} onValueChange={(value) => setReviewAction(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="approve">Onayla</TabsTrigger>
                  <TabsTrigger value="edit">Düzenle</TabsTrigger>
                  <TabsTrigger value="reject">Reddet</TabsTrigger>
                </TabsList>

                <TabsContent value="approve" className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Bu FAQ onaylanacak ve yayınlanacak.
                    </AlertDescription>
                  </Alert>
                </TabsContent>

                <TabsContent value="edit" className="space-y-4">
                  <div>
                    <Label>Düzenlenmiş Cevap</Label>
                    <Textarea
                      value={editedAnswer}
                      onChange={(e) => setEditedAnswer(e.target.value)}
                      rows={4}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Kategori</Label>
                    <Input
                      value={editedCategory}
                      onChange={(e) => setEditedCategory(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Anahtar Kelimeler (virgülle ayırın)</Label>
                    <Input
                      value={editedKeywords.join(', ')}
                      onChange={(e) => setEditedKeywords(e.target.value.split(',').map(k => k.trim()))}
                      className="mt-1"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="reject" className="space-y-4">
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Bu FAQ reddedilecek ve yayınlanmayacak.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>

              {/* Review Reason */}
              <div>
                <Label>İnceleme Notu (İsteğe bağlı)</Label>
                <Textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Bu kararın nedenini açıklayın..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleReview}>
              {reviewAction === 'approve' ? 'Onayla' : 
               reviewAction === 'edit' ? 'Düzenle ve Onayla' : 'Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}