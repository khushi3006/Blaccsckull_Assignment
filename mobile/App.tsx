import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { confirmDemoPayment, getCompetition, joinCompetition, submitCompetitionEntry } from './src/api';
import { Competition, CompetitionStatus } from './src/types';

const COMPETITION_ID = process.env.EXPO_PUBLIC_COMPETITION_ID ?? 'classical-dance';
const TEAL = '#087f86';
const INK = '#10234a';
const MUTED = '#68779a';
const BORDER = '#e8edf4';
const REFERRAL_URL = 'https://feedants.com/r/referral123';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function countdown(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(days).padStart(2, '0')}d : ${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}m : ${String(remainingSeconds).padStart(2, '0')}s`;
}

function Card({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ children }: React.PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Avatar({ uri, label, size = 68 }: { uri?: string; label: string; size?: number }) {
  const initials = label.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e7f3f3' }} />
    : <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><Text style={styles.avatarInitials}>{initials}</Text></View>;
}

function InfoRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return <View style={styles.infoRow}><Text style={styles.lineIcon}>{icon}</Text><View style={styles.infoCopy}><Text style={styles.infoLabel}>{title}</Text><Text style={styles.infoDetail}>{detail}</Text></View></View>;
}

function actionLabel(status: CompetitionStatus, registered: boolean, registrationStatus: Competition['registrationStatus'], submissionStatus: Competition['submissionStatus'], capacityRemaining: number, submissionOpen: boolean) {
  if (registered && submissionOpen && submissionStatus !== 'submitted') return 'Upload Submission';
  if (registered && submissionStatus === 'submitted') return 'Submission Uploaded';
  if (registered) return 'Registered';
  if (registrationStatus === 'pending_payment') return 'Complete Payment';
  if (status === 'registration_open' && capacityRemaining > 0) return 'Register Now';
  if (capacityRemaining <= 0 && status === 'registration_open') return 'Competition Full';
  if (status === 'upcoming') return 'Registration Opens Soon';
  if (status === 'completed') return 'Competition Ended';
  if (status === 'cancelled') return 'Competition Cancelled';
  return 'Registration Closed';
}

export default function App() {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<'about' | 'judging' | 'rules'>('about');
  const [expanded, setExpanded] = useState(false);
  const [language, setLanguage] = useState<'ENG' | 'हिंदी'>('ENG');
  const [submissionModal, setSubmissionModal] = useState(false);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await getCompetition(COMPETITION_ID);
      setCompetition(result.competition);
      setNow(new Date(result.serverTime).getTime());
    } catch (error) {
      Alert.alert('Could not load competition', error instanceof Error ? error.message : 'Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow((value) => value + 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = useMemo(() => competition ? Math.max(0, competition.maxParticipants - competition.participantCount) : 0, [competition]);
  const submissionOpen = Boolean(competition && now >= new Date(competition.submissionStartsAt).getTime() && now <= new Date(competition.submissionEndsAt).getTime());
  const buttonLabel = competition ? actionLabel(competition.status, competition.registered, competition.registrationStatus, competition.submissionStatus, remaining, submissionOpen) : '';
  const actionable = Boolean(competition && ((competition.registered && submissionOpen && competition.submissionStatus !== 'submitted') || (competition.canRegister && remaining > 0) || competition.registrationStatus === 'pending_payment'));

  const handlePrimaryAction = async () => {
    if (!competition || !actionable || joining) return;
    if (competition.registered) {
      setSubmissionModal(true);
      return;
    }
    if (competition.registrationStatus === 'pending_payment' && competition.registrationId) {
      setJoining(true);
      try {
        await confirmDemoPayment(competition.id, competition.registrationId);
        await load(true);
        Alert.alert('Payment confirmed', 'Your spot is registered.');
      } catch (error) {
        Alert.alert('Payment failed', error instanceof Error ? error.message : 'Please try again.');
        await load(true);
      } finally {
        setJoining(false);
      }
      return;
    }
    setJoining(true);
    try {
      const updated = await joinCompetition(competition.id);
      setCompetition(updated);
      Alert.alert('Spot reserved', 'Complete the demo payment to confirm your registration.', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Registration failed', error instanceof Error ? error.message : 'Please try again.');
      await load(true);
    } finally {
      setJoining(false);
    }
  };

  const sendSubmission = async () => {
    if (!competition || submitting) return;
    setSubmitting(true);
    try {
      await submitCompetitionEntry(competition.id, submissionUrl.trim());
      setSubmissionModal(false);
      setSubmissionUrl('');
      await load(true);
      Alert.alert('Submission received', 'Your entry link has been submitted.');
    } catch (error) {
      Alert.alert('Could not submit', error instanceof Error ? error.message : 'Please check the video URL and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const shareReferral = async () => {
    try { await Share.share({ message: `Join me on Feedants: ${REFERRAL_URL}`, url: REFERRAL_URL }); }
    catch { Alert.alert('Referral link', REFERRAL_URL); }
  };

  if (loading && !competition) return <SafeAreaView style={styles.center}><StatusBar barStyle="dark-content" /><ActivityIndicator size="large" color={TEAL} /><Text style={styles.loadingText}>Loading competition…</Text></SafeAreaView>;
  if (!competition) return <SafeAreaView style={styles.center}><StatusBar barStyle="dark-content" /><Text style={styles.errorTitle}>Competition unavailable</Text><Text style={styles.loadingText}>Connect to the API and try again.</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.primaryText}>Try again</Text></Pressable></SafeAreaView>;

  const visibleDescription = expanded ? competition.description : `${competition.description.slice(0, 178)}${competition.description.length > 178 ? '…' : ''}`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fc" />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => Alert.alert('Feedants', 'You are viewing the competition details.')} style={styles.backButton}><Text style={styles.backArrow}>‹</Text><Text style={styles.backText}>Go back</Text></Pressable>
        <View style={styles.languageSwitch}>{(['ENG', 'हिंदी'] as const).map((item) => <Pressable key={item} onPress={() => setLanguage(item)} style={[styles.languageOption, language === item && styles.languageActive]}><Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item}</Text></Pressable>)}</View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={TEAL} />}>
        <Card>
          <View style={styles.summaryHead}><Text style={styles.competitionTitle}>{competition.title}</Text>{competition.registered && <View style={styles.registeredBadge}><Text style={styles.registeredText}>✓ Registered</Text></View>}</View>
          <View style={styles.tagsRow}><Text style={styles.tag}>{competition.category}</Text><Text style={styles.tag}>{competition.format}</Text><Text style={styles.winnerNote}>♜ Winners get certificate</Text></View>
          <View style={styles.summaryMetrics}>
            <View style={[styles.metric, styles.prizeMetric]}><Text style={styles.metricLabel}>Prize Pool</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.prizeValue}>{competition.currency} {competition.prizePool.toLocaleString('en-IN')}</Text></View>
            <View style={[styles.metric, styles.feeMetric]}><Text style={styles.metricLabel}>Entry Fee</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.feeValue}>{competition.currency} {competition.entryFee.toLocaleString('en-IN')}</Text></View>
            <View style={[styles.metric, styles.spotsMetric]}><Text style={styles.spotsText}>♧  {remaining} spots left</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, competition.participantCount / Math.max(1, competition.maxParticipants) * 100)}%` }]} /></View><Text style={styles.metricLabel}>{competition.participantCount} / {competition.maxParticipants} Booked</Text></View>
          </View>
        </Card>

        <Card style={styles.judgeCard}>
          <Avatar uri={competition.judge.imageUrl} label={competition.judge.name} />
          <View style={styles.judgeCopy}><Text style={styles.infoLabel}>Judge</Text><Text style={styles.judgeName}>{competition.judge.name}</Text><Text style={styles.infoDetail}>{competition.judge.title}</Text><Text style={styles.infoDetail}>{competition.judge.experience}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Play judge introduction video" onPress={() => competition.judge.introVideoUrl ? void Linking.openURL(competition.judge.introVideoUrl) : Alert.alert('Intro Video', 'Judge introduction video coming soon.')} style={styles.playButton}><Text style={styles.playIcon}>▶</Text><Text style={styles.playLabel}>Intro Video</Text></Pressable>
        </Card>

        <View style={styles.countdownBar}>
          <View style={styles.countdownTopRow}><View style={styles.countdownTitle}><Text style={styles.countdownHourglass}>⌛</Text><Text style={styles.countdownLabel}>Registration closes in</Text></View><Text style={styles.hurry}>◴  Hurry up!</Text></View>
          <Text style={styles.countdownValue}>{countdown(competition.registrationClosesAt, now)}</Text>
        </View>

        <Card><SectionTitle>Important Dates</SectionTitle><View style={styles.datesGrid}><InfoRow icon="▦" title="Register Before" detail={formatDate(competition.registrationClosesAt)} /><InfoRow icon="➤" title="Submission Starts" detail={formatDate(competition.submissionStartsAt)} /><InfoRow icon="↥" title="Submission Ends" detail={formatDate(competition.submissionEndsAt)} /><InfoRow icon="♜" title="Result Date" detail={formatDate(competition.resultsAt)} /></View></Card>

        {competition.winners.length > 0 && <Card><SectionTitle>Previous Winners</SectionTitle><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.winnersRow}>{competition.winners.map((winner) => <Pressable key={`${winner.name}-${winner.place}`} accessibilityRole="button" accessibilityLabel={`Play ${winner.name}'s winning video`} onPress={() => winner.videoUrl ? void Linking.openURL(winner.videoUrl) : Alert.alert('Winner video', 'Video coming soon.')} style={styles.winnerCard}><Avatar uri={winner.imageUrl} label={winner.name} size={68} /><View style={styles.winnerCopy}><Text numberOfLines={1} style={styles.winnerName}>{winner.name}</Text><Text style={styles.winnerPlace}>{winner.place}</Text></View><Text style={styles.winnerPlay}>▶</Text></Pressable>)}</ScrollView></Card>}

        <Card>
          <View style={styles.tabs}>{(['about', 'judging', 'rules'] as const).map((key) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => { setTab(key); setExpanded(false); }} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{key === 'about' ? 'About Competition' : key === 'judging' ? 'Judging Parameters' : 'Rules & Eligibility'}</Text></Pressable>)}</View>
          {tab === 'about' && <Text style={styles.description}>{visibleDescription}</Text>}
          {tab === 'judging' && competition.judgingParameters.map((item) => <View key={item.name} style={styles.parameterRow}><Text style={styles.infoDetail}>{item.name}{item.description ? ` · ${item.description}` : ''}</Text><Text style={styles.parameterWeight}>{item.weight}%</Text></View>)}
          {tab === 'rules' && competition.rules.map((rule, index) => <Text key={`${index}-${rule}`} style={styles.ruleText}>{index + 1}. {rule}</Text>)}
          {(tab === 'about' && competition.description.length > 178) && <Pressable onPress={() => setExpanded((value) => !value)} style={styles.viewMore}><Text style={styles.viewMoreText}>{expanded ? 'View less' : 'View more'}  ⌄</Text></Pressable>}
        </Card>

        <Card><Text style={styles.rewardHeading}>Rewards  <Text style={styles.rewardSubheading}>(All Positions)</Text></Text>{competition.rewards.map((reward) => <View key={reward.place} style={styles.rewardRow}><Text style={styles.rewardMedal}>{reward.place === 1 ? '🏆' : reward.place === 2 ? '🥈' : reward.place === 3 ? '🥉' : '☆'}</Text><Text style={styles.rewardPlace}>{reward.label}</Text><Text style={styles.rewardAmount}>{competition.currency} {reward.amount.toLocaleString('en-IN')}</Text></View>)}</Card>

        <View style={styles.disclaimer}><Text style={styles.disclaimerIcon}>ⓘ</Text><Text style={styles.disclaimerText}>Disclaimer: Only contributions from paid participants will be considered for judging.</Text></View>
        <View style={styles.twoCards}><Card style={styles.halfCard}><View style={styles.videoTile}><Text style={styles.playIcon}>▶</Text></View><View style={styles.halfCopy}><Text style={styles.cardHeadline}>How will you receive prize money?</Text><Text style={styles.infoDetail}>Watch video to know more</Text></View></Card><Card style={styles.halfCard}><Text style={styles.paymentLine}>♧  {competition.refundPolicy || 'Refund policy'}</Text><Text style={styles.paymentLine}>♧  Secure payments powered by {competition.securePaymentProvider || 'our payment partner'}</Text></Card></View>

        <Card style={styles.referral}><Text style={styles.megaphone}>◀</Text><View style={styles.referralCopy}><Text style={styles.cardHeadline}>Refer & Earn more discount</Text><Text style={styles.referralLink}>{REFERRAL_URL}</Text><Text style={styles.infoDetail}>You earn {competition.currency} 10 for every signup</Text></View><Pressable onPress={() => void shareReferral()} style={styles.referButton}><Text style={styles.primaryText}>Refer Now</Text></Pressable></Card>
        <Pressable style={styles.reviews} onPress={() => Alert.alert('Hear From Our Users', 'Participant stories are coming soon.')}><Text style={styles.reviewIcon}>☏</Text><View style={styles.reviewCopy}><Text style={styles.cardHeadline}>Hear From Our Users</Text><Text style={styles.infoDetail}>See what participants say about Feedants</Text></View><Text style={styles.chevron}>›</Text></Pressable>
        <View style={styles.adSlot}><Text style={styles.infoDetail}>♧  Ad Here</Text></View>
        <View style={{ height: 12 }} />
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !actionable || joining }} disabled={!actionable || joining} onPress={() => void handlePrimaryAction()} style={[styles.primaryButton, (!actionable || joining) && styles.primaryDisabled]}>{joining ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryText}>{buttonLabel}</Text>{competition.registered && <Text style={styles.primarySubtext}>{submissionOpen ? 'Submit your entry' : 'You are registered'}</Text>}</>}</Pressable>
      <Modal visible={submissionModal} transparent animationType="fade" onRequestClose={() => setSubmissionModal(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Submit your entry</Text><Text style={styles.infoDetail}>Paste a public video link (YouTube, Vimeo, or another accessible URL).</Text><TextInput value={submissionUrl} onChangeText={setSubmissionUrl} autoCapitalize="none" keyboardType="url" placeholder="https://" placeholderTextColor="#8a96ad" style={styles.urlInput} accessibilityLabel="Submission video URL" /><View style={styles.modalActions}><Pressable onPress={() => setSubmissionModal(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => void sendSubmission()} disabled={submitting || !submissionUrl.trim()} style={[styles.referButton, (submitting || !submissionUrl.trim()) && styles.primaryDisabled]}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit</Text>}</Pressable></View></View></View>
      </Modal>
      <View style={styles.bottomNav}>{[['⌂', 'Home'], ['⌕', 'Explore'], ['＋', 'Create'], ['♜', 'Competitions'], ['●', 'Profile']].map(([icon, label]) => <Pressable key={label} onPress={() => label === 'Competitions' ? undefined : Alert.alert(label, `${label} navigation coming soon.`)} style={styles.navItem}><Text style={[styles.navIcon, label === 'Competitions' && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, label === 'Competitions' && styles.navActive]}>{label}</Text></Pressable>)}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fc' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f9fc' },
  topBar: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, backArrow: { fontSize: 34, lineHeight: 38, color: INK }, backText: { color: INK, fontSize: 16, fontWeight: '700' },
  languageSwitch: { flexDirection: 'row', borderRadius: 22, backgroundColor: '#edf1f7', padding: 3 }, languageOption: { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 }, languageActive: { backgroundColor: TEAL }, languageText: { color: MUTED, fontWeight: '600' }, languageTextActive: { color: '#fff' },
  scrollView: { flex: 1 }, scrollContent: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 18, gap: 10 }, card: { backgroundColor: '#fff', borderRadius: 17, padding: 16, borderWidth: 1, borderColor: '#edf0f5', shadowColor: '#12234a', shadowOpacity: 0.035, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  summaryHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, competitionTitle: { flex: 1, color: INK, fontWeight: '800', fontSize: 22 }, registeredBadge: { backgroundColor: '#e7f5f4', borderColor: '#c5e8e5', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }, registeredText: { color: TEAL, fontWeight: '700', fontSize: 12 }, tagsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 9 }, tag: { color: INK, backgroundColor: '#f2f4f8', fontSize: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontWeight: '600' }, winnerNote: { color: TEAL, fontSize: 12, fontWeight: '600', marginLeft: 3 }, summaryMetrics: { flexDirection: 'row', gap: 7, marginTop: 18 }, metric: { minWidth: 0 }, prizeMetric: { flex: 1.3 }, feeMetric: { flex: 0.85 }, metricLabel: { color: MUTED, fontSize: 13, marginBottom: 4 }, prizeValue: { color: TEAL, fontSize: 25, fontWeight: '800' }, feeValue: { color: INK, fontSize: 25, fontWeight: '800' }, spotsMetric: { flex: 1.35 }, spotsText: { color: TEAL, fontWeight: '700', fontSize: 13, marginBottom: 7 }, progressTrack: { height: 5, backgroundColor: '#deeeee', borderRadius: 6, marginBottom: 8 }, progressFill: { height: 5, backgroundColor: TEAL, borderRadius: 6 },
  judgeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0f0ef' }, avatarInitials: { color: TEAL, fontSize: 19, fontWeight: '800' }, judgeCopy: { flex: 1, gap: 3 }, infoLabel: { color: MUTED, fontSize: 13 }, judgeName: { color: INK, fontWeight: '800', fontSize: 17 }, infoDetail: { color: MUTED, fontSize: 13, lineHeight: 19 }, playButton: { alignItems: 'center', gap: 4, padding: 5 }, playIcon: { color: TEAL, backgroundColor: '#e8f5f5', width: 46, height: 46, borderRadius: 23, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', fontSize: 16 }, playLabel: { fontSize: 12, color: MUTED },
  countdownBar: { minHeight: 66, justifyContent: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#e9f6f5' }, countdownTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, countdownTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 }, countdownHourglass: { fontSize: 18, color: TEAL }, countdownLabel: { color: INK, fontWeight: '700', fontSize: 12, flexShrink: 1 }, countdownValue: { alignSelf: 'center', color: TEAL, fontSize: 15, fontWeight: '800' }, hurry: { color: TEAL, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: INK, fontWeight: '800', fontSize: 15, marginBottom: 10 }, datesGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: BORDER, borderRadius: 12, overflow: 'hidden' }, infoRow: { width: '50%', minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderColor: BORDER }, lineIcon: { width: 28, textAlign: 'center', color: TEAL, fontSize: 22 }, infoCopy: { flex: 1 }, infoLabel: { color: MUTED, fontSize: 12 }, infoDetail: { color: TEAL, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  winnersRow: { gap: 10 }, winnerCard: { width: 205, minHeight: 80, flexDirection: 'row', alignItems: 'center', padding: 6, gap: 9, borderRadius: 12, backgroundColor: '#f6f8fb' }, winnerCopy: { flex: 1, minWidth: 0 }, winnerName: { color: INK, fontSize: 13, fontWeight: '700' }, winnerPlace: { color: TEAL, fontSize: 12, marginTop: 3 }, winnerPlay: { color: '#fff', backgroundColor: TEAL, borderRadius: 14, overflow: 'hidden', fontSize: 12, padding: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER, marginBottom: 12 }, tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderColor: 'transparent' }, tabActive: { borderColor: TEAL }, tabText: { color: MUTED, textAlign: 'center', fontWeight: '600', fontSize: 12 }, tabTextActive: { color: TEAL }, description: { color: MUTED, fontSize: 14, lineHeight: 24 }, viewMore: { paddingTop: 8, alignItems: 'center' }, viewMoreText: { color: TEAL, fontWeight: '700' }, parameterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 9, gap: 8 }, parameterWeight: { color: TEAL, fontWeight: '800' }, ruleText: { color: MUTED, fontSize: 14, lineHeight: 22, paddingVertical: 4 },
  rewardHeading: { color: INK, fontWeight: '800', fontSize: 15, marginBottom: 7 }, rewardSubheading: { color: MUTED, fontSize: 13, fontWeight: '500' }, rewardRow: { minHeight: 33, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f7f9fc', borderRadius: 7, marginTop: 4, paddingHorizontal: 8 }, rewardMedal: { width: 30, fontSize: 17 }, rewardPlace: { flex: 1, color: INK, fontSize: 13, fontWeight: '700' }, rewardAmount: { color: TEAL, fontSize: 16, fontWeight: '800' },
  disclaimer: { minHeight: 36, borderRadius: 10, backgroundColor: '#e9f6f5', alignItems: 'center', flexDirection: 'row', paddingHorizontal: 12, gap: 8 }, disclaimerIcon: { color: TEAL, fontSize: 19 }, disclaimerText: { color: INK, fontSize: 11, flex: 1 }, twoCards: { flexDirection: 'row', gap: 8 }, halfCard: { flex: 1, minHeight: 92, flexDirection: 'row', alignItems: 'center', padding: 11, gap: 8 }, videoTile: { width: 43, height: 48, borderRadius: 12, backgroundColor: '#d8f3e8', alignItems: 'center', justifyContent: 'center' }, halfCopy: { flex: 1 }, cardHeadline: { color: INK, fontSize: 13, fontWeight: '800' }, paymentLine: { color: INK, fontSize: 12, lineHeight: 26 },
  referral: { minHeight: 90, backgroundColor: '#e6f8ee', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 }, megaphone: { color: TEAL, fontSize: 29, transform: [{ rotate: '-25deg' }] }, referralCopy: { flex: 1 }, referralLink: { color: TEAL, fontSize: 10, marginVertical: 4 }, referButton: { backgroundColor: TEAL, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }, primaryText: { color: '#fff', fontWeight: '800', textAlign: 'center' }, reviews: { minHeight: 58, borderRadius: 15, backgroundColor: '#fff', borderColor: '#edf0f5', borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }, reviewIcon: { color: INK, fontSize: 22 }, reviewCopy: { flex: 1 }, chevron: { color: INK, fontSize: 27 }, adSlot: { height: 40, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e4', alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minHeight: 52, marginHorizontal: 14, marginBottom: 4, borderRadius: 11, backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center' }, primaryDisabled: { backgroundColor: '#8eaeb0' }, primarySubtext: { color: '#eafafa', fontSize: 11, marginTop: 1 }, bottomNav: { minHeight: 54, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderColor: BORDER }, navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 54, gap: 1 }, navIcon: { color: '#8c96b0', fontSize: 21 }, navLabel: { color: MUTED, fontSize: 10 }, navActive: { color: TEAL, fontWeight: '800' }, loadingText: { color: MUTED, marginTop: 10 }, errorTitle: { color: INK, fontSize: 18, fontWeight: '800' }, retry: { backgroundColor: TEAL, padding: 12, borderRadius: 8, marginTop: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,35,74,0.45)', justifyContent: 'center', padding: 22 }, modalCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, gap: 12 }, modalTitle: { color: INK, fontSize: 19, fontWeight: '800' }, urlInput: { minHeight: 48, borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 12, color: INK }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }, cancelButton: { padding: 11 }, cancelText: { color: MUTED, fontWeight: '700' },
});
