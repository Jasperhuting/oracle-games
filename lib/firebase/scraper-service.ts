import { getServerFirebase } from './server';
import type { DocumentData } from 'firebase-admin/firestore';
import { type StartlistResult, type StageResult } from '../scraper/types';
import { cleanFirebaseData } from './utils';

export interface ScraperDataKey {
  race: string;
  year: number;
  type: 'startlist' | 'stage' | 'result' | 'tour-gc';
  stage?: number;
}

export function generateDocumentId(key: ScraperDataKey): string {
  if (key.type === 'startlist') {
    return `${key.race}-${key.year}-startlist`;
  } else if (key.type === 'result') {
    return `${key.race}-${key.year}-result`;
  } else if (key.type === 'tour-gc') {
    return `${key.race}-${key.year}-tour-gc`;
  } else if (key.type === 'stage' && key.stage === 0) {
    return `${key.race}-${key.year}-prologue`;
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
  
  // Parse stringified arrays if they exist
  const parsedData = { ...data };
  if (parsedData.stageResults && typeof parsedData.stageResults === 'string') {
    try {
      parsedData.stageResults = JSON.parse(parsedData.stageResults);
    } catch (e) {
      console.error('Error parsing stageResults in getScraperData:', e);
      parsedData.stageResults = [];
    }
  }
  if (parsedData.generalClassification && typeof parsedData.generalClassification === 'string') {
    try {
      parsedData.generalClassification = JSON.parse(parsedData.generalClassification);
    } catch (e) {
      console.error('Error parsing generalClassification in getScraperData:', e);
      parsedData.generalClassification = [];
    }
  }
  if (parsedData.pointsClassification && typeof parsedData.pointsClassification === 'string') {
    try {
      parsedData.pointsClassification = JSON.parse(parsedData.pointsClassification);
    } catch (e) {
      console.error('Error parsing pointsClassification in getScraperData:', e);
      parsedData.pointsClassification = [];
    }
  }
  if (parsedData.mountainsClassification && typeof parsedData.mountainsClassification === 'string') {
    try {
      parsedData.mountainsClassification = JSON.parse(parsedData.mountainsClassification);
    } catch (e) {
      console.error('Error parsing mountainsClassification in getScraperData:', e);
      parsedData.mountainsClassification = [];
    }
  }
  if (parsedData.youthClassification && typeof parsedData.youthClassification === 'string') {
    try {
      parsedData.youthClassification = JSON.parse(parsedData.youthClassification);
    } catch (e) {
      console.error('Error parsing youthClassification in getScraperData:', e);
      parsedData.youthClassification = [];
    }
  }
  if (parsedData.teamClassification && typeof parsedData.teamClassification === 'string') {
    try {
      parsedData.teamClassification = JSON.parse(parsedData.teamClassification);
    } catch (e) {
      console.error('Error parsing teamClassification in getScraperData:', e);
      parsedData.teamClassification = [];
    }
  }
  
  // Remove Firebase metadata before returning
  const { updatedAt, key: docKey, ...scraperData } = parsedData;
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