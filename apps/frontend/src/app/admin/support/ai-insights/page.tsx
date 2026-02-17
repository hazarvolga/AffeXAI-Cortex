'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  TrendingUp,
  Target,
  Zap,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AIStats {
  totalPredictions: number;
  autoAssigned: number;
  averageConfidence: number;
  accuracyRate: number;
}

interface TrainingData {
  ticketCount: number;
  accuracy: number;
  lastTrainedAt: string;
  categories: Array<{
    id: string;
    name: string;
    sampleCount: number;
  }>;
}

export default function AIInsightsPage() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tickets/ai/stats');

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch AI stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    try {
      setTraining(true);

      const response = await fetch('/api/tickets/ai/train', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setTrainingData(data);
        // Refresh stats after training
        await fetchStats();
      }
    } catch (error) {
      console.error('Failed to train model:', error);
    } finally {
      setTraining(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-600" />
            AI Insights & Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            AI destekli ticket kategorizasyon performansı
          </p>
        </div>
        <Button onClick={handleTrainModel} disabled={training}>
          {training ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Eğitiliyor...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Modeli Eğit
            </>
          )}
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Predictions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Tahmin</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPredictions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI tarafından analiz edilen ticket
              </p>
            </CardContent>
          </Card>

          {/* Auto-assigned */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Otomatik Atama</CardTitle>
              <Zap className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.autoAssigned.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalPredictions > 0
                  ? Math.round((stats.autoAssigned / stats.totalPredictions) * 100)
                  : 0}
                % otomatik kategorilendirildi
              </p>
              <Progress
                value={
                  stats.totalPredictions > 0
                    ? (stats.autoAssigned / stats.totalPredictions) * 100
                    : 0
                }
                className="mt-2"
              />
            </CardContent>
          </Card>

          {/* Average Confidence */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ortalama Güven</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageConfidence}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI tahmin güven skoru
              </p>
              <Progress value={stats.averageConfidence} className="mt-2" />
            </CardContent>
          </Card>

          {/* Accuracy Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Doğruluk Oranı</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.accuracyRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Doğru kategori tahmini
              </p>
              <Progress value={stats.accuracyRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Training Data */}
      {trainingData && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>Model Eğitim Sonuçları</CardTitle>
            </div>
            <CardDescription>
              Son eğitim: {new Date(trainingData.lastTrainedAt).toLocaleString('tr-TR')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Training Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Eğitim Verisi</p>
                  <p className="text-2xl font-bold">{trainingData.ticketCount.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Model Doğruluğu</p>
                  <p className="text-2xl font-bold">{trainingData.accuracy}%</p>
                </div>
                <Target className="h-8 w-8 text-green-600" />
              </div>
            </div>

            {/* Category Distribution */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Kategori Dağılımı</h3>
              <div className="space-y-3">
                {trainingData.categories
                  .filter((cat) => cat.sampleCount > 0)
                  .sort((a, b) => b.sampleCount - a.sampleCount)
                  .map((category) => (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{category.name}</span>
                        <Badge variant="secondary">{category.sampleCount} örnek</Badge>
                      </div>
                      <Progress
                        value={(category.sampleCount / trainingData.ticketCount) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Kategorizasyon Hakkında</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">🤖 Nasıl Çalışır?</h4>
            <p className="text-sm text-muted-foreground">
              AI sistemi, ticket başlığı ve açıklamasını analiz ederek en uygun kategoriyi tahmin
              eder. Makine öğrenimi teknikleri kullanılarak geçmiş verilere dayalı öğrenir.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">📊 Güven Skoru</h4>
            <p className="text-sm text-muted-foreground">
              %60+ güven skoru ile otomatik kategorizasyon yapılır. Düşük güven skorlarında manuel
              onay gerekir.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">🎯 Model Eğitimi</h4>
            <p className="text-sm text-muted-foreground">
              Düzenli model eğitimi ile doğruluk oranı artar. Yeni verilerle modeli güncel tutun.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
