import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/colors';

interface CarProps {
  plate: string;
  current_mileage: number;
  last_oil_change_km: number;
  interval_km: number;
}

interface OilStatusCardProps {
  car: CarProps;
}

export const OilStatusCard: React.FC<OilStatusCardProps> = ({ car }) => {
  const { current_mileage, last_oil_change_km, interval_km } = car;

  // Função robusta de formatação compatível com Android/Hermes
  const formatKm = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // 1. Calcule o Alvo
  const next_change_km = last_oil_change_km + interval_km;

  // 2. Calcule a Contagem Regressiva
  const remaining_km = next_change_km - current_mileage;

  // 4. Regras de Cor do Card e Textos de Contraste
  let cardBgColor = COLORS.oilOk;
  let statusText = 'Óleo OK';
  let statusTextColor = '#000000';
  let valueColor = COLORS.oilOk;

  if (remaining_km <= 0) {
    cardBgColor = COLORS.oilAlert;
    statusText = 'Troca Imediata!';
    statusTextColor = '#FFFFFF';
    valueColor = '#FF5555'; // Vermelho claro sobre o fundo preto translúcido
  } else if (remaining_km <= 1000) {
    cardBgColor = COLORS.oilWarning;
    statusText = 'Agendar Revisão';
    statusTextColor = '#000000';
    valueColor = COLORS.oilWarning; // Amarelo
  }

  return (
    <View style={[styles.card, { backgroundColor: cardBgColor }]}>
      <Text style={[styles.plateText, { color: statusTextColor }]}>Veículo: {car.plate}</Text>
      <Text style={[styles.statusText, { color: statusTextColor }]}>{statusText}</Text>
      
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Km Atual:</Text>
          <Text style={styles.value}>{formatKm(current_mileage)} KM</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Próxima Troca:</Text>
          <Text style={styles.value}>{formatKm(next_change_km)} KM</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Faltam:</Text>
          <Text style={[styles.value, styles.boldValue, { color: valueColor }]}>
            {formatKm(remaining_km)} KM
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  plateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  value: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  boldValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});
