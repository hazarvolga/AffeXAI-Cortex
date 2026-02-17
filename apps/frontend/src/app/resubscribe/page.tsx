'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ResubscribePage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Geçerli bir e-posta adresi girin');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/email-marketing/subscription/resubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsSuccess(true);
        toast.success('Yeniden abone oldunuz!');
      } else {
        const data = await response.json();
        if (data.message) {
          toast.error(data.message);
        } else {
          toast.error('Bir hata oluştu');
        }
      }
    } catch (error) {
      console.error('Resubscribe error:', error);
      toast.error('Bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Hoş Geldiniz!</CardTitle>
            <CardDescription>
              Başarıyla yeniden abone oldunuz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              {email} adresi e-posta listemize yeniden eklendi.
              En son haberler ve özel tekliflerden haberdar olacaksınız.
            </p>

            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">
                E-posta onayı gerekebilir
              </p>
              <p className="text-sm text-blue-700">
                Güvenliğiniz için size bir onay e-postası gönderdik.
                Lütfen gelen kutunuzu kontrol edin ve aboneliğinizi onaylayın.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/preferences" className="flex-1">
                <Button variant="outline" className="w-full">
                  Tercihlerimi Yönet
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full">
                  Ana Sayfaya Dön
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Yeniden Abone Ol</CardTitle>
          <CardDescription>
            E-posta bültenlerimize yeniden abone olun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">
                Yeniden abone olduğunuzda:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  En son ürün ve hizmetlerden haberdar olursunuz
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Özel indirim ve kampanyalardan yararlanırsınız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Etkinlik ve webinar davetleri alırsınız
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  İstediğiniz zaman abonelikten çıkabilirsiniz
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'İşleniyor...'
              ) : (
                <>
                  Yeniden Abone Ol
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Tercihlerinizi mi yönetmek istiyorsunuz?
            </p>
            <Link
              href="/preferences"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              E-posta Tercihlerim
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}