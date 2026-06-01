import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DashboardTab } from './DashboardTab';
import { ShiftsTab } from './ShiftsTab';
import { ComplianceTab } from './ComplianceTab';
import { colors } from '../../theme/colors';

const Tab = createBottomTabNavigator();

export const AdminTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.graphiteLight,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        }
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardTab} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-box" size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Escalas" 
        component={ShiftsTab} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-clock" size={size} color={color} />
        }}
      />
      <Tab.Screen 
        name="Compliance" 
        component={ComplianceTab} 
        options={{
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-check" size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};
