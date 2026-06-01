import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { colors } from '../theme/colors';

// ImgBB API Key
const IMGBB_API_KEY = '72645fb5d7afa821458ed9bd3505e71f'; 

interface Props {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  activeShiftId?: string;
}

export const TripClosingModal = ({ visible, onClose, tripId, activeShiftId }: Props) => {
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const resetState = () => {
    setStep('form');
    setOdometer('');
    setNotes('');
    setPhotoUri(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleCameraCapture = async () => {
    if (!odometer) {
      Platform.OS === 'web' ? window.alert('Preencha a quilometragem') : Alert.alert('Erro', 'Preencha a quilometragem.');
      return;
    }

    try {
      setLoading(true);
      
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false && Platform.OS !== 'web') {
        Alert.alert('Erro', 'Precisamos da permissão de câmera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photo = result.assets[0];
        
        // Compress image
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        setPhotoUri(manipResult.base64!);
        setStep('confirm');
      }
    } catch (e: any) {
      console.log('Error taking picture', e);
      Platform.OS === 'web' ? window.alert('Erro ao abrir câmera') : Alert.alert('Erro', 'Falha ao acessar câmera');
    } finally {
      setLoading(false);
    }
  };

  const uploadToImgBB = async (base64Image: string) => {
    const formData = new FormData();
    formData.append('image', base64Image);
    
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return data.data.url;
  };

  const submitClosing = async () => {
    if (!photoUri || !tripId) return;
    
    setLoading(true);
    try {
      // 1. Capture Location
      let locationString = 'Localização Indisponível';
      
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          locationString = `${location.coords.latitude}, ${location.coords.longitude}`;
        }
      } catch (locErr) {
        console.log('Error getting location, saving without it', locErr);
      }

      // 2. Upload photo
      const imageUrl = await uploadToImgBB(photoUri);
      
      // 3. Update Firestore Document
      const db = getFirebaseDb();
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        status: 'closed',
        finalOdometer: odometer,
        notes: notes,
        dashboardImageUrl: imageUrl,
        closingLocation: locationString,
        closedAt: new Date()
      });
      
      if (activeShiftId) {
        await updateDoc(doc(db, 'shifts', activeShiftId), { status: 'completed' });
      }

      handleClose();
    } catch (e) {
      console.log('Error closing trip', e);
      Platform.OS === 'web' ? window.alert('Erro ao fechar viagem') : Alert.alert('Erro', 'Ocorreu um erro ao finalizar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          {step === 'form' && (
            <>
              <Text style={styles.modalTitle}>Diário de Bordo</Text>
              <Text style={styles.modalSubtitle}>Preencha os dados finais da viagem.</Text>
              
              <Text style={styles.label}>Quilometragem Final (Painel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 55200"
                keyboardType="numeric"
                value={odometer}
                onChangeText={setOdometer}
              />

              <Text style={styles.label}>Observações (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Alguma avaria ou gasto extra?"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.startBtn} onPress={handleCameraCapture} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.white} /> : (
                    <>
                      <Text style={styles.startBtnText}>Fotografar Painel</Text>
                      <MaterialCommunityIcons name="camera" size={20} color={colors.white} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'confirm' && (
            <View style={styles.confirmContainer}>
              <MaterialCommunityIcons name="check-circle" size={60} color={colors.green} style={{marginBottom: 20}} />
              <Text style={styles.modalTitle}>Tudo Certo!</Text>
              <Text style={styles.modalSubtitle}>Foto capturada com sucesso. Suas coordenadas GPS serão anexadas a este fechamento para compliance.</Text>
              
              <TouchableOpacity style={[styles.startBtn, {width: '100%', marginTop: 20}]} onPress={submitClosing} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.white} /> : (
                  <>
                    <Text style={styles.startBtnText}>Finalizar Escala</Text>
                    <MaterialCommunityIcons name="cloud-upload" size={20} color={colors.white} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

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
    minHeight: 400,
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
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.graphite,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    color: colors.graphite,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
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
    backgroundColor: colors.red,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  startBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  }
});
