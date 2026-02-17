import { httpClient } from '@/lib/api/http-client';

export interface CrmCustomer {
  id: string;
  companyName: string;
  email: string;
  customerNumber?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  createdAt: string;
  updatedAt: string;
  // Neural Metrics
  resonanceScore?: number;
  sentimentScore?: number;
  frictionRank?: number;
  lastInteractionAt?: string;
}

export interface CreateCrmCustomerDto {
  companyName: string;
  email: string;
  customerNumber?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface CrmStats {
  total: number;
  active: number;
  inactive: number;
}

class CrmService {
  private baseUrl = '/crm';

  async getAll(): Promise<CrmCustomer[]> {
    return httpClient.get<CrmCustomer[]>(this.baseUrl);
  }

  async getStats(): Promise<CrmStats> {
    return httpClient.get<CrmStats>(`${this.baseUrl}/stats`);
  }

  async getOne(id: string): Promise<CrmCustomer> {
    return httpClient.get<CrmCustomer>(`${this.baseUrl}/${id}`);
  }

  async create(data: CreateCrmCustomerDto): Promise<CrmCustomer> {
    return httpClient.post<CrmCustomer>(this.baseUrl, data);
  }

  async bulkImport(customers: CreateCrmCustomerDto[]): Promise<BulkImportResult> {
    return httpClient.post<BulkImportResult>(`${this.baseUrl}/import`, { customers });
  }

  async update(id: string, data: Partial<CreateCrmCustomerDto>): Promise<CrmCustomer> {
    return httpClient.put<CrmCustomer>(`${this.baseUrl}/${id}`, data);
  }

  async remove(id: string): Promise<void> {
    await httpClient.delete(`${this.baseUrl}/${id}`);
  }

  async hardDelete(id: string): Promise<void> {
    await httpClient.delete(`${this.baseUrl}/${id}/hard`);
  }
}

export const crmService = new CrmService();
