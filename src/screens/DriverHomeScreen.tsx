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
    let plate = allocatedVehicle;
    if (!plate && pendingShifts.length > 0) {
      plate = pendingShifts[0].carroPlaca;
    }
    if (!plate) return 'NENHUM ALOCADO';
    const found = allActiveVehicles.find(v => v.placa === plate);
    return found ? `${found.modelo} - ${plate}` : plate;
  };

  const getConsolidatedShift = () => {
    if (pendingShifts.length === 0) return null;
    
    const primaryShift = pendingShifts[0];
    const uniquePlates = pendingShifts.map(s => s.carroPlaca).filter((v, i, a) => a.indexOf(v) === i);
    const carroPlaca = uniquePlates.length > 0 ? uniquePlates.join(' / ') : 'SEM CARRO';
    const data = primaryShift.data;
    
    const allPassengers: any[] = [];
    pendingShifts.forEach(shift => {
      const isVolta = shift.destino?.toUpperCase().includes('JBS/CASA') || 
                      shift.destino?.toUpperCase().includes('JBSXCASA') ||
                      shift.destino?.toUpperCase().includes('JBS X CASA') ||
                      shift.destino?.toUpperCase().includes('JBS-CASA') ||
                      shift.destino?.toUpperCase().includes('JBS > CASA');
      const tag = isVolta ? 'Volta' : 'Ida';
      const label = isVolta ? 'JBS ➔ CASA' : 'CASA ➔ JBS';
      
      if (shift.passageiros) {
        shift.passageiros.forEach((p: any) => {
          allPassengers.push({
            ...p,
            destinoTag: tag,
            destinoLabel: label,
            shiftId: shift.id,
            shiftStatus: shift.status
          });
        });
      }
    });

    // Ordenar cronologicamente
    allPassengers.sort((a, b) => (a.horarioEntrada || '').localeCompare(b.horarioEntrada || ''));

    // Agrupar por horarioEntrada + destinoLabel
    const groupedPassengers: { [key: string]: any[] } = {};
    allPassengers.forEach(p => {
      const groupKey = `${p.horarioEntrada}_${p.destinoLabel}`;
      if (!groupedPassengers[groupKey]) {
        groupedPassengers[groupKey] = [];
      }
      groupedPassengers[groupKey].push(p);
    });

    return {
      carroPlaca,
      data,
      groupedPassengers,
      originalShifts: pendingShifts
    };
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
                {allActiveVehicles.map((v) => {
                  const currentPlate = allocatedVehicle || (pendingShifts.length > 0 ? pendingShifts[0].carroPlaca : null);
                  const isActive = currentPlate === v.placa;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.pickerChip,
                        isActive && styles.pickerChipActive
                      ]}
                      onPress={() => handleSelectVehicle(v.placa)}
                    >
                      <Text style={[
                        styles.pickerChipText,
                        isActive && { color: colors.white }
                      ]}>
                        {v.modelo} - {v.placa}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
        ) : getConsolidatedShift() ? (() => {
          const consolidated = getConsolidatedShift()!;
          return (
            <AnimatedCard style={styles.shiftCard}>
              <Text style={styles.shiftTitle}>ROTEIRO DE HOJE</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CARRO:</Text>
                <Text style={styles.infoValue}>{consolidated.carroPlaca}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>DATA:</Text>
                <Text style={styles.infoValue}>{consolidated.data}</Text>
              </View>

              <View style={styles.divider} />
              <Text style={styles.passengersTitle}>CRONOGRAMA DE HOJE</Text>
              
              {Object.keys(consolidated.groupedPassengers).length > 0 && (
                <TouchableOpacity 
                  style={styles.multiRouteBtn} 
                  onPress={() => {
                    const flatSorted: any[] = [];
                    Object.keys(consolidated.groupedPassengers).forEach(k => {
                      flatSorted.push(...consolidated.groupedPassengers[k]);
                    });
                    openMultiStopRoute({ passageiros: flatSorted, destino: 'JBS Tatuí' });
                  }}
                >
                  <MaterialCommunityIcons name="map-marker-multiple" size={20} color={colors.white} />
                  <Text style={styles.multiRouteBtnText}>Iniciar Rota Completa (Multi-Paradas) 🗺️</Text>
                </TouchableOpacity>
              )}

              {Object.keys(consolidated.groupedPassengers).map((groupKey) => {
                const group = consolidated.groupedPassengers[groupKey];
                const firstP = group[0];
                const time = firstP.horarioEntrada;
                const direction = firstP.destinoLabel;
                const tag = firstP.destinoTag;
                const isVolta = tag === 'Volta';
                
                return (
                  <View key={groupKey} style={styles.passengerGroupCard}>
                    <View style={[styles.passengerGroupHeader, { backgroundColor: isVolta ? '#F3F4F6' : '#FEE2E2' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.graphite} />
                        <Text style={{ fontWeight: 'bold', color: colors.graphite, fontSize: 14 }}>{time}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="swap-horizontal" size={16} color={isVolta ? colors.graphite : '#DF0A0A'} />
                        <Text style={{ fontWeight: 'bold', color: isVolta ? colors.graphite : '#DF0A0A', fontSize: 12 }}>
                          {direction}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.groupMembersList}>
                      {group.map((p: any, pIdx: number) => (
                        <View key={pIdx} style={styles.miniPassengerBox}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.miniPName}>👤 {p.nome}</Text>
                            <Text style={styles.miniPAddress}>📍 {p.endereco}</Text>
                            {p.setor ? (
                              <View style={styles.miniActionBadge}>
                                <Text style={styles.miniActionText}>{p.setor}</Text>
                              </View>
                            ) : null}
                          </View>
                          {p.endereco || (p.latitude && p.longitude) ? (
                            <TouchableOpacity style={styles.miniWazeIconBtn} onPress={() => setSelectedPassengerForGPS(p)}>
                              <MaterialCommunityIcons name="google-maps" size={24} color="#DF0A0A" />
                              <Text style={styles.miniNavText}>NAV</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}

              <View style={styles.divider} />
              <Text style={styles.passengersTitle}>GERENCIAR VIAGENS</Text>

              {consolidated.originalShifts.map((shift) => {
                const label = shift.destino?.toUpperCase().includes('JBS/CASA') ? 'Volta (JBS ➔ Casa)' : 'Ida (Casa ➔ JBS)';
                const isActive = shift.status === 'active';
                return (
                  <View key={shift.id} style={styles.shiftActionCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shiftActionLabel}>{label}</Text>
                      <Text style={[styles.shiftStatusLabel, { color: isActive ? colors.green : colors.graphiteLight }]}>
                        {isActive ? '● EM ANDAMENTO' : '○ PENDENTE'}
                      </Text>
                    </View>
                    {shift.status === 'pending' ? (
                      <TouchableOpacity style={styles.startBtnSmall} onPress={() => setStartingTrip(shift)}>
                        <Text style={styles.btnTextSmall}>INICIAR</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.endBtnSmall} onPress={() => setClosingTrip(shift)}>
                        <Text style={styles.btnTextSmall}>FINALIZAR</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </AnimatedCard>
          );
        })() : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTextGarrafal}>SEM ESCALAS PARA HOJE</Text>
            <Text style={styles.emptySub}>Você está livre. Aproveite o descanso!</Text>
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
  },
  passengerGroupCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  passengerGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupMembersList: {
    padding: 12,
    gap: 8,
  },
  miniPassengerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  miniPName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.graphite,
  },
  miniPAddress: {
    fontSize: 13,
    color: colors.graphiteLight,
    marginTop: 3,
  },
  miniActionBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  miniActionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B45309',
  },
  miniWazeIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    width: 60,
  },
  miniNavText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DF0A0A',
    marginTop: 2,
  },
  shiftActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shiftActionLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.graphite,
  },
  shiftStatusLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 3,
  },
  startBtnSmall: {
    backgroundColor: colors.green,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  endBtnSmall: {
    backgroundColor: colors.red,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnTextSmall: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  }
});
