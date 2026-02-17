'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';

const mockTenants = [
    { id: 'tnt_1', name: 'Acme Corp', tokens: 154000, cost: 4.20, plan: 'Pro', trend: 'up' },
    { id: 'tnt_2', name: 'Stark Ind', tokens: 89000, cost: 2.10, plan: 'Starter', trend: 'stable' },
    { id: 'tnt_3', name: 'Wayne Ent', tokens: 450000, cost: 12.50, plan: 'Enterprise', trend: 'up' },
    { id: 'tnt_4', name: 'Cyberdyne', tokens: 12000, cost: 0.35, plan: 'Starter', trend: 'down' },
    { id: 'tnt_5', name: 'Massive Dynamic', tokens: 230000, cost: 6.80, plan: 'Pro', trend: 'up' },
];

export const TenantIntelligence = () => {
    return (
        <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="font-bold text-lg text-white tracking-tight">Tenant Intelligence</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">Real-time Consumption Breakdown</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
                    <input
                        type="text"
                        placeholder="Search Entity ID..."
                        className="pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#9df425]"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-[10px] uppercase tracking-widest text-white/30 border-b border-white/10">
                        <tr>
                            <th className="pb-4 font-normal pl-2">Tenant Entity</th>
                            <th className="pb-4 font-normal">Plan Tier</th>
                            <th className="pb-4 font-normal text-right">Token Flow</th>
                            <th className="pb-4 font-normal text-right">Est. Liability</th>
                            <th className="pb-4 font-normal text-right pr-2">Trend</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80 font-light">
                        {mockTenants.map((row, i) => (
                            <tr key={i} className="group hover:bg-white/5 transition-colors">
                                <td className="py-4 pl-2 font-medium">
                                    {row.name}
                                    <div className="text-[9px] text-white/30 font-mono hidden sm:block">ID: {row.id}</div>
                                </td>
                                <td className="py-4">
                                    <span className={`px-2 py-1 rounded text-[9px] uppercase tracking-wider ${row.plan === 'Enterprise' ? 'bg-[#9df425]/10 text-[#9df425] border border-[#9df425]/20' : 'bg-white/10 border border-white/5'}`}>
                                        {row.plan}
                                    </span>
                                </td>
                                <td className="py-4 text-right font-mono text-white/60">
                                    {row.tokens.toLocaleString()}
                                </td>
                                <td className="py-4 text-right font-mono text-[#9df425]">
                                    ${row.cost.toFixed(2)}
                                </td>
                                <td className="py-4 pr-2 flex justify-end">
                                    {row.trend === 'up' && <ArrowUpRight className="h-4 w-4 text-red-500" />}
                                    {row.trend === 'down' && <ArrowDownRight className="h-4 w-4 text-[#9df425]" />}
                                    {row.trend === 'stable' && <span className="text-white/30 text-xs">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
