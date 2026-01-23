import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import {
  listScraperDataBackups,
  getScraperDataBackup,
  restoreFromBackup,
} from '@/lib/firebase/scraper-service';
import { sendAdminNotification } from '@/lib/email/admin-notifications';

// GET /api/admin/rollback-scraper - List backups for a document
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const docId = searchParams.get('docId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!docId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get backups
    const backups = await listScraperDataBackups(docId);

    // Get details for each backup (limited to 10 most recent)
    const backupsWithDetails = await Promise.all(
      backups.slice(0, 10).map(async (backup) => {
        const details = await getScraperDataBackup(backup.id);
        return {
          ...backup,
          riderCount: details?.data && 'stageResults' in details.data
            ? (details.data.stageResults?.length || 0)
            : (details?.data && 'riders' in details.data ? (details.data.riders?.length || 0) : 0),
        };
      })
    );

    return NextResponse.json({
      docId,
      backups: backupsWithDetails,
      totalBackups: backups.length,
    });
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json(
      { error: 'Failed to list backups', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/rollback-scraper - Restore from backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, backupId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!backupId) {
      return NextResponse.json(
        { error: 'Backup ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get backup details before restore
    const backupDetails = await getScraperDataBackup(backupId);
    if (!backupDetails) {
      return NextResponse.json(
        { error: 'Backup not found' },
        { status: 404 }
      );
    }

    // Perform the restore
    const result = await restoreFromBackup(backupId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Restore failed' },
        { status: 500 }
      );
    }

    // Parse race info from doc ID
    const docIdParts = backupDetails.originalDocId.split('-');
    const year = parseInt(docIdParts[docIdParts.length - 2], 10) || undefined;
    const race = docIdParts.slice(0, -2).join('-') || backupDetails.originalDocId;

    // Log the rollback
    await db.collection('activityLogs').add({
      type: 'scraper_rollback',
      adminUserId: userId,
      backupId,
      originalDocId: backupDetails.originalDocId,
      backedUpAt: backupDetails.backedUpAt,
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString(),
    });

    // Send notification
    await sendAdminNotification('rollback_performed', {
      race,
      year,
      userId,
      details: {
        reason: reason || 'No reason provided',
        backupId,
        originalDocId: backupDetails.originalDocId,
        backedUpAt: backupDetails.backedUpAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Data restored successfully',
      restoredDocId: result.restoredDocId,
      backupId,
      backedUpAt: backupDetails.backedUpAt,
    });
  } catch (error) {
    console.error('Error restoring from backup:', error);
    return NextResponse.json(
      { error: 'Failed to restore from backup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
