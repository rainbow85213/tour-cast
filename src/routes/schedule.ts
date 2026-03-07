import { Router } from 'express';
import {
  createSchedule,
  listSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
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
router.post('/', createSchedule);

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
