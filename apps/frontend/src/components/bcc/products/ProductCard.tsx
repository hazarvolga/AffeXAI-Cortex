import React from 'react';
import { Package, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { BccHudTile } from '@/components/brand/BccHudTile';
import { Product } from '@/lib/mock-data/products';

interface ProductCardProps {
    product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    const { name, price, status, features, stats } = product;

    // Determine accent color based on status
    const accentColor =
        status === 'active' ? '#9df425' :
            status === 'archived' ? '#ffffff40' : // White with opacity for archived
                '#ff8c00'; // Fallback

    return (
        <BccHudTile
            title={status}
            subtitle={`SKU: ${name ? name.toUpperCase().replace(' ', '_') : 'UNKNOWN'}`}
            accentColor={accentColor}
            className="h-full flex flex-col"
            icon={Package}
            headerAction={
                <div className="flex items-baseline text-white">
                    <span className="text-xl font-bold tracking-tight">{price}</span>
                    <span className="text-[9px] uppercase tracking-widest text-white/40 ml-1">/ANNUM</span>
                </div>
            }
            footer={
                <button className="w-full bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded transition-colors border border-white/5 hover:border-white/10">
                    CONFIGURE_CONFIG
                </button>
            }
        >
            <div className="space-y-6">
                {/* Metric Strip */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center space-x-2">
                        <Users className="w-3 h-3 text-white/40" />
                        <span className="text-[10px] font-mono text-white/80">{stats.activeTenants} Active</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <TrendingUp className="w-3 h-3" style={{ color: accentColor }} />
                        <span className="text-[10px] font-mono" style={{ color: accentColor }}>+12%</span>
                    </div>
                </div>

                {/* Feature List */}
                <div className="space-y-3 min-h-[80px]">
                    {features.slice(0, 3).map((feature, i) => (
                        <div key={i} className="flex items-center space-x-3 text-[10px] text-white/60">
                            <CheckCircle2 className="w-3 h-3 opacity-50" style={{ color: accentColor }} />
                            <span className="uppercase tracking-wide">{feature}</span>
                        </div>
                    ))}
                    {features.length > 3 && (
                        <div className="text-[9px] text-white/20 pl-6 uppercase tracking-widest">
                            +{features.length - 3} ADDITIONAL_MODULES
                        </div>
                    )}
                </div>
            </div>
        </BccHudTile>
    );
};
