import { httpClient } from './http-client';
import { 
  bulkOperationErrorHandler, 
  BulkOperationError, 
  BulkOperationErrorType,
  PartialFailureResult 
} from '../errors/bulk-operation-errors';

// ============================================================================
// Type Definitions (normally from @affexai/shared-types)
// ============================================================================

export enum ExportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface ExportFilters {
  groups?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string[];
  customFields?: Record<string, any>;
}

export interface ExportOptions {
  format?: 'csv' | 'xlsx' | 'json';
  fields?: string[];
  includeHeaders?: boolean;
  compression?: boolean;
  notifyOnCompletion?: boolean;
}

export interface ExportJob {
  id: string;
  userId: string;
  status: ExportJobStatus;
  totalRecords: number;
  processedRecords: number;
  filters: ExportFilters;
  options: ExportOptions;
  downloadUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface CreateExportJobRequest {
  filters: ExportFilters;
  options: ExportOptions;
}

export interface ExportStatusResponse extends ExportJob {}

export interface ExportJobsResponse {
  jobs: ExportJob[];
  total: number;
  page: number;
  limit: number;
}

class BulkExportService {
  private baseUrl = '/api/email-marketing/export';

  /**
   * Create export job with filters and options with error handling
   */
  async createExportJob(request: CreateExportJobRequest): Promise<ExportJob> {
    return bulkOperationErrorHandler.executeWithRetry(
      () => {
        // Validate request before sending
        this.validateExportRequest(request);
        return httpClient.post(`${this.baseUrl}`, request);
      },
      { operation: 'create_export_job', filters: request.filters }
    );
  }

  /**
   * Validate export request to catch issues early
   */
  private validateExportRequest(request: CreateExportJobRequest): void {
    if (!request.filters && !request.options) {
      const error = bulkOperationErrorHandler.classifyError(
        new Error('Export request must include filters or options'),
        { request }
      );
      error.type = BulkOperationErrorType.VALIDATION_PARTIAL_FAILURE;
      throw error;
    }

    // Validate field selection
    if (request.options?.fields && request.options.fields.length === 0) {
      const error = bulkOperationErrorHandler.classifyError(
        new Error('At least one field must be selected for export'),
        { request }
      );
      error.type = BulkOperationErrorType.VALIDATION_PARTIAL_FAILURE;
      throw error;
    }

    // Validate date range if provided
    if (request.filters?.dateRange) {
      const { start, end } = request.filters.dateRange;
      if (start && end && start > end) {
        const error = bulkOperationErrorHandler.classifyError(
          new Error('Start date must be before end date'),
          { request }
        );
        error.type = BulkOperationErrorType.VALIDATION_PARTIAL_FAILURE;
        throw error;
      }
    }
  }

  /**
   * Get export job status and progress with retry logic
   */
  async getExportStatus(jobId: string): Promise<ExportStatusResponse> {
    return bulkOperationErrorHandler.executeWithRetry(
      () => httpClient.get(`${this.baseUrl}/${jobId}/status`),
      { operation: 'get_export_status', jobId }
    );
  }

  /**
   * Download export file with comprehensive error handling
   */
  async downloadExport(jobId: string): Promise<Blob> {
    return bulkOperationErrorHandler.executeWithRetry(async () => {
      const response = await fetch(`${this.baseUrl}/${jobId}/download`, {
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to download export file' }));
        
        // Handle specific download errors
        if (response.status === 404) {
          throw new Error('Export file not found or has expired');
        }
        
        if (response.status === 410) {
          throw new Error('Export file has expired and is no longer available');
        }

        throw new Error(error.message || 'Failed to download export file');
      }

      // Validate that we received a valid blob
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      return blob;
    }, { operation: 'download_export', jobId });
  }

  /**
   * Cancel export job with error handling
   */
  async cancelExport(jobId: string): Promise<void> {
    return bulkOperationErrorHandler.executeWithRetry(
      () => httpClient.delete(`${this.baseUrl}/${jobId}`),
      { operation: 'cancel_export', jobId }
    );
  }

  /**
   * Get all export jobs for current user with error handling
   */
  async getExportJobs(
    page: number = 1, 
    limit: number = 20
  ): Promise<ExportJobsResponse> {
    return bulkOperationErrorHandler.executeWithRetry(
      () => httpClient.get(`${this.baseUrl}/jobs`, {
        params: { page, limit }
      }),
      { operation: 'get_export_jobs', page, limit }
    );
  }

  /**
   * Get export preview with error handling
   */
  async getExportPreview(filters: ExportFilters): Promise<{
    totalRecords: number;
    sampleRecords: any[];
    estimatedFileSize: string;
  }> {
    return bulkOperationErrorHandler.executeWithRetry(
      () => httpClient.post(`${this.baseUrl}/preview`, { filters }),
      { operation: 'get_export_preview', filters }
    );
  }

  /**
   * Get available export fields with error handling
   */
  async getAvailableFields(): Promise<{
    key: string;
    label: string;
    type: string;
    required: boolean;
  }[]> {
    return bulkOperationErrorHandler.executeWithRetry(
      () => httpClient.get(`${this.baseUrl}/fields`),
      { operation: 'get_available_fields' }
    );
  }

  /**
   * Process export with partial failure handling
   */
  async processExportWithPartialFailureHandling(
    filters: ExportFilters,
    options: ExportOptions
  ): Promise<PartialFailureResult<any>> {
    try {
      // First get preview to understand the scope
      const preview = await this.getExportPreview(filters);
      
      // If too many records, suggest chunking
      if (preview.totalRecords > 100000) {
        console.warn(`[BulkExportService] Large export detected: ${preview.totalRecords} records`);
      }

      // Create the export job
      const job = await this.createExportJob({ filters, options });

      // Monitor the job and handle partial failures
      return await bulkOperationErrorHandler.handlePartialFailure(
        [{ filters, options, jobId: job.id }],
        async (item, index) => {
          // Poll for completion
          let status = await this.getExportStatus(item.jobId);
          
          while (status.status === ExportJobStatus.PROCESSING || status.status === ExportJobStatus.PENDING) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            status = await this.getExportStatus(item.jobId);
          }

          if (status.status === ExportJobStatus.FAILED) {
            throw new Error(status.error || 'Export job failed');
          }

          return status;
        },
        { operation: 'process_export_with_partial_failure', filters }
      );
    } catch (error) {
      const bulkError = bulkOperationErrorHandler.classifyError(error, {
        operation: 'process_export_with_partial_failure',
        filters
      });
      throw bulkError;
    }
  }

  /**
   * Get user-friendly error message for export operations
   */
  getUserFriendlyErrorMessage(error: any): string {
    if (error && typeof error === 'object' && error.type) {
      return bulkOperationErrorHandler.getUserFriendlyMessage(error);
    }

    const bulkError = bulkOperationErrorHandler.classifyError(error);
    return bulkOperationErrorHandler.getUserFriendlyMessage(bulkError);
  }
}

export const bulkExportService = new BulkExportService();
export default bulkExportService;