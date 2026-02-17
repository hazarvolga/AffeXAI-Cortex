import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface UsageStats {
    used: number;
    limit: number;
    remaining: number;
    periodEnd: string;
}

export const UsageHUD: React.FC = () => {
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const res = await axios.get('/api/commerce/usage');
                setUsage(res.data);
            } catch (err) {
                console.error('Failed to fetch usage', err);
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchUsage();

        // Optional: Poll every minute or listen for events
        const interval = setInterval(fetchUsage, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !usage) return null; // Don't show if loading or error

    const percentage = Math.min((usage.used / usage.limit) * 100, 100);
    const isCritical = percentage >= 90;
    const isWarning = percentage >= 75;

    return (
        <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm w-full max-w-sm">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">AI Token Usage</span>
                <Badge variant={isCritical ? 'destructive' : isWarning ? 'secondary' : 'outline'}>
                    {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
                </Badge>
            </div>

            <Progress value={percentage} className={`h-2 ${isCritical ? 'bg-destructive/20' : ''}`} indicatorClassName={isCritical ? 'bg-destructive' : isWarning ? 'bg-yellow-500' : ''} />

            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{percentage.toFixed(0)}% Used</span>
                <span>Resets {new Date(usage.periodEnd).toLocaleDateString()}</span>
            </div>

            {isCritical && (
                <Alert variant="destructive" className="mt-4 py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Limit Reached Soon</AlertTitle>
                    <AlertDescription>
                        You have used {percentage.toFixed(0)}% of your monthly limit.
                        <a href="/pricing" className="underline font-bold ml-1">Upgrade Plan</a>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};
