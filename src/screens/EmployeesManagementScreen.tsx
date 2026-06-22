import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';
import { geocodeAddress } from '../utils/geocoding';
import { CustomAlert } from '../components/CustomAlert';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#DF0A0A',
  brandPrimary: '#DF0A0A',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

export const EmployeesManagementScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [sector, setSector] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const showCustomAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertTitle(title);
    setAlertMsg(msg);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };

  const fetchEmployees = async () => {
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'funcionarios'));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log('Error fetching employees', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmployee = async () => {
    if (!name || !address) {
      showCustomAlert('Erro', 'Preencha o Nome e o Endereço do funcionário.', 'warning');
      return;
    }
    setLoadingAction(true);
    try {
      const db = getFirebaseDb();
      const coords = await geocodeAddress(address);
      const lat = coords ? coords.lat : -23.3568;
      const lon = coords ? coords.lon : -47.8574;

      if (editingId) {
        // Edit passenger
        await updateDoc(doc(db, 'funcionarios', editingId), {
          nome: name.trim(),
          endereco: address.trim(),
          setor: sector.trim() || 'PEGAR AMOSTRAS',
          latitude: lat,
          longitude: lon
        });
        showCustomAlert('Sucesso', 'Funcionário atualizado com sucesso!', 'success');
        setEditingId(null);
      } else {
        // Add passenger
        await addDoc(collection(db, 'funcionarios'), {
          nome: name.trim(),
          endereco: address.trim(),
          setor: sector.trim() || 'PEGAR AMOSTRAS',
          latitude: lat,
          longitude: lon,
          createdAt: new Date()
        });
        showCustomAlert('Sucesso', 'Funcionário cadastrado com sucesso!', 'success');
      }

      setName('');
      setAddress('');
      setSector('');
      fetchEmployees();
    } catch (e) {
      showCustomAlert('Erro', 'Falha ao salvar funcionário.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const startEdit = (emp: any) => {
    setEditingId(emp.id);
    setName(emp.nome || '');
    setAddress(emp.endereco || '');
    setSector(emp.setor || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setAddress('');
    setSector('');
  };

  const handleDelete = (id: string) => {
    showCustomAlert(
      'Excluir Funcionário',
      'Tem certeza que deseja excluir este funcionário da base?',
      'warning',
      async () => {
        setLoading(true);
        try {
          const db = getFirebaseDb();
          await deleteDoc(doc(db, 'funcionarios', id));
          fetchEmployees();
          showCustomAlert('Sucesso', 'Funcionário removido com sucesso.', 'success');
        } catch (e) {
          showCustomAlert('Erro', 'Não foi possível excluir o funcionário.', 'error');
          setLoading(false);
        }
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.graphite} />
        </TouchableOpacity>
        <Text style={styles.title}>Funcionários JBS</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 135 }}>
        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? 'EDITAR PASSAGEIRO / FUNCIONÁRIO' : 'NOVO PASSAGEIRO / FUNCIONÁRIO'}</Text>
          <TextInput style={styles.input} placeholder="Nome Completo (Ex: João Silva)" value={name} onChangeText={setName} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Endereço Completo (Ex: Rua 15 de Novembro, 100)" value={address} onChangeText={setAddress} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Setor / Ação Padrão (Ex: PEGAR AMOSTRAS)" value={sector} onChangeText={setSector} placeholderTextColor="#999" />

          <View style={{ gap: 8 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveEmployee} disabled={loadingAction}>
              {loadingAction ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>{editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR FUNCIONÁRIO'}</Text>
              )}
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={loadingAction}>
                <Text style={styles.cancelBtnText}>CANCELAR EDIÇÃO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List of Registered Employees */}
        <Text style={[styles.sectionTitle, { marginTop: 30, marginBottom: 15 }]}>PASSAGEIROS CADASTRADOS</Text>

        {loading && employees.length === 0 ? (
          <ActivityIndicator size="large" color={colors.graphite} />
        ) : employees.length > 0 ? (
          employees.map((emp) => (
            <View key={emp.id} style={styles.empCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{emp.nome}</Text>
                <Text style={styles.empSub}>{emp.endereco}</Text>
                <Text style={styles.empAction}>Setor: {emp.setor}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TouchableOpacity style={styles.editIconBtn} onPress={() => startEdit(emp)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={colors.graphite} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleDelete(emp.id)} style={styles.deleteBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhum funcionário cadastrado ainda.</Text>
        )}
      </ScrollView>

      {/* Custom alert modal */}
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
  
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.graphite, marginBottom: 12 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 15, fontSize: 16, color: colors.graphite, marginBottom: 15 },
  primaryBtn: { backgroundColor: colors.brandPrimary, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  cancelBtn: { backgroundColor: '#F3F4F6', height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: colors.graphiteLight, fontSize: 14, fontWeight: '900' },
  
  empCard: { backgroundColor: colors.white, borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, elevation: 2 },
  empName: { fontSize: 16, fontWeight: 'bold', color: colors.graphite },
  empSub: { fontSize: 12, color: colors.graphiteLight, marginTop: 4 },
  empAction: { fontSize: 12, fontWeight: 'bold', color: '#B45309', marginTop: 4 },
  
  editIconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { padding: 8, marginLeft: 5 },
  emptyText: { fontSize: 14, color: colors.graphiteLight, textAlign: 'center', marginTop: 20 }
});
