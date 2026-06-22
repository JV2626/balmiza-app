import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../../config/firebase';
import { colors } from '../../theme/colors';
import { AnimatedCard } from '../../components/AnimatedCard';

export const ComplianceTab = () => {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const db = getFirebaseDb();
      const q = query(collection(db, 'trips'), orderBy('closedAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const fetchedTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(fetchedTrips);
    } catch (e) {
      console.log('Error fetching admin trips', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Histórico de Viagens e GPS</Text>
        <TouchableOpacity onPress={fetchTrips} style={styles.actionBtn}>
          <MaterialCommunityIcons name="refresh" size={24} color={colors.graphite} />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={colors.red} style={{marginTop: 50}} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
          {trips.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma viagem registrada ainda.</Text>
          ) : (
            trips.map((trip, index) => (
              <AnimatedCard key={trip.id} style={styles.tripCard} delay={Math.min(index * 70, 700)}>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripDate}>
                    {trip.closedAt ? new Date(trip.closedAt.seconds * 1000).toLocaleString() : 'Data Desconhecida'}
                  </Text>
                  
                  <View style={styles.row}>
                    <MaterialCommunityIcons name="speedometer" size={18} color={colors.graphiteLight} />
                    <Text style={styles.tripLabel}> KM Final: <Text style={styles.tripValue}>{trip.finalOdometer}</Text></Text>
                  </View>

                  <View style={styles.row}>
                    <MaterialCommunityIcons name="map-marker-radius" size={18} color={colors.green} />
                    <Text style={styles.tripLabel}> Loc: <Text style={[styles.tripValue, {fontSize: 12}]}>{trip.closingLocation || 'Não rastreado'}</Text></Text>
                  </View>
                  
                  {trip.notes ? (
                    <View style={styles.notesContainer}>
                      <MaterialCommunityIcons name="comment-text-outline" size={16} color={colors.graphiteLight} />
                      <Text style={styles.notesText}>{trip.notes}</Text>
                    </View>
                  ) : null}
                </View>
                
                {trip.dashboardImageUrl ? (
                  <Image source={{ uri: trip.dashboardImageUrl }} style={styles.tripImage} />
                ) : (
                  <View style={styles.noImage}>
                    <MaterialCommunityIcons name="image-off-outline" size={24} color="#ccc" />
                  </View>
                )}
              </AnimatedCard>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: colors.graphite },
  actionBtn: { padding: 10, backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4 },
  emptyText: { color: colors.graphiteLight, textAlign: 'center', marginTop: 40 },
  tripCard: { backgroundColor: colors.white, borderRadius: 16, padding: 20, marginBottom: 15, flexDirection: 'row', elevation: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
  tripInfo: { flex: 1, marginRight: 15 },
  tripDate: { fontSize: 12, color: colors.red, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tripLabel: { fontSize: 14, color: colors.graphiteLight },
  tripValue: { fontWeight: 'bold', color: colors.graphite },
  notesContainer: { flexDirection: 'row', backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', padding: 10, borderRadius: 8, marginTop: 8 },
  notesText: { fontSize: 13, color: colors.red, marginLeft: 8, flex: 1, fontWeight: '500' },
  tripImage: { width: 90, height: 120, borderRadius: 12, backgroundColor: '#F3F4F6' },
  noImage: { width: 90, height: 120, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }
});
