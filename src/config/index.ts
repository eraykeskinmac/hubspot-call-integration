import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN!,
  santralApiKey: process.env.SANTRAL_API_KEY!,
  santralApiBaseUrl: process.env.SANTRAL_API_BASE_URL || 'https://api.bulutsantralim.com',
  hubspotApiBaseUrl: process.env.HUBSPOT_API_BASE_URL || 'https://api.hubapi.com',
  maxRequestsPerMinute: Number(process.env.MAX_REQUESTS_PER_MINUTE) || 5
};