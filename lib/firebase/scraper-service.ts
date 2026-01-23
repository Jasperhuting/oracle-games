import { getServerFirebase } from './server';
import type { DocumentData } from 'firebase-admin/firestore';
import { type StartlistResult, type StageResult } from '../scraper/types';
import { cleanFirebaseData } from './utils';
import {
  validateScraperData,
  type ValidationResult,
  generateDataHash,
} from '../validation/scraper-validation';

export interface ScraperDataKey {
  race: string;
  year: number;
  type: 'startlist' | 'stage' | 'result' | 'tour-gc';
  stage?: number;
}

export interface SaveOptions {
  skipValidation?: boolean;
  forceOverwrite?: boolean;
  backupReason?: 'pre-update' | 'manual' | 'validation-failure';
}

export interface SaveResult {
  success: boolean;
  docId: string;
  validation: ValidationResult | null;
  previousDataBackedUp: boolean;
  backupDocId?: string;
  error?: string;
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

  // Check if document exists to determine if we should update or create
  const docRef = db.collection('scraper-data').doc(docId);
  const docSnapshot = await docRef.get();
  
  if (docSnapshot.exists) {
    // Document exists - update it
    await docRef.update(cleanedData);
    console.log(`[SCRAPER_SERVICE] Updated existing document: ${docId}`);
  } else {
    // Document doesn't exist - create it
    await docRef.set(cleanedData);
    console.log(`[SCRAPER_SERVICE] Created new document: ${docId}`);
  }
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

/**
 * Backup existing scraper data before overwriting
 */
async function backupScraperData(
  docId: string,
  data: DocumentData,
  reason: 'pre-update' | 'manual' | 'validation-failure'
): Promise<string> {
  const db = getServerFirebase();
  const backupDocId = `${docId}-${Date.now()}`;

  const backupData = {
    originalDocId: docId,
    backedUpAt: new Date().toISOString(),
    data: data,
    backupReason: reason,
  };

  await db.collection('scraper-data-backups').doc(backupDocId).set(backupData);
  console.log(`[SCRAPER_SERVICE] Created backup: ${backupDocId}`);

  return backupDocId;
}

/**
 * Save scraper data with validation and backup
 *
 * This is the preferred method for saving scraper data as it:
 * 1. Validates the data before saving
 * 2. Creates a backup of existing data
 * 3. Prevents overwriting good data with invalid data
 */
export async function saveScraperDataValidated(
  key: ScraperDataKey,
  data: StartlistResult | StageResult,
  options: SaveOptions = {}
): Promise<SaveResult> {
  const db = getServerFirebase();
  const docId = generateDocumentId(key);

  // 1. Validate new data (unless skipped)
  let validation: ValidationResult | null = null;
  if (!options.skipValidation) {
    validation = validateScraperData(data);

    // If invalid and not forcing, reject
    if (!validation.valid && !options.forceOverwrite) {
      console.error(`[SCRAPER_SERVICE] Validation failed for ${docId}:`, validation.errors);
      return {
        success: false,
        docId,
        validation,
        previousDataBackedUp: false,
        error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
      };
    }

    // Log warnings even if valid
    if (validation.warnings.length > 0) {
      console.warn(`[SCRAPER_SERVICE] Validation warnings for ${docId}:`, validation.warnings);
    }
  }

  // 2. Check if document exists and backup if so
  const docRef = db.collection('scraper-data').doc(docId);
  const docSnapshot = await docRef.get();

  let backupDocId: string | undefined;
  let previousDataBackedUp = false;

  if (docSnapshot.exists) {
    const existingData = docSnapshot.data();
    if (existingData) {
      // Create backup before overwriting
      backupDocId = await backupScraperData(
        docId,
        existingData,
        options.backupReason || 'pre-update'
      );
      previousDataBackedUp = true;
    }
  }

  // 3. Prepare data for storage
  const cleanKey = {
    race: key.race,
    year: key.year,
    type: key.type,
    ...(key.stage !== undefined && { stage: key.stage })
  };

  const dataHash = generateDataHash(data);

  const docData = {
    ...data,
    updatedAt: new Date().toISOString(),
    key: cleanKey,
    _validation: validation ? {
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      metadata: validation.metadata,
      validatedAt: validation.metadata.validatedAt,
    } : null,
    _dataHash: dataHash,
    _previousVersion: backupDocId || null,
  };

  // Clean the data to remove undefined values before saving to Firebase
  const cleanedData = cleanFirebaseData(docData) as DocumentData;

  // 4. Save the data
  try {
    if (docSnapshot.exists) {
      await docRef.update(cleanedData);
      console.log(`[SCRAPER_SERVICE] Updated document with validation: ${docId}`);
    } else {
      await docRef.set(cleanedData);
      console.log(`[SCRAPER_SERVICE] Created document with validation: ${docId}`);
    }

    return {
      success: true,
      docId,
      validation,
      previousDataBackedUp,
      backupDocId,
    };
  } catch (error) {
    console.error(`[SCRAPER_SERVICE] Error saving ${docId}:`, error);
    return {
      success: false,
      docId,
      validation,
      previousDataBackedUp,
      backupDocId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get backup data for a document
 */
export async function getScraperDataBackup(
  backupDocId: string
): Promise<{ originalDocId: string; data: StartlistResult | StageResult; backedUpAt: string } | null> {
  const db = getServerFirebase();
  const doc = await db.collection('scraper-data-backups').doc(backupDocId).get();

  if (!doc.exists) {
    return null;
  }

  const backupData = doc.data();
  if (!backupData) {
    return null;
  }

  return {
    originalDocId: backupData.originalDocId,
    data: backupData.data as StartlistResult | StageResult,
    backedUpAt: backupData.backedUpAt,
  };
}

/**
 * List all backups for a document
 */
export async function listScraperDataBackups(
  originalDocId: string
): Promise<Array<{ id: string; backedUpAt: string; backupReason: string }>> {
  const db = getServerFirebase();
  const snapshot = await db
    .collection('scraper-data-backups')
    .where('originalDocId', '==', originalDocId)
    .orderBy('backedUpAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    backedUpAt: doc.data().backedUpAt as string,
    backupReason: doc.data().backupReason as string,
  }));
}

/**
 * Restore scraper data from backup
 */
export async function restoreFromBackup(
  backupDocId: string
): Promise<{ success: boolean; restoredDocId?: string; error?: string }> {
  const db = getServerFirebase();

  // Get the backup
  const backup = await getScraperDataBackup(backupDocId);
  if (!backup) {
    return { success: false, error: 'Backup not found' };
  }

  // Get the original document to backup current state before restore
  const originalDocRef = db.collection('scraper-data').doc(backup.originalDocId);
  const originalDoc = await originalDocRef.get();

  if (originalDoc.exists) {
    const currentData = originalDoc.data();
    if (currentData) {
      // Backup current state before restoring
      await backupScraperData(backup.originalDocId, currentData, 'pre-update');
    }
  }

  // Restore the backup data
  const restoredData = {
    ...backup.data,
    updatedAt: new Date().toISOString(),
    _restoredFrom: backupDocId,
    _restoredAt: new Date().toISOString(),
  };

  const cleanedData = cleanFirebaseData(restoredData) as DocumentData;

  try {
    await originalDocRef.set(cleanedData);
    console.log(`[SCRAPER_SERVICE] Restored ${backup.originalDocId} from backup ${backupDocId}`);
    return { success: true, restoredDocId: backup.originalDocId };
  } catch (error) {
    console.error(`[SCRAPER_SERVICE] Error restoring from backup:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get scraper data with validation metadata
 */
export async function getScraperDataWithMetadata(
  key: ScraperDataKey
): Promise<{
  data: StartlistResult | StageResult;
  validation: { valid: boolean; errorCount: number; warningCount: number } | null;
  dataHash: string | null;
  updatedAt: string;
  previousVersion: string | null;
} | null> {
  const db = getServerFirebase();
  const docId = generateDocumentId(key);

  const doc = await db.collection('scraper-data').doc(docId).get();

  if (!doc.exists) {
    return null;
  }

  const rawData = doc.data();
  if (!rawData) {
    return null;
  }

  // Get the clean data using existing function
  const data = await getScraperData(key);
  if (!data) {
    return null;
  }

  return {
    data,
    validation: rawData._validation || null,
    dataHash: rawData._dataHash || null,
    updatedAt: rawData.updatedAt,
    previousVersion: rawData._previousVersion || null,
  };
}