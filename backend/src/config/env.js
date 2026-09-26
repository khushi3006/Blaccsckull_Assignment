const required = ['MONGODB_URI'];

function loadConfig() {
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
  const holdMinutes = Number(process.env.PAYMENT_HOLD_MINUTES || 15);
  if (!Number.isInteger(holdMinutes) || holdMinutes < 1 || holdMinutes > 60) {
    throw new Error('PAYMENT_HOLD_MINUTES must be an integer between 1 and 60');
  }
  return {
    port: Number(process.env.PORT || 4000),
    mongoUri: process.env.MONGODB_URI,
    clientOrigin: process.env.CLIENT_ORIGIN || '*',
    nodeEnv: process.env.NODE_ENV || 'development',
    paymentHoldMinutes: holdMinutes
  };
}

module.exports = { loadConfig };
