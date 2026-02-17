"use client";

import React, { ReactNode, useEffect } from "react";
import { Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { BccCollapsibleSidebar } from "./BccCollapsibleSidebar";
import { AiCoPilot } from "./ai/AiCoPilot";


// Load Space Grotesk Font
const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-space-grotesk',
});

interface BccEditorialWrapperProps {
    children: ReactNode;
    theme?: 'super-admin' | 'tenant-admin';
    telemetryData?: Array<{ label: string, value: string, suffix?: string, color?: string }>;
    headerTitle?: string;
    headerSubtitle?: string;
    headerBadge?: string;
    moduleNav?: React.ReactNode;
    headerAction?: React.ReactNode;
    hideSidebar?: boolean;
}

/**
 * BCC Unified Aesthetic Layout (Editorial Language)
 * Supports Green (#9df425) for Super Admin and Orange (#ff8c00) for Tenant Admin.
 */
export const BccEditorialWrapper = ({
    children,
    theme = 'tenant-admin',
    telemetryData = [],
    headerTitle = "System Velocity",
    headerSubtitle = "Observing ecosystem resonance vs legacy friction.",
    headerBadge = "Live Shift",
    moduleNav,
    headerAction,
    hideSidebar = false
}: BccEditorialWrapperProps) => {

    const [mounted, setMounted] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState("");

    useEffect(() => {
        setMounted(true);
        const updateTick = () => {
            setCurrentTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
        };
        updateTick();
        const interval = setInterval(updateTick, 1000);
        return () => clearInterval(interval);
    }, []);

    const isTenant = theme === 'tenant-admin';
    const accentColor = isTenant ? '#ff8c00' : '#9df425';

    // Dynamic Tenant Extraction for Header
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const pathParts = pathname.split('/');
    const tenant = pathParts[1] !== 'admin' && pathParts[1] !== '' ? pathParts[1] : undefined;

    const generateTenantLink = (path: string) => {
        if (!tenant) return path;
        // If path already starts with tenant, return as is
        if (path.startsWith(`/${tenant}`)) return path;
        return `/${tenant}${path}`;
    };

    // [NEURAL GRID] Context Detection
    const isTicketPage = pathParts.includes('tickets') && pathParts.length > 3; // admin/tickets/[id]
    const ticketId = isTicketPage ? pathParts[pathParts.length - 1] : undefined;


    return (
        <div lang="en" className={`min-h-screen bg-[#080808] text-white font-sans ${spaceGrotesk.variable} overflow-hidden select-none relative`}>
            {/* 1. GLOBAL STYLES & FONTS */}
            <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            <style jsx global>{`
                .vertical-text {
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                }
                .editorial-grid {
                    background-size: 40px 40px;
                    background-image: radial-gradient(circle, #1a1a1a 1px, transparent 1px);
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @keyframes orbit {
                    from { transform: rotate(0deg) translateX(100px) rotate(0deg); }
                    to { transform: rotate(360deg) translateX(100px) rotate(-360deg); }
                }
            `}</style>

            {/* 2. TOP EDITORIAL HEADER */}
            <header className="fixed top-0 left-0 w-full z-50 border-b border-white/10 bg-[#080808]/80 backdrop-blur-md px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-12">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: accentColor }}>
                            <span className="material-icons text-black text-sm">analytics</span>
                        </div>
                        <span className="text-xl font-bold tracking-tighter uppercase font-mono">AffeXAI</span>
                    </div>
                    {/* Dynamic Tenant-Aware Header Links */}
                    <nav className="hidden md:flex space-x-8 text-[10px] tracking-[0.2em] font-medium uppercase text-white/40">
                        {mounted ? (
                            <>
                                <Link href={generateTenantLink("/admin/brand/intelligence")} className="hover:text-white transition-colors">Intelligence</Link>
                                <Link href={generateTenantLink("/admin/brand/resonance")} className="hover:text-white transition-colors">Resonance</Link>
                                <Link href={generateTenantLink("/admin/brand/module")} className="hover:text-white transition-colors tracking-tight">Module Command</Link>
                                <Link href={generateTenantLink("/admin/brand/strategy")} className="transition-colors font-bold" style={{ color: accentColor }}>Strategic Ops</Link>
                            </>
                        ) : (
                            <>
                                <span className="opacity-0">Intelligence</span>
                                <span className="opacity-0">Resonance</span>
                                <span className="opacity-0">Module Command</span>
                                <span className="opacity-0">Strategic Ops</span>
                            </>
                        )}
                    </nav>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="text-[10px] tracking-widest text-white/60 font-mono">
                        UTC <span className="text-white font-bold">{mounted ? currentTime : "--:--:--"}</span>
                    </div>
                    <div className="h-4 w-px bg-white/20"></div>
                    <div className="flex space-x-4">
                        <span className="material-icons text-sm cursor-pointer hover:opacity-70 transition-opacity" style={{ color: accentColor }}>search</span>
                        <span className="material-icons text-sm cursor-pointer hover:text-white transition-colors text-white/40">menu</span>
                    </div>
                </div>
            </header>

            <main className="relative h-screen w-full flex overflow-hidden pt-[72px]">
                {/* 3. COLLAPSIBLE SIDEBAR */}
                {!hideSidebar && <BccCollapsibleSidebar theme={theme} />}

                {/* 4. CENTRAL VIEWPORT HANDLER */}
                <div className="flex-grow h-full overflow-hidden relative editorial-grid flex flex-col">

                    {/* FIXED TOP TELEMETRY SECTION */}
                    <div className="flex-none px-12 pr-36 pt-12 pb-4 z-20 bg-[#080808]/90 backdrop-blur-sm border-b border-white/5">
                        <div className="w-full flex items-center justify-between pb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex space-x-12">
                                {telemetryData.map((item, idx) => (
                                    <React.Fragment key={idx}>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{item.label}</span>
                                            <div className="text-xl font-light tabular-nums text-white">
                                                {item.value}<span className="text-xs text-white/40 ml-0.5">{item.suffix}</span>
                                            </div>
                                        </div>
                                        {idx < telemetryData.length - 1 && <div className="h-4 w-px bg-white/10"></div>}
                                    </React.Fragment>
                                ))}
                                {telemetryData.length === 0 && (
                                    <>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accentColor }}>Strategy Index</span>
                                            <div className="text-xl font-light tabular-nums text-white">92.4<span className="text-xs text-white/40 ml-0.5">%</span></div>
                                        </div>
                                        <div className="h-4 w-px bg-white/10"></div>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-[10px] uppercase tracking-widest text-[#ff1a1a] font-bold">Risk Level</span>
                                            <div className="text-xl font-light tabular-nums text-white">04.1<span className="text-xs text-white/40 ml-0.5">%</span></div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center space-x-3">
                                {headerAction ? (
                                    headerAction
                                ) : (
                                    <div className="flex items-center space-x-3 opacity-50">
                                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }}></div>
                                        <span className="text-[9px] uppercase tracking-widest text-white/40">Market Live</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-end w-full">
                            <div className="max-w-3xl">
                                <h1 className="text-[clamp(2.5rem,5vw,4rem)] leading-[0.9] font-bold uppercase tracking-tighter mb-2 text-white font-mono">
                                    {headerTitle.split(' ').map((word, i) => i === 1 ? <React.Fragment key={i}><br />{word}.</React.Fragment> : word)}
                                </h1>
                                <div className="flex items-center space-x-4">
                                    <span className="text-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors duration-500" style={{ backgroundColor: accentColor }}>
                                        {headerBadge}
                                    </span>
                                    {moduleNav ? (
                                        <div className="flex items-center">
                                            {moduleNav}
                                        </div>
                                    ) : (
                                        <p className="text-white/40 text-xs max-w-sm font-light leading-relaxed truncate uppercase tracking-widest font-mono">
                                            {headerSubtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-grow overflow-y-auto no-scrollbar relative z-10 p-12 pr-36">
                        {children}
                    </div>

                    {/* AMBIENT SIGNAL RAIL (RIGHT) */}
                    <aside className="fixed right-0 top-[72px] w-24 h-full border-l border-white/5 bg-[#080808]/50 flex flex-col items-center py-20 z-20">
                        <div className="absolute top-0 left-0 w-full h-1 transition-colors duration-500" style={{ backgroundColor: `${accentColor}33` }}></div>
                        <div className="vertical-text flex flex-col items-center space-y-8 uppercase tracking-[0.4em] text-[10px] text-white/30 font-medium h-2/3 justify-center">
                            <span>Resonance Core {isTenant ? 'Orange_V1' : 'Green_V3'}</span>
                            <span className="font-bold" style={{ color: accentColor }}>Neural Online</span>
                            <span>Sync Latency: 42ms</span>
                        </div>

                        <div className="mt-auto flex flex-col items-center space-y-6 pb-24">
                            <div className="relative flex items-center justify-center">
                                <div className="absolute w-8 h-8 rounded-full border animate-ping" style={{ borderColor: `${accentColor}33` }}></div>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}></div>
                            </div>
                            <div className="space-y-4">
                                <div className="w-1 h-8 bg-white/5 rounded-full overflow-hidden">
                                    <div className="w-full h-1/2" style={{ backgroundColor: accentColor }}></div>
                                </div>
                                <div className="w-1 h-8 bg-white/5 rounded-full overflow-hidden">
                                    <div className="w-full h-3/4 bg-[#ff1a1a]"></div>
                                </div>
                                <div className="w-1 h-8 bg-white/5 rounded-full overflow-hidden">
                                    <div className="w-full h-1/4 bg-white/20"></div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            {/* DECORATIVE ELEMENTS */}
            <div className="fixed bottom-8 left-8 z-50 flex items-center space-x-4 pointer-events-none">
                <div className="text-[9px] text-white/20 uppercase tracking-[0.3em] vertical-text transform rotate-180 font-mono">
                    AETHER INTEL SYSTEMS // BCC_STRATEGY_V5.0
                </div>
                <div className="w-px h-24 bg-gradient-to-t from-white/10 to-transparent"></div>
            </div>

            {/* [NEURAL GRID] GLOBAL SYNAPSE */}
            <AiCoPilot
                context={isTicketPage ? "Ticket Resolution" : "General Strategy"}
                data={{
                    contextType: isTicketPage ? 'ticket' : 'general',
                    contextId: ticketId
                }}
                variant="floating"
            />
        </div>
    );
};
