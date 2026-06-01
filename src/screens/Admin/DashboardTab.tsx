import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../../config/firebase';
import { colors } from '../../theme/colors';

export const DashboardTab = ({ navigation }: any) => {
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const db = getFirebaseDb();
      const q = query(collection(db, 'trips'), orderBy('closedAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(fetchedTrips);
    } catch (e) {
      console.log('Error fetching admin trips', e);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@userId');
    await AsyncStorage.removeItem('@userRole');
    navigation.replace('Login'); 
  };

  const exportToCSV = async () => {
    try {
      if (trips.length === 0) return;
      
      const header = 'Data,Motorista,Status,KmFinal,Localizacao,Observacoes\n';
      const rows = trips.map(t => {
        const date = t.closedAt ? new Date(t.closedAt.seconds * 1000).toLocaleString().replace(/,/g, '') : '';
        const driverId = t.driverId || 'N/A';
        const status = t.status || 'N/A';
        const km = t.finalOdometer || 'N/A';
        const loc = t.closingLocation ? t.closingLocation.replace(/,/g, '-') : 'N/A';
        const notes = t.notes ? t.notes.replace(/(\r\n|\n|\r|,)/gm, ' ') : 'N/A';
        return `${date},${driverId},${status},${km},${loc},${notes}`;
      }).join('\n');
      
      const csvString = header + rows;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'relatorio_balmiza.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const filename = (FileSystem as any).documentDirectory + 'relatorio_balmiza.csv';
        await FileSystem.writeAsStringAsync(filename, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(filename);
      }
    } catch (e) {
      console.log('Erro ao exportar', e);
      Platform.OS === 'web' ? window.alert('Erro ao exportar') : Alert.alert('Erro', 'Erro ao exportar planilha');
    }
  };

  const activeAlerts = trips.filter(t => t.notes && t.notes.length > 5).length;
  const maxKm = trips.length > 0 ? Math.max(...trips.map(t => parseInt(t.finalOdometer || '0'))) : 0;
  const progressPercent = maxKm > 0 ? Math.min((maxKm / 60000) * 100, 100) : 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <MaterialCommunityIcons name="shield-account" size={32} color={colors.red} style={{marginRight: 10}} />
          <View>
            <Text style={styles.title}>Painel Admin</Text>
            <Text style={styles.subtitle}>Visão Executiva</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.actionBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={colors.red} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <MaterialCommunityIcons name="truck-check" size={28} color={colors.white} />
          </View>
          <View>
            <Text style={styles.statLabel}>Total Viagens</Text>
            <Text style={styles.statValue}>{trips.length}</Text>
          </View>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: colors.red }]}>
          <View style={[styles.statIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <MaterialCommunityIcons name="alert-octagon" size={28} color={colors.white} />
          </View>
          <View>
            <Text style={styles.statLabel}>Alertas</Text>
            <Text style={styles.statValue}>{activeAlerts}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Exportação de Dados</Text>
        <Text style={{color: colors.graphiteLight, marginBottom: 20}}>Baixe a planilha completa com rastreabilidade de todas as escalas realizadas, formatada em CSV para Excel.</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
          <MaterialCommunityIcons name="file-excel-box" size={24} color={colors.white} />
          <Text style={styles.exportBtnText}>Baixar Relatório (CSV)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Manutenção Preventiva</Text>
        <Text style={{color: colors.graphiteLight, marginBottom: 15}}>Frota: KM Máxima Registrada (Troca aos 60k)</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
          <Text style={{fontSize: 12, fontWeight: 'bold'}}>{maxKm} km (Atual)</Text>
          <Text style={{fontSize: 12, color: colors.red}}>60.000 km</Text>
        </View>
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.white, padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: colors.graphite },
  subtitle: { fontSize: 14, color: colors.graphiteLight },
  actionBtn: { padding: 10, backgroundColor: colors.background, borderRadius: 8, elevation: 1 },
  statsContainer: { padding: 20, flexDirection: 'row', gap: 15 },
  statCard: { flex: 1, backgroundColor: colors.graphite, padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', elevation: 5 },
  statIconWrap: { backgroundColor: 'rgba(255,255,255,0.1)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.white, fontSize: 26, fontWeight: '900' },
  chartCard: { backgroundColor: colors.white, margin: 20, marginTop: 0, padding: 20, borderRadius: 16, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.graphite, marginBottom: 5 },
  exportBtn: { backgroundColor: colors.green, padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  exportBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  progressBarBg: { height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.graphite }
});
