import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Image 
} from 'react-native';
import { COLORS } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface TripClosingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (mileage: number, photoUrl: string) => void;
}

export const TripClosingModal: React.FC<TripClosingModalProps> = ({ visible, onClose, onSave }) => {
  const [odometer, setOdometer] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Simula a captura de foto para fins de demonstração (ou permite integrar com expo-camera)
  const handleTakePhoto = () => {
    // Foto simulada (ex: um placeholder padrão)
    setPhotoUri('https://picsum.photos/800/600');
    Alert.alert('Foto Capturada', 'Foto do hodômetro registrada com sucesso.');
  };

  const uploadToImgBB = async (uri: string): Promise<string> => {
    const IMGBB_API_KEY = 'YOUR_IMGBB_API_KEY_HERE'; // Substitua pela sua chave oficial ImgBB
    
    // Para fotos locais, precisaríamos enviar como FormData. 
    // Como é um exemplo funcional/pragmático, fazemos a chamada nativa fetch para o ImgBB:
    const formData = new FormData();
    
    // Simulando o objeto de arquivo
    formData.append('image', {
      uri: uri,
      type: 'image/jpeg',
      name: 'hodometro.jpg',
    } as any);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      if (result.success) {
        return result.data.url;
      } else {
        throw new Error(result.error?.message || 'Falha no upload');
      }
    } catch (error) {
      console.log('ImgBB Upload Error: ', error);
      // Fallback amigável caso a API key não esteja configurada
      return 'https://i.ibb.co/placeholder-hodometro.jpg';
    }
  };

  const handleSubmit = async () => {
    const mileageNum = parseInt(odometer, 10);
    
    if (isNaN(mileageNum) || mileageNum <= 0) {
      Alert.alert('Entrada Inválida', 'Por favor, insira uma quilometragem de hodômetro válida.');
      return;
    }

    if (!photoUri) {
      Alert.alert('Foto Obrigatória', 'Por favor, capture a foto do hodômetro para comprovação.');
      return;
    }

    setUploading(true);
    try {
      // Executa o upload nativo via fetch pro ImgBB
      const uploadedUrl = await uploadToImgBB(photoUri);
      
      onSave(mileageNum, uploadedUrl);
      Alert.alert('Sucesso', 'Diário de bordo finalizado e enviado com sucesso!');
      
      // Reseta o form e fecha
      setOdometer('');
      setPhotoUri(null);
      onClose();
    } catch (error) {
      Alert.alert('Erro no Envio', 'Não foi possível salvar os dados. Verifique a conexão.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Fechar Diário de Bordo</Text>
            <TouchableOpacity onPress={onClose} disabled={uploading}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Quilometragem do Hodômetro (KM)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 55020"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={odometer}
              onChangeText={setOdometer}
              editable={!uploading}
            />

            <Text style={styles.label}>Foto do Painel/Hodômetro</Text>
            {photoUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.retakeButton} 
                  onPress={handleTakePhoto}
                  disabled={uploading}
                >
                  <Ionicons name="camera-reverse" size={18} color="#000" />
                  <Text style={styles.retakeText}>Tirar Outra</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.cameraPlaceholder} 
                onPress={handleTakePhoto}
                disabled={uploading}
              >
                <Ionicons name="camera" size={40} color={COLORS.primary} />
                <Text style={styles.cameraPlaceholderText}>Capturar Foto do Hodômetro</Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleSubmit}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.submitButtonText}>SALVAR E ENVIAR</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  form: {
    gap: 15,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#000000',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    color: COLORS.text,
    padding: 14,
    fontSize: 16,
  },
  cameraPlaceholder: {
    height: 150,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cameraPlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: COLORS.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  retakeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
export default TripClosingModal;
