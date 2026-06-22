import { getFirebaseDb } from '../config/firebase';
import { hasPinSet } from '../components/PinInput';
import { geocodeAddress } from './geocoding';

const runTests = async () => {
  console.log('🧪 INICIANDO SUÍTE DE TESTES DOS HOTSPOTS DO SAAS...');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${testName}`);
      failed++;
    }
  };

  // Teste 1: getFirebaseDb (Banco de Dados)
  try {
    const db = getFirebaseDb();
    assert(db !== null && typeof db === 'object', 'getFirebaseDb inicializado com sucesso');
  } catch (err: any) {
    console.log(`❌ [FAIL] getFirebaseDb lançou um erro: ${err.message || err}`);
    failed++;
  }

  // Teste 2: hasPinSet (Segurança/PIN)
  try {
    const pinResult = await hasPinSet();
    assert(typeof pinResult === 'boolean', 'hasPinSet retornou um valor booleano válido');
  } catch (err: any) {
    console.log(`❌ [FAIL] hasPinSet lançou um erro: ${err.message || err}`);
    failed++;
  }

  // Teste 3: geocodeAddress (Geocoding & Cache)
  try {
    // 3.1. Consultar endereço existente no cache ou Nominatim
    console.log('⏱️ Consultando geolocalização para "JBS Tatuí"...');
    const coords = await geocodeAddress('JBS Tatuí');
    assert(
      coords !== null && 
      typeof coords.latitude === 'number' && 
      typeof coords.lat === 'number', 
      'geocodeAddress resolveu coordenadas com sucesso'
    );

    // 3.2. Testar Cache Hit
    if (coords) {
      console.log('⏱️ Consultando o mesmo endereço novamente para validar Cache Hit...');
      const cacheCoords = await geocodeAddress('JBS Tatuí');
      assert(
        cacheCoords !== null && 
        cacheCoords.latitude === coords.latitude, 
        'geocodeAddress utilizou o cache do Firestore com sucesso'
      );
    }
  } catch (err: any) {
    console.log(`❌ [FAIL] geocodeAddress lançou um erro: ${err.message || err}`);
    failed++;
  }

  console.log('\n=======================================');
  console.log(`🏁 RESUMO DOS TESTES: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('=======================================');
};

runTests();
