import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Image, Platform, FlatList 
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../config/firebase';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#DF0A0A',
  border: '#E5E7EB',
  background: '#F4F6F8',
};

type FilterType = 'all' | 'long' | 'itape' | 'exec';

export const TripsHistoryScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    const db = getFirebaseDb();
    // Query completed trips
    const q = query(collection(db, 'viagens'), where('status', '==', 'completed'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first
      docs.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setTrips(docs);
      setLoading(false);
    }, (err) => {
      console.log('Error loading trips history', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getFilteredTrips = () => {
    let result = [...trips];

    // Text search
    if (search.trim()) {
      const queryStr = search.toLowerCase();
      result = result.filter(t => {
        const matchesPlate = t.carroPlaca?.toLowerCase().includes(queryStr);
        const matchesDriver = t.motoristaNome?.toLowerCase().includes(queryStr);
        const matchesDest = t.destino?.toLowerCase().includes(queryStr);
        const matchesDate = t.data?.toLowerCase().includes(queryStr);
        const matchesPassenger = t.passageiros?.some((p: any) => p.nome?.toLowerCase().includes(queryStr) || p.endereco?.toLowerCase().includes(queryStr));
        return matchesPlate || matchesDriver || matchesDest || matchesDate || matchesPassenger;
      });
    }

    // Category filter chips
    if (activeFilter === 'long') {
      // Long runs > 100 KM
      result = result.filter(t => {
        const diff = (t.kmFinal || 0) - (t.kmInicial || 0);
        return diff >= 100;
      });
    } else if (activeFilter === 'itape') {
      // Passengers from Itapetininga / Itape (either explicit or implicit by city/sector)
      result = result.filter(t => {
        return t.passageiros?.some((p: any) => {
          const addr = p.endereco?.toLowerCase() || '';
          const sector = p.setor?.toLowerCase() || '';
          
          // Explicit check
          if (addr.includes('itapetininga') || addr.includes('itape') || sector.includes('itapetininga') || sector.includes('itape')) {
            return true;
          }
          
          // Implicit check (Fábrica de Rações is in Itapetininga)
          if (sector.includes('ração') || sector.includes('rações') || sector.includes('racoes')) {
            return true;
          }
          
          // If it is a JBS passenger, and address doesn't target another city, it belongs to Itapetininga
          const isOtherCity = addr.includes('tatuí') || addr.includes('tatui') || addr.includes('sorocaba') || addr.includes('boituva') || addr.includes('nuporanga');
          if (!isOtherCity && addr.length > 0) {
            return true;
          }
          
          return false;
        });
      });
    } else if (activeFilter === 'exec') {
      // Executive / Admin passengers
      result = result.filter(t => {
        return t.passageiros?.some((p: any) => {
          const sector = p.setor?.toLowerCase() || '';
          return sector.includes('executivo') || sector.includes('diretoria') || sector.includes('adm') || sector.includes('administrativo');
        });
      });
    }

    return result;
  };

  const filteredData = getFilteredTrips();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.graphite} />
        </TouchableOpacity>
        <Text style={styles.title}>Histórico de Viagens</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.graphiteLight} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar por motorista, placa, data, local ou passageiro..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.graphiteLight}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.graphiteLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
        <TouchableOpacity 
          style={[styles.chip, activeFilter === 'all' && styles.activeChip]} 
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.chipText, activeFilter === 'all' && styles.activeChipText]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.chip, activeFilter === 'long' && styles.activeChip]} 
          onPress={() => setActiveFilter('long')}
        >
          <Text style={[styles.chipText, activeFilter === 'long' && styles.activeChipText]}>Viagens Longas (+100 km)</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.chip, activeFilter === 'itape' && styles.activeChip]} 
          onPress={() => setActiveFilter('itape')}
        >
          <Text style={[styles.chipText, activeFilter === 'itape' && styles.activeChipText]}>Funcionários Itapetininga</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.chip, activeFilter === 'exec' && styles.activeChip]} 
          onPress={() => setActiveFilter('exec')}
        >
          <Text style={[styles.chipText, activeFilter === 'exec' && styles.activeChipText]}>Executivos / ADM</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.red} style={{ marginTop: 50 }} />
      ) : filteredData.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="folder-open-outline" size={48} color={colors.graphiteLight} />
          <Text style={styles.emptyText}>Nenhuma viagem concluída corresponde aos filtros.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const distance = (item.kmFinal || 0) - (item.kmInicial || 0);
            return (
              <View style={styles.tripCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerTitleContainer}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.red} />
                    <Text style={styles.dateText}>{item.data}</Text>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>+{distance} KM</Text>
                  </View>
                </View>

                <View style={styles.body}>
                  <Text style={styles.infoLabel}>Motorista: <Text style={styles.infoValue}>{item.motoristaNome?.split('@')[0].toUpperCase()}</Text></Text>
                  <Text style={styles.infoLabel}>Veículo: <Text style={styles.infoValue}>{item.carroPlaca}</Text></Text>
                  <Text style={styles.infoLabel}>KM Inicial: <Text style={styles.infoValue}>{item.kmInicial}</Text> | KM Final: <Text style={styles.infoValue}>{item.kmFinal}</Text></Text>
                  
                  {item.horaInicio && item.horaFim ? (
                    <Text style={styles.infoLabel}>Duração: <Text style={styles.infoValue}>{item.horaInicio} às {item.horaFim}</Text></Text>
                  ) : null}

                  {item.observacoes ? (
                    <Text style={[styles.infoLabel, { marginTop: 5 }]}>Notas: <Text style={styles.notesText}>"{item.observacoes}"</Text></Text>
                  ) : null}

                  {/* Passengers */}
                  <View style={styles.passengersSection}>
                    <Text style={styles.passengersTitle}>Passageiros ({item.passageiros?.length || 0})</Text>
                    {item.passageiros?.map((p: any, pIdx: number) => (
                      <Text key={pIdx} style={styles.passengerLine}>
                        • {p.nome} <Text style={{ color: colors.graphiteLight }}>({p.horarioEntrada} - {p.setor || 'JBS'})</Text>
                      </Text>
                    ))}
                  </View>

                  {/* Proof Image */}
                  {item.fotoUrl ? (
                    <View style={styles.imageSection}>
                      <Text style={styles.passengersTitle}>Comprovante de Telemetria (Painel)</Text>
                      <Image source={{ uri: item.fotoUrl }} style={styles.proofImage} resizeMode="cover" />
                    </View>
                  ) : (
                    <View style={styles.noImageBadge}>
                      <MaterialCommunityIcons name="image-off-outline" size={16} color={colors.graphiteLight} />
                      <Text style={styles.noImageText}>Sem comprovante de painel anexado</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 8, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 22, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, margin: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.border, elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14, color: colors.graphite },
  
  chipsScroll: { maxHeight: 50, marginBottom: 10 },
  chipsContent: { paddingHorizontal: 15, gap: 10, alignItems: 'center' },
  chip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  activeChip: { backgroundColor: colors.red, borderColor: colors.red },
  chipText: { fontSize: 13, fontWeight: 'bold', color: colors.graphiteLight },
  activeChipText: { color: colors.white },
  
  emptyCard: { backgroundColor: colors.white, margin: 20, padding: 30, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.graphiteLight, fontSize: 14, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
  
  tripCard: { backgroundColor: colors.white, borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: colors.border, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10, marginBottom: 12 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: 16, fontWeight: 'bold', color: colors.graphite },
  distanceBadge: { backgroundColor: '#E6F4EA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  distanceText: { color: colors.green, fontSize: 12, fontWeight: 'bold' },
  
  body: { gap: 6 },
  infoLabel: { fontSize: 13, color: colors.graphiteLight, fontWeight: '600' },
  infoValue: { color: colors.graphite, fontWeight: 'bold' },
  notesText: { color: colors.graphite, fontStyle: 'italic', fontWeight: '500' },
  
  passengersSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  passengersTitle: { fontSize: 12, fontWeight: '900', color: colors.graphiteLight, textTransform: 'uppercase', marginBottom: 6 },
  passengerLine: { fontSize: 14, fontWeight: 'bold', color: colors.graphite, marginBottom: 4 },
  
  imageSection: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  proofImage: { width: '100%', height: 160, borderRadius: 8, marginTop: 5, backgroundColor: '#EEE' },
  noImageBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8, marginTop: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border },
  noImageText: { fontSize: 12, color: colors.graphiteLight, fontWeight: 'bold' },
});
