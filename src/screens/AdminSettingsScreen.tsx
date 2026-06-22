import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';
import { PinInput, hasPinSet } from '../components/PinInput';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  brandPrimary: '#DF0A0A', // Balmiza Red
  border: '#E5E7EB',
  background: '#F4F6F8'
};

export const AdminSettingsScreen = ({ navigation }: any) => {
  const [token, setToken] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [showCreatePin, setShowCreatePin] = useState(false);

  useEffect(() => {
    checkToken();
    checkPin();
  }, []);

  const checkPin = async () => {
    const exists = await hasPinSet();
    setPinSet(exists);
  };

  const checkToken = async () => {
    const savedToken = await AsyncStorage.getItem('@pushToken');
    setToken(savedToken);
  };

  const handleLogout = async () => {
    try {
      await getFirebaseAuth().signOut();
    } catch (e) {
      console.log('Erro ao fazer signOut:', e);
    }
    await AsyncStorage.removeItem('@userId');
    await AsyncStorage.removeItem('@userRole');
    await AsyncStorage.removeItem('@userEmail');
    navigation.replace('Login');
  };

  const removePin = async () => {
    Alert.alert('Remover PIN', 'Tem certeza que deseja desativar o acesso por PIN?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem('@balmiza_pin');
        setPinSet(false);
        Alert.alert('PIN removido', 'Você voltará a usar email e senha para entrar.');
      }}
    ]);
  };

  const requestPushPermission = async () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const permission = await window.Notification.requestPermission();
          if (permission === 'granted') {
            setToken('web-granted');
            await AsyncStorage.setItem('@pushToken', 'web-granted');
            
            // Upsert a dummy token to user doc
            const email = await AsyncStorage.getItem('@userEmail');
            if (!email) {
              Alert.alert('Erro', 'Sessão inválida.');
              return;
            }
            const db = getFirebaseDb();
            const userRef = doc(db, 'usuarios', email.toLowerCase());
            await setDoc(userRef, { pushToken: 'web-granted' }, { merge: true });

            Alert.alert('Sucesso!', 'Notificações de desktop ativadas no seu navegador!');
          } else {
            Alert.alert('Aviso', 'Permissão de notificação negada no navegador. Habilite nas configurações do site.');
          }
        } catch (err) {
          console.log('Error requesting web notification', err);
          Alert.alert('Erro', 'Não foi possível solicitar permissão no navegador.');
        }
      } else {
        Alert.alert('Aviso', 'Este navegador não suporta notificações de desktop.');
      }
      return;
    }

    if (!Device.isDevice) {
      Alert.alert('Aviso', 'Notificações Push só funcionam em dispositivos físicos, não em emuladores.');
      return;
    }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#DF0A0A',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Atenção', 'Falha ao obter permissão para Push Notifications. Libere nas configurações do seu celular.');
        return;
      }

      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '9a371ac6-7586-4c1c-8b60-aafef3456b58' // EAS Project ID
      });

      const newToken = pushTokenData.data;
      setToken(newToken);
      await AsyncStorage.setItem('@pushToken', newToken);
      
      const email = await AsyncStorage.getItem('@userEmail');
      if (!email) {
        Alert.alert('Erro', 'Sessão inválida.');
        return;
      }
      const db = getFirebaseDb();
      const userRef = doc(db, 'usuarios', email.toLowerCase());
      
      // Upsert token to user doc
      await setDoc(userRef, { pushToken: newToken }, { merge: true });

      Alert.alert('Sucesso!', 'Notificações ativadas! O token foi salvo no banco de dados e você receberá avisos.');
      
    } catch (e: any) {
      console.log('Error requesting push', e);
      Alert.alert('Erro', `Não foi possível configurar as notificações. Certifique-se de compilar o APK nativamente. Detalhes: ${e.message || e}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 135}}>
      <Text style={styles.title}>Configurações</Text>

      {/* PIN Card */}
      <View style={[styles.card, {marginBottom: 16}]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="lock" size={32} color={colors.graphite} />
          <Text style={styles.sectionTitle}>PIN de Acesso Rápido</Text>
        </View>
        <Text style={styles.descText}>
          Crie um PIN de 4 dígitos para entrar no app sem precisar digitar e-mail e senha toda vez.
        </Text>
        {pinSet ? (
          <View style={{gap: 10}}>
            <View style={styles.successBox}>
              <MaterialCommunityIcons name="check-circle" size={24} color={colors.green} />
              <Text style={styles.successText}>PIN de Acesso Ativo</Text>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={removePin}>
              <Text style={styles.secondaryBtnText}>REMOVER PIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreatePin(true)}>
            <Text style={styles.primaryBtnText}>CRIAR PIN DE 4 DÍGITOS</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Fleet & Team Management */}
      <View style={[styles.card, {marginBottom: 16}]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="car-outline" size={32} color={colors.graphite} />
          <Text style={styles.sectionTitle}>Gestão da Operação</Text>
        </View>
        <Text style={styles.descText}>Adicione ou desative veículos e motoristas diretamente pelo aplicativo.</Text>
        <TouchableOpacity style={[styles.primaryBtn, {marginBottom: 10}]} onPress={() => navigation.navigate('FleetManagement' as never)}>
          <Text style={styles.primaryBtnText}>GERENCIAR FROTA (VEÍCULOS)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: colors.graphite, marginBottom: 10}]} onPress={() => navigation.navigate('TeamManagement' as never)}>
          <Text style={styles.primaryBtnText}>GERENCIAR EQUIPE (MOTORISTAS)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#B45309', marginBottom: 10}]} onPress={() => navigation.navigate('EmployeesManagement' as never)}>
          <Text style={styles.primaryBtnText}>GERENCIAR PASSAGEIROS (JBS)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: '#5A6268', marginBottom: 10}]} onPress={() => navigation.navigate('FavoriteLocations' as never)}>
          <Text style={styles.primaryBtnText}>GERENCIAR LOCAIS FAVORITOS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: colors.brandPrimary}]} onPress={() => navigation.navigate('TripsHistory' as never)}>
          <Text style={styles.primaryBtnText}>HISTÓRICO DE VIAGENS (ESCALAS)</Text>
        </TouchableOpacity>
      </View>

      {/* Push Notifications Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="bell-ring" size={32} color={colors.graphite} />
          <Text style={styles.sectionTitle}>Notificações Push</Text>
        </View>
        <Text style={styles.descText}>
          Receba avisos instantâneos quando motoristas iniciarem ou finalizarem rotas, ou caso reportem alguma avaria no veículo.
        </Text>
        
        {token ? (
          <View style={styles.successBox}>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.green} />
            <Text style={styles.successText}>Notificações Ativas no Aparelho</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPushPermission}>
            <Text style={styles.primaryBtnText}>ATIVAR NOTIFICAÇÕES</Text>
          </TouchableOpacity>
        )}
      </View>

      <PinInput
        visible={showCreatePin}
        mode="create"
        onSuccess={() => { setShowCreatePin(false); setPinSet(true); Alert.alert('PIN criado!', 'Na próxima vez que abrir o app, basta digitar seus 4 dígitos.'); }}
        onCancel={() => setShowCreatePin(false)}
      />

      <View style={{flex: 1}} />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout" size={24} color={colors.red} />
        <Text style={styles.logoutText}>SAIR DO SISTEMA</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '900', color: colors.graphite, marginBottom: 20, textTransform: 'uppercase' },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: colors.graphite },
  descText: { fontSize: 16, color: colors.graphiteLight, lineHeight: 22, marginBottom: 20, fontWeight: '500' },
  primaryBtn: { backgroundColor: colors.brandPrimary, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  secondaryBtn: { backgroundColor: colors.background, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  secondaryBtnText: { color: colors.graphiteLight, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  successBox: { flexDirection: 'row', backgroundColor: '#F0FFF4', padding: 15, borderRadius: 8, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#C6F6D5' },
  successText: { fontSize: 14, fontWeight: 'bold', color: colors.green },
  logoutBtn: { flexDirection: 'row', backgroundColor: colors.white, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.red, gap: 10 },
  logoutText: { color: colors.red, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' }
});
