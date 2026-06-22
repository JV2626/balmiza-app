import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Platform, Animated, Clipboard } from 'react-native';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
import { TripClosingModal } from '../components/TripClosingModal';
import { ChecklistModal } from '../components/ChecklistModal';
import { AnimatedCard } from '../components/AnimatedCard';
import { GPSModal } from '../components/GPSModal';
import { ReembolsoModal } from '../components/ReembolsoModal';
import { DriverAIChatModal } from '../components/DriverAIChatModal';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

export const DriverHomeScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [driverEmail, setDriverEmail] = useState('');
  const [pendingShifts, setPendingShifts] = useState<any[]>([]);
  
  const [closingTrip, setClosingTrip] = useState<any>(null);
  const [startingTrip, setStartingTrip] = useState<any>(null);

  const [allocatedVehicle, setAllocatedVehicle] = useState<string | null>(null);
  const [allActiveVehicles, setAllActiveVehicles] = useState<any[]>([]);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedPassengerForGPS, setSelectedPassengerForGPS] = useState<any>(null);
  
  const [showReembolso, setShowReembolso] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const email = await AsyncStorage.getItem('@userEmail');
    if (!email) {
      navigation.replace('Login');
      return;
    }
    
    setDriverEmail(email);
    const db = getFirebaseDb();
    
    const driverRef = doc(db, 'usuarios', email.toLowerCase());
    const unsubDriver = onSnapshot(driverRef, (docSnap) => {
      if (docSnap.exists()) {
        const dData = docSnap.data();
        setAllocatedVehicle(dData?.veiculoAlocado || null);
      }
    });

    // Carregar veículos ativos
    try {
      const vSnap = await getDocs(query(collection(db, 'veiculos'), where('ativo', '==', true)));
      setAllActiveVehicles(vSnap.docs.map((d: any) => ({ id: d.id, ...d.data() as any })));
    } catch (e) {
      console.log('Error loading vehicles for driver', e);
    }
    
    const q = query(
      collection(db, 'viagens'), 
      where('motoristaId', '==', email.toLowerCase()),
      where('status', 'in', ['pending', 'active'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        shifts.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setPendingShifts(shifts);
      } else {
        setPendingShifts([]);
      }
      setLoading(false);
    });

    return () => {
      unsubDriver();
      unsubscribe();
    };
  };

  const handleSelectVehicle = async (placa: string) => {
    try {
      const db = getFirebaseDb();
      const driverRef = doc(db, 'usuarios', driverEmail.toLowerCase());
      await setDoc(driverRef, { veiculoAlocado: placa }, { merge: true });
      setAllocatedVehicle(placa);
      setShowVehiclePicker(false);
      const found = allActiveVehicles.find(v => v.placa === placa);
      const vehicleLabel = found ? `${found.modelo} - ${found.placa}` : placa;
      Alert.alert('Sucesso', `Seu veículo atual foi definido como ${vehicleLabel}.`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar o veículo.');
    }
  };

  const getSelectedVehicleModel = () => {
    if (!allocatedVehicle) return 'NENHUM ALOCADO';
    const found = allActiveVehicles.find(v => v.placa === allocatedVehicle);
    return found ? `${found.modelo} - ${found.placa}` : allocatedVehicle;
  };

  const handleStartTrip = async () => {
    if (!startingTrip) return;
    try {
      const db = getFirebaseDb();
      const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      await setDoc(doc(db, 'viagens', startingTrip.id), { 
        status: 'active', 
        horaInicio: horaAtual,
        checklistRealizado: true
      }, { merge: true });
      setStartingTrip(null);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao iniciar viagem. Verifique sua conexão.');
    }
  };

  const handleLogout = async () => {
    try {
      await getFirebaseAuth().signOut();
    } catch (e) {
      console.log('Erro ao fazer signOut no DriverHome:', e);
    }
    await AsyncStorage.removeItem('@userId');
    await AsyncStorage.removeItem('@userRole');
    await AsyncStorage.removeItem('@userEmail');
    navigation.replace('Login');
  };

  const openMultiStopRoute = (shift: any) => {
    if (!shift.passageiros || shift.passageiros.length === 0) return;

    const cleanAddressForGeocoding = (addr: string): string => {
      let clean = addr.replace(/\(.*?\)/g, '');
      const parts = clean.split('-');
      if (parts.length > 1 && /\d/.test(parts[0])) {
        clean = parts[0];
      }
      return clean.trim();
    };

    const waypoints = shift.passageiros
      .map((p: any) => {
        const addr = p.endereco || p.nome;
        let clean = cleanAddressForGeocoding(addr);
        if (!clean.toLowerCase().includes('tatuí') && !clean.toLowerCase().includes('tatui') && !clean.toLowerCase().includes('sorocaba') && !clean.toLowerCase().includes('boituva') && !clean.toLowerCase().includes('itapetininga')) {
          clean += ', Itapetininga, SP';
        }
        return encodeURIComponent(clean);
      })
      .join('%7C');

    const destinoFinal = shift.destino || 'JBS Tatuí';
    let cleanDestino = cleanAddressForGeocoding(destinoFinal);
    if (!cleanDestino.toLowerCase().includes('tatuí') && !cleanDestino.toLowerCase().includes('tatui') && !cleanDestino.toLowerCase().includes('sorocaba') && !cleanDestino.toLowerCase().includes('boituva') && !cleanDestino.toLowerCase().includes('itapetininga')) {
      cleanDestino += ', Itapetininga, SP';
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=&destination=${encodeURIComponent(cleanDestino)}&waypoints=${waypoints}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o Google Maps.');
    });
  };



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {driverEmail.split('@')[0]}</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={colors.red} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Painel de Carro Alocado do Motorista */}
        <View style={styles.vehicleCardContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MaterialCommunityIcons name="steering" size={32} color="#DF0A0A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleSecLabel}>SEU CARRO DE HOJE</Text>
              <Text style={styles.vehicleSecValue}>
                {getSelectedVehicleModel()}
              </Text>
            </View>
            <TouchableOpacity style={styles.vehicleSwapBtn} onPress={() => setShowVehiclePicker(!showVehiclePicker)}>
              <Text style={styles.vehicleSwapBtnText}>TROCAR</Text>
            </TouchableOpacity>
          </View>

          {showVehiclePicker && (
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerHeadline}>Selecione o veículo que você está usando:</Text>
              <View style={styles.pickerGrid}>
                {allActiveVehicles.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[
                      styles.pickerChip,
                      allocatedVehicle === v.placa && styles.pickerChipActive
                    ]}
                    onPress={() => handleSelectVehicle(v.placa)}
                  >
                    <Text style={[
                      styles.pickerChipText,
                      allocatedVehicle === v.placa && { color: colors.white }
                    ]}>
                      {v.modelo} - {v.placa}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.damageBtn} onPress={() => navigation.navigate('DamageReport')}>
          <MaterialCommunityIcons name="car-wrench" size={24} color={colors.graphite} />
          <Text style={styles.damageBtnText}>RELATAR PROBLEMA NO CARRO</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.damageBtn, { borderColor: colors.green }]} onPress={() => setShowReembolso(true)}>
          <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.green} />
          <Text style={[styles.damageBtnText, { color: colors.green }]}>SOLICITAR REEMBOLSO</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.graphite} style={{marginTop: 50}} />
        ) : pendingShifts.length > 0 ? (
          pendingShifts.map((shift) => (
            <AnimatedCard key={shift.id} style={styles.shiftCard}>
              <Text style={styles.shiftTitle}>ROTEIRO DE HOJE</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CARRO:</Text>
                <Text style={styles.infoValue}>{shift.carroPlaca}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>SENTIDO:</Text>
                <Text style={styles.infoValue}>{shift.destino || 'Casa X JBS'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>DATA:</Text>
                <Text style={styles.infoValue}>{shift.data}</Text>
              </View>

              <View style={styles.divider} />
              <Text style={styles.passengersTitle}>PASSAGEIROS</Text>
              
              {shift.passageiros && shift.passageiros.length > 0 && (
                <TouchableOpacity 
                  style={styles.multiRouteBtn} 
                  onPress={() => openMultiStopRoute(shift)}
                >
                  <MaterialCommunityIcons name="map-marker-multiple" size={20} color={colors.white} />
                  <Text style={styles.multiRouteBtnText}>Iniciar Rota Completa (Multi-Paradas) 🗺️</Text>
                </TouchableOpacity>
              )}
              
              {shift.passageiros?.map((p: any, idx: number) => (
                <View key={idx} style={styles.passengerBox}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.pName}>{idx + 1}. {p.nome}</Text>
                    <Text style={styles.pAddress}>{p.endereco}</Text>
                    {p.setor ? (
                      <View style={styles.actionBadge}>
                        <MaterialCommunityIcons name="clipboard-text-play" size={14} color="#B45309" />
                        <Text style={styles.actionText}>{p.setor}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.pTime}>T: {p.horarioEntrada} - {p.horarioSaida}</Text>
                  </View>
                  {p.endereco || (p.latitude && p.longitude) ? (
                    <TouchableOpacity style={styles.wazeIconBtn} onPress={() => setSelectedPassengerForGPS(p)}>
                      <MaterialCommunityIcons name="google-maps" size={32} color="#DF0A0A" />
                      <Text style={[styles.wazeBtnText, { color: '#DF0A0A' }]}>NAV</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              <View style={{height: 20}} />

              {shift.status === 'pending' ? (
                <TouchableOpacity style={styles.startBtn} onPress={() => setStartingTrip(shift)}>
                  <Text style={styles.btnText}>INICIAR VIAGEM</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.endBtn} onPress={() => setClosingTrip(shift)}>
                  <Text style={styles.btnText}>FINALIZAR VIAGEM</Text>
                </TouchableOpacity>
              )}
            </AnimatedCard>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTextGarrafal}>SEM ESCALAS PARA HOJE</Text>
            <Text style={styles.emptySub}>Você está livre. Aproveite o descanso!</Text>
            <TouchableOpacity 
               style={{width: 50, height: 50, marginTop: 50}} 
               onPress={() => setClosingTrip({ id: 'test', carroPlaca: 'TEST', kmInicial: 10000, motoristaNome: 'Teste' })}
               onLongPress={() => Alert.alert('Modo Teste')}
            />
          </View>
        )}
      </ScrollView>

      {closingTrip && (
        <TripClosingModal
          visible={!!closingTrip}
          onClose={() => setClosingTrip(null)}
          tripData={closingTrip}
        />
      )}

      {startingTrip && (
        <ChecklistModal
          visible={!!startingTrip}
          onClose={() => setStartingTrip(null)}
          onConfirm={handleStartTrip}
        />
      )}

      <GPSModal
        visible={!!selectedPassengerForGPS}
        onClose={() => setSelectedPassengerForGPS(null)}
        passenger={selectedPassengerForGPS}
      />

      <ReembolsoModal
        visible={showReembolso}
        onClose={() => setShowReembolso(false)}
        driverEmail={driverEmail}
      />

      <DriverAIChatModal
        visible={showAIChat}
        onClose={() => setShowAIChat(false)}
        driverEmail={driverEmail}
      />

      {/* Botão Flutuante (FAB) da IA */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setShowAIChat(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="robot" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: colors.white, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, zIndex: 10 },
  greeting: { fontSize: 24, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  logoutBtn: { padding: 10, backgroundColor: '#FFF5F5', borderRadius: 8 },
  content: { padding: 20, paddingBottom: 135 }, 
  damageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, height: 58, borderRadius: 12, marginBottom: 30, gap: 10, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2 },
  damageBtnText: { fontSize: 16, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  
  shiftCard: { backgroundColor: colors.white, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  shiftTitle: { fontSize: 22, fontWeight: '900', color: colors.graphite, marginBottom: 20, textAlign: 'center', textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  infoLabel: { fontSize: 16, fontWeight: '900', color: colors.graphiteLight, textTransform: 'uppercase' },
  infoValue: { fontSize: 20, fontWeight: '900', color: colors.graphite },
  divider: { height: 2, backgroundColor: colors.border, marginVertical: 20 },
  passengersTitle: { fontSize: 18, fontWeight: '900', color: colors.graphite, marginBottom: 15, textTransform: 'uppercase' },
  multiRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DF0A0A',
    height: 48,
    borderRadius: 10,
    marginBottom: 15,
    gap: 8,
    shadowColor: '#DF0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  multiRouteBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  
  passengerBox: { backgroundColor: colors.background, padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pName: { fontSize: 18, fontWeight: 'bold', color: colors.graphite },
  pAddress: { fontSize: 14, color: colors.graphite, marginTop: 5 },
  pTime: { fontSize: 14, fontWeight: 'bold', color: colors.graphiteLight, marginTop: 5 },
  
  wazeIconBtn: { alignItems: 'center', justifyContent: 'center', paddingLeft: 15, borderLeftWidth: 1, borderLeftColor: colors.border },
  wazeBtnText: { fontSize: 10, fontWeight: '900', color: '#00C4FF', marginTop: 2, textTransform: 'uppercase' },
  
  startBtn: { backgroundColor: colors.green, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: colors.green, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4 },
  endBtn: { backgroundColor: colors.red, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: colors.red, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4 },
  btnText: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyTextGarrafal: { fontSize: 40, fontWeight: '900', color: colors.graphite, textAlign: 'center', lineHeight: 45, textTransform: 'uppercase' },
  emptySub: { fontSize: 18, color: colors.graphiteLight, textAlign: 'center', marginTop: 15, fontWeight: 'bold' },
  vehicleCardContainer: { backgroundColor: colors.white, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  vehicleSecLabel: { fontSize: 12, fontWeight: '900', color: colors.graphiteLight },
  vehicleSecValue: { fontSize: 18, fontWeight: '900', color: colors.graphite, marginTop: 2 },
  vehicleSwapBtn: { backgroundColor: colors.background, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  vehicleSwapBtnText: { fontSize: 12, fontWeight: '900', color: colors.graphite },
  pickerWrapper: { borderTopWidth: 2, borderTopColor: colors.border, marginTop: 15, paddingTop: 15 },
  pickerHeadline: { fontSize: 14, fontWeight: 'bold', color: colors.graphite, marginBottom: 12 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
  pickerChipActive: { backgroundColor: colors.graphite, borderColor: colors.graphite },
  pickerChipText: { fontSize: 13, fontWeight: 'bold', color: colors.graphite },
  actionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, gap: 5, marginTop: 5, alignSelf: 'flex-start' },
  actionText: { fontSize: 11, fontWeight: 'bold', color: '#B45309' },
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DF0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    zIndex: 99
  }
});
