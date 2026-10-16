import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { Palette } from '@/constants/theme';
import { syncUpcomingNotifications } from '@/reminders/reminder-notifications';
import type { ReminderDose } from '@/reminders/reminders-api';
import {
  profileRequest,
  type EmergencyContact,
  type Medication,
  type UserProfile,
} from '@/profile/profile-api';

const ROOT = '/profiles/me';

export default function ProfileScreen() {
  const router = useRouter();
  const { isReady, user, token, logOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [todayDoses, setTodayDoses] = useState<ReminderDose[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [conditions, setConditions] = useState('');

  const [medicationId, setMedicationId] = useState<string | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [medicationTimes, setMedicationTimes] = useState('');

  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canViewDashboard, setCanViewDashboard] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError('');
    void Promise.all([
      profileRequest<UserProfile>(token, ROOT),
      profileRequest<Medication[]>(token, `${ROOT}/medications`),
      profileRequest<EmergencyContact[]>(token, `${ROOT}/contacts`),
    ]).then(([loadedProfile, loadedMedications, loadedContacts]) => {
      if (!active) return;
      setProfile(loadedProfile);
      setName(loadedProfile.name);
      setAge(String(loadedProfile.age));
      setConditions(loadedProfile.conditions.join(', '));
      setMedications(loadedMedications);
      setContacts(loadedContacts);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load the profile.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void profileRequest<ReminderDose[]>(token, '/reminders/today')
      .then((items) => { if (active) setTodayDoses(items); })
      .catch(() => { if (active) setTodayDoses([]); });
    return () => { active = false; };
  }, [token]);

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;
  const authToken = token;

  async function runSave(action: () => Promise<void>, successMessage: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    await runSave(async () => {
      const updated = await profileRequest<UserProfile>(authToken, ROOT, 'PATCH', {
        name: name.trim(),
        age: Number(age),
        conditions: conditions.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setProfile(updated);
      setName(updated.name);
      setAge(String(updated.age));
      setConditions(updated.conditions.join(', '));
    }, 'Profile saved.');
  }

  function resetMedicationForm() {
    setMedicationId(null);
    setMedicationName('');
    setMedicationDose('');
    setMedicationTimes('');
  }

  async function saveMedication() {
    const payload = {
      name: medicationName.trim(),
      dose: medicationDose.trim(),
      scheduleTimes: medicationTimes.split(',').map((item) => item.trim()).filter(Boolean),
    };
    await runSave(async () => {
      if (medicationId) {
        const updated = await profileRequest<Medication>(authToken, `${ROOT}/medications/${medicationId}`, 'PATCH', payload);
        setMedications((items) => items.map((item) => item.id === updated.id ? updated : item));
      } else {
        const added = await profileRequest<Medication>(authToken, `${ROOT}/medications`, 'POST', payload);
        setMedications((items) => [...items, added]);
      }
      const today = await profileRequest<ReminderDose[]>(authToken, '/reminders/today');
      await syncUpcomingNotifications(today).catch(() => undefined);
      resetMedicationForm();
    }, medicationId ? 'Medication updated.' : 'Medication added.');
  }

  async function removeMedication(id: string) {
    await runSave(async () => {
      await profileRequest<{ deleted: true }>(authToken, `${ROOT}/medications/${id}`, 'DELETE');
      setMedications((items) => items.filter((item) => item.id !== id));
      const today = await profileRequest<ReminderDose[]>(authToken, '/reminders/today');
      await syncUpcomingNotifications(today).catch(() => undefined);
      if (medicationId === id) resetMedicationForm();
    }, 'Medication removed.');
  }

  function resetContactForm() {
    setContactId(null);
    setContactName('');
    setRelationship('');
    setPhone('');
    setIsPrimary(false);
    setCanViewDashboard(false);
  }

  async function saveContact() {
    const payload = {
      name: contactName.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      isPrimary,
      canViewDashboard,
    };
    await runSave(async () => {
      if (contactId) {
        const updated = await profileRequest<EmergencyContact>(authToken, `${ROOT}/contacts/${contactId}`, 'PATCH', payload);
        setContacts((items) => items.map((item) => item.id === updated.id ? updated : updated.isPrimary ? { ...item, isPrimary: false } : item));
      } else {
        const added = await profileRequest<EmergencyContact>(authToken, `${ROOT}/contacts`, 'POST', payload);
        setContacts((items) => [...items.map((item) => added.isPrimary ? { ...item, isPrimary: false } : item), added]);
      }
      resetContactForm();
    }, contactId ? 'Contact updated.' : 'Contact added.');
  }

  async function removeContact(id: string) {
    await runSave(async () => {
      await profileRequest<{ deleted: true }>(authToken, `${ROOT}/contacts/${id}`, 'DELETE');
      setContacts((items) => items.filter((item) => item.id !== id));
      if (contactId === id) resetContactForm();
    }, 'Contact removed.');
  }

  const adherenceDone = todayDoses.filter((dose) => dose.status === 'taken').length;
  const adherenceRate = todayDoses.length ? `${Math.round(adherenceDone / todayDoses.length * 100)}%` : '—';
  const bloodPressureListed = profile?.conditions.some((condition) => /ضغط|blood pressure/i.test(condition)) ?? false;
  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerRight}>
              <Text style={styles.title} accessibilityRole="header">Profile</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/family-alerts')} style={styles.headerAlert}><Text style={styles.headerAlertIcon}>Alerts</Text></Pressable>
            </View>
          </View>

          {loading ? <View style={styles.loadingCard}><ActivityIndicator size="large" color={Palette.primary} /><Text style={styles.loadingText}>Loading your care profile…</Text></View> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text> : null}
          {profile ? <>
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroName}>{profile.name}</Text>
                <Text style={styles.heroAge}>Age {profile.age}</Text>
                <Text style={styles.connectedText}>Profile connected</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.quickPill}><Text style={styles.quickPillText}>Voice assistant</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/reminders')} style={styles.quickPill}><Text style={styles.quickPillText}>Medicines</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => scrollRef.current?.scrollToEnd({ animated: true })} style={styles.quickPill}><Text style={styles.quickPillText}>Family contacts</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push(user.role === 'caregiver' ? '/family' : '/health-check')} style={styles.quickPill}><Text style={styles.quickPillText}>Health reports</Text></Pressable>
            </ScrollView>

            <Section title="Personal details">
              <Field label="Name" value={name} onChangeText={setName} placeholder="Full name" />
              <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Age" />
              <Field label="Health conditions" value={conditions} onChangeText={setConditions} placeholder="Separate conditions with commas" multiline />
              <ActionButton label={saving ? 'Saving…' : 'Save profile'} onPress={saveProfile} disabled={saving} />
            </Section>

            <View style={styles.sectionHeading}><Text style={styles.sectionHeadingTitle}>Health summary</Text></View>
            <View style={styles.summaryGrid}>
              <SummaryCard icon="♡" label="Blood Pressure" value={bloodPressureListed ? 'In care profile' : 'Not listed'} tone="rose" />
              <SummaryCard icon="✚" label="Active Medications" value={String(medications.length)} tone="plum" />
              <SummaryCard icon="✓" label="Adherence Rate" value={adherenceRate} tone="green" />
            </View>

            <Section title="Medicines">
              {medications.length ? medications.map((item) => <View key={item.id} style={styles.medicationCard}>
                <View style={styles.medicationIcon}><Text style={styles.medicationIconText}>✚</Text></View>
                <View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.medicationDose}>{item.dose}</Text><Text style={styles.itemDetail}>Schedule: {item.scheduleTimes.join(', ') || 'No times set'}</Text></View>
                <View style={styles.medicationCardActions}><View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View><View style={styles.itemActions}><SmallButton label="Edit" onPress={() => { setMedicationId(item.id); setMedicationName(item.name); setMedicationDose(item.dose); setMedicationTimes(item.scheduleTimes.join(', ')); }} /><SmallButton label="Delete" onPress={() => void removeMedication(item.id)} /></View></View>
              </View>) : <Text style={styles.empty}>No medications added yet.</Text>}
              <Text style={styles.formTitle}>{medicationId ? 'Edit medication' : 'Add medication'}</Text>
              <Field label="Medication name" value={medicationName} onChangeText={setMedicationName} placeholder="e.g. Metformin" />
              <Field label="Dose" value={medicationDose} onChangeText={setMedicationDose} placeholder="e.g. 500 mg" />
              <Field label="Schedule times" value={medicationTimes} onChangeText={setMedicationTimes} placeholder="09:00, 21:00" />
              <Text style={styles.hint}>Enter times in 24-hour format.</Text>
              <View style={styles.formActions}><ActionButton label={saving ? 'Saving…' : medicationId ? 'Save medication' : 'Add medication'} onPress={saveMedication} disabled={saving} />{medicationId ? <SmallButton label="Cancel" onPress={resetMedicationForm} /> : null}</View>
            </Section>

            <Section title="Trusted contacts">
              {contacts.length ? contacts.map((item) => <View key={item.id} style={styles.contactCard}>
                <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.contactRelationship}>{item.relationship}{item.isPrimary ? ' · Emergency Contact' : ''}</Text><Text style={styles.itemDetail}>{item.phone}</Text><Text style={styles.itemDetail}>{item.canViewDashboard ? 'Can view dashboard' : 'Dashboard access off'}</Text></View>
                <View style={styles.contactActions}><SmallButton label="Edit" onPress={() => { setContactId(item.id); setContactName(item.name); setRelationship(item.relationship); setPhone(item.phone); setIsPrimary(item.isPrimary); setCanViewDashboard(item.canViewDashboard); }} /><SmallButton label="Delete" onPress={() => void removeContact(item.id)} /></View>
              </View>) : <Text style={styles.empty}>No family contacts added yet.</Text>}
              <Text style={styles.formTitle}>{contactId ? 'Edit contact' : 'Add trusted contact'}</Text>
              <Field label="Name" value={contactName} onChangeText={setContactName} placeholder="Contact name" />
              <Field label="Relationship" value={relationship} onChangeText={setRelationship} placeholder="For example: daughter or son" />
              <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+201000000001" />
              <ToggleRow label="Primary contact" value={isPrimary} onValueChange={setIsPrimary} />
              <ToggleRow label="Can view dashboard" value={canViewDashboard} onValueChange={setCanViewDashboard} />
              <View style={styles.formActions}><ActionButton label={saving ? 'Saving…' : contactId ? 'Save contact' : 'Add contact'} onPress={saveContact} disabled={saving} />{contactId ? <SmallButton label="Cancel" onPress={resetContactForm} /> : null}</View>
            </Section>
          </> : null}
          <Pressable accessibilityRole="button" onPress={async () => { await logOut(); router.replace('/login'); }} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        <BottomTab label="Home" icon="⌂" active={false} onPress={() => router.replace('/')} />
        <BottomTab label="Medicines" icon="✚" active={false} onPress={() => router.replace('/reminders')} />
        <BottomTab label="Assistant" icon="🎙" active={false} onPress={() => router.push('/')} />
        <BottomTab label="Profile" icon="♙" active onPress={() => router.replace('/profile')} />
      </View>
    </View>
  );
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Field({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      {...props}
      accessibilityLabel={label}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor={Palette.textSecondary}
      style={[styles.input, multiline ? styles.multiline : null]}
    />
  </View>;
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled ? styles.disabled : null]}>
    <Text style={styles.primaryButtonText}>{label}</Text>
  </Pressable>;
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.smallButton}><Text style={styles.smallButtonText}>{label}</Text></Pressable>;
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.toggleRow}>
    <Text style={styles.label}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ false: Palette.muted, true: Palette.primary }} thumbColor={value ? Palette.primary : Palette.white} />
  </View>;
}

function SummaryCard({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: 'rose' | 'plum' | 'green' }) {
  const iconStyle = tone === 'green' ? styles.summaryIconGreen : tone === 'plum' ? styles.summaryIconPlum : styles.summaryIconRose;
  const valueStyle = tone === 'green' ? styles.summaryValueGreen : styles.summaryValue;
  return <View style={styles.summaryCard}><View style={[styles.summaryIconWrap, iconStyle]}><Text style={[styles.summaryIcon, valueStyle]}>{icon}</Text></View><Text style={styles.summaryLabel}>{label}</Text><Text style={valueStyle}>{value}</Text></View>;
}

function BottomTab({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.bottomTab, active && styles.bottomTabActive, pressed && styles.bottomTabPressed]}>
    <Text style={[styles.bottomTabIcon, active && styles.bottomTabIconActive]}>{icon}</Text><Text style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}>{label}</Text>
  </Pressable>;
}

const legacyStyles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: Palette.background, padding: 20, paddingTop: 54, paddingBottom: 40 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 },
  header: { marginBottom: 2 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 32, fontWeight: '700', marginTop: 12 },
  subtitle: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6 },
  headerActions: { flexDirection: 'row', gap: 20, marginTop: 15 },
  link: { color: Palette.primary, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  notice: { backgroundColor: Palette.background, borderRadius: 14, padding: 14 },
  noticeText: { color: Palette.primary, fontSize: 14, lineHeight: 20 },
  error: { color: Palette.primary, backgroundColor: Palette.background, borderRadius: 12, padding: 12, fontSize: 15 },
  success: { color: Palette.success, backgroundColor: Palette.background, borderRadius: 12, padding: 12, fontSize: 15 },
  section: { backgroundColor: Palette.white, borderRadius: 20, borderWidth: 1, borderColor: Palette.background, padding: 18, gap: 12 },
  sectionTitle: { color: Palette.primary, fontSize: 23, fontWeight: '700', marginBottom: 2 },
  field: { gap: 6 },
  label: { color: Palette.text, fontWeight: '600', fontSize: 15 },
  input: { minHeight: 48, borderWidth: 1, borderColor: Palette.muted, backgroundColor: Palette.white, borderRadius: 11, paddingHorizontal: 12, color: Palette.text, fontSize: 16 },
  multiline: { minHeight: 84, paddingTop: 12 },
  primaryButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, backgroundColor: Palette.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  primaryButtonText: { color: Palette.white, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  itemCard: { borderWidth: 1, borderColor: Palette.background, borderRadius: 14, padding: 12, gap: 10 },
  itemCopy: { gap: 4 },
  itemTitle: { color: Palette.text, fontSize: 16, fontWeight: '700' },
  itemDetail: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20 },
  itemActions: { flexDirection: 'row', gap: 10 },
  smallButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Palette.primary },
  smallButtonText: { color: Palette.primary, fontWeight: '700', fontSize: 14 },
  formTitle: { marginTop: 4, color: Palette.text, fontSize: 17, fontWeight: '700' },
  hint: { color: Palette.textSecondary, fontSize: 13 },
  formActions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  empty: { color: Palette.textSecondary, fontSize: 15 },
});

const styles = {
  ...legacyStyles,
  ...StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    page: { flexGrow: 1, backgroundColor: Palette.background, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 112 },
    content: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: 18 },
    header: { gap: 12, marginBottom: 1 },
    headerBrand: { minHeight: 47, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 },
    logo: { width: 43, height: 43, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.primary },
    logoText: { color: Palette.white, fontSize: 23, fontWeight: '900' as const },
    brand: { color: Palette.primary, fontSize: 18, fontWeight: '900' as const },
    headerSubtitle: { color: Palette.primary, fontSize: 12, marginTop: 2 },
    headerRight: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10 },
    title: { color: Palette.text, fontSize: 27, lineHeight: 35, fontWeight: '900' as const, marginTop: 0, letterSpacing: -0.4 },
    subtitle: { color: Palette.primary, fontSize: 14, lineHeight: 20, marginTop: 3 },
    headerAlert: { minWidth: 74, minHeight: 48, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: Palette.background, backgroundColor: Palette.white },
    headerAlertIcon: { color: Palette.primary, fontSize: 15, fontWeight: '700' as const },
    heroCard: { minHeight: 94, flexDirection: 'row' as const, alignItems: 'center' as const, padding: 16, borderRadius: 18, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background },
    heroCopy: { flex: 1 }, heroEyebrow: { color: Palette.primary, fontSize: 10, fontWeight: '900' as const }, heroName: { color: Palette.text, fontSize: 22, lineHeight: 29, fontWeight: '800' as const }, heroAge: { color: Palette.textSecondary, fontSize: 16, marginTop: 2 },
    connectedBadge: { alignSelf: 'flex-start' as const, minHeight: 29, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, borderRadius: 15, backgroundColor: Palette.background, marginTop: 9 }, connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.success }, connectedText: { color: Palette.success, fontSize: 11, fontWeight: '800' as const },
    heroDetails: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 7, marginTop: 12 }, heroDetailChip: { minHeight: 32, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 9, borderRadius: 12, backgroundColor: Palette.white75 }, heroDetailIcon: { color: Palette.primary, fontSize: 13, fontWeight: '900' as const }, heroDetailText: { color: Palette.text, fontSize: 10, fontWeight: '700' as const },
    heroAvatarWrap: { width: 115, height: 125, alignItems: 'center' as const, justifyContent: 'center' as const, marginLeft: 7 }, heroAvatar: { width: 100, height: 100, borderRadius: 35, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.white87, borderWidth: 3, borderColor: Palette.white, shadowColor: Palette.text, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 }, heroAvatarText: { color: Palette.primary, fontSize: 29, fontWeight: '900' as const }, heroDecoration: { position: 'absolute' as const, right: 0, top: 0, width: 35, height: 35, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, heroDecorationText: { color: Palette.success, fontSize: 18 },
    quickActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 1 }, quickPill: { minHeight: 48, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, borderRadius: 16, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background }, quickPillActive: { backgroundColor: Palette.primary, borderColor: Palette.primary }, quickPillPressed: { opacity: 0.84 }, quickPillIcon: { color: Palette.primary, fontSize: 17 }, quickPillIconActive: { color: Palette.white }, quickPillText: { color: Palette.text, fontSize: 16, fontWeight: '700' as const }, quickPillTextActive: { color: Palette.white },
    sectionHeading: { gap: 3, marginTop: 2, marginBottom: -8 }, sectionHeadingTitle: { color: Palette.text, fontSize: 20, fontWeight: '900' as const }, sectionHeadingHint: { color: Palette.primary, fontSize: 13, lineHeight: 18 },
    section: { backgroundColor: Palette.white, borderRadius: 18, borderWidth: 1, borderColor: Palette.background, padding: 16, gap: 14 },
    sectionTitle: { color: Palette.primary, fontSize: 16, fontWeight: '800' as const, marginBottom: 1 },
    fieldIconRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 }, fieldIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, fieldIconText: { color: Palette.primary, fontSize: 20, fontWeight: '800' as const }, fieldGrow: { flex: 1 },
    field: { gap: 6 }, label: { color: Palette.text, fontWeight: '800' as const, fontSize: 14 }, input: { minHeight: 52, borderWidth: 1, borderColor: Palette.background, backgroundColor: Palette.white, borderRadius: 15, paddingHorizontal: 14, color: Palette.text, fontSize: 16 }, multiline: { minHeight: 88, paddingTop: 13 },
    primaryButton: { minHeight: 56, width: '100%', paddingHorizontal: 18, borderRadius: 14, backgroundColor: Palette.primary, justifyContent: 'center' as const, alignItems: 'center' as const, alignSelf: 'stretch' as const },
    primaryButtonText: { color: Palette.white, fontSize: 16, fontWeight: '900' as const }, disabled: { opacity: 0.55 },
    summaryGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 }, summaryCard: { flex: 1, minWidth: 105, minHeight: 108, padding: 13, borderRadius: 16, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background }, summaryIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 7 }, summaryIconRose: { backgroundColor: Palette.background }, summaryIconPlum: { backgroundColor: Palette.background }, summaryIconGreen: { backgroundColor: Palette.background }, summaryIcon: { fontSize: 19 }, summaryLabel: { color: Palette.primary, fontSize: 13, lineHeight: 17, fontWeight: '700' as const }, summaryValue: { color: Palette.primary, fontSize: 16, lineHeight: 21, fontWeight: '800' as const, marginTop: 4 }, summaryValueGreen: { color: Palette.success, fontSize: 19, lineHeight: 24, fontWeight: '800' as const, marginTop: 4 },
    medicationCard: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'flex-start' as const, gap: 11, padding: 14, borderRadius: 19, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background }, medicationIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, medicationIconText: { color: Palette.primary, fontSize: 21, fontWeight: '900' as const }, itemCopy: { flex: 1, minWidth: 150, gap: 4 }, itemTitle: { color: Palette.text, fontSize: 16, lineHeight: 22, fontWeight: '900' as const }, medicationDose: { color: Palette.primary, fontSize: 14, fontWeight: '800' as const }, itemDetail: { color: Palette.primary, fontSize: 13, lineHeight: 18 }, medicationCardActions: { alignItems: 'flex-end' as const, gap: 9 }, activeBadge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: Palette.background }, activeBadgeText: { color: Palette.success, fontSize: 10, fontWeight: '900' as const }, itemActions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
    itemCard: { borderWidth: 1, borderColor: Palette.background, borderRadius: 18, padding: 14, gap: 10, backgroundColor: Palette.white }, smallButton: { minHeight: 48, justifyContent: 'center' as const, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: Palette.muted, backgroundColor: Palette.white }, smallButtonText: { color: Palette.primary, fontWeight: '700' as const, fontSize: 15 },
    contactCard: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'flex-start' as const, gap: 11, padding: 14, borderRadius: 19, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.background }, contactAvatar: { width: 45, height: 45, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Palette.background }, contactAvatarText: { color: Palette.primary, fontSize: 18, fontWeight: '900' as const }, contactRelationship: { color: Palette.primary, fontSize: 13, fontWeight: '800' as const }, contactActions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 7 },
    formTitle: { marginTop: 8, color: Palette.text, fontSize: 17, fontWeight: '900' as const }, hint: { color: Palette.primary, fontSize: 13, lineHeight: 19 }, formActions: { flexDirection: 'row' as const, gap: 10, alignItems: 'center' as const, flexWrap: 'wrap' as const }, toggleRow: { minHeight: 54, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 16 },
    error: { color: Palette.error, backgroundColor: Palette.background, borderRadius: 15, padding: 13, fontSize: 14 }, success: { color: Palette.success, backgroundColor: Palette.background, borderRadius: 15, padding: 13, fontSize: 14, fontWeight: '700' as const }, notice: { backgroundColor: Palette.background, borderRadius: 16, padding: 14 }, noticeText: { color: Palette.primary, fontSize: 13, lineHeight: 19 }, empty: { color: Palette.primary, fontSize: 14, lineHeight: 20, paddingVertical: 7 }, loadingCard: { minHeight: 95, borderRadius: 20, backgroundColor: Palette.white, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 }, loadingText: { color: Palette.primary, fontSize: 13 },
    signOut: { minHeight: 48, alignItems: 'center' as const, justifyContent: 'center' as const }, signOutText: { color: Palette.primary, fontSize: 14, fontWeight: '700' as const, textDecorationLine: 'underline' as const },
    bottomNav: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, minHeight: 78, paddingHorizontal: 9, paddingTop: 7, paddingBottom: 8, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const, backgroundColor: Palette.white, borderTopLeftRadius: 23, borderTopRightRadius: 23, borderTopWidth: 1, borderColor: Palette.background, shadowColor: Palette.text, shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
    bottomTab: { minWidth: 64, minHeight: 56, flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2, borderRadius: 15 }, bottomTabActive: { backgroundColor: Palette.background }, bottomTabIcon: { color: Palette.textSecondary, fontSize: 20, lineHeight: 24 }, bottomTabIconActive: { color: Palette.primary }, bottomTabLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600' as const }, bottomTabLabelActive: { color: Palette.primary, fontWeight: '800' as const }, bottomTabPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  }),
};
