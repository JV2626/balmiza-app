import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ChecklistModal = ({ visible, onClose, onConfirm }: Props) => {
  const [q1, setQ1] = useState(false);
  const [q2, setQ2] = useState(false);
  const [q3, setQ3] = useState(false);

  const handleStart = () => {
    if (!q1 || !q2 || !q3) {
      Alert.alert('Atenção', 'Você deve conferir e marcar TODOS os itens do Checklist para garantir a segurança da viagem.');
      return;
    }
    onConfirm();
  };

  const CheckItem = ({ label, value, onChange }: { label: string, value: boolean, onChange: (v: boolean) => void }) => (
    <TouchableOpacity style={[styles.checkRow, value && styles.checkRowActive]} onPress={() => onChange(!value)}>
      <View style={[styles.checkBox, value && styles.checkBoxActive]}>
        {value && <MaterialCommunityIcons name="check" size={20} color={colors.white} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="clipboard-check" size={32} color={colors.graphite} />
            <Text style={styles.title}>VISTORIA DIÁRIA</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Por segurança, confirme os itens abaixo antes de dar partida no veículo:
          </Text>

          <View style={styles.list}>
            <CheckItem label="Pneus calibrados e em bom estado?" value={q1} onChange={setQ1} />
            <CheckItem label="Nível de Água e Óleo conferidos?" value={q2} onChange={setQ2} />
            <CheckItem label="Luzes e Setas funcionando perfeitamente?" value={q3} onChange={setQ3} />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCELAR</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmBtn, (!q1 || !q2 || !q3) && {opacity: 0.5}]} 
              onPress={handleStart}
            >
              <Text style={styles.confirmText}>TUDO OK! INICIAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.white, width: '100%', borderRadius: 16, padding: 25, elevation: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  title: { fontSize: 22, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  subtitle: { fontSize: 16, color: colors.graphiteLight, fontWeight: 'bold', marginBottom: 25, lineHeight: 22 },
  list: { gap: 15, marginBottom: 30 },
  checkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, padding: 15, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  checkRowActive: { borderColor: colors.green, backgroundColor: '#F0FFF4' },
  checkBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.graphiteLight, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  checkBoxActive: { backgroundColor: colors.green, borderColor: colors.green },
  checkLabel: { fontSize: 16, fontWeight: 'bold', color: colors.graphite, flex: 1 },
  footer: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 55, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.background },
  cancelText: { fontSize: 16, fontWeight: 'bold', color: colors.graphiteLight },
  confirmBtn: { flex: 2, height: 55, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.green },
  confirmText: { fontSize: 16, fontWeight: '900', color: colors.white, textTransform: 'uppercase' }
});
