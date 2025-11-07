import { getServerFirebase } from './config';
import type { DocumentData } from 'firebase-admin/firestore';
import { type StartlistResult, type StageResult } from '../scraper/types';
import { cleanFirebaseData } from './utils';

export interface ScraperDataKey {
  race: string;
  year: number;
  type: 'startlist' | 'stage';
  stage?: number;
}

export function generateDocumentId(key: ScraperDataKey): string {
  if (key.type === 'startlist') {
    return `${key.race}-${key.year}-startlist`;
  } else {
    return `${key.race}-${key.year}-stage-${key.stage}`;
  }
}

export async function saveScraperData(
  key: ScraperDataKey,
  data: StartlistResult | StageResult
): Promise<void> {

  const db = getServerFirebase();
  const docId = generateDocumentId(key);
  
  // Remove undefined values from key to avoid Firebase errors
  const cleanKey = {
    race: key.race,
    year: key.year,
    type: key.type,
    ...(key.stage !== undefined && { stage: key.stage })
  };
  
  const docData = {
    ...data,
    updatedAt: new Date().toISOString(),
    key: cleanKey,
  };

  // Clean the data to remove undefined values before saving to Firebase
  const cleanedData = cleanFirebaseData(docData) as DocumentData;

  await db.collection('scraper-data').doc(docId).set(cleanedData);
}

export async function getScraperData(
  key: ScraperDataKey
): Promise<(StartlistResult | StageResult) | null> {
  const db = getServerFirebase();
  const docId = generateDocumentId(key);
  
  const doc = await db.collection('scraper-data').doc(docId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  if (!data) {
    return null;
  }
  
  // Remove Firebase metadata before returning
  const { updatedAt, key: docKey, ...scraperData } = data;
  void updatedAt; // Explicitly mark as intentionally unused
  void docKey; // Explicitly mark as intentionally unused
  return scraperData as StartlistResult | StageResult;
}

export async function listScraperData(): Promise<Array<{ id: string; key: ScraperDataKey; updatedAt: string }>> {
  const db = getServerFirebase();
  const snapshot = await db.collection('scraper-data').get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    key: doc.data().key as ScraperDataKey,
    updatedAt: doc.data().updatedAt as string,
  }));
}