const Competition = require('../models/Competition');
const Registration = require('../models/Registration');

async function releaseExpiredHolds(competitionId) {
  const now = new Date();
  const expired = await Registration.find({ competition: competitionId, status: 'pending_payment', holdExpiresAt: { $lte: now } }).select('_id').limit(100).lean();
  for (const item of expired) {
    const released = await Registration.findOneAndUpdate({ _id: item._id, status: 'pending_payment', holdExpiresAt: { $lte: now } }, { $set: { status: 'payment_expired', paymentStatus: 'failed', holdExpiresAt: null } });
    if (released) await Competition.updateOne({ _id: competitionId, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
  }
}

module.exports = { releaseExpiredHolds };
