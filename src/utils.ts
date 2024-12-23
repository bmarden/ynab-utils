import { logger } from '@/logger';
import type { EnvKey } from '@/types';
import dayjs from 'dayjs';
import fs from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from 'playwright';

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

export async function saveAuthState(page: Page, authName: string) {
  try {
    const fileName = path.join(rootDir, '.auth', `${authName}.json`);
    await page.context().storageState({ path: fileName });
  } catch (error) {
    logger.error(error, 'Error saving auth state');
    throw error;
  }
}

export async function getBrowserContext(browser: Browser, authName: string) {
  // Check if file exists
  try {
    const fileName = path.join(rootDir, '.auth', `${authName}.json`);
    const authFile = Bun.file(fileName);
    const authFileExists = await authFile.exists();

    if (!authFileExists) {
      logger.debug('Auth file does not exist');
      const context = await browser.newContext();
      return { context, authenticated: false };
    }

    const fileLastModified = dayjs(authFile.lastModified);
    const now = dayjs();
    const duration = dayjs.duration(now.diff(fileLastModified));
    const fileOutdated = duration.asMinutes() > 15;

    logger.debug(
      {
        fileLastModified: authFile.lastModified,
        lastModifiedInMinutes: duration.asMinutes(),
      },
      'Auth file info',
    );

    if (fileOutdated) {
      logger.debug('Auth file is outdated. Deleting and returning new context');
      fs.rmSync(path.join(rootDir, '.auth', `${authName}.json`));
      return { context: await browser.newContext(), authenticated: false };
    }

    const context = await browser.newContext({ storageState: fileName });
    return { context, authenticated: true };
  } catch (error) {
    logger.error(error, 'Error getting browser context');
    throw error;
  }
}

export function convertToMilliunits(
  amount: number,
  type: 'negative' | 'positive' = 'positive',
): number {
  if (type === 'negative') {
    return amount * -1000;
  }
  return amount * 1000;
}

export function pgeDashboardUrl(baseUrl: string, accountNumber: string) {
  return `${baseUrl}/#myaccount/dashboard/summary/${accountNumber}`;
}

export function parseDueDate(dateString: string) {
  const dateMatch = /Due (\d{1,2})\/(\d{1,2})/.exec(dateString);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  const [_, month, day] = dateMatch;
  const currentYear = dayjs().year();

  let dueDate = dayjs(`${month}/${day}/${currentYear.toString()}`, 'M/D/YYYY');
  if (!dueDate.isValid()) {
    throw new Error(`Invalid date: ${month}/${day}`);
  }

  // If the due date is in the past, assume it's for next year
  if (dueDate.isBefore(dayjs())) {
    dueDate = dueDate.add(1, 'year');
  }

  return dueDate;
}
