'use client';

import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface RoleEditorProps {
    role: {
        id: string;
        name: string;
        description: string;
        userCount: number;
        permissions: string[];
    };
    onClose: () => void;
    onSave: (role: any) => void;
}

export function RoleEditor({ role, onClose, onSave }: RoleEditorProps) {
    const [name, setName] = useState(role.name);
    const [description, setDescription] = useState(role.description);

    const handleSave = () => {
        onSave({
            ...role,
            name,
            description,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-none w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div>
                        <div className="text-[14px] font-bold uppercase tracking-[0.2em] text-white">
                            Role Configuration
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mt-1 font-mono">
                            Edit identity vector parameters
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/20 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Role Name */}
                    <div>
                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono block mb-2">
                            Identification Label
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-black border-white/10 rounded-none text-white h-10 text-[11px] focus:border-[#9df425] transition-colors"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono block mb-2">
                            Functional Description
                        </label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-black border-white/10 rounded-none text-white min-h-[100px] text-[11px] focus:border-[#9df425] transition-colors resize-none"
                        />
                    </div>

                    {/* Meta Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                        <div className="space-y-1">
                            <div className="text-[9px] uppercase tracking-widest text-white/30 font-mono">
                                Population
                            </div>
                            <div className="text-2xl font-mono text-white flex items-baseline gap-2">
                                {role.userCount}
                                <span className="text-[10px] text-white/20">Units</span>
                            </div>
                        </div>
                        <div className="space-y-1 text-right">
                            <div className="text-[9px] uppercase tracking-widest text-white/30 font-mono">
                                Perms_Score
                            </div>
                            <div className="text-2xl font-mono text-[#9df425]">
                                {role.permissions.length}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-white/5 bg-white/[0.01]">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        size="sm"
                        className="h-10 bg-transparent border-white/10 text-white/60 hover:text-white hover:bg-white/5 rounded-none text-[10px] uppercase tracking-widest font-mono px-6"
                    >
                        Abort
                    </Button>
                    <Button
                        onClick={handleSave}
                        size="sm"
                        className="h-10 bg-[#9df425] text-black hover:bg-[#8ce620] rounded-none text-[10px] uppercase tracking-widest font-bold px-8 transition-colors"
                    >
                        <Save className="w-3 h-3 mr-2" />
                        Apply Delta
                    </Button>
                </div>
            </div>
        </div>
    );
}

