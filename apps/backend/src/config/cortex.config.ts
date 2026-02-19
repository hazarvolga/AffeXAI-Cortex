import { registerAs } from '@nestjs/config';

export default registerAs('cortex', () => ({
    url: process.env.CORTEX_URL || 'http://localhost:8000',
    apiKey: process.env.CORTEX_API_KEY || '',
}));
