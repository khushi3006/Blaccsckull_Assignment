require('dotenv').config();
const mongoose = require('mongoose');
const { loadConfig } = require('../config/env');
const Competition = require('../models/Competition');

async function seed() {
  const config = loadConfig();
  await mongoose.connect(config.mongoUri);
  const now = Date.now();
  const start = new Date(now + 5 * 24 * 60 * 60 * 1000);
  const close = new Date(now + 10 * 24 * 60 * 60 * 1000);
  const end = new Date(now + 30 * 24 * 60 * 60 * 1000);
  const results = new Date(now + 32 * 24 * 60 * 60 * 1000);
  await Competition.findOneAndUpdate({ slug: 'classical-dance' }, {
    $set: {
      title: 'Feedants Classical Dance', category: 'Dance', format: 'Multi-Win', prizePool: 1500,
      entryFee: 99, currency: 'INR', maxParticipants: 20, published: true,
      dates: { registrationClosesAt: close, submissionStartsAt: start, submissionEndsAt: end, resultsAt: results },
      judge: { name: 'Manju Dubey', title: 'Professional Kathak Dancer', experience: '12+ Years of Experience' },
      previousWinners: [
        { name: 'Riya Shah', place: '1st Winner' }, { name: 'Aarav Mehta', place: '1st Winner' },
        { name: 'Neha Verma', place: '2nd Winner' }, { name: 'Ishita Choudhary', place: '3rd Winner' }
      ],
      about: 'This is an online classical dance competition open for all age groups. Participate from anywhere and showcase your talent. Express your passion through traditional dance.',
      judgingParameters: [{ title: 'Technique', weight: 50, description: 'Accuracy and control of classical dance technique.' }, { title: 'Expression', weight: 50, description: 'Abhinaya, musicality, and stage presence.' }],
      rules: [{ title: 'Eligibility', description: 'Open to all age groups.' }, { title: 'Submission', description: 'Submit an accessible video URL during the submission period.' }],
      rewards: [550, 300, 240, 200, 130, 80].map((amount, index) => ({ place: `${index + 1}${['st', 'nd', 'rd'][index] || 'th'} Winner`, amount, currency: 'INR' })),
      refundPolicy: 'Entry fees are refundable only as permitted by the competition policy.', securePaymentProvider: 'Razorpay'
    },
    $setOnInsert: { bookedCount: 0 }
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
  console.log('Seeded competition: classical-dance');
  await mongoose.disconnect();
}

seed().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
