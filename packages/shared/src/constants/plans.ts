export const PRO_PLANS = [
  {
    id: 'FREELANCER_PRO',
    name: 'Freelancer Pro',
    priceEtb: 199,
    audience: 'Freelancers',
    features: [
      'Advanced AI tools',
      'Profile analytics',
      'Priority recommendations',
      'More portfolio visibility',
    ],
  },
  {
    id: 'CLIENT_PRO',
    name: 'Client Pro',
    priceEtb: 149,
    audience: 'Clients',
    features: ['Shortlists', 'Hiring insights', 'Priority support', 'Reusable job briefs'],
  },
] as const;

export type ProPlanId = (typeof PRO_PLANS)[number]['id'];
