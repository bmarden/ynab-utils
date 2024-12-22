import { logger } from '@/logger';
import { ynabApi } from '@/services/ynab/api';

export async function getAccountsByBudgetId(budgetId: string) {
  try {
    const accounts = await ynabApi.accounts.getAccounts(budgetId);
    logger.info(
      `Retrieved ${accounts.data.accounts.length.toString()} accounts for budget id: ${budgetId}`,
    );
    return accounts.data.accounts;
  } catch (error) {
    logger.error('Error retrieving accounts:', error);
    throw error;
  }
}

export async function getAccountByName(budgetId: string, accountName: string) {
  const accounts = await getAccountsByBudgetId(budgetId);
  const account = accounts.find((a) => a.name === accountName);
  if (!account) {
    throw new Error(`Could not find the account: ${accountName}`);
  }
  return account;
}
