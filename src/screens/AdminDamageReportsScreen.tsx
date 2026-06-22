import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Alert } from 'react-native';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  red: '#E53E3E',
  brandPrimary: '#DF0A0A',
  orange: '#D97706',
  green: '#2F855A',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

type DamageStatus = 'pendente' | 'em_analise' | 'resolvido';

const STATUS_CONFIG: Record<DamageStatus, { label: string; color: string; bg: string; icon: string }> = {
  pendente: { label: 'PENDENTE', color: colors.red, bg: '#FEE2E2', icon: 'alert-circle' },
  em_analise: { label: 'EM ANÁLISE', color: colors.orange, bg: '#FEF3C7', icon: 'progress-wrench' },
  resolvido: { label: 'RESOLVIDO', color: colors.green, bg: '#D1FAE5', icon: 'check-circle' },
};

export const AdminDamageReportsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const db = getFirebaseDb();
    const q = query(collection(db, 'avarias'), orderBy('data', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(data);
      setLoading(false);
    }, (error) => {
      console.log('Erro ao buscar avarias:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (reportId: string, newStatus: DamageStatus) => {
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'avarias', reportId), { status: newStatus });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar o status.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 135 }}>
      <Text style={styles.title}>Relatórios de Avarias</Text>
      
      {reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="shield-check" size={80} color={colors.graphiteLight} style={{ opacity: 0.5 }} />
          <Text style={styles.emptyTextGarrafal}>FROTA INTACTA</Text>
          <Text style={styles.emptySub}>Nenhum relatório de dano registrado pelos motoristas.</Text>
        </View>
      ) : (
        reports.map(report => {
          const status: DamageStatus = (report.status as DamageStatus) || 'pendente';
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;

          const formattedDate = report.data
            ? new Date(report.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Data Indisponível';

          return (
            <View key={report.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="alert-circle" size={24} color={colors.brandPrimary} />
                  <Text style={styles.dateText}>{formattedDate}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                  <MaterialCommunityIcons name={cfg.icon as any} size={12} color={cfg.color} />
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account-tie-hat" size={24} color={colors.graphite} />
                <Text style={styles.infoText}>{report.motoristaEmail?.split('@')[0]?.toUpperCase() || 'N/A'}</Text>
              </View>

              <Text style={styles.descTitle}>DESCRIÇÃO DO PROBLEMA:</Text>
              <Text style={styles.descText}>{report.descricao}</Text>

              {report.fotoUrl ? (
                <Image source={{ uri: report.fotoUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.noImage}>
                  <Text style={{ color: colors.graphiteLight }}>Sem foto anexada.</Text>
                </View>
              )}

              {/* Status Action Buttons */}
              <View style={styles.actionsRow}>
                <Text style={styles.actionsLabel}>ATUALIZAR STATUS:</Text>
                <View style={styles.actionBtns}>
                  {status !== 'pendente' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => updateStatus(report.id, 'pendente')}>
                      <MaterialCommunityIcons name="alert-circle" size={14} color={colors.red} />
                      <Text style={[styles.actionBtnText, { color: colors.red }]}>Pendente</Text>
                    </TouchableOpacity>
                  )}
                  {status !== 'em_analise' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEF3C7' }]} onPress={() => updateStatus(report.id, 'em_analise')}>
                      <MaterialCommunityIcons name="progress-wrench" size={14} color={colors.orange} />
                      <Text style={[styles.actionBtnText, { color: colors.orange }]}>Em Análise</Text>
                    </TouchableOpacity>
                  )}
                  {status !== 'resolvido' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]} onPress={() => updateStatus(report.id, 'resolvido')}>
                      <MaterialCommunityIcons name="check-circle" size={14} color={colors.green} />
                      <Text style={[styles.actionBtnText, { color: colors.green }]}>Resolvido</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '900', color: colors.graphite, marginBottom: 20, textTransform: 'uppercase' },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 15 },
  dateText: { fontSize: 14, fontWeight: 'bold', color: colors.graphite },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '900' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  infoText: { fontSize: 16, fontWeight: '900', color: colors.graphite },
  descTitle: { fontSize: 12, fontWeight: '900', color: colors.graphiteLight, marginBottom: 5 },
  descText: { fontSize: 16, color: colors.graphite, fontWeight: '500', marginBottom: 15, lineHeight: 22 },
  image: { width: '100%', height: 220, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 15 },
  noImage: { width: '100%', height: 80, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  actionsRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 },
  actionsLabel: { fontSize: 11, fontWeight: '900', color: colors.graphiteLight, marginBottom: 10 },
  actionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontWeight: '900' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyTextGarrafal: { fontSize: 28, fontWeight: '900', color: colors.graphite, textAlign: 'center', marginTop: 20, textTransform: 'uppercase' },
  emptySub: { fontSize: 16, color: colors.graphiteLight, textAlign: 'center', marginTop: 10, fontWeight: 'bold' }
});
