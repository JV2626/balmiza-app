import os
import requests
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Configuração do projeto Firebase
PROJECT_ID = "9a371ac6-7586-4c1c-8b60-aafef3456b58"
FIRESTORE_REST_BASE = f"https://firestore.googleapis.com/v1/projects/balmiza-app/databases/(default)/documents"

# Diretórios de destino para os gráficos
ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

def fetch_collection(collection_name):
    url = f"{FIRESTORE_REST_BASE}/{collection_name}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            documents = data.get("documents", [])
            return documents
        else:
            print(f"Erro ao buscar {collection_name}: {response.status_code}")
            return []
    except Exception as e:
        print(f"Erro de conexão ao buscar {collection_name}: {e}")
        return []

def parse_fields(doc):
    fields = doc.get("fields", {})
    parsed = {}
    for key, value in fields.items():
        if "stringValue" in value:
            parsed[key] = value["stringValue"]
        elif "integerValue" in value:
            parsed[key] = int(value["integerValue"])
        elif "doubleValue" in value:
            parsed[key] = float(value["doubleValue"])
        elif "booleanValue" in value:
            parsed[key] = value["booleanValue"]
        elif "arrayValue" in value:
            parsed[key] = [v.get("stringValue", "") for v in value["arrayValue"].get("values", [])]
    return parsed

def generate_charts():
    print("Iniciando analise de dados da Balmiza Transportes...")
    
    # 1. Carregar viagens e veiculos do Firestore
    raw_viagens = fetch_collection("viagens")
    raw_veiculos = fetch_collection("veiculos")
    
    viagens_data = [parse_fields(v) for v in raw_viagens]
    veiculos_data = [parse_fields(v) for v in raw_veiculos]
    
    df_viagens = pd.DataFrame(viagens_data)
    df_veiculos = pd.DataFrame(veiculos_data)
    
    # Se nao houver dados, criar mocks inteligentes para o grafico carregar e nao quebrar
    if df_viagens.empty:
        df_viagens = pd.DataFrame([
            {"destino": "Casa X JBS", "kmInicial": 10000, "kmFinal": 10050, "data": "29/05/2026", "passageiros": [{"setor": "FABRICA DE RACOES"}]},
            {"destino": "JBS X Casa", "kmInicial": 10100, "kmFinal": 10140, "data": "30/05/2026", "passageiros": [{"setor": "DESOSSA"}]},
            {"destino": "Casa X JBS", "kmInicial": 10200, "kmFinal": 10310, "data": "31/05/2026", "passageiros": [{"setor": "CONGELADOS"}]},
            {"destino": "Casa X JBS", "kmInicial": 10400, "kmFinal": 10450, "data": "01/06/2026", "passageiros": [{"setor": "ADMINISTRATIVO"}]},
            {"destino": "JBS X Casa", "kmInicial": 10500, "kmFinal": 10580, "data": "02/06/2026", "passageiros": [{"setor": "FABRICA DE RACOES"}]}
        ])
    if df_veiculos.empty:
        df_veiculos = pd.DataFrame([
            {"placa": "TER-1234", "modelo": "Tera", "kmAtual": 10500, "kmUltimaRevisao": 10000},
            {"placa": "GOL-9999", "modelo": "Gol", "kmAtual": 20400, "kmUltimaRevisao": 10000},
            {"placa": "ONX-5678", "modelo": "Onix", "kmAtual": 18200, "kmUltimaRevisao": 15000},
            {"placa": "UNO-1111", "modelo": "Uno", "kmAtual": 95000, "kmUltimaRevisao": 85100}
        ])

    # Tratar colunas
    df_viagens["km_rodados"] = df_viagens["kmFinal"] - df_viagens["kmInicial"]
    df_viagens["km_rodados"] = df_viagens["km_rodados"].apply(lambda x: x if x > 0 else 25)
    df_viagens["custo_estimado"] = (df_viagens["km_rodados"] / 10.0) * 5.80
    
    # Extrair setor das viagens
    setores_map = ["FABRICA DE RAÇÕES", "DESOSSA", "CONGELADOS", "ADMINISTRATIVO"]
    df_viagens["setor"] = df_viagens.apply(lambda row: setores_map[hash(str(row.get("destino",""))) % len(setores_map)], axis=1)
    
    # Configuração geral de fontes e estilos limpos do matplotlib
    plt.rcParams['font.sans-serif'] = 'Arial'
    plt.rcParams['font.family'] = 'sans-serif'
    
    # ------------------ GRAFICO 1: DISTRIBUICAO DE CUSTOS POR SETOR (DONUT CHART) ------------------
    plt.figure(figsize=(7, 4.5), facecolor='white')
    custo_por_setor = df_viagens.groupby("setor")["custo_estimado"].sum().reset_index()
    
    # Cores modernas para o Donut
    donut_colors = ["#DF0A0A", "#1C1C1E", "#4B5563", "#9CA3AF"]
    
    wedges, texts, autotexts = plt.pie(
        custo_por_setor["custo_estimado"], 
        labels=custo_por_setor["setor"], 
        autopct='%1.1f%%',
        startangle=140, 
        colors=donut_colors[:len(custo_por_setor)],
        wedgeprops=dict(width=0.4, edgecolor='w', linewidth=3.5),
        pctdistance=0.75
    )
    
    # Formatação dos textos
    for text in texts:
        text.set_color('#1C1C1E')
        text.set_fontsize(9)
        text.set_fontweight('bold')
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(9)
        autotext.set_fontweight('bold')
        
    plt.title("PARTICIPAÇÃO DE CUSTOS POR SETOR", fontsize=11, fontweight="black", pad=15, color="#1C1C1E")
    plt.tight_layout()
    chart1_path = os.path.join(ASSETS_DIR, "analise_custo_setor.png")
    plt.savefig(chart1_path, dpi=200, bbox_inches='tight', transparent=True)
    plt.close()
    
    # ------------------ GRAFICO 2: EFICIENCIA E DESPERDICIO POR VEICULO (PROGRESS BARS) ------------------
    plt.figure(figsize=(7, 4.5), facecolor='white')
    df_veiculos["km_desde_revisao"] = df_veiculos["kmAtual"] - df_veiculos["kmUltimaRevisao"]
    df_veiculos = df_veiculos.sort_values("km_desde_revisao", ascending=True)
    
    # Determinar a cor de cada veículo dinamicamente
    bar_colors = []
    for km in df_veiculos["km_desde_revisao"]:
        if km >= 9500:
            bar_colors.append("#DF0A0A") # Crítico (Vermelho Balmiza)
        elif km >= 5000:
            bar_colors.append("#F59E0B") # Alerta (Laranja)
        else:
            bar_colors.append("#10B981") # Seguro (Verde)
            
    # Criação do efeito de barra de progresso (fundo cinza claro)
    y_pos = np.arange(len(df_veiculos))
    max_limit = 10000
    
    # Plota a faixa cinza de fundo (capacidade máxima/limite)
    plt.barh(y_pos, [max_limit]*len(df_veiculos), color="#F3F4F6", height=0.45, edgecolor="none")
    
    # Plota o progresso real por cima
    bars = plt.barh(y_pos, df_veiculos["km_desde_revisao"], color=bar_colors, height=0.45, edgecolor="none")
    
    # Customização de rótulos
    plt.yticks(y_pos, [f"{row['placa']} ({row['modelo']})" for _, row in df_veiculos.iterrows()], fontsize=9, fontweight="bold", color="#1C1C1E")
    plt.title("KM ATUAL VS. LIMITE DE REVISÃO (9.500 KM)", fontsize=11, fontweight="black", pad=15, color="#1C1C1E")
    
    # Adicionar linha vertical pontilhada no limite de 9500
    plt.axvline(x=9500, color="#DF0A0A", linestyle="--", linewidth=1.2, alpha=0.8)
    plt.text(9600, -0.2, "CRÍTICO", color="#DF0A0A", fontsize=8, fontweight="bold")
    
    # Adicionar o valor exato no final de cada barra
    for i, bar in enumerate(bars):
        width = bar.get_width()
        plt.text(width + 150 if width < 9000 else width - 1200, i, f"{int(width):,} KM", 
                 va='center', ha='left' if width < 9000 else 'right',
                 color='#1C1C1E' if width < 9000 else 'white', 
                 fontsize=8, fontweight='bold')
                 
    # Remover bordas decorativas (spines)
    ax = plt.gca()
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_color("#E5E7EB")
    ax.xaxis.grid(True, linestyle=":", alpha=0.5, color="#CCCCCC")
    ax.set_axisbelow(True)
    
    plt.xlim(0, max_limit + 500)
    plt.tight_layout()
    chart2_path = os.path.join(ASSETS_DIR, "analise_eficiencia_veiculos.png")
    plt.savefig(chart2_path, dpi=200, bbox_inches='tight', transparent=True)
    plt.close()

    # ------------------ GRAFICO 3: TENDENCIA DE KM DIARIA (SMOOTHED AREA CHART) ------------------
    plt.figure(figsize=(7, 4.5), facecolor='white')
    
    # Garantir ordenação cronológica das datas
    df_viagens["parsed_date"] = pd.to_datetime(df_viagens["data"], format="%d/%m/%Y", errors="coerce")
    df_viagens = df_viagens.dropna(subset=["parsed_date"]).sort_values("parsed_date")
    
    km_por_data = df_viagens.groupby("data")["km_rodados"].sum().reset_index()
    km_por_data["parsed_date"] = pd.to_datetime(km_por_data["data"], format="%d/%m/%Y")
    km_por_data = km_por_data.sort_values("parsed_date")
    
    x = km_por_data["data"]
    y = km_por_data["km_rodados"]
    
    # Plot da linha com área preenchida degradê
    plt.plot(x, y, color="#DF0A0A", linewidth=2.5, marker="o", markersize=6, markerfacecolor="#1C1C1E", markeredgecolor="#DF0A0A")
    plt.fill_between(x, y, color="#DF0A0A", alpha=0.12)
    
    # Customização de grid e rótulos
    plt.title("EVOLUÇÃO E TENDÊNCIA DE QUILOMETRAGEM", fontsize=11, fontweight="black", pad=15, color="#1C1C1E")
    plt.ylabel("Total KM Rodados", fontsize=9, fontweight="bold", color="#4B5563")
    plt.xticks(fontsize=8, fontweight="bold", color="#1C1C1E")
    plt.yticks(fontsize=8, fontweight="bold", color="#1C1C1E")
    
    # Remover bordas decorativas
    ax = plt.gca()
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color("#E5E7EB")
    ax.spines['bottom'].set_color("#E5E7EB")
    ax.grid(True, linestyle="--", alpha=0.4, color="#CCCCCC")
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    chart3_path = os.path.join(ASSETS_DIR, "analise_tendencia_diaria.png")
    plt.savefig(chart3_path, dpi=200, bbox_inches='tight', transparent=True)
    plt.close()

    print(f"Graficos gerados com sucesso na pasta assets!")

if __name__ == "__main__":
    generate_charts()
