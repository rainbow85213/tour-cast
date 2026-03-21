import { Router } from 'express';
import {
  createTravelPlan,
  createSchedule,
  listSchedules,
  listTravelPlans,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  getRoute,
  getMapItems,
  getHeatmap,
  updateItemStatus,
} from '../controllers/scheduleController';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ScheduleLocation:
 *       type: object
 *       required: [name, address, lat, lng, category]
 *       properties:
 *         name:     { type: string, example: 경복궁 }
 *         address:  { type: string, example: 서울특별시 종로구 사직로 161 }
 *         lat:      { type: number, example: 37.5796 }
 *         lng:      { type: number, example: 126.9770 }
 *         category: { type: string, example: 관광지 }
 *     Schedule:
 *       type: object
 *       properties:
 *         id:            { type: string, example: clxyz1234 }
 *         userId:        { type: string, example: user_abc }
 *         title:         { type: string, example: 경복궁 방문 }
 *         description:   { type: string, nullable: true, example: 오전 관람 예정 }
 *         scheduledAt:   { type: string, format: date-time }
 *         location:
 *           $ref: '#/components/schemas/ScheduleLocation'
 *         completed:     { type: boolean, example: false }
 *         publicDataRef: { type: string, nullable: true, example: '127480' }
 *         createdAt:     { type: string, format: date-time }
 *         updatedAt:     { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/schedule:
 *   post:
 *     tags: [Schedule]
 *     summary: 일정 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, title, scheduledAt, location]
 *             properties:
 *               userId:        { type: string }
 *               title:         { type: string, maxLength: 200 }
 *               description:   { type: string, maxLength: 1000 }
 *               scheduledAt:   { type: string, format: date-time }
 *               location:
 *                 $ref: '#/components/schemas/ScheduleLocation'
 *               publicDataRef: { type: string }
 *     responses:
 *       201:
 *         description: 생성된 일정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       400:
 *         description: 유효성 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 */
router.post('/', createTravelPlan);

/**
 * @openapi
 * /api/schedule/single:
 *   post:
 *     tags: [Schedule]
 *     summary: 단건 일정 생성 (알림용, 레거시)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, title, scheduledAt, location]
 *             properties:
 *               userId:        { type: string }
 *               title:         { type: string, maxLength: 200 }
 *               description:   { type: string, maxLength: 1000 }
 *               scheduledAt:   { type: string, format: date-time }
 *               location:
 *                 $ref: '#/components/schemas/ScheduleLocation'
 *               publicDataRef: { type: string }
 *     responses:
 *       201:
 *         description: 생성된 일정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       400:
 *         description: 유효성 검증 실패
 */
router.post('/single', createSchedule);

/**
 * @openapi
 * /api/schedule:
 *   get:
 *     tags: [Schedule]
 *     summary: 일정 목록 조회
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: completed
 *         in: query
 *         schema: { type: boolean }
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: 일정 목록
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Schedule'
 *       400:
 *         description: userId 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 */
router.get('/', listSchedules);

/**
 * @openapi
 * /api/schedule/route:
 *   get:
 *     tags: [Schedule]
 *     summary: 특정 날짜의 경로 조회
 *     description: |
 *       userId와 date(YYYY-MM-DD)로 해당 날짜의 일정을 scheduledAt 기준 오름차순 정렬 후,
 *       각 좌표 배열·총 거리(Haversine)·예상 이동 시간(50km/h 가정)을 반환합니다.
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: date
 *         in: query
 *         required: true
 *         schema: { type: string, example: '2024-03-02' }
 *         description: YYYY-MM-DD 형식
 *     responses:
 *       200:
 *         description: 경로 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 coordinates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       lat: { type: number, example: 37.5796 }
 *                       lng: { type: number, example: 126.9770 }
 *                 totalDistanceKm:
 *                   type: number
 *                   example: 12.3
 *                 estimatedTimeMin:
 *                   type: integer
 *                   example: 15
 *                 stops:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       lat:         { type: number }
 *                       lng:         { type: number }
 *                       title:       { type: string }
 *                       scheduledAt: { type: string, format: date-time }
 *       400:
 *         description: 파라미터 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 */
/**
 * @openapi
 * /api/schedule/map:
 *   get:
 *     tags: [Schedule]
 *     summary: 지도용 일정 아이템 조회
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: date
 *         in: query
 *         required: true
 *         schema: { type: string, example: '2024-03-02' }
 *         description: YYYY-MM-DD 형식
 *       - name: filters
 *         in: query
 *         schema: { type: string, example: 'restaurant,attraction' }
 *         description: 카테고리 필터 (쉼표 구분)
 *     responses:
 *       200:
 *         description: 일정 아이템 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:          { type: string }
 *                       title:       { type: string }
 *                       latitude:    { type: number }
 *                       longitude:   { type: number }
 *                       status:      { type: string, enum: [completed, in_progress, pending, cancelled] }
 *                       time:        { type: string, example: '10:00' }
 *                       scheduledAt: { type: string, format: date-time, nullable: true }
 *                       category:    { type: string, enum: [restaurant, attraction, accommodation, transport, other] }
 *                       description: { type: string, nullable: true }
 *                       order:       { type: integer }
 */
router.get('/map', getMapItems);

/**
 * @openapi
 * /api/schedule/heatmap:
 *   get:
 *     tags: [Schedule]
 *     summary: 방문 히트맵 조회
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 히트맵 좌표 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   lat:    { type: number }
 *                   lng:    { type: number }
 *                   weight: { type: integer, description: 누적 방문 횟수 }
 */
router.get('/heatmap', getHeatmap);

/**
 * @openapi
 * /api/schedule/list:
 *   get:
 *     tags: [Schedule]
 *     summary: 저장된 여행 플랜 목록 조회
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: 여행 플랜 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:        { type: string }
 *                       date:      { type: string, example: '2024-03-02' }
 *                       title:     { type: string }
 *                       itemCount: { type: integer }
 *                       createdAt: { type: string, format: date-time }
 *                 total:   { type: integer }
 *                 hasMore: { type: boolean }
 */
router.get('/list', listTravelPlans);

/**
 * @openapi
 * /api/schedule/item/{itemId}:
 *   patch:
 *     tags: [Schedule]
 *     summary: 일정 아이템 상태 업데이트
 *     parameters:
 *       - name: itemId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [completed, in_progress, pending, cancelled]
 *     responses:
 *       200:
 *         description: 업데이트된 아이템
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:     { type: string }
 *                 status: { type: string }
 *       404:
 *         description: 아이템 없음
 */
router.patch('/item/:itemId', updateItemStatus);

router.get('/route', getRoute);

/**
 * @openapi
 * /api/schedule/{id}:
 *   get:
 *     tags: [Schedule]
 *     summary: 일정 단건 조회
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 일정 상세
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       404:
 *         description: 일정 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error404'
 */
router.get('/:id', getSchedule);

/**
 * @openapi
 * /api/schedule/{id}:
 *   put:
 *     tags: [Schedule]
 *     summary: 일정 수정
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               title:         { type: string, maxLength: 200 }
 *               description:   { type: string, maxLength: 1000, nullable: true }
 *               scheduledAt:   { type: string, format: date-time }
 *               location:
 *                 $ref: '#/components/schemas/ScheduleLocation'
 *               completed:     { type: boolean }
 *               publicDataRef: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: 수정된 일정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       400:
 *         description: 유효성 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 *       404:
 *         description: 일정 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error404'
 */
router.put('/:id', updateSchedule);

/**
 * @openapi
 * /api/schedule/{id}:
 *   delete:
 *     tags: [Schedule]
 *     summary: 일정 삭제
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: 삭제 완료
 *       404:
 *         description: 일정 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error404'
 */
router.delete('/:id', deleteSchedule);

export default router;
