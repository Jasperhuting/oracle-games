/**
 * Playwright Global Teardown
 *
 * Stops the Firebase emulator if globalSetup started it.
 * If the emulator was already running when tests started, we leave it alone.
 */
import * as fs from 'fs';

const PID_FILE = '/tmp/oracle-e2e-emulator.pid';

export default async function globalTeardown() {
  if (!fs.existsSync(PID_FILE)) {
    // Emulator was already running before tests — don't stop it
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = parseInt(pidStr, 10);
  fs.unlinkSync(PID_FILE);

  if (!pid || isNaN(pid)) return;

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`\n🛑 Firebase emulator stopped (pid ${pid})`);
  } catch {
    // Process already gone — that's fine
  }
}
