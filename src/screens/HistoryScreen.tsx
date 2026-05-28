import React from 'react';
import { StyleSheet, Text, View, FlatList, Image, SafeAreaView } from 'react-native';
import { COLORS } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface TripRecord {
  id: string;
  date: string;
  plate: string;
  start_km: number;
  end_km: number;
  photo_url: string;
}

export default function HistoryScreen() {
  // Histórico de viagens simulado (offline-first)
  const historyData: TripRecord[] = [
    {
      id: '1',
      date: '27/05/2026',
      plate: 'ABC1234',
      start_km: 54850,
      end_km: 55000,
      photo_url: 'https://i.ibb.co/placeholder-hodometro.jpg',
    },
    {
      id: '2',
      date: '26/05/2026',
      plate: 'ABC1234',
      start_km: 54600,
      end_km: 54850,
      photo_url: 'https://i.ibb.co/placeholder-hodometro.jpg',
    },
    {
      id: '3',
      date: '25/05/2026',
      plate: 'XYZ9876',
      start_km: 110200,
      end_km: 110450,
      photo_url: 'https://i.ibb.co/placeholder-hodometro.jpg',
    },
  ];

  const renderItem = ({ item }: { item: TripRecord }) => {
    const distanceTraveled = item.end_km - item.start_km;

    return (
      <View style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="car-sport" size={20} color={COLORS.primary} />
            <Text style={styles.plateText}>{item.plate}</Text>
          </View>
          <Text style={styles.dateText}>{item.date}</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>KM Inicial:</Text>
              <Text style={styles.statValue}>{item.start_km.toLocaleString()} KM</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>KM Final:</Text>
              <Text style={styles.statValue}>{item.end_km.toLocaleString()} KM</Text>
            </View>
            <View style={[styles.statRow, styles.distanceRow]}>
              <Text style={styles.distanceLabel}>Distância Percorrida:</Text>
              <Text style={styles.distanceValue}>+{distanceTraveled} KM</Text>
            </View>
          </View>

          <View style={styles.imageWrapper}>
            <Image source={{ uri: item.photo_url }} style={styles.thumbnail} />
            <Text style={styles.thumbLabel}>HODÔMETRO</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MEU HISTÓRICO</Text>
        <Text style={styles.headerSubtitle}>Registro de telemetria offline</Text>
      </View>

      <FlatList
        data={historyData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Nenhuma viagem registrada ainda.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  historyCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plateText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsContainer: {
    flex: 1,
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 15,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  distanceRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 6,
  },
  distanceLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  distanceValue: {
    color: COLORS.oilOk,
    fontSize: 13,
    fontWeight: 'bold',
  },
  imageWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 6,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumbLabel: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
