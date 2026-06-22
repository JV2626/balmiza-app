import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFirebaseDb } from '../../config/firebase';
import { callGeminiSecurely } from '../../utils/geminiClient';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  border: '#E5E7EB',
  background: '#F4F6F8',
  chatUser: '#DF0A0A',
  chatBot: '#E5E7EB'
};

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  createdAt: Date;
};

// Componente animador elástico para balões de chat
const AnimatedMessageBubble = ({ children, style }: any) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 55,
        friction: 7.5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {children}
    </Animated.View>
  );
};

const PulsingIndicator = () => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.loadingContainer, { opacity: pulseAnim }]}>
      <ActivityIndicator size="small" color="#DF0A0A" />
      <Text style={styles.loadingText}>IA processando...</Text>
    </Animated.View>
  );
};

export const AIAssistantTab = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Olá! Sou o Assistente IA da Balmiza. Posso ajudar você a tirar dúvidas sobre o SaaS, gerenciar motoristas, veículos ou planejar novas rotas. O que deseja fazer hoje?',
      createdAt: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState<any>({
    funcionarios: [],
    motoristas: [],
    veiculos: [],
    locais: [],
    viagens: []
  });

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadDatabaseContext();
  }, []);

  const loadDatabaseContext = async () => {
    try {
      const db = getFirebaseDb();
      
      const empSnap = await getDocs(collection(db, 'funcionarios'));
      const employees = empSnap.docs.map(d => ({ nome: d.data().nome, setor: d.data().setor || 'Geral' }));

      const uSnap = await getDocs(collection(db, 'usuarios'));
      const drivers = uSnap.docs
        .map(d => ({ email: d.id, ...(d.data() as any) }))
        .filter(u => u.role === 'driver' || u.role === 'motorista')
        .map(u => ({ nome: u.nome || u.email.split('@')[0].toUpperCase(), email: u.email, veiculo: u.veiculoAlocado || 'Nenhum' }));

      const vSnap = await getDocs(collection(db, 'veiculos'));
      const vehicles = vSnap.docs.map(d => ({ placa: d.data().placa, modelo: d.data().modelo, ativo: d.data().ativo }));

      const favSnap = await getDocs(collection(db, 'locais_favoritos'));
      const locations = favSnap.docs.map(d => ({ nome: d.data().nome }));

      const tSnap = await getDocs(collection(db, 'viagens'));
      const trips = tSnap.docs.map(d => ({ 
        motorista: d.data().motoristaNome || d.data().motoristaId, 
        carro: d.data().carroPlaca, 
        destino: d.data().destino,
        status: d.data().status 
      }));

      setDbInfo({
        funcionarios: employees,
        motoristas: drivers,
        veiculos: vehicles,
        locais: locations,
        viagens: trips
      });
    } catch (e) {
      console.log('Error loading context for AI', e);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsgText = inputText.trim();
    setInputText('');
    
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Auto scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const systemInstruction = `
        Você é o "Assistente IA Balmiza", o chatbot inteligente oficial do aplicativo Balmiza Transportes.
        Seu papel é ajudar o administrador da central de despacho a operar o sistema, resumir dados e responder perguntas.

        Aqui está o contexto em tempo real do banco de dados (Firestore) da Balmiza:
        - Motoristas Cadastrados (Equipe de Condutores): ${JSON.stringify(dbInfo.motoristas)}
        - Funcionários da JBS Cadastrados (Passageiros de Transporte): ${JSON.stringify(dbInfo.funcionarios)}
        - Veículos cadastrados: ${JSON.stringify(dbInfo.veiculos)}
        - Locais Favoritos (Pontos de Coleta/CDA/JBS): ${JSON.stringify(dbInfo.locais)}
        - Viagens atuais (ativas/pendentes): ${JSON.stringify(dbInfo.viagens)}

        Instruções Críticas de Comportamento e Resposta:
        1. **DIferença Crucial entre Motoristas e Funcionários**: 
           - **Motoristas (Equipe de Condutores)** são quem dirigem os veículos (estão na lista de 'motoristas').
           - **Funcionários (Passageiros)** são as pessoas que são transportadas nos turnos da JBS (estão na lista de 'funcionarios'). 
           - Se o usuário perguntar sobre motoristas, utilize APENAS a lista de 'motoristas'. NUNCA misture ou confunda com a lista de 'funcionarios'.
        2. **Organização Visual**:
           - Responda sempre em português (pt-BR).
           - Organize os dados em listas com marcadores limpos ou use tabelas em markdown para listar motoristas e veículos.
           - Nunca crie parágrafos gigantescos e bagunçados; use negrito e formatação organizada para que a leitura no app seja agradável.
        3. Se o usuário perguntar como usar o aplicativo:
           - Aba "Painel": Mostra as estatísticas e gráficos modernos de custo, KM rodados e revisões dos carros.
           - Aba "Ativas": Exibe as viagens em andamento iniciadas pelos motoristas.
           - Aba "Despacho IA": Onde ele pode preencher novas escalas manualmente ou carregar imagens de folhas de rota da JBS para ler com IA.
           - Aba "Avarias": Onde os motoristas reportam problemas de carro (como pneu furado, amassado, etc.).
           - Aba "Ajustes": Onde o admin gerencia veículos, motoristas e cadastra novos locais de interesse.
      `;

      // Conversação simples - enviando histórico recente para manter o contexto
      const recentChat = messages
        .slice(-6)
        .map(m => `${m.sender === 'user' ? 'Usuário' : 'IA'}: ${m.text}`)
        .join('\n');

      const fullPrompt = `${systemInstruction}\n\nHistórico Recente:\n${recentChat}\n\nUsuário: ${userMsgText}\nIA:`;

      const responseText = await callGeminiSecurely(fullPrompt);
      const replyText = responseText || 'Não consegui formular uma resposta. Tente novamente.';

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: replyText,
        createdAt: new Date()
      }]);
    } catch (e) {
      console.log('Error calling Gemini on Chat', e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: 'Desculpe, ocorreu um erro ao processar sua pergunta. Verifique sua conexão com o banco de dados e a cota do Gemini.',
        createdAt: new Date()
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderFormattedText = (text: string, isUser: boolean) => {
    const textColor = isUser ? colors.white : colors.graphite;
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
      let cleanLine = line.trim();
      if (!cleanLine) {
        return <View key={lineIdx} style={{ height: 6 }} />;
      }
      
      let isListItem = false;
      let listMarker = '';
      let isHeading = false;
      let headingLevel = 0;
      
      // Detect Headers
      if (cleanLine.startsWith('# ')) {
        isHeading = true;
        headingLevel = 1;
        cleanLine = cleanLine.substring(2);
      } else if (cleanLine.startsWith('## ')) {
        isHeading = true;
        headingLevel = 2;
        cleanLine = cleanLine.substring(3);
      } else if (cleanLine.startsWith('### ')) {
        isHeading = true;
        headingLevel = 3;
        cleanLine = cleanLine.substring(4);
      }
      
      // Detect Bullet Lists
      if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ') || cleanLine.startsWith('• ')) {
        isListItem = true;
        listMarker = '•';
        cleanLine = cleanLine.substring(2);
      } 
      // Detect Numbered Lists
      else {
        const numListMatch = cleanLine.match(/^(\d+)\.\s+/);
        if (numListMatch) {
          isListItem = true;
          listMarker = `${numListMatch[1]}.`;
          cleanLine = cleanLine.substring(numListMatch[0].length);
        }
      }
      
      // Divide the line in bold blocks (**)
      const parts = cleanLine.split('**');
      const renderedTextElements = parts.map((part, partIdx) => {
        const isBold = partIdx % 2 !== 0;
        return (
          <Text 
            key={partIdx} 
            style={{ 
              fontWeight: isHeading ? '900' : (isBold ? 'bold' : 'normal'),
              color: textColor,
              fontSize: isHeading 
                ? (headingLevel === 1 ? 19 : headingLevel === 2 ? 17 : 15) 
                : 15
            }}
          >
            {part}
          </Text>
        );
      });

      return (
        <View 
          key={lineIdx} 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'flex-start', 
            marginVertical: isHeading ? 6 : 2, 
            paddingLeft: isListItem ? 8 : 0,
            flexWrap: 'wrap' 
          }}
        >
          {isListItem && (
            <Text 
              style={{ 
                marginRight: 6, 
                color: isUser ? colors.white : '#DF0A0A', 
                fontSize: 15, 
                fontWeight: 'bold' 
              }}
            >
              {listMarker}
            </Text>
          )}
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: textColor }}>
            {renderedTextElements}
          </Text>
        </View>
      );
    });
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageContainer, isUser ? styles.userAlign : styles.botAlign]}>
        {!isUser && (
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="robot" size={18} color={colors.white} />
          </View>
        )}
        <AnimatedMessageBubble style={[
          styles.bubble, 
          isUser ? styles.userBubble : styles.botBubble
        ]}>
          <View style={{ flexShrink: 1 }}>
            {renderFormattedText(item.text, isUser)}
          </View>
        </AnimatedMessageBubble>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons name="robot-happy" size={28} color="#DF0A0A" />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.title}>Assistente IA</Text>
          <Text style={styles.subtitle}>Inteligência de Operações Balmiza</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && <PulsingIndicator />}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Pergunte sobre motoristas, frotas, rotas..."
          placeholderTextColor={colors.graphiteLight}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={loading}>
          <MaterialCommunityIcons name="send" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2 },
  title: { fontSize: 20, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  subtitle: { fontSize: 12, fontWeight: 'bold', color: colors.graphiteLight },
  listContent: { padding: 20, paddingBottom: 30 },
  messageContainer: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end', maxWidth: '80%', flexShrink: 1 },
  userAlign: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  botAlign: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DF0A0A', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  bubble: { padding: 12, borderRadius: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, flexShrink: 1 },
  userBubble: { backgroundColor: colors.chatUser, borderBottomRightRadius: 2 },
  botBubble: { backgroundColor: colors.chatBot, borderBottomLeftRadius: 2 },
  messageText: { fontSize: 15, fontWeight: '600', lineHeight: 20, flexShrink: 1, flexWrap: 'wrap' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  loadingText: { fontSize: 12, color: colors.graphiteLight, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', gap: 10 },
  input: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 18, height: 48, fontSize: 16, color: colors.graphite, fontWeight: 'bold' },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#DF0A0A', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2 }
});
