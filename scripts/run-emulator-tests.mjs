import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const projectId = 'demo-crm-hoa-rovii';
const isWindows = process.platform === 'win32';
const firebaseBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  isWindows ? 'firebase.cmd' : 'firebase',
);

const args = [
  'emulators:exec',
  '--project',
  projectId,
  '--only',
  'auth,firestore',
  'npx tsx scripts/test-emulator-integrity.ts',
];

const child = spawn(firebaseBin, args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
  },
  stdio: 'inherit',
  shell: isWindows,
});

child.on('error', (error) => {
  console.error('Could not start Firebase Emulator tests:', error.message);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Firebase Emulator tests terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
