const express = require('express');
const Competition = require('../models/Competition');
const Registration = require('../models/Registration');
const { requireUser } = require('../middleware/user');
const { HttpError } = require('../middleware/errors');
const { serializeCompetition, lifecycleState } = require('../utils/competitionState');
const { releaseExpiredHolds } = require('../utils/expireHolds');

const router = express.Router();

router.get('/', async (req, res) => {
  const ids = await Competition.find({ published: true }).select('_id').lean();
  await Promise.all(ids.map((item) => releaseExpiredHolds(item._id)));
  const competitions = await Competition.find({ published: true }).sort({ 'dates.registrationClosesAt': 1 }).lean();
  const now = new Date();
  res.json({ data: competitions.map((item) => ({ ...item, lifecycleState: lifecycleState(item, now), remainingSpots: Math.max(0, item.maxParticipants - item.bookedCount), serverTime: now.toISOString() })) });
});

router.get('/:slug', async (req, res) => {
  const competition = await Competition.findOne({ slug: req.params.slug.toLowerCase(), published: true });
  if (!competition) throw new HttpError(404, 'Competition not found.', 'COMPETITION_NOT_FOUND');
  await releaseExpiredHolds(competition._id);
  const refreshed = await Competition.findById(competition._id);
  const registration = req.get('x-user-id') ? await Registration.findOne({ competition: competition._id, userId: req.get('x-user-id').trim() }).lean() : null;
  return res.json({ data: serializeCompetition(refreshed, registration) });
});

router.get('/:slug/me', requireUser, async (req, res) => {
  const competition = await Competition.findOne({ slug: req.params.slug.toLowerCase(), published: true });
  if (!competition) throw new HttpError(404, 'Competition not found.', 'COMPETITION_NOT_FOUND');
  await releaseExpiredHolds(competition._id);
  const refreshed = await Competition.findById(competition._id);
  const registration = await Registration.findOne({ competition: competition._id, userId: req.user.id }).lean();
  return res.json({ data: serializeCompetition(refreshed, registration) });
});

module.exports = router;
