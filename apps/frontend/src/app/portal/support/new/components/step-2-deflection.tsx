import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { faqService, FaqSearchResult } from '@/lib/api/faqService';
import { Loader2, ThumbsUp, ThumbsDown, Search, ArrowRight, ArrowLeft, ExternalLink, FileText, HelpCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce'; // Assuming you have this hook, or I'll implement a simple one inside.
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { fileUploadService } from '@/lib/api/fileUploadService';

// Simple debounce hook implementation if not available
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

interface Step2DeflectionProps {
    categoryId: string;
    categoryName: string;
    onBack: () => void;
    onSolved: () => void;
    onNext: (data: { title: string; description: string }) => void;
}

export function Step2Deflection({ categoryId, categoryName, onBack, onSolved, onNext }: Step2DeflectionProps) {
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<FaqSearchResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [helpfulId, setHelpfulId] = useState<string | null>(null);

    // Combine title and description for search context
    const debouncedQuery = useDebounceValue(`${title} ${description}`.trim(), 800);

    useEffect(() => {
        if (debouncedQuery.length > 5) {
            performSearch(debouncedQuery);
        } else {
            setResults([]);
            setHasSearched(false);
        }
    }, [debouncedQuery]);

    const performSearch = async (query: string) => {
        setIsSearching(true);
        try {
            const response = await faqService.search({
                query,
                category: categoryId, // Scope search to selected category
                limit: 5,
                include_articles: true
            });
            setResults(response.faqs || []);
            setHasSearched(true);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleHelpful = async (item: FaqSearchResult) => {
        try {
            await faqService.markHelpful(item.id, true);
            setHelpfulId(item.id);
            toast({
                title: 'Teşekkürler! 🎉',
                description: 'Geri bildiriminiz için teşekkürler. Sorunun çözülmesine sevindik.',
            });
            setTimeout(() => {
                onSolved();
            }, 1500);
        } catch (error) {
            console.error('Feedback error:', error);
        }
    };

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            toast({
                title: 'Eksik Bilgi',
                description: 'Lütfen başlık ve açıklama alanlarını doldurun.',
                variant: 'destructive',
            });
            return;
        }
        onNext({ title, description });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Button variant="ghost" size="sm" onClick={onBack} className="h-auto p-0 hover:bg-transparent">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Kategoriler
                </Button>
                <span>/</span>
                <span className="font-medium text-foreground">{categoryName}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Problem Definition Form */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sorununuzu Anlatın</CardTitle>
                            <CardDescription>
                                Yaşadığınız sorunu detaylıca yazın. Size en uygun çözümü bulmaya çalışacağız.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form id="deflection-form" onSubmit={handleNext} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Konu Özeti (Başlık)</Label>
                                    <Input
                                        id="title"
                                        placeholder="Örn: Faturamda hata var"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Detaylı Açıklama</Label>
                                    <RichTextEditor
                                        content={description}
                                        onChange={setDescription}
                                        placeholder="Sorunun ne zaman başladığını ve aldığınız hata mesajlarını ekleyin..."
                                        onFileUpload={async (file) => {
                                            const uploaded = await fileUploadService.uploadFile(file);
                                            return uploaded.url;
                                        }}
                                    />
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6 bg-muted/20">
                            <div className="text-xs text-muted-foreground flex items-center">
                                {isSearching ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                        Çözümler aranıyor...
                                    </>
                                ) : (
                                    hasSearched && (
                                        <>
                                            <Search className="h-3 w-3 mr-2" />
                                            {results.length} çözüm bulundu
                                        </>
                                    )
                                )}
                            </div>
                            <Button type="submit" form="deflection-form">
                                Devam Et <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Right: Smart Suggestions (Deflection) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg flex items-center">
                            <span className="bg-primary/10 p-1.5 rounded-full mr-2">
                                <HelpCircle className="h-4 w-4 text-primary" />
                            </span>
                            Önerilen Çözümler
                        </h3>
                    </div>

                    <ScrollArea className="h-[500px] pr-4">
                        {isSearching ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <Card key={i} className="animate-pulse">
                                        <CardHeader className="p-4 space-y-2">
                                            <div className="h-4 bg-muted rounded w-3/4"></div>
                                            <div className="h-3 bg-muted rounded w-full"></div>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-4">
                                {results.map((result) => (
                                    <Card
                                        key={result.id}
                                        className={`transition-all duration-300 ${helpfulId === result.id ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'hover:shadow-md'}`}
                                    >
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="text-sm font-medium leading-tight">
                                                    {result.type === 'article' ? (
                                                        <span className="flex items-center gap-2">
                                                            <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                                            {result.question}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-2">
                                                            <HelpCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                                                            {result.question}
                                                        </span>
                                                    )}
                                                </CardTitle>
                                                {result.confidence > 90 && (
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-green-100 text-green-700 hover:bg-green-100">
                                                        %95 Eşleşme
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-2 space-y-3">
                                            <p className="text-xs text-muted-foreground line-clamp-3">
                                                {result.answer.replace(/<[^>]*>?/gm, '')}
                                            </p>

                                            {helpfulId === result.id ? (
                                                <div className="flex items-center justify-center text-green-600 dark:text-green-400 text-sm font-medium py-2 animate-in zoom-in">
                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                    Çözüldü olarak işaretlendi
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between pt-2 border-t mt-2">
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleHelpful(result)}>
                                                        <ThumbsUp className="h-3 w-3 mr-1.5" />
                                                        Bu Çözdü
                                                    </Button>
                                                    <Link href={result.url || '#'} target="_blank">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                                                            Oku
                                                            <ExternalLink className="h-3 w-3 ml-1.5" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            // Empty State
                            <Card className="border-dashed bg-muted/30">
                                <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <div className="mb-4 p-3 bg-background rounded-full">
                                        <Search className="h-6 w-6 opacity-50" />
                                    </div>
                                    <p className="text-sm">
                                        {debouncedQuery.length > 0
                                            ? 'Bu konuda henüz bir makalemiz yok. Lütfen "Devam Et" butonuna tıklayarak destek ekibimizle iletişime geçin.'
                                            : 'Sorununuzu yazmaya başladığınızda burada size özel çözümler belirecek.'}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
