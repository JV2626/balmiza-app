import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView
} from 'react-native';
import {
  collection, query, onSnapshot, addDoc, orderBy,
  updateDoc, doc, getDocs, where
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb, getFirebaseAuth } from '../../config/firebase';
import { colors } from '../../theme/colors';
import { sendPushNotification } from '../../utils/notifications';

interface Motorista {
  email: string;
  nome: string;
  pushToken?: string;
}

interface Mensagem {
  id: string;
  de: string;
  texto: string;
  criadoEm: any;
  lido: boolean;
}

export const ChatAdminTab = () => {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [selecionado, setSelecionado] = useState<Motorista | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [loadingMotoristas, setLoadingMotoristas] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [naoLidosPorEmail, setNaoLidosPorEmail] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const adminEmail = getFirebaseAuth().currentUser?.email || 'admin';

  // Carregar lista de motoristas
  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      const drivers: Motorista[] = snap.docs
        .map(d => ({ email: d.id, ...(d.data() as any) }))
        .filter(u => u.role === 'driver' || u.role === 'motorista')
        .map(u => ({
          email: u.email,
          nome: u.nome || u.email.split('@')[0].toUpperCase(),
          pushToken: u.pushToken,
        }));
      setMotoristas(drivers);
      setLoadingMotoristas(false);

      // Calcular não-lidos por motorista
      drivers.forEach(driver => {
        const cId = driver.email.toLowerCase().replace(/[@.]/g, '_');
        const q = query(
          collection(db, 'mensagens', cId, 'msgs'),
          where('de', '==', driver.email),
          where('lido', '==', false)
        );
        onSnapshot(q, (s) => {
          setNaoLidosPorEmail(prev => ({ ...prev, [driver.email]: s.docs.length }));
        }, () => {});
      });
    });
    return () => unsub();
  }, []);

  // Carregar mensagens da conversa selecionada
  useEffect(() => {
    if (!selecionado) return;
    setLoadingMsgs(true);
    const db = getFirebaseDb();
    const conversaId = selecionado.email.toLowerCase().replace(/[@.]/g, '_');
    const q = query(
      collection(db, 'mensagens', conversaId, 'msgs'),
      orderBy('criadoEm', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mensagem));
      setMensagens(msgs);
      setLoadingMsgs(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Marcar mensagens do motorista como lidas
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.de === selecionado.email && !data.lido) {
          updateDoc(doc(db, 'mensagens', conversaId, 'msgs', d.id), { lido: true })
            .catch(() => {});
        }
      });
    });
    return () => unsub();
  }, [selecionado]);

  const handleEnviar = async () => {
    const textoClean = texto.trim();
    if (!textoClean || !selecionado || sending) return;

    setTexto('');
    setSending(true);
    try {
      const db = getFirebaseDb();
      const conversaId = selecionado.email.toLowerCase().replace(/[@.]/g, '_');

      await addDoc(collection(db, 'mensagens', conversaId, 'msgs'), {
        de: adminEmail,
        texto: textoClean,
        criadoEm: new Date(),
        lido: false,
      });

      // Enviar push ao motorista
      if (selecionado.pushToken) {
        await sendPushNotification(
          selecionado.pushToken,
          '💬 Central Balmiza',
          textoClean
        );
      }
    } catch (e) {
      console.log('Erro ao enviar mensagem admin:', e);
    } finally {
      setSending(false);
    }
  };

  const formatarHora = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderMensagem = ({ item }: { item: Mensagem }) => {
    const isAdmin = item.de !== selecionado?.email;
    return (
      <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : styles.bubbleDriver]}>
        <Text style={[styles.bubbleText, isAdmin ? styles.bubbleTextAdmin : styles.bubbleTextDriver]}>
          {item.texto}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, isAdmin ? { color: 'rgba(255,255,255,0.7)' } : { color: '#9CA3AF' }]}>
            {formatarHora(item.criadoEm)}
          </Text>
          {isAdmin && (
            <MaterialCommunityIcons
              name={item.lido ? 'check-all' : 'check'}
              size={12}
              color={item.lido ? '#93C5FD' : 'rgba(255,255,255,0.6)'}
            />
          )}
        </View>
      </View>
    );
  };

  // Vista: lista de motoristas
  if (!selecionado) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="chat-outline" size={26} color={colors.red} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Mensagens</Text>
            <Text style={styles.headerSub}>Selecione um motorista</Text>
          </View>
        </View>

        {loadingMotoristas ? (
          <ActivityIndicator color={colors.red} style={{ marginTop: 40 }} />
        ) : motoristas.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum motorista cadastrado</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {motoristas.map(driver => {
              const naoLidos = naoLidosPorEmail[driver.email] || 0;
              return (
                <TouchableOpacity
                  key={driver.email}
                  style={styles.driverRow}
                  onPress={() => setSelecionado(driver)}
                >
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {driver.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{driver.nome}</Text>
                    <Text style={styles.driverEmail} numberOfLines={1}>{driver.email}</Text>
                  </View>
                  {naoLidos > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{naoLidos}</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // Vista: conversa com motorista selecionado
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelecionado(null)} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.graphite} />
        </TouchableOpacity>
        <View style={styles.driverAvatarSmall}>
          <Text style={styles.driverAvatarText}>{selecionado.nome.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{selecionado.nome}</Text>
          <Text style={styles.headerSub}>{selecionado.email}</Text>
        </View>
      </View>

      {loadingMsgs ? (
        <ActivityIndicator color={colors.red} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={mensagens}
          keyExtractor={item => item.id}
          renderItem={renderMensagem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Inicie a conversa!</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder={`Mensagem para ${selecionado.nome}...`}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!texto.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleEnviar}
          disabled={!texto.trim() || sending}
        >
          <MaterialCommunityIcons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#1C1C1E' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  backBtn: { padding: 4 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  driverName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  driverEmail: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  unreadBadge: {
    backgroundColor: '#DF0A0A', borderRadius: 10,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 6 },
  bubbleAdmin: { alignSelf: 'flex-end', backgroundColor: '#DF0A0A', borderBottomRightRadius: 4 },
  bubbleDriver: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextAdmin: { color: '#FFFFFF', fontWeight: '500' },
  bubbleTextDriver: { color: '#1C1C1E', fontWeight: '500' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  bubbleTime: { fontSize: 10 },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  input: {
    flex: 1, backgroundColor: '#F4F6F8', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#1C1C1E', maxHeight: 100,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#DF0A0A',
    justifyContent: 'center', alignItems: 'center',
  },
});
