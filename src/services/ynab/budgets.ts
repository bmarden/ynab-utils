import { logger } from '@/logger';
import { ynabApi } from '@/services/ynab/api';

export async function getBudgets() {
  try {
    const budgets = await ynabApi.budgets.getBudgets();
    logger.info(`Retrieved ${budgets.data.budgets.length.toString()} budgets`);
    return budgets.data.budgets;
  } catch (error) {
    logger.error('Error retrieving budgets:', error);
    throw error;
  }
}

export async function getBudgetByName(budgetName: string) {
  const budgets = await getBudgets();
  const budget = budgets.find((b) => b.name === budgetName);
  if (!budget) {
    logger.warn(`Budget not found: ${budgetName}`);
    throw new Error(`Budget not found: ${budgetName}`);
  }
  logger.info(`Retrieved budget with id: ${budget.id}`);
  return budget;
}
