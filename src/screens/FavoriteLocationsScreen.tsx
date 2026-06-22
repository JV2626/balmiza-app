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

export const FavoriteLocationsScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [defaultAction, setDefaultAction] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  useEffect(() => {
    fetchLocations();
  }, []);

  const showCustomAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertTitle(title);
    setAlertMsg(msg);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };

  const fetchLocations = async () => {
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'locais_favoritos'));
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log('Error fetching favorite locations', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!name || !address) {
      showCustomAlert('Erro', 'Preencha o Nome e o Endereço.', 'warning');
      return;
    }
    setLoadingAction(true);
    try {
      const db = getFirebaseDb();
      const coords = await geocodeAddress(address);
      const lat = coords ? coords.lat : -23.3568;
      const lon = coords ? coords.lon : -47.8574;

      if (editingId) {
        // Edit location
        await updateDoc(doc(db, 'locais_favoritos', editingId), {
          nome: name.trim(),
          endereco: address.trim(),
          setor: defaultAction.trim() || 'PEGAR AMOSTRAS',
          latitude: lat,
          longitude: lon
        });
        showCustomAlert('Sucesso', 'Local favorito atualizado com sucesso!', 'success');
        setEditingId(null);
      } else {
        // Add location
        await addDoc(collection(db, 'locais_favoritos'), {
          nome: name.trim(),
          endereco: address.trim(),
          setor: defaultAction.trim() || 'PEGAR AMOSTRAS',
          latitude: lat,
          longitude: lon,
          createdAt: new Date()
        });
        showCustomAlert('Sucesso', 'Local favorito cadastrado com sucesso!', 'success');
      }

      setName('');
      setAddress('');
      setDefaultAction('');
      fetchLocations();
    } catch (e) {
      showCustomAlert('Erro', 'Falha ao salvar local favorito.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const startEdit = (loc: any) => {
    setEditingId(loc.id);
    setName(loc.nome || '');
    setAddress(loc.endereco || '');
    setDefaultAction(loc.setor || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setAddress('');
    setDefaultAction('');
  };

  const handleDelete = (id: string) => {
    showCustomAlert(
      'Excluir Local',
      'Tem certeza que deseja excluir este local favorito?',
      'warning',
      async () => {
        setLoading(true);
        try {
          const db = getFirebaseDb();
          await deleteDoc(doc(db, 'locais_favoritos', id));
          fetchLocations();
          showCustomAlert('Sucesso', 'Local removido dos favoritos.', 'success');
        } catch (e) {
          showCustomAlert('Erro', 'Não foi possível excluir o local favorito.', 'error');
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
        <Text style={styles.title}>Locais Favoritos</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 135 }}>
        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? 'EDITAR LOCAL FAVORITO' : 'NOVO LOCAL FAVORITO'}</Text>
          <TextInput style={styles.input} placeholder="Nome (Ex: JBS Tatuí)" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Endereço / Rodovia (Ex: Rod. SP-141 Km 20)" value={address} onChangeText={setAddress} />
          <TextInput style={styles.input} placeholder="Ação Padrão (Ex: Pegar Amostras)" value={defaultAction} onChangeText={setDefaultAction} />

          <View style={{ gap: 8 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveLocation} disabled={loadingAction}>
              {loadingAction ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>{editingId ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR AOS FAVORITOS'}</Text>
              )}
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={loadingAction}>
                <Text style={styles.cancelBtnText}>CANCELAR EDIÇÃO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List of Favorite Locations */}
        <Text style={[styles.sectionTitle, { marginTop: 30, marginBottom: 15 }]}>SEUS LOCAIS SALVOS</Text>

        {loading && locations.length === 0 ? (
          <ActivityIndicator size="large" color={colors.graphite} />
        ) : locations.length > 0 ? (
          locations.map((loc) => (
            <View key={loc.id} style={styles.locCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.locName}>{loc.nome}</Text>
                <Text style={styles.locSub}>{loc.endereco}</Text>
                <Text style={styles.locAction}>Ação: {loc.setor}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TouchableOpacity style={styles.editIconBtn} onPress={() => startEdit(loc)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={colors.graphite} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleDelete(loc.id)} style={styles.deleteBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhum local favorito salvo ainda.</Text>
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
  
  locCard: { backgroundColor: colors.white, borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, elevation: 2 },
  locName: { fontSize: 16, fontWeight: 'bold', color: colors.graphite },
  locSub: { fontSize: 12, color: colors.graphiteLight, marginTop: 4 },
  locAction: { fontSize: 12, fontWeight: 'bold', color: '#B45309', marginTop: 4 },
  
  editIconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { padding: 8, marginLeft: 5 },
  emptyText: { fontSize: 14, color: colors.graphiteLight, textAlign: 'center', marginTop: 20 }
});
