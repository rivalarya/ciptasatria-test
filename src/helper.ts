import * as fs from 'node:fs';

export function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${message}`);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function loadIsFirstRun(): boolean {
  if (!fs.existsSync('.is_first_run')) {
    fs.writeFileSync('.is_first_run', 'true');
  }  

  return fs.readFileSync('.is_first_run', 'utf8') === 'true';
}

export function saveIsFirstRun(flag: boolean) {
  fs.writeFileSync('.is_first_run', flag ? 'true' : 'false');
}

export function removeIsFirstRunFile() {
  if (fs.existsSync('.is_first_run')) {
    fs.rmSync('.is_first_run');
  }
}
