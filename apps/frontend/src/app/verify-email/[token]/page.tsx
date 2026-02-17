'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { httpClient } from '@/lib/api/http-client';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = params.token as string;

      if (!token) {
        setError('Doğrulama linki geçersiz');
        setLoading(false);
        return;
      }

      try {
        const response = await httpClient.get(`/auth/verify-email/${token}`);

        // CRITICAL SECURITY FIX: Backend now returns JWT tokens after email verification
        // This prevents unauthorized access to admin panel and ensures proper flow:
        // verify-email → auto-login → complete-profile → portal
        if (response && response.success) {
          setSuccess(true);
          setUserEmail(response.user?.email || '');

          // Store authentication tokens
          if (response.access_token) {
            localStorage.setItem('access_token', response.access_token);
          }
          if (response.refresh_token) {
            localStorage.setItem('refresh_token', response.refresh_token);
          }
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }

          toast({
            title: 'Başarılı! 🎉',
            description: response.message || 'Email adresiniz başarıyla doğrulandı!',
          });

          // Auto-redirect to portal dashboard after 2 seconds
          setTimeout(() => {
            router.push('/portal/dashboard');
          }, 2000);
        } else {
          setError(response?.message || 'Doğrulama başarısız');
        }
      } catch (err: any) {
        console.error('Verification error:', err);
        setError(
          err.response?.data?.message ||
          err.message ||
          'Doğrulama sırasında bir hata oluştu'
        );

        toast({
          title: 'Hata',
          description: 'Email doğrulama başarısız oldu',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [params.token, toast, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-4">
          {loading ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              <CardTitle className="text-xl">Email Doğrulanıyor...</CardTitle>
              <CardDescription>
                Lütfen bekleyin, email adresiniz doğrulanıyor.
              </CardDescription>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-600">Doğrulama Başarılı!</CardTitle>
              <CardDescription className="text-base">
                Email adresiniz başarıyla doğrulandı.
              </CardDescription>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">Doğrulama Başarısız</CardTitle>
              <CardDescription className="text-base text-red-600">
                {error}
              </CardDescription>
            </div>
          )}
        </CardHeader>

        <CardContent className="text-center space-y-4">
          {success ? (
            <>
              {userEmail && (
                <p className="text-sm text-muted-foreground">
                  <strong>{userEmail}</strong> adresi doğrulandı.
                </p>
              )}
              <p className="text-sm font-medium text-blue-600">
                Portal sayfasına yönlendiriliyorsunuz...
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            </>
          ) : !loading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Olası sebepler:
              </p>
              <ul className="text-xs text-left space-y-1 list-disc pl-6">
                <li>Doğrulama linkinin süresi dolmuş olabilir (24 saat)</li>
                <li>Link zaten kullanılmış olabilir</li>
                <li>Link hatalı kopyalanmış olabilir</li>
              </ul>
              <p className="text-sm mt-4">
                Yeni bir doğrulama linki almak için lütfen kayıt işlemini tekrarlayın.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {success ? (
            // Auto-redirect is happening, no button needed
            null
          ) : !loading && (
            <>
              <Button 
                onClick={() => router.push('/signup')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Tekrar Kayıt Ol
              </Button>
              <Button 
                variant="ghost"
                onClick={() => router.push('/login')}
                className="w-full"
              >
                Giriş Sayfasına Dön
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
