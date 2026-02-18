'use client';

import React, { useEffect, useState } from 'react';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { ProductTable } from '@/components/bcc/products/ProductTable';
import { ProductCard } from '@/components/bcc/products/ProductCard';
import { CreateProductModal } from '@/components/bcc/products/CreateProductModal';
import {
    Search, Filter, Plus, Package, Zap, Users, DollarSign,
    RefreshCw, Loader2, AlertCircle
} from 'lucide-react';
import { commerceService, Product, UsageStats, UserLimit } from '@/lib/api/commerceService';

export default function CommerceControlPage() {
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [userLimits, setUserLimits] = useState<UserLimit | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [productsData, usageData, limitsData] = await Promise.all([
                commerceService.getProducts(),
                commerceService.getUsageStats().catch(() => null),
                commerceService.getUserLimits().catch(() => null),
            ]);
            setProducts(productsData);
            setUsage(usageData);
            setUserLimits(limitsData);
        } catch (err: any) {
            console.error('Commerce data load failed', err);
            setError('Failed to load commerce data. Check backend connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeProducts = products.filter(p => p.active);
    const totalRevenue = products.reduce((sum, p) => {
        const monthlyPrice = p.prices?.find(pr => pr.interval === 'month');
        return sum + (monthlyPrice?.amount || 0);
    }, 0);
    const seatUsed = userLimits ? userLimits.limit - userLimits.remaining : 0;

    return (
        <BccEditorialWrapper
            headerTitle="Commerce Control"
            headerSubtitle="Package management, pricing, and platform billing intelligence."
            headerBadge="COMMERCE_OPS"
            theme="super-admin"
            hideSidebar={true}
            telemetryData={[
                { label: "TOTAL_SKUS", value: products.length.toString() },
                { label: "ACTIVE", value: activeProducts.length.toString(), color: "#9df425" },
                { label: "MRR_POTENTIAL", value: `$${totalRevenue}`, color: "#00f0ff" },
            ]}
            moduleNav={
                <div className="flex items-center space-x-1 bg-white/5 border border-white/5 rounded-full p-1 ml-8">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full transition-all ${viewMode === 'grid' ? 'bg-[#9df425] text-black shadow-[0_0_10px_rgba(157,244,37,0.3)]' : 'text-white/40 hover:text-white'}`}
                    >
                        Grid
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full transition-all ${viewMode === 'table' ? 'bg-[#9df425] text-black shadow-[0_0_10px_rgba(157,244,37,0.3)]' : 'text-white/40 hover:text-white'}`}
                    >
                        Table
                    </button>
                </div>
            }
        >
            <div className="space-y-8 pb-12">

                {/* Commerce Intelligence Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5">
                    <div className="bg-[#0a0a0a] p-4 md:p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="w-3 h-3 text-[#9df425]" />
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Packages</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-white">{activeProducts.length}<span className="text-white/30 text-sm">/{products.length}</span></p>
                    </div>
                    <div className="bg-[#0a0a0a] p-4 md:p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-3 h-3 text-[#00f0ff]" />
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">MRR Potential</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-[#00f0ff]">${totalRevenue}</p>
                    </div>
                    <div className="bg-[#0a0a0a] p-4 md:p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-3 h-3 text-[#f9bc06]" />
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Token Usage</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-white">
                            {usage ? `${((usage.used / usage.limit) * 100).toFixed(0)}%` : '—'}
                        </p>
                    </div>
                    <div className="bg-[#0a0a0a] p-4 md:p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-3 h-3 text-[#9df425]" />
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Seats</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-white">
                            {userLimits ? `${seatUsed}/${userLimits.limit}` : '—'}
                        </p>
                    </div>
                </div>

                {/* Control Bar */}
                <div className="bg-[#0a0a0a]/40 border border-white/5 p-3 md:p-4 backdrop-blur-md flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4">
                    <div className="relative w-full md:w-96 group">
                        <input
                            type="text"
                            placeholder="SEARCH_INVENTORY..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 p-3 pl-10 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#9df425] transition-colors uppercase tracking-wider"
                        />
                        <Search className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-[#9df425] transition-colors" />
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 md:px-4 py-3 border border-white/10 hover:border-[#9df425] hover:text-[#9df425] transition-all group bg-black/50"
                        >
                            <RefreshCw className={`w-3 h-3 text-white/40 group-hover:text-[#9df425] ${loading ? 'animate-spin' : ''}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-[#9df425] hidden md:inline">Refresh</span>
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 md:px-6 py-3 bg-[#9df425] text-black hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_rgba(157,244,37,0.2)]"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">New SKU</span>
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="flex items-center gap-3 p-4 border border-red-500/30 bg-red-500/5 text-red-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs font-mono">{error}</span>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-6 h-6 text-[#9df425] animate-spin" />
                        <span className="ml-3 text-xs font-mono text-white/40 uppercase tracking-widest">Loading inventory...</span>
                    </div>
                )}

                {/* Content View */}
                {!loading && !error && (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}

                                {/* Empty Add Card */}
                                <div
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-colors p-8 flex flex-col items-center justify-center gap-4 cursor-pointer group min-h-[280px]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus className="w-6 h-6 text-white/20 group-hover:text-[#9df425]" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-white/30 group-hover:text-white">Create New Package</span>
                                </div>
                            </div>
                        ) : (
                            <ProductTable products={filteredProducts} />
                        )}

                        {/* Empty State */}
                        {filteredProducts.length === 0 && !loading && (
                            <div className="text-center py-16">
                                <Package className="w-12 h-12 text-white/10 mx-auto mb-4" />
                                <p className="text-xs font-mono text-white/30 uppercase tracking-widest">
                                    {searchQuery ? 'No packages match your search' : 'No packages configured yet'}
                                </p>
                            </div>
                        )}
                    </>
                )}

                <CreateProductModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={loadData}
                />
            </div>
        </BccEditorialWrapper>
    );
}
