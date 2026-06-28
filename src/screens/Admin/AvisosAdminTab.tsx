import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Alert, Platform, ScrollView
} from 'react-native';
import { collection, addDoc, onSnapshot, deleteDoc, doc, orderBy, query, getDocs } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb, getFirebaseAuth } from '../../config/firebase';
import { colors } from '../../theme/colors';
import { sendPushToMultiple } from '../../utils/notifications';

interface Aviso {
  id: string;
  texto: string;
  autorEmail: string;
  criadoEm: any;
  lidos: string[];
}

export const AvisosAdminTab = () => {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [novoAviso, setNovoAviso] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Aviso)));
      setLoading(false);
    });
    setLoading(true);
    return () => unsub();
  }, []);

  const handlePublicar = async () => {
    if (!novoAviso.trim()) {
      Alert.alert('Atenção', 'Escreva uma mensagem para publicar.');
      return;
    }

    setSending(true);
    try {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const autorEmail = auth.currentUser?.email || 'admin';

      // Salvar aviso no Firestore
      await addDoc(collection(db, 'avisos'), {
        texto: novoAviso.trim(),
        autorEmail,
        criadoEm: new Date(),
        lidos: [],
      });

      // Buscar tokens de push de todos os motoristas e enviar notificação
      const usuariosSnap = await getDocs(
        query(collection(db, 'usuarios'))
      );
      const tokens: string[] = usuariosSnap.docs
        .map(d => d.data())
        .filter(u => (u.role === 'driver' || u.role === 'motorista') && u.pushToken)
        .map(u => u.pushToken);

      if (tokens.length > 0) {
        await sendPushToMultiple(
          tokens,
          '📢 Aviso da Central Balmiza',
          novoAviso.trim()
        );
      }

      setNovoAviso('');
    } catch (e) {
      console.log('Erro ao publicar aviso:', e);
      Alert.alert('Erro', 'Não foi possível publicar o aviso.');
    } finally {
      setSending(false);
    }
  };

  const handleExcluir = (avisoId: string) => {
    Alert.alert('Excluir Aviso', 'Tem certeza que deseja excluir este aviso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(getFirebaseDb(), 'avisos', avisoId));
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível excluir.');
          }
        }
      }
    ]);
  };

  const formatarData = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const renderAviso = ({ item }: { item: Aviso }) => (
    <View style={styles.avisoCard}>
      <View style={styles.avisoHeader}>
        <View style={styles.avisoIconWrap}>
          <MaterialCommunityIcons name="bullhorn" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.avisoMeta}>
            {formatarData(item.criadoEm)} · {item.lidos?.length || 0} leram
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleExcluir(item.id)} style={styles.deleteBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.avisoTexto}>{item.texto}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="bullhorn-outline" size={28} color={colors.red} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Canal de Avisos</Text>
          <Text style={styles.headerSub}>Mensagens para todos os motoristas</Text>
        </View>
      </View>

      {/* Área de composição */}
      <View style={styles.composeCard}>
        <Text style={styles.composeLabel}>NOVO AVISO</Text>
        <TextInput
          style={styles.composeInput}
          value={novoAviso}
          onChangeText={setNovoAviso}
          placeholder="Ex: Amanhã não haverá escala das 17h por feriado."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{novoAviso.length}/500</Text>
          <TouchableOpacity
            style={[styles.publishBtn, sending && { opacity: 0.6 }]}
            onPress={handlePublicar}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={16} color={colors.white} />
                <Text style={styles.publishBtnText}>PUBLICAR</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de avisos */}
      <Text style={styles.sectionTitle}>AVISOS PUBLICADOS</Text>
      {loading ? (
        <ActivityIndicator color={colors.red} style={{ marginTop: 30 }} />
      ) : avisos.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="bullhorn-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nenhum aviso publicado ainda</Text>
        </View>
      ) : (
        <FlatList
          data={avisos}
          keyExtractor={item => item.id}
          renderItem={renderAviso}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.graphite },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  composeCard: {
    backgroundColor: colors.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  composeLabel: { fontSize: 11, fontWeight: '900', color: '#6B7280', letterSpacing: 1, marginBottom: 8 },
  composeInput: {
    fontSize: 15,
    color: colors.graphite,
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  publishBtn: {
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  publishBtnText: { color: colors.white, fontWeight: '900', fontSize: 13 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 1.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  avisoCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  avisoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  avisoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avisoMeta: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  avisoTexto: { fontSize: 15, color: colors.graphite, lineHeight: 22, fontWeight: '500' },
  deleteBtn: { padding: 4 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
});
