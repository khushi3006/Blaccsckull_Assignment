import { Competition, CompetitionResponse } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const DEMO_USER_ID = 'demo-user-001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-user-id': DEMO_USER_ID,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message ?? body.message ?? 'Something went wrong. Please try again.');
  }
  return (body.data ?? body) as T;
}

type ApiCompetition = {
  _id: string;
  slug: string;
  title: string;
  category: string;
  format: string;
  prizePool: number;
  entryFee: number;
  maxParticipants: number;
  bookedCount: number;
  currency: string;
  lifecycleState: string;
  remainingSpots: number;
  registrationStatus: NonNullable<Competition['registrationStatus']>;
  registrationId: string | null;
  paymentStatus: Competition['paymentStatus'];
  submissionStatus: NonNullable<Competition['submissionStatus']>;
  canRegister: boolean;
  canSubmit: boolean;
  serverTime: string;
  dates: { registrationClosesAt: string; submissionStartsAt: string; submissionEndsAt: string; resultsAt: string };
  judge: Competition['judge'];
  previousWinners: Competition['winners'];
  about: string;
  refundPolicy: string;
  securePaymentProvider: string;
  judgingParameters: Array<{ title: string; weight: number; description: string }>;
  rules: Array<{ title: string; description: string }>;
  rewards: Array<{ place: string; amount: number; currency: string }>;
};

function toCompetition(value: ApiCompetition): Competition {
  const status = value.lifecycleState === 'registration_open' ? 'registration_open'
    : value.lifecycleState === 'registration_closed' ? 'in_progress'
      : value.lifecycleState === 'results_published' ? 'completed' : 'in_progress';
  return {
    id: value.slug,
    title: value.title,
    category: value.category,
    format: value.format,
    prizePool: value.prizePool,
    entryFee: value.entryFee,
    maxParticipants: value.maxParticipants,
    participantCount: value.bookedCount,
    currency: value.currency === 'INR' ? '₹' : value.currency,
    status,
    registrationClosesAt: value.dates.registrationClosesAt,
    submissionStartsAt: value.dates.submissionStartsAt,
    submissionEndsAt: value.dates.submissionEndsAt,
    resultsAt: value.dates.resultsAt,
    judge: value.judge,
    winners: value.previousWinners ?? [],
    description: value.about,
    refundPolicy: value.refundPolicy,
    securePaymentProvider: value.securePaymentProvider,
    judgingParameters: value.judgingParameters.map((item) => ({ name: item.title, weight: item.weight, description: item.description })),
    rules: value.rules.map((item) => item.description ? `${item.title}: ${item.description}` : item.title),
    rewards: value.rewards.map((item) => ({ place: Number.parseInt(item.place, 10) || 0, label: item.place, amount: item.amount })),
    registered: value.registrationStatus === 'registered',
    registrationStatus: value.registrationStatus,
    registrationId: value.registrationId ?? undefined,
    paymentStatus: value.paymentStatus,
    submissionStatus: value.submissionStatus,
    canRegister: value.canRegister,
    canSubmit: value.canSubmit,
    updatedAt: value.serverTime,
  };
}

export async function getCompetition(id: string): Promise<CompetitionResponse> {
  const value = await request<ApiCompetition>(`/competitions/${encodeURIComponent(id)}`);
  return { competition: toCompetition(value), serverTime: value.serverTime };
}

export async function joinCompetition(id: string): Promise<Competition> {
  const response = await request<{ _id: string; status: string }>(
    `/competitions/${encodeURIComponent(id)}/register`,
    { method: 'POST' },
  );
  return getCompetition(id).then(({ competition }) => ({ ...competition, registrationStatus: response.status as Competition['registrationStatus'], registrationId: response._id }));
}

export async function confirmDemoPayment(id: string, registrationId: string): Promise<void> {
  await request(`/competitions/${encodeURIComponent(id)}/payments/${encodeURIComponent(registrationId)}/confirm`, { method: 'POST' });
}

export async function submitCompetitionEntry(id: string, url: string): Promise<void> {
  await request(`/competitions/${encodeURIComponent(id)}/submission`, { method: 'POST', body: JSON.stringify({ url }) });
}
