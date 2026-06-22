import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator
} from 'react-native';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';
import { CustomAlert } from '../components/CustomAlert';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#DF0A0A',
  brandPrimary: '#DF0A0A',
  border: '#E5E7EB',
  background: '#F4F6F8',
};

export const FleetManagementScreen = ({ navigation }: any) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // New/Edit vehicle form
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [kmAtual, setKmAtual] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  React.useEffect(() => {
    fetchVehicles();
  }, []);

  const showCustomAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertTitle(title);
    setAlertMsg(msg);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };

  const fetchVehicles = async () => {
    setLoadingList(true);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'veiculos'));
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showCustomAlert('Erro', 'Não foi possível carregar os veículos.', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!placa || !modelo) {
      showCustomAlert('Atenção', 'Preencha a Placa e o Modelo do veículo.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const vehicleKm = Number(kmAtual) || 0;

      if (editingId) {
        // Edit vehicle
        await updateDoc(doc(db, 'veiculos', editingId), {
          placa: placa.toUpperCase().trim(),
          modelo: modelo.trim(),
          kmAtual: vehicleKm,
        });
        showCustomAlert('Sucesso', `Veículo ${placa.toUpperCase()} atualizado!`, 'success');
        setEditingId(null);
      } else {
        // Add vehicle
        await addDoc(collection(db, 'veiculos'), {
          placa: placa.toUpperCase().trim(),
          modelo: modelo.trim(),
          kmAtual: vehicleKm,
          kmUltimaRevisao: vehicleKm,
          ativo: true,
          createdAt: new Date(),
        });
        showCustomAlert('Sucesso', `Veículo ${placa.toUpperCase()} cadastrado!`, 'success');
      }

      setPlaca(''); 
      setModelo(''); 
      setKmAtual('');
      fetchVehicles();
    } catch (e) {
      showCustomAlert('Erro', 'Não foi possível salvar o veículo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (v: any) => {
    setEditingId(v.id);
    setPlaca(v.placa);
    setModelo(v.modelo);
    setKmAtual(v.kmAtual ? String(v.kmAtual) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPlaca(''); 
    setModelo(''); 
    setKmAtual('');
  };

  const toggleVehicle = (vehicle: any) => {
    const action = vehicle.ativo ? 'desativar' : 'reativar';
    
    showCustomAlert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Veículo`,
      `Deseja ${action} o veículo ${vehicle.placa}?`,
      'warning',
      async () => {
        try {
          const db = getFirebaseDb();
          await updateDoc(doc(db, 'veiculos', vehicle.id), { ativo: !vehicle.ativo });
          fetchVehicles();
        } catch (e) {
          showCustomAlert('Erro', 'Não foi possível atualizar o veículo.', 'error');
        }
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Premium Back Navigation Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.graphite} />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Frota</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Form Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons 
              name={editingId ? "pencil-box-outline" : "garage-open"} 
              size={28} 
              color={colors.brandPrimary} 
            />
            <Text style={styles.cardTitle}>{editingId ? 'Editar Veículo' : 'Adicionar Veículo'}</Text>
          </View>
          <TextInput style={styles.input} placeholder="Placa (ex: ABC-1234)" value={placa} onChangeText={setPlaca} autoCapitalize="characters" placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Modelo (ex: Fiat Uno)" value={modelo} onChangeText={setModelo} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="KM Atual (ex: 45000)" value={kmAtual} onChangeText={setKmAtual} keyboardType="numeric" placeholderTextColor="#999" />
          
          <View style={{ gap: 8 }}>
            <TouchableOpacity style={styles.addBtn} onPress={handleSaveVehicle} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.addBtnText}>{editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR VEÍCULO'}</Text>
              )}
            </TouchableOpacity>
            
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={loading}>
                <Text style={styles.cancelBtnText}>CANCELAR EDIÇÃO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Vehicle List */}
        <Text style={styles.sectionLabel}>FROTA CADASTRADA</Text>
        {loadingList ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 20 }} />
        ) : vehicles.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum veículo cadastrado ainda.</Text>
        ) : (
          vehicles.map(v => (
            <View key={v.id} style={[styles.vehicleCard, !v.ativo && styles.vehicleCardInactive]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehiclePlaca}>{v.placa}</Text>
                <Text style={styles.vehicleInfo}>{v.modelo} · {v.kmAtual?.toLocaleString() || 0} KM</Text>
              </View>
              
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={styles.editIconBtn} onPress={() => startEdit(v)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={colors.graphite} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.toggleBtn, { backgroundColor: v.ativo ? '#FEE2E2' : '#D1FAE5' }]} 
                  onPress={() => toggleVehicle(v)}
                >
                  <MaterialCommunityIcons name={(v.ativo ? 'cancel' : 'check-circle') as any} size={18} color={v.ativo ? colors.red : colors.green} />
                  <Text style={[styles.toggleBtnText, { color: v.ativo ? colors.red : colors.green }]}>
                    {v.ativo ? 'Desativar' : 'Reativar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Custom Premium Alert */}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 8, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 22, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: colors.graphite },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16, color: colors.graphite },
  addBtn: { backgroundColor: colors.brandPrimary, height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  addBtnText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  cancelBtn: { backgroundColor: '#F3F4F6', height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: colors.graphiteLight, fontSize: 14, fontWeight: '900' },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: colors.graphiteLight, marginBottom: 12, marginTop: 4 },
  emptyText: { color: colors.graphiteLight, fontWeight: 'bold', textAlign: 'center', marginTop: 20 },
  
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  vehicleCardInactive: { opacity: 0.5 },
  vehiclePlaca: { fontSize: 18, fontWeight: '900', color: colors.graphite },
  vehicleInfo: { fontSize: 13, color: colors.graphiteLight, marginTop: 3 },
  
  editIconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  toggleBtnText: { fontSize: 12, fontWeight: 'bold' },
});
