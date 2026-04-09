const express = require('express');
const axios   = require('axios');
const app     = express();
 
app.use(express.json());
 
// ─── SMS message templates per shipment status ───────────────────────
function getMessage(status, awb, name) {
  const s = (status || '').toLowerCase();
  if (s.includes('pickup') || s.includes('picked'))
    return `Hi ${name}, your order has been picked up! AWB: ${awb}. Track at shiprocket.in`;
  if (s.includes('transit') || s.includes('in-transit'))
    return `Hi ${name}, your order is on its way! Track using AWB: ${awb}`;
  if (s.includes('out for delivery') || s.includes('out-for-delivery'))
    return `Hi ${name}, your order will be delivered TODAY! AWB: ${awb}`;
  if (s.includes('delivered'))
    return `Hi ${name}, your order has been delivered successfully! Thank you for shopping with us.`;
  if (s.includes('rto') || s.includes('return'))
    return `Hi ${name}, we could not deliver your order (AWB: ${awb}). Our team will contact you shortly.`;
  return `Update on your order (AWB: ${awb}): ${status}`;
}
 
// ─── Fast2SMS API call ───────────────────────────────────────────────
async function sendSMS(phone, message) {
  try {
    const res = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: process.env.FAST2SMS_API_KEY,
        message:       message,
        language:      'english',
        route:         'q',
        numbers:       phone,
      }
    });
    console.log('[SMS SENT]', phone, '|', res.data.message);
  } catch (err) {
    console.error('[SMS ERROR]', err.message);
  }
}
 
// ─── Webhook endpoint ────────────────────────────────────────────────
app.post('/webhook/shiprocket', async (req, res) => {
  const data = req.body;
  console.log('[WEBHOOK RECEIVED]', JSON.stringify(data));
 
  const status = data.current_status || data.status || '';
  const awb    = data.awb_code || data.awb || 'N/A';
  const phone  = data.customer_phone || data.phone || '';
  const name   = data.customer_name  || data.name  || 'Customer';
 
  if (!phone) {
    console.warn('[WARNING] No phone number in webhook payload');
    return res.status(400).json({ error: 'No phone number provided' });
  }
 
  const message = getMessage(status, awb, name);
  await sendSMS(phone, message);
 
  res.status(200).json({ success: true, message: 'SMS triggered' });
});
 
// ─── Health check (to verify server is running) ──────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
