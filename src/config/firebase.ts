import admin from 'firebase-admin';
import serviceAccount from './loayalityapp-firebase-adminsdk-fbsvc-b06733294d.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const firebaseAdmin = admin;
