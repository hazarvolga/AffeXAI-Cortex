import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum StorageProvider {
    LOCAL = 'local',
    AWS_S3 = 'aws_s3',
    CLOUDFLARE_R2 = 'cloudflare_r2',
    DIGITAL_OCEAN_SPACES = 'digital_ocean_spaces',
    MINIO = 'minio',
}

export class StorageSettingsDto {
    @IsEnum(StorageProvider)
    provider: StorageProvider;

    @IsOptional()
    awsS3?: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        bucket: string;
        endpoint?: string; // Optional for some setups
        publicUrl?: string; // Optional CDN URL
    };

    @IsOptional()
    cloudflareR2?: {
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        bucket: string;
        publicUrl: string;
    };

    @IsOptional()
    digitalOceanSpaces?: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        bucket: string;
        endpoint: string;
        cdnUrl?: string;
    };

    @IsOptional()
    minio?: {
        endPoint: string;
        port: number;
        useSSL: boolean;
        accessKey: string;
        secretKey: string;
        bucket: string;
        publicUrl?: string;
    };

    @IsBoolean()
    @IsOptional()
    useLocalFallback: boolean; // If true, falls back to local storage on error
}

export class StorageSettingsMaskedDto {
    provider: StorageProvider;

    awsS3?: {
        accessKeyId?: string; // Masked
        region: string;
        bucket: string;
        endpoint?: string;
        publicUrl?: string;
    };

    cloudflareR2?: {
        accountId: string;
        accessKeyId?: string; // Masked
        bucket: string;
        publicUrl: string;
    };

    digitalOceanSpaces?: {
        accessKeyId?: string; // Masked
        region: string;
        bucket: string;
        endpoint: string;
        cdnUrl?: string;
    };

    minio?: {
        endPoint: string;
        port: number;
        useSSL: boolean;
        accessKey?: string; // Masked
        bucket: string;
        publicUrl?: string;
    };

    useLocalFallback: boolean;

    static mask(settings: StorageSettingsDto): StorageSettingsMaskedDto {
        const masked: StorageSettingsMaskedDto = {
            provider: settings.provider,
            useLocalFallback: settings.useLocalFallback,
        };

        if (settings.awsS3) {
            masked.awsS3 = {
                ...settings.awsS3,
                accessKeyId: settings.awsS3.accessKeyId ? '***' + settings.awsS3.accessKeyId.slice(-4) : undefined,
                secretAccessKey: undefined, // Fully hide secret
            } as any;
        }

        if (settings.cloudflareR2) {
            masked.cloudflareR2 = {
                ...settings.cloudflareR2,
                accessKeyId: settings.cloudflareR2.accessKeyId ? '***' + settings.cloudflareR2.accessKeyId.slice(-4) : undefined,
                secretAccessKey: undefined,
            } as any;
        }

        if (settings.digitalOceanSpaces) {
            masked.digitalOceanSpaces = {
                ...settings.digitalOceanSpaces,
                accessKeyId: settings.digitalOceanSpaces.accessKeyId ? '***' + settings.digitalOceanSpaces.accessKeyId.slice(-4) : undefined,
                secretAccessKey: undefined,
            } as any;
        }

        if (settings.minio) {
            masked.minio = {
                ...settings.minio,
                accessKey: settings.minio.accessKey ? '***' + settings.minio.accessKey.slice(-4) : undefined,
                secretKey: undefined,
            } as any;
        }

        return masked;
    }
}
