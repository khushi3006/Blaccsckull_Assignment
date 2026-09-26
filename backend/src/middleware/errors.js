class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error?.code === 11000) {
    return res.status(409).json({ error: { code: 'ALREADY_REGISTERED', message: 'You already have a registration for this competition.' } });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The request contains invalid data.' } });
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message: status >= 500 ? 'An unexpected server error occurred.' : error.message } });
}

module.exports = { HttpError, errorHandler };
