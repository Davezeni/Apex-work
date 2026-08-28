'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface PaymentConfig {
  enabled: boolean;
  publicKey: string | null;
}

/** Public payment status used to disable checkout gracefully when Chapa is unavailable. */
export function usePaymentConfig() {
  return useQuery<PaymentConfig>({
    queryKey: ['payment-config'],
    queryFn: () => apiFetch('/payments/config'),
    staleTime: 60_000,
    retry: 1,
  });
}
