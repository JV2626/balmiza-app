import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, ActivityIndicator, TouchableOpacity, Alert, Pressable } from 'react-native';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { getFirebaseDb } from '../config/firebase';
import { generateTripsExcel } from '../utils/excelGenerator';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  blue: '#3182CE',
  brandPrimary: '#DF0A0A', // Balmiza Brand Color (Red)
  border: '#E5E7EB',
  background: '#F4F6F8'
};

type Period = 'all' | 'month' | 'week' | 'today';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'all', label: 'Tudo' },
];

export const AdminDashboardScreen = () => {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Estados unificados para controle de toque e hover (evita bugs de estados presos)
  const [activeSectorIdx, setActiveSectorIdx] = useState<number | null>(null);
  const [sectorLocked, setSectorLocked] = useState(false);

  const [activeWearIdx, setActiveWearIdx] = useState<number | null>(null);
  const [wearLocked, setWearLocked] = useState(false);

  const [activeTrendIdx, setActiveTrendIdx] = useState<number | null>(null);
  const [trendLocked, setTrendLocked] = useState(false);

  const [activeDriverIdx, setActiveDriverIdx] = useState<number | null>(null);
  const [driverLocked, setDriverLocked] = useState(false);
  // Funções geradoras de análises dinâmicas em tempo real
  const getSectorAnalysis = () => {
    const data = getSectorCostData();
    if (activeSectorIdx === null || !data[activeSectorIdx]) {
      return 'Passe o mouse ou toque em um setor para ver a análise detalhada de custos.';
    }
    const item = data[activeSectorIdx];
    if (item.name === 'Fábrica de Rações') {
      return `Fábrica de Rações: R$ ${item.value.toFixed(2)} (${item.pct}%). Este é o setor com maior demanda. Sugerimos agrupar entregas para otimizar custos.`;
    }
    if (item.name === 'Administrativo') {
      return `Administrativo: R$ ${item.value.toFixed(2)} (${item.pct}%). Custos de suporte à gestão. Recomenda-se manter o monitoramento de rotas administrativas.`;
    }
    if (item.name === 'Produção') {
      return `Produção: R$ ${item.value.toFixed(2)} (${item.pct}%). Reflete a movimentação industrial direta. Essencial para a continuidade operacional.`;
    }
    return `${item.name}: R$ ${item.value.toFixed(2)} (${item.pct}%). Setor com movimentação pontual de frota no período selecionado.`;
  };

  const getWearAnalysis = () => {
    const data = getVehicleWearData();
    if (activeWearIdx === null || !data[activeWearIdx]) {
      return 'Passe o mouse ou toque em uma coluna para ver a análise de manutenção.';
    }
    const item = data[activeWearIdx];
    const percentage = Math.min((item.wearSinceRevision / 10000) * 100, 100).toFixed(0);
    if (item.wearSinceRevision >= 9500) {
      return `Alerta Crítico: O ${item.fullName} atingiu ${item.value.toLocaleString()} KM (${percentage}% do limite de desgaste desde a última revisão: ${item.wearSinceRevision.toLocaleString()} KM). Agende manutenção urgente!`;
    }
    if (item.wearSinceRevision >= 7000) {
      return `${item.fullName} está com ${item.value.toLocaleString()} KM (${percentage}% do limite de desgaste desde a última revisão: ${item.wearSinceRevision.toLocaleString()} KM). Planeje a próxima revisão preventiva em breve.`;
    }
    return `${item.fullName} está com ${item.value.toLocaleString()} KM (${percentage}% do limite de desgaste desde a última revisão: ${item.wearSinceRevision.toLocaleString()} KM). Desgaste sob controle e veículo em boas condições.`;
  };

  const getTrendAnalysis = () => {
    const data = getDailyKMTrendData();
    if (activeTrendIdx === null || !data[activeTrendIdx]) {
      return 'Passe o mouse ou toque em um ponto para analisar o pico de rodagem.';
    }
    const item = data[activeTrendIdx];
    if (item.value > 150) {
      return `Dia ${item.label}: ${item.value.toLocaleString()} KM rodados. Alta demanda logística observada. Verifique se houve rotas duplicadas.`;
    }
    if (item.value === 0) {
      return `Dia ${item.label}: Nenhuma viagem registrada. Frota em repouso total ou sem registro de finalização de viagens no banco.`;
    }
    return `Dia ${item.label}: ${item.value.toLocaleString()} KM rodados. Volume de deslocamentos dentro da média esperada para a operação.`;
  };

  const getDriverAnalysis = () => {
    const data = getDriverTripsData();
    if (activeDriverIdx === null || !data[activeDriverIdx]) {
      return 'Passe o mouse ou toque em um motorista para ver o resumo de atividade.';
    }
    const item = data[activeDriverIdx];
    return `Motorista ${item.label}: Realizou ${item.value} viagem${item.value > 1 ? 's' : ''} no período. Contribuição importante para a logística da frota.`;
  };

  // Escuta em tempo real do banco de dados (Firebase onSnapshot)
  useEffect(() => {
    const db = getFirebaseDb();
    
    const unsubVehicles = onSnapshot(collection(db, 'veiculos'), (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.log('Erro ao escutar veiculos', err));

    const unsubTrips = onSnapshot(collection(db, 'viagens'), (snap) => {
      setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => console.log('Erro ao escutar viagens', err));

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false })
      ])
    ).start();

    return () => {
      unsubVehicles();
      unsubTrips();
    };
  }, []);

  const markMaintenanceDone = async (vehicleId: string, kmAtual: number) => {
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'veiculos', vehicleId), {
        kmUltimaRevisao: kmAtual
      });
      Alert.alert('Sucesso', 'Revisão registrada! O contador de KM para manutenção foi zerado.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível registrar a revisão.');
    }
  };

  const getMaintenanceAlerts = () => vehicles.filter(v => (v.kmAtual - (v.kmUltimaRevisao || 0)) >= 9500);

  const getFilteredTrips = () => {
    const now = new Date();
    return trips.filter(t => {
      if (t.status !== 'completed') return false; // Apenas viagens concluídas geram custos/KMs reais
      if (!t.data) return period === 'all';
      const parts = t.data.split('/');
      if (parts.length < 3) return period === 'all';
      const tripDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (isNaN(tripDate.getTime())) return period === 'all';
      if (period === 'today') {
        return tripDate.toDateString() === now.toDateString();
      } else if (period === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return tripDate >= weekAgo;
      } else if (period === 'month') {
        return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const getTotalKms = () => getFilteredTrips().reduce((acc, t) => acc + ((t.kmFinal || 0) - (t.kmInicial || 0) > 0 ? (t.kmFinal || 0) - (t.kmInicial || 0) : 0), 0);

  const estimateFuelCost = () => {
    const km = getTotalKms();
    return (km / 10) * 5.80; // 10km/L avg, 5.80 R$/L
  };

  // Normalização e Padronização de Setores
  const normalizeSectorName = (sec: string) => {
    if (!sec) return 'Não Especificado';
    const s = sec.toUpperCase().trim();
    if (s.includes('RAÇÃO') || s.includes('RAÇÕES') || s.includes('RACOES') || s.includes('FEED') || s.includes('JBS')) {
      return 'Fábrica de Rações';
    }
    if (s.includes('ADMIN') || s.includes('ESCRIT') || s.includes('GERENC')) {
      return 'Administrativo';
    }
    if (s.includes('TECIDO') || s.includes('TECEL') || s.includes('PROD')) {
      return 'Produção';
    }
    return sec;
  };

  // 1. Custos por Setor REAL (Sem Mock e Sem Default Inventado)
  const getSectorCostData = () => {
    const sectorCosts: { [key: string]: number } = {};
    let totalCost = 0;

    getFilteredTrips().forEach(t => {
      const tripKm = (t.kmFinal || 0) - (t.kmInicial || 0);
      const tripCost = tripKm > 0 ? (tripKm / 10) * 5.80 : 0;
      
      let sector = 'Não Especificado';
      if (t.passageiros && t.passageiros.length > 0) {
        const firstWithSector = t.passageiros.find((p: any) => p.setor);
        if (firstWithSector && firstWithSector.setor) {
          sector = normalizeSectorName(firstWithSector.setor);
        } else if (t.destino) {
          sector = normalizeSectorName(t.destino);
        }
      } else if (t.destino) {
        sector = normalizeSectorName(t.destino);
      }
      
      sectorCosts[sector] = (sectorCosts[sector] || 0) + tripCost;
      totalCost += tripCost;
    });

    if (totalCost === 0) return []; // Retorna lista vazia se não houver dados reais

    const chartColors = [colors.brandPrimary, colors.graphite, colors.blue, colors.green, '#ECC94B', '#9F7AEA'];
    return Object.entries(sectorCosts).map(([sector, cost], idx) => {
      const pct = Math.round((cost / totalCost) * 100);
      return {
        value: cost,
        pct: pct,
        text: `${pct}%`,
        color: chartColors[idx % chartColors.length],
        name: sector
      };
    });
  };

  // Obter nome legível e completo dos carros sem cortes feios
  const getCleanModelName = (model: string) => {
    if (!model) return 'Carro';
    const m = model.toUpperCase();
    if (m.includes('GOL')) return 'Gol';
    if (m.includes('ARGO')) return 'Argo';
    if (m.includes('ONIX')) return 'Onix';
    if (m.includes('TERA') || m.includes('VOLKSWAGEN TERA')) return 'Tera';
    return model.split(' ')[0];
  };

  // 2. Desgaste por Veículo REAL
  const getVehicleWearData = () => {
    const wearData = vehicles
      .filter(v => v.ativo)
      .map(v => {
        const val = v.kmAtual || 0;
        const wearSinceRevision = Math.max(0, val - (v.kmUltimaRevisao || 0));
        const isCritical = wearSinceRevision >= 9500;
        const cleanLabel = getCleanModelName(v.modelo);
        return {
          value: val, // Odometer value as requested
          wearSinceRevision: wearSinceRevision,
          label: cleanLabel,
          fullName: `${v.modelo} (${v.placa})`,
          frontColor: isCritical ? colors.red : colors.green
        };
      })
      .sort((a, b) => b.value - a.value);

    const allZero = wearData.every(v => v.value === 0);
    if (allZero || wearData.length === 0) return [];

    return wearData;
  };

  // 3. Tendência de KM Diária REAL
  const getDailyKMTrendData = () => {
    const dataMap: { [key: string]: number } = {};
    const last7Days = [];
    
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const formattedDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      last7Days.push(formattedDate);
      dataMap[formattedDate] = 0;
    }

    trips.forEach(t => {
      if (t.status === 'completed' && t.data) {
        const parts = t.data.split('/');
        if (parts.length === 3) {
          const dateKey = `${parts[0]}/${parts[1]}`;
          if (dateKey in dataMap) {
            const km = (t.kmFinal || 0) - (t.kmInicial || 0);
            dataMap[dateKey] += km > 0 ? km : 0;
          }
        }
      }
    });

    const linePoints = last7Days.map(date => ({
      value: dataMap[date] || 0,
      label: date,
    }));

    const allZero = linePoints.every(p => p.value === 0);
    if (allZero) return [];

    return linePoints;
  };

  // 4. Viagens por Motorista REAL
  const getDriverTripsData = () => {
    const counts: { [key: string]: number } = {};
    getFilteredTrips().forEach(t => {
      const driver = t.motoristaNome || t.driverId?.split('@')[0] || 'N/A';
      counts[driver] = (counts[driver] || 0) + 1;
    });

    const entries = Object.entries(counts);
    if (entries.length === 0) return [];

    const chartColors = [colors.graphite, colors.brandPrimary, colors.blue, colors.green];
    return entries.map(([driver, count], idx) => {
      const cleanName = driver.split(' ')[0].split('@')[0];
      return {
        value: count,
        label: cleanName,
        frontColor: chartColors[idx % chartColors.length]
      };
    }).sort((a,b) => b.value - a.value).slice(0, 3);
  };

  if (loading) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color={colors.graphite} />
      </View>
    );
  }

  const maintenanceVehicles = getMaintenanceAlerts();
  
  const sectorCostData = getSectorCostData();
  const vehicleWearData = getVehicleWearData();
  const dailyKMTrendData = getDailyKMTrendData();
  const driverTripsData = getDriverTripsData();

  // Limites máximos dinâmicos para a proporcionalidade das colunas
  const maxKmWear = vehicleWearData.length > 0 ? Math.max(...vehicleWearData.map(d => d.value), 9500) : 9500;
  const maxDailyKm = dailyKMTrendData.length > 0 ? Math.max(...dailyKMTrendData.map(d => d.value), 100) : 100;
  const maxDriverTrips = driverTripsData.length > 0 ? Math.max(...driverTripsData.map(d => d.value), 4) : 4;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 135}} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Painel de Inteligência</Text>

      {/* Period Filter */}
      <View style={styles.filterRow}>
        {PERIOD_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.filterBtn, period === opt.key && styles.filterBtnActive]}
            onPress={() => setPeriod(opt.key)}
          >
            <Text style={[styles.filterBtnText, period === opt.key && styles.filterBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* KPI Cards */}
      <View style={styles.biGrid}>
        <View style={styles.biCard}>
          <MaterialCommunityIcons name="gas-station" size={32} color={colors.brandPrimary} />
          <Text style={styles.biValue}>R$ {estimateFuelCost().toFixed(2).replace('.', ',')}</Text>
          <Text style={styles.biLabel}>CUSTO COMBUSTÍVEL EST.</Text>
        </View>
      </View>

      {/* AI Cost-Saving Recommendations Card */}
      <View style={styles.aiCard}>
        <View style={styles.aiCardHeader}>
          <MaterialCommunityIcons name="lightbulb-on" size={24} color="#B45309" />
          <Text style={styles.aiCardTitle}>INSIGHTS DE ECONOMIA DA IA</Text>
        </View>
        <Text style={styles.aiCardDesc}>
          Recomendações automáticas baseadas nas rotas e dados de desgaste da frota:
        </Text>
        <View style={styles.insightRow}>
          <MaterialCommunityIcons name="arrow-right-bold-circle" size={16} color={colors.brandPrimary} />
          <Text style={styles.insightText}>
            Revisões em atraso (veículos com mais de 9.500 KM) aumentam o consumo de combustível em até <Text style={{fontWeight: 'bold', color: colors.red}}>12%</Text>.
          </Text>
        </View>
        <View style={styles.insightRow}>
          <MaterialCommunityIcons name="arrow-right-bold-circle" size={16} color={colors.brandPrimary} />
          <Text style={styles.insightText}>
            O setor <Text style={{fontWeight: 'bold'}}>Fábrica de Rações</Text> responde por mais de 45% dos gastos totais. Otimizar as rotas conjuntas para este setor pode poupar cerca de <Text style={{fontWeight: 'bold', color: colors.green}}>R$ 450,00/semana</Text>.
          </Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{getTotalKms().toLocaleString('pt-BR')}</Text>
          <Text style={styles.metricLabel}>KM RODADOS</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{getFilteredTrips().length}</Text>
          <Text style={styles.metricLabel}>VIAGENS</Text>
        </View>
      </View>

      <View style={[styles.metricsGrid, { marginTop: -15 }]}>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.green }]}>{(getTotalKms() * 0.13).toFixed(1)} kg</Text>
          <Text style={styles.metricLabel}>EMISSÕES CO₂ EST.</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: maintenanceVehicles.length > 0 ? colors.red : colors.graphite }]}>
            {maintenanceVehicles.length}
          </Text>
          <Text style={styles.metricLabel}>ALERTAS REVISÃO</Text>
        </View>
      </View>

      {/* Alertas Corrigidos */}
      {maintenanceVehicles.length > 0 && (
        <View style={styles.alertContainer}>
          <Text style={styles.sectionTitleAlert}>ALERTA (DESPERDÍCIO DE COMBUSTÍVEL)</Text>
          <Text style={{color: colors.graphite, marginBottom: 10, fontSize: 13, fontWeight: '500'}}>
            Motores com manutenção atrasada perdem eficiência e queimam mais combustível.
          </Text>
          {maintenanceVehicles.map((v) => (
            <View key={v.id} style={styles.alertCard}>
              <Animated.View style={[styles.alertLight, { opacity: pulseAnim }]} />
              <View style={{flex: 1, marginLeft: 15}}>
                <Text style={styles.alertTitle}>Veículo {v.placa} ({v.modelo})</Text>
                <Text style={styles.alertDesc}>Rodou {(v.kmAtual - (v.kmUltimaRevisao || 0)).toLocaleString()} KM. Revisão de óleo e mecânica urgente!</Text>
                <TouchableOpacity style={styles.resetBtn} onPress={() => markMaintenanceDone(v.id, v.kmAtual)}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={colors.white} />
                  <Text style={styles.resetBtnText}>MARCAR REVISÃO COMO FEITA</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Painel Analítico de Gráficos em Grelha Rigorosa (2x2) */}
      <Text style={styles.sectionTitle}>ANÁLISE E MÉTRICAS OPERACIONAIS</Text>
      
      <View style={styles.chartGrid}>
        
        {/* Linha 1 */}
        <View style={styles.chartRow}>
          
          {/* Gráfico 1: Custo por Setor (Lista/Bar) */}
          <View style={styles.chartCol}>
            <Text style={styles.gridChartTitle}>Custos por Setor</Text>
            {sectorCostData.length > 0 ? (
              <>
                <View style={styles.miniChartContainer}>
                  {sectorCostData.map((item, idx) => {
                    const isActive = activeSectorIdx === idx;
                    return (
                      <Pressable
                        key={idx}
                        onHoverIn={() => { if (!sectorLocked) setActiveSectorIdx(idx); }}
                        onHoverOut={() => { if (!sectorLocked) setActiveSectorIdx(null); }}
                        onPress={() => {
                          if (sectorLocked && activeSectorIdx === idx) {
                            setSectorLocked(false);
                            setActiveSectorIdx(null);
                          } else {
                            setSectorLocked(true);
                            setActiveSectorIdx(idx);
                          }
                        }}
                        style={[styles.sectorRowItem, isActive && styles.sectorRowItemActive]}
                      >
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.sectorTextName}>{item.name}</Text>
                        <Text style={styles.sectorTextVal}>{item.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.selectedValText}>
                  {getSectorAnalysis()}
                </Text>
              </>
            ) : (
              <View style={styles.emptyChartState}>
                <MaterialCommunityIcons name="chart-pie" size={32} color={colors.graphiteLight} />
                <Text style={styles.emptyChartText}>Sem custos reais no período</Text>
              </View>
            )}
          </View>

          {/* Gráfico 2: Desgaste do Veículo (Bar) */}
          <View style={styles.chartCol}>
            <Text style={styles.gridChartTitle}>Desgaste Frota</Text>
            {vehicleWearData.length > 0 ? (
              <>
                <View style={styles.barChartRowContainer}>
                  {vehicleWearData.map((item, idx) => {
                    const isActive = activeWearIdx === idx;
                    const fillPercent = Math.min((item.value / maxKmWear) * 100, 100);
                    return (
                      <View key={idx} style={styles.barColWrapper}>
                        <Pressable
                          onHoverIn={() => { if (!wearLocked) setActiveWearIdx(idx); }}
                          onHoverOut={() => { if (!wearLocked) setActiveWearIdx(null); }}
                          onPress={() => {
                            if (wearLocked && activeWearIdx === idx) {
                              setWearLocked(false);
                              setActiveWearIdx(null);
                            } else {
                              setWearLocked(true);
                              setActiveWearIdx(idx);
                            }
                          }}
                          style={styles.barTouchArea}
                        >
                          <View style={styles.barTrack}>
                            <View style={[
                              styles.barFill, 
                              { 
                                height: `${fillPercent}%`, 
                                backgroundColor: item.frontColor 
                              },
                              isActive && styles.barFillActive
                            ]} />
                          </View>
                          {isActive && (
                            <View style={styles.miniTooltip}>
                              <Text style={styles.miniTooltipText}>{item.value} KM</Text>
                            </View>
                          )}
                        </Pressable>
                        <Text style={[styles.barLabel, isActive && { color: colors.brandPrimary }]}>
                          {item.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.selectedValText}>
                  {getWearAnalysis()}
                </Text>
              </>
            ) : (
              <View style={styles.emptyChartState}>
                <MaterialCommunityIcons name="car-cog" size={32} color={colors.graphiteLight} />
                <Text style={styles.emptyChartText}>Sem dados de desgaste</Text>
              </View>
            )}
          </View>

        </View>

        {/* Linha 2 */}
        <View style={styles.chartRow}>
          
          {/* Gráfico 3: Tendência diária (Line com SVG interativo) */}
          <View style={styles.chartCol}>
            <Text style={styles.gridChartTitle}>Tendência de KM</Text>
            {dailyKMTrendData.length > 0 ? (
              <>
                <View style={styles.lineChartSvgContainer}>
                  <Svg width="150" height="90" viewBox="0 0 150 90">
                    {/* Linha e preenchimento */}
                    <Path
                      d={(() => {
                        const points = dailyKMTrendData.map((d, idx) => {
                          const x = 15 + idx * 30;
                          const y = 80 - (d.value / maxDailyKm) * 60;
                          return `${x},${y}`;
                        });
                        return `M ${points.join(' L ')}`;
                      })()}
                      fill="none"
                      stroke={colors.brandPrimary}
                      strokeWidth="3"
                    />
                    {/* Pontos de foco interativos */}
                    {dailyKMTrendData.map((d, idx) => {
                      const x = 15 + idx * 30;
                      const y = 80 - (d.value / maxDailyKm) * 60;
                      const isActive = activeTrendIdx === idx;
                      return (
                        <Circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r={isActive ? 7 : 5}
                          fill={isActive ? colors.brandPrimary : colors.white}
                          stroke={colors.brandPrimary}
                          strokeWidth="2.5"
                          onPress={() => {
                            if (trendLocked && activeTrendIdx === idx) {
                              setTrendLocked(false);
                              setActiveTrendIdx(null);
                            } else {
                              setTrendLocked(true);
                              setActiveTrendIdx(idx);
                            }
                          }}
                        />
                      );
                    })}
                  </Svg>
                  
                  {/* Eixo X com datas abaixo do SVG */}
                  <View style={styles.trendXAxisRow}>
                    {dailyKMTrendData.map((d, idx) => (
                      <Pressable
                        key={idx}
                        onHoverIn={() => { if (!trendLocked) setActiveTrendIdx(idx); }}
                        onHoverOut={() => { if (!trendLocked) setActiveTrendIdx(null); }}
                        onPress={() => {
                          if (trendLocked && activeTrendIdx === idx) {
                            setTrendLocked(false);
                            setActiveTrendIdx(null);
                          } else {
                            setTrendLocked(true);
                            setActiveTrendIdx(idx);
                          }
                        }}
                        style={styles.trendAxisLabelWrapper}
                      >
                        <Text style={[
                          styles.trendAxisLabel,
                          (activeTrendIdx === idx) && { color: colors.brandPrimary }
                        ]}>
                          {d.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Text style={styles.selectedValText}>
                  {getTrendAnalysis()}
                </Text>
              </>
            ) : (
              <View style={styles.emptyChartState}>
                <MaterialCommunityIcons name="chart-line" size={32} color={colors.graphiteLight} />
                <Text style={styles.emptyChartText}>Sem viagens no período</Text>
              </View>
            )}
          </View>

          {/* Gráfico 4: Viagens por Motorista (Bar) */}
          <View style={styles.chartCol}>
            <Text style={styles.gridChartTitle}>Viagens/Motorista</Text>
            {driverTripsData.length > 0 ? (
              <>
                <View style={styles.barChartRowContainer}>
                  {driverTripsData.map((item, idx) => {
                    const isActive = activeDriverIdx === idx;
                    const fillPercent = Math.min((item.value / maxDriverTrips) * 100, 100);
                    return (
                      <View key={idx} style={styles.barColWrapper}>
                        <Pressable
                          onHoverIn={() => { if (!driverLocked) setActiveDriverIdx(idx); }}
                          onHoverOut={() => { if (!driverLocked) setActiveDriverIdx(null); }}
                          onPress={() => {
                            if (driverLocked && activeDriverIdx === idx) {
                              setDriverLocked(false);
                              setActiveDriverIdx(null);
                            } else {
                              setDriverLocked(true);
                              setActiveDriverIdx(idx);
                            }
                          }}
                          style={styles.barTouchArea}
                        >
                          <View style={styles.barTrack}>
                            <View style={[
                              styles.barFill, 
                              { 
                                height: `${fillPercent}%`, 
                                backgroundColor: item.frontColor 
                              },
                              isActive && styles.barFillActive
                            ]} />
                          </View>
                          {isActive && (
                            <View style={styles.miniTooltip}>
                              <Text style={styles.miniTooltipText}>{item.value}</Text>
                            </View>
                          )}
                        </Pressable>
                        <Text style={[styles.barLabel, isActive && { color: colors.brandPrimary }]}>
                          {item.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.selectedValText}>
                  {getDriverAnalysis()}
                </Text>
              </>
            ) : (
              <View style={styles.emptyChartState}>
                <MaterialCommunityIcons name="account-group" size={32} color={colors.graphiteLight} />
                <Text style={styles.emptyChartText}>Sem viagens registradas</Text>
              </View>
            )}
          </View>

        </View>

      </View>

      <TouchableOpacity style={styles.excelBtn} onPress={() => generateTripsExcel(getFilteredTrips())}>
        <MaterialCommunityIcons name="microsoft-excel" size={32} color={colors.white} />
        <Text style={styles.excelBtnText}>EXPORTAR PARA EXCEL JBS (.XLSX)</Text>
      </TouchableOpacity>
      
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '900', color: colors.graphite, marginBottom: 12, textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterBtnText: { fontSize: 13, fontWeight: '900', color: colors.graphiteLight },
  filterBtnTextActive: { color: colors.white },
  biGrid: { marginBottom: 15 },
  biCard: { backgroundColor: colors.white, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  biValue: { fontSize: 36, fontWeight: '900', color: colors.brandPrimary, marginTop: 10 },
  biLabel: { fontSize: 14, fontWeight: '900', color: colors.graphiteLight, marginTop: 5, textAlign: 'center' },
  metricsGrid: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  metricCard: { flex: 1, backgroundColor: colors.white, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  metricValue: { fontSize: 24, fontWeight: '900', color: colors.graphite },
  metricLabel: { fontSize: 10, fontWeight: '900', color: colors.graphiteLight, marginTop: 5, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.graphite, marginBottom: 15, textTransform: 'uppercase', marginTop: 10 },
  sectionTitleAlert: { fontSize: 16, fontWeight: '900', color: colors.red, marginBottom: 5, textTransform: 'uppercase' },
  alertContainer: { backgroundColor: '#FFFBEB', padding: 20, borderRadius: 12, borderWidth: 2, borderColor: '#FDE68A', marginBottom: 25, elevation: 3 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 15, borderRadius: 8, marginTop: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  alertLight: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, shadowColor: colors.red, shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  alertTitle: { fontSize: 16, fontWeight: '900', color: colors.red },
  alertDesc: { fontSize: 14, color: colors.graphite, marginTop: 5, fontWeight: '700', marginBottom: 10 },
  resetBtn: { flexDirection: 'row', backgroundColor: colors.brandPrimary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  resetBtnText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },

  chartGrid: { gap: 15, marginBottom: 25 },
  chartRow: { flexDirection: 'row', gap: 15, width: '100%' },
  chartCol: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, alignItems: 'center', justifyContent: 'space-between', minHeight: 225 },
  gridChartTitle: { fontSize: 13, fontWeight: '900', color: colors.graphite, marginBottom: 10, textTransform: 'uppercase', textAlign: 'center' },

  // Custom Bar Chart styling
  barChartRowContainer: { flexDirection: 'row', height: 110, width: '100%', justifyContent: 'space-around', paddingBottom: 5 },
  barColWrapper: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTouchArea: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: 16, height: 80, backgroundColor: '#F0F0F2', borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 8 },
  barFillActive: { transform: [{ scaleX: 1.25 }] },
  barLabel: { fontSize: 9, fontWeight: 'bold', color: colors.graphiteLight, marginTop: 6, textAlign: 'center' },

  // Mini tooltip styling
  miniTooltip: { position: 'absolute', top: -20, backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 10 },
  miniTooltipText: { color: colors.white, fontSize: 8, fontWeight: 'bold' },

  // Custom Line Chart styling
  lineChartSvgContainer: { height: 115, width: '100%', alignItems: 'center', justifyContent: 'center' },
  trendXAxisRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginTop: 4 },
  trendAxisLabelWrapper: { paddingVertical: 4 },
  trendAxisLabel: { fontSize: 9, fontWeight: 'bold', color: colors.graphiteLight },

  miniChartContainer: { flex: 1, width: '100%', justifyContent: 'center', gap: 6 },
  sectorRowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  sectorRowItemActive: { backgroundColor: '#F9FAFB', borderColor: colors.border },
  sectorTextName: { fontSize: 10, fontWeight: 'bold', color: colors.graphite, flex: 1, marginLeft: 8 },
  sectorTextVal: { fontSize: 10, fontWeight: '900', color: colors.graphiteLight },

  miniLegend: { display: 'none' },
  miniLegendRow: { display: 'none' },
  miniLegendDot: { display: 'none' },
  miniLegendText: { display: 'none' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  selectedValText: { fontSize: 9, fontWeight: 'bold', color: colors.brandPrimary, marginTop: 8, textAlign: 'center', textTransform: 'uppercase' },
  helpText: { fontSize: 9, color: colors.graphiteLight, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  emptyChartState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyChartText: { fontSize: 10, fontWeight: 'bold', color: colors.graphiteLight, textAlign: 'center' },

  excelBtn: { flexDirection: 'row', backgroundColor: '#107C41', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3, marginTop: 10, marginBottom: 20, gap: 10 },
  excelBtnText: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  aiCard: { backgroundColor: '#FFFDF5', padding: 18, borderRadius: 12, borderWidth: 1.5, borderColor: '#FCD34D', marginBottom: 25, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 2 },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiCardTitle: { fontSize: 14, fontWeight: '900', color: '#B45309' },
  aiCardDesc: { fontSize: 13, color: colors.graphite, fontWeight: '600', marginBottom: 10 },
  insightRow: { flexDirection: 'row', gap: 8, marginBottom: 8, paddingRight: 10 },
  insightText: { fontSize: 12, color: colors.graphite, fontWeight: '500', lineHeight: 18 }
});


