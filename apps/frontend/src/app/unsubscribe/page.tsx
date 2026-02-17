'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Mail, Settings } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [email, setEmail] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      handleUnsubscribe();
    }
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) {
      setStatus('error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/email-marketing/subscription/unsubscribe/${token}?reason=${encodeURIComponent(reason)}`, {
        method: 'GET',
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setEmail(data.email || '');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (reason.trim() && token) {
      await handleUnsubscribe();
      setShowFeedback(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Geçersiz Bağlantı</CardTitle>
            <CardDescription>
              Abonelikten çıkma bağlantısı geçersiz veya eksik.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button className="mt-4">Ana Sayfaya Dön</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Abonelikten Çıkılıyor...</CardTitle>
            <CardDescription>
              Lütfen bekleyin, isteğiniz işleniyor.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Başarıyla Abonelikten Çıktınız</CardTitle>
            <CardDescription>
              {email && `${email} adresi`} e-posta listelerimizden çıkarıldı.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showFeedback && (
              <>
                <p className="text-sm text-gray-600 text-center">
                  Artık pazarlama e-postalarımızı almayacaksınız. Ancak hesabınızla ilgili önemli bildirimleri
                  (sipariş onayı, güvenlik bildirimleri vb.) almaya devam edeceksiniz.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowFeedback(true)}
                  >
                    Geri Bildirim Bırak
                  </Button>
                  <Link href="/preferences">
                    <Button variant="outline">
                      <Settings className="w-4 h-4 mr-2" />
                      Tercihlerimi Yönet
                    </Button>
                  </Link>
                </div>

                <div className="text-center mt-6">
                  <p className="text-sm text-gray-500 mb-2">Fikrini değiştirdin mi?</p>
                  <Link href="/resubscribe" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Tekrar Abone Ol
                  </Link>
                </div>
              </>
            )}

            {showFeedback && (
              <div className="space-y-3">
                <Label htmlFor="feedback">
                  Neden abonelikten çıktığınızı öğrenebilir miyiz?
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Geri bildiriminiz bizim için değerli..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowFeedback(false)}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={handleFeedbackSubmit}
                    disabled={isSubmitting || !reason.trim()}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Bir Hata Oluştu</CardTitle>
            <CardDescription>
              Abonelikten çıkma işlemi sırasında bir hata oluştu.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Bağlantınız geçersiz olabilir veya süresi dolmuş olabilir.
              Lütfen e-postanızdaki bağlantıyı tekrar kontrol edin.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleUnsubscribe} disabled={isSubmitting}>
                {isSubmitting ? 'Deneniyor...' : 'Tekrar Dene'}
              </Button>
              <Link href="/">
                <Button variant="outline">Ana Sayfaya Dön</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}