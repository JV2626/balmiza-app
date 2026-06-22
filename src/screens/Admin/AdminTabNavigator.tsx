import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminDashboardScreen } from '../AdminDashboardScreen';
import { AdminActiveTripsScreen } from '../AdminActiveTripsScreen';
import { AdminDispatchScreen } from '../AdminDispatchScreen';
import { AdminDamageReportsScreen } from '../AdminDamageReportsScreen';
import { AdminSettingsScreen } from '../AdminSettingsScreen';
import { AIAssistantTab } from './AIAssistantTab';
import { RealTimeAlerts } from '../../components/RealTimeAlerts';

const Tab = createBottomTabNavigator();

export const AdminTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 10) : insets.bottom;

  return (
    <>
      <RealTimeAlerts />
      <Tab.Navigator
        screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#DF0A0A', // Balmiza Brand Primary (Red)
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: bottomPadding,
          paddingTop: 8,
          height: 65 + bottomPadding,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          textTransform: 'uppercase'
        }
      }}
    >
      <Tab.Screen 
        name="Painel" 
        component={AdminDashboardScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-box" size={26} color={color} />
        }}
      />
      <Tab.Screen 
        name="Ativas" 
        component={AdminActiveTripsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="map-marker-path" size={26} color={color} />
        }}
      />
      <Tab.Screen 
        name="Despacho IA" 
        component={AdminDispatchScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="robot-outline" size={26} color={color} />
        }}
      />
      <Tab.Screen 
        name="Chat IA" 
        component={AIAssistantTab} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="robot-happy" size={26} color={color} />
        }}
      />
      <Tab.Screen 
        name="Avarias" 
        component={AdminDamageReportsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="car-wrench" size={26} color={color} />
        }}
      />
      <Tab.Screen 
        name="Ajustes" 
        component={AdminSettingsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" size={26} color={color} />
        }}
      />
    </Tab.Navigator>
    </>
  );
};
