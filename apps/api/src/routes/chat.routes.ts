import { Router } from 'express';
import {
  listMessagesQuerySchema,
  sendMessageSchema,
  startConversationSchema,
} from '@apex-work/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { success } from '../lib/response.js';
import * as chat from '../services/chat.service.js';
import { getIo } from '../realtime/socket.js';

const router: Router = Router();

router.use(requireAuth);

/** GET /conversations — list all conversations for the current user. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await chat.listConversations(req.user!.sub);
    return success(res, { items });
  }),
);

/** POST /conversations — start (or get) a 1-to-1 with another user. */
router.post(
  '/',
  validate(startConversationSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').StartConversationInput;
    const conv = await chat.getOrCreateDirectConversation(req.user!.sub, body.peerUserId);
    return success(res, conv);
  }),
);

/** GET /conversations/:id/messages — paginated newest-first, but returned oldest→newest. */
router.get(
  '/:id/messages',
  validate(listMessagesQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const q = req.query as unknown as import('@apex-work/shared').ListMessagesQuery;
    const result = await chat.listMessages(id, req.user!.sub, {
      cursor: q.cursor,
      limit: q.limit,
    });
    return success(res, result);
  }),
);

/** POST /conversations/:id/messages — send a message. Also emits via Socket.io. */
router.post(
  '/:id/messages',
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').SendMessageInput;
    const senderId = req.user!.sub;

    const message = await chat.sendMessage({
      conversationId: id,
      senderId,
      body: body.body,
      attachmentUrl: body.attachmentUrl,
      attachmentType: body.attachmentType,
      attachmentMeta: body.attachmentMeta,
      replyToId: body.replyToId,
    });

    // Fire-and-forget realtime broadcast; never block the HTTP response on it.
    const io = getIo();
    if (io) {
      io.to(`conv:${id}`).emit('message:new', message);
    }

    return success(res, message, 201);
  }),
);

/** POST /conversations/:id/read — mark conversation as read. */
router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await chat.markAsRead(id, req.user!.sub);
    return success(res, { ok: true });
  }),
);

export default router;
