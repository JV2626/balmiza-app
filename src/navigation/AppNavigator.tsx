import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

import { LoginScreen } from '../screens/LoginScreen';
import { DriverHomeScreen } from '../screens/DriverHomeScreen';
import { AdminTabNavigator } from '../screens/Admin/AdminTabNavigator';
import { DamageReportScreen } from '../screens/DamageReportScreen';
import { FavoriteLocationsScreen } from '../screens/FavoriteLocationsScreen';
import { EmployeesManagementScreen } from '../screens/EmployeesManagementScreen';

import { getFirebaseAuth, getFirebaseDb } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'driver' | 'admin' | null>(null);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Home' | 'Admin'>('Login');

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
          const db = getFirebaseDb();
          const userRef = doc(db, 'usuarios', cleanEmail);
          const userSnap = await getDoc(userRef);
          
          let role: 'driver' | 'admin' = 'driver';
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (uData && uData.ativo === false) {
              // Se o motorista está cadastrado mas foi desativado pelo administrador
              await auth.signOut();
              await AsyncStorage.clear();
              setUserRole(null);
              setInitialRoute('Login');
              setLoading(false);
              return;
            }
            role = (uData?.role as 'driver' | 'admin') || 'driver';
          } else {
            // Se o perfil do usuário ainda não existe no Firestore, assumimos o papel de 'driver' por padrão.
            // Isso evita deslogar o usuário em uma corrida de login durante a criação automática do seu perfil.
            role = 'driver';
          }

          // Atualizar AsyncStorage com informações confiáveis vindas do Firestore
          await AsyncStorage.setItem('@userId', user.uid);
          await AsyncStorage.setItem('@userRole', role);
          if (cleanEmail) {
            await AsyncStorage.setItem('@userEmail', cleanEmail);
          }
          
          setUserRole(role);

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
                await auth.signOut();
                await AsyncStorage.clear();
                setUserRole(null);
                setInitialRoute('Login');
              }
            } else {
              setInitialRoute(role === 'admin' ? 'Admin' : 'Home');
            }
          } else {
            setInitialRoute(role === 'admin' ? 'Admin' : 'Home');
          }
        } else {
          setUserRole(null);
          setInitialRoute('Login');
        }
      } catch (e) {
        console.log('Erro na validação de sessão:', e);
        setUserRole(null);
        setInitialRoute('Login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C1C1E" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={DriverHomeScreen} />
        <Stack.Screen name="DamageReport" component={DamageReportScreen} />

        {/* Telas administrativas protegidas e condicionalmente declaradas */}
        {userRole === 'admin' && (
          <>
            <Stack.Screen name="Admin" component={AdminTabNavigator} />
            <Stack.Screen name="EmployeesManagement" component={EmployeesManagementScreen} />
            <Stack.Screen name="FavoriteLocations" component={FavoriteLocationsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
});

export default AppNavigator;
