import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Platform, ScrollView
} from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';
import { registerWebPush, unregisterWebPush, checkWebPushPermission } from '../utils/webPush';

interface DriverSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  driverEmail: string;
  navigation: any;
}

export const DriverSettingsModal = ({ visible, onClose, driverEmail, navigation }: DriverSettingsModalProps) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [testing, setTesting] = useState(false);
  const [driverNome, setDriverNome] = useState('');
  const [driverVeiculo, setDriverVeiculo] = useState('Carregando...');
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Detectar se está rodando em modo standalone (PWA instalado no celular)
    if (Platform.OS === 'web') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
      setIsPWA(isStandalone);
    }

    const loadSettings = async () => {
      setCheckingPermission(true);
      try {
        const db = getFirebaseDb();
        const userRef = doc(db, 'usuarios', driverEmail.toLowerCase().trim());
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setDriverNome(data.nome || driverEmail.split('@')[0].toUpperCase());
          setDriverVeiculo(data.veiculoAlocado || 'Nenhum veículo alocado');
          
          // Se tiver a assinatura salva e permissão ativa no navegador
          const permission = checkWebPushPermission();
          if (data.webPushSubscription && permission === 'granted') {
            setNotificationsEnabled(true);
          } else {
            setNotificationsEnabled(false);
          }
        }
      } catch (e) {
        console.log('Erro ao carregar ajustes do motorista:', e);
      } finally {
        setCheckingPermission(false);
      }
    };

    loadSettings();
  }, [visible, driverEmail]);

  const handleToggleNotifications = async (value: boolean) => {
    setCheckingPermission(true);
    if (value) {
      // Registrar notificações
      const success = await registerWebPush(driverEmail);
      if (success) {
        setNotificationsEnabled(true);
        Alert.alert('Sucesso', 'Notificações ativadas no seu celular!');
      } else {
        setNotificationsEnabled(false);
        const permission = checkWebPushPermission();
        if (permission === 'denied') {
          Alert.alert(
            'Permissão Negada',
            'Você bloqueou as notificações. Acesse as configurações do seu navegador para liberar as notificações do Balmiza.'
          );
        } else {
          Alert.alert('Erro', 'Não foi possível ativar as notificações.');
        }
      }
    } else {
      // Cancelar notificações
      const success = await unregisterWebPush(driverEmail);
      if (success) {
        setNotificationsEnabled(false);
        Alert.alert('Sucesso', 'Notificações desativadas.');
      }
    }
    setCheckingPermission(false);
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      const db = getFirebaseDb();
      const userRef = doc(db, 'usuarios', driverEmail.toLowerCase().trim());
      const snap = await getDoc(userRef);

      if (snap.exists() && snap.data().webPushSubscription) {
        const subscription = snap.data().webPushSubscription;

        const apiUrl = Platform.OS === 'web'
          ? '/api/notify-web'
          : (process.env.EXPO_PUBLIC_API_URL || 'https://balmiza-app.vercel.app') + '/api/notify-web';

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription,
            title: '🔔 Teste Balmiza',
            body: `${driverNome.split(' ')[0]}, o teste de notificações do seu celular foi concluído com sucesso!`
          })
        });

        if (res.ok) {
          Alert.alert('Sucesso', 'Notificação enviada! Verifique a tela do seu celular.');
        } else {
          Alert.alert('Erro', 'O envio falhou. Tente reativar a notificação.');
        }
      } else {
        Alert.alert('Notificação Desativada', 'Habilite as notificações primeiro antes de realizar o teste.');
      }
    } catch (e) {
      console.log('Erro ao testar push:', e);
      Alert.alert('Erro', 'Não foi possível disparar a notificação de teste.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="cog" size={24} color="#DF0A0A" />
            <Text style={styles.headerTitle}>AJUSTES DA CONTA</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={24} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Card: Notificações */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>NOTIFICAÇÕES DO DISPOSITIVO</Text>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowTitle}>Permitir alertas</Text>
                <Text style={styles.rowDesc}>
                  Alertas de novas escalas lançadas, avisos urgentes ou atualizações de rota.
                </Text>
              </View>
              {checkingPermission ? (
                <ActivityIndicator color="#DF0A0A" size="small" />
              ) : (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: '#E5E7EB', true: '#FED7D7' }}
                  thumbColor={notificationsEnabled ? '#DF0A0A' : '#9CA3AF'}
                />
              )}
            </View>

            {notificationsEnabled && (
              <TouchableOpacity
                style={[styles.testBtn, testing && { opacity: 0.6 }]}
                onPress={handleTestNotification}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#DF0A0A" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="cellphone-sound" size={18} color="#DF0A0A" />
                    <Text style={styles.testBtnText}>TESTAR RECEBIMENTO</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Card: Dica de Instalação iOS */}
          {Platform.OS === 'web' && !isPWA && (
            <View style={[styles.card, styles.iosTipCard]}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <MaterialCommunityIcons name="apple" size={20} color="#1C1C1E" />
                <Text style={styles.iosTipTitle}>Aviso para iPhone (iOS)</Text>
              </View>
              <Text style={styles.iosTipText}>
                No iPhone, as notificações só funcionam se você instalar o app na tela inicial:
              </Text>
              <Text style={styles.iosStep}>
                1. Toque no botão de **Compartilhar** do Safari (ícone de quadrado com flecha pra cima).
              </Text>
              <Text style={styles.iosStep}>
                2. Role para baixo e selecione **"Adicionar à Tela de Início"**.
              </Text>
              <Text style={styles.iosStep}>
                3. Abra o app Balmiza pela tela inicial e ative as notificações aqui nesta aba de Ajustes.
              </Text>
            </View>
          )}

          {/* Card: Histórico de Viagens */}
          <TouchableOpacity 
            style={[styles.card, styles.historyCard]} 
            onPress={() => {
              onClose();
              navigation.navigate('DriverHistory');
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.historyIconContainer}>
                <MaterialCommunityIcons name="history" size={24} color="#DF0A0A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyCardTitle}>HISTÓRICO DE VIAGENS</Text>
                <Text style={styles.historyCardDesc}>
                  Consulte suas viagens passadas, carros dirigidos e dados registrados.
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#6B7280" />
            </View>
          </TouchableOpacity>

          {/* Card: Perfil e Veículo */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>DADOS DO MOTORISTA</Text>
            
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{driverNome.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.profileName}>{driverNome}</Text>
                <Text style={styles.profileEmail}>{driverEmail}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="car" size={20} color="#6B7280" />
              <View>
                <Text style={styles.infoLabel}>Veículo Alocado Hoje</Text>
                <Text style={styles.infoValue}>{driverVeiculo}</Text>
              </View>
            </View>
          </View>

          {/* Card: Status do Sistema */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SISTEMA</Text>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#2F855A" />
              <View>
                <Text style={styles.infoLabel}>Servidor de Dados</Text>
                <Text style={styles.infoValue}>Conectado ao Vercel Cloud</Text>
              </View>
            </View>
            <View style={[styles.infoRow, { marginTop: 12 }]}>
              <MaterialCommunityIcons name="information" size={20} color="#6B7280" />
              <View>
                <Text style={styles.infoLabel}>Versão</Text>
                <Text style={styles.infoValue}>v1.5.0 PWA Web Push</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1C1C1E', letterSpacing: 0.5 },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F4F6F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 60 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLabel: { fontSize: 11, fontWeight: '900', color: '#6B7280', letterSpacing: 1.5, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  rowDesc: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#DF0A0A',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    backgroundColor: '#FFF5F5',
  },
  testBtnText: { color: '#DF0A0A', fontSize: 13, fontWeight: '900' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#DF0A0A',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  profileName: { fontSize: 16, fontWeight: '900', color: '#1C1C1E' },
  profileEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginTop: 2 },
  iosTipCard: { backgroundColor: '#FFFDF5', borderColor: '#FEF3C7' },
  iosTipTitle: { fontSize: 15, fontWeight: '900', color: '#1C1C1E' },
  iosTipText: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 8 },
  iosStep: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginLeft: 8, marginTop: 4 },
  historyCard: { borderColor: '#FED7D7', backgroundColor: '#FFFDFD' },
  historyIconContainer: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center', alignItems: 'center'
  },
  historyCardTitle: { fontSize: 14, fontWeight: '900', color: '#1C1C1E', letterSpacing: 0.5 },
  historyCardDesc: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 16 }
});
