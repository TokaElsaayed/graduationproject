import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>Care Circle</Text>
          <Text style={styles.title}>Personal profile</Text>
          <Text style={styles.subtitle}>Keep care details and trusted contacts up to date.</Text>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.link}>Voice assistant</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/reminders')}><Text style={styles.link}>Medicine reminders</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={async () => { await logOut(); router.replace('/login'); }}><Text style={styles.link}>Sign out</Text></Pressable>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>Demo profile data is kept in memory and resets when the backend restarts.</Text>
        </View>
        {loading ? <ActivityIndicator size="large" color={Palette.primary} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.success}>{notice}</Text> : null}

        {!loading && profile ? <>
          <Section title="About">
            <Field label="Name" value={name} onChangeText={setName} placeholder="Full name" />
            <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Age" />
            <Field label="Conditions" value={conditions} onChangeText={setConditions} placeholder="Separate conditions with commas" multiline />
            <ActionButton label="Save profile" onPress={saveProfile} disabled={saving} />
          </Section>

          <Section title="Medications">
            {medications.length ? medications.map((item) => <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.name} · {item.dose}</Text>
                <Text style={styles.itemDetail}>Schedule: {item.scheduleTimes.join(', ')}</Text>
              </View>
              <View style={styles.itemActions}>
                <SmallButton label="Edit" onPress={() => { setMedicationId(item.id); setMedicationName(item.name); setMedicationDose(item.dose); setMedicationTimes(item.scheduleTimes.join(', ')); }} />
                <SmallButton label="Delete" onPress={() => void removeMedication(item.id)} />
              </View>
            </View>) : <Text style={styles.empty}>No medications added yet.</Text>}
            <Text style={styles.formTitle}>{medicationId ? 'Edit medication' : 'Add medication'}</Text>
            <Field label="Medication name" value={medicationName} onChangeText={setMedicationName} placeholder="e.g. Metformin" />
            <Field label="Dose" value={medicationDose} onChangeText={setMedicationDose} placeholder="e.g. 500 mg" />
            <Field label="Schedule times" value={medicationTimes} onChangeText={setMedicationTimes} placeholder="09:00, 21:00" />
            <Text style={styles.hint}>Use 24-hour times, separated by commas.</Text>
            <View style={styles.formActions}>
              <ActionButton label={medicationId ? 'Save medication' : 'Add medication'} onPress={saveMedication} disabled={saving} />
              {medicationId ? <SmallButton label="Cancel" onPress={resetMedicationForm} /> : null}
            </View>
          </Section>

          <Section title="Emergency contacts">
            {contacts.length ? contacts.map((item) => <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.name}{item.isPrimary ? ' · Primary' : ''}</Text>
                <Text style={styles.itemDetail}>{item.relationship} · {item.phone}</Text>
                <Text style={styles.itemDetail}>{item.canViewDashboard ? 'Can view dashboard' : 'Dashboard access off'}</Text>
              </View>
              <View style={styles.itemActions}>
                <SmallButton label="Edit" onPress={() => { setContactId(item.id); setContactName(item.name); setRelationship(item.relationship); setPhone(item.phone); setIsPrimary(item.isPrimary); setCanViewDashboard(item.canViewDashboard); }} />
                <SmallButton label="Delete" onPress={() => void removeContact(item.id)} />
              </View>
            </View>) : <Text style={styles.empty}>No emergency contacts added yet.</Text>}
            <Text style={styles.formTitle}>{contactId ? 'Edit contact' : 'Add emergency contact'}</Text>
            <Field label="Name" value={contactName} onChangeText={setContactName} placeholder="Contact name" />
            <Field label="Relationship" value={relationship} onChangeText={setRelationship} placeholder="For example: بنتي or ابني" />
            <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+201000000001" />
            <ToggleRow label="Primary contact" value={isPrimary} onValueChange={setIsPrimary} />
            <ToggleRow label="Can view dashboard" value={canViewDashboard} onValueChange={setCanViewDashboard} />
            <View style={styles.formActions}>
              <ActionButton label={contactId ? 'Save contact' : 'Add contact'} onPress={saveContact} disabled={saving} />
              {contactId ? <SmallButton label="Cancel" onPress={resetContactForm} /> : null}
            </View>
          </Section>
        </> : null}
      </View>
    </ScrollView>
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
      placeholderTextColor="#817976"
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
    <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#B9C1C3', true: '#B77A83' }} thumbColor={value ? Palette.primary : '#FFF'} />
  </View>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: Palette.background, padding: 20, paddingTop: 54, paddingBottom: 40 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 },
  header: { marginBottom: 2 },
  brand: { color: Palette.primary, fontSize: 17, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 32, fontWeight: '700', marginTop: 12 },
  subtitle: { color: '#68605E', fontSize: 15, lineHeight: 22, marginTop: 6 },
  headerActions: { flexDirection: 'row', gap: 20, marginTop: 15 },
  link: { color: Palette.primary, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  notice: { backgroundColor: '#F3E8E4', borderRadius: 14, padding: 14 },
  noticeText: { color: Palette.primary, fontSize: 14, lineHeight: 20 },
  error: { color: '#9E2430', backgroundColor: '#FCE9E8', borderRadius: 12, padding: 12, fontSize: 15 },
  success: { color: '#236B4A', backgroundColor: '#E5F4EC', borderRadius: 12, padding: 12, fontSize: 15 },
  section: { backgroundColor: '#FFF9F6', borderRadius: 20, borderWidth: 1, borderColor: '#E9D9D4', padding: 18, gap: 12 },
  sectionTitle: { color: Palette.primary, fontSize: 23, fontWeight: '700', marginBottom: 2 },
  field: { gap: 6 },
  label: { color: Palette.text, fontWeight: '600', fontSize: 15 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#CBBAB5', backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 12, color: Palette.text, fontSize: 16 },
  multiline: { minHeight: 84, paddingTop: 12 },
  primaryButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, backgroundColor: Palette.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  itemCard: { borderWidth: 1, borderColor: '#E9D9D4', borderRadius: 14, padding: 12, gap: 10 },
  itemCopy: { gap: 4 },
  itemTitle: { color: Palette.text, fontSize: 16, fontWeight: '700' },
  itemDetail: { color: '#68605E', fontSize: 14, lineHeight: 20 },
  itemActions: { flexDirection: 'row', gap: 10 },
  smallButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Palette.primary },
  smallButtonText: { color: Palette.primary, fontWeight: '700', fontSize: 14 },
  formTitle: { marginTop: 4, color: Palette.text, fontSize: 17, fontWeight: '700' },
  hint: { color: '#68605E', fontSize: 13 },
  formActions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  empty: { color: '#68605E', fontSize: 15 },
});
