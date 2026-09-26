const express = require('express');
const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const Registration = require('../models/Registration');
const { requireUser } = require('../middleware/user');
const { HttpError } = require('../middleware/errors');
const { lifecycleState } = require('../utils/competitionState');
const { releaseExpiredHolds } = require('../utils/expireHolds');
const { loadConfig } = require('../config/env');

const router = express.Router();
router.use(requireUser);

router.post('/:slug/register', async (req, res) => {
  const competition = await Competition.findOne({ slug: req.params.slug.toLowerCase(), published: true });
  if (!competition) throw new HttpError(404, 'Competition not found.', 'COMPETITION_NOT_FOUND');
  await releaseExpiredHolds(competition._id);
  const existing = await Registration.findOne({ competition: competition._id, userId: req.user.id });
  if (existing && ['registered', 'pending_payment'].includes(existing.status)) {
    return res.status(200).json({ data: existing, message: 'Registration already exists.' });
  }
  const now = new Date();
  if (lifecycleState(competition, now) !== 'registration_open') throw new HttpError(409, 'Registration is closed.', 'REGISTRATION_CLOSED');

  const holdExpiresAt = new Date(now.getTime() + loadConfig().paymentHoldMinutes * 60_000);
  // Single-document conditional update is atomic: concurrent requests cannot overbook.
  const reserved = await Competition.updateOne({ _id: competition._id, published: true, bookedCount: { $lt: competition.maxParticipants }, 'dates.registrationClosesAt': { $gt: now } }, { $inc: { bookedCount: 1 } });
  if (reserved.modifiedCount !== 1) throw new HttpError(409, 'All participation spots are booked or registration has closed.', 'SPOTS_UNAVAILABLE');
  let registration;
  try {
    if (existing?.status === 'payment_expired') {
      registration = await Registration.findOneAndUpdate({ _id: existing._id, status: 'payment_expired' }, { $set: { status: 'pending_payment', paymentStatus: 'pending', paymentReference: null, amount: competition.entryFee, currency: competition.currency, holdExpiresAt } }, { new: true });
      if (!registration) throw new HttpError(409, 'Registration changed while reserving a spot. Please retry.', 'REGISTRATION_CHANGED');
    } else {
      registration = await Registration.create({ competition: competition._id, userId: req.user.id, amount: competition.entryFee, currency: competition.currency, holdExpiresAt });
    }
  } catch (error) {
    // A simultaneous duplicate request may have won the unique index after the initial read.
    await Competition.updateOne({ _id: competition._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    throw error;
  }
  return res.status(201).json({ data: registration, message: 'Spot reserved. Complete payment before the hold expires.' });
});

router.post('/:slug/payments/:registrationId/confirm', async (req, res) => {
  if (process.env.NODE_ENV === 'production') throw new HttpError(404, 'Not found.', 'NOT_FOUND');
  if (!mongoose.isValidObjectId(req.params.registrationId)) throw new HttpError(400, 'Invalid registration id.', 'INVALID_REQUEST');
  const competition = await Competition.findOne({ slug: req.params.slug.toLowerCase() });
  if (!competition) throw new HttpError(404, 'Competition not found.', 'COMPETITION_NOT_FOUND');
  const alreadyPaid = await Registration.findOne({ _id: req.params.registrationId, competition: competition._id, userId: req.user.id, status: 'registered', paymentStatus: 'paid' });
  if (alreadyPaid) return res.json({ data: alreadyPaid, message: 'Payment was already confirmed.' });
  const registration = await Registration.findOneAndUpdate({ _id: req.params.registrationId, competition: competition._id, userId: req.user.id, status: 'pending_payment', paymentStatus: 'pending', holdExpiresAt: { $gt: new Date() } }, { $set: { status: 'registered', paymentStatus: 'paid', paymentReference: `demo_${req.params.registrationId}`, holdExpiresAt: null } }, { new: true });
  if (!registration) throw new HttpError(409, 'Payment hold expired or registration is no longer payable.', 'PAYMENT_HOLD_EXPIRED');
  return res.json({ data: registration, message: 'Payment confirmed in demo mode.' });
});

router.post('/:slug/submission', async (req, res) => {
  const { url } = req.body || {};
  if (typeof url !== 'string' || url.length > 2048 || !/^https?:\/\//i.test(url)) throw new HttpError(400, 'A valid http(s) submission URL is required.', 'INVALID_SUBMISSION');
  const competition = await Competition.findOne({ slug: req.params.slug.toLowerCase(), published: true });
  if (!competition) throw new HttpError(404, 'Competition not found.', 'COMPETITION_NOT_FOUND');
  const now = new Date();
  if (now < competition.dates.submissionStartsAt || now > competition.dates.submissionEndsAt) throw new HttpError(409, 'Submissions are not open.', 'SUBMISSION_CLOSED');
  const registration = await Registration.findOneAndUpdate({ competition: competition._id, userId: req.user.id, status: 'registered', 'submission.status': 'not_submitted' }, { $set: { 'submission.url': url, 'submission.status': 'submitted', submittedAt: now } }, { new: true });
  if (!registration) throw new HttpError(409, 'A paid registration is required and submissions can only be sent once.', 'SUBMISSION_NOT_ALLOWED');
  return res.status(201).json({ data: registration });
});

module.exports = router;
