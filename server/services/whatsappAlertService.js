// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — WhatsApp Alert Service (Client Quote Link Opened Notifications)
// Alert recipients are dynamically resolved per project (respective BH & Employee FA).
// Supports Meta WhatsApp Cloud API, Twilio, UltraMsg, CallMeBot, or Webhook URL.
// ═══════════════════════════════════════════════════════════════════════════════

function normalizePhoneIndia(raw) {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 10) return '91' + digits;
  return digits;
}

function getAlertRecipients(explicitRecipients) {
  const seen = new Set();
  const out = [];
  const pushUnique = (raw) => {
    const norm = normalizePhoneIndia(raw);
    if (norm && norm.length >= 10 && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  };
  if (Array.isArray(explicitRecipients)) {
    explicitRecipients.forEach(pushUnique);
  } else if (typeof explicitRecipients === 'string' && explicitRecipients.trim()) {
    explicitRecipients.split(',').forEach(pushUnique);
  }
  if (out.length) return out;

  const envList = String(process.env.WHATSAPP_ALERT_NUMBERS || '').trim();
  if (envList) {
    envList.split(',').forEach(pushUnique);
  }
  return out;
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
  const quoteUrl = info.quoteUrl || 'https://studio.orbixdesigns.com';

  return [
    '🔔 *Client Opened Quotation Link*',
    `👤 *Client Name:* ${clientName}`,
    `🏡 *Project Name:* ${projectName}`,
    `🆔 *Project ID:* ${projectId}`,
    `📄 *Quote Ref:* ${quoteCode}`,
    `🕒 *Opened At:* ${openedAt}`,
    '',
    `🔗 *Quotation Link:* ${quoteUrl}`,
    '',
    '📢 Action Required: The client has viewed the quotation. Please contact the client and follow up regarding the quotation.'
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

const DEFAULT_UTILITY_TEMPLATE = 'studio_quote_open_alert';
const LEGACY_5PARAM_TEMPLATE = 'orbix_quote_opened_alert';
let cachedTemplateCheck = { name: '', approved: false, language: 'en', checkedAt: 0 };

function getMetaCredentials() {
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || '').trim();
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '').trim();
  const wabaId = String(process.env.WHATSAPP_WABA_ID || process.env.WABA_ID || '').trim();
  return { phoneNumberId, token, wabaId };
}

async function resolveApprovedTemplate() {
  const explicitName = String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const targetName = explicitName || DEFAULT_UTILITY_TEMPLATE;
  const explicitLang = String(process.env.WHATSAPP_TEMPLATE_LANG || '').trim();
  if (explicitName && explicitLang) {
    return { name: explicitName, language: explicitLang, approved: true };
  }
  const { token, wabaId } = getMetaCredentials();
  if (!token || !wabaId) {
    return { name: targetName, language: explicitLang || 'en', approved: Boolean(explicitName) };
  }

  const now = Date.now();
  const ttl = cachedTemplateCheck.approved ? 15 * 60 * 1000 : 60 * 1000;
  if (cachedTemplateCheck.name === targetName && (now - cachedTemplateCheck.checkedAt) < ttl) {
    return cachedTemplateCheck;
  }
  try {
    const apiVer = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
    const url = `https://graph.facebook.com/${apiVer}/${encodeURIComponent(wabaId)}/message_templates?name=${encodeURIComponent(targetName)}&fields=name,status,language`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json();
      const match = (json.data || []).find((t) => t.name === targetName && t.status === 'APPROVED');
      if (match) {
        cachedTemplateCheck = {
          name: targetName,
          approved: true,
          language: explicitLang || match.language || 'en',
          checkedAt: now
        };
        return cachedTemplateCheck;
      }
    }
  } catch (_) {}
  cachedTemplateCheck = {
    name: targetName,
    approved: Boolean(explicitName),
    language: explicitLang || 'en',
    checkedAt: now
  };
  return cachedTemplateCheck;
}

function cleanParam(val, fallback, maxLen) {
  const s = String(val || fallback || '-').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (s || fallback || '-').slice(0, maxLen || 120);
}

async function sendViaMetaCloud(phone, message, meta) {
  const { phoneNumberId, token } = getMetaCredentials();
  const apiVer = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
  const url = `https://graph.facebook.com/${apiVer}/${encodeURIComponent(phoneNumberId)}/messages`;
  const tpl = await resolveApprovedTemplate();

  let payload;
  if (tpl && tpl.approved && process.env.WHATSAPP_USE_TEXT !== 'true') {
    const m = meta || {};
    let components;
    if (tpl.name === 'hello_world') {
      components = [];
    } else if (tpl.name === 'studio_quote_open_alert') {
      components = [{
        type: 'body',
        parameters: [
          { type: 'text', text: cleanParam(m.clientName, 'Valued Client') },
          { type: 'text', text: cleanParam(m.projectName || m.title, 'Interior Project') },
          { type: 'text', text: cleanParam(m.projectId, '-') },
          { type: 'text', text: cleanParam(m.quoteCode, '-') },
          { type: 'text', text: cleanParam(m.openedAt, formatIstNow()) },
          { type: 'text', text: cleanParam(m.quoteUrl, 'https://studio.orbixdesigns.com', 300) }
        ]
      }];
    } else if (tpl.name === LEGACY_5PARAM_TEMPLATE) {
      components = [{
        type: 'body',
        parameters: [
          { type: 'text', text: cleanParam(m.clientName, 'Valued Client') },
          { type: 'text', text: cleanParam(m.projectName || m.title, 'Interior Project') },
          { type: 'text', text: cleanParam(m.projectId, '-') },
          { type: 'text', text: cleanParam(m.quoteCode, '-') },
          { type: 'text', text: cleanParam(m.openedAt, formatIstNow()) }
        ]
      }];
    } else {
      components = [{ type: 'body', parameters: [{ type: 'text', text: cleanParam(message, 'Client opened quote') }] }];
    }

    payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: tpl.name,
        language: { code: tpl.language || 'en' },
        components
      }
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body: message }
    };
  }
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
  const recipients = getAlertRecipients(info && info.recipients);
  const openedAt = info.openedAt || formatIstNow();
  const meta = Object.assign({}, info, { openedAt });
  const message = buildQuoteOpenedMessage(meta);
  const provider = detectActiveProvider();

  if (!recipients.length) {
    console.warn(`[WhatsAppAlert] Skipped for client "${meta.clientName || ''}" (${meta.projectId || '-'}): no phone numbers found for project BH or employee.`);
    return { provider, recipients: [], results: [], message };
  }

  const results = [];
  for (const phone of recipients) {
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    if (provider === 'none') {
      results.push({ phone, provider: 'unconfigured', sent: false, waUrl });
      continue;
    }
    try {
      let resp = null;
      if (provider === 'meta') resp = await sendViaMetaCloud(phone, message, meta);
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
    results.filter((r) => !r.sent).forEach((r) => {
      console.error(`[WhatsAppAlert] Delivery FAILED -> ${r.phone} (HTTP ${r.status || 0}): ${r.error || r.detail || 'Unknown error'}`);
    });
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
  normalizePhoneIndia,
  getAlertRecipients,
  buildQuoteOpenedMessage,
  detectActiveProvider,
  sendClientOpenedAlert
};
