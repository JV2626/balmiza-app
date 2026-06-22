import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PIN_STORAGE_KEY = '@balmiza_pin';
const ATTEMPTS_KEY = '@balmiza_pin_attempts';
const LOCKOUT_TIME_KEY = '@balmiza_pin_lockout';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 1000; // 30 segundos

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  red: '#DF0A0A',
  green: '#2F855A',
  border: '#E5E7EB',
  background: '#F4F6F8',
};

// Função simples e determinística de Hash com Salt (sem dependências externas)
const PIN_SALT = "BalmizaSecurePinSalt_2026";
const hashPin = (pin: string): string => {
  const combined = pin + PIN_SALT;
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

interface PinInputProps {
  visible: boolean;
  mode: 'create' | 'verify';
  onSuccess: () => void;
  onCancel?: () => void;
}

export const PinInput = ({ visible, mode, onSuccess, onCancel }: PinInputProps) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Verificar status de bloqueio (lockout) quando o modal for aberto ou montado
  useEffect(() => {
    if (visible) {
      checkLockoutStatus();
    }
  }, [visible]);

  // Timer para contagem regressiva do lockout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutSeconds > 0) {
      timer = setTimeout(() => {
        setLockoutSeconds(s => s - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  const checkLockoutStatus = async () => {
    try {
      const lockoutStr = await AsyncStorage.getItem(LOCKOUT_TIME_KEY);
      if (lockoutStr) {
        const lockoutTimestamp = parseInt(lockoutStr, 10);
        const now = Date.now();
        if (now < lockoutTimestamp) {
          const secondsLeft = Math.ceil((lockoutTimestamp - now) / 1000);
          setLockoutSeconds(secondsLeft);
        } else {
          // Limpar lockout se o tempo já passou
          await AsyncStorage.removeItem(LOCKOUT_TIME_KEY);
          await AsyncStorage.setItem(ATTEMPTS_KEY, '0');
          setLockoutSeconds(0);
        }
      }
    } catch (e) {
      console.log('Erro ao checar status de lockout:', e);
    }
  };

  const handleKeyPress = async (key: string) => {
    if (lockoutSeconds > 0) {
      Alert.alert('PIN Bloqueado', `Muitas tentativas incorretas. Tente novamente em ${lockoutSeconds} segundos.`);
      return;
    }

    if (mode === 'verify') {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 4) {
        try {
          const stored = await AsyncStorage.getItem(PIN_STORAGE_KEY);
          const hashedInput = hashPin(newPin);
          
          let isValid = false;
          if (stored) {
            // Suporte a migração automática de PIN antigo em texto plano de 4 dígitos
            if (stored.length === 4 && /^\d+$/.test(stored)) {
              if (stored === newPin) {
                isValid = true;
                // Salvar de forma hashada a partir de agora
                await AsyncStorage.setItem(PIN_STORAGE_KEY, hashedInput);
              }
            } else {
              isValid = (stored === hashedInput);
            }
          }

          if (isValid) {
            setPin('');
            // Resetar tentativas incorretas no sucesso
            await AsyncStorage.setItem(ATTEMPTS_KEY, '0');
            await AsyncStorage.removeItem(LOCKOUT_TIME_KEY);
            onSuccess();
          } else {
            setPin('');
            // Incrementar contador de erros
            const currentAttemptsStr = await AsyncStorage.getItem(ATTEMPTS_KEY) || '0';
            const newAttempts = parseInt(currentAttemptsStr, 10) + 1;
            
            if (newAttempts >= MAX_ATTEMPTS) {
              const lockoutUntil = Date.now() + LOCKOUT_DURATION;
              await AsyncStorage.setItem(LOCKOUT_TIME_KEY, lockoutUntil.toString());
              await AsyncStorage.setItem(ATTEMPTS_KEY, '0');
              setLockoutSeconds(30);
              Alert.alert('Tentativas Excedidas', 'Muitas tentativas incorretas. PIN bloqueado por 30 segundos.');
            } else {
              await AsyncStorage.setItem(ATTEMPTS_KEY, newAttempts.toString());
              Alert.alert('PIN Incorreto', `Tente novamente. (${newAttempts}/${MAX_ATTEMPTS} tentativas)`);
            }
          }
        } catch (err) {
          console.log('Erro ao validar PIN:', err);
        }
      }
      return;
    }

    // mode === 'create'
    if (step === 'enter') {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === 4) {
        setStep('confirm');
      }
    } else {
      const newConfirm = confirmPin + key;
      setConfirmPin(newConfirm);
      if (newConfirm.length === 4) {
        if (newConfirm === pin) {
          try {
            const hashedPin = hashPin(newConfirm);
            await AsyncStorage.setItem(PIN_STORAGE_KEY, hashedPin);
            setPin('');
            setConfirmPin('');
            setStep('enter');
            onSuccess();
          } catch (err) {
            console.log('Erro ao salvar PIN:', err);
          }
        } else {
          Alert.alert('PINs não coincidem', 'Tente novamente.');
          setPin('');
          setConfirmPin('');
          setStep('enter');
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setPin(p => p.slice(0, -1));
    } else {
      setConfirmPin(p => p.slice(0, -1));
    }
  };

  const currentLength = step === 'enter' ? pin.length : confirmPin.length;

  const title = lockoutSeconds > 0
    ? `Tente em ${lockoutSeconds}s`
    : mode === 'verify'
      ? 'Digite seu PIN'
      : step === 'enter' ? 'Crie um PIN de 4 dígitos' : 'Confirme seu PIN';

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialCommunityIcons 
            name={lockoutSeconds > 0 ? "lock-clock" : "lock-outline"} 
            size={40} 
            color={colors.red} 
          />
          <Text style={styles.title}>{title}</Text>

          <View style={styles.dots}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.dot, i < currentLength && styles.dotFilled]} />
            ))}
          </View>

          {keys.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((key, ki) => (
                key === '' ? (
                  <View key={ki} style={styles.emptyKey} />
                ) : key === 'del' ? (
                  <TouchableOpacity key={ki} style={styles.key} onPress={handleDelete}>
                    <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.graphite} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    key={ki} 
                    style={[styles.key, lockoutSeconds > 0 && styles.keyDisabled]} 
                    onPress={() => handleKeyPress(key)}
                    disabled={lockoutSeconds > 0}
                  >
                    <Text style={[styles.keyText, lockoutSeconds > 0 && styles.keyTextDisabled]}>{key}</Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
          ))}

          {onCancel && (
            <TouchableOpacity onPress={onCancel} style={{ marginTop: 20 }}>
              <Text style={{ color: colors.graphiteLight, fontWeight: 'bold' }}>
                {mode === 'verify' ? 'Usar email e senha' : 'Cancelar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

export const hasPinSet = async (): Promise<boolean> => {
  const pin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
  return !!pin;
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 32, alignItems: 'center', width: 320, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
  title: { fontSize: 18, fontWeight: '900', color: colors.graphite, marginTop: 12, marginBottom: 24, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.red, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: colors.red },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  key: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  keyDisabled: { backgroundColor: '#E5E7EB', borderColor: '#E5E7EB' },
  emptyKey: { width: 72, height: 72 },
  keyText: { fontSize: 24, fontWeight: '700', color: colors.graphite },
  keyTextDisabled: { color: '#9CA3AF' },
});
