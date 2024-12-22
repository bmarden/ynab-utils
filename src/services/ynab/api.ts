import { logger } from '@/logger';
import { getYnabApiKey } from '@/services/op';
import { getEnvVar } from '@/utils';
import ynab from 'ynab';

const ynabBaseUrl = getEnvVar('YNAB_BASE_URL');
logger.debug(`Retrieved the YNAB base URL: ${ynabBaseUrl}`);

const ynabPat = await getYnabApiKey();
export const ynabApi = new ynab.API(ynabPat);
