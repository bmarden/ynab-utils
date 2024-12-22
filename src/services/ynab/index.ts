import { logger } from '@/logger';
import { ynabApi } from '@/services/ynab/api';
import { getEnvVar } from '@/utils';

const budgets = await ynabApi.budgets.getBudgets();
logger.info(`Retrieved ${budgets.data.budgets.length.toString()} budgets`);

const ynabBudgetName = getEnvVar('YNAB_BUDGET_NAME');
const budget = budgets.data.budgets.find((b) => b.name === ynabBudgetName);
if (!budget) {
  throw new Error(`Could not find the budget: ${ynabBudgetName}`);
}

logger.info(`Retrieved budget with id: ${budget.id}`);
logger.debug(budget, 'Ynab budget');

const accounts = await ynabApi.accounts.getAccounts(budget.id);
logger.info(`Retrieved ${accounts.data.accounts.length.toString()} accounts`);
logger.debug(accounts.data.accounts, 'Ynab accounts');
