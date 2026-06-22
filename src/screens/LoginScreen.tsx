import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Image, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirebaseAuth, getFirebaseDb } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { colors } from '../theme/colors';
import { PinInput, hasPinSet } from '../components/PinInput';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPinVerify, setShowPinVerify] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Valores de animação
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(35)).current;

  useEffect(() => {
    checkPin();

    // Iniciar animação do card de login
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const checkPin = async () => {
    const pinExists = await hasPinSet();
    if (pinExists) {
      setShowPinVerify(true);
    }
  };

  const navigateAfterAuth = async () => {
    const role = await AsyncStorage.getItem('@userRole');
    if (role === 'admin') {
      navigation.replace('Admin');
    } else {
      navigation.replace('Home');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      const emptyMsg = 'Preencha o e-mail e a senha';
      setErrorMessage(emptyMsg);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage('');
      const auth = getFirebaseAuth();
      const userCredential = await auth.signInWithEmailAndPassword(email.trim(), password);
      
      const uid = userCredential.user!.uid;
      const cleanEmail = email.toLowerCase().trim();

      const db = getFirebaseDb();
      const userRef = doc(db, 'usuarios', cleanEmail);
      const userSnap = await getDoc(userRef);

      let userRole = 'driver';
      if (userSnap.exists()) {
        const uData = userSnap.data();
        userRole = uData.role || 'driver';
      } else {
        userRole = 'driver'; // Papel padrão sempre driver. Admin deve ser atribuído manualmente no banco de dados.
        await setDoc(userRef, {
          email: cleanEmail,
          role: userRole,
          nome: cleanEmail.split('@')[0].toUpperCase(),
          createdAt: new Date()
        }, { merge: true });
      }
      
      await AsyncStorage.setItem('@userId', uid);
      await AsyncStorage.setItem('@userRole', userRole);
      await AsyncStorage.setItem('@userEmail', cleanEmail);
      
      const pinExists = await hasPinSet();
      if (pinExists) {
        setShowPinVerify(true);
        return;
      }
      if (userRole === 'admin') {
        navigation.replace('Admin');
      } else {
        navigation.replace('Home');
      }
    } catch (error: any) {
      console.log('Login Error:', error);
      let userFriendlyMsg = 'E-mail ou senha incorretos. Por favor, tente novamente.';
      if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        userFriendlyMsg = 'E-mail ou senha incorretos.';
      } else if (error.code === 'auth/network-request-failed') {
        userFriendlyMsg = 'Erro de rede. Verifique sua conexão com a internet.';
      }
      setErrorMessage(userFriendlyMsg);
      
      if (Platform.OS === 'web') {
        window.alert('Erro no Login: ' + userFriendlyMsg);
      } else {
        Alert.alert('Erro no Login', userFriendlyMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient 
      colors={['#1C1C1E', '#09090A']} 
      style={styles.container}
    >
      <PinInput
        visible={showPinVerify}
        mode="verify"
        onSuccess={navigateAfterAuth}
        onCancel={() => setShowPinVerify(false)}
      />

      <Animated.View 
        style={[
          styles.card,
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }] 
          }
        ]}
      >
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.glowOverlay} />
        </View>

        <Text style={styles.title}>Grupo Balmiza</Text>
        <Text style={styles.subtitle}>Portal Operacional</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#8E8E93"
          />
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#8E8E93"
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity 
          style={[
            styles.button, 
            isHovered && styles.buttonHovered
          ]} 
          onPress={handleLogin} 
          disabled={loading}
          activeOpacity={0.85}
          // @ts-ignore (for web hover effects)
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <LinearGradient
              colors={['#DF0A0A', '#B90808']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Acessar Plataforma</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    padding: 35,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 8,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  logoContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  logo: {
    width: 90,
    height: 110,
    zIndex: 2,
  },
  glowOverlay: {
    position: 'absolute',
    width: 120,
    height: 120,
    backgroundColor: '#DF0A0A',
    opacity: 0.15,
    borderRadius: 60,
    top: -5,
    left: -15,
    zIndex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 35,
    marginTop: 6,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  inputContainer: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  input: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    color: '#FC8181',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
  },
  button: {
    borderRadius: 12,
    marginTop: 10,
    overflow: 'hidden',
    shadowColor: '#DF0A0A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonHovered: {
    transform: [{ scale: 1.02 }],
  },
  gradientButton: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
