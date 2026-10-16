import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import {
  initialEmergencies,
  initialProfile,
  type DashboardDose,
  type DashboardNotification,
} from '@/family-dashboard/mock-data';
import { getFamilyOverview, type FamilyOverview } from '@/family-dashboard/family-api';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type Section = 'Overview' | 'Health Check' | 'Medications' | 'Emergency History' | 'Family Communication' | 'User Profile' | 'Settings';
const sections: { title: Section }[] = [
  { title: 'Overview' },
  { title: 'Health Check' },
  { title: 'Medications' },
  { title: 'Emergency History' },
  { title: 'Family Communication' },
  { title: 'User Profile' },
  { title: 'Settings' },
];
export default function FamilyDashboard() {
  const router = useRouter();
  const { user, token, logOut } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compact = width < 480;
  const [section, setSection] = useState<Section>('Overview');
  const [checkIns, setCheckIns] = useState<FamilyOverview['healthChecks']>([]);
  const [doses, setDoses] = useState<DashboardDose[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [profile, setProfile] = useState(initialProfile);
  const [familyOverview, setFamilyOverview] = useState<FamilyOverview | null>(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyError, setFamilyError] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unread = notifications.filter((item) => !item.read).length;
  const taken = doses.filter((dose) => dose.status === 'taken').length;
  const pending = doses.filter((dose) => dose.status === 'pending' || dose.status === 'postponed').length;
  const missed = doses.filter((dose) => dose.status === 'missed').length;
  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const overview = await getFamilyOverview(token);
        if (!active) return;
        setFamilyOverview(overview);
        setProfile({
          fullName: overview.profile.name,
          age: String(overview.profile.age),
          conditions: overview.profile.conditions.join(', '),
          language: 'Arabic',
        });
        setCheckIns(overview.healthChecks.map((check) => ({ ...check, status: 'completed' as const })));
        setDoses(overview.today.map((dose) => ({
          id: dose.id,
          medication: dose.medicationName,
          instructions: dose.dose,
          time: new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }).format(new Date(dose.scheduledAt)),
          status: dose.displayStatus === 'taken' ? 'taken' : dose.displayStatus === 'missed' ? 'missed' : 'pending',
          confirmedAt: dose.confirmedAt ? new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }).format(new Date(dose.confirmedAt)) : undefined,
        })));
        setNotifications(overview.alerts.map((alert) => ({
          id: alert.id,
          title: 'Missed medication dose',
          detail: alert.message,
          time: new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(alert.time)),
          read: false,
          kind: 'medication',
        })));
        setFamilyError('');
      } catch (error) {
        if (active) setFamilyError(error instanceof Error ? error.message : 'Could not load the linked older-adult profile.');
      } finally {
        if (active) setFamilyLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => { active = false; clearInterval(interval); };
  }, [token]);

  function markRead(id: string) {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  const timeOfDay = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date()));
  const greetingText = timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening';

  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'caregiver') return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <View style={[styles.shell, wide && styles.wideShell, compact && styles.compactShell]}>
        {wide ? <Sidebar section={section} onSelect={setSection} onHome={() => router.replace('/')} /> : null}
        <View style={styles.main}>
          <View style={[styles.topbar, compact && styles.compactTopbar]}>
            {!wide ? <Pressable accessibilityRole="button" accessibilityLabel="Open dashboard menu" accessibilityState={{ expanded: mobileMenuOpen }} onPress={() => setMobileMenuOpen(true)} style={styles.mobileMenuButton}>
              <View style={styles.menuGlyph}><View style={styles.menuGlyphLine} /><View style={styles.menuGlyphLine} /><View style={styles.menuGlyphLine} /></View>
            </Pressable> : null}
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput accessibilityLabel="Search medications and activity" placeholder="Search medications, activity…" placeholderTextColor={Palette.textSecondary} value={searchQuery} onChangeText={setSearchQuery} style={styles.searchInput} returnKeyType="search" />
            </View>
            <View style={styles.topActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${unread} unread notifications`} onPress={() => setNoticeOpen((open) => !open)} style={styles.notificationButton}>
                <Text style={styles.notificationIcon}>♧</Text>
                {unread > 0 ? <Text style={styles.badge}>{unread}</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Caregiver account menu" onPress={() => setAccountMenuOpen((open) => !open)} style={styles.accountChip}>
                <Text style={styles.avatar}>{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text>
                {wide ? <Text style={styles.accountName}>{user.fullName.split(' ')[0] || 'Caregiver'}</Text> : null}
                <Text style={styles.accountChevron}>⌄</Text>
              </Pressable>
            </View>
          </View>
          {accountMenuOpen ? <View style={styles.accountMenu}>
            <Pressable accessibilityRole="button" onPress={() => { setSection('User Profile'); setAccountMenuOpen(false); }} style={styles.accountMenuItem}><Text style={styles.accountMenuText}>View linked profile</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setSection('Settings'); setAccountMenuOpen(false); }} style={styles.accountMenuItem}><Text style={styles.accountMenuText}>Settings</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={async () => { setAccountMenuOpen(false); await logOut(); router.replace('/login'); }} style={styles.accountMenuItem}><Text style={styles.accountMenuText}>Sign out</Text></Pressable>
          </View> : null}
          {noticeOpen ? <NotificationPanel items={notifications} onRead={markRead} onClose={() => setNoticeOpen(false)} /> : null}
          <ScrollView contentContainerStyle={[styles.scrollContent, compact && styles.compactScrollContent]}>
            {familyLoading ? <Text style={styles.familyStatus}>Loading linked older-adult profile…</Text> : null}
            {familyError ? <Text accessibilityRole="alert" style={styles.familyError}>{familyError}</Text> : null}
            {section !== 'Overview' ? <View style={styles.pageHeading}>
              <View>
                <Text style={styles.pageTitle}>{section}</Text>
                <Text style={styles.pageSubtitle}>For {profile.fullName.split(' ')[0] || 'your family member'}</Text>
              </View>
              <View style={styles.demoPill}><Text style={styles.demoPillText}>{familyOverview ? 'CONNECTED' : 'DEMO'}</Text></View>
            </View> : null}
            {section === 'Overview' ? <Overview compact={compact} checkIns={checkIns} doses={doses} taken={taken} pending={pending} missed={missed} emergencies={initialEmergencies} onNavigate={setSection} linkedOverview={familyOverview} searchQuery={searchQuery} greeting={greetingText} caregiverName={user.fullName.split(' ')[0] || 'Caregiver'} /> : null}
            {section === 'Health Check' ? <HealthPage checkIns={checkIns} /> : null}
            {section === 'Medications' ? <LinkedMedicationPage overview={familyOverview} /> : null}
            {section === 'Emergency History' ? <EmergencyPage /> : null}
            {section === 'Family Communication' ? <CommunicationPage contacts={familyOverview?.contacts ?? []} /> : null}
            {section === 'User Profile' ? <ProfilePage profile={profile} linkedOverview={familyOverview} /> : null}
            {section === 'Settings' ? <SettingsPage onSignOut={async () => { await logOut(); router.replace('/login'); }} /> : null}
            <Text style={styles.disclaimer}>Demo data is temporary. Emergency history and contact actions are not connected.</Text>
          </ScrollView>
          {!wide && mobileMenuOpen ? <MobileDrawer section={section} onClose={() => setMobileMenuOpen(false)} onSelect={(nextSection) => { setSection(nextSection); setMobileMenuOpen(false); }} /> : null}
        </View>
      </View>
    </View>
  );
}

function Sidebar({ section, onSelect, onHome }: { section: Section; onSelect: (item: Section) => void; onHome: () => void }) {
  return <View style={styles.sidebar}>
    <Pressable accessibilityRole="button" onPress={onHome} style={styles.logoRow}><View style={styles.logo}><Text style={styles.logoText}>CC</Text></View><View><Text style={styles.logoTitle}>Care Circle</Text><Text style={styles.logoSub}>Family space</Text></View></Pressable>
    <Text style={styles.navCaption}>MENU</Text>
    {sections.map((item) => <NavItem key={item.title} item={item} active={item.title === section} onPress={() => onSelect(item.title)} />)}
  </View>;
}

function MobileDrawer({ section, onSelect, onClose }: { section: Section; onSelect: (item: Section) => void; onClose: () => void }) {
  return <View style={styles.mobileDrawerLayer}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close dashboard menu" onPress={onClose} style={styles.mobileDrawerBackdrop} />
    <View style={styles.mobileDrawer}>
      <View style={styles.mobileDrawerHeader}>
        <Text style={styles.mobileDrawerTitle}>Family dashboard</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close dashboard menu" onPress={onClose} style={styles.mobileDrawerClose}><Text style={styles.mobileDrawerCloseText}>Close</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.mobileDrawerItems}>
        {sections.map((item) => <NavItem key={item.title} item={item} active={item.title === section} onPress={() => onSelect(item.title)} />)}
      </ScrollView>
    </View>
  </View>;
}

function NavItem({ item, active, onPress, compact = false }: { item: { title: Section }; active: boolean; onPress: () => void; compact?: boolean }) {
  const icons: Record<Section, string> = { Overview: '⌂', 'Health Check': '♡', Medications: '✚', 'Emergency History': '!', 'Family Communication': '♧', 'User Profile': '♙', Settings: '⚙' };
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.navItem, active && styles.navItemActive, compact && styles.navItemCompact]}>
    <Text style={[styles.navItemIcon, active && styles.navItemIconActive]}>{icons[item.title]}</Text><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.title}</Text>
  </Pressable>;
}

function LinkedProfileCard({ overview }: { overview: FamilyOverview }) {
  return <Card style={styles.linkedCard}>
    <View style={styles.cardHeader}>
      <View><Text style={styles.cardTitle}>Linked older adult</Text><Text style={styles.cardHint}>This caregiver account is connected to this profile.</Text></View>
      <StatusPill label="Backend connected" tone="green" />
    </View>
    <Text style={styles.linkedName}>{overview.profile.name} · Age {overview.profile.age}</Text>
    <Text style={styles.linkedDetail}>Health conditions: {overview.profile.conditions.length ? overview.profile.conditions.join(', ') : 'None listed'}</Text>
    <Text style={styles.linkedDetail}>Medications: {overview.medications.map((medication) => `${medication.name} ${medication.dose}`).join(' · ') || 'None listed'}</Text>
    <Text style={styles.linkedDetail}>Missed-dose alerts: {overview.alerts.length}</Text>
  </Card>;
}

function Overview({ checkIns, doses, taken, pending, missed, emergencies, onNavigate, linkedOverview, searchQuery, greeting, caregiverName, compact }: {
  checkIns: FamilyOverview['healthChecks']; doses: DashboardDose[]; taken: number; pending: number; missed: number; emergencies: typeof initialEmergencies; onNavigate: (item: Section) => void; linkedOverview: FamilyOverview | null; searchQuery: string; greeting: string; caregiverName: string;
  compact: boolean;
}) {
  const today = checkIns[0];
  const latestCompletedCheck = checkIns.find((check) => check.status === 'completed');
  const latestTakenDose = doses.find((dose) => dose.status === 'taken');
  const query = searchQuery.trim().toLowerCase();
  const scheduledItems = (linkedOverview?.today ?? []).filter((dose) => !query || `${dose.medicationName} ${dose.dose} ${dose.displayStatus}`.toLowerCase().includes(query));
  const activities = [
    ...checkIns.map((check) => ({ time: `${check.date} · ${check.time}`, title: 'Health check completed', detail: `${check.feeling || 'Wellbeing check submitted'} · ${check.sleptWell ? `Sleep: ${check.sleptWell}` : 'Sleep not recorded'}`, icon: '♡' })),
    ...doses.filter((dose) => dose.status === 'taken').map((dose) => ({ time: dose.confirmedAt ?? dose.time, title: 'Medication confirmed', detail: `${dose.medication} · ${dose.instructions}`, icon: '+' })),
    ...(linkedOverview?.alerts ?? []).map((alert) => ({ time: new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(alert.time)), title: 'Medication alert', detail: alert.message, icon: '!' })),
  ].filter((activity) => !query || `${activity.title} ${activity.detail}`.toLowerCase().includes(query));
  const connected = Boolean(linkedOverview);
  return <View style={[styles.overviewStack, compact && styles.compactOverviewStack]}>
    <View style={[styles.heroCard, compact && styles.compactHeroCard]}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroGreeting}>{greeting}, {caregiverName}</Text>
        <Text style={styles.heroIntro}>Today’s care overview</Text>
        <View style={styles.heroPatientRow}>
          <View style={styles.heroAvatar}><Text style={styles.heroAvatarText}>{(linkedOverview?.profile.name ?? initialProfile.fullName).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text></View>
          <View style={styles.heroPatientCopy}>
            <Text style={styles.heroPatientName}>{linkedOverview?.profile.name ?? initialProfile.fullName}</Text>
            <Text style={styles.heroPatientMeta}>Age {linkedOverview?.profile.age ?? initialProfile.age} · Linked profile</Text>
          </View>
          <StatusPill label={connected ? 'Linked profile' : 'Connecting'} tone={connected ? 'green' : 'amber'} />
        </View>
      </View>
    </View>
    <View style={[styles.statsGrid, compact && styles.compactStatsGrid]}>
      <StatCard compact={compact} icon="✚" label="MEDICATIONS" value={`${taken} of ${doses.length} taken`} note={`${pending} pending · ${missed} missed`} tone="plum" />
      <StatCard compact={compact} icon="♡" label="HEALTH CHECK" value={today?.status === 'completed' ? 'Completed' : 'Pending'} note={today?.time ? `Checked in at ${today.time}` : 'No check-in recorded'} tone="green" />
      <StatCard compact={compact} icon="!" label="EMERGENCY STATUS" value="No active events" note={`${emergencies.length} items in demo history`} tone="amber" />
      <StatCard compact={compact} icon="♧" label="FAMILY MONITORING" value={connected ? 'Connected' : 'Waiting'} note={connected ? 'Linked profile is available' : 'Reconnect to refresh status'} tone="blue" />
    </View>
    <View style={[styles.columns, compact && styles.compactColumns]}>
      <Card style={[styles.columnCard, compact && styles.compactColumnCard]}>
        <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Family monitoring</Text><Text style={styles.cardHint}>Care connection and recent status</Text></View><StatusPill label={connected ? 'Live' : 'Offline'} tone={connected ? 'green' : 'amber'} /></View>
        <MonitorRow icon="✓" title="Connection status" detail={connected ? 'Linked profile is connected' : 'Waiting for profile data'} good={connected} />
        <MonitorRow icon="♡" title="Safety status" detail={linkedOverview?.alerts.length ? `${linkedOverview.alerts.length} medication alert${linkedOverview.alerts.length === 1 ? '' : 's'} to review` : connected ? 'No missed-dose alerts' : 'Waiting for a live status'} good={connected && !linkedOverview?.alerts.length} />
        <MonitorRow icon="◷" title="Last activity" detail={latestCompletedCheck ? `${latestCompletedCheck.date} · ${latestCompletedCheck.time}` : latestTakenDose ? `Dose confirmed · ${latestTakenDose.confirmedAt ?? latestTakenDose.time}` : 'No activity recorded yet'} good={false} />
        <MonitorRow icon="✚" title="Last medication confirmation" detail={latestTakenDose ? `${latestTakenDose.medication} · ${latestTakenDose.confirmedAt ?? latestTakenDose.time}` : 'No dose confirmed yet'} good={Boolean(latestTakenDose)} />
        <Pressable accessibilityRole="button" onPress={() => onNavigate('Family Communication')} style={({ pressed }) => [styles.primaryAction, pressed && styles.cardPressed]}><Text style={styles.primaryActionText}>View family contacts</Text></Pressable>
      </Card>
      <Card style={[styles.columnCard, compact && styles.compactColumnCard]}>
        <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Recent activity</Text><Text style={styles.cardHint}>Updates from the linked care profile</Text></View><Text style={styles.countPill}>Live</Text></View>
        {activities.slice(0, 5).map((activity, index) => <View key={`${activity.title}-${activity.time}`} style={styles.activityRow}><View style={styles.activityTrack}><View style={[styles.activityIcon, index === 0 && styles.activityIconLatest]}><Text style={styles.activityIconText}>{activity.icon}</Text></View>{index < Math.min(activities.length, 5) - 1 ? <View style={styles.trackLine} /> : null}</View><View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.activityDetail}>{activity.detail}</Text></View><Text style={styles.activityTime}>{activity.time}</Text></View>)}
        {!activities.length ? <Text style={styles.emptyText}>{query ? 'No activity matches your search.' : 'No recent health check or medication activity is recorded.'}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => onNavigate('Health Check')} style={styles.outlineAction}><Text style={styles.outlineActionText}>View All Activity</Text></Pressable>
      </Card>
      <Card style={[styles.columnCard, compact && styles.compactColumnCard]}>
        <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Medication schedule</Text><Text style={styles.cardHint}>Today’s scheduled doses</Text></View><Pressable accessibilityRole="button" onPress={() => onNavigate('Medications')}><Text style={styles.textAction}>View all →</Text></Pressable></View>
        {scheduledItems.slice(0, 6).map((dose) => <View key={dose.id} style={styles.reminderRow}><View style={styles.reminderIcon}><Text style={styles.reminderIconText}>✚</Text></View><View style={styles.reminderCopy}><Text style={styles.reminderName}>{dose.medicationName}</Text><Text style={styles.reminderDetail}>{dose.dose}</Text></View><View style={styles.medicationEnd}><Text style={styles.reminderTime}>{new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit' }).format(new Date(dose.scheduledAt))}</Text><StatusPill label={dose.displayStatus === 'taken' ? 'Taken' : dose.displayStatus === 'missed' ? 'Missed' : 'Pending'} tone={dose.displayStatus === 'taken' ? 'green' : dose.displayStatus === 'missed' ? 'red' : 'amber'} /></View></View>)}
        {!scheduledItems.length ? <Text style={styles.emptyText}>{query ? 'No scheduled medication matches your search.' : 'No medication doses are scheduled today.'}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => onNavigate('Medications')} style={styles.outlineAction}><Text style={styles.outlineActionText}>View medicines</Text></Pressable>
      </Card>
    </View>
    <View style={styles.motivationBanner}>
      <View style={styles.motivationHeart}><Text style={styles.motivationHeartText}>♡</Text></View>
      <View style={styles.motivationCopy}><Text style={styles.motivationTitle}>Small actions make a big difference</Text><Text style={styles.motivationSubtitle}>Your support helps {linkedOverview?.profile.name ?? 'your loved one'} live a healthier and happier life.</Text></View>
      <View style={styles.motivationArtwork}><Text style={styles.motivationLeaf}>✦</Text><Text style={styles.motivationPlant}>❧</Text></View>
    </View>
  </View>;
}

function MonitorRow({ icon, title, detail, good }: { icon: string; title: string; detail: string; good: boolean }) {
  return <View style={styles.monitorRow}><View style={[styles.monitorIcon, good && styles.monitorIconGood]}><Text style={[styles.monitorIconText, good && styles.monitorIconTextGood]}>{icon}</Text></View><View style={styles.monitorCopy}><Text style={styles.monitorTitle}>{title}</Text><Text style={styles.monitorDetail}>{detail}</Text></View><View style={[styles.monitorDot, good ? styles.monitorDotGood : styles.monitorDotNeutral]} /></View>;
}
function HealthPage({ checkIns }: { checkIns: FamilyOverview['healthChecks'] }) {
  const latest = checkIns.find((item) => item.status === 'completed');
  const answers = [
    ['How are you feeling today?', latest?.feeling],
    ['Did you sleep well?', latest?.sleptWell],
    ['Are you experiencing any pain?', latest?.pain],
    ['Have you had breakfast?', latest?.breakfast],
  ];
  return <View style={styles.pageStack}>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Latest health check</Text><Text style={styles.cardHint}>{latest ? `${latest.date} at ${latest.time}` : 'No check-in submitted yet'}</Text></View>{latest ? <StatusPill label="Completed" tone="green" /> : <StatusPill label="Pending" tone="amber" />}</View>
      {latest ? <View style={styles.answerGrid}>{answers.map(([question, answer]) => <View key={question} style={styles.answerCard}><Text style={styles.answerQuestion}>{question}</Text><Text style={styles.answerValue}>{answer ?? 'No answer recorded'}</Text></View>)}</View> : <Text style={styles.emptyText}>The older adult’s submitted health checks will appear here.</Text>}
    </Card>
    <Card><Text style={styles.cardTitle}>Check-in history</Text><Text style={styles.cardHint}>A missing check-in does not indicate a health problem.</Text>
      {checkIns.length ? checkIns.map((check) => <View key={check.id} style={styles.historyRow}><View><Text style={styles.historyDate}>{check.date}</Text><Text style={styles.historyTime}>{check.time !== '—' ? `Latest check-in · ${check.time}` : 'No check-in recorded'}</Text></View><StatusPill label={check.status === 'completed' ? 'Completed' : check.status === 'in-progress' ? 'In progress' : 'Not completed'} tone={check.status === 'completed' ? 'green' : check.status === 'in-progress' ? 'amber' : 'neutral'} /></View>) : <Text style={styles.emptyText}>No health check history is available.</Text>}
    </Card>
  </View>;
}

function LinkedMedicationPage({ overview }: { overview: FamilyOverview | null }) {
  if (!overview) return <Text style={styles.emptyText}>The linked profile could not be loaded.</Text>;
  return <View style={styles.pageStack}>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Medication profile</Text><Text style={styles.cardHint}>Read from {overview.profile.name}’s profile</Text></View><StatusPill label="Live from backend" tone="green" /></View>
      {overview.medications.length ? overview.medications.map((medication) => <View key={medication.id} style={styles.eventCard}>
        <Text style={styles.eventTitle}>{medication.name} · {medication.dose}</Text>
        <Text style={styles.eventMeta}>Scheduled: {medication.scheduleTimes.join(', ') || 'No times set'}</Text>
      </View>) : <Text style={styles.emptyText}>No medicines are recorded for this profile.</Text>}
    </Card>
    <Card><Text style={styles.cardTitle}>Today’s doses</Text><Text style={styles.cardHint}>Dose status updates when the older adult confirms a reminder.</Text>
      {overview.today.length ? overview.today.map((dose) => <View key={dose.id} style={styles.historyRow}>
        <View><Text style={styles.historyDate}>{dose.medicationName} · {dose.dose}</Text><Text style={styles.historyTime}>{new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dose.scheduledAt))}</Text></View>
        <StatusPill label={dose.displayStatus === 'upcoming' ? 'Upcoming' : dose.displayStatus === 'due' ? 'Due' : dose.displayStatus === 'taken' ? 'Taken' : 'Missed'} tone={dose.displayStatus === 'taken' ? 'green' : dose.displayStatus === 'missed' ? 'red' : 'amber'} />
      </View>) : <Text style={styles.emptyText}>No doses are scheduled for today.</Text>}
    </Card>
  </View>;
}

function EmergencyPage() {
  return <View style={styles.pageStack}><Card style={styles.safetyBanner}><View style={styles.safetyMark}><Text style={styles.safetyMarkText}>i</Text></View><View style={styles.flexCopy}><Text style={styles.cardTitle}>History view only</Text><Text style={styles.cardHint}>This demo dashboard does not detect emergencies, contact anyone, or call emergency services.</Text></View></Card>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Emergency history</Text><Text style={styles.cardHint}>Example events for the family dashboard</Text></View><Text style={styles.countPill}>{initialEmergencies.length} events</Text></View>
      {initialEmergencies.length ? initialEmergencies.map((event) => <View key={event.id} style={styles.eventCard}><View style={styles.eventTop}><View style={styles.flexCopy}><Text style={styles.eventTitle}>{event.type}</Text><Text style={styles.eventDate}>{event.date} · {event.time}</Text></View><StatusPill label={event.status === 'resolved' ? 'Resolved' : event.status === 'cancelled' ? 'Cancelled' : 'Needs review'} tone={event.status === 'resolved' ? 'green' : event.status === 'cancelled' ? 'neutral' : 'amber'} /></View><Text style={styles.eventDetail}>{event.details}</Text>{event.location ? <Text style={styles.eventMeta}>Location · {event.location}</Text> : null}<Text style={styles.eventMeta}>Family notification · {event.notified ? 'Sent (sample)' : 'Not sent'}</Text></View>) : <Text style={styles.emptyText}>No emergency events have been recorded.</Text>}
    </Card></View>;
}

function CommunicationPage({ contacts }: { contacts: FamilyOverview['contacts'] }) {
  return <View style={styles.pageStack}>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Emergency contacts</Text><Text style={styles.cardHint}>Loaded from the linked older adult’s profile.</Text></View><StatusPill label="Backend connected" tone="green" /></View>
      {contacts.length ? contacts.map((contact) => <View key={contact.id} style={styles.contactCard}><View style={styles.contactIdentity}><View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{contact.name.slice(0, 1)}</Text></View><View><Text style={styles.doseName}>{contact.name}</Text><Text style={styles.doseDetail}>{contact.relationship} · {contact.phone}</Text></View></View><Text style={styles.eventMeta}>{contact.isPrimary ? 'Primary contact' : 'Additional contact'} · {contact.canViewDashboard ? 'Can view dashboard' : 'Dashboard access off'}</Text></View>) : <Text style={styles.emptyText}>No family contacts are available.</Text>}
    </Card>
  </View>;
}

function ProfilePage({ profile, linkedOverview }: { profile: typeof initialProfile; linkedOverview: FamilyOverview | null }) {
  return <View style={styles.pageStack}><Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Linked profile</Text><Text style={styles.cardHint}>Read-only caregiver view. Changes are managed in the older adult’s profile.</Text></View><StatusPill label={linkedOverview ? 'Connected' : 'Unavailable'} tone={linkedOverview ? 'green' : 'amber'} /></View>
    <Text style={styles.historyDate}>Full name · {profile.fullName}</Text><Text style={styles.historyDate}>Age · {profile.age}</Text><Text style={styles.historyDate}>Health conditions · {profile.conditions || 'None listed'}</Text>
    <Text style={styles.formSectionTitle}>Medications</Text>{linkedOverview?.medications.length ? linkedOverview.medications.map((medication) => <Text key={medication.id} style={styles.eventMeta}>{medication.name} · {medication.dose} · {medication.scheduleTimes.join(', ')}</Text>) : <Text style={styles.eventMeta}>None listed</Text>}
    <Text style={styles.formSectionTitle}>Emergency contacts</Text>{linkedOverview?.contacts.map((contact) => <Text key={contact.id} style={styles.eventMeta}>{contact.name} · {contact.relationship} · {contact.phone}</Text>)}
  </Card></View>;
}

function SettingsPage({ onSignOut }: { onSignOut: () => void }) {
  return <View style={styles.pageStack}><Card><Text style={styles.cardTitle}>Settings</Text><Text style={styles.cardHint}>Demo settings are not saved.</Text><View style={styles.settingRow}><View style={styles.flexCopy}><Text style={styles.historyDate}>Notifications</Text><Text style={styles.historyTime}>Sample alerts appear in the bell menu.</Text></View><StatusPill label="Demo" tone="neutral" /></View><View style={styles.settingRow}><View style={styles.flexCopy}><Text style={styles.historyDate}>Data source</Text><Text style={styles.historyTime}>Sample dashboard data.</Text></View><StatusPill label="Sample" tone="neutral" /></View><Pressable accessibilityRole="button" onPress={onSignOut} style={styles.outlineAction}><Text style={styles.outlineActionText}>Sign out</Text></Pressable></Card></View>;
}

function NotificationPanel({ items, onRead, onClose }: { items: DashboardNotification[]; onRead: (id: string) => void; onClose: () => void }) {
  return <View style={styles.notificationPanel}><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Notifications</Text><Text style={styles.cardHint}>{items.filter((item) => !item.read).length} unread · linked profile alerts</Text></View><Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.textAction}>Close</Text></Pressable></View>
    {items.length ? items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.read ? 'Read' : 'Mark as read'}`} onPress={() => onRead(item.id)} style={[styles.notificationRow, !item.read && styles.notificationUnread]}><View style={[styles.notificationDot, item.kind === 'emergency' ? styles.dotRed : item.kind === 'medication' ? styles.dotAmber : styles.dotGreen]} /><View style={styles.flexCopy}><Text style={styles.notificationTitle}>{item.title}</Text><Text style={styles.notificationDetail}>{item.detail}</Text><Text style={styles.notificationTime}>{item.time}</Text></View><Text style={styles.textAction}>{item.read ? 'Read' : 'Mark read'}</Text></Pressable>) : <Text style={styles.emptyText}>You’re all caught up.</Text>}
  </View>;
}

function StatCard({ icon, label, value, note, tone, compact }: { icon: string; label: string; value: string; note: string; tone: 'green' | 'plum' | 'amber' | 'blue'; compact: boolean }) {
  const toneStyle = tone === 'green' ? styles.statGreen : tone === 'plum' ? styles.statPlum : tone === 'amber' ? styles.statAmber : styles.statBlue;
  return <Card style={[styles.statCard, compact && styles.compactStatCard, toneStyle]}><View style={styles.statCardTop}><View style={[styles.statIconWrap, toneStyle]}><Text style={styles.statIcon}>{icon}</Text></View><Text style={styles.statLabel}>{label}</Text></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statNote}>{note}</Text></Card>;
}

function Card({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' }) {
  return <View style={[styles.statusPill, tone === 'green' ? styles.statusGreen : tone === 'amber' ? styles.statusAmber : tone === 'red' ? styles.statusRed : styles.statusNeutral]}><Text style={[styles.statusText, tone === 'green' ? styles.statusGreenText : tone === 'amber' ? styles.statusAmberText : tone === 'red' ? styles.statusRedText : styles.statusNeutralText]}>{label}</Text></View>;
}

const legacyStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background },
  shell: { flex: 1, width: '100%', maxWidth: 1440, alignSelf: 'center', flexDirection: 'row' },
  wideShell: { padding: 28, gap: 26 },
  sidebar: { width: 232, backgroundColor: Palette.white, borderRadius: 13, padding: 18, borderWidth: 1, borderColor: Palette.muted },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 28 },
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: Palette.primary, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: Palette.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  logoTitle: { color: Palette.primary, fontSize: 15, fontWeight: '700' }, logoSub: { color: Palette.primary, fontSize: 11, marginTop: 2 },
  navCaption: { color: Palette.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, paddingHorizontal: 11, marginBottom: 9 },
  navItem: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 3 },
  navItemActive: { backgroundColor: Palette.background, borderLeftWidth: 3, borderLeftColor: Palette.primary, paddingLeft: 7 }, navItemCompact: { paddingHorizontal: 12, borderWidth: 1, borderColor: Palette.muted, marginBottom: 0 },
  navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Palette.muted, marginHorizontal: 5 }, navDotActive: { backgroundColor: Palette.primary },
  navLabel: { flex: 1, color: Palette.primary, fontSize: 13, fontWeight: '500' }, navLabelActive: { color: Palette.text, fontWeight: '700' },
  sideFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center' }, helpIconText: { color: Palette.primary, fontWeight: '700' }, sideFooterText: { color: Palette.textSecondary, fontSize: 11, lineHeight: 16 },
  main: { flex: 1, minWidth: 0 },
  familyStatus: { color: Palette.primary, backgroundColor: Palette.white, padding: 12, borderRadius: 8, fontSize: 13 },
  familyError: { color: Palette.error, backgroundColor: Palette.background, padding: 12, borderRadius: 8, fontSize: 13 },
  topbar: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: Palette.muted },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandMark: { width: 35, height: 35, borderRadius: 9, backgroundColor: Palette.primary, color: Palette.white, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  greeting: { color: Palette.primary, fontSize: 15, fontWeight: '700' }, patientLine: { color: Palette.textSecondary, fontSize: 12, marginTop: 3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, notificationButton: { minWidth: 72, height: 38, paddingHorizontal: 11, borderRadius: 8, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.muted, alignItems: 'center', justifyContent: 'center' }, alertsLabel: { color: Palette.primary, fontSize: 12, fontWeight: '600' }, badge: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9, color: Palette.white, backgroundColor: Palette.primary, textAlign: 'center', fontSize: 10, lineHeight: 17, fontWeight: '700', overflow: 'hidden' },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 4 }, avatar: { width: 34, height: 34, borderRadius: 9, backgroundColor: Palette.background, color: Palette.primary, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', fontWeight: '700', fontSize: 14 }, accountName: { color: Palette.primary, fontSize: 12, fontWeight: '600' },
  mobileNav: { gap: 7, paddingVertical: 11, paddingHorizontal: 18 },
  scrollContent: { paddingTop: 27, paddingBottom: 36, paddingHorizontal: 18, gap: 21 },
  pageHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  eyebrow: { color: Palette.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.25, marginBottom: 6 }, pageTitle: { color: Palette.primary, fontSize: 31, fontWeight: '700', letterSpacing: -0.6 }, pageSubtitle: { color: Palette.textSecondary, fontSize: 14, marginTop: 6 },
  demoPill: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 5, backgroundColor: Palette.background }, demoPillText: { color: Palette.primary, fontWeight: '600', fontSize: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, card: { backgroundColor: Palette.white, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: Palette.muted, gap: 16 }, statCard: { flexGrow: 1, flexBasis: 190, minWidth: 160, minHeight: 132, padding: 18, gap: 11, borderLeftWidth: 3 }, statGreen: { borderLeftColor: Palette.success }, statPlum: { borderLeftColor: Palette.primary }, statAmber: { borderLeftColor: Palette.warning }, statBlue: { borderLeftColor: Palette.primary }, statLabel: { color: Palette.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, flexShrink: 1 },
  linkedCard: { borderColor: Palette.muted, borderLeftWidth: 4, borderLeftColor: Palette.success }, linkedName: { color: Palette.primary, fontSize: 21, fontWeight: '700' }, linkedDetail: { color: Palette.primary, fontSize: 13, lineHeight: 20 },
  statValue: { color: Palette.primary, fontSize: 22, fontWeight: '700' }, statNote: { color: Palette.textSecondary, fontSize: 12, lineHeight: 18 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, columnCard: { flexGrow: 1, flexBasis: 330, minWidth: 260 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, cardTitle: { color: Palette.primary, fontSize: 17, fontWeight: '700' }, cardHint: { color: Palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }, countPill: { color: Palette.primary, fontSize: 10, fontWeight: '600', backgroundColor: Palette.background, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 5 }, textAction: { color: Palette.primary, fontSize: 12, fontWeight: '700' },
  activityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 12 }, activityTrack: { width: 12, alignItems: 'center' }, activityIcon: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.primary, marginTop: 4 }, activityIconText: { display: 'none' }, trackLine: { width: 1, height: 28, backgroundColor: Palette.muted }, activityCopy: { flex: 1, gap: 4 }, activityTitle: { color: Palette.primary, fontSize: 13, fontWeight: '600' }, activityDetail: { color: Palette.textSecondary, fontSize: 11 }, activityTime: { color: Palette.textSecondary, fontSize: 10, maxWidth: 94, textAlign: 'right' }, mockLabel: { color: Palette.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: Palette.background }, reminderIcon: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.textSecondary, alignItems: 'center', justifyContent: 'center' }, reminderIconText: { display: 'none' }, reminderCopy: { flex: 1 }, reminderName: { color: Palette.primary, fontSize: 13, fontWeight: '600' }, reminderDetail: { color: Palette.textSecondary, fontSize: 11, marginTop: 4 }, reminderTime: { color: Palette.primary, fontSize: 11, fontWeight: '600' }, outlineAction: { borderWidth: 1, borderColor: Palette.muted, backgroundColor: Palette.background, minHeight: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, outlineActionText: { color: Palette.primary, fontSize: 12, fontWeight: '700' },
  disclaimer: { color: Palette.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'left', paddingHorizontal: 2 },
  pageStack: { gap: 16 }, answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, answerCard: { flexGrow: 1, flexBasis: 180, backgroundColor: Palette.background, borderRadius: 8, padding: 15, gap: 8 }, answerQuestion: { color: Palette.textSecondary, fontSize: 12 }, answerValue: { color: Palette.primary, fontSize: 16, fontWeight: '700' }, historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 14 }, historyDate: { color: Palette.primary, fontSize: 13, fontWeight: '600' }, historyTime: { color: Palette.textSecondary, fontSize: 11, marginTop: 4 },
  statusPill: { borderRadius: 5, paddingVertical: 5, paddingHorizontal: 8 }, statusGreen: { backgroundColor: Palette.background }, statusAmber: { backgroundColor: Palette.background }, statusRed: { backgroundColor: Palette.background }, statusNeutral: { backgroundColor: Palette.background }, statusText: { fontSize: 11, fontWeight: '600' }, statusGreenText: { color: Palette.success }, statusAmberText: { color: Palette.warning }, statusRedText: { color: Palette.error }, statusNeutralText: { color: Palette.textSecondary }, emptyText: { color: Palette.textSecondary, fontSize: 13, paddingVertical: 15 },
  summaryStrip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, backgroundColor: Palette.white, padding: 17, borderRadius: 10, borderWidth: 1, borderColor: Palette.muted }, summaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 7 }, metricDot: { width: 7, height: 7, borderRadius: 4 }, dotGreen: { backgroundColor: Palette.success }, dotAmber: { backgroundColor: Palette.warning }, dotRed: { backgroundColor: Palette.error }, summaryCount: { color: Palette.primary, fontWeight: '700', fontSize: 15 }, summaryLabel: { color: Palette.textSecondary, fontSize: 11 }, summaryHint: { color: Palette.textSecondary, fontSize: 11, marginLeft: 'auto' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, filterChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: Palette.muted, justifyContent: 'center', backgroundColor: Palette.white }, filterChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary }, filterText: { color: Palette.textSecondary, fontSize: 11, fontWeight: '600' }, filterTextActive: { color: Palette.white }, doseRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 11, borderTopWidth: 1, borderTopColor: Palette.background, paddingVertical: 12 }, doseTime: { width: 76 }, doseTimeText: { color: Palette.primary, fontSize: 11, fontWeight: '600' }, doseInfo: { flex: 1, minWidth: 130 }, doseName: { color: Palette.primary, fontSize: 14, fontWeight: '600' }, doseDetail: { color: Palette.textSecondary, fontSize: 11, marginTop: 4 }, doseConfirmed: { color: Palette.success, fontSize: 10, marginTop: 4 }, smallAction: { borderRadius: 6, backgroundColor: Palette.background, paddingHorizontal: 10, paddingVertical: 8 }, smallActionText: { color: Palette.primary, fontSize: 10, fontWeight: '700' },
  safetyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.background, borderColor: Palette.warningSurface }, safetyMark: { width: 27, height: 27, borderRadius: 7, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center' }, safetyMarkText: { color: Palette.warning, fontWeight: '700' }, flexCopy: { flex: 1 }, eventCard: { borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 15, gap: 9 }, eventTop: { flexDirection: 'row', gap: 12, alignItems: 'center' }, eventTitle: { color: Palette.primary, fontSize: 14, fontWeight: '600' }, eventDate: { color: Palette.textSecondary, fontSize: 11, marginTop: 4 }, eventDetail: { color: Palette.primary, fontSize: 12, lineHeight: 19 }, eventMeta: { color: Palette.textSecondary, fontSize: 11 },
  contactCard: { borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 15, gap: 10 }, contactIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11 }, contactAvatar: { width: 36, height: 36, borderRadius: 9, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center' }, contactAvatarText: { color: Palette.primary, fontWeight: '700' }, contactActions: { flexDirection: 'row', gap: 8 }, contactButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 6, borderWidth: 1, borderColor: Palette.muted, justifyContent: 'center' }, contactButtonText: { color: Palette.primary, fontSize: 11, fontWeight: '700' }, feedback: { color: Palette.success, backgroundColor: Palette.background, borderRadius: 6, padding: 11, fontSize: 12 },
  field: { gap: 6 }, fieldLabel: { color: Palette.primary, fontSize: 11, fontWeight: '600' }, input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: Palette.muted, backgroundColor: Palette.white, color: Palette.primary, fontSize: 14 }, formSectionTitle: { color: Palette.primary, fontSize: 13, fontWeight: '700', marginTop: 5 }, validationError: { color: Palette.error, backgroundColor: Palette.background, borderRadius: 6, padding: 11, fontSize: 12 }, primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 7, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, primaryButtonText: { color: Palette.white, fontSize: 12, fontWeight: '700' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 12 },
  notificationPanel: { position: 'absolute', zIndex: 20, top: 58, right: 4, width: 370, maxWidth: '94%', backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.muted, borderRadius: 10, padding: 17, shadowColor: Palette.primary, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6, gap: 12 }, notificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 9, borderRadius: 6 }, notificationUnread: { backgroundColor: Palette.background }, notificationDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 }, notificationTitle: { color: Palette.primary, fontSize: 12, fontWeight: '600' }, notificationDetail: { color: Palette.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 }, notificationTime: { color: Palette.textSecondary, fontSize: 10, marginTop: 5 },
});

const styles = {
  ...legacyStyles,
  ...StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    compactShell: { paddingHorizontal: 0 },
    compactTopbar: { minHeight: 68, paddingHorizontal: 12, gap: 8, borderRadius: 0 },
    mobileMenuButton: { width: 44, height: 46, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background },
    menuGlyph: { gap: 4 },
    menuGlyphLine: { width: 20, height: 2, borderRadius: 1, backgroundColor: Palette.primary },
    mobileDrawerLayer: { position: 'absolute' as const, zIndex: 40, top: 68, bottom: 0, left: 0, right: 0 },
    mobileDrawerBackdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 26, 43, 0.28)' },
    mobileDrawer: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, width: '84%', maxWidth: 320, backgroundColor: Palette.white, borderTopRightRadius: 20, padding: 18 },
    mobileDrawerHeader: { minHeight: 52, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10, borderBottomWidth: 1, borderBottomColor: Palette.background, marginBottom: 12 },
    mobileDrawerTitle: { color: Palette.text, fontSize: 18, fontWeight: '800' as const },
    mobileDrawerClose: { minWidth: 56, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    mobileDrawerCloseText: { color: Palette.primary, fontSize: 14, fontWeight: '700' as const },
    mobileDrawerItems: { gap: 4, paddingBottom: 16 },
    compactScrollContent: { paddingTop: 16, paddingBottom: 28, paddingHorizontal: 14, gap: 16 },
    compactOverviewStack: { gap: 14 },
    compactHeroCard: { minHeight: 0, padding: 16, borderRadius: 18, justifyContent: 'flex-start' as const },
    compactStatsGrid: { gap: 10 },
    compactStatCard: { flexBasis: '45%', minWidth: 0, minHeight: 132, padding: 12, gap: 8 },
    compactStatIconWrap: { width: 30, height: 30, borderRadius: 10 },
    compactColumns: { gap: 12 },
    compactColumnCard: { flexBasis: '100%', minWidth: 0, padding: 14 },
    shell: { flex: 1, width: '100%', maxWidth: 1680, alignSelf: 'center', flexDirection: 'row' as const },
    wideShell: { padding: 22, gap: 22 },
    sidebar: { width: 260, backgroundColor: Palette.white, padding: 22, borderRadius: 24, borderWidth: 1, borderColor: Palette.background, shadowColor: Palette.text, shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
    logoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingBottom: 34, minHeight: 72 },
    logo: { width: 46, height: 46, borderRadius: 16, backgroundColor: Palette.primary, justifyContent: 'center' as const, alignItems: 'center' as const },
    logoText: { color: Palette.white, fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.4 },
    logoTitle: { color: Palette.text, fontSize: 18, fontWeight: '800' as const },
    logoSub: { color: Palette.primary, fontSize: 11, marginTop: 3 },
    navCaption: { color: Palette.muted, fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.5, paddingHorizontal: 12, marginBottom: 10 },
    navItem: { minHeight: 50, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 12, borderRadius: 15, marginBottom: 5 },
    navItemActive: { backgroundColor: Palette.background, borderLeftWidth: 0, paddingLeft: 12 },
    navItemCompact: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: Palette.background, marginBottom: 0 },
    navLabel: { flex: 1, color: Palette.textSecondary, fontSize: 15, fontWeight: '600' as const },
    navLabelActive: { color: Palette.primary, fontWeight: '800' as const },
    navItemIcon: { color: Palette.textSecondary, fontSize: 20, width: 24, textAlign: 'center' as const },
    navItemIconActive: { color: Palette.primary },
    sideFooter: { marginTop: 'auto' as const, borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 18, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
    helpIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const },
    helpIconText: { color: Palette.primary, fontWeight: '800' as const },
    sideFooterText: { color: Palette.primary, fontSize: 12, lineHeight: 18 },
    main: { flex: 1, minWidth: 0, backgroundColor: Palette.background, position: 'relative' as const },
    topbar: { minHeight: 78, paddingHorizontal: 20, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 14, backgroundColor: Palette.white, borderBottomWidth: 1, borderBottomColor: Palette.background, borderRadius: 20, marginBottom: 3 },
    topActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 15 },
    searchBox: { minHeight: 46, maxWidth: 470, flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9, paddingHorizontal: 14, borderRadius: 15, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.background },
    searchIcon: { color: Palette.primary, fontSize: 24, lineHeight: 28 },
    searchInput: { flex: 1, minWidth: 0, color: Palette.text, fontSize: 14, paddingVertical: 8, outlineStyle: 'none' as never },
    notificationButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const },
    notificationIcon: { color: Palette.primary, fontSize: 22 },
    badge: { position: 'absolute' as const, top: -3, right: -3, minWidth: 19, height: 19, borderRadius: 10, color: Palette.white, backgroundColor: Palette.errorSurface, textAlign: 'center' as const, fontSize: 11, lineHeight: 19, fontWeight: '800' as const, overflow: 'hidden' as const },
    accountChip: { minHeight: 48, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9, paddingHorizontal: 5 },
    avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: Palette.background, color: Palette.primary, textAlign: 'center' as const, textAlignVertical: 'center' as const, overflow: 'hidden' as const, fontWeight: '800' as const, fontSize: 14 },
    accountName: { color: Palette.text, fontSize: 14, fontWeight: '700' as const },
    accountChevron: { color: Palette.primary, fontSize: 20 },
    accountMenu: { position: 'absolute' as const, zIndex: 30, top: 70, right: 15, width: 220, padding: 8, borderRadius: 18, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background, shadowColor: Palette.text, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
    accountMenuItem: { minHeight: 46, justifyContent: 'center' as const, paddingHorizontal: 12, borderRadius: 12 },
    accountMenuText: { color: Palette.text, fontSize: 14, fontWeight: '600' as const },
    mobileNav: { gap: 8, paddingVertical: 12, paddingHorizontal: 17 },
    scrollContent: { paddingTop: 23, paddingBottom: 38, paddingHorizontal: 20, gap: 22 },
    pageHeading: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, gap: 12, flexWrap: 'wrap' as const },
    eyebrow: { color: Palette.primary, fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.4, marginBottom: 7 },
    pageTitle: { color: Palette.text, fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
    pageSubtitle: { color: Palette.primary, fontSize: 14, marginTop: 6 },
    demoPill: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 14, backgroundColor: Palette.background },
    demoPillText: { color: Palette.success, fontWeight: '700' as const, fontSize: 13 },
    statsGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 14 },
    card: { backgroundColor: Palette.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Palette.background, gap: 14 },
    statCard: { flexGrow: 1, flexBasis: 180, minWidth: 155, minHeight: 148, padding: 17, gap: 10, borderLeftWidth: 0 },
    statGreen: { borderColor: Palette.background }, statPlum: { borderColor: Palette.background }, statAmber: { borderColor: Palette.warningSurface }, statBlue: { borderColor: Palette.background },
    statCardTop: { minHeight: 38, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
    statIconWrap: { width: 36, height: 36, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background },
    statIcon: { color: Palette.primary, fontSize: 19, fontWeight: '800' as const },
    statLabel: { color: Palette.primary, fontSize: 14, fontWeight: '700' as const, flexShrink: 1 },
    statValue: { color: Palette.text, fontSize: 21, fontWeight: '800' as const },
    statNote: { color: Palette.primary, fontSize: 14, lineHeight: 20 },
    linkedCard: { borderColor: Palette.muted, borderLeftWidth: 4, borderLeftColor: Palette.success },
    linkedName: { color: Palette.text, fontSize: 22, fontWeight: '800' as const },
    linkedDetail: { color: Palette.primary, fontSize: 14, lineHeight: 21 },
    columns: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'stretch' as const, gap: 16 },
    columnCard: { flexGrow: 1, flexBasis: 300, minWidth: 260, padding: 18 },
    cardHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 12 },
    cardTitle: { color: Palette.text, fontSize: 18, fontWeight: '800' as const },
    cardHint: { color: Palette.primary, fontSize: 14, lineHeight: 20, marginTop: 4 },
    countPill: { color: Palette.primary, fontSize: 14, fontWeight: '700' as const, backgroundColor: Palette.background, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
    textAction: { color: Palette.primary, fontSize: 16, fontWeight: '700' as const },
    activityRow: { minHeight: 64, flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 13 },
    activityTrack: { width: 23, alignItems: 'center' as const },
    activityIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 1 },
    activityIconLatest: { backgroundColor: Palette.background },
    activityIconText: { display: 'flex' as const, color: Palette.primary, fontSize: 13, fontWeight: '800' as const },
    trackLine: { width: 1, minHeight: 29, backgroundColor: Palette.background },
    activityCopy: { flex: 1, gap: 4 },
    activityTitle: { color: Palette.text, fontSize: 15, fontWeight: '700' as const },
    activityDetail: { color: Palette.primary, fontSize: 14, lineHeight: 20 },
    activityTime: { color: Palette.primary, fontSize: 13, maxWidth: 105, textAlign: 'right' as const },
    reminderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: Palette.background },
    reminderIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const },
    reminderIconText: { display: 'flex' as const, color: Palette.primary, fontSize: 17, fontWeight: '800' as const },
    reminderCopy: { flex: 1 },
    reminderName: { color: Palette.text, fontSize: 16, fontWeight: '700' as const },
    reminderDetail: { color: Palette.primary, fontSize: 14, marginTop: 4 },
    reminderTime: { color: Palette.text, fontSize: 14, fontWeight: '700' as const, textAlign: 'right' as const },
    medicationEnd: { alignItems: 'flex-end' as const, gap: 6 },
    outlineAction: { borderWidth: 1, borderColor: Palette.muted, backgroundColor: Palette.white, minHeight: 46, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
    outlineActionText: { color: Palette.primary, fontSize: 16, fontWeight: '700' as const },
    statusPill: { borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    statusGreen: { backgroundColor: Palette.background }, statusAmber: { backgroundColor: Palette.warningSurface }, statusRed: { backgroundColor: Palette.background }, statusNeutral: { backgroundColor: Palette.background },
    statusText: { fontSize: 14, fontWeight: '700' as const }, statusGreenText: { color: Palette.success }, statusAmberText: { color: Palette.warning }, statusRedText: { color: Palette.error }, statusNeutralText: { color: Palette.textSecondary },
    emptyText: { color: Palette.primary, fontSize: 15, lineHeight: 21, paddingVertical: 13 },
    pageStack: { gap: 17 },
    answerCard: { flexGrow: 1, flexBasis: 180, backgroundColor: Palette.background, borderRadius: 16, padding: 15, gap: 8 },
    historyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12, borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 15 },
    historyDate: { color: Palette.text, fontSize: 14, fontWeight: '700' as const },
    historyTime: { color: Palette.primary, fontSize: 14, marginTop: 4 },
    answerQuestion: { color: Palette.primary, fontSize: 14 }, answerValue: { color: Palette.text, fontSize: 17, fontWeight: '700' as const },
    familyStatus: { color: Palette.primary, backgroundColor: Palette.white, padding: 13, borderRadius: 14, fontSize: 15 },
    familyError: { color: Palette.error, backgroundColor: Palette.background, padding: 13, borderRadius: 14, fontSize: 15 },
    disclaimer: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'left' as const, paddingHorizontal: 2 },
    eventCard: { borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 15, gap: 9 },
    eventTitle: { color: Palette.text, fontSize: 16, fontWeight: '700' as const }, eventDate: { color: Palette.primary, fontSize: 14, marginTop: 4 }, eventDetail: { color: Palette.text, fontSize: 15, lineHeight: 22 }, eventMeta: { color: Palette.primary, fontSize: 14 },
    contactCard: { borderTopWidth: 1, borderTopColor: Palette.background, paddingTop: 15, gap: 10 },
    contactAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const },
    contactAvatarText: { color: Palette.primary, fontWeight: '800' as const },
    notificationPanel: { position: 'absolute' as const, zIndex: 25, top: 68, right: 12, width: 390, maxWidth: '94%', backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background, borderRadius: 22, padding: 18, shadowColor: Palette.primary, shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 9, gap: 12 },
    notificationRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, padding: 11, borderRadius: 13 },
    notificationUnread: { backgroundColor: Palette.background }, notificationDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
    notificationTitle: { color: Palette.text, fontSize: 15, fontWeight: '700' as const }, notificationDetail: { color: Palette.primary, fontSize: 14, lineHeight: 20, marginTop: 3 }, notificationTime: { color: Palette.textSecondary, fontSize: 13, marginTop: 5 },
    overviewStack: { gap: 22 },
    heroCard: { minHeight: 240, position: 'relative' as const, overflow: 'hidden' as const, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 25, borderRadius: 26, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.background },
    heroCopy: { flex: 1, maxWidth: 790, zIndex: 1 },
    heroGreeting: { color: Palette.primary, fontSize: 15, fontWeight: '800' as const }, heroIntro: { color: Palette.text, fontSize: 15, marginTop: 5, marginBottom: 17 },
    heroPatientRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flexWrap: 'wrap' as const },
    heroAvatar: { width: 62, height: 62, borderRadius: 22, backgroundColor: Palette.white, borderWidth: 2, borderColor: Palette.white, alignItems: 'center' as const, justifyContent: 'center' as const, shadowColor: Palette.text, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    heroAvatarText: { color: Palette.primary, fontSize: 20, fontWeight: '800' as const }, heroPatientCopy: { minWidth: 145, flex: 1 }, heroPatientName: { color: Palette.text, fontSize: 22, fontWeight: '800' as const }, heroPatientMeta: { color: Palette.primary, fontSize: 13, marginTop: 3 },
    heroQuote: { color: Palette.primary, fontSize: 14, fontWeight: '700' as const, fontStyle: 'italic' as const, marginTop: 15 },
    heroArtwork: { width: 185, height: 190, alignItems: 'center' as const, justifyContent: 'center' as const, marginLeft: 12 },
    heroOrbLarge: { width: 150, height: 150, borderRadius: 75, backgroundColor: Palette.white72, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: Palette.white90 },
    heroHeart: { color: Palette.primary, fontSize: 94, lineHeight: 110 }, heroLeafOne: { position: 'absolute' as const, right: 8, top: 20, width: 48, height: 48, borderRadius: 18, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const, transform: [{ rotate: '14deg' }] },
    heroLeafTwo: { position: 'absolute' as const, left: 7, bottom: 25, width: 39, height: 39, borderRadius: 15, backgroundColor: Palette.warningSurface, alignItems: 'center' as const, justifyContent: 'center' as const, transform: [{ rotate: '-15deg' }] },
    leafGlyph: { color: Palette.success, fontSize: 20 }, heroPlus: { position: 'absolute' as const, right: 20, bottom: 27, width: 34, height: 34, borderRadius: 13, backgroundColor: Palette.primary, alignItems: 'center' as const, justifyContent: 'center' as const }, heroPlusText: { color: Palette.white, fontSize: 25, fontWeight: '500' as const, lineHeight: 28 },
    monitorRow: { minHeight: 55, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9, borderBottomWidth: 1, borderBottomColor: Palette.background, paddingVertical: 8 },
    monitorIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: Palette.background, alignItems: 'center' as const, justifyContent: 'center' as const }, monitorIconGood: { backgroundColor: Palette.background }, monitorIconText: { color: Palette.primary, fontSize: 15, fontWeight: '800' as const }, monitorIconTextGood: { color: Palette.success },
    monitorCopy: { flex: 1 }, monitorTitle: { color: Palette.text, fontSize: 12, fontWeight: '800' as const }, monitorDetail: { color: Palette.primary, fontSize: 11, lineHeight: 15, marginTop: 2 }, monitorDot: { width: 8, height: 8, borderRadius: 4 }, monitorDotGood: { backgroundColor: Palette.success }, monitorDotNeutral: { backgroundColor: Palette.warningSurface },
    primaryAction: { minHeight: 54, borderRadius: 14, backgroundColor: Palette.primary, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 1 }, primaryActionText: { color: Palette.white, fontSize: 16, fontWeight: '700' as const }, cardPressed: { opacity: 0.85 },
    motivationBanner: { minHeight: 105, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 15, paddingHorizontal: 20, paddingVertical: 17, overflow: 'hidden' as const, borderRadius: 23, backgroundColor: Palette.background, borderWidth: 1, borderColor: Palette.warningSurface },
    motivationHeart: { width: 49, height: 49, borderRadius: 17, backgroundColor: Palette.white, alignItems: 'center' as const, justifyContent: 'center' as const }, motivationHeartText: { color: Palette.primary, fontSize: 30 }, motivationCopy: { flex: 1 }, motivationTitle: { color: Palette.error, fontSize: 16, fontWeight: '800' as const }, motivationSubtitle: { color: Palette.error, fontSize: 13, lineHeight: 19, marginTop: 4 }, motivationArtwork: { width: 74, height: 65, alignItems: 'center' as const, justifyContent: 'center' as const }, motivationLeaf: { color: Palette.success, fontSize: 22, position: 'absolute' as const, right: 7, top: 0 }, motivationPlant: { color: Palette.success, fontSize: 53, lineHeight: 58 },
  }),
};
