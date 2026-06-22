import * as XLSX from 'xlsx';
import { documentDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

export const generateTripsExcel = async (trips: any[]) => {
  try {
    const completedTrips = trips.filter(t => t.status === 'completed');
    const totalTrips = completedTrips.length;
    
    let totalKm = 0;

    // 1. Preparar os dados para a aba de Detalhes
    const viagensData = completedTrips.map(t => {
      const kmPercorrido = (t.kmFinal || 0) - (t.kmInicial || 0);
      const kmReal = kmPercorrido > 0 ? kmPercorrido : 0;
      totalKm += kmReal;
      
      const custoCombustivel = (kmReal / 10) * 5.80; // Estima 10km/L a 5.80

      return {
        'Data': t.data || 'N/A',
        'Motorista': t.motoristaNome || (t.motoristaEmail ? t.motoristaEmail.split('@')[0].toUpperCase() : 'N/A'),
        'Veículo (Placa)': t.carroPlaca,
        'KM Inicial': t.kmInicial || 0,
        'KM Final': t.kmFinal || 0,
        'Distância (KM)': kmReal,
        'Custo Estimado (R$)': parseFloat(custoCombustivel.toFixed(2)),
        'Observações': t.observacoes || '-'
      };
    });

    const custoTotalMês = (totalKm / 10) * 5.80;

    // 2. Preparar os dados para a aba de Resumo (Mês)
    const resumoData = [
      { 'Métrica': 'Total de Viagens', 'Valor': totalTrips },
      { 'Métrica': 'Total de KM Rodados', 'Valor': totalKm },
      { 'Métrica': 'Custo de Combustível Total Estimado (R$)', 'Valor': parseFloat(custoTotalMês.toFixed(2)) }
    ];

    // 3. Criar a Planilha Excel (Workbook)
    const wb = XLSX.utils.book_new();

    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

    const wsViagens = XLSX.utils.json_to_sheet(viagensData);
    XLSX.utils.book_append_sheet(wb, wsViagens, 'Relatório de Viagens');

    // 4. Salvar e Exportar baseado na Plataforma
    if (Platform.OS === 'web') {
      // O navegador faz o download nativo do arquivo
      XLSX.writeFile(wb, 'Relatorio_Balmiza.xlsx');
    } else {
      // No celular (iOS/Android), gravamos fisicamente no disco e abrimos o Compartilhar
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = documentDirectory + 'Relatorio_Balmiza.xlsx';
      
      await writeAsStringAsync(fileUri, wbout, {
        encoding: EncodingType.Base64
      });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Enviar Planilha JBS'
        });
      } else {
        Alert.alert('Sucesso', 'Planilha salva em: ' + fileUri);
      }
    }

  } catch (error) {
    Alert.alert('Erro', 'Não foi possível gerar a planilha do Excel.');
    console.error(error);
  }
};
