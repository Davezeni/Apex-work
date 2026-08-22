import { z } from 'zod';
import { MIN_WITHDRAWAL_ETB } from '../constants/index.js';

/**
 * Ethiopian payout destinations we support today. Expand as Chapa's B2C
 * coverage grows.
 */
export const withdrawalDestinationSchema = z.enum([
  'telebirr',
  'cbebirr',
  'cbe_bank',
  'awash_bank',
  'dashen_bank',
  'bank_of_abyssinia',
]);
export type WithdrawalDestination = z.infer<typeof withdrawalDestinationSchema>;

/** For phone-based rails (telebirr / cbebirr) we validate the number matches ET mobile format. */
const ETHIOPIAN_PHONE = /^\+251[79]\d{8}$/;

export const requestWithdrawalSchema = z
  .object({
    amountEtb: z
      .number()
      .int('Amount must be a whole number of Birr')
      .min(MIN_WITHDRAWAL_ETB, `Minimum withdrawal is ${MIN_WITHDRAWAL_ETB} ETB`)
      .max(1_000_000),
    destination: withdrawalDestinationSchema,
    /** Phone number for mobile-money rails, or account number for bank rails. */
    accountNumber: z.string().trim().min(4).max(40),
    /** For banks: the account holder's name (must match KYC). Optional for mobile. */
    accountName: z.string().trim().max(120).optional(),
  })
  .superRefine((v, ctx) => {
    const mobileRails: WithdrawalDestination[] = ['telebirr', 'cbebirr'];
    if (mobileRails.includes(v.destination)) {
      if (!ETHIOPIAN_PHONE.test(v.accountNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['accountNumber'],
          message: 'Enter a valid Ethiopian mobile number (+2519… or +2517…)',
        });
      }
    } else {
      // Bank rails: 6-20 digits, no other chars
      if (!/^\d{6,20}$/.test(v.accountNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['accountNumber'],
          message: 'Enter a valid bank account number (digits only)',
        });
      }
      if (!v.accountName || v.accountName.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['accountName'],
          message: 'Bank withdrawals require the account holder name',
        });
      }
    }
  });
export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
