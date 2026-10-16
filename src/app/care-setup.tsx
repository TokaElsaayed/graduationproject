import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { AuthField, AuthSubmit, authStyles } from '@/components/auth/auth-ui';
import { profileRequest } from '@/profile/profile-api';

export default function CareSetupScreen() {
  const router = useRouter();
  const { isReady, user, token } = useAuth();
  const [age, setAge] = useState('');
  const [conditions, setConditions] = useState('');
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [schedule, setSchedule] = useState('');
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isReady) return null;
  if (!user || !token) return <Redirect href="/login" />;
  if (user.role !== 'older_adult') return <Redirect href="/" />;
  const authToken = token;
  const fullName = user.fullName;

  async function submit() {
    setError('');
    const ageNumber = Number(age);
    if (!Number.isInteger(ageNumber) || ageNumber < 1 || ageNumber > 120) {
      setError('Enter a valid age.');
      return;
    }
    if (!contactName.trim() || !relationship.trim() || !phone.trim()) {
      setError('Add a trusted family member and their phone number.');
      return;
    }
    if (Boolean(medication.trim()) !== Boolean(dose.trim()) || Boolean(medication.trim()) !== Boolean(schedule.trim())) {
      setError('For a medication, enter its name, dose, and time.');
      return;
    }

    setLoading(true);
    try {
      await profileRequest(authToken, '/profiles/me', 'PATCH', {
        name: fullName,
        age: ageNumber,
        conditions: conditions.split(',').map((item) => item.trim()).filter(Boolean),
      });
      if (medication.trim()) {
        await profileRequest(authToken, '/profiles/me/medications', 'POST', {
          name: medication.trim(),
          dose: dose.trim(),
          scheduleTimes: schedule.split(',').map((item) => item.trim()).filter(Boolean),
        });
      }
      await profileRequest(authToken, '/profiles/me/contacts', 'POST', {
        name: contactName.trim(),
        relationship: relationship.trim(),
        phone: phone.trim(),
        isPrimary: true,
        canViewDashboard: false,
      });
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your care details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={authStyles.page}>
      <ScrollView contentContainerStyle={authStyles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={authStyles.card}>
          <Text style={authStyles.brand}>Care Circle</Text>
          <Text style={authStyles.title}>Your care details</Text>
          <Text style={authStyles.subtitle}>Add health and family details.</Text>
          {error ? <Text accessibilityRole="alert" style={authStyles.error}>{error}</Text> : null}

          <Text style={authStyles.sectionLabel}>About you</Text>
          <AuthField label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Your age" />
          <AuthField label="Health conditions" value={conditions} onChangeText={setConditions} placeholder="e.g. diabetes, arthritis" />

          <Text style={authStyles.sectionLabel}>Medication (optional)</Text>
          <AuthField label="Medication name" value={medication} onChangeText={setMedication} placeholder="Medicine name" />
          <AuthField label="Dose" value={dose} onChangeText={setDose} placeholder="e.g. 500 mg" />
          <AuthField label="Times" value={schedule} onChangeText={setSchedule} placeholder="09:00, 21:00" />

          <Text style={authStyles.sectionLabel}>Trusted family member</Text>
          <AuthField label="Name" value={contactName} onChangeText={setContactName} placeholder="Their name" />
          <AuthField label="Relationship" value={relationship} onChangeText={setRelationship} placeholder="e.g. daughter" />
          <AuthField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01... or +20..." />

          <AuthSubmit label="Save and continue" loading={loading} onPress={submit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
