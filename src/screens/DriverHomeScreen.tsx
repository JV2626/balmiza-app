import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { OilStatusCard } from '../components/OilStatusCard';
import { TripClosingModal } from '../components/TripClosingModal';
import { COLORS } from '../theme/colors';

export default function DriverHomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  
  // Dados simulados do carro conforme esquema do banco (constante estática de state para podermos atualizar o odômetro após salvar)
  const [car, setCar] = useState({
    plate: 'ABC1234',
    current_mileage: 55000,
    last_oil_change_km: 50000,
    interval_km: 10000,
  });

  const handleSOS = () => {
    Alert.alert('SOS Acionado', 'Central Balmiza notificada. Suporte em trânsito.');
  };

  const handleSaveTrip = (endingMileage: number, photoUrl: string) => {
    // Atualiza o hodômetro do veículo localmente (Offline-first simulado)
    setCar(prev => ({
      ...prev,
      current_mileage: endingMileage
    }));
    console.log(`Viagem salva: KM Final ${endingMileage}, Foto: ${photoUrl}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Balmiza */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BALMIZA</Text>
          <Text style={styles.headerSubtitle}>Telemetria e Frota Corporativa</Text>
        </View>

        {/* Card de Status de Óleo */}
        <OilStatusCard car={car} />

        {/* Rota de Hoje */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rota do Dia</Text>
          <View style={styles.routeCard}>
            <View style={styles.routePoint}>
              <View style={[styles.bullet, { backgroundColor: COLORS.oilOk }]} />
              <View>
                <Text style={styles.routeLabel}>Origem</Text>
                <Text style={styles.routeText}>Sede Balmiza Central</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={[styles.bullet, { backgroundColor: COLORS.primary }]} />
              <View>
                <Text style={styles.routeLabel}>Destino</Text>
                <Text style={styles.routeText}>Cliente Corporativo Industrial</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Botões de Ação */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
            <Text style={styles.sosButtonText}>SOS EMERGÊNCIA</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.endTripButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.endTripButtonText}>FINALIZAR VIAGEM</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Fechamento de Diário de Bordo */}
      <TripClosingModal 
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveTrip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
  },
  headerSubtitle: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  section: {
    marginTop: 25,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  routeCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 16,
  },
  routeLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  routeText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: 4,
  },
  actionContainer: {
    marginTop: 35,
    gap: 15,
  },
  sosButton: {
    backgroundColor: 'transparent',
    borderColor: COLORS.primary,
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sosButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  endTripButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  endTripButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
