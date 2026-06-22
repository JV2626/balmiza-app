import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  onConfirm?: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  onClose,
  onConfirm
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return 'check-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'alert';
      default: return 'information';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return '#2F855A'; // success Green
      case 'error': return '#DF0A0A'; // Balmiza Red
      case 'warning': return '#D97706'; // warning Amber
      default: return '#1C1C1E'; // Graphite
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.alertCard}>
          <View style={[styles.iconWrapper, { backgroundColor: getColor() + '1A' }]}>
            <MaterialCommunityIcons name={getIcon() as any} size={40} color={getColor()} />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonRow}>
            {onConfirm ? (
              <>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, { backgroundColor: getColor() }]} 
                  onPress={() => {
                    onConfirm();
                    onClose();
                  }}
                >
                  <Text style={styles.confirmText}>Confirmar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: getColor(), flex: 1 }]} onPress={onClose}>
                <Text style={styles.confirmText}>Entendido</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontWeight: '500'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: 'bold'
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase'
  }
});
