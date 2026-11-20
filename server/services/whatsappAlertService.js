// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — WhatsApp Alert Service (Client Quote Link Opened Notifications)
// Default alert recipients: 8838199428 & 7418414780 (+91)
// Supports Meta WhatsApp Cloud API, Twilio, UltraMsg, CallMeBot, or Webhook URL.
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_ALERT_RECIPIENTS = ['918838199428', '917418414780'];

function normalizePhoneIndia(raw) {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function getAlertRecipients() {
  const envList = String(process.env.WHATSAPP_ALERT_NUMBERS || '').trim();
  if (!envList) return DEFAULT_ALERT_RECIPIENTS.slice();
  const parsed = envList.split(',').map(normalizePhoneIndia).filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALERT_RECIPIENTS.slice();
}

function formatIstNow() {
  try {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  } catch (_) {
    return new Date().toISOString();
  }
}

function buildQuoteOpenedMessage(info) {
  const clientName = info.clientName || 'Valued Client';
  const projectName = info.projectName || info.title || 'Interior Project';
  const projectId = info.projectId || '-';
  const quoteCode = info.quoteCode || '-';
  const openedAt = info.openedAt || formatIstNow();

  return [
    '🔔 *Client Opened Quotation Link*',
    `• *Client Name:* ${clientName}`,
    `• *Project Name:* ${projectName}`,
    `• *Project ID:* ${projectId}`,
    `• *Quote Ref:* ${quoteCode}`,
    `• *Opened At:* ${openedAt}`,
    '',
    `${clientName} opened the quotation link now. Please contact them.`
  ].join('\n');
}

async function postJson(url, body, headers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify(body)
  });
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
}

function getMetaCredentials() {
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || '').trim();
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '').trim();
  const wabaId = String(process.env.WHATSAPP_WABA_ID || process.env.WABA_ID || '').trim();
  return { phoneNumberId, token, wabaId };
}

async function sendViaMetaCloud(phone, message) {
  const { phoneNumberId, token } = getMetaCredentials();
  const apiVer = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${apiVer}/${encodeURIComponent(phoneNumberId)}/messages`;
  const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const payload = templateName
    ? {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: templateName === 'hello_world'
            ? []
            : [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 900) }] }]
        }
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: false, body: message }
      };
  return postJson(url, payload, { Authorization: `Bearer ${token}` });
}

async function sendViaTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const form = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: `whatsapp:+${phone}`,
    Body: message
  });
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
}

async function sendViaUltraMsg(phone, message) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  const url = `https://api.ultramsg.com/${encodeURIComponent(instanceId)}/messages/chat`;
  return postJson(url, { token, to: `+${phone}`, body: message });
}

async function sendViaWebhook(phone, message, meta) {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  const headers = {};
  if (process.env.WHATSAPP_API_KEY) {
    headers.Authorization = `Bearer ${process.env.WHATSAPP_API_KEY}`;
    headers['x-api-key'] = process.env.WHATSAPP_API_KEY;
  }
  return postJson(url, {
    to: phone,
    phone,
    message,
    clientName: meta.clientName || '',
    projectName: meta.projectName || '',
    projectId: meta.projectId || '',
    quoteCode: meta.quoteCode || '',
    openedAt: meta.openedAt || ''
  }, headers);
}

async function sendViaCallMeBot(phone, message) {
  const short10 = phone.slice(-10);
  const key = process.env[`CALLMEBOT_APIKEY_${short10}`] || process.env[`CALLMEBOT_APIKEY_${phone}`] || '';
  if (!key) return null;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body: text.slice(0, 200) };
}

function detectActiveProvider() {
  const explicit = String(process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
  if (explicit) return explicit;
  const meta = getMetaCredentials();
  if (meta.phoneNumberId && meta.token) return 'meta';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) return 'twilio';
  if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) return 'ultramsg';
  if (process.env.WHATSAPP_WEBHOOK_URL) return 'webhook';
  const anyCmb = getAlertRecipients().some((p) => process.env[`CALLMEBOT_APIKEY_${p.slice(-10)}`] || process.env[`CALLMEBOT_APIKEY_${p}`]);
  if (anyCmb) return 'callmebot';
  return 'none';
}

async function sendClientOpenedAlert(info) {
  const recipients = getAlertRecipients();
  const openedAt = info.openedAt || formatIstNow();
  const meta = Object.assign({}, info, { openedAt });
  const message = buildQuoteOpenedMessage(meta);
  const provider = detectActiveProvider();

  const results = [];
  for (const phone of recipients) {
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    if (provider === 'none') {
      results.push({ phone, provider: 'unconfigured', sent: false, waUrl });
      continue;
    }
    try {
      let resp = null;
      if (provider === 'meta') resp = await sendViaMetaCloud(phone, message);
      else if (provider === 'twilio') resp = await sendViaTwilio(phone, message);
      else if (provider === 'ultramsg') resp = await sendViaUltraMsg(phone, message);
      else if (provider === 'webhook') resp = await sendViaWebhook(phone, message, meta);
      else if (provider === 'callmebot') resp = await sendViaCallMeBot(phone, message);

      results.push({
        phone,
        provider,
        sent: Boolean(resp && resp.ok),
        status: resp ? resp.status : 0,
        detail: resp ? resp.body : 'No provider response',
        waUrl
      });
    } catch (err) {
      results.push({
        phone,
        provider,
        sent: false,
        error: err.message || 'Dispatch failed',
        waUrl
      });
    }
  }

  if (provider === 'none') {
    console.log(
      `[WhatsAppAlert] Queued/Logged alert for ${recipients.join(', ')} (configure WHATSAPP_PHONE_NUMBER_ID+WHATSAPP_ACCESS_TOKEN, ULTRAMSG_*, TWILIO_*, or WHATSAPP_WEBHOOK_URL in .env for live dispatch):\n${message}`
    );
  } else {
    const okCount = results.filter((r) => r.sent).length;
    console.log(`[WhatsAppAlert] Dispatched via ${provider}: ${okCount}/${recipients.length} delivered for client "${meta.clientName}" (${meta.projectId})`);
  }

  return {
    provider,
    recipients,
    message,
    openedAt,
    results
  };
}

module.exports = {
  DEFAULT_ALERT_RECIPIENTS,
  getAlertRecipients,
  buildQuoteOpenedMessage,
  detectActiveProvider,
  sendClientOpenedAlert
};
