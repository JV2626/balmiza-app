import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: any;
  delay?: number;
  duration?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  style, 
  delay = 0, 
  duration = 500 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: duration,
          useNativeDriver: true,
        }),
      ])
    ]).start();
  }, [delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
