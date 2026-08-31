import { DomainValidationError } from './domain-errors';

export const RANK_GAP = 1024n;

export type RankedRecord = {
  id: string;
  rank: bigint;
};

export function rankForPosition(
  siblings: RankedRecord[],
  beforeId?: string,
  afterId?: string
): bigint | null {
  if (beforeId && afterId && beforeId === afterId) {
    throw new DomainValidationError('beforeId and afterId must be different');
  }

  const sorted = [...siblings].sort((left, right) => (left.rank < right.rank ? -1 : 1));
  const beforeIndex = beforeId ? sorted.findIndex(({ id }) => id === beforeId) : -1;
  const afterIndex = afterId ? sorted.findIndex(({ id }) => id === afterId) : -1;

  if (beforeId && beforeIndex < 0) throw new DomainValidationError('beforeId is not a sibling');
  if (afterId && afterIndex < 0) throw new DomainValidationError('afterId is not a sibling');
  if (beforeId && afterId && afterIndex + 1 !== beforeIndex) {
    throw new DomainValidationError('beforeId and afterId must be adjacent');
  }

  const previous = afterId
    ? sorted[afterIndex]
    : beforeId
      ? sorted[beforeIndex - 1]
      : sorted.at(-1);
  const next = beforeId ? sorted[beforeIndex] : afterId ? sorted[afterIndex + 1] : undefined;

  if (!previous && !next) return RANK_GAP;
  if (!previous && next) return next.rank > 1n ? next.rank / 2n : null;
  if (previous && !next) return previous.rank + RANK_GAP;

  const gap = next!.rank - previous!.rank;
  return gap > 1n ? previous!.rank + gap / 2n : null;
}

export function rebalancedRanks(siblings: RankedRecord[]) {
  return [...siblings]
    .sort((left, right) => (left.rank < right.rank ? -1 : 1))
    .map(({ id }, index) => ({ id, rank: BigInt(index + 1) * RANK_GAP }));
}
