import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get API URL from environment - server-side route can use internal URL
const getApiUrl = () => {
    // Use 127.0.0.1 to avoid Node 18+ IPv6 issues
    const apiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:9006';
    return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
};

export async function GET(request: NextRequest) {
    try {
        const apiUrl = getApiUrl();
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value || '';

        const response = await fetch(`${apiUrl}/knowledge-base/categories`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch categories' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data.data || []);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
