'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, FileText, MoreVertical, Search, Filter, Activity, Zap, Database } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { cn } from '@/lib/utils';
import { httpClient } from '@/lib/api/http-client';

export default function FormsListPage() {
    const params = useParams();
    const tenantId = params.tenant as string;
    const [forms, setForms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchForms = async () => {
            try {
                const data = await httpClient.getWrapped<any[]>(`/forms`);
                setForms(data);
            } catch (error) {
                console.error('Fetch forms error:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchForms();
    }, []);

    const telemetryData = [
        { label: "Active Forms", value: String(forms.length), suffix: "UNIT" },
        { label: "Capture Rate", value: "94.2", suffix: "%", color: "#9df425" },
        { label: "Database", value: "Online", color: "#ff8c00" }
    ];

    return (
        <BccEditorialWrapper
            theme="tenant-admin"
            headerTitle="Form Management"
            headerSubtitle="Orchestrating high-fidelity data capture nodes."
            headerBadge="Sensor Status: Active"
            telemetryData={telemetryData}
        >
            <div className="space-y-12">
                {/* ACTIONS & SEARCH */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-0 bg-white/5 rounded-lg blur-sm group-focus-within:bg-[#ff8c00]/10 transition-all"></div>
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#ff8c00] transition-colors" />
                            <Input
                                placeholder="SEARCH_FORM_INDEX..."
                                className="pl-12 bg-[#0a0a0a] border-white/5 text-white placeholder:text-white/10 h-12 focus-visible:ring-[#ff8c00]/50 relative z-10 font-mono text-xs tracking-widest uppercase"
                            />
                        </div>
                        <Button variant="outline" size="icon" className="h-12 w-12 border-white/5 bg-white/5 hover:bg-white/10">
                            <Filter className="w-4 h-4 text-white/40" />
                        </Button>
                    </div>

                    <Link href={`/${tenantId}/admin/forms/new`}>
                        <Button className="h-12 px-8 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(255,140,0,0.2)] active:scale-95 transition-all">
                            <Plus className="w-4 h-4 mr-2 stroke-[3]" />
                            Initialize New Form
                        </Button>
                    </Link>
                </div>

                {/* GRID SECTION */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse" />
                        ))}
                    </div>
                ) : forms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] rounded-[40px] bg-white/[0.01] border border-dashed border-white/10">
                        <div className="bg-white/5 p-6 rounded-full mb-6 relative">
                            <div className="absolute inset-0 bg-[#ff8c00]/20 blur-2xl animate-pulse rounded-full"></div>
                            <FileText className="w-12 h-12 text-[#ff8c00] relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold uppercase tracking-[0.2em] text-white">No Forms Detected</h3>
                        <p className="text-xs text-white/30 mt-2 mb-8 font-mono uppercase tracking-widest text-center max-w-sm">
                            SYSTEM_STATUS: ZERO_ACTIVE_NODES. INITIALIZE_DEFAULT_TEMPLATES OR START_MANUAL_ORCHESTRATION.
                        </p>
                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                className="border-[#ff8c00]/30 text-[#ff8c00] hover:bg-[#ff8c00]/10 h-10 px-8 rounded-full uppercase tracking-tighter text-[11px] font-bold"
                                onClick={async () => {
                                    setIsLoading(true);
                                    try {
                                        const data = await httpClient.getWrapped<any[]>(`/forms`); // Trigger auto-seed
                                        setForms(data);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                            >
                                SEED_DEFAULT_NODES
                            </Button>
                            <Link href={`/${tenantId}/admin/forms/new`}>
                                <Button variant="outline" className="border-white/10 text-white/40 hover:bg-white/5 h-10 px-8 rounded-full uppercase tracking-tighter text-[11px] font-bold">
                                    MANUAL_INIT
                                </Button>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {forms.map(form => (
                            <div key={form.id} className="group relative">
                                {/* CARD GLOW */}
                                <div className="absolute -inset-0.5 bg-gradient-to-br from-[#ff8c00]/20 to-transparent rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>

                                <div className="relative bg-[#0c0c0c] border border-white/5 p-7 rounded-[30px] h-full flex flex-col hover:border-white/10 transition-all duration-500 overflow-hidden">
                                    {/* DECORATIVE CORNER */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/[0.03] to-transparent pointer-events-none"></div>

                                    <div className="flex items-start justify-between mb-8">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1 h-1 rounded-full bg-[#ff8c00]"></div>
                                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8c00]">Form Node</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-[#ff8c00] transition-colors leading-tight">
                                                {form.name}
                                            </h3>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/20 hover:text-white hover:bg-white/5 rounded-full">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="mt-auto pt-8 border-t border-white/5 flex items-end justify-between">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 opacity-40">
                                                <Activity className="w-3 h-3" />
                                                <span className="text-[9px] uppercase tracking-widest font-mono">Resonance: High</span>
                                            </div>
                                            <div className="text-[9px] text-white/30 font-mono uppercase tracking-[0.15em]">
                                                INIT: {new Date(form.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Link href={`/${tenantId}/admin/forms/${form.id}`}>
                                                <Button size="sm" className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all">
                                                    Open
                                                </Button>
                                            </Link>
                                            <Button size="sm" className="h-10 px-4 bg-white text-black hover:bg-white/90 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all">
                                                Analyze
                                            </Button>
                                        </div>
                                    </div>

                                    {/* MANTIK INDICATOR */}
                                    {form.logicConfig && (
                                        <div className="absolute top-4 right-12 flex items-center px-2 py-1 bg-[#ff8c00]/10 border border-[#ff8c00]/20 rounded-md gap-1">
                                            <Zap className="w-3 h-3 text-[#ff8c00] fill-[#ff8c00]/20" />
                                            <span className="text-[8px] font-bold text-[#ff8c00] uppercase tracking-tighter">Logic Active</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </BccEditorialWrapper>
    );
}
