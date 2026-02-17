'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { UserManagementService } from '@/services/user-management.service';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ShieldCheck, Loader2, Lock } from 'lucide-react';

const PERMISSION_DOMAINS = [
    {
        id: 'users',
        label: 'User Management',
        actions: [
            { id: 'users:read', label: 'View Users' },
            { id: 'users:write', label: 'Create/Edit Users' },
            { id: 'users:delete', label: 'Delete Users' }
        ]
    },
    {
        id: 'roles',
        label: 'Role Policy',
        actions: [
            { id: 'roles:read', label: 'View Roles' },
            { id: 'roles:write', label: 'Manage Roles' }
        ]
    },
    {
        id: 'content',
        label: 'Content & Media',
        actions: [
            { id: 'content:read', label: 'Access Library' },
            { id: 'content:write', label: 'Publish Content' }
        ]
    },
    {
        id: 'system',
        label: 'System Operations',
        actions: [
            { id: 'system:settings', label: 'Configure Settings' },
            { id: 'system:audit', label: 'View Audit Logs' }
        ]
    }
];

export default async function CreateRolePage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant } = await params;
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        displayName: ''
    });

    const [permissions, setPermissions] = useState<string[]>([]);

    const togglePermission = (permId: string) => {
        setPermissions(prev =>
            prev.includes(permId)
                ? prev.filter(p => p !== permId)
                : [...prev, permId]
        );
    };

    const toggleDomain = (actions: { id: string }[]) => {
        const allSelected = actions.every(a => permissions.includes(a.id));
        if (allSelected) {
            setPermissions(prev => prev.filter(p => !actions.map(a => a.id).includes(p)));
        } else {
            const newPerms = actions.map(a => a.id).filter(id => !permissions.includes(id));
            setPermissions(prev => [...prev, ...newPerms]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.displayName) {
            toast({ title: 'Validation Error', description: 'Role Name and Display Name are required.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            await UserManagementService.createRole({
                name: formData.name.toLowerCase().replace(/\s+/g, '_'),
                description: formData.description,
                displayName: formData.displayName,
                permissions: permissions
            });

            toast({ title: 'Policy Defined', description: 'New role has been successfully created.' });
            router.push(`/${tenant}/admin/users/roles`);
        } catch (error: any) {
            toast({
                title: 'Definition Failed',
                description: error.message || 'Could not create role policy.',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <BccEditorialWrapper
            headerTitle="Define Policy"
            headerSubtitle="Access Control // Permission Matrix // Role Definition"
            headerBadge="Security v1.0"
            telemetryData={[
                { label: "Matrix Complexity", value: String(permissions.length), suffix: "PERMS", color: permissions.length > 5 ? "#ff8c00" : "#9df425" },
                { label: "Policy Scope", value: "CUSTOM", color: "#666" }
            ]}
            action={
                <Button
                    variant="outline"
                    className="border-white/10 hover:bg-white/5 text-white/60"
                    onClick={() => router.back()}
                >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Cancel
                </Button>
            }
        >
            <div className="max-w-5xl mx-auto pb-20">
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Role Metadata */}
                    <div className="bg-[#0a0a0a]/40 border border-white/5 p-8 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-white/10 group-hover:bg-[#9df425] transition-colors" />

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-10 h-10 rounded-none bg-white/5 flex items-center justify-center border border-white/10">
                                <ShieldCheck className="h-5 w-5 text-[#9df425]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Role Definition</h3>
                                <p className="text-white/40 text-sm font-mono">METADATA & SCOPE</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest text-white/50">Display Name</Label>
                                <Input
                                    value={formData.displayName}
                                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                    className="bg-black/40 border-white/10 focus:border-[#9df425]/50 h-12 font-mono"
                                    placeholder="e.g. Marketing Manager"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-widest text-white/50">System Identifier (Auto)</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="bg-black/40 border-white/10 focus:border-[#9df425]/50 h-12 font-mono text-[#9df425]"
                                    placeholder="e.g. marketing_manager"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs uppercase tracking-widest text-white/50">Description</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="bg-black/40 border-white/10 focus:border-[#9df425]/50 min-h-[100px] font-mono resize-none"
                                    placeholder="Define the scope and purpose of this role..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Permission Matrix */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-4 px-1">
                            <div className="w-8 h-8 rounded-none bg-white/5 flex items-center justify-center border border-white/10">
                                <Lock className="h-4 w-4 text-[#ff8c00]" />
                            </div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Permission Matrix</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {PERMISSION_DOMAINS.map(domain => (
                                <div key={domain.id} className="bg-[#0a0a0a]/40 border border-white/5 p-6 hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">{domain.label}</h4>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px] text-white/40 hover:text-white"
                                            onClick={() => toggleDomain(domain.actions)}
                                        >
                                            TOGGLE ALL
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        {domain.actions.map(action => (
                                            <div key={action.id} className="flex items-center justify-between group">
                                                <Label htmlFor={action.id} className="text-sm text-white/70 font-mono group-hover:text-white cursor-pointer">
                                                    {action.label}
                                                </Label>
                                                <Switch
                                                    id={action.id}
                                                    checked={permissions.includes(action.id)}
                                                    onCheckedChange={() => togglePermission(action.id)}
                                                    className="data-[state=checked]:bg-[#ff8c00]"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Submit Action */}
                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-[#9df425] hover:bg-[#8ce022] text-black font-bold h-12 px-8 uppercase tracking-widest text-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Defining Policy...
                                </>
                            ) : (
                                <>
                                    Save Role Policy
                                    <ShieldCheck className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </BccEditorialWrapper>
    );
}
