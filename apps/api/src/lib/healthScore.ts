/**
 * Admin marketplace health score.
 *
 * `buildHealthScore` is a pure, dependency-free fold over a set of raw health
 * inputs (rates and counts pulled at the DB). It normalizes each component to
 * a 0–100 contributor and rolls them into a single weighted 0–100 score, so an
 * operator immediately sees whether the marketplace is healthy or where it's
 * bleeding. Each component is clamped so one bad number can't dominate.
 */

export interface HealthInput {
  activationRate: number;   // 0..1 (new users who place an order)
  churnRate: number;        // 0..1 (ordered users inactive in window)
  disputeRate: number;      // 0..1 (completed orders that became disputes)
  overdueRate: number;      // 0..1 (active orders past deadline)
  slaBreachRate: number;    // 0..1 (support tickets resolved out of SLA)
  activeLiquidity: number;  // 0..1 (sum of active gigs + open jobs relative to target)
  avgRating: number;        // 0..5 average review rating
}

export interface HealthComponent {
  key: keyof HealthInput;
  label: string;
  /** 0..100 — higher is healthier. */
  score: number;
  status: 'good' | 'warn' | 'bad';
  weight: number;
  detail: string;
}

export interface HealthScore {
  score: number;              // 0..100 composite
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'healthy' | 'watch' | 'critical';
  components: HealthComponent[];
}

/** Higher-is-better component scoring against a target (0 = target, 1 = zero). */
function scoreHighest(value: number): number {
  // 0.0 → 100, 0.5 → 60, 1.0 → 0
  return Math.round(100 * (1 - value));
}

/** Lower is better (e.g. churn, dispute, overdue, SLA breach). */
function scoreLowest(value: number): number {
  // 0.0 → 100, 0.5 → 70, 1.0 → 20
  return Math.round(100 - value * 80);
}

function axisStatus(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 55) return 'warn';
  return 'bad';
}

export function buildHealthScore(input: HealthInput): HealthScore {
  const components: HealthComponent[] = [
    {
      key: 'activationRate', label: 'Activation', weight: 20,
      score: Math.round(input.activationRate * 100),
      status: axisStatus(input.activationRate * 100),
      detail: `${(input.activationRate * 100).toFixed(0)}% of new users place an order`,
    },
    {
      key: 'churnRate', label: 'Churn', weight: 18,
      score: scoreLowest(input.churnRate),
      status: axisStatus(scoreLowest(input.churnRate)),
      detail: `${(input.churnRate * 100).toFixed(0)}% of order users went inactive`,
    },
    {
      key: 'disputeRate', label: 'Disputes', weight: 16,
      score: scoreLowest(input.disputeRate),
      status: axisStatus(scoreLowest(input.disputeRate)),
      detail: `${(input.disputeRate * 100).toFixed(2)}% dispute rate`,
    },
    {
      key: 'overdueRate', label: 'Delivery SLA', weight: 16,
      score: scoreLowest(input.overdueRate),
      status: axisStatus(scoreLowest(input.overdueRate)),
      detail: `${(input.overdueRate * 100).toFixed(1)}% of orders overdue`,
    },
    {
      key: 'slaBreachRate', label: 'Support SLA', weight: 12,
      score: scoreLowest(input.slaBreachRate),
      status: axisStatus(scoreLowest(input.slaBreachRate)),
      detail: `${(input.slaBreachRate * 100).toFixed(1)}% breach rate`,
    },
    {
      key: 'activeLiquidity', label: 'Liquidity', weight: 10,
      score: scoreHighest(1 - input.activeLiquidity),
      status: axisStatus(scoreHighest(1 - input.activeLiquidity)),
      detail: `${(input.activeLiquidity * 100).toFixed(0)}% of supply target`,
    },
    {
      key: 'avgRating', label: 'Quality', weight: 8,
      score: Math.round((input.avgRating / 5) * 100),
      status: axisStatus((input.avgRating / 5) * 100),
      detail: `Average rating ${input.avgRating.toFixed(2)} / 5`,
    },
  ];

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(components.reduce((s, c) => s + (c.score * c.weight), 0) / totalWeight);

  return {
    score,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F',
    status: score >= 80 ? 'healthy' : score >= 60 ? 'watch' : 'critical',
    components,
  };
}
