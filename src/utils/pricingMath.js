import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

/**
 * Standard rounding to 2 decimal places (Half-Up financial rounding)
 * @param {Decimal|number|string} val
 * @returns {Prisma.Decimal}
 */
export function round2(val) {
  if (val === null || val === undefined) return new Decimal(0);
  const d = val instanceof Decimal ? val : new Decimal(val);
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Convert any numeric or string representation into a Prisma Decimal
 * @param {any} val
 * @returns {Prisma.Decimal}
 */
export function toDecimal(val) {
  if (val === null || val === undefined || val === '') return new Decimal(0);
  if (val instanceof Decimal) return val;
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Addition
 */
export function add(...vals) {
  return vals.reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));
}

/**
 * Subtraction
 */
export function sub(a, b) {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Multiplication
 */
export function mul(a, b) {
  return toDecimal(a).times(toDecimal(b));
}

/**
 * Division
 */
export function div(a, b) {
  const divisor = toDecimal(b);
  if (divisor.isZero()) return new Decimal(0);
  return toDecimal(a).dividedBy(divisor);
}

/**
 * Percentage calculation: (amount * rate) / 100 rounded to 2 decimal places
 */
export function calcPercentage(amount, rate) {
  const dAmount = toDecimal(amount);
  const dRate = toDecimal(rate);
  return round2(dAmount.times(dRate).dividedBy(100));
}

/**
 * Minimum of two decimals
 */
export function minDecimal(a, b) {
  const da = toDecimal(a);
  const db = toDecimal(b);
  return da.lessThan(db) ? da : db;
}

/**
 * Maximum of two decimals
 */
export function maxDecimal(a, b) {
  const da = toDecimal(a);
  const db = toDecimal(b);
  return da.greaterThan(db) ? da : db;
}

/**
 * Format decimal to 2-decimal string for API responses
 */
export function formatCurrency(val) {
  return round2(val).toFixed(2);
}

/**
 * Allocate a total discount amount across multiple items proportionally based on weight.
 * Uses the Largest Remainder Method (Hare-Niemeyer) to ensure that the sum of item discounts
 * EXACTLY equals totalDiscount without 1-paisa/cent rounding drift.
 *
 * @param {Decimal} totalDiscount - Total discount to distribute
 * @param {Array<{ id: string, amount: Decimal }>} items - Items with their eligible base amount
 * @returns {Map<string, Prisma.Decimal>} Map of item id -> allocated discount Decimal
 */
export function allocateProportionally(totalDiscount, items) {
  const allocation = new Map();
  const dTotal = round2(totalDiscount);
  
  if (dTotal.isZero() || !items || items.length === 0) {
    items.forEach((item) => allocation.set(item.id, new Decimal(0)));
    return allocation;
  }

  // Sum of weights
  const totalBase = items.reduce((sum, item) => sum.plus(toDecimal(item.amount)), new Decimal(0));
  if (totalBase.isZero()) {
    items.forEach((item) => allocation.set(item.id, new Decimal(0)));
    return allocation;
  }

  // Cap discount at total base
  const effectiveDiscount = minDecimal(dTotal, totalBase);

  // First pass: Calculate unrounded allocations in paise/cents (integer cents)
  // Total in cents (e.g. 150.25 -> 15025 cents)
  const totalCents = Math.round(effectiveDiscount.toNumber() * 100);
  let allocatedCentsSum = 0;

  const itemCalculations = items.map((item) => {
    const itemBase = toDecimal(item.amount);
    const exactFraction = itemBase.dividedBy(totalBase).times(totalCents).toNumber();
    const integerCents = Math.floor(exactFraction);
    const remainder = exactFraction - integerCents;
    allocatedCentsSum += integerCents;

    return {
      id: item.id,
      integerCents,
      remainder,
      itemBase,
    };
  });

  // Second pass: Distribute leftover cents to items with highest remainder
  let remainingCents = totalCents - allocatedCentsSum;
  // Sort descending by remainder
  itemCalculations.sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < itemCalculations.length && remainingCents > 0; i++) {
    itemCalculations[i].integerCents += 1;
    remainingCents -= 1;
  }

  // Build final decimal results
  itemCalculations.forEach((calc) => {
    const allocatedDecimal = round2(new Decimal(calc.integerCents).dividedBy(100));
    // Never exceed item's base amount
    allocation.set(calc.id, minDecimal(allocatedDecimal, round2(calc.itemBase)));
  });

  return allocation;
}

