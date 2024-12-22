import { getPgeCredentials } from '@/services/op';
import { addTransactionToAccount, getAccountByName } from '@/services/ynab/accounts';
import { getBudgetByName } from '@/services/ynab/budgets';
import type { PgeCredentials, PgeData } from '@/types';
import {
  clearAndCreateDir,
  convertToMilliunits,
  getBrowserContext,
  getEnvVar,
  saveAuthState,
} from '@/utils';
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
  // await page.locator('#onetrust-reject-all-handler').click( { });

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

async function extractAndValidateDueDate(page: pw.Page): Promise<dayjs.Dayjs> {
  // Select the element containing the due date using the class name
  const dueDateElement = page.locator('.pge_coc-dashboard-viewPay_bill_due_para .FontBold');

  // Get the text content
  const dueDateText = await dueDateElement.textContent();

  if (!dueDateText) {
    throw new Error('Due date element not found');
  }

  // Extract the date part using regex
  const dateMatch = /Due (\d{1,2})\/(\d{1,2})/.exec(dueDateText);

  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dueDateText}`);
  }

  // Extract month and day
  const [_, month, day] = dateMatch;
  // Get current year
  const currentYear = dayjs().year();

  // Create a dayjs object with the date
  let dueDate = dayjs(`${month}/${day}/${currentYear.toString()}`, 'M/D/YYYY');

  // Validate the date
  if (!dueDate.isValid()) {
    throw new Error(`Invalid date: ${month}/${day}`);
  }

  // If the due date is in the past, assume it's for next year
  if (dueDate.isBefore(dayjs())) {
    dueDate = dueDate.add(1, 'year');
  }

  return dueDate;
}

async function getPgeData(page: pw.Page): Promise<PgeData> {
  logger.info('Retrieving the bill value');
  const billValue = await page.locator('#spntotalAmountDueUI').innerText();
  if (!billValue) {
    throw new Error('Could not find the bill value');
  }
  const dueDate = await extractAndValidateDueDate(page);
  const formattedDueDate = dueDate.format('YYYY-MM-DD');
  logger.info({ billValue, dueDate: formattedDueDate }, 'Retrieved values from pge website');

  const parsedBillValue = parseFloat(billValue.replace('$', ''));

  await page.screenshot({ path: `${PGE_SCREENSHOTS_DIR}/bill.png`, fullPage: true });

  return {
    amountDue: parsedBillValue,
    dueDate: formattedDueDate,
  };
}

async function addTransactionToYnab(pgeData: PgeData) {
  const budgetName = getEnvVar('YNAB_BUDGET_NAME');
  const accountName = getEnvVar('YNAB_ACCOUNT_NAME');
  const budget = await getBudgetByName(budgetName);
  const account = await getAccountByName(budget.id, accountName);
  await addTransactionToAccount({
    budgetId: budget.id,
    transaction: {
      date: pgeData.dueDate,
      account_id: account.id,
      category_id: getEnvVar('YNAB_CATEGORY_ID'),
      amount: convertToMilliunits(pgeData.amountDue, 'negative'),
      payee_name: 'PG&E',
      frequency: 'never',
      memo: 'Electricity bill',
    },
  });
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
    if (!page.url().includes('dashboard')) {
      logger.info('Authentication state is invalid. Logging in');
      await loginToPge(page, pgeCredentials, pgeBaseUrl);
    }
  }

  logger.info('Clearing the screenshots directory');
  clearAndCreateDir('screenshots/pge');

  const pgeData = await getPgeData(page);
  logger.info({ pgeData }, 'Retrieved data from PG&E');
  await addTransactionToYnab(pgeData);

  // Gracefully close the browser
  logger.info('Closing the browser');
  // await context.close();
  await browser.close();
}

await retry(main, {
  retries: 3,
  onRetry(e, attempt) {
    logger.warn(e, `Attempt ${attempt.toString()}`);
  },
});
