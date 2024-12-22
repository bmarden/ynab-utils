import retry from 'async-retry';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import pw from 'playwright';
import { logger } from './logger';
import { clearAndCreateDir, getEnvVar } from './utils';
dayjs.extend(duration);

const PGE_BASE_URL = 'https://m.pge.com';
const PGE_SCREENSHOTS_DIR = 'screenshots/pge';

async function main() {
  logger.info('Starting the browser');
  const browser = await pw.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  logger.info('Navigating to the PG&E login page');
  await page.goto(`${PGE_BASE_URL}/#login`, {
    timeout: dayjs.duration(1, 'minute').asMilliseconds(),
  });

  logger.info('Clearing the screenshots directory');
  clearAndCreateDir('screenshots/pge');

  await page.screenshot({ path: `${PGE_SCREENSHOTS_DIR}/login.png`, fullPage: true });
  await page.locator('#onetrust-reject-all-handler').click();

  logger.info('Attempting to log in');
  await page.locator('#usernameField').pressSequentially(getEnvVar('PGE_USERNAME'));
  await page.locator('#passwordField').pressSequentially(getEnvVar('PGE_PASSWORD'));
  await page.locator('#home_login_submit').click();
  await page.waitForURL(
    `${PGE_BASE_URL}/#myaccount/dashboard/summary/${getEnvVar('PGE_ACCOUNT_NUMBER')}`
  );

  await page.screenshot({ path: `${PGE_SCREENSHOTS_DIR}/dashboard.png`, fullPage: true });

  logger.info('Retrieving the bill value');
  const billValue = await page.locator('#spntotalAmountDueUI').innerText();
  if (!billValue) {
    throw new Error('Could not find the bill value');
  }

  logger.info(`The bill value is ${billValue}`);

  // Gracefully close the browser
  logger.info('Closing the browser');
  await context.close();
  await browser.close();
}

await retry(main, {
  retries: 3,
});
