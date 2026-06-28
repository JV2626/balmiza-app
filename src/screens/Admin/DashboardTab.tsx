import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, Animated } from 'react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { getFirebaseDb, getFirebaseAuth } from '../../config/firebase';
import { colors } from '../../theme/colors';
import { AnimatedCard } from '../../components/AnimatedCard';

export const DashboardTab = ({ navigation }: any) => {
  const [trips, setTrips] = useState<any[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Listener em tempo real substituindo o getDocs
    const db = getFirebaseDb();
    const q = query(collection(db, 'trips'), orderBy('closedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(fetchedTrips);
    }, (e) => {
      console.log('Error fetching admin trips', e);
    });

    // Animação do indicador AO VIVO (pulse)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      unsubscribe();
      pulse.stop();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await getFirebaseAuth().signOut();
    } catch (e) {
      console.log('Erro ao fazer signOut no Dashboard:', e);
    }
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

  // Processamento de dados dos gráficos
  const getWeeklyData = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dataMap: { [key: string]: number } = {};
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      last7Days.push(dayName);
      dataMap[dayName] = 0;
    }

    trips.forEach(t => {
      if (t.closedAt) {
        const date = new Date(t.closedAt.seconds * 1000);
        const dayName = days[date.getDay()];
        if (dayName in dataMap) {
          dataMap[dayName]++;
        }
      }
    });

    return last7Days.map(day => ({
      value: dataMap[day] || 0,
      label: day,
      frontColor: colors.red,
      gradientColor: '#9B2C2C',
      showGradient: true,
    }));
  };

  const getDriverPieData = () => {
    const driverCounts: { [key: string]: number } = {};
    trips.forEach(t => {
      const driver = t.driverId ? t.driverId.split('@')[0] : 'N/A';
      driverCounts[driver] = (driverCounts[driver] || 0) + 1;
    });

    const total = trips.length;
    const chartColors = [colors.graphite, colors.red, '#4A5568', '#38A169', '#ECC94B', '#9F7AEA', '#ED64A6'];

    return Object.entries(driverCounts).map(([driver, count], index) => {
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        value: count,
        text: `${percentage}%`,
        color: chartColors[index % chartColors.length],
        name: driver,
      };
    });
  };

  const activeAlerts = trips.filter(t => t.notes && t.notes.length > 5).length;
  const maxKm = trips.length > 0 ? Math.max(...trips.map(t => parseInt(t.finalOdometer || '0'))) : 0;
  const progressPercent = maxKm > 0 ? Math.min((maxKm / 60000) * 100, 100) : 0;

  const weeklyData = getWeeklyData();
  const pieData = getDriverPieData();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <MaterialCommunityIcons name="shield-account" size={32} color={colors.red} style={{marginRight: 10}} />
          <View>
            <Text style={styles.title}>Painel Admin</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.subtitle}>AO VIVO</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.actionBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={colors.red} />
        </TouchableOpacity>
      </View>

      {/* Cards de Métricas Principais */}
      <View style={styles.statsContainer}>
        <AnimatedCard style={styles.statCard} delay={100}>
          <View style={styles.statIconWrap}>
            <MaterialCommunityIcons name="car-multiple" size={28} color={colors.white} />
          </View>
          <View>
            <Text style={styles.statLabel}>Total Viagens</Text>
            <Text style={styles.statValue}>{trips.length}</Text>
          </View>
        </AnimatedCard>
        
        <AnimatedCard style={[styles.statCard, { backgroundColor: colors.red }]} delay={250}>
          <View style={[styles.statIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <MaterialCommunityIcons name="alert-octagon" size={28} color={colors.white} />
          </View>
          <View>
            <Text style={styles.statLabel}>Alertas</Text>
            <Text style={styles.statValue}>{activeAlerts}</Text>
          </View>
        </AnimatedCard>
      </View>

      {/* Gráfico 1: Atividade Semanal (BarChart) */}
      <AnimatedCard style={styles.chartCard} delay={350}>
        <Text style={styles.sectionTitle}>Atividade Semanal</Text>
        <Text style={styles.chartSubtitle}>Quantidade de viagens concluídas nos últimos 7 dias</Text>
        
        <View style={styles.chartContainer}>
          <BarChart
            data={weeklyData}
            barWidth={22}
            spacing={16}
            roundedTop
            hideRules
            yAxisThickness={0}
            xAxisThickness={0}
            yAxisTextStyle={{ color: colors.graphiteLight, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.graphite, fontSize: 10, fontWeight: 'bold' }}
            noOfSections={4}
            maxValue={Math.max(...weeklyData.map(d => d.value), 4) + 1}
            isAnimated
            height={150}
          />
        </View>
      </AnimatedCard>

      {/* Gráfico 2: Distribuição por Motorista (PieChart) */}
      {pieData.length > 0 && (
        <AnimatedCard style={styles.chartCard} delay={450}>
          <Text style={styles.sectionTitle}>Distribuição por Motorista</Text>
          <Text style={styles.chartSubtitle}>Porcentagem de viagens atendidas por cada membro da equipe</Text>
          
          <View style={styles.pieContainer}>
            <View style={styles.pieWrapper}>
              <PieChart
                data={pieData}
                donut
                showText
                textColor="white"
                textSize={10}
                radius={65}
                innerRadius={42}
                innerCircleColor="white"
                centerLabelComponent={() => (
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: colors.graphite }}>{trips.length}</Text>
                    <Text style={{ fontSize: 8, color: colors.graphiteLight, fontWeight: 'bold' }}>TOTAL</Text>
                  </View>
                )}
              />
            </View>
            <View style={styles.legendContainer}>
              {pieData.map((item, idx) => (
                <View key={idx} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {item.name}: <Text style={{fontWeight: '900', color: colors.graphite}}>{item.value}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Card: Manutenção Preventiva */}
      <AnimatedCard style={styles.chartCard} delay={550}>
        <Text style={styles.sectionTitle}>Manutenção Preventiva</Text>
        <Text style={{color: colors.graphiteLight, marginBottom: 15, fontSize: 13}}>Frota: KM Máxima Registrada (Troca aos 60k)</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
          <Text style={{fontSize: 12, fontWeight: 'bold', color: colors.graphite}}>{maxKm.toLocaleString('pt-BR')} km (Atual)</Text>
          <Text style={{fontSize: 12, color: colors.red, fontWeight: 'bold'}}>60.000 km</Text>
        </View>
      </AnimatedCard>

      {/* Card: Exportação de Dados */}
      <AnimatedCard style={[styles.chartCard, { marginBottom: 40 }]} delay={650}>
        <Text style={styles.sectionTitle}>Exportação de Dados</Text>
        <Text style={{color: colors.graphiteLight, marginBottom: 20, fontSize: 13}}>Baixe a planilha completa com rastreabilidade de todas as escalas realizadas, formatada em CSV para Excel.</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
          <MaterialCommunityIcons name="file-excel-box" size={24} color={colors.white} />
          <Text style={styles.exportBtnText}>Baixar Relatório (CSV)</Text>
        </TouchableOpacity>
      </AnimatedCard>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.white, padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: colors.graphite },
  subtitle: { fontSize: 12, color: colors.red, fontWeight: '900', letterSpacing: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  actionBtn: { padding: 10, backgroundColor: colors.background, borderRadius: 8, elevation: 1 },
  statsContainer: { padding: 20, paddingBottom: 10, flexDirection: 'row', gap: 15 },
  statCard: { flex: 1, backgroundColor: colors.graphite, padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', elevation: 5 },
  statIconWrap: { backgroundColor: 'rgba(255,255,255,0.1)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.white, fontSize: 26, fontWeight: '900' },
  
  chartCard: { backgroundColor: colors.white, marginHorizontal: 20, marginBottom: 15, padding: 20, borderRadius: 16, elevation: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.01)' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.graphite, marginBottom: 4, textTransform: 'uppercase' },
  chartSubtitle: { fontSize: 12, color: colors.graphiteLight, marginBottom: 20 },
  chartContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  
  pieContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 10, gap: 10 },
  pieWrapper: { alignItems: 'center', justifyContent: 'center' },
  legendContainer: { flex: 1, gap: 8, paddingLeft: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: colors.graphiteLight, fontWeight: '600' },

  exportBtn: { backgroundColor: colors.green, padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  exportBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  progressBarBg: { height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.graphite }
});
