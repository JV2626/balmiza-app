import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb } from '../config/firebase';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onTripStarted: (tripId?: string) => void;
  activeShiftId?: string;
}

export const PreTripChecklistModal = ({ visible, onClose, onTripStarted, activeShiftId }: Props) => {
  const [tiresChecked, setTiresChecked] = useState(false);
  const [brakesChecked, setBrakesChecked] = useState(false);
  const [docsChecked, setDocsChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const allChecked = tiresChecked && brakesChecked && docsChecked;

  const handleStartTrip = async () => {
    if (!allChecked) return;
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('@userId');
      const db = getFirebaseDb();
      const docRef = await addDoc(collection(db, 'trips'), {
        driverId: userId,
        status: 'active',
        startedAt: new Date(),
        checklist: { tires: true, brakes: true, docs: true }
      });
      
      if (activeShiftId) {
        await updateDoc(doc(db, 'shifts', activeShiftId), { status: 'active' });
      }
      
      onTripStarted(docRef.id);
      onClose();
    } catch (error) {
      console.log('Error starting trip', error);
    }
  };

  const CheckItem = ({ label, checked, onToggle, icon }: any) => (
    <TouchableOpacity style={[styles.checkItem, checked && styles.checkItemActive]} onPress={onToggle}>
      <MaterialCommunityIcons name={icon} size={24} color={checked ? colors.green : colors.graphiteLight} />
      <Text style={[styles.checkLabel, checked && styles.checkLabelActive]}>{label}</Text>
      <MaterialCommunityIcons 
        name={checked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
        size={24} 
        color={checked ? colors.green : colors.border} 
        style={styles.checkIcon}
      />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Checklist Pré-Viagem</Text>
          <Text style={styles.modalSubtitle}>Por segurança, confirme as validações do veículo antes de iniciar a rota.</Text>

          <CheckItem 
            label="Pneus calibrados e em bom estado" 
            checked={tiresChecked} 
            onToggle={() => setTiresChecked(!tiresChecked)} 
            icon="car-tire-alert"
          />
          <CheckItem 
            label="Freios testados e fluidos normais" 
            checked={brakesChecked} 
            onToggle={() => setBrakesChecked(!brakesChecked)} 
            icon="car-brake-alert"
          />
          <CheckItem 
            label="Documentação e CNH a bordo" 
            checked={docsChecked} 
            onToggle={() => setDocsChecked(!docsChecked)} 
            icon="card-account-details-outline"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.startBtn, !allChecked && styles.startBtnDisabled]} 
              onPress={handleStartTrip}
              disabled={!allChecked}
            >
              <Text style={styles.startBtnText}>Iniciar Viagem</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 30,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.graphite,
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.graphiteLight,
    marginBottom: 25,
    lineHeight: 20,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  checkItemActive: {
    borderColor: colors.green,
    backgroundColor: '#F0FDF4',
  },
  checkLabel: {
    flex: 1,
    marginLeft: 15,
    fontSize: 15,
    color: colors.graphite,
    fontWeight: '500',
  },
  checkLabelActive: {
    color: colors.green,
    fontWeight: 'bold',
  },
  checkIcon: {
    marginLeft: 10,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  cancelBtn: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.graphite,
    fontWeight: 'bold',
    fontSize: 16,
  },
  startBtn: {
    flex: 2,
    padding: 18,
    borderRadius: 12,
    backgroundColor: colors.graphite,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  startBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  startBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  }
});
