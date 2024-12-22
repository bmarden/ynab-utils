import { getEnvVar } from '@/utils';
import { createClient } from '@1password/sdk';

export const client = await createClient({
  auth: getEnvVar('OP_SERVICE_ACCOUNT_TOKEN'),
  integrationName: 'YNAB Utils',
  integrationVersion: '1.0.0',
});
