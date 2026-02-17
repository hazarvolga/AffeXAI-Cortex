'use client';

import React from 'react';
import Link from 'next/link';
import { Space_Grotesk, Instrument_Serif } from 'next/font/google';

// Load Fonts
const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    weight: ['300', '400', '700'],
    variable: '--font-space-grotesk'
});

const instrumentSerif = Instrument_Serif({
    subsets: ['latin'],
    weight: '400',
    style: ['normal', 'italic'],
    variable: '--font-instrument-serif'
});

export default function MarketingHomePage() {
    return (
        <div className={`relative h-screen w-full flex flex-col overflow-hidden bg-[#050505] text-white selection:bg-[#c8f906] selection:text-black ${spaceGrotesk.variable} ${instrumentSerif.variable} font-sans`}>

            {/* Top Navigation / Brand Condition */}
            <header className="z-50 flex flex-col items-center pt-12 px-10">
                <div className="flex items-center gap-3 mb-12">
                    <div className="size-5 text-[#c8f906]">
                        <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
                        </svg>
                    </div>
                    <h2 className="text-white/40 text-xs font-bold tracking-[0.3em] uppercase">AffeXAI Intelligence</h2>
                </div>
                <h1 className={`${instrumentSerif.className} text-white text-3xl md:text-4xl tracking-widest italic opacity-90 text-center`}>
                    Brands are systems.<br />
                    We observe them
                </h1>
                <div className="mt-8 max-w-2xl text-center space-y-4">
                    <p className="text-white/60 text-sm font-light leading-relaxed tracking-wide">
                        Signals from support, content, campaigns and conversations converge into a single intelligence layer.
                    </p>
                    <p className="text-white/80 text-sm font-light tracking-wide">
                        Not reports. Not dashboards.
                    </p>
                    <p className="text-[#c8f906] text-sm font-light tracking-widest uppercase">
                        A living model of brand behavior, perception and direction.
                    </p>
                </div>
            </header>

            {/* Peripheral Magnitude Markers: Top Left */}
            <div className="absolute top-10 left-10 select-none pointer-events-none">
                <span className="text-[120px] font-bold leading-none tracking-tighter text-white/[0.03]">STABILITY</span>
            </div>

            {/* Marginalia: Left Gutter */}
            <div className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col gap-24 marginalia text-white/30 max-w-[120px]">
                <div>
                    <span className="text-[#c8f906] mr-1">■</span>
                    ALPHA-LEVEL RESONANCE DETECTED IN CORE DEMOGRAPHICS.
                </div>
                <div>
                    <span className="text-white/20 mr-1">□</span>
                    SYSTEM LATENCY: 0.002MS
                </div>
            </div>

            {/* Central Intelligence Sculpture Layer */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-[600px] h-[600px] sculpture-container opacity-60">
                    <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <radialGradient cx="50%" cy="50%" fx="50%" fy="50%" id="grad1" r="50%">
                                <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 0.2 }} />
                                <stop offset="100%" style={{ stopColor: 'white', stopOpacity: 0 }} />
                            </radialGradient>
                        </defs>
                        <g fill="none" stroke="white" strokeWidth="0.2">
                            <path className="filament" d="M100,20 Q120,100 100,180"></path>
                            <path className="filament" d="M100,20 Q80,100 100,180"></path>
                            <path className="filament" d="M20,100 Q100,120 180,100"></path>
                            <path className="filament" d="M20,100 Q100,80 180,100"></path>
                            <ellipse className="filament" cx="100" cy="100" rx="40" ry="70" transform="rotate(45 100 100)"></ellipse>
                            <ellipse className="filament" cx="100" cy="100" rx="40" ry="70" transform="rotate(-45 100 100)"></ellipse>
                            <ellipse className="filament" cx="100" cy="100" rx="60" ry="30" transform="rotate(15 100 100)"></ellipse>
                            <ellipse className="filament" cx="100" cy="100" rx="60" ry="30" transform="rotate(-15 100 100)"></ellipse>
                            {/* Nodes */}
                            <circle cx="100" cy="100" fill="white" r="0.5"></circle>
                            <circle cx="85" cy="85" fill="white" opacity="0.5" r="0.3"></circle>
                            <circle cx="115" cy="115" fill="white" opacity="0.5" r="0.3"></circle>
                        </g>
                    </svg>
                </div>
            </div>

            {/* Surgical Focus Line */}
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#c8f906]/40 z-10"></div>
            <div className="absolute top-1/2 right-[20%] -translate-y-1/2 flex items-center gap-4 z-20">
                <div className="size-2 bg-[#c8f906] rounded-full"></div>
                <span className="marginalia text-[#c8f906]">STATE OF FOCUS: CONVERGENCE</span>
            </div>

            {/* Temporal Trajectory Path */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <div className="absolute top-[60%] left-[15%]">
                    <p className="text-[10px] tracking-[0.4em] text-white/40 uppercase">CONSISTENT TRAJECTORY OBSERVED</p>
                </div>
                <div className="absolute top-[40%] right-[25%]">
                    <p className="text-[10px] tracking-[0.4em] text-white/40 uppercase">SENTIMENT VELOCITY STABILIZED</p>
                </div>
                <div className="absolute bottom-[20%] left-[40%]">
                    <p className="text-[10px] tracking-[0.4em] text-white/40 uppercase">EQUITY SHIFT: MINIMAL</p>
                </div>
            </div>

            {/* Marginalia: Right Gutter */}
            <div className="absolute right-10 bottom-1/4 flex flex-col gap-12 marginalia text-white/30 text-right max-w-[150px]">
                <div>
                    SIGNALS INDICATE DIVERGENCE IN EXTERNAL TRUST CHANNELS.
                </div>
                <div className="text-white/10 italic">
                    BRIEFING V.8.0.1_PRIME
                </div>
            </div>

            {/* Peripheral Magnitude Markers: Bottom Right */}
            <div className="absolute bottom-10 right-10 select-none pointer-events-none text-right">
                <span className="text-[80px] font-bold leading-none tracking-tighter text-white/[0.02]">TENSION</span>
            </div>

            {/* Main Entry Points */}
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 flex gap-6">
                <Link href="/login" className="border border-[#c8f906]/50 px-8 py-3 bg-[#c8f906]/10 text-[#c8f906] text-xs font-bold tracking-widest uppercase hover:bg-[#c8f906] hover:text-black transition-all">
                    Enter the System
                </Link>
                <Link href="/features" className="border border-white/20 px-8 py-3 text-white/60 text-xs font-bold tracking-widest uppercase hover:bg-white/10 hover:text-white transition-all">
                    Explore System
                </Link>
            </div>

            {/* Footer / State Info */}
            <footer className="mt-auto p-10 flex justify-between items-end z-50">
                <div className="flex gap-10">
                    <div className="flex flex-col gap-1">
                        <span className="marginalia text-[8px] text-white/20">COORD_X</span>
                        <span className="marginalia text-white/50 tracking-widest">40.7128° N</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="marginalia text-[8px] text-white/20">COORD_Y</span>
                        <span className="marginalia text-white/50 tracking-widest">74.0060° W</span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <button className="flex items-center justify-center rounded-full size-10 border border-white/10 text-white/40 hover:text-[#c8f906] transition-colors">
                        <span className="material-symbols-outlined text-[20px]">info</span>
                    </button>
                    <div className="h-10 px-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
                        <span className="marginalia text-[9px] text-white/60">INTELLIGENCE_LAYER_ACTIVE</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
