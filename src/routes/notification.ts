import { Router } from 'express';
import { sendNotification } from '../controllers/notificationController';

const router = Router();

/**
 * @openapi
 * /api/notification/send:
 *   post:
 *     tags: [Notification]
 *     summary: FCM 푸시 알림 즉시 전송
 *     description: |
 *       Firebase Cloud Messaging(FCM)을 통해 특정 디바이스에 푸시 알림을 전송합니다.
 *       FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수가 설정되어 있어야 합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceToken, title, body]
 *             properties:
 *               deviceToken:
 *                 type: string
 *                 description: FCM 디바이스 토큰
 *               title:
 *                 type: string
 *                 description: 알림 제목
 *                 example: 30분 후 일정
 *               body:
 *                 type: string
 *                 description: 알림 내용
 *                 example: 경복궁 방문
 *               data:
 *                 type: object
 *                 description: 추가 데이터 (key-value, 문자열만)
 *                 additionalProperties:
 *                   type: string
 *     responses:
 *       200:
 *         description: 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messageId:
 *                   type: string
 *                   example: projects/my-project/messages/abc123
 *       400:
 *         description: 유효성 검증 실패 또는 유효하지 않은 토큰
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 *       503:
 *         description: Firebase 미초기화
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post('/send', sendNotification);

export default router;
