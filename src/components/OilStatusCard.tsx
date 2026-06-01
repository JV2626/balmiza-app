import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export const OilStatusCard = () => {
  const currentKm = 55000;
  const interval = 10000;
  const lastChange = 50000;
  const nextChange = lastChange + interval;
  const progress = (currentKm - lastChange) / interval;
  const percentage = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="oil" size={24} color={colors.white} />
        </View>
        <View>
          <Text style={styles.title}>Status do Óleo</Text>
          <Text style={styles.subtitle}>Revisão Preventiva</Text>
        </View>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: percentage > 80 ? colors.red : colors.graphite }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>{currentKm} km (Atual)</Text>
          <Text style={styles.progressTextDark}>{nextChange} km (Troca)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    backgroundColor: colors.graphite,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.graphite,
  },
  subtitle: {
    fontSize: 14,
    color: colors.graphiteLight,
  },
  progressContainer: {
    marginTop: 5,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  progressText: {
    fontSize: 14,
    color: colors.graphiteLight,
    fontWeight: '600',
  },
  progressTextDark: {
    fontSize: 14,
    color: colors.graphite,
    fontWeight: '700',
  }
});
