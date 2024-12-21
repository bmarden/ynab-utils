import retry from 'async-retry';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import pw from 'playwright';
import { log } from './logger';
dayjs.extend(duration);

async function main() {
  log.info('Starting the browser');
  const browser = await pw.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  log.info('Navigating to the PG&E login page');
  await page.goto('https://m.pge.com/#login', {
    timeout: dayjs.duration(1, 'minute').asMilliseconds(),
  });

  await page.screenshot({ path: 'screenshot.png', fullPage: true });

  await page.locator('#onetrust-reject-all-handler').click();

  await page.locator('#usernameField').pressSequentially()

  // Gracefully close the browser
  log.info('Closing the browser');
  await context.close();
  await browser.close();
}

await retry(main, {
  retries: 3,
});
