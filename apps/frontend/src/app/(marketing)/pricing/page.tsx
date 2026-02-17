'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Terminal, Database, Cpu, Activity } from 'lucide-react';
import { MOCK_PRODUCTS, Product } from '@/lib/mock-data/products';
import { PricingCard } from '@/components/marketing/PricingCard';
import { CheckoutModal } from '@/components/marketing/CheckoutModal';

export default function MarketingHomePage() {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    const handlePurchase = (product: Product) => {
        setSelectedProduct(product);
        setIsCheckoutOpen(true);
    };

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden font-sans">
            {/* TopNavBar Component */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-solid border-[#3a3527] bg-[#0a0a0a]/80 backdrop-blur-md px-6 md:px-20 py-4">
                <div className="flex items-center gap-4 text-white">
                    <div className="size-6 text-[#f9bc06]">
                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor"></path>
                        </svg>
                    </div>
                    <h2 className="text-white text-xl font-bold leading-tight tracking-tighter uppercase">AffeXAI</h2>
                </div>
                <div className="flex flex-1 justify-end gap-12 items-center">
                    <nav className="hidden md:flex items-center gap-10">
                        <Link href="/architecture" className="text-[#bbb39b] hover:text-white text-xs font-semibold tracking-widest uppercase transition-colors">Architecture</Link>
                        <Link href="/capability" className="text-[#bbb39b] hover:text-white text-xs font-semibold tracking-widest uppercase transition-colors">Capability</Link>
                        <Link href="/metrics" className="text-[#bbb39b] hover:text-white text-xs font-semibold tracking-widest uppercase transition-colors">Metrics</Link>
                        <Link href="/access" className="text-[#bbb39b] hover:text-white text-xs font-semibold tracking-widest uppercase transition-colors">Access</Link>
                    </nav>
                    <Link href="/login" className="flex min-w-[180px] cursor-pointer items-center justify-center rounded-sm h-10 px-6 bg-[#f9bc06] text-black text-xs font-bold uppercase tracking-widest transition-all hover:bg-white amber-pulse">
                        Request Authorization
                    </Link>
                </div>
            </header>

            <main className="flex-1 px-6 md:px-20 py-12 max-w-[1400px] mx-auto w-full">
                {/* HeadlineText (Hero Replacement) */}
                <section className="mb-24 pt-12 border-l border-[#f9bc06]/30 pl-8">
                    <p className="text-[#f9bc06] text-xs font-mono mb-4 tracking-[0.4em] uppercase">Status: Operational // Disclosure Active</p>
                    <h1 className="text-white key-headline hairline-text text-[64px] md:text-[110px] leading-[0.9] tracking-tighter max-w-4xl">
                        AffeXAI Intelligence Architecture
                    </h1>
                    <div className="mt-12 flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-full md:w-1/3">
                            <p className="text-[#bbb39b] text-sm leading-relaxed font-light">
                                Formal disclosure of high-density neural infrastructure designed for institutional autonomy and synchronous cognitive operations.
                            </p>
                        </div>
                        <div className="hidden md:block h-[1px] bg-[#3a3527] flex-1 mt-4"></div>
                    </div>
                </section>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#3a3527] mb-24">
                    <div className="flex flex-col gap-4 p-8 border-b md:border-b-0 md:border-r border-[#3a3527]">
                        <p className="text-[#f9bc06]/60 text-[10px] font-mono tracking-widest uppercase">Metric: Neural Density</p>
                        <p className="text-white text-4xl font-bold font-mono">TIER 1.0</p>
                        <p className="text-[#554e3a] text-xs leading-normal">Optimization for institutional scalability.</p>
                    </div>
                    <div className="flex flex-col gap-4 p-8 border-b md:border-b-0 md:border-r border-[#3a3527] bg-[#f9bc06]/[0.02]">
                        <p className="text-[#f9bc06]/60 text-[10px] font-mono tracking-widest uppercase">System Origin</p>
                        <p className="text-white text-4xl font-bold font-mono">VERIFIED</p>
                        <p className="text-[#554e3a] text-xs leading-normal">Cryptographic signature validated.</p>
                    </div>
                    <div className="flex flex-col gap-4 p-8">
                        <p className="text-[#f9bc06]/60 text-[10px] font-mono tracking-widest uppercase">Core Latency</p>
                        <p className="text-white text-4xl font-bold font-mono">&lt;0.002MS</p>
                        <p className="text-[#554e3a] text-xs leading-normal">Near-instantaneous inference throughput.</p>
                    </div>
                </div>

                {/* SectionHeader */}
                <div className="mb-8 flex items-baseline justify-between border-b border-[#3a3527] pb-4">
                    <h2 className="text-white text-3xl font-bold tracking-tighter uppercase">System Capabilities</h2>
                    <span className="text-[#554e3a] font-mono text-xs">SPEC_VERSION_04.4</span>
                </div>

                {/* TextGrid / Capability Matrices */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-[#3a3527] border border-[#3a3527] mb-24">
                    <div className="flex flex-col gap-6 bg-[#0a0a0a] p-8 group hover:bg-[#1a1a1a] transition-colors">
                        <Terminal className="text-[#f9bc06] size-8 font-light" strokeWidth={1.5} />
                        <div className="flex flex-col gap-2">
                            <h3 className="text-white text-lg font-bold uppercase tracking-tight">Cognitive Modeling</h3>
                            <p className="text-[#bbb39b] text-sm font-light leading-relaxed">High-density parameter modeling for institutional infrastructure and sovereign data silos.</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6 bg-[#0a0a0a] p-8 group hover:bg-[#1a1a1a] transition-colors">
                        <Database className="text-[#f9bc06] size-8 font-light" strokeWidth={1.5} />
                        <div className="flex flex-col gap-2">
                            <h3 className="text-white text-lg font-bold uppercase tracking-tight">Data Ingestion</h3>
                            <p className="text-[#bbb39b] text-sm font-light leading-relaxed">Synchronous ingestion of multi-vector datasets with automated normalization protocols.</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6 bg-[#0a0a0a] p-8 group hover:bg-[#1a1a1a] transition-colors">
                        <Cpu className="text-[#f9bc06] size-8 font-light" strokeWidth={1.5} />
                        <div className="flex flex-col gap-2">
                            <h3 className="text-white text-lg font-bold uppercase tracking-tight">Inference Load</h3>
                            <p className="text-[#bbb39b] text-sm font-light leading-relaxed">Optimized inference threading designed for 24/7 mission-critical real-time operations.</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6 bg-[#0a0a0a] p-8 group hover:bg-[#1a1a1a] transition-colors">
                        <Activity className="text-[#f9bc06] size-8 font-light" strokeWidth={1.5} />
                        <div className="flex flex-col gap-2">
                            <h3 className="text-white text-lg font-bold uppercase tracking-tight">Operational Velocity</h3>
                            <p className="text-[#bbb39b] text-sm font-light leading-relaxed">Maximized cycles per millisecond throughput for ultra-low latency response windows.</p>
                        </div>
                    </div>
                </div>

                {/* Access Tiers (Dynamic Component) */}
                <div className="mb-8 flex items-baseline justify-between border-b border-[#3a3527] pb-4">
                    <h2 className="text-white text-3xl font-bold tracking-tighter uppercase">Access Tiers</h2>
                    <span className="text-[#554e3a] font-mono text-xs">Dynamic Load: {MOCK_PRODUCTS.length} NODES</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    {MOCK_PRODUCTS.map((product) => (
                        <PricingCard
                            key={product.id}
                            product={product}
                            onPurchase={handlePurchase}
                        />
                    ))}
                </div>

                {/* Checkout Modal */}
                <CheckoutModal
                    product={selectedProduct}
                    isOpen={isCheckoutOpen}
                    onClose={() => setIsCheckoutOpen(false)}
                />

                {/* Call to Action / Gateway */}
                <section className="bg-[#f9bc06] p-12 md:p-24 text-center">
                    <h2 className="text-black text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-6">Initialize Authorization</h2>
                    <p className="text-black/80 max-w-2xl mx-auto text-lg mb-12 font-medium">
                        The AffeXAI architecture is currently accepting institutional requests. Security vetting and infrastructure assessment mandatory for all access tiers.
                    </p>
                    <div className="flex flex-col md:flex-row gap-4 justify-center">
                        <Link href="/login" className="bg-black text-[#f9bc06] px-10 py-4 font-bold uppercase text-sm tracking-widest hover:bg-zinc-900 transition-colors">
                            Begin Security Vetting
                        </Link>
                        <Link href="/docs" className="bg-transparent border-2 border-black text-black px-10 py-4 font-bold uppercase text-sm tracking-widest hover:bg-black/10 transition-colors">
                            Documentation Archive
                        </Link>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="px-6 md:px-20 py-12 border-t border-[#3a3527] bg-[#0a0a0a]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-white">
                            <div className="size-4 text-[#f9bc06]">
                                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor"></path>
                                </svg>
                            </div>
                            <h2 className="text-white text-sm font-bold uppercase tracking-widest">AffeXAI</h2>
                        </div>
                        <p className="text-[#554e3a] text-[10px] font-mono">SYSTEM_ID: 882-AFX-2024 // ALL RIGHTS RESERVED</p>
                    </div>
                    <div className="flex flex-wrap gap-x-12 gap-y-4">
                        <Link href="#" className="text-[#554e3a] hover:text-[#f9bc06] text-[10px] font-mono uppercase tracking-widest">Compliance</Link>
                        <Link href="#" className="text-[#554e3a] hover:text-[#f9bc06] text-[10px] font-mono uppercase tracking-widest">Encryption Protocols</Link>
                        <Link href="#" className="text-[#554e3a] hover:text-[#f9bc06] text-[10px] font-mono uppercase tracking-widest">Legal Disclosure</Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="size-2 bg-[#f9bc06] rounded-full animate-pulse"></div>
                        <span className="text-[#bbb39b] text-[10px] font-mono uppercase tracking-tighter">System Pulse: Steady</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
