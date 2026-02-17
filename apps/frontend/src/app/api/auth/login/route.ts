import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get API URL from environment - server-side route can use internal URL
const getApiUrl = () => {
  // For server-side API routes, use BACKEND_URL (internal) or NEXT_PUBLIC_API_URL
  let apiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:9006';

  // Force internal IPv4 addressing for reliability
  apiUrl = apiUrl.replace('localhost', '127.0.0.1');
  if (apiUrl.includes('::1')) {
    apiUrl = apiUrl.replace('::1', '127.0.0.1');
  }

  // Ensure URL ends with /api
  return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const apiUrl = getApiUrl();
    console.log('🔐 Login attempt for:', email);
    console.log('🔐 Using API URL:', apiUrl);

    // Call backend API
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('🔐 Backend response status:', response.status, response.statusText);

    const responseData = await response.json();
    console.log('🔐 Backend response:', JSON.stringify(responseData, null, 2));

    // Handle error responses
    if (!response.ok) {
      const errorMessage =
        responseData.error?.message ||
        responseData.message ||
        responseData.error ||
        'Login failed';

      console.error('❌ Login failed:', errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Handle success: false responses (even with 200 status)
    if (responseData.success === false) {
      const errorMessage =
        responseData.error?.message ||
        responseData.message ||
        responseData.error ||
        'Login failed';

      console.error('❌ Login failed (success: false):', errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    // Backend wraps response in { success, data, meta } format
    const data = responseData.data || responseData;

    if (!data.access_token) {
      console.error('❌ No access_token in backend response');
      console.error('Response keys:', Object.keys(data));
      console.error('Full response structure:', Object.keys(responseData));
      return NextResponse.json(
        { error: 'No access token received from server' },
        { status: 500 }
      );
    }

    console.log('✅ Login successful, setting cookies');

    // Set cookies server-side
    const cookieStore = await cookies();

    cookieStore.set('auth_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    cookieStore.set('aluplan_access_token', data.access_token, {
      httpOnly: false, // Client-side accessible for API calls
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    if (data.refresh_token) {
      cookieStore.set('aluplan_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    console.log('✅ Cookies set, returning login data');
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Login API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
