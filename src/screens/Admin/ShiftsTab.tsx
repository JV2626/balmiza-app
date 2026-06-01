import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, FlatList } from 'react-native';
import { collection, addDoc, doc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../../config/firebase';
import { colors } from '../../theme/colors';

type Stop = {
  id: string;
  time: string;
  address: string;
  passengers: string[];
};

export const ShiftsTab = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  
  const [driverEmail, setDriverEmail] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [stops, setStops] = useState<Stop[]>([
    { id: Date.now().toString(), time: '', address: '', passengers: [] }
  ]);

  const [activeShifts, setActiveShifts] = useState<any[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (activeTab === 'manage') {
      fetchActiveShifts();
    }
  }, [activeTab]);

  const fetchActiveShifts = async () => {
    setFetching(true);
    try {
      const db = getFirebaseDb();
      const q = query(collection(db, 'shifts'), where('status', 'in', ['pending', 'active']));
      const querySnapshot = await getDocs(q);
      const shifts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveShifts(shifts);
    } catch (e) {
      console.log('Error fetching active shifts', e);
    } finally {
      setFetching(false);
    }
  };

  const addStop = () => {
    setStops([...stops, { id: Date.now().toString(), time: '', address: '', passengers: [] }]);
  };

  const removeStop = (id: string) => {
    if (stops.length > 1) {
      setStops(stops.filter(s => s.id !== id));
    }
  };

  const updateStop = (id: string, field: 'time' | 'address', value: string) => {
    setStops(stops.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addPassenger = (stopId: string) => {
    setStops(stops.map(s => {
      if (s.id === stopId) {
        return { ...s, passengers: [...s.passengers, ''] };
      }
      return s;
    }));
  };

  const updatePassenger = (stopId: string, pIndex: number, value: string) => {
    setStops(stops.map(s => {
      if (s.id === stopId) {
        const newPass = [...s.passengers];
        newPass[pIndex] = value;
        return { ...s, passengers: newPass };
      }
      return s;
    }));
  };

  const removePassenger = (stopId: string, pIndex: number) => {
    setStops(stops.map(s => {
      if (s.id === stopId) {
        const newPass = [...s.passengers];
        newPass.splice(pIndex, 1);
        return { ...s, passengers: newPass };
      }
      return s;
    }));
  };

  const sendPushNotification = async (expoPushToken: string, title: string, body: string) => {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      priority: 'high',
      channelId: 'default',
      data: { routeUpdate: true },
    };

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (e) {
      console.log('Error sending push', e);
    }
  };

  const submitShift = async () => {
    if (!driverEmail || !vehiclePlate) {
      Platform.OS === 'web' ? window.alert('Preencha e-mail e placa do veículo') : Alert.alert('Erro', 'Preencha e-mail e placa.');
      return;
    }

    const cleanedStops = stops.map(s => ({
      ...s,
      passengers: s.passengers.filter(p => p.trim() !== '')
    }));

    const isValid = cleanedStops.every(s => s.time.trim() !== '' && s.address.trim() !== '');
    if (!isValid) {
      Platform.OS === 'web' ? window.alert('Todas as paradas precisam de Horário e Endereço') : Alert.alert('Erro', 'Preencha horário e endereço de todas as paradas.');
      return;
    }

    setLoading(true);
    const emailKey = driverEmail.toLowerCase().trim();
    const db = getFirebaseDb();

    try {
      if (editingShiftId) {
        await updateDoc(doc(db, 'shifts', editingShiftId), {
          stops: cleanedStops,
          vehiclePlate: vehiclePlate.toUpperCase(),
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'shifts'), {
          driverEmail: emailKey,
          stops: cleanedStops,
          vehiclePlate: vehiclePlate.toUpperCase(),
          createdAt: new Date(),
          status: 'pending' 
        });
      }
      
      try {
        const userDoc = await getDoc(doc(db, 'users', emailKey));
        if (userDoc.exists()) {
          const pushToken = userDoc.data().pushToken;
          if (pushToken) {
            const title = editingShiftId ? 'Atenção: Sua Rota Foi Alterada! 🔄' : 'Nova Escala Designada! 🚚';
            const body = editingShiftId 
              ? 'A central atualizou o seu roteiro. Por favor, verifique as novas paradas no aplicativo.'
              : `Veículo ${vehiclePlate.toUpperCase()} com ${cleanedStops.length} paradas prontas para você.`;
             await sendPushNotification(pushToken, title, body);
          }
        }
      } catch (pushErr) {
        console.log('Erro ao tentar enviar notificação push', pushErr);
      }

      setDriverEmail('');
      setVehiclePlate('');
      setStops([{ id: Date.now().toString(), time: '', address: '', passengers: [] }]);
      
      if (editingShiftId) {
        Platform.OS === 'web' ? window.alert('Escala atualizada com sucesso!') : Alert.alert('Sucesso', 'Escala atualizada e motorista notificado.');
        setEditingShiftId(null);
        fetchActiveShifts();
        setActiveTab('manage');
      } else {
        Platform.OS === 'web' ? window.alert('Escala enviada com sucesso!') : Alert.alert('Sucesso', 'Escala enviada para o motorista.');
      }

    } catch (e) {
      console.log('Error creating/updating shift', e);
      Platform.OS === 'web' ? window.alert('Erro ao salvar escala') : Alert.alert('Erro', 'Erro ao salvar escala.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditShift = (shift: any) => {
    setEditingShiftId(shift.id);
    setDriverEmail(shift.driverEmail);
    setVehiclePlate(shift.vehiclePlate);
    setStops(shift.stops || [{ id: Date.now().toString(), time: '', address: '', passengers: [] }]);
    setActiveTab('create');
  };

  const cancelEdit = () => {
    setEditingShiftId(null);
    setDriverEmail('');
    setVehiclePlate('');
    setStops([{ id: Date.now().toString(), time: '', address: '', passengers: [] }]);
    setActiveTab('manage');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestão de Escalas</Text>
        <Text style={styles.subtitle}>Crie novos roteiros ou altere rotas em andamento.</Text>
      </View>

      <View style={styles.tabSelector}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'create' && styles.activeTabBtn]} 
          onPress={() => {
            if (editingShiftId) cancelEdit();
            setActiveTab('create');
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'create' && styles.activeTabBtnText]}>
            {editingShiftId ? 'Editando Rota' : 'Criar Escala'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'manage' && styles.activeTabBtn]} 
          onPress={() => setActiveTab('manage')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'manage' && styles.activeTabBtnText]}>Escalas Ativas</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'create' ? (
        <ScrollView style={styles.formCard} showsVerticalScrollIndicator={false}>
          {editingShiftId && (
            <View style={styles.editingBanner}>
              <MaterialCommunityIcons name="alert" size={20} color="#B45309" />
              <Text style={styles.editingBannerText}>Você está alterando o trajeto de uma escala ativa.</Text>
            </View>
          )}
          
          <Text style={styles.label}>E-mail do Motorista</Text>
          <TextInput
            style={[styles.input, editingShiftId ? {backgroundColor: '#E5E7EB', color: '#9CA3AF'} : {}]}
            placeholder="ex: teste@balmiza.com"
            value={driverEmail}
            onChangeText={setDriverEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!editingShiftId}
          />

          <Text style={styles.label}>Placa do Veículo</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: ABC-1234"
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            autoCapitalize="characters"
          />

          <View style={styles.divider} />

          <Text style={[styles.label, { fontSize: 18, marginBottom: 15 }]}>Linha do Tempo (Paradas)</Text>
          
          {stops.map((stop, index) => (
            <View key={stop.id} style={styles.stopCard}>
              <View style={styles.stopHeader}>
                <View style={styles.stopDot} />
                <Text style={styles.stopTitle}>Parada {index + 1}</Text>
                {stops.length > 1 && (
                  <TouchableOpacity onPress={() => removeStop(stop.id)} style={styles.removeBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.red} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.row}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={styles.subLabel}>Horário</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="Ex: 08:00"
                    value={stop.time}
                    onChangeText={(val) => updateStop(stop.id, 'time', val)}
                  />
                </View>
                <View style={{flex: 2}}>
                  <Text style={styles.subLabel}>Endereço do Local</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="Ex: JBS Portão 2"
                    value={stop.address}
                    onChangeText={(val) => updateStop(stop.id, 'address', val)}
                  />
                </View>
              </View>

              {stop.passengers.length > 0 && (
                <View style={styles.passengersContainer}>
                  <Text style={styles.subLabel}>Passageiros neste local:</Text>
                  {stop.passengers.map((pass, pIndex) => (
                    <View key={`pass-${pIndex}`} style={styles.passengerRow}>
                      <MaterialCommunityIcons name="account" size={18} color={colors.graphiteLight} style={{marginRight: 8}} />
                      <TextInput
                        style={styles.passengerInput}
                        placeholder="Nome do Passageiro"
                        value={pass}
                        onChangeText={(val) => updatePassenger(stop.id, pIndex, val)}
                      />
                      <TouchableOpacity onPress={() => removePassenger(stop.id, pIndex)} style={{padding: 5}}>
                        <MaterialCommunityIcons name="close-circle" size={20} color="#ccc" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.addPassengerBtn} onPress={() => addPassenger(stop.id)}>
                <MaterialCommunityIcons name="account-plus" size={16} color={colors.graphite} />
                <Text style={styles.addPassengerText}>+ Adicionar Passageiro</Text>
              </TouchableOpacity>

            </View>
          ))}

          <TouchableOpacity style={styles.addStopBtn} onPress={addStop}>
            <MaterialCommunityIcons name="map-marker-plus" size={20} color={colors.graphite} />
            <Text style={styles.addStopText}>+ Adicionar Nova Parada</Text>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            {editingShiftId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={loading}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.submitBtn} onPress={submitShift} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <MaterialCommunityIcons name="send-check" size={20} color={colors.white} />
                  <Text style={styles.submitBtnText}>
                    {editingShiftId ? 'Atualizar Escala' : 'Enviar para Motorista'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={{height: 100}} />
        </ScrollView>
      ) : (
        <View style={styles.manageContainer}>
          {fetching ? (
            <ActivityIndicator size="large" color={colors.red} style={{marginTop: 50}} />
          ) : activeShifts.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="calendar-check" size={40} color={colors.graphiteLight} />
              <Text style={styles.emptyText}>Nenhuma escala ativa no momento.</Text>
            </View>
          ) : (
            <FlatList
              data={activeShifts}
              keyExtractor={item => item.id}
              contentContainerStyle={{paddingBottom: 100}}
              renderItem={({ item }) => (
                <View style={styles.activeShiftCard}>
                  <View style={styles.activeShiftHeader}>
                    <View style={[styles.statusDot, item.status === 'active' ? {backgroundColor: colors.green} : {backgroundColor: '#F59E0B'}]} />
                    <Text style={styles.activeShiftTitle}>
                      {item.status === 'active' ? 'Em Andamento' : 'Aguardando Início'}
                    </Text>
                  </View>
                  <View style={styles.activeShiftBody}>
                    <Text style={styles.activeShiftLabel}>Motorista: <Text style={styles.activeShiftValue}>{item.driverEmail}</Text></Text>
                    <Text style={styles.activeShiftLabel}>Veículo: <Text style={styles.activeShiftValue}>{item.vehiclePlate}</Text></Text>
                    <Text style={styles.activeShiftLabel}>Paradas Restantes: <Text style={styles.activeShiftValue}>{item.stops?.length || 0}</Text></Text>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEditShift(item)}>
                    <MaterialCommunityIcons name="pencil" size={16} color={colors.white} />
                    <Text style={styles.editBtnText}>Alterar Rota</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', color: colors.graphite },
  subtitle: { fontSize: 14, color: colors.graphiteLight, marginTop: 5 },
  tabSelector: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 5, marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTabBtn: { backgroundColor: colors.white, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2 },
  tabButtonText: { fontSize: 14, fontWeight: 'bold', color: colors.graphiteLight },
  activeTabBtnText: { color: colors.graphite },
  
  formCard: { backgroundColor: colors.white, borderRadius: 16, flex: 1 },
  editingBanner: { flexDirection: 'row', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
  editingBannerText: { color: '#B45309', fontWeight: 'bold', marginLeft: 10, fontSize: 13, flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', color: colors.graphite, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#FAFAFA', borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 16, color: colors.graphite },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  
  stopCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  stopDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.red, marginRight: 10 },
  stopTitle: { fontSize: 16, fontWeight: 'bold', color: colors.graphite, flex: 1 },
  removeBtn: { padding: 5 },
  row: { flexDirection: 'row' },
  subLabel: { fontSize: 12, fontWeight: '600', color: colors.graphiteLight, marginBottom: 5 },
  smallInput: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFF', borderRadius: 8, padding: 10, fontSize: 14, color: colors.graphite },
  
  passengersContainer: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10 },
  passengerInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.graphite },
  
  addPassengerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, padding: 10, backgroundColor: '#E5E7EB', borderRadius: 8 },
  addPassengerText: { fontSize: 13, fontWeight: 'bold', color: colors.graphite, marginLeft: 5 },
  
  addStopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', marginBottom: 30 },
  addStopText: { fontSize: 16, fontWeight: 'bold', color: colors.graphite, marginLeft: 8 },
  
  actionButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: colors.graphite, fontWeight: 'bold', fontSize: 16 },
  submitBtn: { flex: 2, backgroundColor: colors.red, padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },

  manageContainer: { flex: 1 },
  emptyCard: { backgroundColor: colors.white, padding: 30, borderRadius: 16, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.graphiteLight, fontSize: 16, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
  
  activeShiftCard: { backgroundColor: colors.white, borderRadius: 12, padding: 15, marginBottom: 15, elevation: 1, borderWidth: 1, borderColor: colors.border },
  activeShiftHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  activeShiftTitle: { fontSize: 14, fontWeight: 'bold', color: colors.graphite },
  activeShiftBody: { marginBottom: 15 },
  activeShiftLabel: { fontSize: 13, color: colors.graphiteLight, marginBottom: 4 },
  activeShiftValue: { fontWeight: 'bold', color: colors.graphite },
  editBtn: { backgroundColor: colors.graphite, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 5 },
  editBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 14 }
});
