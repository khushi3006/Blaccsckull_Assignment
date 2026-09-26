const mongoose = require('mongoose');

const dateSchema = new mongoose.Schema({
  registrationClosesAt: { type: Date, required: true },
  submissionStartsAt: { type: Date, required: true },
  submissionEndsAt: { type: Date, required: true },
  resultsAt: { type: Date, required: true }
}, { _id: false });

const competitionSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: '' },
  format: { type: String, default: '' },
  prizePool: { type: Number, min: 0, default: 0 },
  entryFee: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'INR' },
  maxParticipants: { type: Number, required: true, min: 1 },
  bookedCount: { type: Number, default: 0, min: 0 },
  published: { type: Boolean, default: true, index: true },
  dates: { type: dateSchema, required: true },
  judge: { name: String, title: String, experience: String, imageUrl: String, introVideoUrl: String },
  previousWinners: [{ name: String, place: String, imageUrl: String, videoUrl: String }],
  about: { type: String, default: '' },
  judgingParameters: [{ title: String, weight: { type: Number, min: 0, max: 100, default: 0 }, description: String }],
  rules: [{ title: String, description: String }],
  rewards: [{ place: String, amount: Number, currency: { type: String, default: 'INR' } }],
  refundPolicy: { type: String, default: '' },
  securePaymentProvider: { type: String, default: '' }
}, { timestamps: true, versionKey: false });

competitionSchema.index({ published: 1, 'dates.registrationClosesAt': 1 });
module.exports = mongoose.model('Competition', competitionSchema);
