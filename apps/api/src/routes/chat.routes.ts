import { Router } from 'express';
import {
  listMessagesQuerySchema,
  sendMessageSchema,
  startConversationSchema,
  createChatGroupSchema,
  toggleReactionSchema,
  groupMembersSchema,
  updateChatGroupSchema,
  editMessageSchema,
  muteConversationSchema,
  pinMessageSchema,
  forwardMessageSchema,
  searchMessagesQuerySchema,
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

/** GET /conversations/saved — the user's personal "Saved Messages" chat. */
router.get(
  '/saved',
  asyncHandler(async (req, res) => {
    return success(res, await chat.getSavedMessages(req.user!.sub));
  }),
);

/** GET /conversations/:id — full detail (members, unread, group flag). */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await chat.getConversation(id, req.user!.sub));
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

/** POST /conversations/group — create a group room. */
router.post(
  '/group',
  validate(createChatGroupSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@apex-work/shared').CreateChatGroupInput;
    const conv = await chat.createGroup({
      ownerId: req.user!.sub,
      title: body.title,
      memberIds: body.memberIds,
      avatarUrl: body.avatarUrl,
    });
    const io = getIo();
    if (io) for (const m of conv.members) io.to(`user:${m.userId}`).emit('conversation:new', conv);
    return success(res, conv, 201);
  }),
);

/** PATCH /conversations/:id — rename a group / set avatar. */
router.patch(
  '/:id',
  validate(updateChatGroupSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').UpdateChatGroupInput;
    const conv = await chat.updateGroup(id, req.user!.sub, body);
    const io = getIo();
    if (io) io.to(`conv:${id}`).emit('conversation:updated', conv);
    return success(res, conv);
  }),
);

/** POST /conversations/:id/members — add members to a group (admin). */
router.post(
  '/:id/members',
  validate(groupMembersSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').GroupMembersInput;
    const conv = await chat.addGroupMembers(id, req.user!.sub, body.memberIds);
    const io = getIo();
    if (io) for (const m of conv.members) io.to(`user:${m.userId}`).emit('conversation:new', conv);
    return success(res, conv);
  }),
);

/** DELETE /conversations/:id/members/:userId — leave/remove a group member. */
router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const result = await chat.removeGroupMember(id, req.user!.sub, userId);
    const io = getIo();
    if (io) { io.to(`conv:${id}`).emit('conversation:updated', result); io.to(`user:${userId}`).emit('conversation:left', { conversationId: id }); }
    return success(res, result);
  }),
);

/** POST /conversations/:id/messages/:messageId/reaction — toggle an emoji. */
router.post(
  '/:id/messages/:messageId/reaction',
  validate(toggleReactionSchema),
  asyncHandler(async (req, res) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const body = req.body as import('@apex-work/shared').ToggleReactionInput;
    const result = await chat.toggleReaction(id, messageId, req.user!.sub, body.emoji);
    const io = getIo();
    if (io) io.to(`conv:${id}`).emit('message:reaction', { conversationId: id, messageId, userId: req.user!.sub, emoji: body.emoji, added: result.added });
    return success(res, result);
  }),
);

/** PATCH /conversations/:id/messages/:messageId — edit our own message. */
router.patch(
  '/:id/messages/:messageId',
  validate(editMessageSchema),
  asyncHandler(async (req, res) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const body = req.body as import('@apex-work/shared').EditMessageInput;
    const message = await chat.editMessage(id, messageId, req.user!.sub, body.body);
    const io = getIo();
    if (io) io.to(`conv:${id}`).emit('message:edit', { conversationId: id, message });
    return success(res, message);
  }),
);

/** DELETE /conversations/:id/messages/:messageId — soft delete our own message. */
router.delete(
  '/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const message = await chat.deleteMessage(id, messageId, req.user!.sub);
    const io = getIo();
    if (io) io.to(`conv:${id}`).emit('message:delete', { conversationId: id, message });
    return success(res, message);
  }),
);

/** POST /conversations/:id/messages/:messageId/forward — forward into another chat. */
router.post(
  '/:id/messages/:messageId/forward',
  validate(forwardMessageSchema),
  asyncHandler(async (req, res) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const body = req.body as import('@apex-work/shared').ForwardMessageInput;
    const message = await chat.forwardMessage(id, messageId, req.user!.sub, body.targetConversationId);
    const io = getIo();
    if (io) io.to(`conv:${body.targetConversationId}`).emit('message:new', message);
    return success(res, message, 201);
  }),
);

/** PATCH /conversations/:id/messages/:messageId/pin — pin / unpin. */
router.patch(
  '/:id/messages/:messageId/pin',
  validate(pinMessageSchema),
  asyncHandler(async (req, res) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const body = req.body as import('@apex-work/shared').PinMessageInput;
    const message = await chat.setPinned(id, messageId, req.user!.sub, body.pinned);
    const io = getIo();
    if (io) io.to(`conv:${id}`).emit('message:pin', { conversationId: id, message });
    return success(res, message);
  }),
);

/** GET /conversations/:id/messages/search?q=… — search within the conversation. */
router.get(
  '/:id/messages/search',
  validate(searchMessagesQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const q = (req.query as { q?: string }).q ?? '';
    return success(res, await chat.searchMessages(id, req.user!.sub, q));
  }),
);

/** POST /conversations/:id/mute — mute / unmute for me. */
router.post(
  '/:id/mute',
  validate(muteConversationSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as import('@apex-work/shared').MuteConversationInput;
    return success(res, await chat.setConversationMuted(id, req.user!.sub, body.muted));
  }),
);

/** POST /conversations/:id/unread — mark as unread. */
router.post(
  '/:id/unread',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    return success(res, await chat.markUnread(id, req.user!.sub));
  }),
);

export default router;
