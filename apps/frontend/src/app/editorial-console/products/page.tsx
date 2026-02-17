'use client';

import React, { useState } from 'react';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { BccHudTile } from '@/components/brand/BccHudTile';
import { ProductTable } from '@/components/bcc/products/ProductTable';
import { ProductCard } from '@/components/bcc/products/ProductCard';
import { Search, Filter, Plus, Package } from 'lucide-react';
import { commerceService, Product, Subscription, UsageLimit } from '@/lib/api/commerceService';

import { CreateProductModal } from '@/components/bcc/products/CreateProductModal';

// ... (imports remain the same, just adding the component above)

export default function ProductCatalogPage() {
    // Shared State for Table/Grid View
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [limits, setLimits] = useState<UsageLimit | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const loadData = async () => {
        try {
            const [productsData, subData, limitsData] = await Promise.all([
                commerceService.getProducts(),
                commerceService.getSubscription(),
                commerceService.getLimits()
            ]);
            setProducts(productsData);
            setSubscription(subData);
            setLimits(limitsData);
        } catch (err) {
            console.error("Commerce data load failed", err);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        loadData();
    }, []);

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <BccEditorialWrapper
            headerTitle="Product Catalog"
            headerSubtitle="Manage subscription tiers and add-ons."
            headerBadge="COMMERCIAL_OPS"
            theme="super-admin"
            hideSidebar={true}
            telemetryData={[
                { label: "TOTAL_SKUS", value: products.length.toString() },
                { label: "ACTIVE_PLAN", value: subscription?.price?.product?.name || "No Plan" },
                { label: "TOKENS_LEFT", value: limits?.remaining?.toLocaleString() || "0", color: limits?.remaining < 1000 ? "#ff4444" : "#9df425" }
            ]}
            moduleNav={
                // Micro-Navigation unique to this module
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

                {/* 1. Control Bar */}
                <div className="bg-[#0a0a0a]/40 border border-white/5 p-4 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-4">
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

                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-4 py-3 border border-white/10 hover:border-[#9df425] hover:text-[#9df425] transition-all group bg-black/50">
                            <Filter className="w-3 h-3 text-white/40 group-hover:text-[#9df425]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 group-hover:text-[#9df425]">Filter</span>
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-[#9df425] text-black hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_rgba(157,244,37,0.2)]"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">New SKU</span>
                        </button>
                    </div>
                </div>

                {/* 2. Content View */}
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}

                        {/* Empty "Add New" Placeholder Card */}
                        <div
                            onClick={() => setIsCreateModalOpen(true)}
                            className="border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-colors p-8 flex flex-col items-center justify-center gap-4 cursor-pointer group min-h-[300px]"
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

                <CreateProductModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={loadData}
                />

            </div>
        </BccEditorialWrapper>
    );
}
