const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  userId: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending_payment', 'registered', 'cancelled', 'payment_expired'], default: 'pending_payment', index: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  paymentReference: { type: String, default: null },
  holdExpiresAt: { type: Date, default: null, index: true },
  submittedAt: { type: Date, default: null },
  submission: {
    url: { type: String, default: null },
    status: { type: String, enum: ['not_submitted', 'submitted'], default: 'not_submitted' }
  }
}, { timestamps: true, versionKey: false });

registrationSchema.index({ competition: 1, userId: 1 }, { unique: true });
registrationSchema.index({ competition: 1, status: 1 });
module.exports = mongoose.model('Registration', registrationSchema);
