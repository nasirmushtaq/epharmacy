const util = require('util');

function safeStringify(obj, maxLen = 2000) {
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return str.length > maxLen ? str.slice(0, maxLen) + '…<truncated>' : str;
  } catch {
    try { return util.inspect(obj).slice(0, maxLen); } catch { return '<unserializable>' }
  }
}

module.exports = function requestLogger(req, res, next) {
  const t0 = Date.now();
  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.includes('multipart/form-data');
  const isBinary = contentType.startsWith('image/') || contentType.startsWith('application/octet-stream');
  const auth = req.headers['authorization'] || '';
  const tokenHint = auth.startsWith('Bearer ')
    ? `Bearer ${auth.slice(7, 14)}…`
    : (auth ? auth.slice(0, 7) + '…' : 'none');

  let bodyPreview = null;
  if (!isMultipart && !isBinary) {
    bodyPreview = safeStringify(req.body);
  } else {
    bodyPreview = `<${contentType}>`;
  }

  console.log(`[REQ] ${req.method} ${req.originalUrl} auth=${tokenHint} user=${req.user?._id || 'anon'} role=${req.user?.role || 'anon'} query=${safeStringify(req.query)} body=${bodyPreview}`);

  res.on('finish', () => {
    const dt = Date.now() - t0;
    console.log(`[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${dt}ms`);
  });

  next();
}; 