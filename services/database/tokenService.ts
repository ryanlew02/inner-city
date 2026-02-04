import { getDatabase } from './db';

export async function getTokenCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ tokens: number }>(
    `SELECT tokens FROM user_stats WHERE id = 'user'`
  );
  return result?.tokens ?? 0;
}

export async function addTokens(amount: number): Promise<number> {
  const db = await getDatabase();
  await db.execAsync(
    `UPDATE user_stats SET tokens = tokens + ${amount} WHERE id = 'user'`
  );
  return getTokenCount();
}

export async function spendTokens(amount: number): Promise<boolean> {
  const currentTokens = await getTokenCount();
  if (currentTokens < amount) {
    return false;
  }

  const db = await getDatabase();
  await db.execAsync(
    `UPDATE user_stats SET tokens = tokens - ${amount} WHERE id = 'user'`
  );
  return true;
}

export async function setTokens(amount: number): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(
    `UPDATE user_stats SET tokens = ${amount} WHERE id = 'user'`
  );
}
