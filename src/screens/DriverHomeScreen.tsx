import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getFirebaseDb } from '../config/firebase';
import { colors } from '../theme/colors';
import { OilStatusCard } from '../components/OilStatusCard';
import { PreTripChecklistModal } from '../components/PreTripChecklistModal';
import { TripClosingModal } from '../components/TripClosingModal';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const DriverHomeScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [driverEmail, setDriverEmail] = useState('');
  const [activeShift, setActiveShift] = useState<any>(null);

  const [checklistVisible, setChecklistVisible] = useState(false);
  const [closingVisible, setClosingVisible] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return;
      }
      
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
    }

    return token;
  }

  const loadUser = async () => {
    let email = await AsyncStorage.getItem('@userEmail');
    if (!email) email = 'teste@balmiza.com';
    
    setDriverEmail(email);
    
    const db = getFirebaseDb();
    
    // Configura Push Notifications
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await setDoc(doc(db, 'users', email), { pushToken: token }, { merge: true });
      }
    } catch (e) {
      console.log('Push notification error', e);
    }

    // Escuta em Tempo Real (Real-time listener)
    const q = query(
      collection(db, 'shifts'), 
      where('driverEmail', '==', email),
      where('status', 'in', ['pending', 'active'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        shifts.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setActiveShift(shifts[0]);
      } else {
        setActiveShift(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@userId');
    await AsyncStorage.removeItem('@userRole');
    await AsyncStorage.removeItem('@userEmail');
    navigation.replace('Login');
  };

  const handleStartTrip = () => {
    setChecklistVisible(true);
  };

  const handleTripStarted = (tripId?: string) => {
    if (tripId) setActiveTripId(tripId);
    setChecklistVisible(false);
  };

  const handleSOS = () => {
    alert("SOS ATIVADO! Central notificada com sua localização de emergência.");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, motorista!</Text>
          <Text style={styles.subtitle}>Sua pontuação de segurança está excelente.</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={colors.red} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <MaterialCommunityIcons name="shield-star" size={32} color="#FFD700" />
            <Text style={styles.scoreTitle}>Driver Score</Text>
          </View>
          <View style={styles.scoreValueContainer}>
            <Text style={styles.scoreValue}>98</Text>
            <Text style={styles.scoreTotal}>/100</Text>
          </View>
          <Text style={styles.scoreMessage}>Você está no Top 5% de condução segura neste mês!</Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: '98%' }]} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.red} />
        ) : activeShift ? (
          <View style={styles.shiftCard}>
            <View style={styles.shiftHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.shiftTitle}>{activeTripId ? 'Viagem em Andamento' : 'Nova Escala Designada'}</Text>
            </View>
            <View style={styles.shiftBody}>
              <Text style={styles.shiftLabel}>Veículo:</Text>
              <Text style={styles.shiftValue}>{activeShift.vehiclePlate}</Text>
              
              <Text style={[styles.shiftLabel, {marginTop: 15, marginBottom: 10}]}>Roteiro Estruturado:</Text>
              <View style={styles.timelineContainer}>
                {activeShift.stops?.map((stop: any, idx: number) => (
                  <View key={idx} style={styles.timelineItem}>
                    <View style={styles.timelineIconContainer}>
                      <View style={styles.timelineDot} />
                      {idx !== activeShift.stops.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTime}>{stop.time}</Text>
                      <Text style={styles.timelineAddress}>{stop.address}</Text>
                      {stop.passengers && stop.passengers.length > 0 && (
                        <View style={styles.passengerList}>
                          {stop.passengers.map((pass: string, pIdx: number) => (
                            <View key={pIdx} style={styles.passengerRow}>
                              <MaterialCommunityIcons name="account" size={14} color="rgba(255,255,255,0.8)" />
                              <Text style={styles.passengerName}>{pass}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
            {activeTripId ? (
              <TouchableOpacity 
                style={[styles.primaryBtn, {backgroundColor: colors.graphite}]}
                onPress={() => setClosingVisible(true)}
              >
                <MaterialCommunityIcons name="stop-circle-outline" size={20} color={colors.white} />
                <Text style={styles.btnText}>Finalizar Viagem</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleStartTrip}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={colors.white} />
                <Text style={styles.btnText}>Checklist & Iniciar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={40} color={colors.graphiteLight} />
            <Text style={styles.emptyText}>Nenhuma escala designada para você hoje.</Text>
          </View>
        )}

        <OilStatusCard />

      </ScrollView>

      <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
        <MaterialCommunityIcons name="car-emergency" size={28} color={colors.white} />
      </TouchableOpacity>

      <PreTripChecklistModal 
        visible={checklistVisible}
        onClose={() => setChecklistVisible(false)}
        onTripStarted={handleTripStarted}
        activeShiftId={activeShift?.id}
      />

      <TripClosingModal
        visible={closingVisible}
        onClose={() => {
          setClosingVisible(false);
          setActiveTripId(null);
        }}
        tripId={activeTripId || ''}
        activeShiftId={activeShift?.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  greeting: { fontSize: 24, fontWeight: '900', color: colors.graphite },
  subtitle: { fontSize: 13, color: colors.graphiteLight, marginTop: 4 },
  logoutBtn: { padding: 8, backgroundColor: '#FFF5F5', borderRadius: 8 },
  content: { padding: 20, paddingBottom: 100 },
  scoreCard: { backgroundColor: colors.graphite, padding: 20, borderRadius: 16, marginBottom: 20, elevation: 5 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  scoreTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  scoreValueContainer: { flexDirection: 'row', alignItems: 'baseline' },
  scoreValue: { color: colors.white, fontSize: 40, fontWeight: '900' },
  scoreTotal: { color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: 'bold', marginLeft: 2 },
  scoreMessage: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 10, marginBottom: 15 },
  scoreBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: '#FFD700' },
  shiftCard: { backgroundColor: colors.red, borderRadius: 16, overflow: 'hidden', marginBottom: 20, elevation: 4 },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: 'rgba(0,0,0,0.1)' },
  pulseDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80' },
  shiftTitle: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
  shiftBody: { padding: 20, paddingTop: 10 },
  shiftLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  shiftValue: { color: colors.white, fontSize: 20, fontWeight: '800', marginTop: 2 },
  timelineContainer: { backgroundColor: 'rgba(0,0,0,0.15)', padding: 15, borderRadius: 12 },
  timelineItem: { flexDirection: 'row', marginBottom: 15 },
  timelineIconContainer: { alignItems: 'center', marginRight: 15, width: 20 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.white, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  timelineLine: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 5 },
  timelineTime: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  timelineAddress: { color: colors.white, fontSize: 16, fontWeight: '800', marginTop: 2 },
  passengerList: { marginTop: 8, backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 8 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  passengerName: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginLeft: 5, fontWeight: '500' },
  emptyCard: { backgroundColor: colors.white, padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.graphiteLight, fontSize: 16, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
  tripActiveCard: { backgroundColor: colors.white, padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: colors.red },
  tripActiveText: { fontSize: 18, fontWeight: 'bold', color: colors.graphite, marginVertical: 15 },
  primaryBtn: { backgroundColor: colors.graphite, padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, margin: 20, marginTop: 0 },
  btnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  sosButton: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 35, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
});
