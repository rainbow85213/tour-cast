import { Request, Response } from 'express';
import Joi from 'joi';
import admin, { isFirebaseInitialized } from '../services/firebase';

const sendSchema = Joi.object({
  deviceToken: Joi.string().required(),
  title:       Joi.string().required(),
  body:        Joi.string().required(),
  data:        Joi.object().pattern(Joi.string(), Joi.string()),
});

/**
 * POST /api/notification/send
 * deviceToken으로 FCM 푸시 알림을 즉시 전송합니다.
 */
export async function sendNotification(req: Request, res: Response): Promise<void> {
  if (!isFirebaseInitialized()) {
    res.status(503).json({ message: 'Firebase 미초기화 — FIREBASE_SERVICE_ACCOUNT_JSON을 설정하세요.' });
    return;
  }

  const { error, value } = sendSchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(400).json({ message: error.details.map((d) => d.message).join(', ') });
    return;
  }

  try {
    const messageId = await admin.messaging().send({
      token: value.deviceToken,
      notification: {
        title: value.title,
        body:  value.body,
      },
      ...(value.data && { data: value.data }),
    });

    res.json({ success: true, messageId });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;

    // 유효하지 않은 토큰
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-argument') {
      res.status(400).json({ message: '유효하지 않은 deviceToken입니다.', code });
      return;
    }

    console.error('[Notification] 전송 실패:', err);
    res.status(500).json({ message: '알림 전송에 실패했습니다.' });
  }
}
