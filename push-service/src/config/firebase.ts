import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

let isInitialized = false;

export const initializeFirebase = (): void => {
  if (isInitialized) {
    return;
  }

  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
      throw new Error('Missing Firebase configuration. Please check your environment variables.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });

    isInitialized = true;
    logger.info('Firebase Admin SDK initialized');
  } catch (error) {
    logger.error('Error initializing Firebase:', error);
    throw error;
  }
};

export const getMessaging = (): admin.messaging.Messaging => {
  if (!isInitialized) {
    throw new Error('Firebase has not been initialized. Call initializeFirebase() first.');
  }
  return admin.messaging();
};
