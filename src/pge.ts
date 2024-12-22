import { getPgeCredentials } from '@/services/op';
import { getAccountByName } from '@/services/ynab/accounts';
import { getBudgetByName } from '@/services/ynab/budgets';
import type { PgeCredentials, PgeData } from '@/types';
import { clearAndCreateDir, getBrowserContext, getEnvVar, saveAuthState } from '@/utils';
import retry from 'async-retry';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import pw from 'playwright';
import { logger } from './logger';
dayjs.extend(duration);

const PGE_SCREENSHOTS_DIR = 'screenshots/pge';

async function loginToPge(page: pw.Page, pgeCredentials: PgeCredentials, pgeBaseUrl: string) {
  logger.info('Navigating to the PG&E login page');
  await page.goto(`${pgeBaseUrl}/#login`, {
    timeout: dayjs.duration(1, 'minute').asMilliseconds(),
  });

  await page.screenshot({ path: `${PGE_SCREENSHOTS_DIR}/login.png`, fullPage: true });
  await page.locator('#onetrust-reject-all-handler').click();

  logger.info('Attempting to log in');
  await page.locator('#usernameField').pressSequentially(pgeCredentials.username);
  await page.locator('#passwordField').pressSequentially(pgeCredentials.password);
  await page.locator('#home_login_submit').click();

  await page.waitForURL(
    `${pgeBaseUrl}/#myaccount/dashboard/summary/${pgeCredentials.accountNumber}`,
  );

  await page.screenshot({ path: `${PGE_SCREENSHOTS_DIR}/dashboard.png`, fullPage: true });
  await saveAuthState(page, 'pge');
}

async function getPgeData(page: pw.Page): Promise<PgeData> {
  logger.info('Retrieving the bill value');
  const billValue = await page.locator('#spntotalAmountDueUI').innerText();
  if (!billValue) {
    throw new Error('Could not find the bill value');
  }
  logger.info({ billValue }, 'Retrieved values from pge website');

  const parsedBillValue = parseFloat(billValue.replace('$', ''));

  return {
    amountDue: parsedBillValue,
    dueDate: dayjs().add(1, 'month').endOf('month').format('YYYY-MM-DD'),
  };
}

async function addTransactionToYnab(pgeData: PgeData) {
  const budgetName = getEnvVar('YNAB_BUDGET_NAME');
  const accountName = getEnvVar('YNAB_ACCOUNT_NAME');
  const budget = await getBudgetByName(budgetName);
  const account = await getAccountByName(budget.id, accountName);
  // account.
}

async function main() {
  logger.info('Retrieving the PG&E credentials');
  const pgeCredentials = await getPgeCredentials();
  const pgeBaseUrl = getEnvVar('PGE_BASE_URL');

  logger.info('Starting the browser');
  const browser = await pw.chromium.launch();
  const { context, authenticated } = await getBrowserContext(browser, 'pge');
  const page = await context.newPage();

  if (!authenticated) {
    logger.info('No authentication state found. Logging in');
    await loginToPge(page, pgeCredentials, pgeBaseUrl);
  } else {
    logger.info('Found authentication state. Navigating to the dashboard');
    await page.goto(`${pgeBaseUrl}/#myaccount/dashboard/summary/${pgeCredentials.accountNumber}`);
  }

  logger.info('Clearing the screenshots directory');
  clearAndCreateDir('screenshots/pge');

  const pgeData = await getPgeData(page);
  logger.info({ pgeData }, 'Retrieved data from PG&E');
  // await addTransactionToYnab(pgeData);

  // Gracefully close the browser
  logger.info('Closing the browser');
  await context.close();
  await browser.close();
}

await retry(main, {
  retries: 3,
  onRetry(e, attempt) {
    logger.warn(e, `Attempt ${attempt.toString()}`);
  },
});
