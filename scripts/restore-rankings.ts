import { getServerFirebase } from '@/lib/firebase/server';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function restoreRankings(backupFilePath: string) {
    console.log(`Starting restore from: ${backupFilePath}`);

    const db = getServerFirebase();

    try {
        // Read the backup file
        if (!fs.existsSync(backupFilePath)) {
            throw new Error(`Backup file not found: ${backupFilePath}`);
        }

        const fileContent = fs.readFileSync(backupFilePath, 'utf-8');
        const backupData = JSON.parse(fileContent);

        console.log(`Found ${backupData.length} documents to restore`);

        // Ask for confirmation (comment out if you want to run without confirmation)
        console.log('⚠️  This will overwrite existing data!');

        let restoredCount = 0;

        for (const item of backupData) {
            const { id, data } = item;

            // Extract year from the backup filename or use the collection path
            const yearMatch = backupFilePath.match(/rankings_(\d{4})/);
            const year = yearMatch ? yearMatch[1] : '2026';
            const collectionName = `rankings_${year}`;

            // Convert team path back to a reference if it exists
            if (data.team && typeof data.team === 'string') {
                data.team = db.doc(data.team);
            }

            // Restore the document
            await db.collection(collectionName).doc(id).set(data);
            restoredCount++;

            if (restoredCount % 100 === 0) {
                console.log(`Restored ${restoredCount}/${backupData.length} documents...`);
            }
        }

        console.log(`✅ Restore completed successfully!`);
        console.log(`📊 Total documents restored: ${restoredCount}`);

    } catch (error) {
        console.error('Error restoring backup:', error);
        throw error;
    }
}

// Run the restore
const backupFilePath = process.argv[2];

if (!backupFilePath) {
    console.error('❌ Please provide a backup file path');
    console.log('Usage: npx tsx scripts/restore-rankings.ts <path-to-backup-file>');
    process.exit(1);
}

restoreRankings(backupFilePath)
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Restore failed:', error);
        process.exit(1);
    });
