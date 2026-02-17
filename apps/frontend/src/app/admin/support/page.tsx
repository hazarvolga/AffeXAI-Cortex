'use client';

import { useState, useEffect } from 'react';
import { httpClient } from '@/lib/api/http-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Circle,
  CheckCircle2,
  XCircle,
  Book,
  Activity,
  Check,
  Clock,
  Zap,
  AlertTriangle,
  BarChart3,
  FileText,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTicketNotifications } from '@/hooks/useTicketNotifications';
import { Badge as ConnectionBadge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'PENDING_CUSTOMER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  slaCompliance: number;
  slaBreaches: number;
}

const getStatusIcon = (status: Ticket['status']) => {
  switch (status) {
    case 'OPEN':
      return <ArrowRight className="h-4 w-4 text-blue-500" />;
    case 'IN_PROGRESS':
      return <Circle className="h-4 w-4 text-yellow-500 animate-pulse" />;
    case 'RESOLVED':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'CLOSED':
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    case 'PENDING_CUSTOMER':
      return <Clock className="h-4 w-4 text-orange-500" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
};

const getPriorityIcon = (priority: Ticket['priority']) => {
  switch (priority) {
    case 'URGENT':
    case 'HIGH':
      return <ArrowUp className="h-4 w-4 text-red-500" />;
    case 'MEDIUM':
      return <ArrowRight className="h-4 w-4 text-yellow-500" />;
    case 'LOW':
      return <ArrowDown className="h-4 w-4 text-green-500" />;
    default:
      return <ArrowRight className="h-4 w-4" />;
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    OPEN: 'Açık',
    IN_PROGRESS: 'İşlemde',
    RESOLVED: 'Çözüldü',
    CLOSED: 'Kapalı',
    PENDING_CUSTOMER: 'Müşteri Bekliyor',
  };
  return labels[status] || status;
};

const getPriorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    LOW: 'Düşük',
    MEDIUM: 'Orta',
    HIGH: 'Yüksek',
    URGENT: 'Acil',
  };
  return labels[priority] || priority;
};

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
};

const formatTime = (hours: number) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}dk`;
  }
  return `${hours.toFixed(1)}s`;
};

export default function SupportDashboardPage() {
  const { isConnected } = useTicketNotifications();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch tickets using httpClient (with auth)
      // Note: Backend doesn't support limit/sortBy/sortOrder params in TicketFiltersDto
      const tickets = await ticketsService.getTickets() as Ticket[];

      // Sort and limit on frontend as per legacy logic but with type safety
      const latestTickets = [...tickets]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      setTickets(latestTickets);

      // Fetch stats using service method
      const stats = await ticketsService.getStats() as TicketStats;
      setStats(stats);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { title: 'Açık Talepler', value: stats?.openTickets || 0, icon: Activity },
    { title: 'İşlemde', value: stats?.inProgressTickets || 0, icon: Clock },
    { title: 'Çözüldü', value: stats?.resolvedTickets || 0, icon: Check },
    { title: 'Kapandı', value: stats?.closedTickets || 0, icon: XCircle },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Destek Paneli</h2>
            <p className="text-muted-foreground">Destek taleplerine genel bir bakış.</p>
          </div>
          <ConnectionBadge
            variant={isConnected ? 'default' : 'secondary'}
            className="flex items-center gap-1"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Canlı
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Bağlantı Kesildi
              </>
            )}
          </ConnectionBadge>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/support/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Yeni Talep Oluştur
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/support/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analitikler
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/support/templates">
              <FileText className="mr-2 h-4 w-4" />
              Şablonlar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/support/categories">
              <Book className="mr-2 h-4 w-4" />
              Kategoriler
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SLA Metrics Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Uyumluluk</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.slaCompliance || 0}%</div>
            <p className="text-xs text-muted-foreground">Hedef: 95%+</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ort. Yanıt Süresi</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(stats?.averageResponseTime || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Hedef: &lt;4s</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Çözüm Süresi</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(stats?.averageResolutionTime || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Hedef: &lt;24s</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA İhlalleri</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.slaBreaches || 0}</div>
            <p className="text-xs text-muted-foreground">Bu ay</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Son Destek Talepleri</CardTitle>
            <CardDescription>En son oluşturulan 5 destek talebi.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz destek talebi bulunmuyor.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Talep ID</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Öncelik</TableHead>
                  <TableHead>
                    <span className="sr-only">Eylemler</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs">
                      #{ticket.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/support/${ticket.id}`}
                        className="hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {ticket.category?.name || 'Kategorisiz'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {getInitials(ticket.user?.firstName, ticket.user?.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div>
                            {ticket.user?.firstName || 'Bilinmeyen'} {ticket.user?.lastName || 'Kullanıcı'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {ticket.user?.email || 'Email yok'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                            ? 'outline'
                            : 'default'
                        }
                        className={cn(
                          'flex items-center gap-1.5',
                          ticket.status === 'OPEN' && 'bg-blue-500/20 text-blue-700',
                          ticket.status === 'IN_PROGRESS' &&
                          'bg-yellow-500/20 text-yellow-700'
                        )}
                      >
                        {getStatusIcon(ticket.status)}
                        {getStatusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getPriorityIcon(ticket.priority)}
                        {getPriorityLabel(ticket.priority)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Menüyü aç</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/support/${ticket.id}`}>
                              Görüntüle ve Cevapla
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${ticket.user.id}`}>
                              Kullanıcıyı Görüntüle
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-sm text-muted-foreground">
            Toplam {stats?.totalTickets || 0} talep bulunuyor.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/support/tickets">Tüm Talepleri Gör</Link>
          </Button>
        </CardFooter>
      </Card>
    </div >
  );
}
