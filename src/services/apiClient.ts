import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import dotenv from 'dotenv';

dotenv.config();

const TOUR_API_KEY = process.env.TOUR_API_KEY;
const CAMP_API_KEY = process.env.CAMP_API_KEY;

if (!TOUR_API_KEY) throw new Error('TOUR_API_KEY is not defined in .env');
if (!CAMP_API_KEY) throw new Error('CAMP_API_KEY is not defined in .env');

const BASE_PARAMS = {
  MobileOS: 'ETC',
  MobileApp: 'AppTest',
  _type: 'json',
};

function createClient(baseURL: string, serviceKey: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    params: { ...BASE_PARAMS, serviceKey },
    timeout: 10_000,
  });

  axiosRetry(client, {
    retries: 3,
    retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s
    retryCondition: (error: AxiosError) =>
      axiosRetry.isNetworkError(error) ||
      axiosRetry.isRetryableError(error) ||
      error.response?.status === 429,
    onRetry: (retryCount, error) => {
      console.warn(`[API Retry] attempt ${retryCount} — ${error.message}`);
    },
  });

  return client;
}

// 한국관광공사 TourAPI (관광지, 숙박, 축제)
export const tourApiClient = createClient(
  'https://apis.data.go.kr/B551011/KorService2',
  decodeURIComponent(TOUR_API_KEY),
);

// 한국관광공사 GoCamping API (캠핑장)
export const campApiClient = createClient(
  'https://apis.data.go.kr/B551011/GoCamping',
  decodeURIComponent(CAMP_API_KEY),
);
