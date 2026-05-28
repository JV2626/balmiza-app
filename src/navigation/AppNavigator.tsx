import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import DriverHomeScreen from '../screens/DriverHomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { COLORS } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.5,
          },
          tabBarIcon: ({ color, size, focused }) => {
            let iconName: keyof typeof Ionicons.prototype.placeholder | string = '';

            if (route.name === 'Rotas de Hoje') {
              iconName = focused ? 'navigate' : 'navigate-outline';
            } else if (route.name === 'Meu Histórico') {
              iconName = focused ? 'time' : 'time-outline';
            }

            return <Ionicons name={iconName as any} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Rotas de Hoje" component={DriverHomeScreen} />
        <Tab.Screen name="Meu Histórico" component={HistoryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
export default AppNavigator;
