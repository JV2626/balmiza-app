import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '../config/firebase';
import { colors } from '../theme/colors';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const auth = getFirebaseAuth();
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      
      const uid = userCredential.user!.uid;
      const isAdmin = email.startsWith('admin@');
      
      await AsyncStorage.setItem('@userId', uid);
      await AsyncStorage.setItem('@userRole', isAdmin ? 'admin' : 'driver');
      await AsyncStorage.setItem('@userEmail', email.toLowerCase().trim());
      
      if (isAdmin) {
        navigation.replace('Admin');
      } else {
        navigation.replace('Home');
      }
    } catch (error: any) {
      console.log('Login Error:', error);
      const msg = error.message || 'Erro ao realizar login';
      setErrorMessage(msg);
      
      if (Platform.OS === 'web') {
        window.alert('Erro no Login: ' + msg);
      } else {
        Alert.alert('Erro no Login', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Grupo Balmiza</Text>
        <Text style={styles.subtitle}>Portal Operacional</Text>
        
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#999"
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Acessar Plataforma</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    width: 80,
    height: 100,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.graphite,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.graphiteLight,
    textAlign: 'center',
    marginBottom: 40,
    marginTop: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
    fontSize: 16,
    color: colors.graphite,
  },
  errorText: {
    color: colors.red,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.red,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
