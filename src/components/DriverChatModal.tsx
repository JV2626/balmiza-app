import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import {
  collection, query, where, onSnapshot, addDoc, orderBy,
  updateDoc, doc, getDocs
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';
import { sendPushNotification } from '../utils/notifications';

interface Mensagem {
  id: string;
  de: string;
  texto: string;
  criadoEm: any;
  lido: boolean;
}

interface DriverChatModalProps {
  visible: boolean;
  onClose: () => void;
  driverEmail: string;
}

export const DriverChatModal = ({ visible, onClose, driverEmail }: DriverChatModalProps) => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const conversaId = driverEmail.toLowerCase().replace(/[@.]/g, '_');

  useEffect(() => {
    if (!visible || !driverEmail) return;

    const db = getFirebaseDb();
    const q = query(
      collection(db, 'mensagens', conversaId, 'msgs'),
      orderBy('criadoEm', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mensagem));
      setMensagens(msgs);
      setLoading(false);

      // Marcar mensagens do admin como lidas
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.de !== driverEmail && !data.lido) {
          updateDoc(doc(db, 'mensagens', conversaId, 'msgs', d.id), { lido: true })
            .catch(() => {});
        }
      });

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsub();
  }, [visible, driverEmail]);

  const handleEnviar = async () => {
    const textoClean = texto.trim();
    if (!textoClean || sending) return;

    setTexto('');
    setSending(true);
    try {
      const db = getFirebaseDb();

      // Salvar mensagem na subcoleção
      await addDoc(collection(db, 'mensagens', conversaId, 'msgs'), {
        de: driverEmail,
        texto: textoClean,
        criadoEm: new Date(),
        lido: false,
      });

      // Atualizar metadados da conversa para o admin encontrar facilmente
      await addDoc(collection(db, 'mensagens_meta'), {
        conversaId,
        motoristaEmail: driverEmail,
        ultimaMensagem: textoClean,
        ultimaAt: new Date(),
        naoLidoAdmin: true,
      }).catch(() => {});

      // Buscar token do admin e enviar push
      const usuariosSnap = await getDocs(
        query(collection(db, 'usuarios'), where('role', '==', 'admin'))
      );
      for (const adminDoc of usuariosSnap.docs) {
        const adminData = adminDoc.data();
        if (adminData.pushToken) {
          await sendPushNotification(
            adminData.pushToken,
            `💬 ${driverEmail.split('@')[0].toUpperCase()}`,
            textoClean
          );
        }
      }
    } catch (e) {
      console.log('Erro ao enviar mensagem:', e);
    } finally {
      setSending(false);
    }
  };

  const formatarHora = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMensagem = ({ item }: { item: Mensagem }) => {
    const isDriver = item.de === driverEmail;
    return (
      <View style={[styles.bubble, isDriver ? styles.bubbleDriver : styles.bubbleAdmin]}>
        <Text style={[styles.bubbleText, isDriver ? styles.bubbleTextDriver : styles.bubbleTextAdmin]}>
          {item.texto}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, isDriver ? { color: 'rgba(255,255,255,0.7)' } : { color: '#9CA3AF' }]}>
            {formatarHora(item.criadoEm)}
          </Text>
          {isDriver && (
            <MaterialCommunityIcons
              name={item.lido ? 'check-all' : 'check'}
              size={12}
              color={item.lido ? '#93C5FD' : 'rgba(255,255,255,0.5)'}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.adminAvatar}>
              <MaterialCommunityIcons name="shield-account" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>CENTRAL BALMIZA</Text>
              <Text style={styles.headerSub}>Suporte e comunicados</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#DF0A0A" style={{ flex: 1 }} />
        ) : mensagens.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chat-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptySub}>Envie uma mensagem para a central.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={mensagens}
            keyExtractor={item => item.id}
            renderItem={renderMensagem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            onSubmitEditing={handleEnviar}
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
    </Modal>
  );
};

/**
 * Hook para contar mensagens não lidas do admin para o motorista.
 */
export const useChatNaoLido = (driverEmail: string): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!driverEmail) return;
    const conversaId = driverEmail.toLowerCase().replace(/[@.]/g, '_');
    const db = getFirebaseDb();
    const q = query(
      collection(db, 'mensagens', conversaId, 'msgs'),
      where('de', '!=', driverEmail),
      where('lido', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.docs.length);
    }, () => setCount(0));
    return () => unsub();
  }, [driverEmail]);

  return count;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#1C1C1E' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  closeBtn: { padding: 6, backgroundColor: '#F4F6F8', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 6 },
  bubbleDriver: { alignSelf: 'flex-end', backgroundColor: '#DF0A0A', borderBottomRightRadius: 4 },
  bubbleAdmin: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextDriver: { color: '#FFFFFF', fontWeight: '500' },
  bubbleTextAdmin: { color: '#1C1C1E', fontWeight: '500' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  bubbleTime: { fontSize: 10 },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1C1E',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#DF0A0A',
    justifyContent: 'center', alignItems: 'center',
  },
});
