import { Router } from 'express';
import { addReactionSchema } from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as reactions from '../services/reactions.service.js';
import { getIo } from '../realtime/socket.js';

const router: Router = Router();
router.use(requireAuth);

/** POST /messages/:id/reactions — toggle a reaction. */
router.post(
  '/:id/reactions',
  validate(addReactionSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').AddReactionInput;
    const result = await reactions.toggleReaction(id, req.user!.sub, body.emoji);

    // Realtime nudge — other conversation members can update their UI.
    const io = getIo();
    io?.to(`conv:${result.conversationId}`).emit('reaction:changed', {
      messageId: result.messageId,
      emoji: result.emoji,
      added: result.added,
      userId: req.user!.sub,
    });

    return success(res, result);
  }),
);

export default router;
