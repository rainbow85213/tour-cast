import admin from 'firebase-admin';

let initialized = false;

try {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(json)),
    });
    initialized = true;
    console.log('[Firebase] Admin SDK 초기화 완료');
  } else if (!json) {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON 미설정 — 알림 기능 비활성');
  }
} catch (err) {
  console.error('[Firebase] 초기화 실패:', err);
}

export const isFirebaseInitialized = () => initialized;
export default admin;
