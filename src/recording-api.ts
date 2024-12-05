import axios from 'axios';
import { config } from './config';


interface RecordingUrlResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export class RecordingApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;

  constructor(apiKey: string) {
    this.baseUrl = config.santralApiBaseUrl;
    this.apiKey = apiKey;
  }

  private async checkRateLimit(): Promise<boolean> {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    if (now - this.lastRequestTime >= oneMinute) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    if (this.requestCount >= config.maxRequestsPerMinute) {
      const waitTime = oneMinute - (now - this.lastRequestTime);
      console.log(`Rate limit aşıldı. ${Math.ceil(waitTime / 1000)} saniye beklemeniz gerekiyor.`);
      return false;
    }

    this.requestCount++;
    return true;
  }

  async getRecordingUrl(callUuid: string): Promise<RecordingUrlResponse> {
    try {
      if (!await this.checkRateLimit()) {
        return {
          success: false,
          error: 'Rate limit aşıldı. Lütfen bir dakika bekleyin.'
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/recording_url/`,
        null,
        {
          params: {
            key: this.apiKey,
            call_uuid: callUuid
          },
          headers: {
            'Accept': '*/*'
          }
        }
      );

      return {
        success: true,
        url: response.data
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data || 'Ses kaydı URL alınamadı'
        };
      }
      return {
        success: false,
        error: 'Beklenmeyen bir hata oluştu'
      };
    }
  }
}