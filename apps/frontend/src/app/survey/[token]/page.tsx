'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [survey, setSurvey] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    fetchSurvey();
  }, [token]);

  const fetchSurvey = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/csat/survey/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Anket bulunamadı veya geçersiz link');
        } else {
          const data = await response.json();
          setError(data.message || 'Anket yüklenirken hata oluştu');
        }
        return;
      }

      const data = await response.json();

      if (data.surveyCompletedAt) {
        setSubmitted(true);
      } else {
        setSurvey(data);
      }
    } catch (error) {
      console.error('Failed to fetch survey:', error);
      setError('Anket yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Lütfen bir değerlendirme seçin');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/tickets/csat/survey/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Anket gönderilemedi');
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit survey:', error);
      setError(error.message || 'Anket gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Anket yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center">Anket Bulunamadı</CardTitle>
            <CardDescription className="text-center">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Lütfen e-postanızdaki linkin doğru olduğundan emin olun.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-center">Teşekkür Ederiz!</CardTitle>
            <CardDescription className="text-center">
              Değerlendirmeniz başarıyla kaydedildi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Geri bildiriminiz hizmet kalitemizi artırmamıza yardımcı olacak.
            </p>
            <p className="text-sm text-center">
              Bu sekmeyi kapatabilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-center text-2xl">💬 Memnuniyet Anketi</CardTitle>
          <CardDescription className="text-center">
            Hizmet kalitemizi geliştirmek için değerlendirmenizi paylaşın
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Ticket Info */}
          {survey && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Destek Talebi</p>
              <p className="font-medium">{survey.ticket?.subject || 'Ticket'}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Ticket ID: {survey.ticketId}
              </p>
            </div>
          )}

          {/* Rating */}
          <div className="space-y-3">
            <label className="block text-lg font-medium">
              Aldığınız hizmetten ne kadar memnunsunuz?
            </label>
            <div className="flex items-center justify-center gap-2 py-4">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded-full p-1"
                  type="button"
                >
                  <Star
                    className={`h-12 w-12 ${
                      value <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground px-2">
              <span>Çok Kötü</span>
              <span>Mükemmel</span>
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-3">
            <label htmlFor="feedback" className="block text-lg font-medium">
              Ek görüşleriniz (opsiyonel)
            </label>
            <Textarea
              id="feedback"
              placeholder="Deneyiminizi bizimle paylaşın..."
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Geri bildiriminiz anonim olarak kaydedilecektir
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="w-full h-12 text-lg"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              'Anketi Gönder'
            )}
          </Button>

          {/* Privacy Note */}
          <p className="text-xs text-center text-muted-foreground">
            🔒 Gizlilik: Değerlendirmeniz sadece hizmet kalitemizi artırmak için kullanılacaktır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
