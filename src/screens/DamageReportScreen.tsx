import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert, ScrollView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, addDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  red: '#E53E3E',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

export const DamageReportScreen = ({ navigation }: any) => {
  const [description, setDescription] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [loading, setLoading] = useState(false);

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
      let idToken = '';
      try {
        const auth = getFirebaseAuth();
        if (auth.currentUser) {
          idToken = await auth.currentUser.getIdToken();
        }
      } catch (err) {
        console.log('Erro ao buscar token do Firebase para upload:', err);
      }

      const apiUrl = Platform.OS === 'web' 
        ? '/api/upload' 
        : (process.env.EXPO_PUBLIC_API_URL || 'https://balmiza-app.vercel.app') + '/api/upload';

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken ? `Bearer ${idToken}` : ''
        },
        body: JSON.stringify({ base64Image }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFotoUrl(data.url);
      } else {
        throw new Error(data.error || 'Erro no envio da imagem.');
      }
    } catch (e) {
      console.log('Erro no upload para ImgBB:', e);
      Alert.alert('Erro', 'Falha ao enviar a foto da avaria.');
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async () => {
    if (!description || !fotoUrl) {
      Alert.alert('Atenção', 'É obrigatório enviar uma foto e uma breve descrição do dano.');
      return;
    }

    setLoading(true);
    try {
      const db = getFirebaseDb();
      const email = await AsyncStorage.getItem('@userEmail') || 'desconhecido';
      
      await addDoc(collection(db, 'avarias'), {
        motoristaEmail: email,
        descricao: description,
        fotoUrl: fotoUrl,
        data: new Date().toISOString(),
        status: 'pendente'
      });

      Alert.alert('Sucesso', 'Relatório de avaria enviado para a central!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao enviar relatório.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 135}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={colors.graphite} />
        </TouchableOpacity>
        <Text style={styles.title}>RELATAR AVARIA</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.infoText}>
            Esta seção é opcional e serve para sua proteção. Relate arranhões, amassados ou danos encontrados no veículo antes de iniciar sua viagem ou ao terminar.
          </Text>

          <Text style={styles.label}>FOTO DA AVARIA (Obrigatório)</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <MaterialCommunityIcons name="camera-plus" size={40} color={colors.graphite} />
            <Text style={styles.photoBtnText}>
              {fotoUrl ? 'FOTO CAPTURADA (CLIQUE P/ TROCAR)' : 'TIRAR FOTO DO DANO'}
            </Text>
          </TouchableOpacity>
          {fotoUrl ? <Image source={{uri: fotoUrl}} style={styles.thumb} /> : null}

          <Text style={styles.label}>DESCRIÇÃO (Obrigatório)</Text>
          <TextInput 
            style={styles.input} 
            value={description} 
            onChangeText={setDescription} 
            multiline 
            placeholder="Ex: Parachoque dianteiro com risco profundo do lado esquerdo."
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submitReport} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <Text style={styles.submitBtnText}>ENVIAR RELATÓRIO</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, zIndex: 10 },
  backBtn: { marginRight: 15, padding: 5, backgroundColor: colors.background, borderRadius: 8, elevation: 1 },
  title: { fontSize: 22, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  content: { padding: 20 },
  card: { backgroundColor: colors.white, padding: 20, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, marginBottom: 30 },
  infoText: { fontSize: 16, color: colors.graphiteLight, marginBottom: 30, lineHeight: 24, fontWeight: 'bold' },
  label: { fontSize: 16, fontWeight: '900', color: colors.graphite, marginBottom: 10, marginTop: 10, textTransform: 'uppercase' },
  photoBtn: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', height: 120, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 15 },
  photoBtnText: { fontSize: 14, fontWeight: '900', color: colors.graphite, textAlign: 'center', textTransform: 'uppercase' },
  thumb: { width: '100%', height: 200, borderRadius: 12, marginTop: 15 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 15, fontSize: 18, color: colors.graphite, height: 150, textAlignVertical: 'top', marginTop: 10, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2 },
  submitBtn: { backgroundColor: colors.graphite, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: colors.graphite, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4 },
  submitBtnText: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' }
});
