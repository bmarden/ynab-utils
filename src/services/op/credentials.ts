import { client } from "@/services/op/client";

export async function getPgeCredentials() {
  return {
    username: await client.secrets.resolve('op://dev/pge-credentials/username'),
    password: await client.secrets.resolve('op://dev/pge-credentials/password'),
    accountNumber: await client.secrets.resolve('op://dev/pge-credentials/account-number'),
  };
}

export async function getYnabApiKey() {
  return await client.secrets.resolve('op://dev/ynab-pat/credential');
}
