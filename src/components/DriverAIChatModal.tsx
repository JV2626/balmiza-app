import React, { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, addDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { callGeminiSecurely } from '../utils/geminiClient';
import { CustomAlert } from './CustomAlert';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  red: '#DF0A0A',
  background: '#F4F6F8',
  border: '#E5E7EB',
  chatBg: '#F9FAFB',
  aiBubble: '#E5E7EB',
  userBubble: '#1C1C1E',
  userText: '#FFFFFF',
  aiText: '#1C1C1E'
};

interface DriverAIChatModalProps {
  visible: boolean;
  onClose: () => void;
  driverEmail: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `Você é o Copiloto IA da Balmiza, um assistente virtual inteligente e prestativo para auxiliar motoristas de transporte executivo e corporativo da Balmiza (viagens de funcionários, traslados JBS e viagens longas/aeroportos).
Diretrizes e Regras Operacionais da Balmiza:
1. Viagens Longas e Aeroportos:
   - Recepção: No desembarque de aeroportos (Guarulhos, Congonhas, Viracopos), o motorista deve aguardar no local indicado com identificação Balmiza visível (tablet/placa).
   - Atendimento: Ajude sempre com as bagagens, abra as portas para os passageiros e certifique-se de que a temperatura do ar-condicionado e o som estão adequados ao gosto do cliente.
   - Comunicação: Reporte à central Balmiza no momento do embarque do passageiro e na chegada ao destino.
2. Imprevistos e Emergências na Estrada:
   - Pane Mecânica ou Pneu Furado: Pare o carro em local seguro, ligue o pisca-alerta, coloque o triângulo de sinalização a uma distância segura, certifique-se de que os passageiros estão seguros e acione imediatamente a central Balmiza para providenciar suporte ou veículo reserva.
   - Atrasos: Se notar trânsito pesado que causará atraso superior a 15 minutos, avise a central para que o cliente seja avisado com antecedência.
3. Postura e Conduta Geral:
   - Seja sempre cortês, profissional e calmo. Evite discussões sobre política, futebol ou religião com passageiros.
   - Suas respostas devem ser curtas, objetivas, práticas e fáceis de ler rapidamente no celular. Use listas e tópicos sempre que possível.
4. Solicitação de Reembolso Automatizada:
   - Se o motorista solicitar reembolso ou mencionar despesas de viagem (como pedágio, combustível, alimentação, etc.), ajude-o fazendo os cálculos corretos.
   - Você deve categorizar as despesas em: "pedagio", "combustivel", "alimentacao" ou "outros".
   - Você DEVE incluir no final da sua resposta a tag especial [[REEMBOLSO_ACTION:{"items": [{"category": "pedagio" | "combustivel" | "alimentacao" | "outros", "amount": number, "description": string}]}]].
   - Faça os cálculos matemáticos com precisão absoluta. Por exemplo, se disser "2 pedágios de 17 e 2 de 9", calcule 2*17 + 2*9 = 34 + 18 = 52.00.
   - Forneça a resposta em texto normal explicando o cálculo e, em seguida, anexe a tag [[REEMBOLSO_ACTION:...]] exatamente como especificado.

Por favor, responda de forma resumida e útil ao motorista na estrada.`;

const SUGGESTIONS = [
  'Pneu furou na estrada, o que fazer?',
  'Estou atrasado para o aeroporto.',
  'Como proceder no desembarque de Congonhas?',
  'Passageiro JBS não apareceu no ponto.'
];

export const DriverAIChatModal: React.FC<DriverAIChatModalProps> = ({ visible, onClose, driverEmail }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Olá, motorista! Sou o Copiloto IA da Balmiza. Como posso te ajudar hoje na sua viagem?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setLoading(true);

    try {
      // Monta o prompt incluindo as últimas mensagens para contexto
      const contextMessages = [...messages, newUserMessage].slice(-6); // Pega as últimas 6 mensagens
      const conversationHistory = contextMessages
        .map(m => `${m.sender === 'user' ? 'Motorista' : 'Copiloto'}: ${m.text}`)
        .join('\n');

      const fullPrompt = `${SYSTEM_PROMPT}\n\nHistórico da Conversa:\n${conversationHistory}\n\nCopiloto:`;
      const responseText = await callGeminiSecurely(fullPrompt);

      let cleanText = responseText;
      let actionData: any = null;

      const actionMatch = responseText.match(/\[\[REEMBOLSO_ACTION:([\s\S]*?)\]\]/);
      if (actionMatch) {
        try {
          actionData = JSON.parse(actionMatch[1].trim());
          cleanText = responseText.replace(/\[\[REEMBOLSO_ACTION:[\s\S]*?\]\]/g, '').trim();
        } catch (err) {
          console.error("Error parsing reembolso action JSON", err);
        }
      }

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: cleanText.trim() || 'Desculpe, não consegui processar a resposta.',
          timestamp: new Date()
        }
      ]);

      if (actionData && actionData.items && actionData.items.length > 0) {
        const items = actionData.items;
        const summaryLines = items.map((it: any) => {
          const catLabel = it.category === 'pedagio' ? 'Pedágio' :
                            it.category === 'combustivel' ? 'Combustível' :
                            it.category === 'alimentacao' ? 'Alimentação' : 'Outros';
          const formatted = it.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `• ${catLabel}: ${formatted} (${it.description})`;
        }).join('\n');

        setTimeout(() => {
          showCustomAlert(
            'Confirmar Reembolso via IA',
            `A IA identificou o seguinte pedido de reembolso:\n\n${summaryLines}\n\nDeseja registrar no sistema e abrir o WhatsApp para o financeiro?`,
            'info',
            async () => {
              try {
                const db = getFirebaseDb();
                const grouped: { [key: string]: { total: number; count: number; descriptions: string[]; label: string } } = {};
                let grandTotal = 0;

                for (const it of items) {
                  const catLabel = it.category === 'pedagio' ? 'Pedágio' :
                                    it.category === 'combustivel' ? 'Combustível' :
                                    it.category === 'alimentacao' ? 'Alimentação' : 'Outros';
                  
                  grandTotal += Number(it.amount);

                  // Save individual record to DB
                  await addDoc(collection(db, 'reembolsos'), {
                    motoristaId: driverEmail.toLowerCase(),
                    valor: Number(it.amount),
                    categoria: it.category,
                    categoriaLabel: catLabel,
                    descricao: it.description,
                    status: 'pendente',
                    createdAt: new Date()
                  });

                  if (!grouped[it.category]) {
                    grouped[it.category] = {
                      total: 0,
                      count: 0,
                      descriptions: [],
                      label: catLabel
                    };
                  }
                  grouped[it.category].total += Number(it.amount);
                  grouped[it.category].count += 1;
                  if (it.description) {
                    grouped[it.category].descriptions.push(it.description);
                  }
                }

                // Build concise grouped message
                let whatsMsg = `Olá, Balmiza Financeiro! Solicito reembolso de despesas (calculado via Copiloto IA):\n\n`;
                
                Object.keys(grouped).forEach(key => {
                  const g = grouped[key];
                  const formattedTotal = g.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  const descSummary = g.descriptions.length > 0 ? g.descriptions.join(', ') : 'Sem descrição';
                  whatsMsg += `• *${g.label}:* ${formattedTotal} (${g.count}x) - ${descSummary}\n`;
                });

                const formattedGrandTotal = grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                whatsMsg += `\n*Total das Despesas:* ${formattedGrandTotal}`;
                whatsMsg += `\n*Motorista:* ${driverEmail}`;

                const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsMsg)}`;
                Linking.openURL(whatsappUrl);
              } catch (e) {
                console.error("Error saving IA reembolso", e);
                showCustomAlert('Erro', 'Não foi possível salvar os reembolsos no banco de dados.', 'error');
              }
            }
          );
        }, 600);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Ops, tive um problema de conexão com a central. Verifique seu sinal de internet e tente novamente.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.pulseContainer}>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.title}>Copiloto Balmiza IA</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={28} color={colors.graphite} />
            </TouchableOpacity>
          </View>

          {/* Messages Area */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((item) => {
              const isUser = item.sender === 'user';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.aiRow
                  ]}
                >
                  {!isUser && (
                    <View style={styles.aiAvatar}>
                      <MaterialCommunityIcons name="robot" size={18} color={colors.white} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.userBubble : styles.aiBubble
                    ]}
                  >
                    <Text style={isUser ? styles.userText : styles.aiText}>
                      {item.text}
                    </Text>
                    <Text style={[styles.timeText, isUser ? styles.userTime : styles.aiTime]}>
                      {item.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}
            {loading && (
              <View style={[styles.messageRow, styles.aiRow]}>
                <View style={styles.aiAvatar}>
                  <MaterialCommunityIcons name="robot" size={18} color={colors.white} />
                </View>
                <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color={colors.graphite} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Suggestion Chips */}
          {messages.length === 1 && (
            <View style={styles.suggestionsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                {SUGGESTIONS.map((s, idx) => (
                  <TouchableOpacity key={idx} style={styles.suggestionChip} onPress={() => handleSend(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Digite sua dúvida ou emergência..."
              placeholderTextColor={colors.graphiteLight}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => handleSend(input)}
              disabled={!input.trim() || loading}
            >
              <MaterialCommunityIcons name="send" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMsg}
          type={alertType}
          onClose={() => setAlertVisible(false)}
          onConfirm={alertConfirmAction}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 10 : 30, marginBottom: 10, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseContainer: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(47, 133, 90, 0.2)', justifyContent: 'center', alignItems: 'center' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },
  title: { fontSize: 20, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  closeBtn: { padding: 5, backgroundColor: colors.white, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2 },
  chatArea: { flex: 1, backgroundColor: colors.chatBg },
  chatScrollContent: { paddingHorizontal: 20, paddingVertical: 15, gap: 15 },
  messageRow: { flexDirection: 'row', maxWidth: '85%', gap: 8 },
  userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  aiRow: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end', marginBottom: 2 },
  bubble: { padding: 12, borderRadius: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, flexShrink: 1 },
  userBubble: { backgroundColor: colors.userBubble, borderBottomRightRadius: 2 },
  aiBubble: { backgroundColor: colors.aiBubble, borderBottomLeftRadius: 2 },
  loadingBubble: { paddingHorizontal: 20, paddingVertical: 10 },
  userText: { fontSize: 16, color: colors.userText, lineHeight: 22, fontWeight: '500' },
  aiText: { fontSize: 16, color: colors.aiText, lineHeight: 22, fontWeight: '500' },
  timeText: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  userTime: { color: 'rgba(255, 255, 255, 0.6)' },
  aiTime: { color: colors.graphiteLight },
  suggestionsContainer: { paddingVertical: 10, backgroundColor: colors.chatBg, borderTopWidth: 1, borderTopColor: colors.border },
  suggestionsScroll: { paddingHorizontal: 20, gap: 10 },
  suggestionChip: { backgroundColor: colors.white, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 },
  suggestionText: { fontSize: 13, fontWeight: 'bold', color: colors.graphite },
  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', gap: 10, paddingBottom: Platform.OS === 'ios' ? 25 : 15 },
  input: { flex: 1, backgroundColor: colors.chatBg, borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10, maxHeight: 100, fontSize: 16, color: colors.graphite, fontWeight: '500' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: colors.red, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  sendBtnDisabled: { backgroundColor: colors.graphiteLight, shadowOpacity: 0, elevation: 0 }
});
