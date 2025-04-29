import React, { useContext, useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  ImageBackground, 
  ScrollView, 
  SafeAreaView, 
  Dimensions,
  Platform,
  BackHandler
} from 'react-native';
import { GameContext } from '../Context/GameContext';
import accoladesData from '../assets/accolades.json';
import Icon from 'react-native-vector-icons/FontAwesome';
import { Image } from 'react-native';
import { useSettings } from '../Context/Settings';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Floating stars component for winner celebration
const FloatingStars = () => {
  const stars = Array(8).fill(0).map(() => ({
    translateY: useRef(new Animated.Value(0)).current,
    translateX: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
    rotate: useRef(new Animated.Value(0)).current,
  }));

  useEffect(() => {
    stars.forEach((star, index) => {
      const startPositionX = (index % 2 === 0 ? -1 : 1) * (Math.random() * 100 + 50);
      
      // Adjust animation duration for Android
      const duration = Platform.OS === 'android' 
        ? 2500 + (index * 400) 
        : 3000 + (index * 500);
      
      const animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(star.translateY, {
              toValue: -200 - (index * 30),
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(star.translateX, {
              toValue: startPositionX,
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(star.scale, {
              toValue: 1,
              duration: Platform.OS === 'android' ? 800 : 1000,
              useNativeDriver: true,
            }),
            Animated.timing(star.rotate, {
              toValue: 1,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(star.scale, {
            toValue: 0,
            duration: Platform.OS === 'android' ? 400 : 500,
            useNativeDriver: true,
          }),
        ])
      );
      // Stagger the start of animations
      setTimeout(() => animation.start(), index * (Platform.OS === 'android' ? 150 : 200));
    });
  }, []);

  return (
    <View style={styles.starsContainer}>
      {stars.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.star,
            {
              transform: [
                { translateY: star.translateY },
                { translateX: star.translateX },
                { scale: star.scale },
                {
                  rotate: star.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon name="star" size={30} color="#FFD700" />
        </Animated.View>
      ))}
    </View>
  );
};

// Shimmer effect component for winner's card
const ShimmerEffect = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    // Adjust animation timing for Android
    const duration = Platform.OS === 'android' ? 1200 : 1500;
    
    const shimmerOpacity = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: duration,
          useNativeDriver: true,
        }),
      ])
    );

    const shimmerTranslation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: width,
          duration: Platform.OS === 'android' ? 1600 : 2000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -width,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerOpacity.start();
    shimmerTranslation.start();
  }, []);

  return (
    <View style={styles.shimmerContainer}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1],
            }),
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

const EndGameScreen = ({ navigation, route }) => {
  const { players, resetGame } = useContext(GameContext);
  const { packName, completedDares } = route.params;
  const [accolades, setAccolades] = useState([]);
  const [animations, setAnimations] = useState([]);

  // Handle Android back button
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          handleReset();
          return true;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [])
  );

  useEffect(() => {
    if (!players || !completedDares) {
      console.error("Required data not available");
      return;
    }

    const availableAccolades = accoladesData[packName] || [];

    // Track used accolades to prevent duplicates
    const usedAccolades = new Set();
    
    const playerAccolades = players.map((player, index) => {
      const totalCompleted = completedDares[index];
      const range = availableAccolades.find(r => totalCompleted >= r.min && totalCompleted <= r.max);
      
      if (!range) return { player, totalCompleted, accolade: "Great effort!" };
      
      // Filter out already used accolades
      const availableAccoladesForPlayer = range.accolades.filter(a => !usedAccolades.has(a));
      
      // If all accolades have been used, fallback to using any accolade from the range
      const accoladePool = availableAccoladesForPlayer.length > 0 
        ? availableAccoladesForPlayer 
        : range.accolades;
        
      // Select a random accolade
      const accolade = accoladePool[Math.floor(Math.random() * accoladePool.length)];
      
      // Mark this accolade as used
      usedAccolades.add(accolade);
      
      return { player, totalCompleted, accolade };
    });

    playerAccolades.sort((a, b) => b.totalCompleted - a.totalCompleted);

    setAccolades(playerAccolades);
    setAnimations(playerAccolades.map(() => new Animated.Value(0)));
  }, [packName, players, completedDares]);

  useEffect(() => {
    if (animations.length > 0) {
      animations.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: Platform.OS === 'android' ? 400 : 500,
          delay: index * (Platform.OS === 'android' ? 400 : 500),
          useNativeDriver: true,
        }).start();
      });
    }
  }, [animations]);

  const handleReset = () => {
    resetGame();
    navigation.navigate('DarePackSelectionScreen');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground 
        source={require('../assets/endgamescreen.png')} 
        style={styles.background} 
        resizeMode="cover"
        fadeDuration={Platform.OS === 'android' ? 300 : 0}
      >
        <View style={styles.container}>
          <Text style={styles.title}></Text>
          <ScrollView 
            contentContainerStyle={styles.accoladesContainer}
            showsVerticalScrollIndicator={false}
          >
            {accolades.length > 0 && (
              <Animated.View 
                style={[
                  styles.card, 
                  styles.topPlayer, 
                  { 
                    opacity: animations[0], 
                    transform: [{ translateY: animations[0].interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                  }
                ]}
              >
                <ShimmerEffect />
                <FloatingStars />
                <Text style={styles.playerName}>{accolades[0].player}</Text>
                <View style={styles.daresContainer}>
                  <Image 
                    source={require('../assets/DaresOnly/yellowpokerchip.png')} 
                    style={styles.daresBackground}
                    fadeDuration={Platform.OS === 'android' ? 300 : 0}
                  />
                  <Text style={styles.counter}>{accolades[0].totalCompleted}</Text>
                </View>
                <Text style={styles.accolade}>{accolades[0].accolade}</Text>
              </Animated.View>
            )}
            <View style={styles.podium}>
              {accolades.slice(1, 3).map((accolade, index) => (
                <Animated.View 
                  key={index + 1} 
                  style={[
                    styles.card, 
                    styles.podiumPlayer, 
                    { 
                      opacity: animations[index + 1], 
                      transform: [{ translateY: animations[index + 1].interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                    }
                  ]}
                >
                  <Text style={styles.playerName}>{accolade.player}</Text>
                  <View style={styles.daresContainer}>
                    <Image 
                      source={require('../assets/DaresOnly/yellowpokerchip.png')} 
                      style={styles.daresBackground}
                      fadeDuration={Platform.OS === 'android' ? 300 : 0}
                    />
                    <Text style={styles.counter}>{accolade.totalCompleted}</Text>
                  </View>
                  <Text style={styles.accolade}>{accolade.accolade}</Text>
                </Animated.View>
              ))}
            </View>
            <View style={styles.horizontalLine} />
            <View style={styles.remainingPlayers}>
              {accolades.slice(3).map((accolade, index) => (
                <Animated.View 
                  key={index + 3} 
                  style={[
                    styles.card, 
                    styles.remainingPlayerCard, 
                    { 
                      opacity: animations[index + 3], 
                      transform: [{ translateY: animations[index + 3].interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                    }
                  ]}
                >
                  <Text style={styles.playerName}>{accolade.player}</Text>
                  <View style={styles.daresContainer}>
                    <Image 
                      source={require('../assets/DaresOnly/yellowpokerchip.png')} 
                      style={styles.daresBackground}
                      fadeDuration={Platform.OS === 'android' ? 300 : 0}
                    />
                    <Text style={styles.counter}>{accolade.totalCompleted}</Text>
                  </View>
                  <Text style={styles.accolade}>{accolade.accolade}</Text>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.playAgainButton]} 
              onPress={handleReset}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="refresh" size={20} color="#fff" style={styles.icon} />
              <Text style={styles.buttonText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.homeButton]} 
              onPress={() => { resetGame(); navigation.navigate('Home'); }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="home" size={20} color="#fff" style={styles.icon} />
              <Text style={styles.buttonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#003732',
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  background: {
    flex: 1,
    width: width,
    height: height,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5, // Less intensive shadow for Android
      }
    }),
  },
  accoladesContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: Platform.OS === 'android' ? 20 : 30, // Extra padding for Android
  },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    margin: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    width: width * 0.8,
    overflow: 'visible',
    ...Platform.select({
      android: {
        elevation: 4,
      }
    }),
  },
  daresContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  daresBackground: {
    width: 50,
    height: 50,
    position: 'absolute',
  },
  topPlayer: {
    backgroundColor: '#FFD700',
    width: width * 0.8,
    borderWidth: 3,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.8,
    marginBottom: 5,
  },
  podiumPlayer: {
    width: width * 0.35,
  },
  horizontalLine: {
    width: width * 0.8,
    height: 2,
    backgroundColor: 'white',
    marginVertical: 5,
  },
  remainingPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: width * 0.8,
  },
  remainingPlayerCard: {
    width: width * 0.4,
  },
  playerName: {
    fontSize: Platform.OS === 'android' ? 22 : 24, // Slightly smaller on Android
    fontWeight: 'bold',
  },
  accolade: {
    fontSize: Platform.OS === 'android' ? 16 : 18, // Slightly smaller on Android
    color: '#000',
    textAlign: 'center',
    marginVertical: 5,
  },
  counter: {
    fontSize: 16,
    color: '#000',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    marginTop: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 0, // Extra padding for Android
  },
  button: {
    padding: 15,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
  },
  homeButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  icon: {
    marginRight: 10,
  },
  starsContainer: {
    position: 'absolute',
    top: -50,
    left: -100,
    right: -100,
    bottom: -50,
    zIndex: 2,
    pointerEvents: 'none',
  },
  star: {
    position: 'absolute',
    zIndex: 2,
    top: '50%',
    left: '50%',
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 10,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    transform: [{ skewX: '-20deg' }],
    width: '100%',
  },
});

export default EndGameScreen;