import { getPgeCredentials } from '@/services/op';
import { addTransactionToYnab } from '@/services/ynab/transactions';
import type { PgeCredentials, PgeData } from '@/types';
import {
  getBrowserContext,
  getEnvVar,
  parseDueDate,
  pgeDashboardUrl,
  saveAuthState,
} from '@/utils';
import retry from 'async-retry';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import pw from 'playwright';
import { logger } from './logger';
dayjs.extend(duration);

async function loginToPge(page: pw.Page, pgeCredentials: PgeCredentials, pgeBaseUrl: string) {
  logger.info('Navigating to the PG&E login page');
  await page.goto(`${pgeBaseUrl}/#login`, {
    timeout: dayjs.duration(1, 'minute').asMilliseconds(),
  });

  logger.info('Attempting to log in');
  await page.locator('#usernameField').pressSequentially(pgeCredentials.username);
  await page.locator('#passwordField').pressSequentially(pgeCredentials.password);
  await page.locator('#home_login_submit').click();

  await page.waitForURL(pgeDashboardUrl(pgeBaseUrl, pgeCredentials.accountNumber), {
    timeout: dayjs.duration(1, 'minute').asMilliseconds(),
  });

  await saveAuthState(page, 'pge');
}

async function getPgeData(page: pw.Page): Promise<PgeData> {
  logger.info('Retrieving the bill value');
  const billValue = await page.locator('#spntotalAmountDueUI').innerText();
  if (!billValue) {
    throw new Error('Could not find the bill value');
  }

  const dueDateElement = page.locator('.pge_coc-dashboard-viewPay_bill_due_para .FontBold');
  const dueDateText = await dueDateElement.textContent();
  if (!dueDateText) {
    throw new Error('Due date element not found');
  }
  const dueDate = parseDueDate(dueDateText);
  const formattedDueDate = dueDate.format('YYYY-MM-DD');
  logger.info({ billValue, dueDate: formattedDueDate }, 'Retrieved values from pge website');

  const parsedBillValue = parseFloat(billValue.replace('$', ''));

  return {
    amountDue: parsedBillValue,
    dueDate: formattedDueDate,
  };
}

async function main(bail: (e: Error) => void) {
  let browser: pw.Browser | undefined;
  let context: pw.BrowserContext | undefined;
  let page: pw.Page | undefined;

  try {
    logger.info('Retrieving the PG&E credentials');
    const pgeCredentials = await getPgeCredentials();
    const pgeBaseUrl = getEnvVar('PGE_BASE_URL');

    logger.info('Starting the browser');
    browser = await pw.chromium.launch();
    const { context: ctx, authenticated } = await getBrowserContext(browser, 'pge');
    context = ctx;
    page = await context.newPage();
    page.setDefaultNavigationTimeout(10_000);
    page.setDefaultTimeout(10_000);

    if (!authenticated) {
      logger.info('Authentication state not found or outdated. Logging in');
      await loginToPge(page, pgeCredentials, pgeBaseUrl);
    } else {
      logger.info('Found valid authentication state. Trying to navigate to the dashboard');
      await page.goto(pgeDashboardUrl(pgeBaseUrl, pgeCredentials.accountNumber), {
        timeout: 20_000,
      });

      if (!page.url().includes('dashboard')) {
        logger.info('Authentication state is invalid. Logging in');
        await loginToPge(page, pgeCredentials, pgeBaseUrl);
      }
    }

    const pgeData = await getPgeData(page);
    logger.info({ pgeData }, 'Retrieved data from PG&E');
    await addTransactionToYnab(pgeData);

    // Gracefully close the browser
    logger.info('Closing the browser');
    await closeWithTimeout(page, context, browser);

    return pgeData; // Return success result
  } catch (error) {
    // Handle cleanup in case of error
    if (page || context || browser) {
      logger.info('Cleaning up browser resources after error');
      try {
        await closeWithTimeout(page, context, browser);
      } catch (cleanupError) {
        logger.error(cleanupError, 'Failed to cleanup browser resources');
        return bail(new Error('Failed to cleanup browser resources'));
      }
    }
    throw error; // Re-throw to trigger retry
  }
}

async function closeWithTimeout(
  page?: pw.Page,
  context?: pw.BrowserContext,
  browser?: pw.Browser,
): Promise<void> {
  if (!page && !context && !browser) return;

  let timeoutId: NodeJS.Timer | undefined;
  let hasTimedOut = false;

  const createTimeoutPromise = () => {
    return new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => {
        hasTimedOut = true;
        reject(new Error('Operation timed out'));
      }, 10_000);
    });
  };

  try {
    // Close page
    if (page) {
      await Promise.race([
        page.close().catch((err: unknown) => logger.error(err, 'Page close error')),
        createTimeoutPromise(),
      ]);
      clearTimeout(timeoutId);
    }

    // Close context
    if (context) {
      await Promise.race([
        context.close().catch((err: unknown) => logger.error(err, 'Context close error')),
        createTimeoutPromise(),
      ]);
      clearTimeout(timeoutId);
    }

    // Close browser
    if (browser) {
      await Promise.race([
        browser.close().catch((err: unknown) => logger.error(err, 'Browser close error')),
        createTimeoutPromise(),
      ]);
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.error(error, 'Cleanup failed');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (hasTimedOut) {
      throw new Error('Browser cleanup timed out');
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// Main execution
try {
  await retry(main, {
    retries: 2,
    onRetry(e, attempt) {
      if (e instanceof Error) {
        logger.warn(`Attempt ${attempt.toString()}, error: ${e.message}`);
      }
    },
  });
} catch (error) {
  logger.error(error, 'All retry attempts failed');
  process.exit(1);
}
