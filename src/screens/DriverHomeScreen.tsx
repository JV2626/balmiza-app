import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Platform, Animated, Clipboard, Modal, TextInput } from 'react-native';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
import { TripClosingModal } from '../components/TripClosingModal';
import { ChecklistModal } from '../components/ChecklistModal';
import { AnimatedCard } from '../components/AnimatedCard';
import { GPSModal } from '../components/GPSModal';
import { ReembolsoModal } from '../components/ReembolsoModal';
import { DriverAIChatModal } from '../components/DriverAIChatModal';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { AvisosModal, useAvisosNaoLidos } from '../components/AvisosModal';
import { DriverChatModal, useChatNaoLido } from '../components/DriverChatModal';
import { DriverSettingsModal } from '../components/DriverSettingsModal';

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
  const isOnline = useNetworkStatus();
  const avisosNaoLidos = useAvisosNaoLidos(driverEmail);
  const chatNaoLido = useChatNaoLido(driverEmail);
  const [showAvisos, setShowAvisos] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [closingTrip, setClosingTrip] = useState<any>(null);
  const [startingTrip, setStartingTrip] = useState<any>(null);

  const [allocatedVehicle, setAllocatedVehicle] = useState<string | null>(null);
  const [allActiveVehicles, setAllActiveVehicles] = useState<any[]>([]);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedPassengerForGPS, setSelectedPassengerForGPS] = useState<any>(null);
  
  const [showReembolso, setShowReembolso] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

  // Planilha digital e viagem extra
  const [completedTripsToday, setCompletedTripsToday] = useState<any[]>([]);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraPassageiros, setExtraPassageiros] = useState('');
  const [extraDestino, setExtraDestino] = useState('CASA/JBS');
  const [extraHoraSaida, setExtraHoraSaida] = useState('');
  const [extraHoraChegada, setExtraHoraChegada] = useState('');
  const [extraKmInicial, setExtraKmInicial] = useState('');
  const [extraKmFinal, setExtraKmFinal] = useState('');
  const [extraSaving, setExtraSaving] = useState(false);

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

    // Carregar veículos ativos em tempo real
    const unsubVehicles = onSnapshot(
      query(collection(db, 'veiculos'), where('ativo', '==', true)),
      (vSnap) => {
        setAllActiveVehicles(vSnap.docs.map((d: any) => ({ id: d.id, ...d.data() as any })));
      },
      (e) => {
        console.log('Error loading vehicles for driver', e);
      }
    );

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

    const today = new Date();
    const formattedToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const qCompleted = query(
      collection(db, 'viagens'),
      where('motoristaId', '==', email.toLowerCase()),
      where('data', '==', formattedToday),
      where('status', '==', 'completed')
    );
    
    const unsubCompleted = onSnapshot(qCompleted, (snapshot) => {
      const trips = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      trips.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
      setCompletedTripsToday(trips);
    });

    return () => {
      unsubDriver();
      unsubscribe();
      unsubCompleted();
      unsubVehicles();
    };
  };

  const handleSelectVehicle = async (placa: string) => {
    // Optimistic update: atualizar o estado local imediatamente antes de salvar no Firestore
    setAllocatedVehicle(placa);
    setShowVehiclePicker(false);
    try {
      const db = getFirebaseDb();
      const driverRef = doc(db, 'usuarios', driverEmail.toLowerCase());
      await setDoc(driverRef, { veiculoAlocado: placa }, { merge: true });

      // Sincronizar a placa nos roteiros ativos/pendentes do motorista no banco de dados
      if (pendingShifts.length > 0) {
        const updates = pendingShifts.map(shift =>
          updateDoc(doc(db, 'viagens', shift.id), { carroPlaca: placa })
        );
        await Promise.all(updates);
      }
    } catch (e) {
      console.log('Error updating allocated vehicle:', e);
      // Reverter o estado local em caso de erro
      setAllocatedVehicle(null);
      Alert.alert('Erro', 'Não foi possível atualizar o veículo.');
    }
  };

  const handleSaveExtraTrip = async () => {
    if (!extraPassageiros || !extraHoraSaida || !extraHoraChegada || !extraKmInicial || !extraKmFinal) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    if (Number(extraKmFinal) <= Number(extraKmInicial)) {
      Alert.alert('Erro', 'O KM Final deve ser maior que o KM Inicial.');
      return;
    }
    
    setExtraSaving(true);
    try {
      const db = getFirebaseDb();
      const today = new Date();
      const formattedToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      
      const plate = allocatedVehicle || (pendingShifts.length > 0 ? pendingShifts[0].carroPlaca : 'SEM CARRO');
      
      // 1. Salvar na coleção 'viagens' (para o motorista ver na planilha digital)
      await addDoc(collection(db, 'viagens'), {
        motoristaId: driverEmail.toLowerCase().trim(),
        motoristaNome: driverEmail.split('@')[0].toUpperCase(),
        data: formattedToday,
        destino: extraDestino,
        carroPlaca: plate,
        kmInicial: Number(extraKmInicial),
        kmFinal: Number(extraKmFinal),
        totalKm: Number(extraKmFinal) - Number(extraKmInicial),
        horaInicio: extraHoraSaida.trim(),
        horaFim: extraHoraChegada.trim(),
        status: 'completed',
        isExtra: true,
        checklistRealizado: true,
        passageiros: [{
          nome: extraPassageiros.trim(),
          endereco: 'Itapetininga, SP',
          setor: 'EXTRA',
          status: 'concluido'
        }],
        createdAt: new Date(),
        closedAt: new Date()
      });

      // 2. Salvar na coleção 'trips' (para o painel administrativo)
      await addDoc(collection(db, 'trips'), {
        driverId: driverEmail.toLowerCase().trim(),
        status: 'completed',
        closedAt: new Date(),
        finalOdometer: Number(extraKmFinal),
        notes: 'VIAGEM EXTRA REGISTRADA PELO MOTORISTA',
        dashboardImageUrl: '',
        closingLocation: extraDestino,
        isExtra: true
      });

      // 3. Atualizar quilometragem do veículo no banco de dados
      if (plate && plate !== 'SEM CARRO') {
        const q = query(collection(db, 'veiculos'), where('placa', '==', plate));
        const veicSnap = await getDocs(q);
        if (!veicSnap.empty) {
          await updateDoc(doc(db, 'veiculos', veicSnap.docs[0].id), {
            kmAtual: Number(extraKmFinal)
          });
        }
      }

      Alert.alert('Sucesso', 'Viagem extra registrada com sucesso!');
      setShowExtraModal(false);
      
      // Limpar campos
      setExtraPassageiros('');
      setExtraHoraSaida('');
      setExtraHoraChegada('');
      setExtraKmInicial('');
      setExtraKmFinal('');
    } catch (e) {
      console.log('Error saving extra trip:', e);
      Alert.alert('Erro', 'Não foi possível registrar a viagem extra.');
    } finally {
      setExtraSaving(false);
    }
  };

  const getSelectedVehicleModel = () => {
    let plate = allocatedVehicle;
    if (!plate && pendingShifts.length > 0) {
      const shiftWithCar = pendingShifts.find(s => s.carroPlaca);
      if (shiftWithCar) plate = shiftWithCar.carroPlaca;
    }
    if (!plate) return 'NENHUM ALOCADO';
    // Buscar o modelo pelo nome — mesmo se a placa foi atualizada recentemente
    const found = allActiveVehicles.find(v => v.placa === plate);
    if (found) return `${found.modelo} - ${plate}`;
    // Fallback: mostrar só a placa se o veículo não estiver no array ainda
    return plate;
  };

  const getConsolidatedShift = () => {
    if (pendingShifts.length === 0) return null;
    
    const primaryShift = pendingShifts[0];
    const uniquePlates = pendingShifts.map(s => s.carroPlaca).filter((v, i, a) => a.indexOf(v) === i);
    const carroPlaca = uniquePlates.length > 0 ? uniquePlates.join(' / ') : 'SEM CARRO';
    const data = primaryShift.data;
    
    const allPassengers: any[] = [];
    const mergedGroupStates: { [key: string]: any } = {};

    pendingShifts.forEach(shift => {
      if (shift.groupStates) {
        Object.assign(mergedGroupStates, shift.groupStates);
      }
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
            shiftStatus: shift.status,
            originalShift: shift
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
      originalShifts: pendingShifts,
      groupStates: mergedGroupStates
    };
  };

  const handleStartTrip = async () => {
    if (!startingTrip) return;
    try {
      const db = getFirebaseDb();
      const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      if (startingTrip.groupKey) {
        const docRef = doc(db, 'viagens', startingTrip.id);
        const currentGroupStates = startingTrip.groupStates || {};
        
        const updatedGroupStates = {
          ...currentGroupStates,
          [startingTrip.groupKey]: {
            status: 'active',
            horaInicio: horaAtual,
            kmInicial: Number(startingTrip.kmInicial || 0)
          }
        };

        await updateDoc(docRef, {
          groupStates: updatedGroupStates,
          status: 'active'
        });
      } else {
        await setDoc(doc(db, 'viagens', startingTrip.id), { 
          status: 'active', 
          horaInicio: horaAtual,
          checklistRealizado: true
        }, { merge: true });
      }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Botão de Chat com badge */}
          <TouchableOpacity onPress={() => setShowChat(true)} style={styles.headerIconBtn}>
            <MaterialCommunityIcons name="chat-outline" size={24} color={colors.graphite} />
            {chatNaoLido > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{chatNaoLido > 9 ? '9+' : chatNaoLido}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Botão de Avisos com badge */}
          <TouchableOpacity onPress={() => setShowAvisos(true)} style={styles.headerIconBtn}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={colors.graphite} />
            {avisosNaoLidos > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>
                  {avisosNaoLidos > 9 ? '9+' : avisosNaoLidos}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Botão de Ajustes */}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerIconBtn}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={colors.graphite} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={24} color={colors.red} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner de Status Offline */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#fff" />
          <Text style={styles.offlineBannerText}>
            SEM CONEXÃO — Modo Offline. Dados serão sincronizados ao reconectar.
          </Text>
        </View>
      )}

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

        {/* TABELA DE VIAGENS DE HOJE (PLANILHA DIGITAL) */}
        <View style={styles.sheetCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={styles.sheetTitle}>MINHAS VIAGENS DE HOJE</Text>
            <TouchableOpacity 
              style={styles.addExtraBtn} 
              onPress={() => {
                const plate = allocatedVehicle || (pendingShifts.length > 0 ? pendingShifts[0].carroPlaca : null);
                if (plate) {
                  const found = allActiveVehicles.find(v => v.placa === plate);
                  if (found) setExtraKmInicial(found.kmAtual?.toString() || '');
                }
                setShowExtraModal(true);
              }}
            >
              <MaterialCommunityIcons name="plus" size={14} color={colors.white} />
              <Text style={styles.addExtraBtnText}>EXTRA</Text>
            </TouchableOpacity>
          </View>

          {completedTripsToday.length === 0 ? (
            <Text style={styles.emptySheetText}>Nenhuma viagem registrada hoje ainda.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.table}>
                {/* Header Row */}
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableCellHeader, { width: 120 }]}>Passageiros</Text>
                  <Text style={[styles.tableCellHeader, { width: 100 }]}>Destino</Text>
                  <Text style={[styles.tableCellHeader, { width: 70 }]}>Saída</Text>
                  <Text style={[styles.tableCellHeader, { width: 70 }]}>Chegada</Text>
                  <Text style={[styles.tableCellHeader, { width: 80 }]}>KM Inicial</Text>
                  <Text style={[styles.tableCellHeader, { width: 80 }]}>KM Final</Text>
                  <Text style={[styles.tableCellHeader, { width: 60 }]}>Tipo</Text>
                </View>

                {/* Data Rows */}
                {completedTripsToday.map((t, idx) => {
                  const passNames = t.passageiros?.map((p: any) => p.nome).join(', ') || 'N/A';
                  const isExt = t.isExtra === true;
                  return (
                    <View key={t.id} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F9FAFB' }]}>
                      <Text style={[styles.tableCell, { width: 120 }]} numberOfLines={1}>{passNames}</Text>
                      <Text style={[styles.tableCell, { width: 100 }]} numberOfLines={1}>{t.destino}</Text>
                      <Text style={[styles.tableCell, { width: 70 }]}>{t.horaInicio || '-'}</Text>
                      <Text style={[styles.tableCell, { width: 70 }]}>{t.horaFim || '-'}</Text>
                      <Text style={[styles.tableCell, { width: 80 }]}>{t.kmInicial || '-'}</Text>
                      <Text style={[styles.tableCell, { width: 80 }]}>{t.kmFinal || '-'}</Text>
                      <Text style={[styles.tableCell, { width: 60, fontWeight: 'bold', color: isExt ? '#DF0A0A' : colors.green }]}>
                        {isExt ? 'EXTRA' : 'NORMAL'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

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

              {Object.keys(consolidated.groupedPassengers).map((groupKey) => {
                const group = consolidated.groupedPassengers[groupKey];
                const firstP = group[0];
                const time = firstP.horarioEntrada;
                const direction = firstP.destinoLabel;
                const tag = firstP.destinoTag;
                const isVolta = tag === 'Volta';
                
                const groupState = consolidated.groupStates?.[groupKey] || { status: 'pending' };
                const groupStatus = groupState.status || 'pending';
                const isCompleted = groupStatus === 'completed';
                const isActive = groupStatus === 'active';

                const originalShift = firstP.originalShift;

                return (
                  <View key={groupKey} style={[styles.passengerGroupCard, isCompleted && { opacity: 0.8, borderColor: colors.green }]}>
                    <View style={[
                      styles.passengerGroupHeader, 
                      { backgroundColor: isCompleted ? '#E6F4EA' : isVolta ? '#F3F4F6' : '#FEE2E2' }
                    ]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.graphite} />
                        <Text style={{ fontWeight: 'bold', color: colors.graphite, fontSize: 14 }}>{time}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="swap-horizontal" size={16} color={isCompleted ? colors.green : isVolta ? colors.graphite : '#DF0A0A'} />
                        <Text style={{ fontWeight: 'bold', color: isCompleted ? colors.green : isVolta ? colors.graphite : '#DF0A0A', fontSize: 12 }}>
                          {isCompleted ? 'REALIZADO ✅' : direction}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.groupMembersList}>
                      {group.map((p: any, pIdx: number) => (
                        <View key={pIdx} style={styles.miniPassengerBox}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.miniPName}>👤 {p.nome}</Text>
                            <Text style={styles.miniPAddress}>📍 {p.endereco}</Text>
                            {p.setor && p.setor !== 'PEGAR AMOSTRAS' ? (
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

                      {/* Botão de Rota Completa (Multi-Paradas) específico para este horário */}
                      {!isCompleted && group.length > 0 && (
                        <TouchableOpacity 
                          style={styles.groupMultiRouteBtn} 
                          onPress={() => openMultiStopRoute({ passageiros: group, destino: isVolta ? 'Destino Final' : 'JBS Tatuí' })}
                        >
                          <MaterialCommunityIcons name="map-marker-multiple" size={18} color={colors.white} />
                          <Text style={styles.groupMultiRouteBtnText}>ROTA DO HORÁRIO 🗺️</Text>
                        </TouchableOpacity>
                      )}

                      {/* Botões de Iniciar/Finalizar para esta viagem (horário) em específico */}
                      <View style={{ marginTop: 10 }}>
                        {isCompleted ? (
                          <View style={styles.completedInfoBox}>
                            <MaterialCommunityIcons name="check-circle" size={16} color={colors.green} />
                            <Text style={styles.completedInfoText}>
                              Saída: {groupState.horaInicio}h | Chegada: {groupState.horaFim}h | KM: {groupState.kmInicial} ➔ {groupState.kmFinal}
                            </Text>
                          </View>
                        ) : !isActive ? (
                          <TouchableOpacity 
                            style={styles.groupStartBtn} 
                            onPress={() => {
                              const plate = allocatedVehicle || originalShift.carroPlaca;
                              let resolvedKm = '0';
                              if (plate) {
                                const found = allActiveVehicles.find(v => v.placa === plate);
                                if (found) resolvedKm = found.kmAtual?.toString() || '0';
                              }
                              setStartingTrip({
                                ...originalShift,
                                groupKey,
                                kmInicial: resolvedKm
                              });
                            }}
                          >
                            <Text style={styles.groupBtnText}>INICIAR VIAGEM ({time})</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={styles.groupEndBtn} 
                            onPress={() => {
                              setClosingTrip({
                                ...originalShift,
                                groupKey,
                                kmInicial: groupState.kmInicial || originalShift.kmInicial
                              });
                            }}
                          >
                            <Text style={styles.groupBtnText}>FINALIZAR VIAGEM ({time})</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}

              <View style={styles.divider} />
              
              {/* Botão de Finalização de Turno Completo */}
              <TouchableOpacity 
                style={styles.finishTurnBtn} 
                onPress={() => {
                  const originalShift = consolidated.originalShifts[0];
                  const plate = allocatedVehicle || originalShift.carroPlaca;
                  let resolvedKm = '0';
                  if (plate) {
                    const found = allActiveVehicles.find(v => v.placa === plate);
                    if (found) resolvedKm = found.kmAtual?.toString() || '0';
                  }

                  // Tenta deduzir o menor KM inicial entre as viagens do dia
                  let minKm = Number(resolvedKm);
                  if (consolidated.groupStates) {
                    const kms = Object.values(consolidated.groupStates)
                      .map((gs: any) => Number(gs.kmInicial))
                      .filter(km => !isNaN(km) && km > 0);
                    if (kms.length > 0) {
                      minKm = Math.min(...kms);
                    }
                  }

                  setClosingTrip({
                    ...originalShift,
                    groupKey: undefined, // indica fechamento de turno completo
                    kmInicial: minKm
                  });
                }}
              >
                <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.white} />
                <Text style={styles.finishTurnBtnText}>FINALIZAR TURNO DE HOJE</Text>
              </TouchableOpacity>

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

      {/* MODAL DE AVISOS DA CENTRAL */}
      <AvisosModal
        visible={showAvisos}
        onClose={() => setShowAvisos(false)}
        driverEmail={driverEmail}
      />

      {/* MODAL DE CHAT COM ADMIN */}
      <DriverChatModal
        visible={showChat}
        onClose={() => setShowChat(false)}
        driverEmail={driverEmail}
      />

      {/* MODAL DE AJUSTES DO MOTORISTA */}
      <DriverSettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        driverEmail={driverEmail}
      />


      {/* MODAL REGISTRAR VIAGEM EXTRA */}
      <Modal visible={showExtraModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REGISTRAR VIAGEM EXTRA</Text>
              <TouchableOpacity onPress={() => setShowExtraModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.graphite} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginVertical: 15 }}>
              <Text style={styles.modalLabel}>Passageiro(s)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Angelica"
                value={extraPassageiros}
                onChangeText={setExtraPassageiros}
              />

              <Text style={styles.modalLabel}>Sentido / Destino</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 5 }}>
                {['CASA/JBS', 'JBS/CASA', 'OUTRO'].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.pickerChip,
                      extraDestino === d && styles.pickerChipActive,
                      { flex: 1, alignItems: 'center' }
                    ]}
                    onPress={() => setExtraDestino(d)}
                  >
                    <Text style={[
                      styles.pickerChipText,
                      extraDestino === d && { color: colors.white }
                    ]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Hora Saída (Casa)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: 04:50"
                    value={extraHoraSaida}
                    onChangeText={setExtraHoraSaida}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Hora Chegada (JBS)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: 05:25"
                    value={extraHoraChegada}
                    onChangeText={setExtraHoraChegada}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>KM Inicial</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: 90620"
                    value={extraKmInicial}
                    onChangeText={setExtraKmInicial}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>KM Final</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: 90644"
                    value={extraKmFinal}
                    onChangeText={setExtraKmFinal}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowExtraModal(false)} disabled={extraSaving}>
                <Text style={styles.modalCancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveExtraTrip} disabled={extraSaving}>
                {extraSaving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>REGISTRAR</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  headerIconBtn: { padding: 8, backgroundColor: '#F4F6F8', borderRadius: 8, position: 'relative' },
  badgeContainer: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#DF0A0A', borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
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
  offlineBanner: { backgroundColor: '#374151', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1 },
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
  },
  sheetCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.graphite,
    textTransform: 'uppercase',
  },
  addExtraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DF0A0A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  addExtraBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptySheetText: {
    fontSize: 13,
    color: colors.graphiteLight,
    textAlign: 'center',
    marginVertical: 10,
    fontStyle: 'italic',
  },
  table: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableCellHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.graphite,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 13,
    color: colors.graphite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.graphite,
    textTransform: 'uppercase',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.graphiteLight,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.graphite,
    marginTop: 5,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 15,
    marginTop: 15,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.graphiteLight,
    textTransform: 'uppercase',
  },
  modalSaveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.green,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.white,
    textTransform: 'uppercase',
  },
  groupMultiRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DF0A0A',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  groupMultiRouteBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  groupStartBtn: {
    backgroundColor: colors.green,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupEndBtn: {
    backgroundColor: colors.red,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  completedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  completedInfoText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065F46',
    flex: 1,
  },
  finishTurnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.graphite,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  finishTurnBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  }
});
