import { createClient } from '@1password/sdk';
import { getEnvVar } from '../utils';

export const client = await createClient({
  auth: getEnvVar('OP_SERVICE_ACCOUNT_TOKEN'),
  integrationName: 'YNAB Automations',
  integrationVersion: '1.0.0',
});
