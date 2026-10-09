/**
 * supportTools.js
 * Programmatic internal tools for support ticket lifecycle, customer messaging,
 * and escalation to human support representatives.
 */

import db from '../../config/db.js';
import auditLogger from '../../services/auditLogger.js';

export const supportTools = {
  /**
   * Create a new support ticket.
   */
  async createTicket({ subject, category = 'general', priority = 'normal', initialMessage = '' } = {}, context = {}) {
    const userId = context.userId;
    if (!userId) {
      throw new Error('Authentication required to create a support ticket.');
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      throw new Error('Ticket subject is required.');
    }

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const safePriority = validPriorities.includes(priority) ? priority : 'normal';

    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const createTx = db.transaction(() => {
      const convResult = db.prepare(`
        INSERT INTO support_conversations (
          ticket_number, user_id, subject, category, priority, status, assigned_agent
        ) VALUES (?, ?, ?, ?, ?, 'open', ?)
      `).run(
        ticketNumber,
        userId,
        subject.trim(),
        category.trim(),
        safePriority,
        context.agentName || 'CustomerSupportAgent'
      );

      const conversationId = convResult.lastInsertRowid;

      if (initialMessage && initialMessage.trim().length > 0) {
        db.prepare(`
          INSERT INTO support_messages (
            conversation_id, sender_type, sender_id, message
          ) VALUES (?, 'customer', ?, ?)
        `).run(conversationId, String(userId), initialMessage.trim());
      }

      return { conversationId };
    });

    const { conversationId } = createTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : 'customer',
        actorId: String(userId),
        action: 'SUPPORT_TICKET_CREATED',
        entityType: 'SUPPORT_TICKET',
        entityId: ticketNumber,
        agentName: context.agentName || null,
        metadata: { conversationId, subject, category }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      ticketNumber,
      conversationId,
      subject: subject.trim(),
      category,
      priority: safePriority,
      status: 'open',
      message: `Support ticket ${ticketNumber} created successfully.`
    };
  },

  /**
   * Retrieve ticket details and threaded conversation messages.
   */
  async getTicket({ ticketNumber, conversationId } = {}, context = {}) {
    if (!ticketNumber && !conversationId) {
      throw new Error('Either ticketNumber or conversationId must be provided.');
    }

    const conversation = db.prepare(`
      SELECT c.*, u.name as customer_name, u.email as customer_email
      FROM support_conversations c
      JOIN users u ON c.user_id = u.id
      WHERE c.ticket_number = ? OR c.id = ?
    `).get(ticketNumber || null, conversationId || null);

    if (!conversation) {
      throw new Error('Support ticket not found.');
    }

    const isOwner = context.userId && conversation.user_id === context.userId;
    const isAdmin = context.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to view this support ticket.');
    }

    const messages = db.prepare(`
      SELECT id, sender_type, sender_id, message, created_at
      FROM support_messages
      WHERE conversation_id = ?
      ORDER BY id ASC
    `).all(conversation.id);

    return {
      conversationId: conversation.id,
      ticketNumber: conversation.ticket_number,
      userId: conversation.user_id,
      customerName: conversation.customer_name,
      customerEmail: conversation.customer_email,
      subject: conversation.subject,
      category: conversation.category,
      status: conversation.status,
      priority: conversation.priority,
      assignedAgent: conversation.assigned_agent,
      escalatedToHuman: Boolean(conversation.escalated_to_human),
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages
    };
  },

  /**
   * Add a message to an existing support ticket thread.
   */
  async addMessage({ ticketNumber, conversationId, message } = {}, context = {}) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Message content cannot be empty.');
    }

    const ticket = await supportTools.getTicket({ ticketNumber, conversationId }, context);

    let senderType = 'customer';
    if (context.role === 'admin') {
      senderType = 'admin';
    } else if (context.agentName) {
      senderType = 'agent';
    }

    const senderId = String(context.userId || context.agentName || 'system');

    db.prepare(`
      INSERT INTO support_messages (conversation_id, sender_type, sender_id, message)
      VALUES (?, ?, ?, ?)
    `).run(ticket.conversationId, senderType, senderId, message.trim());

    db.prepare(`
      UPDATE support_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(ticket.conversationId);

    return {
      success: true,
      ticketNumber: ticket.ticketNumber,
      conversationId: ticket.conversationId,
      senderType,
      senderId,
      message: message.trim()
    };
  },

  /**
   * Escalate conversation to human support staff.
   */
  async escalateToHuman({ ticketNumber, conversationId, reason = 'Customer requested human assistance' } = {}, context = {}) {
    const ticket = await supportTools.getTicket({ ticketNumber, conversationId }, context);

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE support_conversations
        SET escalated_to_human = 1, priority = 'high', status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(ticket.conversationId);

      db.prepare(`
        INSERT INTO support_messages (conversation_id, sender_type, sender_id, message)
        VALUES (?, 'system', 'system', ?)
      `).run(
        ticket.conversationId,
        `Ticket escalated to human customer support specialist. Reason: ${reason}`
      );
    });

    updateTx();

    try {
      auditLogger.log({
        actorType: context.role === 'admin' ? 'admin' : (context.agentName ? 'agent' : 'customer'),
        actorId: String(context.userId || 'support-agent'),
        action: 'SUPPORT_TICKET_ESCALATED',
        entityType: 'SUPPORT_TICKET',
        entityId: ticket.ticketNumber,
        agentName: context.agentName || null,
        metadata: { reason, conversationId: ticket.conversationId }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      ticketNumber: ticket.ticketNumber,
      conversationId: ticket.conversationId,
      escalatedToHuman: true,
      priority: 'high',
      status: 'in_progress',
      reason,
      message: `Ticket ${ticket.ticketNumber} has been escalated to human support. A representative will review it shortly.`
    };
  }
};

export default supportTools;
