import axios from 'axios';
import axiosRetry from 'axios-retry';
import dotenv from 'dotenv';

dotenv.config();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
if (!WEATHER_API_KEY) throw new Error('WEATHER_API_KEY is not defined in .env');

export const weatherApiClient = axios.create({
  baseURL: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0',
  params: {
    serviceKey: decodeURIComponent(WEATHER_API_KEY),
    dataType: 'JSON',
    numOfRows: 10,
    pageNo: 1,
  },
  timeout: 10_000,
});

axiosRetry(weatherApiClient, {
  retries: 2,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error),
});

/**
 * 기상청 초단기실황 base_date, base_time 계산
 * - 매시 30분 이후에 해당 시각 데이터 발표
 * - 30분 미만이면 이전 시각 데이터 사용
 */
export function getBaseDateTime(): { baseDate: string; baseTime: string } {
  const now = new Date();

  // KST 기준으로 계산
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const minutes = kst.getUTCMinutes();
  if (minutes < 30) {
    kst.setUTCHours(kst.getUTCHours() - 1);
  }

  const yyyy = kst.getUTCFullYear();
  const mm   = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(kst.getUTCDate()).padStart(2, '0');
  const hh   = String(kst.getUTCHours()).padStart(2, '0');

  return {
    baseDate: `${yyyy}${mm}${dd}`,
    baseTime: `${hh}00`,
  };
}
