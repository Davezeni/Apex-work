/**
 * Order state machine (workflow DAG).
 *
 * Orders move through a deterministic, acyclic set of states. Rather than
 * scattering `if`/`else` status checks through the codebase, all legal
 * transitions live here as a single source of truth, so the API and the web
 * UI agree on what "moving an order" means and illegal moves are rejected
 * consistently.
 *
 *   PENDING ──pay──▶ ACTIVE ──deliver──▶ IN_REVIEW ──accept──▶ COMPLETED
 *      │              │  ▲                  │      ▲
 *      │              │  └──revision─────────┘  (accept can also go from ACTIVE)
 *      │              │
 *      └─cancel────────┴─cancel──────────▶ CANCELLED
 *
 *   ACTIVE / IN_REVIEW / DELIVERED ──dispute──▶ DISPUTED
 */

export const ORDER_STATES = [
  'PENDING',
  'ACTIVE',
  'IN_REVIEW',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

/** Human/lifecycle labels — terminal states can't transition again. */
export const ORDER_TERMINAL_STATES: readonly OrderState[] = ['COMPLETED', 'CANCELLED', 'DISPUTED'];

/**
 * Reason an order can be moved. Describes the user-facing action taken, so the
 * UI and the audit log share the same vocabulary.
 */
export const ORDER_ACTIONS = [
  'PAYMENT_CONFIRMED',
  'MARK_DELIVERED',
  'ACCEPT_DELIVERY',
  'REQUEST_REVISION',
  'CANCEL',
  'RAISE_DISPUTE',
  'ADMIN_REFUND',
] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

/**
 * Legal transition map: current state → { action → next state }.
 * The reverse is still a DAG (no cycles), so loops like IN_REVIEW↔ACTIVE via
 * revision are modelled as distinct actions, never a bare state toggle.
 */
export const ORDER_TRANSITIONS: Record<OrderState, Partial<Record<OrderAction, OrderState>>> = {
  PENDING: {
    PAYMENT_CONFIRMED: 'ACTIVE',
    CANCEL: 'CANCELLED',
  },
  ACTIVE: {
    MARK_DELIVERED: 'IN_REVIEW',
    ACCEPT_DELIVERY: 'COMPLETED',
    CANCEL: 'CANCELLED',
    RAISE_DISPUTE: 'DISPUTED',
  },
  IN_REVIEW: {
    ACCEPT_DELIVERY: 'COMPLETED',
    REQUEST_REVISION: 'ACTIVE',
    RAISE_DISPUTE: 'DISPUTED',
  },
  DELIVERED: {
    RAISE_DISPUTE: 'DISPUTED',
  },
  COMPLETED: {},
  CANCELLED: {},
  DISPUTED: {},
};

/**
 * Validate a transition. Returns the next state or throws an Error naming the
 * illegal move. Throwing (rather than returning null) keeps call sites terse
 * and populates the conflict message with the actual states involved.
 */
export function assertOrderTransition(
  from: OrderState,
  action: OrderAction,
  context?: { orderId?: string },
): OrderState {
  const allowed = ORDER_TRANSITIONS[from];
  const next = allowed ? allowed[action] : undefined;
  if (!next) {
    const suffix = context?.orderId ? ` (order ${context.orderId})` : '';
    throw new Error(
      `Illegal order transition: cannot ${action} from ${from}${suffix}`,
    );
  }
  return next;
}

/** Whether a state may accept further transitions. */
export function isOrderTerminal(state: OrderState): boolean {
  return ORDER_TERMINAL_STATES.includes(state);
}
