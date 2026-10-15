import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import {
  initialCheckIns,
  initialContacts,
  initialDoses,
  initialEmergencies,
  initialNotifications,
  initialProfile,
  getHealthChecksForPatient,
  subscribeToHealthChecks,
  upcomingReminders,
  type DashboardDose,
  type DashboardNotification,
  type MockDoseStatus,
} from '@/family-dashboard/mock-data';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
const statusLabels: Record<MockDoseStatus, string> = { taken: 'Taken', pending: 'Pending', postponed: 'Postponed', missed: 'Missed' };

export default function FamilyDashboard() {
  const router = useRouter();
  const { user, logOut } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [section, setSection] = useState<Section>('Overview');
  const [checkIns, setCheckIns] = useState(() => getHealthChecksForPatient(initialProfile.fullName));
  const [doses, setDoses] = useState(initialDoses);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [profile, setProfile] = useState(initialProfile);
  const [filter, setFilter] = useState<'all' | MockDoseStatus>('all');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const unread = notifications.filter((item) => !item.read).length;
  const taken = doses.filter((dose) => dose.status === 'taken').length;
  const pending = doses.filter((dose) => dose.status === 'pending' || dose.status === 'postponed').length;
  const missed = doses.filter((dose) => dose.status === 'missed').length;
  const visibleDoses = useMemo(() => filter === 'all' ? doses : doses.filter((dose) => dose.status === filter), [doses, filter]);

  useEffect(() => subscribeToHealthChecks(() => {
    setCheckIns(getHealthChecksForPatient(profile.fullName));
  }), [profile.fullName]);

  function changeDose(id: string, status: MockDoseStatus) {
    setDoses((items) => items.map((dose) => dose.id === id ? { ...dose, status, confirmedAt: status === 'taken' ? 'Just now · demo' : undefined } : dose));
  }

  function markRead(id: string) {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  function updateProfile(field: keyof typeof initialProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function saveProfile() {
    if (!profile.fullName.trim() || !/^\d{1,3}$/.test(profile.age) || Number(profile.age) < 1 || Number(profile.age) > 120) {
      setSavedMessage('Enter a name and an age from 1 to 120.');
      return;
    }
    setSavedMessage('Profile updated for this demo session only.');
  }

  const timeOfDay = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date()));
  const greetingText = timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.screen}>
      <View style={[styles.shell, wide && styles.wideShell]}>
        {wide ? <Sidebar section={section} onSelect={setSection} onHome={() => router.replace('/')} /> : null}
        <View style={styles.main}>
          <View style={styles.topbar}>
            <View style={styles.brandRow}>
              {!wide ? <Text style={styles.brandMark}>CC</Text> : null}
              <View>
                <Text style={styles.greeting}>{greetingText}, {user?.fullName?.split(' ')[0] ?? 'Caregiver'}</Text>
                <Text style={styles.patientLine}>Care overview for {profile.fullName}</Text>
              </View>
            </View>
            <View style={styles.topActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${unread} unread notifications`} onPress={() => setNoticeOpen((open) => !open)} style={styles.notificationButton}>
                <Text style={styles.alertsLabel}>Alerts</Text>
                {unread > 0 ? <Text style={styles.badge}>{unread}</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSection('User Profile')} style={styles.accountChip}>
                <Text style={styles.avatar}>{profile.fullName.slice(0, 1).toUpperCase()}</Text>
                {wide ? <Text style={styles.accountName}>{profile.fullName}</Text> : null}
              </Pressable>
            </View>
          </View>
          {noticeOpen ? <NotificationPanel items={notifications} onRead={markRead} onClose={() => setNoticeOpen(false)} /> : null}
          {!wide ? <MobileNavigation section={section} onSelect={setSection} /> : null}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.pageHeading}>
              <View>
                <Text style={styles.eyebrow}>FAMILY DASHBOARD · DEMO DATA</Text>
                <Text style={styles.pageTitle}>{section}</Text>
                <Text style={styles.pageSubtitle}>Today’s overview for {profile.fullName.split(' ')[0] || 'your family member'}.</Text>
              </View>
              <View style={styles.demoPill}><Text style={styles.demoPillText}>SAMPLE DATA</Text></View>
            </View>
            {section === 'Overview' ? <Overview checkIns={checkIns} doses={doses} taken={taken} pending={pending} missed={missed} emergencies={initialEmergencies} onNavigate={setSection} /> : null}
            {section === 'Health Check' ? <HealthPage checkIns={checkIns} /> : null}
            {section === 'Medications' ? <MedicationPage doses={visibleDoses} allDoses={doses} filter={filter} onFilter={setFilter} onChange={changeDose} /> : null}
            {section === 'Emergency History' ? <EmergencyPage /> : null}
            {section === 'Family Communication' ? <CommunicationPage message={contactMessage} onContact={(name, method) => setContactMessage(`Demo only: ${method.toLowerCase()} with ${name} is not initiated.`)} /> : null}
            {section === 'User Profile' ? <ProfilePage profile={profile} onChange={updateProfile} onSave={saveProfile} message={savedMessage} /> : null}
            {section === 'Settings' ? <SettingsPage onSignOut={async () => { await logOut(); router.replace('/login'); }} /> : null}
            <Text style={styles.disclaimer}>Fictional demo data for layout preview. It is not live health information and does not provide medical guidance.</Text>
          </ScrollView>
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
    <View style={styles.sideFooter}><View style={styles.helpIcon}><Text style={styles.helpIconText}>i</Text></View><Text style={styles.sideFooterText}>Demo dashboard{ '\n' }Mock information only</Text></View>
  </View>;
}

function MobileNavigation({ section, onSelect }: { section: Section; onSelect: (item: Section) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNav}>
    {sections.map((item) => <NavItem key={item.title} item={item} active={item.title === section} onPress={() => onSelect(item.title)} compact />)}
  </ScrollView>;
}

function NavItem({ item, active, onPress, compact = false }: { item: { title: Section }; active: boolean; onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.navItem, active && styles.navItemActive, compact && styles.navItemCompact]}>
    <View style={[styles.navDot, active && styles.navDotActive]} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.title}</Text>
  </Pressable>;
}

function Overview({ checkIns, doses, taken, pending, missed, emergencies, onNavigate }: {
  checkIns: typeof initialCheckIns; doses: DashboardDose[]; taken: number; pending: number; missed: number; emergencies: typeof initialEmergencies; onNavigate: (item: Section) => void;
}) {
  const today = checkIns[0];
  const latestCompletedCheck = checkIns.find((check) => check.status === 'completed');
  const healthCheckDetail = latestCompletedCheck
    ? `${latestCompletedCheck.feeling ?? 'Feeling not recorded'} · ${latestCompletedCheck.sleptWell === 'Yes' ? 'Slept well' : latestCompletedCheck.sleptWell ? `Sleep: ${latestCompletedCheck.sleptWell.toLowerCase()}` : 'Sleep not recorded'}${latestCompletedCheck.pain ? ` · Pain: ${latestCompletedCheck.pain.toLowerCase()}` : ''}${latestCompletedCheck.breakfast ? ` · Breakfast: ${latestCompletedCheck.breakfast.toLowerCase()}` : ''}`
    : 'No check-in recorded yet';
  const activities = [
    { time: latestCompletedCheck?.time ?? '—', title: latestCompletedCheck ? 'Morning health check completed' : 'No morning health check yet', detail: healthCheckDetail, icon: '♡' },
    { time: doses.find((dose) => dose.status === 'taken')?.confirmedAt ?? '9:08 AM', title: 'Medication confirmed as taken', detail: 'Metformin · 500 mg', icon: '＋' },
    { time: 'Yesterday · 7:16 PM', title: 'Family message activity', detail: 'Omar sent a message', icon: '◉' },
  ];
  return <>
    <View style={styles.statsGrid}>
      <StatCard label="TODAY’S HEALTH CHECK" value={today?.status === 'completed' ? 'Completed' : 'Pending'} note={today?.time ? `Checked in at ${today.time}` : 'No check-in recorded'} tone="green" />
      <StatCard label="MEDICATION STATUS" value={`${taken} of ${doses.length} taken`} note={`${pending} pending · ${missed} missed`} tone="plum" />
      <StatCard label="EMERGENCY STATUS" value="No active events" note={`${emergencies.length} example events in history`} tone="amber" />
      <StatCard label="LAST ACTIVITY" value={latestCompletedCheck ? 'Health check' : 'No check-in'} note={latestCompletedCheck ? `${latestCompletedCheck.date} · ${latestCompletedCheck.time}` : 'Nothing recorded yet'} tone="blue" />
    </View>
    <View style={styles.columns}>
      <Card style={styles.columnCard}>
        <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Recent activity</Text><Text style={styles.cardHint}>A timeline of sample activity</Text></View><Text style={styles.countPill}>Today</Text></View>
        {activities.map((activity, index) => <View key={activity.title} style={styles.activityRow}><View style={styles.activityTrack}><View style={styles.activityIcon}><Text style={styles.activityIconText}>{activity.icon}</Text></View>{index < activities.length - 1 ? <View style={styles.trackLine} /> : null}</View><View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.activityDetail}>{activity.detail}</Text></View><Text style={styles.activityTime}>{activity.time}</Text></View>)}
        <Text style={styles.mockLabel}>EXAMPLE ACTIVITY · NOT LIVE</Text>
      </Card>
      <Card style={styles.columnCard}>
        <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Upcoming reminders</Text><Text style={styles.cardHint}>Example schedule for today</Text></View><Pressable accessibilityRole="button" onPress={() => onNavigate('Medications')}><Text style={styles.textAction}>View all →</Text></Pressable></View>
        {upcomingReminders.map((reminder) => <View key={reminder.id} style={styles.reminderRow}><View style={styles.reminderIcon}><Text style={styles.reminderIconText}>＋</Text></View><View style={styles.reminderCopy}><Text style={styles.reminderName}>{reminder.name}</Text><Text style={styles.reminderDetail}>{reminder.instructions}</Text></View><Text style={styles.reminderTime}>{reminder.time}</Text></View>)}
        <Pressable accessibilityRole="button" onPress={() => onNavigate('Health Check')} style={styles.outlineAction}><Text style={styles.outlineActionText}>View today’s health check</Text></Pressable>
      </Card>
    </View>
  </>;
}

function HealthPage({ checkIns }: { checkIns: typeof initialCheckIns }) {
  const latest = checkIns.find((item) => item.status === 'completed');
  const answers = [
    ['How are you feeling today?', latest?.feeling],
    ['Did you sleep well?', latest?.sleptWell],
    ['Are you experiencing any pain?', latest?.pain],
    ['Have you had breakfast?', latest?.breakfast],
  ];
  return <View style={styles.pageStack}>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Today’s check-in</Text><Text style={styles.cardHint}>Latest response · {latest?.date} at {latest?.time}</Text></View><StatusPill label="Completed" tone="green" /></View>
      <View style={styles.answerGrid}>{answers.map(([question, answer]) => <View key={question} style={styles.answerCard}><Text style={styles.answerQuestion}>{question}</Text><Text style={styles.answerValue}>{answer ?? 'No answer recorded'}</Text></View>)}</View>
    </Card>
    <Card><Text style={styles.cardTitle}>Check-in history</Text><Text style={styles.cardHint}>A missing check-in does not indicate a health problem.</Text>
      {checkIns.length ? checkIns.map((check) => <View key={check.id} style={styles.historyRow}><View><Text style={styles.historyDate}>{check.date}</Text><Text style={styles.historyTime}>{check.time !== '—' ? `Latest check-in · ${check.time}` : 'No check-in recorded'}</Text></View><StatusPill label={check.status === 'completed' ? 'Completed' : check.status === 'in-progress' ? 'In progress' : 'Not completed'} tone={check.status === 'completed' ? 'green' : check.status === 'in-progress' ? 'amber' : 'neutral'} /></View>) : <Text style={styles.emptyText}>No health check history is available.</Text>}
    </Card>
  </View>;
}

function MedicationPage({ doses, allDoses, filter, onFilter, onChange }: { doses: DashboardDose[]; allDoses: DashboardDose[]; filter: 'all' | MockDoseStatus; onFilter: (value: 'all' | MockDoseStatus) => void; onChange: (id: string, status: MockDoseStatus) => void }) {
  return <View style={styles.pageStack}>
    <View style={styles.summaryStrip}><SummaryMetric label="Taken" count={allDoses.filter((d) => d.status === 'taken').length} tone="green" /><SummaryMetric label="Pending" count={allDoses.filter((d) => d.status === 'pending' || d.status === 'postponed').length} tone="amber" /><SummaryMetric label="Missed" count={allDoses.filter((d) => d.status === 'missed').length} tone="red" /><Text style={styles.summaryHint}>Example dose statuses</Text></View>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Today’s medication schedule</Text><Text style={styles.cardHint}>Status changes stay in this temporary demo session.</Text></View></View>
      <View style={styles.filterRow}>{(['all', 'taken', 'pending', 'postponed', 'missed'] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => onFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item === 'all' ? 'All doses' : statusLabels[item]}</Text></Pressable>)}</View>
      {doses.length ? doses.map((dose) => <DoseRow key={dose.id} dose={dose} onChange={onChange} />) : <Text style={styles.emptyText}>No doses match this filter.</Text>}
      <Text style={styles.mockLabel}>Doses and statuses are examples only. Follow the person’s prescribed care plan.</Text>
    </Card>
    <Card><Text style={styles.cardTitle}>Recent dose history</Text>{allDoses.filter((dose) => dose.confirmedAt).slice(0, 3).map((dose) => <View key={dose.id} style={styles.historyRow}><View><Text style={styles.historyDate}>{dose.medication} · {dose.instructions}</Text><Text style={styles.historyTime}>Confirmed at {dose.confirmedAt}</Text></View><StatusPill label="Taken" tone="green" /></View>)}</Card>
  </View>;
}

function DoseRow({ dose, onChange }: { dose: DashboardDose; onChange: (id: string, status: MockDoseStatus) => void }) {
  return <View style={styles.doseRow}><View style={styles.doseTime}><Text style={styles.doseTimeText}>{dose.time}</Text></View><View style={styles.doseInfo}><Text style={styles.doseName}>{dose.medication}</Text><Text style={styles.doseDetail}>{dose.instructions}</Text>{dose.confirmedAt ? <Text style={styles.doseConfirmed}>Confirmed · {dose.confirmedAt}</Text> : null}</View><StatusPill label={statusLabels[dose.status]} tone={dose.status === 'taken' ? 'green' : dose.status === 'missed' ? 'red' : 'amber'} />
    {dose.status !== 'taken' ? <Pressable accessibilityRole="button" onPress={() => onChange(dose.id, 'taken')} style={styles.smallAction}><Text style={styles.smallActionText}>Mark taken · demo</Text></Pressable> : null}</View>;
}

function EmergencyPage() {
  return <View style={styles.pageStack}><Card style={styles.safetyBanner}><View style={styles.safetyMark}><Text style={styles.safetyMarkText}>i</Text></View><View style={styles.flexCopy}><Text style={styles.cardTitle}>History view only</Text><Text style={styles.cardHint}>This demo dashboard does not detect emergencies, contact anyone, or call emergency services.</Text></View></Card>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Emergency history</Text><Text style={styles.cardHint}>Example events for the family dashboard</Text></View><Text style={styles.countPill}>{initialEmergencies.length} events</Text></View>
      {initialEmergencies.length ? initialEmergencies.map((event) => <View key={event.id} style={styles.eventCard}><View style={styles.eventTop}><View style={styles.flexCopy}><Text style={styles.eventTitle}>{event.type}</Text><Text style={styles.eventDate}>{event.date} · {event.time}</Text></View><StatusPill label={event.status === 'resolved' ? 'Resolved' : event.status === 'cancelled' ? 'Cancelled' : 'Needs review'} tone={event.status === 'resolved' ? 'green' : event.status === 'cancelled' ? 'neutral' : 'amber'} /></View><Text style={styles.eventDetail}>{event.details}</Text>{event.location ? <Text style={styles.eventMeta}>Location · {event.location}</Text> : null}<Text style={styles.eventMeta}>Family notification · {event.notified ? 'Sent (sample)' : 'Not sent'}</Text></View>) : <Text style={styles.emptyText}>No emergency events have been recorded.</Text>}
    </Card></View>;
}

function CommunicationPage({ message, onContact }: { message: string; onContact: (name: string, method: string) => void }) {
  return <View style={styles.pageStack}><Card style={styles.safetyBanner}><View style={styles.safetyMark}><Text style={styles.safetyMarkText}>i</Text></View><View style={styles.flexCopy}><Text style={styles.cardTitle}>Demonstration only</Text><Text style={styles.cardHint}>Call and message buttons show a demo response. They do not place calls or send messages.</Text></View></Card>
    <Card><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Family contacts</Text><Text style={styles.cardHint}>Fictional contact details</Text></View></View>
      {initialContacts.length ? initialContacts.map((contact) => <View key={contact.id} style={styles.contactCard}><View style={styles.contactIdentity}><View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{contact.name.slice(0, 1)}</Text></View><View><Text style={styles.doseName}>{contact.name}</Text><Text style={styles.doseDetail}>{contact.relationship} · {contact.phone}</Text></View></View><Text style={styles.historyTime}>Last activity · {contact.lastContact}</Text><View style={styles.contactActions}><Pressable accessibilityRole="button" onPress={() => onContact(contact.name, 'Call')} style={styles.contactButton}><Text style={styles.contactButtonText}>Call · demo</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onContact(contact.name, 'Message')} style={styles.contactButton}><Text style={styles.contactButtonText}>Message · demo</Text></Pressable></View><Text style={styles.eventMeta}>Recent activity · {contact.method} · {contact.status} (example)</Text></View>) : <Text style={styles.emptyText}>No family contacts are available.</Text>}
      {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
    </Card>
  </View>;
}

function ProfilePage({ profile, onChange, onSave, message }: { profile: typeof initialProfile; onChange: (field: keyof typeof initialProfile, value: string) => void; onSave: () => void; message: string }) {
  return <View style={styles.pageStack}><Card><Text style={styles.cardTitle}>Profile details</Text><Text style={styles.cardHint}>Edit the fictional profile for this session. It is not saved to a server.</Text>
    <FormField label="Full name" value={profile.fullName} onChangeText={(value) => onChange('fullName', value)} /><FormField label="Age" value={profile.age} onChangeText={(value) => onChange('age', value)} keyboardType="number-pad" /><FormField label="Example health notes" value={profile.conditions} onChangeText={(value) => onChange('conditions', value)} /><FormField label="Preferred language" value={profile.language} onChangeText={(value) => onChange('language', value)} />
    <Text style={styles.formSectionTitle}>Current example medications</Text><Text style={styles.eventMeta}>Metformin 500 mg · Amlodipine 5 mg</Text><Text style={styles.formSectionTitle}>Emergency contacts</Text>{initialContacts.map((contact) => <Text key={contact.id} style={styles.eventMeta}>{contact.name} · {contact.relationship} · {contact.phone}</Text>)}
    {message ? <Text accessibilityRole="alert" style={message.startsWith('Enter') ? styles.validationError : styles.feedback}>{message}</Text> : null}<Pressable accessibilityRole="button" onPress={onSave} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Update demo profile</Text></Pressable>
  </Card></View>;
}

function SettingsPage({ onSignOut }: { onSignOut: () => void }) {
  return <View style={styles.pageStack}><Card><Text style={styles.cardTitle}>Dashboard settings</Text><Text style={styles.cardHint}>Settings are not saved in this demo.</Text><View style={styles.settingRow}><View style={styles.flexCopy}><Text style={styles.historyDate}>Notifications</Text><Text style={styles.historyTime}>Sample notifications appear in the bell panel.</Text></View><StatusPill label="Demo" tone="neutral" /></View><View style={styles.settingRow}><View style={styles.flexCopy}><Text style={styles.historyDate}>Data source</Text><Text style={styles.historyTime}>Fictional sample data for the dashboard.</Text></View><StatusPill label="Mock data" tone="neutral" /></View><Pressable accessibilityRole="button" onPress={onSignOut} style={styles.outlineAction}><Text style={styles.outlineActionText}>Sign out</Text></Pressable></Card></View>;
}

function NotificationPanel({ items, onRead, onClose }: { items: DashboardNotification[]; onRead: (id: string) => void; onClose: () => void }) {
  return <View style={styles.notificationPanel}><View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Notifications</Text><Text style={styles.cardHint}>{items.filter((item) => !item.read).length} unread · sample items</Text></View><Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.textAction}>Close</Text></Pressable></View>
    {items.length ? items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.read ? 'Read' : 'Mark as read'}`} onPress={() => onRead(item.id)} style={[styles.notificationRow, !item.read && styles.notificationUnread]}><View style={[styles.notificationDot, item.kind === 'emergency' ? styles.dotRed : item.kind === 'medication' ? styles.dotAmber : styles.dotGreen]} /><View style={styles.flexCopy}><Text style={styles.notificationTitle}>{item.title}</Text><Text style={styles.notificationDetail}>{item.detail}</Text><Text style={styles.notificationTime}>{item.time}</Text></View><Text style={styles.textAction}>{item.read ? 'Read' : 'Mark read'}</Text></Pressable>) : <Text style={styles.emptyText}>You’re all caught up.</Text>}
  </View>;
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'green' | 'plum' | 'amber' | 'blue' }) {
  const toneStyle = tone === 'green' ? styles.statGreen : tone === 'plum' ? styles.statPlum : tone === 'amber' ? styles.statAmber : styles.statBlue;
  return <Card style={[styles.statCard, toneStyle]}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statNote}>{note}</Text></Card>;
}

function SummaryMetric({ label, count, tone }: { label: string; count: number; tone: 'green' | 'amber' | 'red' }) {
  return <View style={styles.summaryMetric}><View style={[styles.metricDot, tone === 'green' ? styles.dotGreen : tone === 'amber' ? styles.dotAmber : styles.dotRed]} /><Text style={styles.summaryCount}>{count}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function Card({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' }) {
  return <View style={[styles.statusPill, tone === 'green' ? styles.statusGreen : tone === 'amber' ? styles.statusAmber : tone === 'red' ? styles.statusRed : styles.statusNeutral]}><Text style={[styles.statusText, tone === 'green' ? styles.statusGreenText : tone === 'amber' ? styles.statusAmberText : tone === 'red' ? styles.statusRedText : styles.statusNeutralText]}>{label}</Text></View>;
}

function FormField({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#77716E" style={styles.input} {...props} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F3F1' },
  shell: { flex: 1, width: '100%', maxWidth: 1440, alignSelf: 'center', flexDirection: 'row' },
  wideShell: { padding: 28, gap: 26 },
  sidebar: { width: 232, backgroundColor: '#FFFEFC', borderRadius: 13, padding: 18, borderWidth: 1, borderColor: '#E7E3DF' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 28 },
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: Palette.primary, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  logoTitle: { color: '#252932', fontSize: 15, fontWeight: '700' }, logoSub: { color: '#747985', fontSize: 11, marginTop: 2 },
  navCaption: { color: '#777B80', fontSize: 10, fontWeight: '700', letterSpacing: 1.1, paddingHorizontal: 11, marginBottom: 9 },
  navItem: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 3 },
  navItemActive: { backgroundColor: '#F3E9E7', borderLeftWidth: 3, borderLeftColor: Palette.primary, paddingLeft: 7 }, navItemCompact: { paddingHorizontal: 12, borderWidth: 1, borderColor: '#E4E0DC', marginBottom: 0 },
  navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#B7B2AD', marginHorizontal: 5 }, navDotActive: { backgroundColor: Palette.primary },
  navLabel: { flex: 1, color: '#555B61', fontSize: 13, fontWeight: '500' }, navLabelActive: { color: '#43252B', fontWeight: '700' },
  sideFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#EAE6E2', paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F2F0ED', alignItems: 'center', justifyContent: 'center' }, helpIconText: { color: '#5E6571', fontWeight: '700' }, sideFooterText: { color: '#6B7076', fontSize: 11, lineHeight: 16 },
  main: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E6E2DE' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandMark: { width: 35, height: 35, borderRadius: 9, backgroundColor: Palette.primary, color: '#FFFFFF', textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  greeting: { color: '#262A33', fontSize: 15, fontWeight: '700' }, patientLine: { color: '#656B71', fontSize: 12, marginTop: 3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, notificationButton: { minWidth: 72, height: 38, paddingHorizontal: 11, borderRadius: 8, backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#E3DEDA', alignItems: 'center', justifyContent: 'center' }, alertsLabel: { color: '#3E444A', fontSize: 12, fontWeight: '600' }, badge: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9, color: '#FFFFFF', backgroundColor: '#9F3540', textAlign: 'center', fontSize: 10, lineHeight: 17, fontWeight: '700', overflow: 'hidden' },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 4 }, avatar: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#E9DEDA', color: Palette.primary, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', fontWeight: '700', fontSize: 14 }, accountName: { color: '#3D424C', fontSize: 12, fontWeight: '600' },
  mobileNav: { gap: 7, paddingVertical: 11, paddingHorizontal: 18 },
  scrollContent: { paddingTop: 27, paddingBottom: 36, paddingHorizontal: 18, gap: 21 },
  pageHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  eyebrow: { color: Palette.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.25, marginBottom: 6 }, pageTitle: { color: '#232833', fontSize: 31, fontWeight: '700', letterSpacing: -0.6 }, pageSubtitle: { color: '#656B71', fontSize: 14, marginTop: 6 },
  demoPill: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 5, backgroundColor: '#ECE7E3' }, demoPillText: { color: '#5E4647', fontWeight: '600', fontSize: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, card: { backgroundColor: '#FFFEFC', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E6E1DC', gap: 16 }, statCard: { flexGrow: 1, flexBasis: 190, minWidth: 160, minHeight: 132, padding: 18, gap: 11, borderLeftWidth: 3 }, statGreen: { borderLeftColor: '#54836B' }, statPlum: { borderLeftColor: Palette.primary }, statAmber: { borderLeftColor: '#B38743' }, statBlue: { borderLeftColor: '#59788B' }, statLabel: { color: '#686D72', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, flexShrink: 1 },
  statValue: { color: '#252A30', fontSize: 22, fontWeight: '700' }, statNote: { color: '#656B71', fontSize: 12, lineHeight: 18 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, columnCard: { flexGrow: 1, flexBasis: 330, minWidth: 260 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, cardTitle: { color: '#2A2E38', fontSize: 17, fontWeight: '700' }, cardHint: { color: '#686E73', fontSize: 12, lineHeight: 18, marginTop: 4 }, countPill: { color: '#575E63', fontSize: 10, fontWeight: '600', backgroundColor: '#F0EEEB', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 5 }, textAction: { color: Palette.primary, fontSize: 12, fontWeight: '700' },
  activityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderTopWidth: 1, borderTopColor: '#EEEAE6', paddingTop: 12 }, activityTrack: { width: 12, alignItems: 'center' }, activityIcon: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.primary, marginTop: 4 }, activityIconText: { display: 'none' }, trackLine: { width: 1, height: 28, backgroundColor: '#E3DEDA' }, activityCopy: { flex: 1, gap: 4 }, activityTitle: { color: '#30363B', fontSize: 13, fontWeight: '600' }, activityDetail: { color: '#686E73', fontSize: 11 }, activityTime: { color: '#747A7E', fontSize: 10, maxWidth: 94, textAlign: 'right' }, mockLabel: { color: '#777D81', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#EEEAE6' }, reminderIcon: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8C6B52', alignItems: 'center', justifyContent: 'center' }, reminderIconText: { display: 'none' }, reminderCopy: { flex: 1 }, reminderName: { color: '#30363B', fontSize: 13, fontWeight: '600' }, reminderDetail: { color: '#686E73', fontSize: 11, marginTop: 4 }, reminderTime: { color: '#50575D', fontSize: 11, fontWeight: '600' }, outlineAction: { borderWidth: 1, borderColor: '#D9CFCA', backgroundColor: '#FBF8F5', minHeight: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, outlineActionText: { color: Palette.primary, fontSize: 12, fontWeight: '700' },
  disclaimer: { color: '#686E73', fontSize: 11, lineHeight: 17, textAlign: 'left', paddingHorizontal: 2 },
  pageStack: { gap: 16 }, answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, answerCard: { flexGrow: 1, flexBasis: 180, backgroundColor: '#F7F5F2', borderRadius: 8, padding: 15, gap: 8 }, answerQuestion: { color: '#666D72', fontSize: 12 }, answerValue: { color: '#30363B', fontSize: 16, fontWeight: '700' }, historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#EAE6E2', paddingTop: 14 }, historyDate: { color: '#373C41', fontSize: 13, fontWeight: '600' }, historyTime: { color: '#686E73', fontSize: 11, marginTop: 4 },
  statusPill: { borderRadius: 5, paddingVertical: 5, paddingHorizontal: 8 }, statusGreen: { backgroundColor: '#E8F0EA' }, statusAmber: { backgroundColor: '#F5EFE2' }, statusRed: { backgroundColor: '#F5E9E7' }, statusNeutral: { backgroundColor: '#EFEEEB' }, statusText: { fontSize: 11, fontWeight: '600' }, statusGreenText: { color: '#34644A' }, statusAmberText: { color: '#80642E' }, statusRedText: { color: '#873C3C' }, statusNeutralText: { color: '#5E6469' }, emptyText: { color: '#686E73', fontSize: 13, paddingVertical: 15 },
  summaryStrip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, backgroundColor: '#FFFEFC', padding: 17, borderRadius: 10, borderWidth: 1, borderColor: '#E6E1DC' }, summaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 7 }, metricDot: { width: 7, height: 7, borderRadius: 4 }, dotGreen: { backgroundColor: '#54836B' }, dotAmber: { backgroundColor: '#B38743' }, dotRed: { backgroundColor: '#A84C4C' }, summaryCount: { color: '#30363B', fontWeight: '700', fontSize: 15 }, summaryLabel: { color: '#686E73', fontSize: 11 }, summaryHint: { color: '#686E73', fontSize: 11, marginLeft: 'auto' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, filterChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#DDD8D3', justifyContent: 'center', backgroundColor: '#FFFEFC' }, filterChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary }, filterText: { color: '#5E6469', fontSize: 11, fontWeight: '600' }, filterTextActive: { color: '#FFFFFF' }, doseRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 11, borderTopWidth: 1, borderTopColor: '#EAE6E2', paddingVertical: 12 }, doseTime: { width: 76 }, doseTimeText: { color: '#565D62', fontSize: 11, fontWeight: '600' }, doseInfo: { flex: 1, minWidth: 130 }, doseName: { color: '#30363B', fontSize: 14, fontWeight: '600' }, doseDetail: { color: '#686E73', fontSize: 11, marginTop: 4 }, doseConfirmed: { color: '#34644A', fontSize: 10, marginTop: 4 }, smallAction: { borderRadius: 6, backgroundColor: '#F3E9E7', paddingHorizontal: 10, paddingVertical: 8 }, smallActionText: { color: Palette.primary, fontSize: 10, fontWeight: '700' },
  safetyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F4EC', borderColor: '#E8DFCC' }, safetyMark: { width: 27, height: 27, borderRadius: 7, backgroundColor: '#EDE5D5', alignItems: 'center', justifyContent: 'center' }, safetyMarkText: { color: '#665637', fontWeight: '700' }, flexCopy: { flex: 1 }, eventCard: { borderTopWidth: 1, borderTopColor: '#EAE6E2', paddingTop: 15, gap: 9 }, eventTop: { flexDirection: 'row', gap: 12, alignItems: 'center' }, eventTitle: { color: '#30363B', fontSize: 14, fontWeight: '600' }, eventDate: { color: '#686E73', fontSize: 11, marginTop: 4 }, eventDetail: { color: '#555D62', fontSize: 12, lineHeight: 19 }, eventMeta: { color: '#686E73', fontSize: 11 },
  contactCard: { borderTopWidth: 1, borderTopColor: '#EAE6E2', paddingTop: 15, gap: 10 }, contactIdentity: { flexDirection: 'row', alignItems: 'center', gap: 11 }, contactAvatar: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#E9DEDA', alignItems: 'center', justifyContent: 'center' }, contactAvatarText: { color: Palette.primary, fontWeight: '700' }, contactActions: { flexDirection: 'row', gap: 8 }, contactButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 6, borderWidth: 1, borderColor: '#D9CFCA', justifyContent: 'center' }, contactButtonText: { color: Palette.primary, fontSize: 11, fontWeight: '700' }, feedback: { color: '#34644A', backgroundColor: '#E8F0EA', borderRadius: 6, padding: 11, fontSize: 12 },
  field: { gap: 6 }, fieldLabel: { color: '#555D62', fontSize: 11, fontWeight: '600' }, input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: '#DCD7D2', backgroundColor: '#FFFEFC', color: '#2E3338', fontSize: 14 }, formSectionTitle: { color: '#30363B', fontSize: 13, fontWeight: '700', marginTop: 5 }, validationError: { color: '#873C3C', backgroundColor: '#F5E9E7', borderRadius: 6, padding: 11, fontSize: 12 }, primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 7, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EFF0F2', paddingTop: 12 },
  notificationPanel: { position: 'absolute', zIndex: 20, top: 58, right: 4, width: 370, maxWidth: '94%', backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#E2DDD8', borderRadius: 10, padding: 17, shadowColor: '#242833', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6, gap: 12 }, notificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 9, borderRadius: 6 }, notificationUnread: { backgroundColor: '#F7F1EF' }, notificationDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 }, notificationTitle: { color: '#30363B', fontSize: 12, fontWeight: '600' }, notificationDetail: { color: '#5F666B', fontSize: 11, lineHeight: 16, marginTop: 3 }, notificationTime: { color: '#777D81', fontSize: 10, marginTop: 5 },
});
