import { Router } from 'express';
import { z } from 'zod';
import { createTicketSchema, addTicketMessageSchema, submitCsatSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as s from '../services/support.service.js';
import { prisma } from '../lib/prisma.js';

const router: Router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  return success(res, { items: await s.listMyTickets(req.user!.sub) });
}));

router.post('/', validate(createTicketSchema), asyncHandler(async (req, res) => {
  const body = req.body as import('@apex-work/shared').CreateTicketInput;
  return success(res, await s.createTicket(req.user!.sub, body), 201);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { role: true } });
  return success(res, await s.getTicket(id, req.user!.sub, me?.role === 'ADMIN'));
}));

router.post('/:id/messages', validate(addTicketMessageSchema), asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const body = req.body as import('@apex-work/shared').AddTicketMessageInput;
  const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { role: true } });
  const isStaff = me?.role === 'ADMIN';
  return success(res, await s.addMessage(id, req.user!.sub, body.body, isStaff), 201);
}));

const statusSchema = z.object({ status: z.enum(['OPEN', 'WAITING_USER', 'WAITING_STAFF', 'RESOLVED', 'CLOSED']) });
router.post('/:id/status', validate(statusSchema), asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const body = req.body as z.infer<typeof statusSchema>;
  const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { role: true } });
  return success(res, await s.setStatus(id, req.user!.sub, me?.role === 'ADMIN', body.status));
}));

/** POST /support/:id/csat — the ticket owner rates the support experience. */
router.post('/:id/csat', validate(submitCsatSchema), asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const body = req.body as import('@apex-work/shared').SubmitCsatInput;
  return success(res, await s.submitCsat(id, req.user!.sub, body.rating, body.comment));
}));

export default router;
