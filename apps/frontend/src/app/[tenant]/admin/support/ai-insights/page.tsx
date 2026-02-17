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
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { BccHudTile } from '@/components/brand/BccHudTile';

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
      <div className="flex items-center justify-center h-screen bg-black text-[#9df425] font-mono text-xs uppercase tracking-widest">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Initializing_Neural_Engine...
      </div>
    );
  }

  return (
    <BccEditorialWrapper
      headerTitle="AI_INSIGHTS"
      headerSubtitle="Machine learning performance analytics and model orchestration."
      headerBadge="INTELLIGENCE"
      telemetryData={[
        { label: "GEN_CAPACITY", value: "84%" },
        { label: "INSIGHT_NODES", value: "256" },
        { label: "DRIFT_INDEX", value: "0.02", color: "#9df425" },
        { label: "LATENCY", value: "48ms" }
      ]}
    >
      <div className="space-y-8">
        {/* HUD Metrics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <BccHudTile title="TOTAL_PREDICTIONS" subtitle="Analyzed Nodes" icon="brain">
              <div className="text-3xl font-bold font-mono tracking-tighter text-white">
                {stats.totalPredictions.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                PACKETS_PROCESSED
              </div>
            </BccHudTile>

            <BccHudTile title="AUTO_ASSIGNED" subtitle="Autonomous Logic" icon="zap">
              <div className="text-3xl font-bold font-mono tracking-tighter text-white">
                {stats.autoAssigned.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#9df425] mt-1">
                {stats.totalPredictions > 0
                  ? Math.round((stats.autoAssigned / stats.totalPredictions) * 100)
                  : 0}% AUTOMATION_RATE
              </div>
              <Progress
                value={
                  stats.totalPredictions > 0
                    ? (stats.autoAssigned / stats.totalPredictions) * 100
                    : 0
                }
                className="mt-3 h-1 bg-white/5"
              />
            </BccHudTile>

            <BccHudTile title="AVG_CONFIDENCE" subtitle="Certainty Score" icon="trending_up">
              <div className="text-3xl font-bold font-mono tracking-tighter text-[#9df425]">
                {stats.averageConfidence}%
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#9df425]/60 mt-1">
                THRESHOLD_MET
              </div>
              <Progress value={stats.averageConfidence} className="mt-3 h-1 bg-white/5" />
            </BccHudTile>

            <BccHudTile title="ACCURACY_RATE" subtitle="Correct Predictions" icon="target">
              <div className="text-3xl font-bold font-mono tracking-tighter text-white">
                {stats.accuracyRate}%
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#ff8c00] mt-1">
                VALIDATION_SUCCESS
              </div>
              <Progress value={stats.accuracyRate} className="mt-3 h-1 bg-white/5" />
            </BccHudTile>
          </div>
        )}

        {/* Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {trainingData && (
              <Card className="bg-white/[0.02] border-white/5 shadow-2xl rounded-sm">
                <CardHeader className="border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#9df425]" />
                    <CardTitle className="text-sm font-mono uppercase tracking-widest text-white/80">Model_Training_Results</CardTitle>
                  </div>
                  <CardDescription className="text-xs font-mono text-white/40">
                    LAST_SYNC: {new Date(trainingData.lastTrainedAt).toLocaleString('tr-TR')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                  {/* Training Stats Block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-sm">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Dataset_Volume</p>
                        <p className="text-2xl font-bold font-mono text-white tracking-tighter">{trainingData.ticketCount.toLocaleString()}</p>
                      </div>
                      <Activity className="h-6 w-6 text-[#9df425] opacity-50" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-sm">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Node_Accuracy</p>
                        <p className="text-2xl font-bold font-mono text-[#9df425] tracking-tighter">{trainingData.accuracy}%</p>
                      </div>
                      <Target className="h-6 w-6 text-[#9df425] opacity-50" />
                    </div>
                  </div>

                  {/* Category Distribution */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/40 mb-6">Categorical_Distribution</h3>
                    <div className="grid grid-cols-1 gap-6">
                      {trainingData.categories
                        .filter((cat) => cat.sampleCount > 0)
                        .sort((a, b) => b.sampleCount - a.sampleCount)
                        .map((category) => (
                          <div key={category.id} className="space-y-2 group">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-white/70 uppercase tracking-wider group-hover:text-[#9df425] transition-colors">{category.name}</span>
                              <Badge variant="outline" className="rounded-none border-white/5 text-white/30 text-[9px] font-mono h-4 bg-white/5">
                                {category.sampleCount} SAMPLES
                              </Badge>
                            </div>
                            <div className="relative pt-1">
                              <Progress
                                value={(category.sampleCount / trainingData.ticketCount) * 100}
                                className="h-1 bg-white/5"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info Section */}
            <Card className="bg-white/[0.02] border-white/5 rounded-sm">
              <CardHeader className="border-b border-white/5 bg-black/10 px-6 py-4">
                <CardTitle className="text-xs font-mono uppercase tracking-[0.2em] text-white/60">System_Architecture_Protocol</CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#9df425] flex items-center gap-2">
                    <div className="w-1 h-1 bg-[#9df425]" /> HELIX_NEURAL_LOGIC
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-mono">
                    System analyzes string headers and body blobs to determine optimal nodal categorization.
                    Uses recurring dataset patterns to evolve assignment logic.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-[#ff8c00] flex items-center gap-2">
                    <div className="w-1 h-1 bg-[#ff8c00]" /> CONFIDENCE_THRESHOLD
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed font-mono">
                    Autonomous assignment executes at confidence values &gt;60%.
                    Under-threshold entries are routed to manual operator queue for verification.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar / Secondary Info */}
          <div className="space-y-6">
            <div className="p-4 border border-[#9df425]/10 bg-[#9df425]/5 rounded-sm">
              <h5 className="text-[10px] font-mono uppercase tracking-widest text-[#9df425] mb-2">Operational_Tip</h5>
              <p className="text-[11px] text-white/60 font-mono italic">
                "Frequent training cycles improve Accuracy Rates but require high-quality sample data."
              </p>
            </div>

            <div className="p-6 border border-white/5 bg-black/40 rounded-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#9df425] animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/80">Realtime_Processing</span>
              </div>
              <div className="h-20 flex items-end gap-1">
                {[40, 70, 45, 90, 65, 80, 30, 55, 75, 50, 40, 85].map((h, i) => (
                  <div key={i} className="flex-1 bg-[#9df425]/20 border-t border-[#9df425]/40" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-[9px] font-mono text-white/30 text-center uppercase tracking-tighter">Live_Packet_Distribution</p>
            </div>
          </div>
        </div>
      </div>
    </BccEditorialWrapper>
  );
}
