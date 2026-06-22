import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  lat: number; // Backwards compatibility
  lon: number; // Backwards compatibility
}

// Higieniza o endereço de forma inteligente antes de enviar à API
// remove ruídos como nomes de bairros e parênteses que confundem o Nominatim
export const cleanAddressForGeocoding = (address: string): string => {
  if (!address) return '';
  
  // 1. Remover tudo o que estiver entre parênteses, ex: "(Pacaembu II)"
  let clean = address.replace(/\(.*?\)/g, '');
  
  // 2. Remover nomes de bairros comuns se houver hífen, ex: "Rua Nelson de Moraes, 391 - Vila Mazzei" -> "Rua Nelson de Moraes, 391"
  // Nominatim funciona muito melhor sem o nome do bairro, apenas com Rua, Número e Cidade.
  const parts = clean.split('-');
  if (parts.length > 1) {
    if (/\d/.test(parts[0])) {
      clean = parts[0];
    }
  }
  
  clean = clean.trim().replace(/\s+/g, ' ');

  // 3. Adicionar restrição da cidade se não houver cidade polo na busca
  const lower = clean.toLowerCase();
  if (!lower.includes('tatuí') && !lower.includes('tatui') && !lower.includes('sorocaba') && !lower.includes('boituva') && !lower.includes('itapetininga')) {
    clean += ', Itapetininga, SP, Brasil';
  }
  
  return clean;
};

export const geocodeAddress = async (address: string): Promise<GeocodeResult | null> => {
  if (!address) return null;
  const cleanAddress = address.trim();

  // 1. Tentar ler do Cache do Firestore
  const db = getFirebaseDb();
  const cacheKey = cleanAddress.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
  const cacheRef = doc(db, 'geocoding_cache', cacheKey);

  try {
    const cacheSnap = await getDoc(cacheRef);
    if (cacheSnap.exists()) {
      const data = cacheSnap.data();
      console.log(`[Cache Hit] Endereço recuperado do cache do Firestore: ${cleanAddress}`);
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        lat: data.latitude,
        lon: data.longitude
      };
    }
  } catch (err) {
    console.log('Erro ao ler cache de geocoding no Firestore', err);
  }

  // 2. Higienizar a string de endereço para a busca
  const queryStr = cleanAddressForGeocoding(cleanAddress);
  console.log(`[Geocoding Request] Enviando busca higienizada para Nominatim: "${queryStr}" (Original: "${cleanAddress}")`);

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BalmizaApp/1.0 (contact@balmiza.com)' }
    });

    if (response.status === 200) {
      const data = await response.json();
      if (data && data.length > 0) {
        let lat = parseFloat(data[0].lat);
        let lon = parseFloat(data[0].lon);

        // 3. Guardrail Geográfico (Itapetininga / Tatuí / Sorocaba / Boituva)
        // Se a busca retornar uma coordenada fora dos limites da nossa região de operação,
        // força a centralização em Itapetininga para evitar navegação a São Paulo (170km) ou outros lugares errados.
        const minLat = -24.2;
        const maxLat = -23.0;
        const minLon = -48.4;
        const maxLon = -47.2;

        if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
          console.warn(`[Geocoding Guardrail] Coordenada retornada (${lat}, ${lon}) está fora da área de operação! Forçando centro de Itapetininga.`);
          lat = -23.5916;
          lon = -48.0531;
        }

        // Salvar no Cache do Firestore
        try {
          await setDoc(cacheRef, {
            originalAddress: cleanAddress,
            searchQueryUsed: queryStr,
            latitude: lat,
            longitude: lon,
            createdAt: new Date()
          });
          console.log(`[Cache Miss & Write] Geolocalização salva no Firestore para: ${cleanAddress}`);
        } catch (cacheErr) {
          console.log('Falha ao salvar dados de geocoding no cache do Firestore', cacheErr);
        }

        return { 
          latitude: lat, 
          longitude: lon,
          lat: lat,
          lon: lon
        };
      }
    }
  } catch (e) {
    console.log('Erro ao fazer geocoding', e);
  }

  // Fallback final: Centro de Itapetininga
  return {
    latitude: -23.5916,
    longitude: -48.0531,
    lat: -23.5916,
    lon: -48.0531
  };
};
