import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Animated, 
  StyleSheet, 
  ImageBackground, 
  Text, 
  Dimensions,
  Platform,
  BackHandler,
  Vibration 
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Transition duration
const TRANSITION_DURATION = Platform.OS === 'android' ? 4500 : 5000;

// Confetti component for more visual interest
const Confetti = () => {
  const confettiPieces = Array(30).fill(0).map(() => ({
    translateY: useRef(new Animated.Value(-50)).current,
    translateX: useRef(new Animated.Value(Math.random() * width - width/2)).current,
    rotate: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
    color: ['#FFD700', '#FF6347', '#4169E1', '#32CD32', '#FF69B4'][Math.floor(Math.random() * 5)]
  }));

  useEffect(() => {
    confettiPieces.forEach((piece, index) => {
      // Platform-specific animation timing
      const duration = Platform.OS === 'android' ? 
        2500 + (index % 5) * 300 : 
        3000 + (index % 5) * 500;
      
      Animated.parallel([
        Animated.timing(piece.translateY, {
          toValue: height * 0.8,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(piece.translateX, {
          toValue: piece.translateX._value + (Math.random() * 200 - 100),
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotate, {
          toValue: 360,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(piece.scale, {
            toValue: 1 + Math.random() * 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(piece.scale, {
            toValue: 0,
            duration: duration - 500,
            useNativeDriver: true,
          })
        ])
      ]).start();
    });
    
    // Cleanup animations
    return () => {
      confettiPieces.forEach(piece => {
        piece.translateY.stopAnimation();
        piece.translateX.stopAnimation();
        piece.rotate.stopAnimation();
        piece.scale.stopAnimation();
      });
    };
  }, []);

  return (
    <View style={styles.confettiContainer}>
      {confettiPieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confetti,
            {
              backgroundColor: piece.color,
              transform: [
                { translateY: piece.translateY },
                { translateX: piece.translateX },
                { rotate: piece.rotate.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg'],
                })},
                { scale: piece.scale }
              ]
            }
          ]}
        />
      ))}
    </View>
  );
};

// Spotlight effect for dramatic reveal
const Spotlight = () => {
  const spotlightScale = useRef(new Animated.Value(0)).current;
  const spotlightOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start with delay to coincide with drumroll
    const delay = Platform.OS === 'android' ? 2500 : 3000;
    
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(spotlightScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(spotlightOpacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        })
      ]).start();
    }, delay);
    
    // Cleanup
    return () => {
      spotlightScale.stopAnimation();
      spotlightOpacity.stopAnimation();
    };
  }, []);

  return (
    <Animated.View 
      style={[
        styles.spotlightContainer,
        {
          opacity: spotlightOpacity,
          transform: [{ scale: spotlightScale }]
        }
      ]}
    >
      <LinearGradient
        colors={['rgba(255, 215, 0, 0.8)', 'rgba(255, 215, 0, 0)']}
        style={styles.spotlight}
        start={{x: 0.5, y: 0.5}}
        end={{x: 1, y: 1}}
      />
    </Animated.View>
  );
};

const WinnerTransitionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { 
    playerData, 
    timestamp, 
    isMultiplayer = false, 
    packStats, 
    packName: directPackName, 
    selectedPack: directSelectedPack 
  } = route.params || {};
  
  const [firstTextOpacity] = useState(new Animated.Value(0));
  const [secondTextOpacity] = useState(new Animated.Value(0));
  const [multiplayerIconOpacity] = useState(new Animated.Value(0));
  const [sound, setSound] = useState(null);
  const [shakeAnimation] = useState(new Animated.Value(0));
  
  // Log the pack information received by WinnerTransition
  useEffect(() => {
    console.log('WinnerTransition received pack information:', {
      packStats,
      directPackName,
      directSelectedPack,
      routeParams: route.params
    });
    console.log('WinnerTransition received isMultiplayer:', isMultiplayer);
console.log('WinnerTransition navigating with isMultiplayer:', isMultiplayer);
  }, []);
  
  // Handle Android back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Prevent going back during transition animation
        return true;
      };
      
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  async function playDrumroll() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/Sounds/drumroll.mp3'),
        { volume: Platform.OS === 'android' ? 0.8 : 1.0 } // Slightly lower volume on Android
      );
      setSound(sound);
      
      // Configure audio mode for Android
      if (Platform.OS === 'android') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false,
        });
      }
      
      await sound.playAsync();
      
      // Add vibration on Android for drumroll
      if (Platform.OS === 'android') {
        try {
          // Create a drumroll vibration pattern
          const pattern = [];
          for (let i = 0; i < 20; i++) {
            pattern.push(50, 50);
          }
          Vibration.vibrate(pattern);
        } catch (e) {
          console.log('Vibration not available');
        }
      }
    } catch (error) {
      console.error('Error playing drumroll:', error);
    }
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync().catch(error => {
            console.error('Error unloading sound:', error);
          });
          
          // Stop vibration if it's still going
          if (Platform.OS === 'android') {
            Vibration.cancel();
          }
        }
      : undefined;
  }, [sound]);
  
  // Create shake animation for main text
  const shakeText = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true
      })
    ]).start(() => {
      // Repeat the animation after a short delay
      setTimeout(() => {
        shakeText();
      }, 2000);
    });
  };

  useEffect(() => {
    let isMounted = true;

    // Start multiplayer icon animation if in multiplayer mode
    if (isMultiplayer) {
      Animated.timing(multiplayerIconOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }

    // Start first text animation immediately
    Animated.timing(firstTextOpacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      if (isMounted) {
        shakeText(); // Start shaking animation after fade-in
      }
    });

    // Android-specific shorter delay
    const drumrollDelay = Platform.OS === 'android' ? 1800 : 2000;

    // Start second text animation and play the drumroll sound
    const secondTextTimer = setTimeout(() => {
      if (!isMounted) return;

      Animated.timing(secondTextOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();

      playDrumroll();
    }, drumrollDelay);

    // Navigate after drumroll/animations
    const navigationTimer = setTimeout(() => {
      if (!isMounted) return;

      const verifiedPlayerData = playerData.map(player => ({
        ...player,
        score: Number(player.score) || 0
      }));
      
      // Extract pack name from all possible sources
      const finalPackName = directPackName || 
                           directSelectedPack || 
                           packStats?.packName || 
                           packStats?.name || 
                           packStats?.selectedPack || 
                           "Trivia Pack";
      
      console.log('WinnerTransition navigating with pack name:', finalPackName);
      
      // Enhanced navigation with redundant pack information
      navigation.replace('ResultsScreen', {
        playerData: verifiedPlayerData,
        packStats: {
          ...packStats,
          packName: finalPackName,
          name: finalPackName,
          selectedPack: finalPackName
        },
        packName: finalPackName,
        selectedPack: finalPackName,
        isMultiplayer: isMultiplayer,
        timestamp: Date.now()
      });
    }, TRANSITION_DURATION);

    return () => {
      isMounted = false;
      clearTimeout(secondTextTimer);
      clearTimeout(navigationTimer);
      if (sound) {
        sound.stopAsync().catch(() => {});
      }
      
      // Stop vibration if it's still going
      if (Platform.OS === 'android') {
        Vibration.cancel();
      }
    };
  }, []);

  return (
    <ImageBackground 
      source={require('../assets/questionscreen.jpg')} 
      style={styles.container}
      // Android-specific image loading optimization
      {...(Platform.OS === 'android' ? { 
        resizeMethod: 'resize',
        resizeMode: 'cover'
      } : {})}
    >
      <Confetti />
      <Spotlight />
      
      {isMultiplayer && (
        <Animated.View 
          style={[
            styles.multiplayerBanner, 
            { opacity: multiplayerIconOpacity },
            Platform.OS === 'android' ? styles.multiplayerBannerAndroid : {}
          ]}
        >
          <Ionicons name="people" size={18} color="#FFFFFF" />
          <Text style={[
            styles.multiplayerText,
            Platform.OS === 'android' ? styles.multiplayerTextAndroid : {}
          ]}>Multiplayer Mode</Text>
        </Animated.View>
      )}
      
      <View style={styles.contentContainer}>
        <Animatable.View 
          animation="pulse" 
          easing="ease-out" 
          iterationCount="infinite"
          duration={2000}
          style={styles.pulseContainer}
        >
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 215, 0, 0)', 'rgba(255, 215, 0, 0.1)']}
            style={styles.gradientPulse}
            start={{x: 0, y: 0.5}}
            end={{x: 1, y: 0.5}}
          />
        </Animatable.View>
        
        <View style={styles.messageContainer}>
          <View style={[
            styles.questionNumberWrapper,
            Platform.OS === 'android' ? styles.questionNumberWrapperAndroid : {}
          ]}>
            <Animated.Text 
              style={[
                styles.mainText, 
                { 
                  opacity: firstTextOpacity,
                  transform: [
                    { translateX: shakeAnimation }
                  ] 
                },
                Platform.OS === 'android' ? styles.mainTextAndroid : {}
              ]}
            >
              AND THE WINNER IS!
            </Animated.Text>
            <View style={styles.questionNumberUnderline} />
          </View>
          
          <View style={[
            styles.waitingContainer,
            Platform.OS === 'android' ? styles.waitingContainerAndroid : {}
          ]}>
            <Animated.Text 
              style={[
                styles.secondaryText, 
                { opacity: secondTextOpacity },
                Platform.OS === 'android' ? styles.secondaryTextAndroid : {}
              ]}
            >
              Drumroll please...
            </Animated.Text>
            
            {/* Add some animated sparkles */}
            <Animatable.View 
              animation="flash" 
              iterationCount="infinite"
              duration={1000}
              style={styles.sparkleContainer}
            >
              <Text style={styles.sparkle}>✨</Text>
              <Text style={styles.sparkle}>✨</Text>
              <Text style={styles.sparkle}>✨</Text>
            </Animatable.View>
          </View>
        </View>
      </View>
      
      {/* Trophy icon that slides up at the bottom */}
      <Animatable.View
        animation="slideInUp"
        duration={1000}
        delay={2500}
        style={styles.trophyContainer}
      >
        <Ionicons 
          name="trophy" 
          size={Platform.OS === 'android' ? 70 : 80} 
          color="#FFD700" 
        />
      </Animatable.View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A237E',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  messageContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 30,
  },
  questionNumberWrapper: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
  },
  // Android-specific wrapper styling
  questionNumberWrapperAndroid: {
    borderWidth: 1.5, // Thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 8, // Use elevation for shadow effect
    paddingVertical: 12, // Slightly smaller padding
  },
  questionNumberUnderline: {
    height: 2,
    backgroundColor: '#FFD700',
    width: '100%',
    marginTop: 8,
    opacity: 0.7,
  },
  waitingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  // Android-specific container styling
  waitingContainerAndroid: {
    borderWidth: 1.5, // Thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 8, // Use elevation for shadow effect
    padding: 16, // Slightly smaller padding
  },
  mainText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific main text styling
  mainTextAndroid: {
    fontSize: 36, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 4, // Use elevation instead of text shadow
  },
  secondaryText: {
    fontSize: 32,
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific secondary text styling
  secondaryTextAndroid: {
    fontSize: 28, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 3, // Use elevation instead of text shadow
  },
  multiplayerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 100, 255, 0.7)',
    paddingVertical: 8,
    width: '100%',
  },
  // Android-specific banner styling
  multiplayerBannerAndroid: {
    paddingVertical: 6, // Slightly smaller padding
    backgroundColor: 'rgba(0, 100, 255, 0.8)', // Slightly more opaque for better visibility
    elevation: 3, // Add elevation for better look
  },
  multiplayerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific multiplayer text styling
  multiplayerTextAndroid: {
    fontSize: 14, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2, // Use elevation instead of text shadow
  },
  // New styles for visual enhancements
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 20,
    borderRadius: 2,
  },
  sparkleContainer: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'center',
  },
  sparkle: {
    fontSize: Platform.OS === 'android' ? 22 : 24,
    marginHorizontal: 10,
  },
  trophyContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 20 : 30,
    alignSelf: 'center',
    zIndex: 10,
  },
  pulseContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientPulse: {
    width: '200%',
    height: '200%',
    position: 'absolute',
  },
  spotlightContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotlight: {
    width: '120%',
    height: '120%',
    borderRadius: 600,
  }
});

export default WinnerTransitionScreen;