import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, Platform } from 'react-native';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getFirebaseDb } from '../config/firebase';
import { sendPushNotification } from '../utils/pushNotification';
import { optimizeRoute } from '../utils/routeOptimizer';
import { callGeminiSecurely } from '../utils/geminiClient';
import { geocodeAddress } from '../utils/geocoding';
import { CustomAlert } from '../components/CustomAlert';

const colors = {
  white: '#FFFFFF',
  graphite: '#1C1C1E',
  graphiteLight: '#6B7280',
  green: '#2F855A',
  red: '#E53E3E',
  border: '#E5E7EB',
  background: '#F4F6F8'
};

type Passenger = {
  nome: string;
  endereco: string;
  setor: string;
  horarioEntrada: string;
  horarioSaida: string;
  status: string;
  latitude?: number;
  longitude?: number;
  isNew?: boolean;
};

const CompactDropdown = ({
  label,
  value,
  options,
  onSelect
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onSelect: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <View style={{ marginBottom: 6, zIndex: 10 }}>
      <TouchableOpacity 
        style={styles.dropdownHeader} 
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownValue} numberOfLines={1}>
          {selectedOption ? selectedOption.label : `Selecionar ${label}...`}
        </Text>
        <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.graphite} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdownListInline}>
          {options.map(opt => (
            <TouchableOpacity 
              key={opt.value} 
              style={[styles.dropdownItem, value === opt.value && styles.dropdownItemActive]} 
              onPress={() => {
                onSelect(opt.value);
                setIsOpen(false);
              }}
            >
              <Text style={[styles.dropdownItemText, value === opt.value && { color: colors.white }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export const AdminDispatchScreen = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingAi, setProcessingAi] = useState(false);

  // Custom Alert States
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [alertConfirmAction, setAlertConfirmAction] = useState<(() => void) | undefined>(undefined);

  const showAlert = (title: string, message: string, typeParam?: 'success' | 'error' | 'warning' | 'info', onConfirm?: () => void) => {
    let type: 'success' | 'error' | 'warning' | 'info' = 'info';
    if (typeParam) {
      type = typeParam;
    } else {
      const t = title.toLowerCase();
      if (t.includes('sucesso') || t.includes('adicionado')) type = 'success';
      else if (t.includes('erro') || t.includes('falha')) type = 'error';
      else if (t.includes('atenção') || t.includes('aviso')) type = 'warning';
    }
    
    setAlertTitle(title);
    setAlertMsg(message);
    setAlertType(type);
    setAlertConfirmAction(onConfirm ? () => onConfirm : undefined);
    setAlertVisible(true);
  };
  
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  });
  const [destino, setDestino] = useState('Casa X JBS');
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [favoritesList, setFavoritesList] = useState<any[]>([]);
  const [showSuggestionsForIndex, setShowSuggestionsForIndex] = useState<number | null>(null);
  const [aiDraftText, setAiDraftText] = useState('');
  const [processingAiDraft, setProcessingAiDraft] = useState(false);
  const [multiScales, setMultiScales] = useState<any[]>([]);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);


  useEffect(() => {
    fetchVehicles();
    fetchDriversAndWorkloads();
    fetchEmployees();
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'locais_favoritos'));
      setFavoritesList(snap.docs.map(d => ({ id: d.id, ...d.data() as any })));
    } catch (e) {
      console.log('Error fetching favorites', e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'funcionarios'));
      setEmployeesList(snap.docs.map(d => ({ id: d.id, ...d.data() as any })));
    } catch (e) {
      console.log('Error fetching employees', e);
    }
  };

  const fetchDriversAndWorkloads = async () => {
    try {
      const db = getFirebaseDb();
      const uSnap = await getDocs(collection(db, 'usuarios'));
      const allDrivers = uSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(u => u.role === 'driver' || u.role === 'motorista');

      const tSnap = await getDocs(query(collection(db, 'viagens'), where('status', 'in', ['pending', 'active'])));
      const activeTrips = tSnap.docs.map(d => d.data());

      const driversWithLoad = allDrivers.map((d: any) => {
        const count = activeTrips.filter((t: any) => t.motoristaId === d.email?.toLowerCase()).length;
        return { ...d, activeTripsCount: count };
      });

      driversWithLoad.sort((a: any, b: any) => a.activeTripsCount - b.activeTripsCount);
      setDrivers(driversWithLoad);
      
      if (driversWithLoad.length > 0) {
        setDriverEmail(driversWithLoad[0].email);
        if (driversWithLoad[0].veiculoAlocado) {
          setSelectedVehicle(driversWithLoad[0].veiculoAlocado);
        }
      }
    } catch (e) {
      console.log('Error fetching drivers', e);
    }
  };

  const selectDriver = (driver: any) => {
    setDriverEmail(driver.email);
    if (driver.veiculoAlocado) {
      setSelectedVehicle(driver.veiculoAlocado);
    }
  };

  const fetchVehicles = async () => {
    try {
      const db = getFirebaseDb();
      const q = query(collection(db, 'veiculos'), where('ativo', '==', true));
      const snap = await getDocs(q);
      const veics = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(veics);
    } catch (e) {
      console.log('Error fetching vehicles', e);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setProcessingAi(true);
    try {
      const responseFile = await fetch(uri);
      const blob = await responseFile.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(',')[1];
        runGeminiOnImage(base64data);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.log('Error preparing image', e);
      setProcessingAi(false);
    }
  };

  const runGeminiOnImage = async (base64Image: string) => {
    setProcessingAi(true);
    try {
      const prompt = `
        Analise esta folha de requisição de transporte. Extraia os seguintes dados e retorne EXATAMENTE neste formato JSON, sem marcação markdown:
        {
          "data": "DD/MM/YYYY",
          "setorRequisicao": "Setor escrito na parte superior direita (ex: FABRICA DE RAÇOES)",
          "destino": "Destino escrito na parte central (ex: Casa X JBS ou JBS X Casa)",
          "passageiros": [
            { "nome": "Nome do Funcionario", "endereco": "Endereço (se houver)", "setor": "Setor (se houver)", "horarioEntrada": "HH:MM", "horarioSaida": "HH:MM" }
          ]
        }
        Se não encontrar um dado, deixe string vazia "".
      `;

      const responseText = await callGeminiSecurely(prompt, base64Image, 'image/jpeg');
      let jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const data = JSON.parse(jsonText);
      setDate(data.data || '');
      setDestino(data.destino || 'Casa X JBS');
      
      const db = getFirebaseDb();
      const funcSnap = await getDocs(collection(db, 'funcionarios'));
      const dbFuncs = funcSnap.docs.map(d => ({ id: d.id, ...d.data() as any, type: 'Funcionário' }));

      const favSnap = await getDocs(collection(db, 'locais_favoritos'));
      const dbFavs = favSnap.docs.map(d => ({ id: d.id, ...d.data() as any, type: 'Local Favorito' }));

      const dbItems = [...dbFuncs, ...dbFavs];
      
      const enhancedPassengers = data.passageiros.map((p: any) => {
        const found = dbItems.find(item => 
          item.nome.toLowerCase().includes(p.nome.toLowerCase().split(' ')[0]) ||
          p.nome.toLowerCase().includes(item.nome.toLowerCase().split(' ')[0])
        );
        return {
          nome: found ? found.nome : p.nome,
          endereco: found ? found.endereco : (p.endereco || ''),
          setor: found ? (found.setor || p.setor || '') : (p.setor || data.setorRequisicao || ''),
          horarioEntrada: p.horarioEntrada || '08:00',
          horarioSaida: p.horarioSaida || '09:00',
          latitude: found && found.latitude ? found.latitude : 0,
          longitude: found && found.longitude ? found.longitude : 0,
          status: 'pendente',
          isNew: !found
        };
      });
      
      setPassengers(enhancedPassengers);
      
    } catch (e) {
      console.log('Erro no Gemini', e);
      showAlert('Erro', 'Falha ao processar imagem com a Inteligência Artificial.');
    } finally {
      setProcessingAi(false);
    }
  };

  const saveScale = async (email: string, vehicle: string, dt: string, dest: string, pList: Passenger[]) => {
    if (!email || !vehicle || !dt || !dest || pList.length === 0) {
      throw new Error('Campos obrigatórios não preenchidos para motorista.');
    }
    const db = getFirebaseDb();
    
    let km = 0;
    const vSnap = await getDocs(query(collection(db, 'veiculos'), where('placa', '==', vehicle)));
    if (!vSnap.empty) {
      km = vSnap.docs[0].data().kmAtual || 0;
    }

    const companyCoords = { latitude: -23.3568, longitude: -47.8574 };
    let startPoint = { latitude: -23.3568, longitude: -47.8574 };

    const mappedPassengers = await Promise.all(pList.map(async (p, idx) => {
      let lat = p.latitude || 0;
      let lon = p.longitude || 0;

      if (lat === 0 || lon === 0) {
        const addr = p.endereco ? p.endereco.trim() : '';
        let coords = null;
        if (addr) {
          coords = await geocodeAddress(addr);
        }
        if (coords) {
          lat = coords.latitude;
          lon = coords.longitude;
        } else {
          lat = companyCoords.latitude + (idx + 1) * 0.005;
          lon = companyCoords.longitude + (idx + 1) * 0.005;
        }
      }

      return {
        nome: p.nome,
        endereco: p.endereco || 'Itapetininga, SP',
        setor: p.setor || '',
        horarioEntrada: p.horarioEntrada || '08:00',
        horarioSaida: p.horarioSaida || '08:10',
        status: 'pendente',
        latitude: lat,
        longitude: lon
      };
    }));

    const optimized = optimizeRoute(startPoint, mappedPassengers);

    await addDoc(collection(db, 'viagens'), {
      motoristaId: email.toLowerCase(),
      motoristaNome: email,
      carroPlaca: vehicle,
      kmInicial: km,
      kmFinal: 0,
      data: dt,
      destino: dest,
      horaInicio: '',
      horaFim: '',
      observacoes: '',
      fotoUrl: '',
      passageiros: optimized,
      status: 'pending',
      createdAt: new Date()
    });

    try {
      const driverDoc = await getDoc(doc(db, 'usuarios', email.toLowerCase()));
      if (driverDoc.exists()) {
        const driverData = driverDoc.data();
        if (driverData?.pushToken) {
          await sendPushNotification(
            driverData.pushToken,
            '🚗 Nova Escala Atribuída',
            `Veículo ${vehicle} para ${dt}. Acesse o app para ver detalhes.`,
            { screen: 'Home' }
          );
        }
      }
    } catch (e) {
      console.log('Push notification failed', e);
    }
  };

  const runGeminiDraft = async () => {
    if (!aiDraftText.trim()) {
      showAlert('Atenção', 'Digite o texto de instrução da escala para a IA rascunhar.');
      return;
    }

    setProcessingAiDraft(true);
    try {
      const today = new Date();
      const formattedToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      const systemPrompt = `
        Você é uma IA especializada em analisar texto operacional de despacho da Balmiza Transportes.
        A partir do texto colado pelo usuário, identifique se ele contém escalas para múltiplos motoristas ou para apenas um.
        Retorne SEMPRE um JSON estruturado no formato especificado, sem marcação markdown ou outras explicações adicionais.

        Informações do banco de dados para auxiliar no casamento (matching):
        - Lista de Motoristas (Emails e Nomes): ${JSON.stringify(drivers.map(d => ({ email: d.email, nome: d.nome })))}
        - Lista de Veículos (Placas e Modelos): ${JSON.stringify(vehicles.map(v => ({ placa: v.placa, modelo: v.modelo })))}
        - Lista de Passageiros/Funcionários Cadastrados: ${JSON.stringify(employeesList.map(e => e.nome))}
        - Lista de Locais Favoritos (CDA, JBS, etc.): ${JSON.stringify(favoritesList.map(f => f.nome))}

        REGRAS CRÍTICAS DE EXTRAÇÃO:
        1. **Divisão de Múltiplas Viagens**: Se um mesmo motorista possui múltiplos horários de viagem ou diferentes destinos no texto (ex: Regis tem viagens às 05:00, 05:40, 17:00, etc.), você DEVE criar **um item separado** no array "scales" para cada uma dessas viagens dele! NUNCA junte viagens de horários ou destinos diferentes de um mesmo motorista em uma única escala. Se ele fizer 6 viagens, devem existir 6 itens no array "scales".
        2. **Destino Exato**: O campo "destino" deve ser preenchido exatamente como "CASA/JBS" (se for sentido Casa para o trabalho/JBS) ou "JBS/CASA" (se for sentido Trabalho/JBS de volta para Casa). Use exatamente uma destas duas strings no formato maiúsculo.
        3. **Horários nas Paradas**: Para cada parada ("paradas"), o "horarioEntrada" deve ser o horário exato daquela viagem específica (ex: "05:00" para a viagem das 05:00h, "17:50" para a viagem das 17:50h). O "horarioSaida" deve ser 10 minutos após o entrada (ex: "05:10" ou "18:00"). Nunca retorne horários genéricos como "08:00".

        Se o texto contiver escalas de múltiplos motoristas (como Regis, Thiago, Bruno, Moisés, etc.), retorne no formato:
        {
          "isMulti": true,
          "scales": [
            {
              "motoristaNome": "Nome do motorista",
              "motoristaEmail": "Email correspondente encontrado na lista de motoristas, ou string vazia",
              "carroPlaca": "Placa do veículo correspondente encontrado na lista de veículos, ou string vazia",
              "data": "DD/MM/AAAA",
              "destino": "CASA/JBS ou JBS/CASA",
              "paradas": [
                {
                  "nome": "Nome exato da pessoa ou local citado no texto",
                  "setor": "Ação ou Setor (ex: PEGAR AMOSTRAS ou setor do funcionário se houver)",
                  "horarioEntrada": "HH:MM",
                  "horarioSaida": "HH:MM"
                }
              ]
            }
          ]
        }

        Se for para apenas um motorista, retorne o formato:
        {
          "isMulti": false,
          "data": "DD/MM/AAAA",
          "destino": "CASA/JBS ou JBS/CASA",
          "motoristaEmail": "Email correspondente",
          "carroPlaca": "Placa correspondente",
          "paradas": [
            {
              "nome": "Nome da pessoa ou local",
              "setor": "Ação ou Setor",
              "horarioEntrada": "HH:MM",
              "horarioSaida": "HH:MM"
            }
          ]
        }
      `;

      const dispatchSchema = {
        type: 'object',
        properties: {
          isMulti: { type: 'boolean' },
          data: { type: 'string', description: 'Data da viagem (DD/MM/AAAA)' },
          destino: { type: 'string', description: 'Destino ou sentido da viagem (ex: CASA/JBS ou JBS/CASA)' },
          motoristaEmail: { type: 'string', description: 'E-mail do motorista se for um motorista' },
          carroPlaca: { type: 'string', description: 'Placa do veículo' },
          scales: {
            type: 'array',
            description: 'Lista de escalas separadas por viagem',
            items: {
              type: 'object',
              properties: {
                motoristaNome: { type: 'string' },
                motoristaEmail: { type: 'string' },
                carroPlaca: { type: 'string' },
                data: { type: 'string' },
                destino: { type: 'string', description: 'CASA/JBS ou JBS/CASA' },
                paradas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nome: { type: 'string' },
                      setor: { type: 'string' },
                      horarioEntrada: { type: 'string', description: 'Horário de entrada da viagem (ex: 05:00)' },
                      horarioSaida: { type: 'string', description: 'Horário de saída da viagem (ex: 05:10)' }
                    },
                    required: ['nome']
                  }
                }
              },
              required: ['motoristaNome', 'paradas']
            }
          },
          paradas: {
            type: 'array',
            description: 'Lista de paradas se for um único motorista (isMulti = false)',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string' },
                setor: { type: 'string' },
                horarioEntrada: { type: 'string', description: 'Horário de entrada da viagem (ex: 05:00)' },
                horarioSaida: { type: 'string', description: 'Horário de saída da viagem (ex: 05:10)' }
              },
              required: ['nome']
            }
          }
        },
        required: ['isMulti']
      };

      const responseText = await callGeminiSecurely(
        `${systemPrompt}\n\nInstrução do Usuário:\n"${aiDraftText}"`,
        undefined,
        undefined,
        dispatchSchema
      );
      
      let jsonText = responseText.trim();
      const firstCurly = jsonText.indexOf('{');
      const lastCurly = jsonText.lastIndexOf('}');
      if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
        jsonText = jsonText.substring(firstCurly, lastCurly + 1);
      } else {
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      }
const data = JSON.parse(jsonText);

      const dbItems = [
        ...favoritesList.map(f => ({ ...f, isFavorite: true, type: 'Local' })),
        ...employeesList.map(e => ({ ...e, isEmployee: true, type: 'Funcionário' }))
      ];

      if (data.isMulti && Array.isArray(data.scales)) {
        const grouped: { [key: string]: any } = {};

        data.scales.forEach((sc: any) => {
          const key = (sc.motoristaEmail || sc.motoristaNome || 'DESCONHECIDO').toLowerCase();

          if (!grouped[key]) {
            let resolvedPlaca = sc.carroPlaca || '';
            if (!resolvedPlaca && sc.motoristaEmail) {
              const dr = drivers.find(d => d.email.toLowerCase() === sc.motoristaEmail.toLowerCase());
              if (dr && dr.veiculoAlocado) {
                resolvedPlaca = dr.veiculoAlocado;
              }
            }
            grouped[key] = {
              driverName: sc.motoristaNome || (sc.motoristaEmail ? sc.motoristaEmail.split('@')[0].toUpperCase() : 'DESCONHECIDO'),
              driverEmail: sc.motoristaEmail || '',
              carroPlaca: resolvedPlaca,
              date: sc.data || formattedToday,
              paradas: []
            };
          }

          const scDestino = sc.destino || 'CASA/JBS';
          const resolvedParadas = sc.paradas.map((p: any) => {
            const matched = dbItems.find(item => 
              item.nome.toLowerCase().includes(p.nome.toLowerCase().split(' ')[0]) || 
              p.nome.toLowerCase().includes(item.nome.toLowerCase().split(' ')[0])
            );
            return {
              nome: matched ? matched.nome : p.nome,
              endereco: matched ? matched.endereco : 'Itapetininga, SP',
              setor: p.setor || (matched ? matched.setor : ''),
              horarioEntrada: p.horarioEntrada || '08:00',
              horarioSaida: p.horarioSaida || '08:10',
              destino: p.destino || scDestino,
              latitude: matched && matched.latitude ? matched.latitude : 0,
              longitude: matched && matched.longitude ? matched.longitude : 0,
              status: 'pendente',
              isNew: !matched
            };
          });

          grouped[key].paradas.push(...resolvedParadas);
        });

        const resolvedScales = Object.keys(grouped).map((key, scIdx) => {
          const item = grouped[key];
          // Ordenar as paradas cronologicamente pelo horário de entrada
          item.paradas.sort((a: any, b: any) => a.horarioEntrada.localeCompare(b.horarioEntrada));

          return {
            id: `multi-${Date.now()}-${scIdx}`,
            ...item,
            launched: false
          };
        });

        setMultiScales(resolvedScales);
        showAlert('Sucesso', 'Múltiplas escalas rascunhadas! Revise a lista compacta abaixo.');
        setAiDraftText('');
      } else {
        setMultiScales([]);
        if (data.data) setDate(data.data);
        if (data.destino) setDestino(data.destino);
        
        if (data.motoristaEmail) {
          const foundDriver = drivers.find(d => d.email.toLowerCase() === data.motoristaEmail.toLowerCase());
          if (foundDriver) {
            setDriverEmail(foundDriver.email);
            if (foundDriver.veiculoAlocado) {
              setSelectedVehicle(foundDriver.veiculoAlocado);
            }
          }
        }

        if (data.carroPlaca) {
          const foundVeh = vehicles.find(v => v.placa.toUpperCase() === data.carroPlaca.toUpperCase());
          if (foundVeh) {
            setSelectedVehicle(foundVeh.placa);
          }
        }

        if (Array.isArray(data.paradas)) {
          const resolvedPassengers = data.paradas.map((p: any) => {
            const matched = dbItems.find(item => 
              item.nome.toLowerCase().includes(p.nome.toLowerCase().split(' ')[0]) || 
              p.nome.toLowerCase().includes(item.nome.toLowerCase().split(' ')[0])
            );

            return {
              nome: matched ? matched.nome : p.nome,
              endereco: matched ? matched.endereco : 'Itapetininga, SP',
              setor: p.setor || (matched ? matched.setor : ''),
              horarioEntrada: p.horarioEntrada || '08:00',
              horarioSaida: p.horarioSaida || '08:10',
              latitude: matched && matched.latitude ? matched.latitude : 0,
              longitude: matched && matched.longitude ? matched.longitude : 0,
              status: 'pendente',
              isNew: !matched
            };
          });

          setPassengers(resolvedPassengers);
        }

        showAlert('Sucesso', 'Escala rascunhada com IA! Por favor, revise os dados preenchidos abaixo.');
        setAiDraftText('');
      }

    } catch (e: any) {
      console.log('Erro no Gemini Rascunho', e);
      const errMsg = e.message || 'Não foi possível interpretar a escala. Tente digitar de outra forma.';
      showAlert('Erro', errMsg);
    } finally {
      setProcessingAiDraft(false);
    }
  };

  const addPassenger = () => {
    setPassengers([...passengers, { nome: '', endereco: '', setor: '', horarioEntrada: '', horarioSaida: '', status: 'pendente', latitude: 0, longitude: 0, isNew: true }]);
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const newP = [...passengers];
    newP[index] = { ...newP[index], [field]: value };
    
    if (field === 'nome') {
      const matchEmp = employeesList.find(e => e.nome.toLowerCase() === value.toLowerCase());
      const matchFav = favoritesList.find(f => f.nome.toLowerCase() === value.toLowerCase());
      const match = matchEmp || matchFav;
      if (match) {
        newP[index].endereco = match.endereco;
        newP[index].setor = match.setor || '';
        newP[index].latitude = match.latitude || 0;
        newP[index].longitude = match.longitude || 0;
        newP[index].isNew = false;
      } else {
        newP[index].isNew = true;
      }
    }
    setPassengers(newP);
  };

  const selectEmployeeSuggestion = (index: number, employee: any) => {
    const newP = [...passengers];
    newP[index] = {
      ...newP[index],
      nome: employee.nome,
      endereco: employee.endereco,
      setor: employee.setor || '',
      latitude: employee.latitude || 0,
      longitude: employee.longitude || 0,
      isNew: false
    };
    setPassengers(newP);
  };

  const loadWeeklyLongTripPreset = () => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    setDate(formattedDate);
    setDestino('Rota Especial Longa: Tatuí x São Carlos x Nuporanga');
    
    setPassengers([
      {
        nome: '1. Coleta JBS Tatuí',
        endereco: 'JBS - Rod. Antônio Romano Schincariol, Km 116, Tatuí - SP',
        setor: '',
        horarioEntrada: '08:00',
        horarioSaida: '09:00',
        status: 'pendente',
        latitude: -23.3601,
        longitude: -47.8612,
        isNew: false
      },
      {
        nome: '2. Defesa Agropecuária (CDA SP) - São Carlos',
        endereco: 'EDA - Coordenadoria de Defesa Agropecuária, São Carlos - SP',
        setor: 'ENTREGAR AMOSTRAS (ANÁLISE FRANGO SEARA/JBS)',
        horarioEntrada: '11:30',
        horarioSaida: '12:30',
        status: 'pendente',
        latitude: -22.0172,
        longitude: -47.8908,
        isNew: false
      },
      {
        nome: '3. JBS Nuporanga',
        endereco: 'JBS Nuporanga, Rod. SP-318, Nuporanga - SP',
        setor: 'DEIXAR AMOSTRAS',
        horarioEntrada: '15:00',
        horarioSaida: '16:00',
        status: 'pendente',
        latitude: -20.7302,
        longitude: -47.7491,
        isNew: false
      }
    ]);
    showAlert('Sucesso', 'Rota Especial Semanal carregada! Ajuste os horários ou ações se necessário.');
  };

  const addFavoriteStop = (fav: any) => {
    setPassengers([...passengers, {
      nome: fav.nome,
      endereco: fav.endereco,
      setor: fav.setor || '',
      horarioEntrada: '08:00',
      horarioSaida: '09:00',
      status: 'pendente',
      latitude: fav.latitude || 0,
      longitude: fav.longitude || 0,
      isNew: false
    }]);
    showAlert('Adicionado', `${fav.nome} foi adicionado à lista de paradas da viagem.`);
  };

  const saveNewEmployee = async (index: number) => {
    const p = passengers[index];
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const coords = await geocodeAddress(p.endereco);
      const lat = coords ? coords.latitude : (p.latitude || -23.5916 + (Math.random() - 0.5) * 0.05);
      const lon = coords ? coords.longitude : (p.longitude || -48.0531 + (Math.random() - 0.5) * 0.05);

      await addDoc(collection(db, 'funcionarios'), {
        nome: p.nome,
        endereco: p.endereco,
        setor: p.setor || 'N/A',
        latitude: lat,
        longitude: lon
      });
      fetchEmployees(); // Atualiza a lista local de busca
      const newP = [...passengers];
      newP[index] = { ...newP[index], latitude: lat, longitude: lon, isNew: false };
      setPassengers(newP);
      showAlert('Sucesso', 'Funcionário cadastrado permanentemente!');
    } catch (e) {
      showAlert('Erro', 'Não foi possível salvar o funcionário.');
    } finally {
      setLoading(false);
    }
  };

  const saveNewFavorite = async (index: number) => {
    const p = passengers[index];
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const coords = await geocodeAddress(p.endereco);
      const lat = coords ? coords.latitude : (p.latitude || -23.5916 + (Math.random() - 0.5) * 0.05);
      const lon = coords ? coords.longitude : (p.longitude || -48.0531 + (Math.random() - 0.5) * 0.05);

      await addDoc(collection(db, 'locais_favoritos'), {
        nome: p.nome,
        endereco: p.endereco,
        setor: p.setor || '',
        latitude: lat,
        longitude: lon
      });
      fetchFavorites(); // Atualiza a lista local de busca
      const newP = [...passengers];
      newP[index] = { ...newP[index], latitude: lat, longitude: lon, isNew: false };
      setPassengers(newP);
      showAlert('Sucesso', 'Local favorito cadastrado com sucesso!');
    } catch (e) {
      showAlert('Erro', 'Não foi possível salvar o local favorito.');
    } finally {
      setLoading(false);
    }
  };

  const confirmAndSend = async () => {
    if (!date || !selectedVehicle || !driverEmail || passengers.length === 0) {
      const missing = [];
      if (!date) missing.push('Data');
      if (!selectedVehicle) missing.push('Veículo');
      if (!driverEmail) missing.push('Motorista');
      if (passengers.length === 0) missing.push('Passageiros');
      showAlert('Atenção', `Preencha todos os dados obrigatórios. Campos pendentes: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);
    const db = getFirebaseDb();
    const vehicleData = vehicles.find(v => v.placa === selectedVehicle);

    try {
      const driverRef = doc(db, 'usuarios', driverEmail.toLowerCase());
      const driverSnap = await getDoc(driverRef);
      
      let startPoint = { latitude: -23.3568, longitude: -47.8574 }; // Default para JBS Tatuí
      
      const isJbsToCasa = destino.toUpperCase().includes('JBS X CASA') || 
                          destino.toUpperCase().includes('JBSXCASA') ||
                          destino.toUpperCase().includes('JBS/CASA') ||
                          destino.toUpperCase().includes('JBS-CASA') ||
                          destino.toUpperCase().includes('JBS > CASA');
      
      if (!isJbsToCasa) {
        // Se for Casa X JBS, o ponto de partida é a casa do motorista
        if (driverSnap.exists()) {
          const dData = driverSnap.data();
          if (dData.latitude && dData.longitude) {
            startPoint = { latitude: dData.latitude, longitude: dData.longitude };
          }
        }
      }

      const companyCoords = { latitude: -23.3568, longitude: -47.8574 };
      const mappedPassengers = await Promise.all(passengers.map(async (p, idx) => {
        let lat = p.latitude || 0;
        let lon = p.longitude || 0;

        if (lat === 0 || lon === 0) {
          const addr = p.endereco ? p.endereco.trim() : '';
          let coords = null;
          if (addr) {
            coords = await geocodeAddress(addr);
          }
          if (coords) {
            lat = coords.latitude;
            lon = coords.longitude;
          } else {
            lat = companyCoords.latitude + (idx + 1) * 0.005;
            lon = companyCoords.longitude + (idx + 1) * 0.005;
          }
        }

        return {
          nome: p.nome,
          endereco: p.endereco || 'Itapetininga, SP',
          setor: p.setor,
          horarioEntrada: p.horarioEntrada,
          horarioSaida: p.horarioSaida,
          status: p.status,
          latitude: lat,
          longitude: lon
        };
      }));

      const optimized = optimizeRoute(startPoint, mappedPassengers);

      await addDoc(collection(db, 'viagens'), {
        motoristaId: driverEmail.toLowerCase(),
        motoristaNome: driverEmail,
        carroPlaca: selectedVehicle,
        kmInicial: vehicleData ? vehicleData.kmAtual : 0,
        kmFinal: 0,
        data: date,
        destino: destino,
        horaInicio: '',
        horaFim: '',
        observacoes: '',
        fotoUrl: '',
        passageiros: optimized,
        status: 'pending',
        createdAt: new Date()
      });
      
      showAlert('Sucesso', 'Escala despachada com sucesso!');

      try {
        const db2 = getFirebaseDb();
        const driverDoc = await getDoc(doc(db2, 'usuarios', driverEmail.toLowerCase()));
        if (driverDoc.exists()) {
          const driverData = driverDoc.data();
          if (driverData?.pushToken) {
            await sendPushNotification(
              driverData.pushToken,
              '🚗 Nova Escala Atribuída',
              `Veículo ${selectedVehicle} para ${date}. Acesse o app para ver detalhes.`,
              { screen: 'Home' }
            );
          }
        }
      } catch (pushErr) {
        console.log('[Push dispatch error]', pushErr);
      }

      setImageUri(null);
      setDate('');
      setPassengers([]);
      setSelectedVehicle('');
    } catch (e) {
      console.log('Erro ao salvar', e);
      showAlert('Erro', 'Não foi possível salvar a escala.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 135}}>
      <Text style={styles.title}>Despacho Inteligente</Text>
      
      {/* Rascunho de IA por Texto */}
      <View style={[styles.passengerCard, { marginBottom: 25, borderColor: '#DF0A0A', borderWidth: 1.5 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <MaterialCommunityIcons name="robot" size={24} color="#DF0A0A" />
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' }}>Roteiro Rápido por IA (Texto)</Text>
        </View>
        <TextInput 
          style={[styles.input, { height: 80, textAlignVertical: 'top', fontSize: 15 }]} 
          value={aiDraftText} 
          onChangeText={setAiDraftText} 
          placeholder="Ex: Cole aqui a mensagem com a escala inteira ou de um motorista específico..."
          multiline
        />
        <TouchableOpacity 
          style={[styles.confirmBtn, { backgroundColor: '#DF0A0A', marginTop: 10, height: 48 }]} 
          onPress={runGeminiDraft}
          disabled={processingAiDraft}
        >
          {processingAiDraft ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontWeight: '900', fontSize: 14 }}>MONTAR ESCALA COM IA 🤖</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PAINEL DE MULTI-ESCALAS (COMPACTO) */}
      {multiScales.length > 0 && (
        <View style={styles.multiCardContainer}>
          <View style={styles.multiHeaderRow}>
            <View>
              <Text style={styles.multiTitle}>Revisão Coletiva de Escalas</Text>
              <Text style={{ fontSize: 12, color: colors.graphiteLight, fontWeight: 'bold', marginTop: 2 }}>
                {multiScales.filter(s => !s.launched).length} Escalas Pendentes
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={[styles.smallBtn, { backgroundColor: colors.green }]} 
                onPress={async () => {
                  setLoading(true);
                  let successCount = 0;
                  const updated = [...multiScales];
                  for (let i = 0; i < updated.length; i++) {
                    const sc = updated[i];
                    if (sc.launched) continue;
                    try {
                      const groups: { [key: string]: any[] } = {};
                      sc.paradas.forEach((p: any) => {
                        const dest = p.destino || 'CASA/JBS';
                        if (!groups[dest]) groups[dest] = [];
                        groups[dest].push(p);
                      });
                      for (const dest of Object.keys(groups)) {
                        await saveScale(sc.driverEmail, sc.carroPlaca, sc.date, dest, groups[dest]);
                      }
                      sc.launched = true;
                      successCount++;
                    } catch (err) {
                      console.log('Error launching in batch', err);
                    }
                  }
                  setMultiScales(updated);
                  setLoading(false);
                  showAlert('Sucesso', `${successCount} escalas despachadas com sucesso!`);
                }}
                disabled={loading}
              >
                <Text style={styles.smallBtnText}>LANÇAR TODAS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallBtn, { backgroundColor: colors.red }]} 
                onPress={() => setMultiScales([])}
              >
                <Text style={styles.smallBtnText}>LIMPAR TUDO</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
            {multiScales.map((sc, index) => {
              const isExpanded = expandedCardId === sc.id;
              const hasDriverPending = !sc.driverEmail;
              const hasVehiclePending = !sc.carroPlaca;
              const hasNewPassengers = sc.paradas.some((p: any) => p.isNew);

              return (
                <View key={sc.id} style={[styles.compactScaleCard, sc.launched && styles.launchedCard, isExpanded && { width: 340 }]}>
                  <View style={styles.cardHeaderCompact}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.driverNameText} numberOfLines={1}>{sc.driverName}</Text>
                      <Text style={{ fontSize: 10, color: colors.graphiteLight, fontWeight: 'bold' }}>
                        {sc.carroPlaca || 'SEM VEÍCULO'}
                      </Text>
                    </View>
                    {sc.launched ? (
                      <View style={styles.launchedBadge}>
                        <MaterialCommunityIcons name="check-circle" size={12} color={colors.white} />
                        <Text style={styles.launchedBadgeText}>Lançada</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {hasDriverPending && (
                          <View style={[styles.warningBadge, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={{ color: '#B45309', fontSize: 9, fontWeight: 'bold' }}>Motorista ⚠️</Text>
                          </View>
                        )}
                        {hasVehiclePending && (
                          <View style={[styles.warningBadge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={{ color: '#EF4444', fontSize: 9, fontWeight: 'bold' }}>Veículo ⚠️</Text>
                          </View>
                        )}
                        {!hasDriverPending && !hasVehiclePending && (
                          <Text style={styles.pendingText}>Pronta</Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Info Line Collapsed */}
                  {!isExpanded && (
                    <View style={{ marginVertical: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.graphite }}>
                        📅 {sc.date} | 🔄 Escala Consolidada
                      </Text>
                    </View>
                  )}

                  {/* Stops List */}
                  {!isExpanded ? (
                    <>
                      <Text style={styles.stopsHeader}>Paradas ({sc.paradas.length})</Text>
                      <View style={[styles.stopsListCompact, { maxHeight: 110 }]}>
                        {sc.paradas.map((p: any, pIdx: number) => {
                          const isVolta = p.destino.toUpperCase().includes('JBS/CASA') || 
                                          p.destino.toUpperCase().includes('JBSXCASA') ||
                                          p.destino.toUpperCase().includes('JBS X CASA') ||
                                          p.destino.toUpperCase().includes('JBS-CASA') ||
                                          p.destino.toUpperCase().includes('JBS > CASA');
                          const destTag = isVolta ? 'Volta' : 'Ida';
                          return (
                            <View key={pIdx} style={styles.stopLineCompact}>
                              <MaterialCommunityIcons 
                                name={p.isNew ? "alert-circle" : "check-circle"} 
                                size={12} 
                                color={p.isNew ? "#B45309" : colors.green} 
                              />
                              <Text style={[styles.stopTextCompact, p.isNew && { color: '#B45309' }]} numberOfLines={1}>
                                <Text style={{ fontWeight: 'bold', color: '#DF0A0A' }}>{p.horarioEntrada}</Text>
                                <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: 'bold' }}> [{destTag}]</Text> - {p.nome}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    /* Expanded form */
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 350, marginTop: 8 }} contentContainerStyle={{ gap: 10 }}>
                      <Text style={styles.expandedSecTitle}>Ajustar Dados Básicos</Text>
                      
                      <View style={styles.compactRowField}>
                        <Text style={styles.compactLabel}>Motorista:</Text>
                        <CompactDropdown 
                          label="Motorista"
                          value={sc.driverEmail}
                          options={drivers.map(d => ({ label: d.nome || d.email.split('@')[0].toUpperCase(), value: d.email }))}
                          onSelect={(val) => {
                            const updated = [...multiScales];
                            const matchedD = drivers.find(d => d.email === val);
                            updated[index].driverEmail = val;
                            updated[index].driverName = matchedD ? (matchedD.nome || val.split('@')[0].toUpperCase()) : val.split('@')[0].toUpperCase();
                            if (matchedD && matchedD.veiculoAlocado) {
                              updated[index].carroPlaca = matchedD.veiculoAlocado;
                            }
                            setMultiScales(updated);
                          }}
                        />
                      </View>

                      <View style={styles.compactRowField}>
                        <Text style={styles.compactLabel}>Veículo:</Text>
                        <CompactDropdown 
                          label="Veículo"
                          value={sc.carroPlaca}
                          options={vehicles.map(v => ({ label: `${v.modelo} - ${v.placa}`, value: v.placa }))}
                          onSelect={(val) => {
                            const updated = [...multiScales];
                            updated[index].carroPlaca = val;
                            setMultiScales(updated);
                          }}
                        />
                      </View>

                      <View style={styles.compactRowField}>
                        <Text style={styles.compactLabel}>Data:</Text>
                        <TextInput 
                          style={styles.compactInput} 
                          value={sc.date} 
                          onChangeText={(val) => {
                            const updated = [...multiScales];
                            updated[index].date = val;
                            setMultiScales(updated);
                          }} 
                        />
                      </View>

                      <View style={styles.compactRowField}>
                        <Text style={styles.compactLabel}>Sentido:</Text>
                        <TextInput 
                          style={styles.compactInput} 
                          value={sc.destino} 
                          onChangeText={(val) => {
                            const updated = [...multiScales];
                            updated[index].destino = val;
                            setMultiScales(updated);
                          }} 
                        />
                      </View>

                      <Text style={styles.expandedSecTitle}>Ajustar Paradas ({sc.paradas.length})</Text>
                      
                      {sc.paradas.map((p: any, pIdx: number) => {
                        return (
                          <View key={pIdx} style={styles.expandedStopCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <Text style={{ fontSize: 11, fontWeight: '900', color: p.isNew ? '#B45309' : colors.graphite }}>
                                {p.isNew ? '⚠️ Passageiro Novo' : `Parada #${pIdx + 1}`}
                              </Text>
                              <TouchableOpacity 
                                onPress={() => {
                                  const updated = [...multiScales];
                                  updated[index].paradas.splice(pIdx, 1);
                                  setMultiScales(updated);
                                }}
                              >
                                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.red} />
                              </TouchableOpacity>
                            </View>

                            <TextInput 
                              style={styles.smallStopInput}
                              value={p.nome}
                              onChangeText={(val) => {
                                const updated = [...multiScales];
                                updated[index].paradas[pIdx].nome = val;
                                const matchEmp = employeesList.find(e => e.nome.toLowerCase().includes(val.toLowerCase()));
                                const matchFav = favoritesList.find(f => f.nome.toLowerCase().includes(val.toLowerCase()));
                                const match = matchEmp || matchFav;
                                if (match) {
                                  updated[index].paradas[pIdx].endereco = match.endereco;
                                  updated[index].paradas[pIdx].latitude = match.latitude || 0;
                                  updated[index].paradas[pIdx].longitude = match.longitude || 0;
                                  updated[index].paradas[pIdx].isNew = false;
                                } else {
                                  updated[index].paradas[pIdx].isNew = true;
                                }
                                setMultiScales(updated);
                              }}
                              placeholder="Nome do passageiro ou local"
                            />

                            <TextInput 
                              style={[styles.smallStopInput, { marginTop: 4 }]}
                              value={p.endereco}
                              onChangeText={(val) => {
                                const updated = [...multiScales];
                                updated[index].paradas[pIdx].endereco = val;
                                updated[index].paradas[pIdx].latitude = 0;
                                updated[index].paradas[pIdx].longitude = 0;
                                setMultiScales(updated);
                              }}
                              placeholder="Endereço"
                            />

                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                              <TextInput 
                                style={[styles.smallStopInput, { flex: 1 }]}
                                value={p.horarioEntrada}
                                onChangeText={(val) => {
                                  const updated = [...multiScales];
                                  updated[index].paradas[pIdx].horarioEntrada = val;
                                  setMultiScales(updated);
                                }}
                                placeholder="Entrada (HH:MM)"
                              />
                              <TextInput 
                                style={[styles.smallStopInput, { flex: 1.2 }]}
                                value={p.destino}
                                onChangeText={(val) => {
                                  const updated = [...multiScales];
                                  updated[index].paradas[pIdx].destino = val;
                                  setMultiScales(updated);
                                }}
                                placeholder="Sentido"
                              />
                              <TextInput 
                                style={[styles.smallStopInput, { flex: 1.2 }]}
                                value={p.setor}
                                onChangeText={(val) => {
                                  const updated = [...multiScales];
                                  updated[index].paradas[pIdx].setor = val;
                                  setMultiScales(updated);
                                }}
                                placeholder="Ação (ex: PEGAR AMOSTRAS)"
                              />
                            </View>

                            {p.isNew && (
                              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                                <TouchableOpacity 
                                  style={styles.microSaveBtn}
                                  onPress={async () => {
                                    setLoading(true);
                                    try {
                                      const db = getFirebaseDb();
                                      const coords = await geocodeAddress(p.endereco);
                                      const lat = coords ? coords.latitude : -23.5916 + (Math.random() - 0.5) * 0.05;
                                      const lon = coords ? coords.longitude : -48.0531 + (Math.random() - 0.5) * 0.05;

                                      await addDoc(collection(db, 'funcionarios'), {
                                        nome: p.nome,
                                        endereco: p.endereco,
                                        setor: p.setor || 'N/A',
                                        latitude: lat,
                                        longitude: lon
                                      });
                                      fetchEmployees();
                                      const updated = [...multiScales];
                                      updated[index].paradas[pIdx].latitude = lat;
                                      updated[index].paradas[pIdx].longitude = lon;
                                      updated[index].paradas[pIdx].isNew = false;
                                      setMultiScales(updated);
                                      showAlert('Sucesso', 'Funcionário cadastrado!');
                                    } catch (e) {
                                      showAlert('Erro', 'Não foi possível cadastrar.');
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  <Text style={styles.microSaveBtnText}>+ FUNCIONÁRIO</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  style={[styles.microSaveBtn, { backgroundColor: '#B45309' }]}
                                  onPress={async () => {
                                    setLoading(true);
                                    try {
                                      const db = getFirebaseDb();
                                      const coords = await geocodeAddress(p.endereco);
                                      const lat = coords ? coords.latitude : -23.5916 + (Math.random() - 0.5) * 0.05;
                                      const lon = coords ? coords.longitude : -48.0531 + (Math.random() - 0.5) * 0.05;

                                      await addDoc(collection(db, 'locais_favoritos'), {
                                        nome: p.nome,
                                        endereco: p.endereco,
                                        setor: p.setor || '',
                                        latitude: lat,
                                        longitude: lon
                                      });
                                      fetchFavorites();
                                      const updated = [...multiScales];
                                      updated[index].paradas[pIdx].latitude = lat;
                                      updated[index].paradas[pIdx].longitude = lon;
                                      updated[index].paradas[pIdx].isNew = false;
                                      setMultiScales(updated);
                                      showAlert('Sucesso', 'Local favorito salvo!');
                                    } catch (e) {
                                      showAlert('Erro', 'Não foi possível salvar.');
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                >
                                  <Text style={styles.microSaveBtnText}>+ FAVORITO</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}

                      <TouchableOpacity 
                        style={styles.addStopCompactBtn}
                        onPress={() => {
                          const updated = [...multiScales];
                          updated[index].paradas.push({
                            nome: '',
                            endereco: '',
                            setor: '',
                            horarioEntrada: '08:00',
                            horarioSaida: '08:10',
                            latitude: 0,
                            longitude: 0,
                            status: 'pendente',
                            isNew: true
                          });
                          setMultiScales(updated);
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.graphite }}>+ ADICIONAR PARADA</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity 
                      style={[styles.launchCardBtn, { flex: 1, backgroundColor: colors.graphite }]}
                      onPress={() => setExpandedCardId(isExpanded ? null : sc.id)}
                    >
                      <Text style={styles.launchCardBtnText}>
                        {isExpanded ? 'CONCLUIR AJUSTES' : 'AJUSTAR ROTA'}
                      </Text>
                    </TouchableOpacity>

                    {!sc.launched && (
                      <TouchableOpacity 
                        style={[styles.launchCardBtn, { flex: 1.2 }]}
                        onPress={async () => {
                          try {
                            const groups: { [key: string]: any[] } = {};
                            sc.paradas.forEach((p: any) => {
                              const dest = p.destino || 'CASA/JBS';
                              if (!groups[dest]) groups[dest] = [];
                              groups[dest].push(p);
                            });
                            for (const dest of Object.keys(groups)) {
                              await saveScale(sc.driverEmail, sc.carroPlaca, sc.date, dest, groups[dest]);
                            }
                            const updated = [...multiScales];
                            updated[index].launched = true;
                            setMultiScales(updated);
                            showAlert('Sucesso', `Escala para ${sc.driverName} despachada com sucesso!`);
                          } catch (err: any) {
                            showAlert('Erro', err.message || 'Falha ao lançar escala.');
                          }
                        }}
                      >
                        <Text style={styles.launchCardBtnText}>LANÇAR ESCALA</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* COMPONENTES DO MODO INDIVIDUAL (OCULTADOS QUANDO HÁ MULTI-ESCALAS) */}
      {multiScales.length === 0 && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.graphiteLight, textTransform: 'uppercase' }}>OU LEIA UM DOCUMENTO</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          
          {!imageUri && (
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage} disabled={processingAi}>
              {processingAi ? (
                <ActivityIndicator size="large" color={colors.graphite} />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera-document" size={48} color={colors.graphite} />
                  <Text style={styles.uploadText}>Ler Folha da JBS</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {imageUri && !processingAi && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setImageUri(null)}>
                <Text style={{color: colors.white, fontWeight: 'bold', fontSize: 16}}>Refazer Leitura</Text>
              </TouchableOpacity>
            </View>
          )}

          {processingAi && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="large" color={colors.graphite} />
              <Text style={styles.processingText}>Inteligência Artificial Lendo Dados...</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>DADOS DA ESCALA</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="DD/MM/AAAA" />

            <Text style={styles.sectionTitle}>SENTIDO DO DESTINO</Text>
            <TextInput style={styles.input} value={destino} onChangeText={setDestino} placeholder="Ex: Casa X JBS ou JBS X Casa" />

            <Text style={styles.sectionTitle}>SELECIONAR MOTORISTA (ORDENADOS POR DISPONIBILIDADE)</Text>
            <View style={styles.driverGrid}>
              {drivers.map((d) => (
                <TouchableOpacity 
                  key={d.id} 
                  style={[
                    styles.driverChip, 
                    driverEmail.toLowerCase() === d.email?.toLowerCase() && styles.driverChipActive
                  ]}
                  onPress={() => selectDriver(d)}
                >
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <MaterialCommunityIcons 
                      name="account-tie-hat" 
                      size={16} 
                      color={driverEmail.toLowerCase() === d.email?.toLowerCase() ? colors.white : colors.graphite} 
                    />
                    <Text style={[
                      styles.driverChipText, 
                      driverEmail.toLowerCase() === d.email?.toLowerCase() && { color: colors.white }
                    ]}>
                      {d.nome || d.email.split('@')[0].toUpperCase()}
                    </Text>
                    <View style={[
                      styles.badge, 
                      d.activeTripsCount > 0 ? { backgroundColor: colors.red } : { backgroundColor: colors.green }
                    ]}>
                      <Text style={styles.badgeText}>{d.activeTripsCount}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>VEÍCULO ALOCADO</Text>
            <View style={styles.vehicleGrid}>
              {vehicles.map((v) => (
                <TouchableOpacity 
                  key={v.id} 
                  style={[styles.vehicleChip, selectedVehicle === v.placa && styles.vehicleChipActive]}
                  onPress={() => setSelectedVehicle(v.placa)}
                >
                  <Text style={[styles.vehicleChipText, selectedVehicle === v.placa && {color: colors.white}]}>
                    {v.modelo} - {v.placa}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rota Especial Preset Button */}
          <TouchableOpacity style={styles.specialPresetBtn} onPress={loadWeeklyLongTripPreset}>
            <MaterialCommunityIcons name="routes" size={24} color={colors.white} />
            <Text style={styles.specialPresetBtnText}>CRIAR VIAGEM DE LONGA DURAÇÃO (NUPORANGA)</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Seção de Locais Salvos / Favoritos */}
          {favoritesList.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.sectionTitle}>ADICIONAR LOCAL SALVO (FAVORITO)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 5 }}>
                {favoritesList.map((fav) => (
                  <TouchableOpacity
                    key={fav.id}
                    style={styles.favChip}
                    onPress={() => addFavoriteStop(fav)}
                  >
                    <MaterialCommunityIcons name="star" size={16} color="#B45309" />
                    <Text style={styles.favChipText}>{fav.nome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={[styles.title, {fontSize: 22}]}>PASSAGEIROS E TURNOS</Text>

          {passengers.map((p, idx) => (
            <View key={idx} style={styles.passengerCard}>
              <Text style={styles.pLabel}>NOME DO PASSAGEIRO / LOCAL</Text>
              <TextInput 
                style={styles.input} 
                value={p.nome} 
                onChangeText={(val) => {
                  updatePassenger(idx, 'nome', val);
                  setShowSuggestionsForIndex(idx);
                }} 
                onFocus={() => setShowSuggestionsForIndex(idx)}
                placeholder="Digite ou selecione do banco de dados..."
              />
              
              {/* Sugestões do Banco de Dados */}
              {showSuggestionsForIndex === idx && (
                <View style={styles.suggestionsContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.graphiteLight }}>SELECIONE UM SALVO OU DIGITE</Text>
                    <TouchableOpacity onPress={() => setShowSuggestionsForIndex(null)} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.border, borderRadius: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.graphite }}>FECHAR ✕</Text>
                    </TouchableOpacity>
                  </View>
                  {(() => {
                    const combined = [
                      ...favoritesList.map(f => ({ ...f, type: 'Local Favorito', icon: 'star' })),
                      ...employeesList.map(e => ({ ...e, type: 'Funcionário', icon: 'account' }))
                    ];
                    
                    const filtered = p.nome.trim() === '' 
                      ? combined 
                      : combined.filter(item => item.nome.toLowerCase().includes(p.nome.toLowerCase()));

                    if (filtered.length === 0) {
                      return (
                        <View style={{ padding: 12, alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: colors.graphiteLight }}>Nenhum local ou funcionário encontrado</Text>
                        </View>
                      );
                    }

                    return filtered.slice(0, 6).map((item, sIdx) => (
                      <TouchableOpacity 
                        key={sIdx} 
                        style={styles.suggestionItem} 
                        onPress={() => {
                          const newP = [...passengers];
                          newP[idx] = {
                            ...newP[idx],
                            nome: item.nome,
                            endereco: item.endereco,
                            setor: item.setor || newP[idx].setor || '',
                            latitude: item.latitude || 0,
                            longitude: item.longitude || 0,
                            isNew: false
                          };
                          setPassengers(newP);
                          setShowSuggestionsForIndex(null);
                        }}
                      >
                        <MaterialCommunityIcons name={item.icon as any} size={18} color={item.icon === 'star' ? '#D97706' : colors.graphiteLight} />
                        <View style={{flex: 1}}>
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                            <Text style={styles.suggestionName}>{item.nome}</Text>
                            <View style={{ backgroundColor: item.icon === 'star' ? '#FEF3C7' : '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: 'bold', color: item.icon === 'star' ? '#B45309' : '#0369A1' }}>{item.type}</Text>
                            </View>
                          </View>
                          <Text style={styles.suggestionSub} numberOfLines={1}>{item.endereco}</Text>
                        </View>
                      </TouchableOpacity>
                    ));
                  })()}
                </View>
              )}
              
              <Text style={styles.pLabel}>ENDEREÇO (AUTO-PREENCHIDO)</Text>
              <TextInput style={styles.input} value={p.endereco} onChangeText={(val) => updatePassenger(idx, 'endereco', val)} />

              <Text style={styles.pLabel}>AÇÃO / TAREFA NO LOCAL</Text>
              <View style={styles.actionRowOptions}>
                {['PEGAR AMOSTRAS', 'DEIXAR AMOSTRAS', 'ENTREGAR LAUDOS'].map((act) => (
                  <TouchableOpacity
                    key={act}
                    style={[styles.actionOptionBtn, p.setor === act && styles.actionOptionBtnActive]}
                    onPress={() => updatePassenger(idx, 'setor', act)}
                  >
                    <Text style={[styles.actionOptionText, p.setor === act && { color: colors.white }]}>{act}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.actionOptionBtn, !['PEGAR AMOSTRAS', 'DEIXAR AMOSTRAS', 'ENTREGAR LAUDOS'].includes(p.setor) && p.setor !== '' && styles.actionOptionBtnActive]}
                  onPress={() => updatePassenger(idx, 'setor', 'OUTRO')}
                >
                  <Text style={[styles.actionOptionText, !['PEGAR AMOSTRAS', 'DEIXAR AMOSTRAS', 'ENTREGAR LAUDOS'].includes(p.setor) && p.setor !== '' && { color: colors.white }]}>OUTRO...</Text>
                </TouchableOpacity>
              </View>
              
              {(!['PEGAR AMOSTRAS', 'DEIXAR AMOSTRAS', 'ENTREGAR LAUDOS'].includes(p.setor) || p.setor === 'OUTRO') && (
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  value={p.setor === 'OUTRO' ? '' : p.setor}
                  onChangeText={(val) => updatePassenger(idx, 'setor', val)}
                  placeholder="Digite a ação específica aqui..."
                />
              )}
              
              <View style={styles.row}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={styles.pLabel}>ENTRADA</Text>
                  <TextInput style={styles.input} value={p.horarioEntrada} onChangeText={(val) => updatePassenger(idx, 'horarioEntrada', val)} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.pLabel}>SAÍDA</Text>
                  <TextInput style={styles.input} value={p.horarioSaida} onChangeText={(val) => updatePassenger(idx, 'horarioSaida', val)} />
                </View>
              </View>

              {p.isNew && (
                <View style={styles.newEmployeeCard}>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#B45309" />
                    <Text style={styles.newEmployeeTitle}>Parada Não Cadastrada</Text>
                  </View>
                  <Text style={styles.newEmployeeDesc}>Deseja salvar este local/passageiro permanentemente?</Text>
                  
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity style={styles.saveEmployeeBtn} onPress={() => saveNewEmployee(idx)} disabled={loading}>
                      <Text style={styles.saveEmployeeBtnText}>SALVAR COMO FUNCIONÁRIO</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.saveEmployeeBtn, { backgroundColor: '#B45309' }]} onPress={() => saveNewFavorite(idx)} disabled={loading}>
                      <Text style={styles.saveEmployeeBtnText}>SALVAR COMO LOCAL FAVORITO</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addPassenger}>
            <Text style={styles.addBtnText}>+ ADICIONAR PASSAGEIRO</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSend} disabled={loading || processingAi}>
            {loading ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.confirmBtnText}>CONFIRMAR E ENVIAR</Text>
            )}
          </TouchableOpacity>
        </>
      )}
      
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMsg}
        type={alertType}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertConfirmAction}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '900', color: colors.graphite, marginBottom: 20, textTransform: 'uppercase' },
  uploadBox: { backgroundColor: colors.white, height: 120, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  uploadText: { fontSize: 18, fontWeight: 'bold', color: colors.graphite, marginTop: 10 },
  previewContainer: { marginBottom: 20, position: 'relative', elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  previewImage: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#EEE' },
  retakeBtn: { position: 'absolute', bottom: 10, right: 10, backgroundColor: colors.graphite, height: 40, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 8 },
  processingBox: { backgroundColor: '#FEF3C7', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20, elevation: 3 },
  processingText: { fontSize: 16, fontWeight: 'bold', color: '#92400E', marginTop: 10 },
  card: { backgroundColor: colors.background, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.graphite, marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 15, fontSize: 18, color: colors.graphite, fontWeight: 'bold', marginBottom: 5, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2 },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  vehicleChip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingVertical: 15, paddingHorizontal: 15, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2 },
  vehicleChipActive: { backgroundColor: colors.graphite, borderColor: colors.graphite },
  vehicleChipText: { fontSize: 16, fontWeight: 'bold', color: colors.graphite },
  divider: { height: 2, backgroundColor: colors.border, marginVertical: 30 },
  passengerCard: { backgroundColor: colors.white, padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  pLabel: { fontSize: 12, fontWeight: 'bold', color: colors.graphiteLight, marginBottom: 5, marginTop: 10, textTransform: 'uppercase' },
  row: { flexDirection: 'row' },
  addBtn: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', height: 58, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  addBtnText: { fontSize: 16, fontWeight: '900', color: colors.graphite },
  confirmBtn: { backgroundColor: colors.green, height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4 },
  confirmBtnText: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  newEmployeeCard: { backgroundColor: '#FFFBEB', padding: 15, borderRadius: 8, marginTop: 15, borderWidth: 2, borderColor: '#FDE68A' },
  newEmployeeTitle: { fontSize: 16, fontWeight: '900', color: '#B45309', marginLeft: 8 },
  newEmployeeDesc: { fontSize: 14, color: '#92400E', marginBottom: 10, fontWeight: '500' },
  saveEmployeeBtn: { backgroundColor: colors.green, height: 58, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  saveEmployeeBtnText: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  driverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  driverChip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2 },
  driverChipActive: { backgroundColor: colors.graphite, borderColor: colors.graphite },
  driverChipText: { fontSize: 15, fontWeight: 'bold', color: colors.graphite },
  badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 5 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: 'bold' },
  suggestionsContainer: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: -2, marginBottom: 12, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionName: { fontSize: 13, fontWeight: 'bold', color: colors.graphite },
  suggestionSub: { fontSize: 11, color: colors.graphiteLight },
  specialPresetBtn: { flexDirection: 'row', backgroundColor: '#DF0A0A', height: 58, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 15, gap: 10, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  specialPresetBtnText: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  favChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  favChipText: { fontSize: 13, fontWeight: 'bold', color: '#B45309' },
  actionRowOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  actionOptionBtn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  actionOptionBtnActive: { backgroundColor: colors.graphite, borderColor: colors.graphite },
  actionOptionText: { fontSize: 13, fontWeight: 'bold', color: colors.graphite },
  
  // Multi Scale Custom Styles
  multiCardContainer: { backgroundColor: colors.white, padding: 15, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: colors.border },
  multiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  multiTitle: { fontSize: 18, fontWeight: '900', color: colors.graphite, textTransform: 'uppercase' },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  smallBtnText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  compactScaleCard: { width: 280, backgroundColor: colors.background, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  launchedCard: { opacity: 0.6, borderColor: colors.green, borderWidth: 2 },
  cardHeaderCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  driverNameText: { fontSize: 16, fontWeight: '900', color: colors.graphite },
  launchedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  launchedBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  pendingText: { fontSize: 12, color: '#B45309', fontWeight: '900', textTransform: 'uppercase' },
  compactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  compactLabel: { width: 75, fontSize: 12, fontWeight: '900', color: colors.graphiteLight, textTransform: 'uppercase' },
  compactInput: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, fontSize: 13, color: colors.graphite, fontWeight: 'bold' },
  stopsHeader: { fontSize: 11, fontWeight: '900', color: colors.graphiteLight, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  stopsListCompact: { backgroundColor: colors.white, borderRadius: 6, padding: 10, borderWidth: 1, borderColor: colors.border, maxHeight: 110, overflow: 'scroll' },
  stopLineCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  stopTextCompact: { fontSize: 12, color: colors.graphite, fontWeight: 'bold' },
  launchCardBtn: { backgroundColor: colors.green, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 12, elevation: 1 },
  launchCardBtnText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  
  // Custom select dropdown & inline editing
  warningBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  expandedSecTitle: { fontSize: 11, fontWeight: '900', color: colors.graphiteLight, marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  compactRowField: { marginBottom: 6 },
  expandedStopCard: { backgroundColor: colors.white, padding: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.graphite, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  smallStopInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, fontSize: 12, color: colors.graphite, fontWeight: 'bold' },
  microSaveBtn: { flex: 1, backgroundColor: colors.green, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  microSaveBtnText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  addStopCompactBtn: { backgroundColor: colors.white, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 6, marginTop: 6 },
  dropdownHeader: { height: 32, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white },
  dropdownValue: { fontSize: 12, fontWeight: 'bold', color: colors.graphite, flex: 1 },
  dropdownListInline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 6, marginTop: 2, maxHeight: 120 },
  dropdownItem: { paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: colors.graphite },
  dropdownItemText: { fontSize: 12, color: colors.graphite }
});


