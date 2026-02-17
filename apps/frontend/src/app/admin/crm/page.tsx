'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { crmService, type CreateCrmCustomerDto } from '@/services/crm.service';
import { Upload, Plus, Trash2, Edit, Users, Database } from 'lucide-react';

export default function CrmManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [formData, setFormData] = useState<CreateCrmCustomerDto>({
    companyName: '',
    email: '',
    customerNumber: '',
    contactPerson: '',
    phone: '',
    city: '',
    country: '',
  });

  // Fetch CRM customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['crm-customers'],
    queryFn: () => crmService.getAll(),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['crm-stats'],
    queryFn: () => crmService.getStats(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateCrmCustomerDto) => crmService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      toast({ title: 'Başarılı', description: 'Müşteri eklendi' });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Hata',
        description: error.response?.data?.message || 'Müşteri eklenemedi',
        variant: 'destructive',
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (customers: CreateCrmCustomerDto[]) => crmService.bulkImport(customers),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      toast({
        title: 'Import Tamamlandı',
        description: `${result.imported} müşteri eklendi, ${result.skipped} atlandı`,
      });
      setShowImportDialog(false);
      setCsvText('');
    },
    onError: (error: any) => {
      toast({
        title: 'Hata',
        description: error.response?.data?.message || 'Import başarısız',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      toast({ title: 'Başarılı', description: 'Müşteri silindi' });
    },
  });

  const resetForm = () => {
    setFormData({
      companyName: '',
      email: '',
      customerNumber: '',
      contactPerson: '',
      phone: '',
      city: '',
      country: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.companyName || !formData.email) {
      toast({
        title: 'Hata',
        description: 'Firma adı ve email zorunludur',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleImport = () => {
    try {
      // Parse CSV: companyName,email,customerNumber,contactPerson,phone,city,country
      const lines = csvText.trim().split('\n');
      const customers: CreateCrmCustomerDto[] = lines
        .slice(1) // Skip header
        .filter(line => line.trim())
        .map(line => {
          const [companyName, email, customerNumber, contactPerson, phone, city, country] =
            line.split(',').map(s => s.trim());
          return {
            companyName,
            email,
            customerNumber,
            contactPerson,
            phone,
            city,
            country,
          };
        });

      if (customers.length === 0) {
        toast({
          title: 'Hata',
          description: 'Geçerli müşteri bulunamadı',
          variant: 'destructive',
        });
        return;
      }

      importMutation.mutate(customers);
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'CSV formatı hatalı',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Stats */}
      <div>
        <h1 className="text-3xl font-bold">CRM Yönetimi</h1>
        <p className="text-muted-foreground">
          Müşteri verilerini içe aktarın ve yönetin. CRM'deki emailler ile kayıt olan kullanıcılar otomatik olarak customer rolü alır.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Müşteri</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.active || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pasif</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats?.inactive || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Müşteri Ekle
        </Button>
        <Button variant="outline" onClick={() => setShowImportDialog(true)}>
          <Upload className="mr-2 h-4 w-4" />
          CSV İçe Aktar
        </Button>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Müşteri Listesi</CardTitle>
          <CardDescription>{customers.length} müşteri</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Yükleniyor...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz müşteri yok. Yukarıdaki butonları kullanarak müşteri ekleyin.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Müşteri No</TableHead>
                  <TableHead>İletişim</TableHead>
                  <TableHead>Şehir</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.companyName}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.customerNumber || '-'}</TableCell>
                    <TableCell>{customer.contactPerson || '-'}</TableCell>
                    <TableCell>{customer.city || '-'}</TableCell>
                    <TableCell>
                      {customer.isActive ? (
                        <Badge variant="default">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary">Pasif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
            <DialogDescription>
              CRM sistemine yeni müşteri ekleyin
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Firma Adı *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Örnek Şirket A.Ş."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@ornek.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerNumber">Müşteri Numarası</Label>
              <Input
                id="customerNumber"
                value={formData.customerNumber}
                onChange={(e) => setFormData({ ...formData, customerNumber: e.target.value })}
                placeholder="CUST-12345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">İletişim Kişisi</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Ahmet Yılmaz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 555 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Şehir</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="İstanbul"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="country">Ülke</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Türkiye"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>CSV İçe Aktar</DialogTitle>
            <DialogDescription>
              CSV formatında müşteri verilerini içe aktarın. İlk satır başlık olmalıdır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV Format Örneği:</Label>
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
{`companyName,email,customerNumber,contactPerson,phone,city,country
Örnek A.Ş.,info@ornek.com,CUST-001,Ahmet Yılmaz,+90 555 123 4567,İstanbul,Türkiye
Test Ltd.,test@test.com,CUST-002,Mehmet Demir,+90 555 987 6543,Ankara,Türkiye`}
              </pre>
            </div>
            <div className="space-y-2">
              <Label htmlFor="csvText">CSV Verisi</Label>
              <Textarea
                id="csvText"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="CSV verisini buraya yapıştırın..."
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
