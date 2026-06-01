import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

import { LoginScreen } from '../screens/LoginScreen';
import { DriverHomeScreen } from '../screens/DriverHomeScreen';
import { AdminTabNavigator } from '../screens/Admin/AdminTabNavigator';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Home' | 'Admin'>('Login');

  const checkSession = async () => {
    try {
      // Correção de Bug Crítico: Leitura correta do @userId e @userRole
      const storedId = await AsyncStorage.getItem('@userId');
      const role = await AsyncStorage.getItem('@userRole');
      
      if (storedId && role) {
         if (Platform.OS !== 'web') {
           const hasHardware = await LocalAuthentication.hasHardwareAsync();
           const isEnrolled = await LocalAuthentication.isEnrolledAsync();
           
           if (hasHardware && isEnrolled) {
              const authResult = await LocalAuthentication.authenticateAsync({
                 promptMessage: 'Acesso Restrito - Grupo Balmiza',
                 fallbackLabel: 'Usar Senha',
                 cancelLabel: 'Cancelar',
              });
              
              if (authResult.success) {
                 setInitialRoute(role === 'admin' ? 'Admin' : 'Home');
              } else {
                 setInitialRoute('Login');
              }
           } else {
              setInitialRoute(role === 'admin' ? 'Admin' : 'Home');
           }
         } else {
            // Web ou Sem Biometria, entra direto
            setInitialRoute(role === 'admin' ? 'Admin' : 'Home');
         }
      } else {
         setInitialRoute('Login');
      }
    } catch (e) {
      console.log('Erro ao ler AsyncStorage ou Biometria:', e);
      setInitialRoute('Login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        {/* Todas as telas declaradas para permitir a navegação (fix do Admin Crash) */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={DriverHomeScreen} />
        <Stack.Screen name="Admin" component={AdminTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
});

export default AppNavigator;
