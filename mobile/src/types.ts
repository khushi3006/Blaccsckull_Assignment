export type CompetitionStatus = 'upcoming' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';

export interface Competition {
  id: string;
  title: string;
  category: string;
  format: string;
  prizePool: number;
  entryFee: number;
  maxParticipants: number;
  participantCount: number;
  currency: string;
  status: CompetitionStatus;
  registrationClosesAt: string;
  submissionStartsAt: string;
  submissionEndsAt: string;
  resultsAt: string;
  judge: { name: string; title: string; experience: string; imageUrl?: string; introVideoUrl?: string };
  winners: Array<{ name: string; place: string; imageUrl?: string; videoUrl?: string }>;
  description: string;
  refundPolicy: string;
  securePaymentProvider: string;
  judgingParameters: Array<{ name: string; weight: number; description?: string }>;
  rules: string[];
  rewards: Array<{ place: number; label: string; amount: number }>;
  registered: boolean;
  registrationStatus?: 'not_registered' | 'pending_payment' | 'registered' | 'cancelled' | 'payment_expired';
  registrationId?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | null;
  submissionStatus?: 'not_submitted' | 'submitted';
  canRegister?: boolean;
  canSubmit?: boolean;
  updatedAt?: string;
}

export interface CompetitionResponse {
  competition: Competition;
  serverTime: string;
}
