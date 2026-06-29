import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Platform, SafeAreaView
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb, getFirebaseAuth } from '../config/firebase';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#DF0A0A',
  border: '#E5E7EB',
  background: '#F4F6F8',
  cardBg: '#FFFFFF'
};

export function DriverHistoryScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [searchDate, setSearchDate] = useState('');
  const [expandedDates, setExpandedDates] = useState<{ [key: string]: boolean }>({});

  const user = getFirebaseAuth().currentUser;
  const email = user?.email || '';

  useEffect(() => {
    const fetchHistory = async () => {
      if (!email) return;
      try {
        const db = getFirebaseDb();
        const q = query(
          collection(db, 'viagens'),
          where('motoristaId', '==', email.toLowerCase().trim()),
          where('status', '==', 'completed')
        );

        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        // Ordenar por data decrescente (mais recente primeiro)
        list.sort((a, b) => {
          const dateA = parseDate(a.data);
          const dateB = parseDate(b.data);
          return dateB.getTime() - dateA.getTime();
        });

        setTrips(list);
      } catch (e) {
        console.error('Erro ao buscar histórico do motorista:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [email]);

  const parseDate = (dStr: string) => {
    if (!dStr) return new Date(0);
    const parts = dStr.split('/');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    return new Date(0);
  };

  // Agrupar viagens por data
  const groupedByDate = React.useMemo(() => {
    const groups: { [key: string]: { trips: any[]; carroPlaca: string; kmInicial: number; kmFinal: number } } = {};

    trips.forEach((t) => {
      // Filtrar por data se houver pesquisa
      if (searchDate && !t.data.includes(searchDate)) {
        return;
      }

      const dateKey = t.data;
      if (!groups[dateKey]) {
        groups[dateKey] = {
          trips: [],
          carroPlaca: t.carroPlaca || 'N/A',
          kmInicial: 9999999,
          kmFinal: 0
        };
      }

      groups[dateKey].trips.push(t);

      // Calcular o KM inicial mínimo e o final máximo do dia
      if (t.kmInicial && Number(t.kmInicial) < groups[dateKey].kmInicial && Number(t.kmInicial) > 0) {
        groups[dateKey].kmInicial = Number(t.kmInicial);
      }
      if (t.kmFinal && Number(t.kmFinal) > groups[dateKey].kmFinal) {
        groups[dateKey].kmFinal = Number(t.kmFinal);
      }
      if (t.carroPlaca && t.carroPlaca !== 'N/A') {
        groups[dateKey].carroPlaca = t.carroPlaca;
      }
    });

    // Ajustar valores de KM que permaneceram no padrão
    Object.keys(groups).forEach((key) => {
      if (groups[key].kmInicial === 9999999) {
        groups[key].kmInicial = 0;
      }
    });

    return groups;
  }, [trips, searchDate]);

  const toggleExpand = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.graphite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MEU HISTÓRICO</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.graphiteLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filtrar por data (ex: 28/06/2026)"
          placeholderTextColor={colors.graphiteLight}
          value={searchDate}
          onChangeText={setSearchDate}
          keyboardType="numeric"
        />
        {searchDate ? (
          <TouchableOpacity onPress={() => setSearchDate('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.graphiteLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.red} />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="calendar-blank" size={64} color={colors.graphiteLight} />
          <Text style={styles.emptyText}>Nenhuma viagem finalizada encontrada.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {Object.keys(groupedByDate).map((dateKey) => {
            const group = groupedByDate[dateKey];
            const isExpanded = !!expandedDates[dateKey];
            const hasKmInfo = group.kmInicial > 0 && group.kmFinal > 0;
            const kmDiff = hasKmInfo ? group.kmFinal - group.kmInicial : 0;

            // Desmembrar todos os trechos concluídos dentro do dia
            const segments: any[] = [];
            group.trips.forEach((t) => {
              if (!t.isExtra && t.groupStates) {
                // Escala normal com trechos
                const groupedPassengers: { [key: string]: any[] } = {};
                const isVolta = t.destino?.toUpperCase().includes('JBS/CASA') || 
                                t.destino?.toUpperCase().includes('JBSXCASA') ||
                                t.destino?.toUpperCase().includes('JBS X CASA') ||
                                t.destino?.toUpperCase().includes('JBS-CASA') ||
                                t.destino?.toUpperCase().includes('JBS > CASA');
                const label = isVolta ? 'JBS ➔ CASA' : 'CASA ➔ JBS';

                if (t.passageiros) {
                  t.passageiros.forEach((p: any) => {
                    const time = p.horarioEntrada || '00:00';
                    const key = `${time}_${label}`;
                    if (!groupedPassengers[key]) {
                      groupedPassengers[key] = [];
                    }
                    groupedPassengers[key].push(p);
                  });
                }

                Object.keys(t.groupStates).forEach((groupKey) => {
                  const gs = t.groupStates[groupKey];
                  const isCompletedSegment = gs.status === 'completed' || t.status === 'completed';
                  
                  if (isCompletedSegment) {
                    const groupPass = groupedPassengers[groupKey] || [];
                    const passNames = groupPass.map((p: any) => p.nome).join(', ') || 'N/A';
                    
                    const time = groupKey.split('_')[0];
                    const destLabel = groupKey.split('_')[1]; // Ex: "CASA ➔ JBS" ou "JBS ➔ CASA"

                    segments.push({
                      id: `${t.id}_${groupKey}`,
                      passNames,
                      destino: destLabel,
                      horaInicio: gs.horaInicio || t.horaInicio || '-',
                      horaFim: gs.horaFim || t.horaFim || '-',
                      kmInicial: gs.kmInicial || t.kmInicial || '-',
                      kmFinal: gs.kmFinal || t.kmFinal || '-',
                      displayType: 'NORMAL',
                      horaOrder: time
                    });
                  }
                });
              } else {
                // Viagem extra ou legado
                const passNames = t.passageiros?.map((p: any) => p.nome).join(', ') || 'N/A';
                segments.push({
                  id: t.id,
                  passNames,
                  destino: t.destino || 'N/A',
                  horaInicio: t.horaInicio || '-',
                  horaFim: t.horaFim || '-',
                  kmInicial: t.kmInicial || '-',
                  kmFinal: t.kmFinal || '-',
                  displayType: t.isExtra ? 'EXTRA' : 'NORMAL',
                  horaOrder: t.horaInicio || '00:00'
                });
              }
            });

            // Ordenar segmentos cronologicamente
            segments.sort((a, b) => a.horaOrder.localeCompare(b.horaOrder));

            return (
              <View key={dateKey} style={[styles.card, isExpanded && styles.cardExpanded]}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(dateKey)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.dateBadgeContainer}>
                      <Text style={styles.dateText}>{dateKey}</Text>
                      <Text style={styles.vehicleBadge}>{group.carroPlaca}</Text>
                    </View>

                    <View style={styles.kmSummaryRow}>
                      <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.graphiteLight} />
                      <Text style={styles.kmSummaryText}>
                        {hasKmInfo ? `${group.kmInicial} ➔ ${group.kmFinal} (${kmDiff} KM)` : 'Sem registro de KM'}
                      </Text>
                    </View>
                  </View>

                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={colors.graphite}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.cardDetails}>
                    <View style={styles.segmentDivider} />
                    <Text style={styles.detailsHeadline}>TRECHOS REALIZADOS NESSE DIA:</Text>

                    {segments.map((seg, idx) => (
                      <View key={seg.id} style={styles.segmentItem}>
                        <View style={styles.segmentItemHeader}>
                          <View style={styles.timeLabelContainer}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.red} />
                            <Text style={styles.timeLabelText}>{seg.horaInicio} às {seg.horaFim}</Text>
                          </View>
                          <Text style={[
                            styles.typeBadge,
                            seg.displayType === 'EXTRA' ? styles.typeExtra : styles.typeNormal
                          ]}>
                            {seg.displayType}
                          </Text>
                        </View>

                        <Text style={styles.segmentDetailText}>
                          <Text style={{ fontWeight: 'bold' }}>Destino:</Text> {seg.destino}
                        </Text>

                        <Text style={styles.segmentDetailText}>
                          <Text style={{ fontWeight: 'bold' }}>Passageiros:</Text> {seg.passNames}
                        </Text>

                        <Text style={styles.segmentDetailText}>
                          <Text style={{ fontWeight: 'bold' }}>Hodômetro:</Text> {seg.kmInicial} ➔ {seg.kmFinal}
                        </Text>

                        {idx < segments.length - 1 && <View style={styles.miniDivider} />}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 25 : 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.background
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.graphite,
    letterSpacing: 0.5
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.graphite,
    height: '100%'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.graphiteLight
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.graphiteLight,
    textAlign: 'center'
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
    paddingBottom: 60
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    overflow: 'hidden'
  },
  cardExpanded: {
    borderColor: colors.red
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  dateBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  dateText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.graphite
  },
  vehicleBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.white,
    backgroundColor: colors.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  kmSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  kmSummaryText: {
    fontSize: 13,
    color: colors.graphiteLight
  },
  cardDetails: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#FAFCFD'
  },
  segmentDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12
  },
  detailsHeadline: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.graphiteLight,
    letterSpacing: 1,
    marginBottom: 12
  },
  segmentItem: {
    marginBottom: 12
  },
  segmentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  timeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.graphite
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  typeNormal: {
    backgroundColor: '#E6F4EA',
    color: colors.green
  },
  typeExtra: {
    backgroundColor: '#FFF5F5',
    color: colors.red
  },
  segmentDetailText: {
    fontSize: 13,
    color: colors.graphite,
    marginBottom: 4,
    lineHeight: 18
  },
  miniDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12
  }
});
