import { describe, it, expect } from 'vitest';
import {
  assertOrderTransition,
  isOrderTerminal,
  ORDER_TRANSITIONS,
  type OrderState,
  computeOrderSplit,
  isValidGigPrice,
} from '@apex-work/shared';

describe('order state machine (shared domain)', () => {
  it('allows the happy path', () => {
    expect(assertOrderTransition('PENDING', 'PAYMENT_CONFIRMED')).toBe('ACTIVE');
    expect(assertOrderTransition('ACTIVE', 'MARK_DELIVERED')).toBe('IN_REVIEW');
    expect(assertOrderTransition('IN_REVIEW', 'ACCEPT_DELIVERY')).toBe('COMPLETED');
  });

  it('allows ACTIVE -> COMPLETED directly (accept from active)', () => {
    expect(assertOrderTransition('ACTIVE', 'ACCEPT_DELIVERY')).toBe('COMPLETED');
  });

  it('allows revision loop IN_REVIEW -> ACTIVE', () => {
    expect(assertOrderTransition('IN_REVIEW', 'REQUEST_REVISION')).toBe('ACTIVE');
  });

  it('allows cancel + dispute where legal', () => {
    expect(assertOrderTransition('PENDING', 'CANCEL')).toBe('CANCELLED');
    expect(assertOrderTransition('ACTIVE', 'CANCEL')).toBe('CANCELLED');
    expect(assertOrderTransition('ACTIVE', 'RAISE_DISPUTE')).toBe('DISPUTED');
    expect(assertOrderTransition('IN_REVIEW', 'RAISE_DISPUTE')).toBe('DISPUTED');
    expect(assertOrderTransition('DELIVERED', 'RAISE_DISPUTE')).toBe('DISPUTED');
  });

  it('rejects illegal transitions with a helpful message', () => {
    expect(() => assertOrderTransition('PENDING', 'MARK_DELIVERED')).toThrow();
    expect(() => assertOrderTransition('COMPLETED', 'CANCEL')).toThrow(/Illegal order transition/);
    expect(() => assertOrderTransition('COMPLETED', 'ACCEPT_DELIVERY')).toThrow();
    expect(() => assertOrderTransition('DELIVERED', 'MARK_DELIVERED')).toThrow();
  });

  it('terminal states accept no further transitions', () => {
    expect(isOrderTerminal('COMPLETED')).toBe(true);
    expect(isOrderTerminal('CANCELLED')).toBe(true);
    expect(isOrderTerminal('DISPUTED')).toBe(true);
    expect(isOrderTerminal('ACTIVE')).toBe(false);
  });

  it('the whole transition map is acyclic and references valid states/actions', () => {
    const states = Object.keys(ORDER_TRANSITIONS) as OrderState[];
    const validActions = [
      'PAYMENT_CONFIRMED', 'MARK_DELIVERED', 'ACCEPT_DELIVERY',
      'REQUEST_REVISION', 'CANCEL', 'RAISE_DISPUTE', 'ADMIN_REFUND',
    ];
    for (const from of states) {
      for (const [action, to] of Object.entries(ORDER_TRANSITIONS[from])) {
        expect(states).toContain(to);
        expect(validActions).toContain(action);
        expect(to).not.toBe(from); // no self-loops
      }
    }
  });
});

describe('money split (shared domain)', () => {
  it('splits a gross amount with a 10% default fee', () => {
    expect(computeOrderSplit(1000)).toEqual({ grossEtb: 1000, feeEtb: 100, sellerNetEtb: 900 });
  });

  it('rounds the fee to whole ETB and keeps sellerNet exact', () => {
    const split = computeOrderSplit(505);
    expect(split.feeEtb).toBe(51);
    expect(split.sellerNetEtb).toBe(505 - 51);
  });

  it('supports an overridden fee percent', () => {
    expect(computeOrderSplit(1000, 15).feeEtb).toBe(150);
  });

  it('validates gig price bounds', () => {
    expect(isValidGigPrice(100)).toBe(true);
    expect(isValidGigPrice(499_999)).toBe(true);
    expect(isValidGigPrice(99)).toBe(false);
    expect(isValidGigPrice(500_001)).toBe(false);
    expect(isValidGigPrice(100.5)).toBe(false);
  });
});
