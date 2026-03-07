import cron from 'node-cron';
import prisma from '../prisma';
import admin, { isFirebaseInitialized } from './firebase';

// 알림을 보낼 시간 구간 (scheduledAt 기준 N분 전)
const INTERVALS = [
  { label: '30min', minutes: 30, text: '30분' },
  { label: '1hour', minutes: 60, text: '1시간' },
] as const;

// 매분 실행 시 검사 윈도우: 대상 시각 ±30초
const WINDOW_SEC = 30;

async function checkAndSendNotifications(): Promise<void> {
  if (!isFirebaseInitialized()) return;

  const now = new Date();

  for (const interval of INTERVALS) {
    const targetTime  = new Date(now.getTime() + interval.minutes * 60 * 1000);
    const windowStart = new Date(targetTime.getTime() - WINDOW_SEC * 1000);
    const windowEnd   = new Date(targetTime.getTime() + WINDOW_SEC * 1000);

    // 아직 해당 구간 알림을 보내지 않은, 완료되지 않은, 토큰이 있는 일정 조회
    const schedules = await prisma.schedule.findMany({
      where: {
        scheduledAt:  { gte: windowStart, lte: windowEnd },
        completed:    false,
        deviceToken:  { not: null },
        NOT: { notificationSent: { has: interval.label } },
      },
    });

    for (const schedule of schedules) {
      if (!schedule.deviceToken) continue;

      try {
        await admin.messaging().send({
          token: schedule.deviceToken,
          notification: {
            title: `📅 ${interval.text} 후 일정이 있습니다`,
            body:  schedule.title,
          },
          data: {
            scheduleId:  schedule.id,
            scheduledAt: schedule.scheduledAt.toISOString(),
            type:        'schedule_reminder',
          },
        });

        // 전송 완료 표시
        await prisma.schedule.update({
          where: { id: schedule.id },
          data:  { notificationSent: { push: interval.label } },
        });

        console.log(`[Scheduler] 알림 전송 완료 — "${schedule.title}" (${interval.label} 전)`);
      } catch (err) {
        console.error(`[Scheduler] 알림 전송 실패 — scheduleId: ${schedule.id}`, err);
      }
    }
  }
}

/**
 * 매분 실행되는 알림 스케줄러를 시작합니다.
 * Firebase가 초기화되지 않은 경우 자동으로 비활성화됩니다.
 *
 * cron 표현식: "* * * * *"
 *  ┌──── 분 (0-59)
 *  │ ┌── 시 (0-23)
 *  │ │ ┌─ 일 (1-31)
 *  │ │ │ ┌ 월 (1-12)
 *  │ │ │ │ ┌ 요일 (0-7, 0과 7은 일요일)
 *  * * * * *
 */
export function startNotificationScheduler(): void {
  if (!isFirebaseInitialized()) {
    console.warn('[Scheduler] Firebase 미초기화 — 알림 스케줄러 비활성');
    return;
  }

  cron.schedule('* * * * *', async () => {
    try {
      await checkAndSendNotifications();
    } catch (err) {
      console.error('[Scheduler] 오류:', err);
    }
  });

  console.log('[Scheduler] 알림 스케줄러 시작 — 매분 실행 (30분·1시간 전 알림)');
}
