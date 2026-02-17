'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Search,
  MessageSquare,
  User,
  Calendar,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Tag
} from 'lucide-react';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { BccHudTile } from '@/components/brand/BccHudTile';

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
  // removed unused setEditedCategory and setEditedKeywords for now to fix lint if needed, keeping simple

  useEffect(() => {
    loadReviewQueue();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]); // removed filters dependency if it causes loop, but likely fine

  const loadStats = async () => {
    try {
      // Mock stats for UI
      setStats({
        total: 124,
        pendingReview: 42,
        approved: 89,
        rejected: 12,
        published: 76,
        averageConfidence: 92
      });

      // Real implementation would be:
      // const { FaqLearningService } = await import('@/services/faq-learning.service');
      // const data = await FaqLearningService.getReviewStats();
      // setStats(data);
    } catch (error) {
      console.error('Review stats yüklenemedi:', error);
    }
  };

  const loadReviewQueue = async () => {
    setIsLoading(true);
    try {
      // Mock Data for UI Dev
      const mockItems: FaqReviewItem[] = Array.from({ length: 5 }).map((_, i) => ({
        id: `FAQ-${1000 + i}`,
        question: i === 0 ? "How do I reset my API key?" : `System Integration Question #${i + 1}`,
        answer: "You can reset your API key in the Developer Settings panel. Navigate to Settings > API Access and click 'Regenerate Token'.",
        confidence: 85 + (i * 2),
        status: 'pending_review',
        source: i % 2 === 0 ? 'chat' : 'ticket',
        sourceId: `SRC-${500 + i}`,
        category: 'Technical',
        keywords: ['api', 'auth', 'integration'],
        usageCount: 12 + i,
        helpfulCount: 5,
        notHelpfulCount: 0,
        createdAt: new Date()
      }));

      setReviewItems(mockItems);
      setTotalPages(1);
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
    setReviewAction('approve');
    setReviewReason('');
    setIsReviewModalOpen(true);
  };

  const handleReview = async () => {
    if (!currentItem) return;
    console.log('Processed review for', currentItem.id, reviewAction);
    setIsReviewModalOpen(false);
    loadReviewQueue();
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedItems.length === 0) return;
    console.log('Bulk action', action, selectedItems);
    setSelectedItems([]);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-[#9df425] border-[#9df425]/30 bg-[#9df425]/10';
    if (confidence >= 75) return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    return 'text-red-500 border-red-500/30 bg-red-500/10';
  };

  const getSourceIcon = (source: string) => {
    return source === 'chat' ? <MessageSquare className="h-3 w-3" /> : <User className="h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <BccEditorialWrapper>
        <div className="flex items-center justify-center h-full text-white/50">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-4 font-mono uppercase tracking-widest text-xs">Loading Protocol...</span>
        </div>
      </BccEditorialWrapper>
    );
  }

  return (
    <BccEditorialWrapper
      headerTitle="FAQ Review Queue"
      headerSubtitle="AI Assurance Protocol // Neural Learning Review"
      headerBadge="AI Training"
      telemetryData={[
        { label: "Items in Queue", value: stats.pendingReview.toString() },
        { label: "Confidence", value: stats.averageConfidence.toString(), suffix: "%", color: "#9df425" }
      ]}
    >
      <div className="space-y-8 pb-20">

        {/* HUD Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <BccHudTile title="Pending Review" subtitle="Action Required" icon="schedule" accentColor="#ff8c00">
            <div className="text-3xl font-bold font-mono tracking-tighter text-white">
              {stats.pendingReview}
            </div>
          </BccHudTile>

          <BccHudTile title="Approved" subtitle="Validated Knowledge" icon="verified" accentColor="#9df425">
            <div className="text-3xl font-bold font-mono tracking-tighter text-white">
              {stats.approved}
            </div>
          </BccHudTile>

          <BccHudTile title="Confidence" subtitle="AI Accuracy" icon="analytics" accentColor="#3b82f6">
            <div className="text-3xl font-bold font-mono tracking-tighter text-white">
              {stats.averageConfidence}<span className="text-lg text-white/50">%</span>
            </div>
          </BccHudTile>

          <BccHudTile title="Published" subtitle="In Knowledge Base" icon="public" accentColor="#ec4899">
            <div className="text-3xl font-bold font-mono tracking-tighter text-white">
              {stats.published}
            </div>
          </BccHudTile>
        </div>

        {/* Filters Panel */}
        <div className="border border-white/5 bg-[#0a0a0a]/40 backdrop-blur-md p-6 relative group overflow-hidden">
          <div className="absolute top-0 left-0 w-0.5 h-full bg-white/10 group-hover:bg-[#9df425] transition-colors duration-500"></div>

          <div className="flex items-center gap-3 mb-6">
            <Filter className="h-3 w-3 text-[#9df425]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Filter Protocols</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Search Query</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3 w-3 text-white/30" />
                <Input
                  placeholder="SEARCH_DB..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9 bg-black/20 border-white/10 text-xs font-mono text-white focus:border-[#9df425]/50 h-8 rounded-none transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Review Status</Label>
              <Select value={filters.status[0]} onValueChange={(value) => setFilters({ ...filters, status: [value] })}>
                <SelectTrigger className="bg-black/20 border-white/10 text-xs font-mono text-white h-8 rounded-none focus:border-[#9df425]/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none">
                  <SelectItem value="pending_review">PENDING REVIEW</SelectItem>
                  <SelectItem value="approved">APPROVED</SelectItem>
                  <SelectItem value="rejected">REJECTED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Source</Label>
              <Select>
                <SelectTrigger className="bg-black/20 border-white/10 text-xs font-mono text-white h-8 rounded-none focus:border-[#9df425]/50">
                  <SelectValue placeholder="ALL SOURCES" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none">
                  <SelectItem value="chat">CHAT</SelectItem>
                  <SelectItem value="ticket">TICKET</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Category</Label>
              <Select>
                <SelectTrigger className="bg-black/20 border-white/10 text-xs font-mono text-white h-8 rounded-none focus:border-[#9df425]/50">
                  <SelectValue placeholder="ALL CATEGORIES" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/10 text-white rounded-none">
                  <SelectItem value="account">ACCOUNT</SelectItem>
                  <SelectItem value="technical">TECHNICAL</SelectItem>
                  <SelectItem value="billing">BILLING</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedItems.length > 0 && (
          <div className="bg-[#9df425]/5 border border-[#9df425]/20 p-3 px-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-[#9df425]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                {selectedItems.length} Items Selected
              </span>
            </div>
            <div className="flex gap-3">
              <Button size="sm" onClick={() => handleBulkAction('approve')} className="bg-[#9df425] text-black hover:bg-[#9df425]/80 border-none text-[10px] uppercase font-bold tracking-widest h-8 rounded-none">
                <CheckCircle className="h-3 w-3 mr-2" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('reject')} className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-400 text-[10px] uppercase font-bold tracking-widest h-8 rounded-none">
                <XCircle className="h-3 w-3 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}

        {/* Review List */}
        <div>
          <div className="flex items-center justify-between py-4 px-2 border-b border-white/5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9df425]"></span>
              Review Queue Registry
            </h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={reviewItems.length > 0 && selectedItems.length === reviewItems.length}
                onCheckedChange={handleSelectAll}
                className="border-white/20 data-[state=checked]:bg-[#9df425] data-[state=checked]:text-black rounded-none h-4 w-4"
              />
              <Label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Select All</Label>
            </div>
          </div>

          <div className="space-y-px mt-px">
            {reviewItems.map((item) => (
              <div key={item.id} className="group relative bg-[#0a0a0a]/20 border border-transparent hover:border-white/5 hover:bg-white/[0.02] transition-all p-4 pr-32">
                {/* Hover line */}
                <div className="absolute left-0 top-0 w-0.5 h-full bg-transparent group-hover:bg-[#9df425] transition-colors duration-300"></div>

                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={(checked) => handleItemSelect(item.id, checked as boolean)}
                    className="mt-1.5 border-white/10 data-[state=checked]:bg-[#9df425] data-[state=checked]:text-black rounded-none h-4 w-4"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[#9df425] font-mono text-[9px] uppercase tracking-wider opacity-50 group-hover:opacity-100 transition-opacity">
                        {item.id}
                      </span>

                      <Badge variant="outline" className={`rounded-none bg-transparent text-[9px] font-bold font-mono tracking-wider uppercase px-2 py-0 ${getConfidenceColor(item.confidence)}`}>
                        {item.confidence}% Confidence
                      </Badge>

                      {item.category && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-none border border-white/5 bg-white/[0.02]">
                          <Tag className="h-2.5 w-2.5 text-white/30" />
                          <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">{item.category}</span>
                        </div>
                      )}
                    </div>

                    <h4 className="text-white font-medium text-sm mb-1.5 truncate pr-8">{item.question}</h4>
                    <p className="text-white/40 text-xs line-clamp-2 font-light pr-12 leading-relaxed font-mono">
                      {item.answer}
                    </p>

                    <div className="flex items-center gap-6 mt-4 opacity-40 group-hover:opacity-80 transition-opacity">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold">
                        {getSourceIcon(item.source)}
                        <span>{item.source}</span>
                      </div>
                      <div className="h-3 w-px bg-white/20"></div>
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold">
                        <Eye className="h-3 w-3" />
                        <span>{item.usageCount} Views</span>
                      </div>
                      <div className="h-3 w-px bg-white/20"></div>
                      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold">
                        <Calendar className="h-3 w-3" />
                        <span>{item.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Overlay */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <Button
                    size="sm"
                    onClick={() => openReviewModal(item)}
                    className="bg-white/5 hover:bg-[#9df425] hover:text-black border border-white/10 text-white text-[9px] uppercase font-bold tracking-widest h-8 px-5 rounded-none"
                  >
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
            <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold pl-2">
              Displaying {reviewItems.length} of {reviewItems.length} Records
            </div>
            <div className="flex items-center gap-1 pr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 w-8 p-0 rounded-none disabled:opacity-20"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-4 text-[10px] font-mono text-white/40">
                <span className="text-white">{currentPage}</span> / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 w-8 p-0 rounded-none disabled:opacity-20"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="bg-[#0a0a0a] border border-white/10 text-white max-w-4xl shadow-2xl p-0 gap-0 overflow-hidden rounded-none">
          <DialogHeader className="border-b border-white/5 p-6 bg-white/[0.02]">
            <DialogTitle className="text-lg font-bold uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#9df425] animate-pulse"></span>
              Review Protocol
            </DialogTitle>
          </DialogHeader>

          {currentItem && (
            <div className="grid grid-cols-5 h-[600px]">
              {/* Left: Item Details */}
              <div className="col-span-3 border-r border-white/5 p-8 overflow-y-auto custom-scrollbar bg-[#050505]">
                <div className="space-y-8">
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-[#9df425] font-bold mb-3 block">User Inquiry</Label>
                    <div className="p-5 bg-white/[0.02] border border-white/5 text-sm leading-relaxed font-light">
                      {currentItem.question}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-[#9df425] font-bold mb-3 block">Generated Response</Label>
                    <div className="p-5 bg-white/[0.02] border border-white/5 text-sm leading-relaxed text-white/80 font-mono">
                      {currentItem.answer}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold block mb-1">Confidence Score</Label>
                      <div className={`text-3xl font-mono tracking-tighter ${getConfidenceColor(currentItem.confidence).split(' ')[0]}`}>
                        {currentItem.confidence}%
                      </div>
                    </div>
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold block mb-1">Source Origin</Label>
                      <div className="text-sm font-mono uppercase text-white/60 flex items-center gap-2">
                        {getSourceIcon(currentItem.source)}
                        {currentItem.source}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold block mb-1">Category</Label>
                      <div className="text-sm font-mono uppercase text-white/60">{currentItem.category}</div>
                    </div>
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold block mb-1">Keywords</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentItem.keywords.map(k => (
                          <span key={k} className="text-[9px] px-1.5 py-0.5 border border-white/10 rounded-none text-white/40">{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="col-span-2 p-8 bg-[#0a0a0a] flex flex-col">
                <div className="flex-1">
                  <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-4 block">Decision Matrix</Label>

                  <Tabs value={reviewAction} onValueChange={(value) => setReviewAction(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/5 p-1 h-auto rounded-none">
                      <TabsTrigger value="approve" className="data-[state=active]:bg-[#9df425] data-[state=active]:text-black text-[9px] uppercase font-bold tracking-widest py-2 rounded-none transition-all">Approve</TabsTrigger>
                      <TabsTrigger value="edit" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-[9px] uppercase font-bold tracking-widest py-2 rounded-none transition-all">Edit</TabsTrigger>
                      <TabsTrigger value="reject" className="data-[state=active]:bg-red-500 data-[state=active]:text-white text-[9px] uppercase font-bold tracking-widest py-2 rounded-none transition-all">Reject</TabsTrigger>
                    </TabsList>

                    <TabsContent value="approve" className="mt-6 animate-in slide-in-from-top-2">
                      <div className="p-4 border border-[#9df425]/20 bg-[#9df425]/5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-[#9df425]">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Publish Action</span>
                        </div>
                        <p className="text-[10px] text-[#9df425]/70 leading-relaxed font-mono">
                          Item will be indexed in the Knowledge Base and available for live responses immediately.
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="edit" className="mt-6 space-y-4 animate-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <Label className="text-[9px] uppercase tracking-widest text-white/40">Refine Response</Label>
                        <Textarea
                          value={editedAnswer}
                          onChange={(e) => setEditedAnswer(e.target.value)}
                          className="bg-black/40 border-white/10 text-xs h-40 font-mono resize-none focus:border-white/20 rounded-none"
                          placeholder="Edit the answer content..."
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="reject" className="mt-6 animate-in slide-in-from-top-2">
                      <div className="p-4 border border-red-500/20 bg-red-500/5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-red-500">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Discard Action</span>
                        </div>
                        <p className="text-[10px] text-red-500/70 leading-relaxed font-mono">
                          Item will be marked as a false positive and used to retrain the model to avoid similar generations.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="mt-8 space-y-2">
                    <Label className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Internal Notes (Optional)</Label>
                    <Textarea
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      className="bg-black/20 border-white/10 text-xs min-h-[100px] resize-none rounded-none focus:border-white/20 font-mono"
                      placeholder="Add context for this decision..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8 pt-6 border-t border-white/5">
                  <Button variant="outline" onClick={() => setIsReviewModalOpen(false)} className="border-white/10 hover:bg-white/5 text-white text-[10px] uppercase font-bold tracking-widest h-10 rounded-none">
                    Cancel
                  </Button>
                  <Button onClick={handleReview} className="bg-[#9df425] hover:bg-[#9df425]/90 text-black text-[10px] uppercase font-bold tracking-widest h-10 rounded-none">
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BccEditorialWrapper>
  );
}