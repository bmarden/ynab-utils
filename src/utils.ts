import { logger } from '@/logger';
import type { EnvKey } from '@/types';
import fs from 'node:fs';
import path from 'node:path';

const scriptDir = import.meta.dir;
const rootDir = path.join(scriptDir, '..');

export function getEnvVar(name: EnvKey, defaultValue?: string): string {
  const value: unknown = process.env[name];
  if (!value || typeof value !== 'string') {
    if (defaultValue) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${name.toString()} is not set`);
  }
  return value;
}

export function clearAndCreateDir(dirPath: string) {
  const pathToClearAndCreate = path.join(rootDir, dirPath);
  try {
    logger.debug(`Removing the directory: ${pathToClearAndCreate}`);
    fs.rmSync(path.join(rootDir, dirPath), { force: true, recursive: true });
    logger.debug(`Removed the directory: ${pathToClearAndCreate}`);
  } catch (err) {
    logger.error(`Could not clear the directory: ${pathToClearAndCreate}`, err);
  }

  try {
    logger.debug(`Creating the directory: ${pathToClearAndCreate}`);
    fs.mkdirSync(path.join(rootDir, pathToClearAndCreate), { recursive: true });
    logger.debug(`Created the directory: ${pathToClearAndCreate}`);
  } catch (err) {
    logger.error(`Could not create the directory: ${pathToClearAndCreate}`, err);
  }
}
