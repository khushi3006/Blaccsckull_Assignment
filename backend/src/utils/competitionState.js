function lifecycleState(competition, now = new Date()) {
  const { registrationClosesAt, submissionStartsAt, submissionEndsAt, resultsAt } = competition.dates;
  // Registration and submissions may overlap; registration stays open until its
  // own deadline while submissions are independently available during their window.
  if (now < registrationClosesAt) return 'registration_open';
  if (now >= submissionStartsAt && now <= submissionEndsAt) return 'submission_open';
  if (now < submissionStartsAt) return 'registration_closed';
  if (now < resultsAt) return 'submission_closed';
  return 'results_published';
}

function serializeCompetition(competition, registration, now = new Date()) {
  const data = competition.toObject ? competition.toObject() : competition;
  const state = lifecycleState(data, now);
  const remainingSpots = Math.max(0, data.maxParticipants - data.bookedCount);
  const isRegistered = registration?.status === 'registered';
  const canSubmitNow = now >= data.dates.submissionStartsAt && now <= data.dates.submissionEndsAt;
  return {
    ...data,
    lifecycleState: state,
    remainingSpots,
    registrationStatus: registration?.status || 'not_registered',
    registrationId: registration?._id?.toString() || null,
    paymentStatus: registration?.paymentStatus || null,
    submissionStatus: registration?.submission?.status || 'not_submitted',
    canRegister: state === 'registration_open' && remainingSpots > 0 && (!registration || registration.status === 'payment_expired'),
    canSubmit: isRegistered && canSubmitNow && registration.submission?.status !== 'submitted',
    serverTime: now.toISOString()
  };
}

module.exports = { lifecycleState, serializeCompetition };
