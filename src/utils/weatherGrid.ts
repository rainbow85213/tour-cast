/**
 * 기상청 LCC DFS 좌표변환
 * WGS84 위경도(lat, lon) → 기상청 격자(X, Y)
 *
 * 참고: 기상청 공공데이터포털 단기예보 조회서비스 기술문서
 * https://www.data.go.kr/data/15084084/openapi.do
 */

const EARTH_RADIUS  = 6371.00877;  // 지구 반경 (km)
const GRID_SIZE     = 5.0;         // 격자 간격 (km)
const SLAT1         = 30.0;        // 표준위도 1 (deg)
const SLAT2         = 60.0;        // 표준위도 2 (deg)
const ORIGIN_LON    = 126.0;       // 기준점 경도 (deg)
const ORIGIN_LAT    = 38.0;        // 기준점 위도 (deg)
const ORIGIN_X      = 43;          // 기준점 격자 X
const ORIGIN_Y      = 136;         // 기준점 격자 Y

const DEGRAD = Math.PI / 180;

// 투영 상수 (런타임에 1회 계산)
const re    = EARTH_RADIUS / GRID_SIZE;
const slat1 = SLAT1 * DEGRAD;
const slat2 = SLAT2 * DEGRAD;
const olon  = ORIGIN_LON * DEGRAD;
const olat  = ORIGIN_LAT * DEGRAD;

const sn = Math.log(Math.cos(slat1) / Math.cos(slat2))
         / Math.log(Math.tan(Math.PI * 0.25 + slat2 * 0.5)
                  / Math.tan(Math.PI * 0.25 + slat1 * 0.5));

const sf = (Math.tan(Math.PI * 0.25 + slat1 * 0.5) ** sn
           * Math.cos(slat1))
           / sn;

const ro = re * sf / (Math.tan(Math.PI * 0.25 + olat * 0.5) ** sn);

export interface GridXY {
  x: number;
  y: number;
}

/**
 * WGS84 위경도를 기상청 격자 좌표로 변환합니다.
 * @param lat 위도 (WGS84)
 * @param lon 경도 (WGS84)
 * @returns 기상청 격자 { x, y }
 */
export function latLonToGrid(lat: number, lon: number): GridXY {
  const ra = re * sf / (Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5) ** sn);

  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI)  theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  const x = Math.floor(ra * Math.sin(theta) + ORIGIN_X + 0.5);
  const y = Math.floor(ro - ra * Math.cos(theta) + ORIGIN_Y + 0.5);

  return { x, y };
}
