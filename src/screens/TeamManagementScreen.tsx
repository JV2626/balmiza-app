import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator
} from 'react-native';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
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

export const TeamManagementScreen = ({ navigation }: any) => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // New/Edit driver form
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  React.useEffect(() => {
    fetchDrivers();
  }, []);

  const showCustomAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertTitle(title);
    setAlertMsg(msg);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };

  const fetchDrivers = async () => {
    setLoadingList(true);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'usuarios'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrivers(all.filter((u: any) => u.role === 'driver' || u.role === 'motorista'));
    } catch (e) {
      showCustomAlert('Erro', 'Não foi possível carregar os motoristas.', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  const handleSaveDriver = async () => {
    if (!nome) {
      showCustomAlert('Atenção', 'Preencha o Nome do motorista.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const db = getFirebaseDb();

      if (editingId) {
        // Edit driver name
        await updateDoc(doc(db, 'usuarios', editingId), {
          nome: nome.trim(),
        });
        showCustomAlert('Sucesso', `Motorista ${nome} atualizado!`, 'success');
        setEditingId(null);
        setNome(''); setEmail(''); setSenha('');
        fetchDrivers();
      } else {
        // Create new driver
        if (!email || !senha) {
          showCustomAlert('Atenção', 'Preencha o E-mail e a Senha do motorista.', 'warning');
          setLoading(false);
          return;
        }
        if (senha.length < 6) {
          showCustomAlert('Atenção', 'A senha deve ter pelo menos 6 caracteres.', 'warning');
          setLoading(false);
          return;
        }
        const auth = getFirebaseAuth();
        // Create Firebase Auth user
        const userCred = await auth.createUserWithEmailAndPassword(email.trim().toLowerCase(), senha);
        const uid = userCred.user!.uid;

        // Save to Firestore usuarios collection
        await setDoc(doc(db, 'usuarios', email.trim().toLowerCase()), {
          uid,
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          role: 'driver',
          ativo: true,
          createdAt: new Date(),
        });

        showCustomAlert('Sucesso', `Motorista ${nome} cadastrado com sucesso!`, 'success');
        setNome(''); setEmail(''); setSenha('');
        fetchDrivers();
      }
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        showCustomAlert('Erro', 'Este e-mail já está cadastrado no sistema.', 'error');
      } else {
        showCustomAlert('Erro', e.message || 'Não foi possível cadastrar o motorista.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (d: any) => {
    setEditingId(d.id);
    setNome(d.nome || '');
    setEmail(d.email || d.id);
    setSenha('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNome('');
    setEmail('');
    setSenha('');
  };

  const toggleDriver = (driver: any) => {
    const action = driver.ativo !== false ? 'desativar' : 'reativar';
    
    showCustomAlert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Motorista`,
      `Deseja ${action} ${driver.nome || driver.email}?`,
      'warning',
      async () => {
        try {
          const db = getFirebaseDb();
          await updateDoc(doc(db, 'usuarios', driver.id), { ativo: driver.ativo === false });
          fetchDrivers();
        } catch (e) {
          showCustomAlert('Erro', 'Não foi possível atualizar o motorista.', 'error');
        }
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header back navigation bar */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.graphite} />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Equipe</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Form Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons 
              name={editingId ? "account-edit" : "account-plus"} 
              size={28} 
              color={colors.brandPrimary} 
            />
            <Text style={styles.cardTitle}>{editingId ? 'Editar Motorista' : 'Cadastrar Motorista'}</Text>
          </View>
          <TextInput style={styles.input} placeholder="Nome Completo" value={nome} onChangeText={setNome} placeholderTextColor="#999" />
          <TextInput 
            style={[styles.input, editingId ? { backgroundColor: '#E5E7EB', color: '#9CA3AF' } : {}]} 
            placeholder="E-mail de acesso" 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
            keyboardType="email-address" 
            placeholderTextColor="#999"
            editable={!editingId}
          />
          {!editingId && (
            <TextInput style={styles.input} placeholder="Senha (mín. 6 caracteres)" value={senha} onChangeText={setSenha} secureTextEntry placeholderTextColor="#999" />
          )}

          <View style={{ gap: 8 }}>
            <TouchableOpacity style={styles.addBtn} onPress={handleSaveDriver} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.addBtnText}>{editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR MOTORISTA'}</Text>
              )}
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={loading}>
                <Text style={styles.cancelBtnText}>CANCELAR EDIÇÃO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Driver List */}
        <Text style={styles.sectionLabel}>EQUIPE CADASTRADA</Text>
        {loadingList ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 20 }} />
        ) : drivers.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum motorista cadastrado ainda.</Text>
        ) : (
          drivers.map(d => (
            <View key={d.id} style={[styles.driverCard, d.ativo === false && styles.driverCardInactive]}>
              <MaterialCommunityIcons name="account-circle" size={40} color={colors.graphiteLight} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverName}>{d.nome || 'Sem nome'}</Text>
                <Text style={styles.driverEmail}>{d.email || d.id}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TouchableOpacity style={styles.editIconBtn} onPress={() => startEdit(d)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={colors.graphite} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.toggleBtn, { backgroundColor: d.ativo !== false ? '#FEE2E2' : '#D1FAE5' }]} 
                  onPress={() => toggleDriver(d)}
                >
                  <MaterialCommunityIcons name={d.ativo !== false ? 'account-off' : 'account-check'} size={18} color={d.ativo !== false ? colors.red : colors.green} />
                  <Text style={[styles.toggleBtnText, { color: d.ativo !== false ? colors.red : colors.green }]}>
                    {d.ativo !== false ? 'Desativar' : 'Reativar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Custom Alert */}
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
  
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  driverCardInactive: { opacity: 0.5 },
  driverName: { fontSize: 16, fontWeight: '900', color: colors.graphite },
  driverEmail: { fontSize: 13, color: colors.graphiteLight, marginTop: 2 },
  
  editIconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  toggleBtnText: { fontSize: 12, fontWeight: 'bold' },
});
