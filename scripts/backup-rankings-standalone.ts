import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function backupRankings(year: number) {
    console.log(`Starting backup of rankings_${year}...`);

    // Initialize Firebase Admin
    if (getAdminApps().length === 0) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('Missing Firebase credentials in .env.local');
        }

        initializeAdminApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey,
            }),
            projectId,
        });

        console.log('✅ Firebase Admin initialized');
    }

    const db = getFirestore();
    const collectionName = `rankings_${year}`;

    try {
        // Get all documents from the rankings collection
        const snapshot = await db.collection(collectionName).get();

        if (snapshot.empty) {
            console.log(`No rankings found in ${collectionName}`);
            return;
        }

        console.log(`Found ${snapshot.size} documents to backup`);

        // Prepare the backup data
        const backupData: any[] = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Convert team reference to a path string if it exists
            if (data.team) {
                data.team = data.team.path;
            }

            backupData.push({
                id: doc.id,
                data: data
            });
        }

        // Create backups directory if it doesn't exist
        const backupsDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `rankings_${year}_backup_${timestamp}.json`;
        const filepath = path.join(backupsDir, filename);

        // Write backup to file
        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

        console.log(`✅ Backup completed successfully!`);
        console.log(`📁 File: ${filepath}`);
        console.log(`📊 Total documents backed up: ${backupData.length}`);

        return filepath;

    } catch (error) {
        console.error('Error creating backup:', error);
        throw error;
    }
}

// Run the backup
const year = process.argv[2] ? parseInt(process.argv[2]) : 2026;
backupRankings(year)
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Backup failed:', error);
        process.exit(1);
    });
