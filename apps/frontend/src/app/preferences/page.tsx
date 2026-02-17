'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, Mail, Bell, ShoppingBag, Megaphone, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Preferences {
  email: string;
  marketingEmails: boolean;
  emailNotifications: boolean;
  newsletterWeekly: boolean;
  newsletterMonthly: boolean;
  productUpdates: boolean;
  specialOffers: boolean;
  eventInvitations: boolean;
  surveyRequests: boolean;
}

function PreferencesContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email');

  const [email, setEmail] = useState(emailParam || '');
  const [preferences, setPreferences] = useState<Preferences>({
    email: '',
    marketingEmails: true,
    emailNotifications: true,
    newsletterWeekly: false,
    newsletterMonthly: true,
    productUpdates: true,
    specialOffers: true,
    eventInvitations: false,
    surveyRequests: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);

  useEffect(() => {
    if (emailParam) {
      fetchPreferences(emailParam);
    }
  }, [emailParam]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const fetchPreferences = async (emailAddress: string) => {
    if (!validateEmail(emailAddress)) {
      toast.error('Geçerli bir e-posta adresi girin');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/email-marketing/subscription/preferences/${encodeURIComponent(emailAddress)}`);

      if (response.ok) {
        const data = await response.json();
        setPreferences({ ...data, email: emailAddress });
        setIsEmailValid(true);
      } else if (response.status === 404) {
        // Subscriber not found, show default preferences
        setPreferences(prev => ({ ...prev, email: emailAddress }));
        setIsEmailValid(true);
        toast.info('Bu e-posta adresi henüz kayıtlı değil');
      } else {
        toast.error('Tercihler yüklenemedi');
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPreferences(email);
  };

  const handleSavePreferences = async () => {
    if (!validateEmail(preferences.email)) {
      toast.error('Geçerli bir e-posta adresi girin');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/email-marketing/subscription/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: preferences.email,
          marketingEmails: preferences.marketingEmails,
          emailNotifications: preferences.emailNotifications,
        }),
      });

      if (response.ok) {
        toast.success('Tercihleriniz başarıyla güncellendi');
      } else {
        toast.error('Tercihler güncellenemedi');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    setPreferences(prev => ({
      ...prev,
      marketingEmails: false,
      emailNotifications: false,
      newsletterWeekly: false,
      newsletterMonthly: false,
      productUpdates: false,
      specialOffers: false,
      eventInvitations: false,
      surveyRequests: false,
    }));
    toast.info('Tüm aboneliklerden çıkıldı. Değişiklikleri kaydetmeyi unutmayın.');
  };

  if (!isEmailValid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>E-posta Tercihlerinizi Yönetin</CardTitle>
            <CardDescription>
              Hangi e-postaları almak istediğinizi kontrol edin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta Adresi</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Yükleniyor...' : 'Tercihlerimi Görüntüle'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>E-posta Tercihleri</CardTitle>
            <CardDescription>
              {preferences.email} için e-posta tercihlerini yönet
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Main Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Ana Tercihler
            </CardTitle>
            <CardDescription>
              Genel e-posta bildirim ayarlarınız
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="marketing">Pazarlama E-postaları</Label>
                <p className="text-sm text-gray-500">
                  Ürünler, hizmetler ve özel teklifler hakkında bilgiler
                </p>
              </div>
              <Switch
                id="marketing"
                checked={preferences.marketingEmails}
                onCheckedChange={(checked) =>
                  setPreferences(prev => ({ ...prev, marketingEmails: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="notifications">Bildirim E-postaları</Label>
                <p className="text-sm text-gray-500">
                  Hesap aktiviteleri ve önemli güncellemeler
                </p>
              </div>
              <Switch
                id="notifications"
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) =>
                  setPreferences(prev => ({ ...prev, emailNotifications: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              Detaylı Tercihler
            </CardTitle>
            <CardDescription>
              Hangi tür içerikleri almak istediğinizi seçin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Newsletters */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Bültenler
              </h3>
              <div className="pl-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="weekly">Haftalık Bülten</Label>
                    <p className="text-sm text-gray-500">
                      Haftanın öne çıkanları ve yenilikler
                    </p>
                  </div>
                  <Switch
                    id="weekly"
                    checked={preferences.newsletterWeekly}
                    onCheckedChange={(checked) =>
                      setPreferences(prev => ({ ...prev, newsletterWeekly: checked }))
                    }
                    disabled={!preferences.marketingEmails}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="monthly">Aylık Bülten</Label>
                    <p className="text-sm text-gray-500">
                      Ayın özeti ve gelecek etkinlikler
                    </p>
                  </div>
                  <Switch
                    id="monthly"
                    checked={preferences.newsletterMonthly}
                    onCheckedChange={(checked) =>
                      setPreferences(prev => ({ ...prev, newsletterMonthly: checked }))
                    }
                    disabled={!preferences.marketingEmails}
                  />
                </div>
              </div>
            </div>

            {/* Product & Offers */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Ürünler ve Teklifler
              </h3>
              <div className="pl-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="products">Ürün Güncellemeleri</Label>
                    <p className="text-sm text-gray-500">
                      Yeni ürünler ve özellik duyuruları
                    </p>
                  </div>
                  <Switch
                    id="products"
                    checked={preferences.productUpdates}
                    onCheckedChange={(checked) =>
                      setPreferences(prev => ({ ...prev, productUpdates: checked }))
                    }
                    disabled={!preferences.marketingEmails}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="offers">Özel Teklifler</Label>
                    <p className="text-sm text-gray-500">
                      İndirimler ve promosyon kodları
                    </p>
                  </div>
                  <Switch
                    id="offers"
                    checked={preferences.specialOffers}
                    onCheckedChange={(checked) =>
                      setPreferences(prev => ({ ...prev, specialOffers: checked }))
                    }
                    disabled={!preferences.marketingEmails}
                  />
                </div>
              </div>
            </div>

            {/* Other */}
            <div className="space-y-4">
              <h3 className="font-medium">Diğer</h3>
              <div className="pl-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="events">Etkinlik Davetleri</Label>
                    <p className="text-sm text-gray-500">
                      Webinar, workshop ve etkinlik duyuruları
                    </p>
                  </div>
                  <Switch
                    id="events"
                    checked={preferences.eventInvitations}
                    onCheckedChange={(checked) =>
                      setPreferences(prev => ({ ...prev, eventInvitations: checked }))
                    }
                    disabled={!preferences.marketingEmails}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="surveys">Anket ve Araştırmalar</Label>
                    <p className="text-sm text-gray-500">
                      Görüşlerinizi almak için anketler
                    </p>
                  </div>
                  <Switch
                    id="surveys"
                    checked={preferences.surveyRequests}
                    onCheckedChange={(checked) =>
                      setPreferences(prev => ({ ...prev, surveyRequests: checked }))
                    }
                    disabled={!preferences.marketingEmails}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notice */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-amber-900 font-medium">Önemli Bilgi</p>
                <p className="text-sm text-amber-700">
                  İşlemsel e-postalar (sipariş onayları, şifre sıfırlama, güvenlik bildirimleri)
                  tercihlerinizden bağımsız olarak gönderilmeye devam edecektir.
                  Bu e-postalar hesabınızın güvenliği ve hizmet sürekliliği için gereklidir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            variant="destructive"
            onClick={handleUnsubscribeAll}
            className="flex-1"
          >
            Tüm Aboneliklerden Çık
          </Button>
          <Button
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? (
              'Kaydediliyor...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Tercihleri Kaydet
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <PreferencesContent />
    </Suspense>
  );
}