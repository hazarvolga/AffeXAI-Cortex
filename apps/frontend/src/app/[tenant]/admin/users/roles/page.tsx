'use client';

import React, { useEffect, useState } from 'react';
import { BccEditorialWrapper } from '@/components/brand/BccEditorialWrapper';
import { BccHudTile } from '@/components/brand/BccHudTile';
import { UserManagementService, Role } from '@/services/user-management.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Shield, Users, Lock, Trash2, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            const data = await UserManagementService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Failed to load roles:', error);
            toast({
                title: 'Sync Error',
                description: 'Failed to synchronize role matrix.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BccEditorialWrapper
            headerTitle="Access Matrix"
            headerSubtitle="Role Definitions // Permission Scopes // Policy"
            headerBadge="Security Level 1"
            telemetryData={[
                { label: "Defined Roles", value: String(roles.length), suffix: "TYPES" },
                { label: "System Roles", value: String(roles.filter(r => r.isSystem).length), color: "#ff8c00" },
                { label: "Custom Policies", value: String(roles.filter(r => !r.isSystem).length), color: "#9df425" }
            ]}
            action={
                <Button className="bg-[#9df425] text-black hover:bg-[#8ce022] uppercase font-bold tracking-widest text-xs">
                    <Plus className="mr-2 h-4 w-4" />
                    Define New Role
                </Button>
            }
        >
            <div className="space-y-6 pb-20">

                {/* HUD Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <BccHudTile title="Policy Enforcement" icon="shield" accentColor="#9df425">
                        <div className="text-2xl font-bold font-mono tracking-tighter">ACTIVE</div>
                        <div className="text-[10px] text-white/40 font-mono mt-1">RBAC PROTOCOL ONLINE</div>
                    </BccHudTile>
                    <BccHudTile title="User Dist." icon="users" accentColor="#3b82f6">
                        <div className="text-2xl font-bold font-mono tracking-tighter">
                            {roles.reduce((acc, r) => acc + r.userCount, 0)}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono mt-1">TOTAL ASSIGNMENTS</div>
                    </BccHudTile>
                    <BccHudTile title="Privilege Level" icon="lock" accentColor="#f97316">
                        <div className="text-2xl font-bold font-mono tracking-tighter">MIXED</div>
                        <div className="text-[10px] text-white/40 font-mono mt-1">HIERARCHY ESTABLISHED</div>
                    </BccHudTile>
                </div>

                {/* Roles Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-48 bg-[#0a0a0a]/40 w-full" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {roles.map(role => (
                            <div
                                key={role.id}
                                className="group bg-[#0a0a0a]/40 border border-white/5 hover:border-white/20 p-6 transition-all duration-300 relative overflow-hidden"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-sm ${role.isSystem ? 'bg-orange-500/10 text-orange-500' : 'bg-[#9df425]/10 text-[#9df425]'}`}>
                                            {role.isSystem ? <Shield className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white tracking-tight uppercase">{role.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[9px] rounded-none border-white/10 text-white/40 font-mono">
                                                    {role.isSystem ? 'SYSTEM LOCKED' : 'CUSTOM POLICY'}
                                                </Badge>
                                                <span className="text-[10px] font-mono text-white/20">ID: {role.id.substring(0, 6)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions (Only for custom roles or viewing) */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 hover:text-white">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        {!role.isSystem && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10 hover:text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-xs text-white/50 mb-6 min-h-[3em] line-clamp-2 leading-relaxed">
                                    {role.description || "No description provided for this security role."}
                                </p>

                                {/* Metrics Footer */}
                                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-white/20 font-mono uppercase tracking-widest">Assignments</span>
                                        <span className="text-lg font-bold font-mono text-white">{role.userCount}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[9px] text-white/20 font-mono uppercase tracking-widest">Permissions</span>
                                        <span className="text-lg font-bold font-mono text-white">{role.permissions.length}</span>
                                    </div>
                                </div>

                                {/* Decorative Accent */}
                                <div className={`absolute bottom-0 left-0 w-full h-[1px] ${role.isSystem ? 'bg-orange-500/50' : 'bg-[#9df425]/50'}`} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </BccEditorialWrapper>
    );
}
