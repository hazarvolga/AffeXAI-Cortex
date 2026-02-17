'use client';

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DollarSign } from 'lucide-react';

const data = [
    { name: 'Jan', revenue: 4000, cloudCost: 240, localSavings: 0 },
    { name: 'Feb', revenue: 3000, cloudCost: 139, localSavings: 50 },
    { name: 'Mar', revenue: 2000, cloudCost: 980, localSavings: 120 },
    { name: 'Apr', revenue: 2780, cloudCost: 390, localSavings: 300 },
    { name: 'May', revenue: 1890, cloudCost: 480, localSavings: 450 },
    { name: 'Jun', revenue: 2390, cloudCost: 380, localSavings: 600 },
    { name: 'Jul', revenue: 3490, cloudCost: 430, localSavings: 800 },
];

export const EconomicsChart = () => {
    return (
        <div className="bg-white/5 border border-white/10 p-6 rounded-lg relative overflow-hidden h-[400px]">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-lg text-white tracking-tight">
                        Token Economics
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">Cost vs Savings Trajectory</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-light font-mono text-[#9df425] flex items-center justify-end">
                        <DollarSign className="h-5 w-5" />
                        2,320
                    </p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">Est. Annual Savings</p>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#9df425" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#9df425" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#ffffff40', fontSize: 10, fontFamily: 'monospace' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#ffffff40', fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#080808',
                            borderRadius: '4px',
                            border: '1px solid #ffffff20',
                            color: '#fff',
                            fontFamily: 'monospace'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#9df425"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Revenue"
                    />
                    <Area
                        type="monotone"
                        dataKey="cloudCost"
                        stroke="#ff1a1a"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        fill="none"
                        name="Cloud Cost"
                    />
                    <Area
                        type="monotone"
                        dataKey="localSavings"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSavings)"
                        name="Local AI Savings"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
