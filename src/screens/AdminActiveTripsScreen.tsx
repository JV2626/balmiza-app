import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';
import { AnimatedCard } from '../components/AnimatedCard';
import { CustomAlert } from '../components/CustomAlert';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  orange: '#DD6B20',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

export const AdminActiveTripsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [editDriverEmail, setEditDriverEmail] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPassengers, setEditPassengers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  const showCustomAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertTitle(title);
    setAlertMsg(msg);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };

  const handleDeleteTrip = (tripIds: string[]) => {
    showCustomAlert(
      'Confirmar Exclusão',
      'Deseja realmente excluir esta(s) escala(s)? Esta ação não pode ser desfeita.',
      'warning',
      async () => {
        try {
          const db = getFirebaseDb();
          for (const id of tripIds) {
            await deleteDoc(doc(db, 'viagens', id));
          }
          showCustomAlert('Sucesso', 'Escala(s) excluída(s) com sucesso!', 'success');
        } catch (e) {
          console.log('Error deleting trip', e);
          showCustomAlert('Erro', 'Ocorreu um erro ao excluir a(s) escala(s).', 'error');
        }
      }
    );
  };

  const handleOpenEditModal = (trip: any) => {
    setSelectedTrip(trip);
    setEditDriverEmail(trip.motoristaId || trip.motoristaNome || '');
    setEditVehiclePlate(trip.carroPlaca || '');
    setEditDate(trip.data || '');
    setEditPassengers(trip.passageiros ? JSON.parse(JSON.stringify(trip.passageiros)) : []);
    setIsEditModalVisible(true);
  };

  const handleUpdatePassenger = (idx: number, field: string, val: string) => {
    const updated = [...editPassengers];
    updated[idx] = { ...updated[idx], [field]: val };
    setEditPassengers(updated);
  };

  const handleAddPassenger = () => {
    setEditPassengers([
      ...editPassengers,
      { nome: '', endereco: '', setor: '', horarioEntrada: '', horarioSaida: '', status: 'pending' }
    ]);
  };

  const handleRemovePassenger = (idx: number) => {
    const updated = [...editPassengers];
    updated.splice(idx, 1);
    setEditPassengers(updated);
  };

  const handleSaveChanges = async () => {
    if (!editDriverEmail || !editVehiclePlate || !editDate) {
      showCustomAlert('Erro', 'Preencha motorista, placa e data.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const db = getFirebaseDb();
      const passengersByTrip: { [key: string]: any[] } = {};
      
      // Inicializar cada documento de viagem associado ao card agrupado
      selectedTrip.tripIds.forEach((id: string) => {
        passengersByTrip[id] = [];
      });

      editPassengers.forEach((p: any) => {
        let tripId = p.originalTripId;
        
        // Se for um passageiro recém adicionado sem tripId original, tenta deduzir pela direção (destinoTag)
        if (!tripId) {
          const isVolta = p.destinoTag?.toUpperCase().includes('VOLTA') || p.destinoTag?.toUpperCase().includes('JBS/CASA');
          const matchedTrip = selectedTrip.originalTrips.find((t: any) => {
            const tVolta = t.destino?.toUpperCase().includes('JBS/CASA') || 
                           t.destino?.toUpperCase().includes('JBSXCASA') ||
                           t.destino?.toUpperCase().includes('JBS X CASA') ||
                           t.destino?.toUpperCase().includes('JBS-CASA') ||
                           t.destino?.toUpperCase().includes('JBS > CASA');
            return isVolta === tVolta;
          });
          tripId = matchedTrip ? matchedTrip.id : selectedTrip.tripIds[0];
        }

        const { destinoTag, originalTripId, ...cleanPassenger } = p;
        passengersByTrip[tripId].push(cleanPassenger);
      });

      // Salvar as alterações em cada um dos documentos Firestore divididos
      for (const tripId of selectedTrip.tripIds) {
        await updateDoc(doc(db, 'viagens', tripId), {
          motoristaId: editDriverEmail.toLowerCase().trim(),
          motoristaNome: editDriverEmail.trim(),
          carroPlaca: editVehiclePlate.toUpperCase().trim(),
          data: editDate.trim(),
          passageiros: passengersByTrip[tripId]
        });
      }

      showCustomAlert('Sucesso', 'Escalas atualizadas com sucesso!', 'success');
      setIsEditModalVisible(false);
    } catch (e) {
      console.log('Error updating trip', e);
      showCustomAlert('Erro', 'Ocorreu um erro ao salvar as alterações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const db = getFirebaseDb();
    const q = query(
      collection(db, 'viagens'),
      where('status', 'in', ['pending', 'active'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trips = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      
      // Agrupar escalas ativas por motorista
      const grouped: { [key: string]: any } = {};
      trips.forEach(t => {
        const key = (t.motoristaId || t.motoristaNome || 'DESCONHECIDO').toLowerCase();
        
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            motoristaId: t.motoristaId,
            motoristaNome: t.motoristaNome,
            carroPlaca: t.carroPlaca,
            data: t.data,
            status: t.status,
            horaInicio: t.horaInicio,
            passageiros: [],
            tripIds: [t.id],
            originalTrips: [t]
          };
        } else {
          grouped[key].tripIds.push(t.id);
          grouped[key].originalTrips.push(t);
          if (t.status === 'active') {
            grouped[key].status = 'active';
          }
          if (t.horaInicio && !grouped[key].horaInicio) {
            grouped[key].horaInicio = t.horaInicio;
          }
        }

        const isVolta = t.destino?.toUpperCase().includes('JBS/CASA') || 
                        t.destino?.toUpperCase().includes('JBSXCASA') ||
                        t.destino?.toUpperCase().includes('JBS X CASA') ||
                        t.destino?.toUpperCase().includes('JBS-CASA') ||
                        t.destino?.toUpperCase().includes('JBS > CASA');
        const destTag = isVolta ? 'Volta' : 'Ida';

        if (t.passageiros) {
          const taggedPassengers = t.passageiros.map((p: any) => ({
            ...p,
            destinoTag: destTag,
            originalTripId: t.id
          }));
          grouped[key].passageiros.push(...taggedPassengers);
        }
      });

      const groupedList = Object.keys(grouped).map(key => {
        const item = grouped[key];
        // Ordenar as paradas do motorista cronologicamente
        item.passageiros.sort((a: any, b: any) => (a.horarioEntrada || '').localeCompare(b.horarioEntrada || ''));
        return item;
      });

      // Ordenar escalas por status (em rota primeiro, depois pendentes)
      groupedList.sort((a, b) => {
        if (a.status === 'active' && b.status === 'pending') return -1;
        if (a.status === 'pending' && b.status === 'active') return 1;
        return 0;
      });

      setActiveTrips(groupedList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color={colors.graphite} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 135}}>
        <Text style={styles.title}>Escalas Ativas</Text>
        
        {activeTrips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTextGarrafal}>NENHUMA ESCALA ATIVA</Text>
            <Text style={styles.emptySub}>Todos os motoristas estão livres ou já encerraram.</Text>
          </View>
        ) : (
          activeTrips.map((trip, index) => (
            <AnimatedCard key={trip.id} style={styles.card} delay={Math.min(index * 70, 700)}>
              <View style={styles.cardHeader}>
                <View style={styles.statusBadgeContainer}>
                  <View style={[styles.statusDot, { backgroundColor: trip.status === 'active' ? colors.green : colors.orange }]} />
                  <Text style={[styles.statusText, { color: trip.status === 'active' ? colors.green : colors.orange }]}>
                    {trip.status === 'active' ? 'EM ROTA' : 'PENDENTE'}
                  </Text>
                </View>
                <Text style={styles.dateText}>{trip.data}</Text>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account-tie-hat" size={24} color={colors.graphite} />
                <Text style={styles.infoText}>{trip.motoristaNome?.split('@')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="car" size={24} color={colors.graphite} />
                <Text style={styles.infoText}>{trip.carroPlaca}</Text>
              </View>

              {trip.horaInicio ? (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="clock-start" size={24} color={colors.green} />
                  <Text style={styles.infoText}>Iniciou às: {trip.horaInicio}</Text>
                </View>
              ) : null}

              <View style={styles.divider} />
              <Text style={styles.passengersTitle}>{trip.passageiros?.length || 0} PASSAGEIRO(S)</Text>
              {trip.passageiros?.map((p: any, idx: number) => {
                const tag = p.destinoTag || 'Ida';
                return (
                  <Text key={idx} style={styles.passengerText}>
                    • <Text style={{ color: '#DF0A0A' }}>{p.horarioEntrada}</Text>
                    <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: 'bold' }}> [{tag}]</Text> - {p.nome}
                  </Text>
                );
              })}

              <View style={styles.cardDivider} />
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEditModal(trip)}>
                  <MaterialCommunityIcons name="pencil" size={16} color={colors.white} />
                  <Text style={styles.btnText}>Alterar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTrip(trip.tripIds)}>
                  <MaterialCommunityIcons name="trash-can" size={16} color={colors.white} />
                  <Text style={styles.btnText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Escala</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.graphite} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginVertical: 15 }}>
              <Text style={styles.modalLabel}>E-mail do Motorista</Text>
              <TextInput
                style={styles.modalInput}
                value={editDriverEmail}
                onChangeText={setEditDriverEmail}
                autoCapitalize="none"
              />

              <Text style={styles.modalLabel}>Placa do Veículo</Text>
              <TextInput
                style={styles.modalInput}
                value={editVehiclePlate}
                onChangeText={setEditVehiclePlate}
                autoCapitalize="characters"
              />

              <Text style={styles.modalLabel}>Data</Text>
              <TextInput
                style={styles.modalInput}
                value={editDate}
                onChangeText={setEditDate}
              />

              <View style={styles.passengersHeaderRow}>
                <Text style={styles.modalLabel}>Passageiros</Text>
                <TouchableOpacity style={styles.addPassBtn} onPress={handleAddPassenger}>
                  <MaterialCommunityIcons name="plus" size={16} color={colors.white} />
                  <Text style={styles.addPassText}>Adicionar</Text>
                </TouchableOpacity>
              </View>

              {editPassengers.map((p, idx) => (
                <View key={idx} style={styles.passengerEditCard}>
                  <View style={styles.passengerHeader}>
                    <Text style={styles.passengerNumber}># {idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemovePassenger(idx)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.red} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.modalInputSmall}
                    placeholder="Nome do passageiro"
                    value={p.nome}
                    onChangeText={(val) => handleUpdatePassenger(idx, 'nome', val)}
                  />

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      style={[styles.modalInputSmall, { flex: 1 }]}
                      placeholder="Entrada"
                      value={p.horarioEntrada}
                      onChangeText={(val) => handleUpdatePassenger(idx, 'horarioEntrada', val)}
                    />
                    <TextInput
                      style={[styles.modalInputSmall, { flex: 1.2 }]}
                      placeholder="Sentido (Ida/Volta)"
                      value={p.destinoTag}
                      onChangeText={(val) => handleUpdatePassenger(idx, 'destinoTag', val)}
                    />
                    <TextInput
                      style={[styles.modalInputSmall, { flex: 1 }]}
                      placeholder="Saída"
                      value={p.horarioSaida}
                      onChangeText={(val) => handleUpdatePassenger(idx, 'horarioSaida', val)}
                    />
                  </View>

                  <TextInput
                    style={styles.modalInputSmall}
                    placeholder="Endereço de embarque"
                    value={p.endereco}
                    onChangeText={(val) => handleUpdatePassenger(idx, 'endereco', val)}
                  />

                  <TextInput
                    style={styles.modalInputSmall}
                    placeholder="Setor"
                    value={p.setor}
                    onChangeText={(val) => handleUpdatePassenger(idx, 'setor', val)}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditModalVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveChanges} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Salvar Alterações</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertConfirmAction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '900', color: colors.graphite, marginBottom: 20, textTransform: 'uppercase' },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  statusBadgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '900' },
  dateText: { fontSize: 14, fontWeight: 'bold', color: colors.graphiteLight },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  infoText: { fontSize: 18, fontWeight: '900', color: colors.graphite },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  passengersTitle: { fontSize: 14, fontWeight: '900', color: colors.graphiteLight, marginBottom: 10 },
  passengerText: { fontSize: 16, fontWeight: 'bold', color: colors.graphite, marginBottom: 5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyTextGarrafal: { fontSize: 32, fontWeight: '900', color: colors.graphite, textAlign: 'center', lineHeight: 35, textTransform: 'uppercase' },
  emptySub: { fontSize: 16, color: colors.graphiteLight, textAlign: 'center', marginTop: 15, fontWeight: 'bold' },
  
  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  editBtn: { flex: 1, backgroundColor: colors.graphite, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 5 },
  deleteBtn: { flex: 1, backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 5 },
  btnText: { color: colors.white, fontSize: 14, fontWeight: 'bold' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.white, borderRadius: 16, width: '100%', maxHeight: '85%', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.graphite },
  modalLabel: { fontSize: 13, fontWeight: 'bold', color: colors.graphite, marginTop: 12, marginBottom: 5 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, color: colors.graphite, backgroundColor: '#FAFAFA' },
  modalInputSmall: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, color: colors.graphite, backgroundColor: '#FFF', marginBottom: 8 },
  passengersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  addPassBtn: { backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  addPassText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },
  passengerEditCard: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 12, marginTop: 5 },
  passengerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  passengerNumber: { fontSize: 13, fontWeight: 'bold', color: colors.graphiteLight },
  modalActions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15, marginTop: 10 },
  modalCancelBtn: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  modalCancelBtnText: { color: colors.graphite, fontWeight: 'bold', fontSize: 15 },
  modalSaveBtn: { flex: 2, padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red },
  modalSaveBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 15 }
});
