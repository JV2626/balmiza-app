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
              await auth.signOut();
              await AsyncStorage.clear();
              setUserRole(null);
              setLoading(false);
              return;
            }
            role = (uData?.role as 'driver' | 'admin') || 'driver';
          } else {
            role = 'driver';
          }

          // Atualizar AsyncStorage com informações confiáveis vindas do Firestore
          await AsyncStorage.setItem('@userId', user.uid);
          await AsyncStorage.setItem('@userRole', role);
          if (cleanEmail) {
            await AsyncStorage.setItem('@userEmail', cleanEmail);
          }
          
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
                setUserRole(role);
              } else {
                await auth.signOut();
                await AsyncStorage.clear();
                setUserRole(null);
              }
            } else {
              setUserRole(role);
            }
          } else {
            setUserRole(role);
          }
        } else {
          setUserRole(null);
        }
      } catch (e) {
        console.log('Erro na validação de sessão:', e);
        setUserRole(null);
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userRole === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : userRole === 'admin' ? (
          <>
            <Stack.Screen name="Admin" component={AdminTabNavigator} />
            <Stack.Screen name="EmployeesManagement" component={EmployeesManagementScreen} />
            <Stack.Screen name="FavoriteLocations" component={FavoriteLocationsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={DriverHomeScreen} />
            <Stack.Screen name="DamageReport" component={DamageReportScreen} />
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
