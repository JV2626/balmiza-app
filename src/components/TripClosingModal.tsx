import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Image, Alert, Platform, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, updateDoc, getDocs, query, collection, where, addDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { getFirebaseDb } from '../config/firebase';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  red: '#E53E3E',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

interface Props {
  visible: boolean;
  onClose: () => void;
  tripData: any;
}

export const TripClosingModal = ({ visible, onClose, tripData }: Props) => {
  const [kmInicial, setKmInicial] = useState(tripData?.kmInicial?.toString() || '');
  const [kmFinal, setKmFinal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (tripData?.kmInicial) setKmInicial(tripData.kmInicial.toString());
  }, [tripData]);

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadToImgBB(result.assets[0].base64);
    }
  };

  const uploadToImgBB = async (base64Image: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', base64Image);
      const imgbbKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
      if (!imgbbKey) {
        Alert.alert('Aviso', 'A chave da API do ImgBB não foi configurada. A foto não será salva na nuvem.');
        return;
      }
      
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setFotoUrl(data.data.url);
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha ao enviar a foto do painel.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!kmFinal) {
      Alert.alert('Atenção', 'Preencha o KM Final para encerrar a viagem.');
      return;
    }

    if (!fotoUrl) {
      Alert.alert('Atenção', 'É OBRIGATÓRIO enviar a foto do painel (Hodômetro) para comprovar o KM final.');
      return;
    }

    if (Number(kmFinal) <= Number(kmInicial)) {
      Alert.alert('Erro', 'O KM Final deve ser maior que o KM Inicial.');
      return;
    }

    setLoading(true);
    try {
      const db = getFirebaseDb();
      const horaFim = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      await updateDoc(doc(db, 'viagens', tripData.id), {
        status: 'completed',
        horaFim,
        kmInicial: Number(kmInicial),
        kmFinal: Number(kmFinal),
        totalKm: Number(kmFinal) - Number(kmInicial),
        observacoes,
        fotoUrl
      });

      // Sincronizar com a coleção 'trips' do painel administrativo
      await addDoc(collection(db, 'trips'), {
        driverId: tripData.motoristaId || tripData.motoristaNome || 'N/A',
        status: 'completed',
        closedAt: new Date(),
        finalOdometer: Number(kmFinal),
        notes: observacoes || '',
        dashboardImageUrl: fotoUrl || '',
        closingLocation: tripData.destino || 'Itapetininga, SP'
      });

      if (tripData.carroPlaca) {
        const q = query(collection(db, 'veiculos'), where('placa', '==', tripData.carroPlaca));
        const veicSnap = await getDocs(q);
        if (!veicSnap.empty) {
          const veicDoc = veicSnap.docs[0];
          await updateDoc(doc(db, 'veiculos', veicDoc.id), {
            kmAtual: Number(kmFinal)
          });
        }
      }

      onClose();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o fechamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>FECHAMENTO DE VIAGEM</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={28} color={colors.graphite} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>DADOS DO TURNO</Text>
            <Text style={styles.summaryText}>MOTORISTA: {tripData?.motoristaNome}</Text>
            <Text style={styles.summaryText}>VEÍCULO: {tripData?.carroPlaca}</Text>
            <Text style={styles.summaryText}>DATA: {tripData?.data}</Text>
            <Text style={styles.summaryText}>INÍCIO: {tripData?.horaInicio}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>KM INICIAL</Text>
            <TextInput 
              style={styles.input} 
              value={kmInicial} 
              onChangeText={setKmInicial} 
              keyboardType="numeric" 
            />

            <Text style={styles.label}>KM FINAL (Atual)</Text>
            <TextInput 
              style={styles.input} 
              value={kmFinal} 
              onChangeText={setKmFinal} 
              keyboardType="numeric" 
              placeholder="Ex: 15400"
            />

            <Text style={styles.label}>FOTO DO PAINEL (Obrigatório)</Text>
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
              <MaterialCommunityIcons name="camera" size={32} color={colors.graphite} />
              <Text style={styles.photoBtnText}>
                {fotoUrl ? 'FOTO CAPTURADA' : 'TIRAR FOTO DO HODÔMETRO'}
              </Text>
            </TouchableOpacity>
            {fotoUrl ? <Image source={{uri: fotoUrl}} style={styles.thumb} /> : null}

            <Text style={styles.label}>OBSERVAÇÕES (Opcional)</Text>
            <TextInput 
              style={[styles.input, {height: 100, textAlignVertical: 'top'}]} 
              value={observacoes} 
              onChangeText={setObservacoes} 
              multiline 
              placeholder="Aconteceu algo no caminho?"
            />
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <Text style={styles.finishBtnText}>ENCERRAR TURNO</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 0 : 30, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  closeBtn: { padding: 5, backgroundColor: colors.white, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2 },
  summaryCard: { backgroundColor: colors.white, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  summaryTitle: { fontSize: 16, fontWeight: '900', color: colors.graphite, marginBottom: 10, textTransform: 'uppercase' },
  summaryText: { fontSize: 16, fontWeight: 'bold', color: colors.graphiteLight, marginBottom: 5 },
  form: { gap: 15 },
  label: { fontSize: 16, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 15, fontSize: 20, fontWeight: 'bold', color: colors.graphite, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2 },
  photoBtn: { flexDirection: 'row', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 15 },
  photoBtnText: { fontSize: 16, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  thumb: { width: '100%', height: 100, borderRadius: 8, marginTop: 10 },
  finishBtn: { backgroundColor: colors.red, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: colors.red, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4, marginBottom: 35 },
  finishBtnText: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' }
});
