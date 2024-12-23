import { addTransactionToAccount, getAccountByName } from '@/services/ynab/accounts';
import { getBudgetByName } from '@/services/ynab/budgets';
import type { PgeData } from '@/types';
import { convertToMilliunits, getEnvVar } from '@/utils';

export async function addTransactionToYnab(pgeData: PgeData) {
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
