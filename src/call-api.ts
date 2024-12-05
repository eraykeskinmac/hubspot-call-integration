// call-api.ts
import axios from 'axios';

interface CallRecord {
  start_stamp: string;
  direction: string;
  caller_id_number: string;
  caller_id_name: string;
  destination_number: string;
  destination_name: string;
  duration: string;
  talk_duration: string;
  queue_wait_seconds: string;
  queue: string;
  result: string;
  missed: string;
  return_uuid: string;
  recording_present: string;
  sip_hangup_disposition: string;
  call_uuid: string;
  answer_stamp: string;
  end_stamp: string;
}

interface ApiResponse {
  cdrs: CallRecord[];
  pagination: {
    page: number;
    total_count: number;
    total_pages: number;
    limit: number;
  };
}

class CallApiClient {
  private readonly baseUrl = 'https://api.bulutsantralim.com';
  private readonly key: string;

  constructor(apiKey: string) {
    this.key = apiKey;
  }

  // UTC formatında tarih oluştur
  private formatDateToUTC(date: Date): string {
    return date.toISOString().slice(0, 19) + ' UTC';
  }

  async getCallRecords(params: {
    start_stamp_from?: Date;
    start_stamp_to?: Date;
    recording_present?: boolean;
    direction?: 'inbound' | 'outbound' | 'internal';
    caller_id_number?: string;
    missed?: boolean;
    destination_number?: string;
    queue?: string;
    limit?: number;
    page?: number;
  } = {}) {
    try {
      const queryParams: any = {
        key: this.key,
        limit: params.limit || 10
      };

      // Opsiyonel parametreleri ekle
      if (params.start_stamp_from) {
        queryParams.start_stamp_from = this.formatDateToUTC(params.start_stamp_from);
      }

      if (params.start_stamp_to) {
        queryParams.start_stamp_to = this.formatDateToUTC(params.start_stamp_to);
      }

      if (params.recording_present !== undefined) {
        queryParams.recording_present = params.recording_present.toString();
      }

      if (params.direction) {
        queryParams.direction = params.direction;
      }

      if (params.caller_id_number) {
        queryParams.caller_id_number = params.caller_id_number;
      }

      if (params.missed !== undefined) {
        queryParams.missed = params.missed.toString();
      }

      if (params.destination_number) {
        queryParams.destination_number = params.destination_number;
      }

      if (params.queue) {
        queryParams.queue = params.queue;
      }

      if (params.page) {
        queryParams.page = params.page;
      }

      const response = await axios.get(`${this.baseUrl}/cdrs`, {
        params: queryParams
      });

      return {
        success: true,
        data: response.data as ApiResponse
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data || 'API isteği sırasında bir hata oluştu'
        };
      }
      return {
        success: false,
        error: 'Beklenmeyen bir hata oluştu'
      };
    }
  }

  // Tekil çağrı detayı alma
  async getCallDetail(callUuid: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/cdrs/${callUuid}`, {
        params: {
          key: this.key
        }
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data || 'Çağrı detayı alınamadı'
        };
      }
      return {
        success: false,
        error: 'Beklenmeyen bir hata oluştu'
      };
    }
  }
}

export default CallApiClient;