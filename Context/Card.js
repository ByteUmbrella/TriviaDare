import React, { useState, useEffect, memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { 
  Easing, 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';

const Card = memo(({ pack, dare }) => {
  const [flipped, setFlipped] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const translateY = useSharedValue(300); // Start off-screen
  
  // Use additional animation values for Android
  const opacity = useSharedValue(0);
  const scale = useSharedValue(Platform.OS === 'android' ? 0.95 : 1);

  useEffect(() => {
    if (__DEV__) {
      console.log('Card component mounted');
      console.log('Pack:', pack);
      console.log('Dare:', dare);
    }
    
    // Clean up function
    return () => {
      // Reset animation values to help with Android memory management
      translateY.value = 300;
      opacity.value = 0;
      scale.value = Platform.OS === 'android' ? 0.95 : 1;
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value }
      ],
      opacity: opacity.value
    };
  });

  const flipCard = () => {
    // Use different animation timing based on platform
    const duration = Platform.OS === 'android' ? 250 : 300;
    
    scale.value = withTiming(0.9, {
      duration: duration / 2,
      easing: Easing.out(Easing.cubic),
    }, () => {
      runOnJS(setFlipped)(!flipped);
      scale.value = withTiming(1, {
        duration: duration / 2,
        easing: Easing.in(Easing.cubic),
      });
    });
  };

  // Optimize animations for Android
  useEffect(() => {
    const duration = Platform.OS === 'android' ? 400 : 500;
    
    // First fade in
    opacity.value = withTiming(1, {
      duration: duration / 2,
      easing: Easing.in(Easing.quad),
    });
    
    // Then slide up
    translateY.value = withTiming(0, {
      duration: duration,
      easing: Easing.out(Easing.exp),
    });
    
    // Finally scale to normal size (Android only)
    if (Platform.OS === 'android') {
      scale.value = withTiming(1, {
        duration: duration,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, []);

  // Handle image loading for Android
  const onImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <TouchableOpacity 
        onPress={flipCard}
        activeOpacity={0.8}
        style={styles.touchable}
      >
        {flipped ? (
          <View style={styles.dareContainer}>
            <Text style={styles.dareText}>{dare}</Text>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            {!imageLoaded && Platform.OS === 'android' && (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            <Image 
              source={pack.image} 
              style={[
                styles.image, 
                Platform.OS === 'android' && { opacity: imageLoaded ? 1 : 0 }
              ]} 
              onLoad={onImageLoad}
              resizeMode="cover"
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 300,
    height: 400,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      android: {
        elevation: 5
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      }
    })
  },
  touchable: {
    width: '100%',
    height: '100%',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  dareContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  dareText: {
    fontSize: Platform.OS === 'android' ? 22 : 24,
    textAlign: 'center',
    color: '#333',
    fontWeight: '500',
  },
});

export default Card;