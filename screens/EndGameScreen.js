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
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { useSettings } from '../Context/Settings';
import { useFocusEffect } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Function to calculate responsive font sizes
const scaleFontSize = (size) => {
  const scaleFactor = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
  return Math.round(size * scaleFactor);
};

// BADGE OPTION 1: Gold Poker Chip Badge
const GoldPokerChipBadge = () => {
  return (
    <View style={styles.chipBadge}>
      <View style={styles.chipBadgeInner}>
        <View style={styles.chipBadgeRim} />
        <View style={styles.chipBadgeCenter}>
          <Text style={styles.chipBadgeText}>WINNER</Text>
        </View>
        {/* Create notches around the chip */}
        {[...Array(8)].map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.chipNotch, 
              { transform: [{ rotate: `${i * 45}deg` }] }
            ]} 
          />
        ))}
      </View>
    </View>
  );
};

// BADGE OPTION 2: Royal Flush Ribbon
const RoyalFlushRibbon = () => {
  return (
    <View style={styles.ribbonBadge}>
      <View style={styles.ribbonMain}>
        <Text style={styles.ribbonText}>WINNER</Text>
      </View>
      <View style={styles.ribbonTailLeft} />
      <View style={styles.ribbonTailRight} />
      <View style={styles.cardRow}>
        {['A', 'K', 'Q', 'J', '10'].map((card, index) => (
          <View key={index} style={styles.miniCard}>
            <Text style={styles.miniCardText}>{card}</Text>
            <Ionicons name="spade" size={8} color="black" style={styles.miniCardSuit} />
          </View>
        ))}
      </View>
    </View>
  );
};

// BADGE OPTION 3: Casino Jackpot Badge
const CasinoJackpotBadge = () => {
  // Create a star-shaped badge
  return (
    <View style={styles.jackpotBadge}>
      <View style={styles.jackpotStar}>
        {[...Array(5)].map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.starPoint, 
              { transform: [{ rotate: `${i * 72}deg` }] }
            ]} 
          />
        ))}
      </View>
      <View style={styles.jackpotInnerCircle}>
        <Ionicons name="diamond" size={16} color="#D32F2F" />
        <Text style={styles.jackpotText}>JACKPOT</Text>
        <Ionicons name="cash" size={16} color="#4CAF50" />
      </View>
    </View>
  );
};

// BADGE OPTION 4: Vegas-Style Winner Marquee
const VegasMarqueeBadge = () => {
  const [lightOn, setLightOn] = useState(true);

  // Blinking lights effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLightOn(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.marqueeBadge}>
      <View style={styles.marqueeBackground}>
        {/* Marquee lights */}
        <View style={styles.marqueeLightsContainer}>
          {[...Array(12)].map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.marqueeLight,
                lightOn && i % 2 === 0 ? styles.marqueeLightOn : null,
                !lightOn && i % 2 !== 0 ? styles.marqueeLightOn : null
              ]} 
            />
          ))}
        </View>
        <Text style={styles.marqueeText}>WINNER</Text>
      </View>
    </View>
  );
};

// BADGE OPTION 5: Gold Card Badge
const GoldCardBadge = () => {
  return (
    <View style={styles.cardBadge}>
      <View style={styles.cardBadgeInner}>
        <View style={styles.cardCorner}>
          <Text style={styles.cardAce}>A</Text>
          <Ionicons name="spade" size={12} color="black" />
        </View>
        <View style={styles.cardCenter}>
          <Ionicons name="spade" size={24} color="black" />
        </View>
        <View style={[styles.cardCorner, styles.cardCornerBottom]}>
          <Text style={styles.cardAce}>A</Text>
          <Ionicons name="spade" size={12} color="black" />
        </View>
        <View style={styles.cardCrown}>
          <Ionicons name="crown" size={16} color="#FFD700" />
        </View>
        <View style={styles.cardBanner}>
          <Text style={styles.cardBannerText}>WINNER</Text>
        </View>
      </View>
    </View>
  );
};

// Floating confetti component for winner celebration
const FloatingConfetti = () => {
  const confetti = Array(20).fill(0).map(() => ({
    translateY: useRef(new Animated.Value(0)).current,
    translateX: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
    rotate: useRef(new Animated.Value(0)).current,
    color: ['#FFD700', '#FF4500', '#00BFFF', '#32CD32', '#FF1493', '#FF8C00'][Math.floor(Math.random() * 6)],
  }));

  useEffect(() => {
    confetti.forEach((piece, index) => {
      const startPositionX = (index % 2 === 0 ? -1 : 1) * (Math.random() * 150 + 50);
      
      // Adjust animation duration for Android
      const duration = Platform.OS === 'android' 
        ? 2500 + (index * 400) 
        : 3000 + (index * 500);
      
      const animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(piece.translateY, {
              toValue: -300 - (index * 30),
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(piece.translateX, {
              toValue: startPositionX,
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(piece.scale, {
              toValue: 1,
              duration: Platform.OS === 'android' ? 800 : 1000,
              useNativeDriver: true,
            }),
            Animated.timing(piece.rotate, {
              toValue: 1,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(piece.scale, {
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
    <View style={styles.confettiContainer}>
      {confetti.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confetti,
            {
              backgroundColor: piece.color,
              transform: [
                { translateY: piece.translateY },
                { translateX: piece.translateX },
                { scale: piece.scale },
                {
                  rotate: piece.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

// Casino chip animation component
const AnimatedChip = ({ position, delay, size = 40, color = '#FFD700', spin = true }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Random starting position
    const startX = Math.random() * 100 - 50;
    
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 1000,
          useNativeDriver: true,
        }),
        ...(spin ? [Animated.loop(
          Animated.timing(rotate, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          })
        )] : [])
      ]),
    ]).start();
  }, []);

  return (
    <Animated.Image
      source={
        color === '#FFD700' 
          ? require('../assets/DaresOnly/BlueChip.png') 
          : color === '#FF0000' 
            ? require('../assets/DaresOnly/RedChip.png')
            : require('../assets/DaresOnly/GreenChip.png')
      }
      style={[
        styles.animatedChip,
        {
          position: 'absolute',
          width: size,
          height: size,
          top: position.top,
          left: position.left,
          transform: [
            { translateX },
            { translateY },
            { 
              rotate: rotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              })
            },
            { scale },
          ],
        }
      ]}
    />
  );
};

// Shimmer effect component for all cards
const ShimmerEffect = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

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
          toValue: SCREEN_WIDTH,
          duration: Platform.OS === 'android' ? 1600 : 2000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -SCREEN_WIDTH,
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

// Casino lights animation component
const CasinoLights = () => {
  const lightsOpacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lightsOpacity, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        }),
        Animated.timing(lightsOpacity, {
          toValue: 0.3,
          duration: 10000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  return (
    <Animated.View 
      style={[
        styles.casinoLights,
        {
          opacity: lightsOpacity.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0.2, 0.4],
          }),
        }
      ]}
    />
  );
};

const EndGameScreen = ({ navigation, route }) => {
  const { players, resetGame } = useContext(GameContext);
  const { packName, completedDares } = route.params;
  const [accolades, setAccolades] = useState([]);
  const [animations, setAnimations] = useState([]);
  const [chipPositions, setChipPositions] = useState([]);
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  
  // Choose which badge to display (change number 0-4 to select different badge)
  const badgeType = 0; // 0=PokerChip, 1=RoyalFlush, 2=Jackpot, 3=Marquee, 4=GoldCard

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

  // Initialize spotlight animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(spotlightAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(spotlightAnim, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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
      
      if (!range) return { player, totalCompleted, accolade: "Great effort at the table!" };
      
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
    
    // Generate random positions for chips
    const positions = [];
    for (let i = 0; i < 20; i++) {
      positions.push({
        top: Math.random() * SCREEN_HEIGHT * 0.8,
        left: Math.random() * SCREEN_WIDTH * 0.8,
        delay: Math.random() * 2000,
        color: Math.random() > 0.5 ? '#FFD700' : (Math.random() > 0.5 ? '#FF0000' : '#00FF00'),
        size: 30 + Math.random() * 20,
      });
    }
    setChipPositions(positions);
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

  // Generate a casino-style accolade with more exciting language
  const getCasinoAccolade = (accolade, totalCompleted) => {
    if (totalCompleted === 0) return "Better luck next time at the tables!";
    
    // Add some casino flair to the accolades
    const casinoPrefix = [
      "High Roller: ",
      "Jackpot! ",
      "Ace Player: ",
      "Royal Flush! ",
      "Lucky Streak: ",
      ""
    ][Math.floor(Math.random() * 6)];
    
    return casinoPrefix + accolade;
  };

  // Function to render the selected badge type
  const renderBadge = () => {
    switch(badgeType) {
      case 0: return <GoldPokerChipBadge />;
      case 1: return <RoyalFlushRibbon />;
      case 2: return <CasinoJackpotBadge />;
      case 3: return <VegasMarqueeBadge />;
      case 4: return <GoldCardBadge />;
      default: return <GoldPokerChipBadge />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground 
        source={require('../assets/redfelt.jpg')} 
        style={styles.background} 
        resizeMode="cover"
        fadeDuration={Platform.OS === 'android' ? 300 : 0}
      >
        <View style={styles.feltOverlay} />
        <CasinoLights />
        
        {/* Casino spotlight effect */}
        <Animated.View 
          style={[
            styles.spotlight, 
            {
              opacity: spotlightAnim,
              transform: [{
                scale: spotlightAnim.interpolate({
                  inputRange: [0.3, 1],
                  outputRange: [0.9, 1.1],
                })
              }]
            }
          ]} 
        />
        
        {/* Create a container with a lower z-index specifically for chips */}
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 1 
        }}>
          {/* Floating chips in background */}
          {chipPositions.map((position, idx) => (
            <AnimatedChip 
              key={idx} 
              position={position} 
              delay={position.delay} 
              color={position.color} 
              size={position.size}
            />
          ))}
        </View>
        
        {/* Main content with higher z-index to appear above chips */}
        <View style={[styles.container, { zIndex: 10 }]}>
          <Animatable.View animation="fadeIn" duration={800} delay={300}>
            <Text style={styles.title}>FINAL SCORES</Text>
            <View style={styles.titleDecoration}>
              <View style={styles.titleLine} />
              <Ionicons name="diamond" size={24} color="#FFD700" />
              <View style={styles.titleLine} />
            </View>
          </Animatable.View>
          
          <ScrollView 
            contentContainerStyle={[styles.accoladesContainer, { zIndex: 20 }]}
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
                <FloatingConfetti />
                {renderBadge()}
                <Text style={styles.topPlayerName}>{accolades[0].player}</Text>
                <View style={styles.daresContainer}>
                  <Image 
                    source={require('../assets/DaresOnly/GreenChip.png')} 
                    style={styles.daresBackground}
                    fadeDuration={Platform.OS === 'android' ? 300 : 0}
                  />
                  <Text style={styles.counter}>{accolades[0].totalCompleted}</Text>
                </View>
                <Text style={styles.topAccolade}>{getCasinoAccolade(accolades[0].accolade, accolades[0].totalCompleted)}</Text>
                <View style={styles.trophy}>
                  <Ionicons name="trophy" size={32} color="#FFD700" />
                </View>
              </Animated.View>
            )}
            
            <View style={[styles.podium, { zIndex: 20 }]}>
              {accolades.slice(1, 3).map((accolade, index) => (
                <Animated.View 
                  key={index + 1} 
                  style={[
                    styles.card, 
                    styles.podiumPlayer, 
                    index === 0 ? styles.secondPlace : styles.thirdPlace,
                    { 
                      opacity: animations[index + 1], 
                      transform: [{ translateY: animations[index + 1].interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
                    }
                  ]}
                >
                  <ShimmerEffect />
                  <Text style={styles.playerName}>{accolade.player}</Text>
                  <View style={styles.daresContainer}>
                    <Image 
                      source={index === 0 ? 
                        require('../assets/DaresOnly/yellowpokerchip.png') : 
                        require('../assets/DaresOnly/RedChip.png')} 
                      style={styles.daresBackground}
                      fadeDuration={Platform.OS === 'android' ? 300 : 0}
                    />
                    <Text style={styles.counter}>{accolade.totalCompleted}</Text>
                  </View>
                  <Text style={styles.accolade}>{getCasinoAccolade(accolade.accolade, accolade.totalCompleted)}</Text>
                  <View style={styles.medalBadge}>
                    <Ionicons 
                      name={index === 0 ? "medal" : "ribbon"} 
                      size={24} 
                      color={index === 0 ? "#C0C0C0" : "#CD7F32"} 
                    />
                  </View>
                </Animated.View>
              ))}
            </View>
            
            <View style={styles.horizontalLine} />
            
            <View style={[styles.remainingPlayers, { zIndex: 20 }]}>
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
                  <ShimmerEffect />
                  <Text style={styles.playerName}>{accolade.player}</Text>
                  <View style={styles.daresContainer}>
                    <Image 
                      source={require('../assets/DaresOnly/RedChip.png')} 
                      style={styles.daresBackground}
                      fadeDuration={Platform.OS === 'android' ? 300 : 0}
                    />
                    <Text style={styles.counter}>{accolade.totalCompleted}</Text>
                  </View>
                  <Text style={styles.accolade}>{getCasinoAccolade(accolade.accolade, accolade.totalCompleted)}</Text>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
          
          <Animatable.View 
            animation="fadeInUp" 
            duration={800} 
            delay={1000}
            style={[styles.buttonContainer, { zIndex: 30 }]}
          >
            <TouchableOpacity 
              style={[styles.button, styles.playAgainButton]} 
              onPress={handleReset}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="refresh" size={20} color="#fff" style={styles.icon} />
              <Text style={styles.buttonText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.homeButton]} 
              onPress={() => { resetGame(); navigation.navigate('Home'); }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="home" size={20} color="#fff" style={styles.icon} />
              <Text style={styles.buttonText}>Back to Home</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  background: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  feltOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 115, 51, 0.2)', // Green felt overlay
    opacity: 0.8,
  },
  casinoLights: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFD700', // Gold lights
  },
  spotlight: {
    position: 'absolute',
    width: '150%',
    height: '150%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 600,
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -300 },
      { translateY: -300 },
    ],
    zIndex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: scaleFontSize(40),
    fontWeight: 'bold',
    color: '#FFD700', // Gold text
    textAlign: 'center',
    fontFamily: 'Poker',
    marginBottom: 5,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        elevation: 3,
      }
    }),
  },
  titleDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.6,
    marginBottom: 20,
    alignSelf: 'center',
  },
  titleLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
  },
  accoladesContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 30, // Extra padding for Android
  },
  card: {
    padding: 20,
    margin: 10,
    borderRadius: 15,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    zIndex: 5, // Increased z-index to ensure cards appear above chips
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }
    }),
  },
  daresContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    zIndex: 6, // Ensure this is above other elements
  },
  daresBackground: {
    width: 60,
    height: 60,
    position: 'absolute',
  },
  topPlayer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    width: SCREEN_WIDTH * 0.85,
    borderWidth: 3,
    borderColor: '#FFD700',
    paddingTop: 30,
    paddingBottom: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
      },
      android: {
        elevation: 12,
      }
    }),
  },
  trophy: {
    position: 'absolute',
    bottom: -15,
    backgroundColor: '#000',
    borderRadius: 20,
    width: 40, 
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 7, // Ensure trophy appears above chips
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: SCREEN_WIDTH * 0.85,
    marginBottom: 5,
    zIndex: 5, // Ensure podium appears above chips
  },
  podiumPlayer: {
    width: SCREEN_WIDTH * 0.4,
    borderWidth: 2,
  },
  secondPlace: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderColor: '#C0C0C0',
  },
  thirdPlace: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderColor: '#CD7F32',
  },
  medalBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#000',
    borderRadius: 15,
    width: 30, 
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    zIndex: 7, // Ensure medal appears above chips
  },
  horizontalLine: {
    width: SCREEN_WIDTH * 0.8,
    height: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
    marginVertical: 10,
    zIndex: 5, // Ensure line appears above chips
  },
  remainingPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: SCREEN_WIDTH * 0.85,
    zIndex: 5, // Ensure remaining players appear above chips
  },
  remainingPlayerCard: {
    width: SCREEN_WIDTH * 0.4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderColor: '#444',
  },
  topPlayerName: {
    fontSize: scaleFontSize(28),
    fontWeight: 'bold',
    color: '#FFD700',
    fontFamily: 'Poker',
    zIndex: 6, // Ensure text appears above background elements
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }
    }),
  },
  playerName: {
    fontSize: scaleFontSize(20),
    fontWeight: 'bold',
    color: '#FFD700',
    fontFamily: 'Poker',
    textAlign: 'center',
    zIndex: 6, // Ensure text appears above background elements
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }
    }),
  },
  accolade: {
    fontSize: scaleFontSize(14),
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 5,
    fontStyle: 'italic',
    zIndex: 6, // Ensure text appears above background elements
  },
  topAccolade: {
    fontSize: scaleFontSize(18),
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 10,
    fontStyle: 'italic',
    zIndex: 6, // Ensure text appears above background elements
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }
    }),
  },
  counter: {
    fontSize: scaleFontSize(24),
    color: '#000',
    fontWeight: 'bold',
    zIndex: 6, // Ensure text appears above background elements
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(255, 255, 255, 0.5)',
        textShadowOffset: { width: 0.5, height: 0.5 },
        textShadowRadius: 1,
      }
    }),
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    marginTop: 10,
    paddingBottom: Platform.OS === 'android' ? 20 : 0,
    paddingHorizontal: 10, // Add padding to prevent bleeding off screen
    flexWrap: 'wrap', // Allow buttons to wrap on smaller screens
    zIndex: 10, // Ensure buttons appear above everything
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5, // Reduced from 10 to 5
    marginBottom: 10, // Add this for spacing if buttons wrap
    borderWidth: 2,
    borderColor: '#FFD700',
    minWidth: 130, // Set minimum width
    flex: 1, // Allow buttons to grow/shrink as needed
    maxWidth: SCREEN_WIDTH * 0.45, // Prevent buttons from getting too wide
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  playAgainButton: {
    backgroundColor: '#4CAF50',
  },
  homeButton: {
    backgroundColor: '#D32F2F',
  },
  buttonText: {
    color: '#fff',
    fontSize: scaleFontSize(16),
    textAlign: 'center',
    marginLeft: 10,
    fontWeight: 'bold',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0.5, height: 0.5 },
        textShadowRadius: 1,
      }
    }),
  },
  icon: {
    marginRight: 5,
  },
  confettiContainer: {
    position: 'absolute',
    top: -50,
    left: -100,
    right: -100,
    bottom: -50,
    zIndex: 4, // Lower than cards but higher than chips
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    zIndex: 4, // Match the container
    top: '50%',
    left: '50%',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 15,
    zIndex: 3, // Above chips but below content
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    transform: [{ skewX: '-20deg' }],
    width: '150%',
  },
  animatedChip: {
    zIndex: 1, // Lowest z-index to ensure chips are behind everything
    resizeMode: 'contain',
  },
  
  // BADGE OPTION 1: Gold Poker Chip Badge Styles
  chipBadge: {
    position: 'absolute',
    top: -25,
    width: 90,
    height: 90,
    zIndex: 10, // Keep high to ensure badge stays on top
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipBadgeInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  chipBadgeRim: {
    position: 'absolute',
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: 'transparent',
  },
  chipBadgeCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  chipBadgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  chipNotch: {
    position: 'absolute',
    width: 10,
    height: 5,
    backgroundColor: '#E5C100',
    borderWidth: 1,
    borderColor: '#000',
    top: -3,
    borderRadius: 2,
  },
  
  // BADGE OPTION 2: Royal Flush Ribbon Styles
  ribbonBadge: {
    position: 'absolute',
    top: -20,
    width: 130,
    height: 80,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ribbonMain: {
    width: 120,
    height: 40,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  ribbonTailLeft: {
    position: 'absolute',
    bottom: 5,
    left: 10,
    width: 25,
    height: 30,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: '#000',
    transform: [{ skewX: '30deg' }, { rotate: '15deg' }],
  },
  ribbonTailRight: {
    position: 'absolute',
    bottom: 5,
    right: 10,
    width: 25,
    height: 30,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: '#000',
    transform: [{ skewX: '-30deg' }, { rotate: '-15deg' }],
  },
  ribbonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  cardRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCard: {
    width: 16,
    height: 22,
    backgroundColor: '#FFF',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  miniCardText: {
    color: '#000',
    fontSize: 8,
    fontWeight: 'bold',
  },
  miniCardSuit: {
    marginTop: -2,
  },
  
  // BADGE OPTION 3: Casino Jackpot Badge Styles
  jackpotBadge: {
    position: 'absolute',
    top: -25,
    width: 100,
    height: 100,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jackpotStar: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starPoint: {
    position: 'absolute',
    width: 90,
    height: 35,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: '#000',
    top: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  jackpotInnerCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  jackpotText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 2,
  },
  
  // BADGE OPTION 4: Vegas Marquee Badge Styles
  marqueeBadge: {
    position: 'absolute',
    top: -20,
    width: 140,
    height: 45,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marqueeBackground: {
    width: 130,
    height: 40,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  marqueeLightsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 5,
    padding: 2,
  },
  marqueeLight: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  marqueeLightOn: {
    backgroundColor: '#FFD700',
  },
  marqueeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: '#FFD700',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
      },
      android: {
        textShadowColor: '#FFD700',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
      }
    }),
  },
  
  // BADGE OPTION 5: Gold Card Badge Styles
  cardBadge: {
    position: 'absolute',
    top: -25,
    width: 80,
    height: 110,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgeInner: {
    width: 70,
    height: 100,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  cardAce: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  cardCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCorner: {
    position: 'absolute',
    top: 5,
    left: 5,
    alignItems: 'center',
  },
  cardCornerBottom: {
    top: 'auto',
    left: 'auto',
    bottom: 5,
    right: 5,
    transform: [{ rotate: '180deg' }],
  },
  cardCrown: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FFF',
    width: 26,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  cardBanner: {
    position: 'absolute',
    bottom: 25,
    backgroundColor: '#FFD700',
    width: 60,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
    transform: [{ rotate: '-15deg' }],
  },
  cardBannerText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
  }
});

export default EndGameScreen;