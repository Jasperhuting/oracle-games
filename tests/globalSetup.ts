/**
 * Playwright Global Setup
 *
 * Starts the Firebase emulator (if not already running) and seeds test data
 * before any tests execute. Works for both `npm run test:e2e` (auto-starts
 * everything) and `npm run test:e2e:full` (detects services already running
 * and skips starting them again).
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Use the npm binary alongside the current node binary so it works in
// restricted shells (CI, Claude Code Bash tool, etc.) where npm isn't in PATH.
const NPM_BIN = path.join(path.dirname(process.execPath), 'npm');

// Ensure node (and java) are always in PATH for all child processes.
const ENRICHED_PATH = [
  path.dirname(process.execPath),            // /opt/homebrew/Cellar/node/.../bin
  '/opt/homebrew/bin',                        // homebrew symlinks (node, npm, etc.)
  '/opt/homebrew/opt/openjdk@21/bin',         // Java 21 (for Firebase emulator)
  path.join(os.homedir(), '.npm-global/bin'), // globally installed CLIs (firebase)
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  process.env.PATH ?? '',
].join(':');

const PROJECT_ROOT = path.join(__dirname, '..');
const FIREBASE_BIN = path.join(os.homedir(), '.npm-global/bin/firebase');
const PID_FILE = '/tmp/oracle-e2e-emulator.pid';

const EMULATOR_AUTH_PORT = 9099;
const EMULATOR_FIRESTORE_PORT = 8080;

async function ping(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal }).catch(() => null);
    clearTimeout(timer);
    return res !== null;
  } catch {
    return false;
  }
}

async function waitForPort(port: number, label: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await ping(`http://127.0.0.1:${port}`)) return;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Timed out waiting for ${label} on port ${port}`);
}

async function startEmulator(): Promise<void> {
  console.log('\n🔥 Starting Firebase emulators...');

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: ENRICHED_PATH,
    JAVA_HOME: '/opt/homebrew/opt/openjdk@21',
  };

  const proc = spawn(FIREBASE_BIN, [
    'emulators:start',
    '--only', 'auth,firestore',
    '--import', './emulator-data',
  ], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Write PID so globalTeardown can stop it
  fs.writeFileSync(PID_FILE, String(proc.pid));

  proc.stdout?.on('data', (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line.includes('All emulators ready') || line.includes('Emulator Hub')) {
      process.stdout.write(`   firebase: ${line}\n`);
    }
  });

  proc.on('error', (err) => {
    throw new Error(`Failed to start Firebase emulator: ${err.message}`);
  });

  await waitForPort(EMULATOR_AUTH_PORT, 'Firebase Auth emulator');
  await waitForPort(EMULATOR_FIRESTORE_PORT, 'Firestore emulator');
  console.log('   ✓ Firebase Auth emulator ready  (port 9099)');
  console.log('   ✓ Firestore emulator ready      (port 8080)');
}

async function clearFirestore(): Promise<void> {
  const url =
    'http://127.0.0.1:8080/emulator/v1/projects/oracle-games-b6af6/databases/(default)/documents';
  const res = await fetch(url, { method: 'DELETE' }).catch(() => null);
  if (res && res.ok) {
    console.log('   ✓ Firestore cleared');
  }
}

async function seedTestData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(NPM_BIN, ['run', 'seed:test-data'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: ENRICHED_PATH },
    });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('   ✓ Test data seeded');
        resolve();
      } else {
        reject(new Error(`seed:test-data failed (code ${code}): ${stderr.slice(-300)}`));
      }
    });
  });
}

export default async function globalSetup() {
  const emulatorAlreadyRunning = await ping(`http://127.0.0.1:${EMULATOR_AUTH_PORT}`);

  if (emulatorAlreadyRunning) {
    console.log('\n✓ Firebase emulators already running — skipping startup');
    // Remove PID file so globalTeardown knows we didn't start it
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } else {
    await startEmulator();
  }

  console.log('\n📦 Seeding test data...');
  await clearFirestore();
  await seedTestData();
  console.log('');
}
