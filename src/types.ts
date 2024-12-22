export interface YnabResponse<TResp> {
  data: TResp;
}

export type EnvKey =
  | 'YNAB_BASE_URL'
  | 'YNAB_BUDGET_NAME'
  | 'YNAB_ACCOUNT_NAME_TO_ADD_TRANSACTIONS_TO'
  | 'OP_SERVICE_ACCOUNT_TOKEN'
  | 'PGE_BASE_URL'
  | 'LOG_LEVEL'
  | 'NODE_ENV';

export interface PgeData {
  dueDate: string;
  amountDue: number;
}
