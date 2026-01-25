/**
 * Simple notification service for admin alerts
 * Supports webhook-based notifications (Telegram, Discord, Slack, etc.)
 */

interface NotifyOptions {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  data?: Record<string, unknown>
}

const WEBHOOK_URL = process.env.ADMIN_NOTIFY_WEBHOOK_URL

/**
 * Send notification to admin via webhook
 */
export async function notifyAdmin(options: NotifyOptions): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.log('[NOTIFY] No webhook configured, logging only:', options)
    return false
  }

  try {
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    }[options.type || 'info']

    // Format for Telegram Bot API
    if (WEBHOOK_URL.includes('api.telegram.org')) {
      const text = `${emoji} *${options.title}*\n\n${options.message}${
        options.data ? `\n\n\`\`\`json\n${JSON.stringify(options.data, null, 2)}\n\`\`\`` : ''
      }`

      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          parse_mode: 'Markdown',
        }),
      })
      return true
    }

    // Format for Discord webhook
    if (WEBHOOK_URL.includes('discord.com/api/webhooks')) {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${emoji} **${options.title}**\n${options.message}`,
          embeds: options.data ? [{
            title: 'Details',
            description: `\`\`\`json\n${JSON.stringify(options.data, null, 2)}\n\`\`\``,
          }] : undefined,
        }),
      })
      return true
    }

    // Generic webhook (send JSON payload)
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: options.type || 'info',
        title: options.title,
        message: options.message,
        data: options.data,
        timestamp: new Date().toISOString(),
      }),
    })
    return true
  } catch (error) {
    console.error('[NOTIFY] Failed to send notification:', error)
    return false
  }
}

/**
 * Notify admin about new print order
 */
export async function notifyNewPrintOrder(order: {
  printOrderId: string
  orderId: string
  productType: string
  customerName: string
  customerPhone: string
  price: number
  spiritName: string
}) {
  return notifyAdmin({
    title: '🛒 New Print Order',
    message: `${order.customerName} ordered a ${order.productType} for ฿${order.price}`,
    type: 'success',
    data: {
      printOrderId: order.printOrderId,
      spiritName: order.spiritName,
      phone: order.customerPhone,
    },
  })
}
