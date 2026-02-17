
'use client';

import { Bell, AlertTriangle, Info, CheckCircle, UserPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { BccEditorialWrapper } from "@/components/brand/BccEditorialWrapper";
import { BccHudTile } from "@/components/brand/BccHudTile";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Notification = {
    id: number;
    type: 'new_user' | 'system_alert' | 'content_approval' | 'update_complete';
    title: string;
    message: string;
    read: boolean;
    time: string;
};

const initialNotifications: Notification[] = [
    { id: 1, type: 'new_user', title: 'Yeni Kullanıcı Kaydı', message: 'editor@example.com adresiyle yeni bir kullanıcı kayıt oldu.', read: false, time: '5 dakika önce' },
    { id: 2, type: 'system_alert', title: 'Sistem Uyarısı', message: 'Sunucu belleği %90 doluluk oranına ulaştı.', read: false, time: '1 saat önce' },
    { id: 3, type: 'content_approval', title: 'Onay Bekleyen İçerik', message: '"Yeni Allplan Sürümü" başlıklı blog yazısı onayınızı bekliyor.', read: true, time: '3 saat önce' },
    { id: 4, type: 'update_complete', title: 'Güncelleme Başarılı', message: 'Sistem başarıyla v2.1.0 sürümüne güncellendi.', read: true, time: '1 gün önce' },
];

const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'system_alert': return <AlertTriangle className="h-5 w-5 text-destructive" />;
        case 'new_user': return <UserPlus className="h-5 w-5 text-blue-500" />;
        case 'content_approval': return <Info className="h-5 w-5 text-orange-500" />;
        case 'update_complete': return <CheckCircle className="h-5 w-5 text-green-500" />;
        default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
}

const NotificationsLayoutWrapper = ({
    children,
    telemetryData
}: {
    children: React.ReactNode;
    telemetryData: any[];
}) => {
    return (
        <BccEditorialWrapper
            theme="tenant-admin"
            headerTitle="Signal Intelligence"
            headerSubtitle="Synthesizing ecosystem events and neural dispatch logs."
            headerBadge="Signal Console"
            telemetryData={telemetryData}
        >
            <div className="relative z-10 w-full min-h-screen flex flex-col pt-0">
                {children}
            </div>
        </BccEditorialWrapper>
    );
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
    const totalCount = notifications.length;

    const telemetryData = useMemo(() => [
        { label: 'TOTAL_SIGNALS', value: totalCount.toString(), color: '#ff8c00' },
        { label: 'UNREAD_NODES', value: unreadCount.toString(), color: unreadCount > 0 ? '#ff8c00' : '#9df425' },
        { label: 'SIGNAL_INTEGRITY', value: 'OPTIMAL', color: '#9df425' }
    ], [totalCount, unreadCount]);

    const markAsRead = (id: number) => {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
    };


    return (
        <NotificationsLayoutWrapper telemetryData={telemetryData}>
            <div className="space-y-8 pb-20">

                {/* Management Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] font-mono flex items-center gap-3">
                            <div className="w-1 h-4 bg-[#ff8c00]"></div>
                            Signal Repository
                        </h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-2 ml-4">
                            Real-time feed of systemic perturbations and user vectors.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={markAllAsRead}
                            disabled={unreadCount === 0}
                            className="rounded-none border-white/10 bg-white/5 hover:bg-[#ff8c00] hover:text-black font-mono text-[9px] uppercase tracking-widest h-10 transition-all"
                        >
                            Acknowledge_All
                        </Button>
                        <Button
                            variant="outline"
                            onClick={clearAll}
                            disabled={totalCount === 0}
                            className="rounded-none border-white/10 bg-white/5 hover:bg-red-500/20 hover:text-red-500 font-mono text-[9px] uppercase tracking-widest h-10 transition-all"
                        >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Purge_Signals
                        </Button>
                    </div>
                </div>

                <Separator className="bg-white/5" />

                {/* Signal Feed */}
                <div className="max-w-4xl mx-auto w-full">
                    {notifications.length > 0 ? (
                        <div className="space-y-4">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "bcc-glass border-none group transition-all duration-500 relative overflow-hidden",
                                        !notification.read ? "bg-white/[0.03] shadow-[inset_0_0_20px_rgba(255,140,0,0.05)]" : "bg-white/[0.01] opacity-60"
                                    )}
                                >
                                    {/* Status Indicator */}
                                    {!notification.read && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#ff8c00]"></div>
                                    )}

                                    <div className="p-6 flex items-start gap-6">
                                        <div className={cn(
                                            "p-3 rounded-none border border-white/5 transition-colors duration-500",
                                            !notification.read ? "bg-white/10 border-[#ff8c00]/30" : "bg-white/5"
                                        )}>
                                            {getNotificationIcon(notification.type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4 mb-2">
                                                <p className={cn(
                                                    "text-sm font-bold uppercase tracking-widest font-mono truncate",
                                                    !notification.read ? "text-white" : "text-white/40"
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <Badge variant="outline" className="rounded-none border-white/5 bg-white/[0.02] text-[9px] font-mono text-white/30 px-2 py-0">
                                                    {notification.time}
                                                </Badge>
                                            </div>
                                            <p className={cn(
                                                "text-xs font-mono leading-relaxed",
                                                !notification.read ? "text-white/70" : "text-white/20"
                                            )}>
                                                {notification.message}
                                            </p>

                                            {!notification.read && (
                                                <div className="mt-4 flex justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#ff8c00] hover:bg-[#ff8c00]/10 hover:text-[#ff8c00] rounded-none py-0 h-6"
                                                    >
                                                        {">"} EXECUTE_ACKNOWLEDGE
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <BccHudTile icon="notifications_off" title="Signal Silenced" subtitle="Ecosystem Quiescence" className="py-20 text-center flex flex-col items-center justify-center">
                            <Bell className="h-12 w-12 text-white/5 mb-6" />
                            <p className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-mono">
                                No active perturbations detected in the neural grid.
                            </p>
                        </BccHudTile>
                    )}
                </div>
            </div>
        </NotificationsLayoutWrapper>
    );
}
