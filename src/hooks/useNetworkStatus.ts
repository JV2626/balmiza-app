import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Hook para monitorar o status da conexão de rede.
 * Funciona no web (navigator.onLine) e no nativo (NetInfo via fetch test).
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // No web, usar os eventos nativos do browser
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // No celular, testar conectividade a cada 5 segundos
      setIsOnline(true);
      let timer: ReturnType<typeof setInterval>;
      const checkConnection = async () => {
        try {
          const response = await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            cache: 'no-cache',
          });
          setIsOnline(response.ok);
        } catch {
          setIsOnline(false);
        }
      };

      checkConnection();
      timer = setInterval(checkConnection, 5000);
      return () => clearInterval(timer);
    }
  }, []);

  return isOnline;
};
