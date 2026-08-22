import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().trim().min(4).max(140),
  category: z.enum(['billing', 'dispute', 'tech', 'general']).default('general'),
  body: z.string().trim().min(10).max(4000),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const addTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;
