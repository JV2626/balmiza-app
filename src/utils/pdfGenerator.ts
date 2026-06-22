import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

export const generateTripsPDF = async (trips: any[]) => {
  try {
    const completedTrips = trips.filter(t => t.status === 'completed');
    const totalTrips = completedTrips.length;
    
    let totalKm = 0;
    let tableRows = '';

    completedTrips.forEach(t => {
      const kmPercorrido = (t.kmFinal || 0) - (t.kmInicial || 0);
      const kmReal = kmPercorrido > 0 ? kmPercorrido : 0;
      totalKm += kmReal;

      const dateStr = t.data || 'N/A';
      const motorista = t.motoristaNome || (t.motoristaEmail ? t.motoristaEmail.split('@')[0] : 'N/A');
      const obs = t.observacoes || '-';

      tableRows += `
        <tr>
          <td>${dateStr}</td>
          <td>${motorista.toUpperCase()}</td>
          <td><b>${t.carroPlaca}</b></td>
          <td>${kmReal} KM</td>
          <td>${obs}</td>
        </tr>
      `;
    });

    const estimatedCost = (totalKm / 10) * 5.80; // 10km/L a 5.80 reais
    const hoje = new Date().toLocaleDateString('pt-BR');

    const html = `
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1C1C1E; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 4px solid #DF0A0A; padding-bottom: 20px; }
            .title { font-size: 28px; font-weight: 900; color: #DF0A0A; letter-spacing: 1px; margin: 0; }
            .subtitle { font-size: 14px; color: #6B7280; font-weight: 700; margin-top: 5px; }
            .summary-box { display: flex; justify-content: space-between; background-color: #F4F6F8; padding: 20px; border-radius: 12px; margin-bottom: 40px; border: 1px solid #E5E7EB; }
            .summary-item { text-align: center; width: 33%; }
            .summary-val { font-size: 28px; font-weight: 900; color: #DF0A0A; }
            .summary-label { font-size: 12px; font-weight: 700; color: #6B7280; text-transform: uppercase; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { background-color: #1C1C1E; color: white; padding: 15px; text-align: left; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
            td { padding: 15px; border-bottom: 1px solid #E5E7EB; color: #1C1C1E; }
            tr:nth-child(even) { background-color: #FAFAFA; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #9CA3AF; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">BALMIZA TRANSPORTES</h1>
            <div class="subtitle">RELATÓRIO OPERACIONAL E FINANCEIRO DE VIAGENS</div>
            <div class="subtitle" style="font-size: 12px; color: #9CA3AF;">Gerado em: ${hoje}</div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-val">${totalTrips}</div>
              <div class="summary-label">Viagens Concluídas</div>
            </div>
            <div class="summary-item" style="border-left: 2px solid #E5E7EB; border-right: 2px solid #E5E7EB;">
              <div class="summary-val">${totalKm}</div>
              <div class="summary-label">KM Total Rodado</div>
            </div>
            <div class="summary-item">
              <div class="summary-val">R$ ${estimatedCost.toFixed(2).replace('.', ',')}</div>
              <div class="summary-label">Custo Combustível (Est.)</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Motorista</th>
                <th>Veículo</th>
                <th>Desgaste (KM)</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5" style="text-align: center;">Nenhuma viagem registrada neste período.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            BALMIZA TRANSPORTES E LOGÍSTICA © ${new Date().getFullYear()} - Documento Gerado pelo App Balmiza
          </div>
        </body>
      </html>
    `;

    // Na Web, o expo-print usa a janela de impressão nativa do navegador para salvar como PDF
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }

    // No celular (Android/iOS), gera o PDF invisível e abre tela de compartilhamento (WhatsApp, etc)
    const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
    
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Compartilhar Relatório' });
    } else {
      Alert.alert('Sucesso', 'PDF gerado em: ' + uri);
    }

  } catch (error) {
    Alert.alert('Erro', 'Não foi possível gerar o relatório em PDF.');
    console.error(error);
  }
};
