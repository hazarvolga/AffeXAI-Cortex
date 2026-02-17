import { apiClient } from '../api-client';

export interface Product {
    id: string;
    name: string;
    description: string;
    active: boolean;
    metadata: Record<string, any>;
    prices: Price[];
}

export interface Price {
    id: string;
    amount: number;
    currency: string;
    interval: string;
}

export interface Subscription {
    id: string;
    status: 'active' | 'canceled' | 'past_due';
    price: Price;
    currentPeriodEnd: string;
}

export interface UsageLimit {
    allowed: boolean;
    remaining: number;
    limit: number;
}

export const commerceService = {
    // Get all active products
    getProducts: async (): Promise<Product[]> => {
        const response = await apiClient.get('/commerce/products');
        return response.data;
    },

    createProduct: async (data: Partial<Product>): Promise<Product> => {
        const response = await apiClient.post('/commerce/products', data);
        return response.data;
    },

    // Get current tenant's subscription
    getSubscription: async (): Promise<Subscription | null> => {
        const response = await apiClient.get('/commerce/subscription');
        return response.data;
    },

    // Check usage limits (e.g. for UI warnings)
    getLimits: async (): Promise<UsageLimit> => {
        const response = await apiClient.get('/commerce/limits');
        return response.data;
    },

    // Assign Plan (Debug/Admin only for now)
    assignPlan: async (priceId: string): Promise<Subscription> => {
        const response = await apiClient.post('/commerce/assign-plan', { priceId });
        return response.data;
    },
};
