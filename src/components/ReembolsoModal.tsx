import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Platform, ScrollView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, addDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { CustomAlert } from './CustomAlert';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  red: '#DF0A0A',
  green: '#2F855A',
  border: '#E5E7EB',
  background: '#F4F6F8',
  inputBg: '#F9FAFB'
};

interface ReembolsoModalProps {
  visible: boolean;
  onClose: () => void;
  driverEmail: string;
}

const CATEGORIES = [
  { id: 'pedagio', label: 'Pedágio', icon: 'road' },
  { id: 'combustivel', label: 'Combustível', icon: 'gas-station' },
  { id: 'alimentacao', label: 'Alimentação', icon: 'food-fork-drink' },
  { id: 'outros', label: 'Outros', icon: 'dots-horizontal' }
];

export const ReembolsoModal: React.FC<ReembolsoModalProps> = ({ visible, onClose, driverEmail }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('pedagio');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  const showCustomAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertTitle(title);
    setAlertMsg(msg);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount.replace(',', '.'))) || Number(amount.replace(',', '.')) <= 0) {
      showCustomAlert('Atenção', 'Por favor, insira um valor válido maior que zero.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const db = getFirebaseDb();
      const finalAmount = Number(amount.replace(',', '.'));
      const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || category;

      // 1. Salvar no Firestore
      await addDoc(collection(db, 'reembolsos'), {
        motoristaId: driverEmail.toLowerCase(),
        valor: finalAmount,
        categoria: category,
        categoriaLabel: categoryLabel,
        descricao: description,
        status: 'pendente',
        createdAt: new Date()
      });

      // 2. Gerar mensagem para o WhatsApp
      const formattedAmount = finalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const message = `Olá, Balmiza Financeiro! Gostaria de solicitar o reembolso de despesa de viagem:\n\n*Tipo:* ${categoryLabel}\n*Valor:* ${formattedAmount}\n*Descrição:* ${description || 'Sem descrição adicional'}\n*Motorista:* ${driverEmail}\n\nPor favor, poderiam verificar? Obrigado!`;
      
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      
      setAmount('');
      setDescription('');
      setCategory('pedagio');
      
      showCustomAlert(
        'Sucesso',
        'Reembolso registrado no sistema! Deseja enviar a notificação pelo WhatsApp agora?',
        'success',
        () => {
          Linking.openURL(whatsappUrl);
          onClose();
        }
      );

      // If they cancel/close the success alert without confirming WhatsApp redirect, we still close the modal
      setAlertConfirmAction(() => () => {
        Linking.openURL(whatsappUrl);
        onClose();
      });

    } catch (e) {
      console.error(e);
      showCustomAlert('Erro', 'Não foi possível registrar o reembolso no banco de dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Solicitar Reembolso</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={28} color={colors.graphite} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.form}>
            
            <Text style={styles.label}>Valor (R$)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Ex: 50.00"
              placeholderTextColor={colors.graphiteLight}
            />

            <Text style={styles.label}>Categoria da Despesa</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <MaterialCommunityIcons 
                      name={cat.icon as any} 
                      size={26} 
                      color={isSelected ? colors.white : colors.graphite} 
                    />
                    <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Descrição / Justificativa</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Ex: Pedágio na Rodovia Castelo Branco ida e volta..."
              placeholderTextColor={colors.graphiteLight}
            />
          </View>
        </ScrollView>

        <TouchableOpacity 
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]} 
          onPress={handleSave} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="whatsapp" size={24} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>REGISTRAR E ENVIAR</Text>
            </>
          )}
        </TouchableOpacity>
        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMsg}
          type={alertType}
          onClose={() => setAlertVisible(false)}
          onConfirm={alertConfirmAction}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 0 : 30, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  closeBtn: { padding: 5, backgroundColor: colors.white, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2 },
  form: { gap: 18 },
  label: { fontSize: 16, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase', marginBottom: 4 },
  input: { 
    backgroundColor: colors.white, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    padding: 15, 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: colors.graphite,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2
  },
  categoryCardSelected: {
    backgroundColor: colors.red,
    borderColor: colors.red
  },
  categoryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.graphite
  },
  categoryTextSelected: {
    color: colors.white
  },
  saveBtn: { 
    flexDirection: 'row',
    backgroundColor: colors.green, 
    height: 58, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: colors.green, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 5, 
    elevation: 4, 
    marginBottom: Platform.OS === 'ios' ? 25 : 15
  },
  saveBtnDisabled: {
    backgroundColor: colors.graphiteLight
  },
  saveBtnText: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' }
});
