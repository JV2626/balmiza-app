import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

export const RealTimeAlerts = () => {
  useEffect(() => {
    const db = getFirebaseDb();
    const initTime = Date.now();

    // 1. Escuta por novas avarias
    const qAvarias = query(
      collection(db, 'avarias'),
      orderBy('data', 'desc'),
      limit(3)
    );

    const unsubAvarias = onSnapshot(qAvarias, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const reportTime = data.data ? new Date(data.data).getTime() : 0;
          // Verifica se foi criado após a inicialização da tela
          if (reportTime > initTime) {
            const motorista = data.motoristaEmail?.split('@')[0]?.toUpperCase() || 'Motorista';
            const placa = data.veiculoPlaca || '';
            const desc = data.descricao || 'Sem descrição';
            const msg = `O motorista ${motorista} reportou uma nova avaria no veículo ${placa}.\nDescrição: ${desc}`;
            
            if (Platform.OS === 'web') {
              if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
                new window.Notification('⚠️ Nova Avaria Cadastrada', {
                  body: `Veículo: ${placa}\nMotorista: ${motorista}\nDescrição: ${desc}`
                });
              } else {
                window.alert(`⚠️ [NOVA AVARIA] Veículo ${placa} - Motorista: ${motorista}.\nDescrição: ${desc}`);
              }
            } else {
              Alert.alert('⚠️ Nova Avaria Cadastrada', msg);
            }
          }
        }
      });
    });

    // 2. Escuta por novas viagens/atualizações
    const qViagens = query(
      collection(db, 'viagens'),
      orderBy('horaInicio', 'desc'),
      limit(3)
    );

    const unsubViagens = onSnapshot(qViagens, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        // Verifica se a viagem foi iniciada nesta sessão de monitoramento
        const tripStartTime = data.horaInicio ? new Date(data.horaInicio).getTime() : 0;
        if (tripStartTime > initTime) {
          const motorista = data.motoristaEmail?.split('@')[0]?.toUpperCase() || 'Motorista';
          const placa = data.carroPlaca || '';
          
          if (change.type === 'added') {
            const msg = `O motorista ${motorista} acabou de INICIAR a viagem com o veículo ${placa}.`;
            if (Platform.OS === 'web') {
              if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
                new window.Notification('🚗 Rota Iniciada', {
                  body: `Motorista: ${motorista} - Veículo: ${placa}`
                });
              } else {
                window.alert(`🚗 [VIAGEM INICIADA] Motorista: ${motorista} - Veículo: ${placa}`);
              }
            } else {
              Alert.alert('🚗 Rota Iniciada', msg);
            }
          }
        }
      });
    });

    return () => {
      unsubAvarias();
      unsubViagens();
    };
  }, []);

  return null;
};
