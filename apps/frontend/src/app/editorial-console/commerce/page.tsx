'use client';

import React from 'react';
import { AdminCommercePanel } from '@/modules/admin/AdminCommercePanel';

export default function EditorialCommerceOverview() {
    return (
        <div className="space-y-8">
            <div className="flex items-baseline justify-between border-b border-[#3a3527] pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Commerce Control</h1>
                    <p className="text-[#bbb39b] text-sm mt-1">Manage packages, pricing, and Stripe synchronization.</p>
                </div>
                <span className="text-[#554e3a] font-mono text-[10px] uppercase tracking-widest">SUPER ADMIN</span>
            </div>
            <AdminCommercePanel />
        </div>
    );
}
