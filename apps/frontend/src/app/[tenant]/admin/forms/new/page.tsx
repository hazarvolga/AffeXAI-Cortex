'use client';

import { useState } from 'react';
import { FormBlockSidebar } from '@/components/shared/visual-builder/FormBlockSidebar';
import { FormBuilderCanvas, FormStructure, FormBlock } from '@/components/shared/visual-builder/FormBuilderCanvas';
import { FormPropertiesSidebar } from '@/components/shared/visual-builder/FormPropertiesSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Save, Eye, Monitor, Smartphone, Activity, Zap, Cpu } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';

export default function NewFormPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.tenant as string;

    const [formTitle, setFormTitle] = useState('New_Untitled_Form');
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [selectedBlock, setSelectedBlock] = useState<FormBlock | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [structure, setStructure] = useState<FormStructure>({
        rows: [],
        settings: {
            theme: 'modern',
            submitButtonText: 'Gönder',
            width: '600px',
        },
        logicConfig: { rules: [] }
    });

    const allBlocks = structure.rows.flatMap(row =>
        row.columns.flatMap(col => col.blocks)
    );

    const handleUpdateBlock = (updatedBlock: FormBlock) => {
        const newRows = structure.rows.map(row => ({
            ...row,
            columns: row.columns.map(col => ({
                ...col,
                blocks: col.blocks.map(block =>
                    block.id === updatedBlock.id ? updatedBlock : block
                )
            }))
        }));

        setStructure({ ...structure, rows: newRows });
        setSelectedBlock(updatedBlock);
    };

    const handleUpdateLogic = (newConfig: any) => {
        setStructure({ ...structure, logicConfig: newConfig });
    };

    const handleSave = async () => {
        if (!formTitle) {
            toast.error('Lütfen form başlığı girin');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`/api/forms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formTitle,
                    structure: structure,
                    tenantId: tenantId,
                }),
            });

            if (!response.ok) throw new Error('Yükleme hatası');

            toast.success('Form başarıyla kaydedildi');
            router.push(`/${tenantId}/admin/forms`);
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Form kaydedilirken bir hata oluştu');
        } finally {
            setIsSaving(false);
        }
    };

    const moduleNav = (
        <div className="flex items-center gap-6">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-3 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-[#ff8c00] text-black hover:bg-[#ff8c00]' : 'text-white/40 hover:text-white'}`}
                    onClick={() => setPreviewMode('desktop')}
                >
                    <Monitor className="w-3.5 h-3.5 mr-2" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Desktop</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-3 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-[#ff8c00] text-black hover:bg-[#ff8c00]' : 'text-white/40 hover:text-white'}`}
                    onClick={() => setPreviewMode('mobile')}
                >
                    <Smartphone className="w-3.5 h-3.5 mr-2" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Mobile</span>
                </Button>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <Button
                size="sm"
                className="h-9 px-6 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-bold uppercase tracking-widest text-[10px] rounded-xl shadow-[0_0_15px_rgba(255,140,0,0.2)]"
                onClick={handleSave}
                disabled={isSaving}
            >
                <Save className="w-3.5 h-3.5 mr-2" />
                {isSaving ? 'SYNCING...' : 'DEPLOY_NODE'}
            </Button>
        </div>
    );

    const telemetryData = [
        { label: "Complexity", value: String(allBlocks.length * 1.5 + structure.rows.length), suffix: "IDX" },
        { label: "Logic Load", value: String(structure.logicConfig?.rules?.length || 0), suffix: "RULE", color: "#9df425" },
        { label: "Stability", value: "Optimal", color: "#ff8c00" }
    ];

    return (
        <BccEditorialWrapper
            theme="tenant-admin"
            headerTitle="Form Orchestrator"
            headerSubtitle={`Configuring: ${formTitle}`}
            headerBadge="Neural Interface"
            telemetryData={telemetryData}
            moduleNav={moduleNav}
        >
            <div className="flex h-[calc(100vh-180px)] -m-12 relative overflow-hidden bg-[#050505]">
                {/* Visual Builder Workspace */}
                <div className="flex flex-1 overflow-hidden">
                    <FormBlockSidebar />

                    <main className="flex-1 overflow-y-auto relative p-12 scrollbar-hide">
                        {/* EDITOR BACKGROUND GRID */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

                        <div className="max-w-4xl mx-auto relative z-10">
                            {/* DYNAMIC TITLE INPUT */}
                            <div className="mb-12 flex items-center gap-4 group">
                                <Link href={`/${tenantId}/admin/forms`}>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-white/20 hover:text-white hover:bg-white/5 rounded-full border border-white/5">
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                </Link>
                                <Input
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="border-none p-0 focus-visible:ring-0 font-mono font-bold text-2xl uppercase tracking-tighter bg-transparent text-white group-hover:text-[#ff8c00] transition-colors"
                                    placeholder="ENTER_NODE_ID..."
                                />
                            </div>

                            <FormBuilderCanvas
                                structure={structure}
                                onStructureChange={setStructure}
                                selectedBlock={selectedBlock}
                                onBlockSelect={setSelectedBlock}
                                previewMode={previewMode}
                            />
                        </div>
                    </main>

                    <FormPropertiesSidebar
                        selectedBlock={selectedBlock}
                        onUpdateBlock={handleUpdateBlock}
                        allBlocks={allBlocks}
                        logicConfig={structure.logicConfig}
                        onUpdateLogic={handleUpdateLogic}
                    />
                </div>

                {/* DECORATIVE RAIL */}
                <div className="absolute left-0 bottom-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff8c00]/20 to-transparent"></div>
            </div>
        </BccEditorialWrapper>
    );
}
