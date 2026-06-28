import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Platform
} from 'react-native';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';

interface Aviso {
  id: string;
  texto: string;
  criadoEm: any;
  lidos: string[];
}

interface AvisosModalProps {
  visible: boolean;
  onClose: () => void;
  driverEmail: string;
}

export const AvisosModal = ({ visible, onClose, driverEmail }: AvisosModalProps) => {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;

    const db = getFirebaseDb();
    const q = query(collection(db, 'avisos'), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Aviso));
      setAvisos(data);
      setLoading(false);

      // Marcar todos os não-lidos como lidos ao abrir o modal
      const naoLidos = data.filter(a => !a.lidos?.includes(driverEmail));
      naoLidos.forEach(aviso => {
        updateDoc(doc(db, 'avisos', aviso.id), {
          lidos: arrayUnion(driverEmail)
        }).catch(() => {});
      });
    });

    return () => unsub();
  }, [visible, driverEmail]);

  const formatarData = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Agora mesmo';
      if (diffMin < 60) return `${diffMin} min atrás`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h atrás`;
      const diffDias = Math.floor(diffH / 24);
      if (diffDias === 1) return 'Ontem';
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderAviso = ({ item }: { item: Aviso }) => {
    const isNovo = !item.lidos?.includes(driverEmail);
    return (
      <View style={[styles.avisoCard, isNovo && styles.avisoCardNovo]}>
        <View style={styles.avisoHeader}>
          {isNovo && <View style={styles.newBadge} />}
          <Text style={styles.avisoData}>{formatarData(item.criadoEm)}</Text>
        </View>
        <Text style={[styles.avisoTexto, isNovo && { fontWeight: '700', color: '#1C1C1E' }]}>
          {item.texto}
        </Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="bullhorn" size={24} color="#DF0A0A" />
            <Text style={styles.headerTitle}>AVISOS DA CENTRAL</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={24} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#DF0A0A" style={{ marginTop: 50 }} />
        ) : avisos.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="bullhorn-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum aviso</Text>
            <Text style={styles.emptySub}>A central ainda não publicou nenhuma mensagem.</Text>
          </View>
        ) : (
          <FlatList
            data={avisos}
            keyExtractor={item => item.id}
            renderItem={renderAviso}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          />
        )}
      </View>
    </Modal>
  );
};

/**
 * Hook para contar avisos não lidos de um motorista.
 * Usado para exibir o badge no ícone de sino.
 */
export const useAvisosNaoLidos = (driverEmail: string): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!driverEmail) return;
    const db = getFirebaseDb();
    const q = query(collection(db, 'avisos'));
    const unsub = onSnapshot(q, (snap) => {
      const naoLidos = snap.docs.filter(d => {
        const lidos: string[] = d.data().lidos || [];
        return !lidos.includes(driverEmail);
      });
      setCount(naoLidos.length);
    });
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
  avisoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avisoCardNovo: {
    borderLeftWidth: 4,
    borderLeftColor: '#DF0A0A',
    borderColor: '#E5E7EB',
  },
  avisoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  newBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DF0A0A',
  },
  avisoData: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  avisoTexto: { fontSize: 15, color: '#374151', lineHeight: 22, fontWeight: '500' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
});
