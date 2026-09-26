const { HttpError } = require('./errors');

// Authentication is deliberately an adapter boundary for this assignment. Replace this
// header resolver with verified JWT/session middleware before exposing a real deployment.
function requireUser(req, res, next) {
  const userId = req.get('x-user-id')?.trim();
  if (!userId || userId.length > 128) return next(new HttpError(401, 'A valid x-user-id header is required.', 'UNAUTHENTICATED'));
  req.user = { id: userId };
  next();
}

module.exports = { requireUser };
