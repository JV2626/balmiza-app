import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Clipboard, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface GPSModalProps {
  visible: boolean;
  onClose: () => void;
  passenger: any;
}

export const GPSModal: React.FC<GPSModalProps> = ({ visible, onClose, passenger }) => {
  if (!passenger) return null;

  const { latitude, longitude, nome, endereco } = passenger;
  const fullAddress = endereco || nome;

  const handleWaze = () => {
    if (latitude && longitude && latitude !== 0) {
      const url = `waze://?ll=${latitude},${longitude}&navigate=yes`;
      const webUrl = `https://www.waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported && Platform.OS !== 'web') {
            Linking.openURL(url);
          } else {
            Linking.openURL(webUrl);
          }
        })
        .catch(() => Linking.openURL(webUrl));
    } else {
      const url = `waze://?q=${encodeURIComponent(fullAddress)}`;
      const webUrl = `https://www.waze.com/ul?q=${encodeURIComponent(fullAddress)}`;
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported && Platform.OS !== 'web') {
            Linking.openURL(url);
          } else {
            Linking.openURL(webUrl);
          }
        })
        .catch(() => Linking.openURL(webUrl));
    }
    onClose();
  };

  const handleGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    Linking.openURL(url);
    onClose();
  };

  const handleCopy = () => {
    Clipboard.setString(fullAddress);
    if (Platform.OS === 'web') {
      window.alert('Copiado para a área de transferência!');
    } else {
      Alert.alert('Copiado!', 'Endereço copiado para a área de transferência.');
    }
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Como deseja navegar?</Text>
          <Text style={styles.passengerName}>{nome}</Text>
          <Text style={styles.addressText}>{fullAddress}</Text>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.optionBtn} onPress={handleWaze}>
            <MaterialCommunityIcons name="waze" size={26} color="#00C4FF" />
            <Text style={styles.optionText}>Navegar com Waze</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionBtn} onPress={handleGoogleMaps}>
            <MaterialCommunityIcons name="google-maps" size={26} color="#DF0A0A" />
            <Text style={styles.optionText}>Navegar com Google Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionBtn} onPress={handleCopy}>
            <MaterialCommunityIcons name="content-copy" size={24} color="#6B7280" />
            <Text style={styles.optionText}>Copiar Endereço</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C1C1E',
    marginBottom: 10,
    textAlign: 'center',
  },
  passengerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DF0A0A',
    textAlign: 'center',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  closeBtn: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#E53E3E',
  },
});
