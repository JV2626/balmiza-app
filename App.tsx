import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { LoginScreen } from './src/screens/LoginScreen';
import { DriverHomeScreen } from './src/screens/DriverHomeScreen';
import { AdminTabNavigator } from './src/screens/Admin/AdminTabNavigator';
import { DamageReportScreen } from './src/screens/DamageReportScreen';
import { FleetManagementScreen } from './src/screens/FleetManagementScreen';
import { TeamManagementScreen } from './src/screens/TeamManagementScreen';
import { FavoriteLocationsScreen } from './src/screens/FavoriteLocationsScreen';
import { EmployeesManagementScreen } from './src/screens/EmployeesManagementScreen';
import { TripsHistoryScreen } from './src/screens/TripsHistoryScreen';
import { DriverHistoryScreen } from './src/screens/DriverHistoryScreen';
import { colors } from './src/theme/colors';
import { getFirebaseAuth, getFirebaseDb } from './src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Configura como o app lida com notificações recebidas em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          const cleanEmail = user.email!.toLowerCase().trim();
          const db = getFirebaseDb();
          const userDoc = await getDoc(doc(db, 'usuarios', cleanEmail));
          
          let actualRole = 'driver';
          if (userDoc.exists()) {
            actualRole = userDoc.data().role || 'driver';
          } else {
            // Fallback para primeiro acesso
            actualRole = cleanEmail.startsWith('admin@') ? 'admin' : 'driver';
          }
          
          await AsyncStorage.setItem('@userId', user.uid);
          await AsyncStorage.setItem('@userRole', actualRole);
          await AsyncStorage.setItem('@userEmail', cleanEmail);
          
          setInitialRoute(actualRole === 'admin' ? 'Admin' : 'Home');
        } else {
          // Garante a limpeza total no logout
          await AsyncStorage.removeItem('@userId');
          await AsyncStorage.removeItem('@userRole');
          await AsyncStorage.removeItem('@userEmail');
          setInitialRoute('Login');
        }
      } catch (e) {
        setInitialRoute('Login');
      }
    });

    return () => unsubscribe();
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  const renderApp = () => (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={DriverHomeScreen} />
        <Stack.Screen name="Admin" component={AdminTabNavigator} />
        <Stack.Screen name="DamageReport" component={DamageReportScreen} />
        <Stack.Screen name="FleetManagement" component={FleetManagementScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EmployeesManagement" component={EmployeesManagementScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FavoriteLocations" component={FavoriteLocationsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TripsHistory" component={TripsHistoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DriverHistory" component={DriverHistoryScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {renderApp()}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB', // Fundo cinza para simular o desktop
    justifyContent: 'center',
    alignItems: 'center',
  },
  webCard: {
    width: '100%',
    maxWidth: 1024, // Limita a largura do App no monitor do PC
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
});
