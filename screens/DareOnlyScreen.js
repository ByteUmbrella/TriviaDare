import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ImageBackground, 
  StyleSheet, 
  StatusBar, 
  Dimensions, 
  Animated, 
  Image,
  Modal,
  Platform,
  BackHandler,
  Easing
} from 'react-native';
import { GameContext, useGame } from '../Context/GameContext';
import * as Font from 'expo-font';
import PlayerModal from '../Context/PlayerModal';
import Icon from 'react-native-vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../Context/Settings';
import { useFocusEffect } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

// Keep all your existing imports for packs
import spicy from '../Packs/DaresOnly/spicy.json';
import adventureseekers from '../Packs/DaresOnly/adventure_seekers.json';
import bar from '../Packs/DaresOnly/bar.json';
import couples from '../Packs/DaresOnly/couples.json';
import familyfriendly from '../Packs/DaresOnly/family_friendly.json';
import icebreakers from '../Packs/DaresOnly/icebreakers.json';
import musicmania from '../Packs/DaresOnly/music_mania.json';
import officefun from '../Packs/DaresOnly/office_fun.json';
import outinpublic from '../Packs/DaresOnly/out_in_public.json';
import houseparty from '../Packs/DaresOnly/house_party.json'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Function to calculate responsive font sizes
const scaleFontSize = (size) => {
  const scaleFactor = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
  return Math.round(size * scaleFactor);
};

const packData = {
  spicy,
  adventureseekers,
  bar,
  couples,
  familyfriendly,
  icebreakers,
  musicmania,
  officefun,
  outinpublic,
  houseparty,
};

const packImages = {
  familyfriendly: require('../assets/DaresOnly/familyfun.jpg'),
  icebreakers: require('../assets/DaresOnly/icebreakers.jpg'),
  couples: require('../assets/DaresOnly/couples.jpg'),
  outinpublic: require('../assets/DaresOnly/public.jpg'),
  musicmania: require('../assets/DaresOnly/music.jpg'),
  officefun: require('../assets/DaresOnly/office.jpg'),
  adventureseekers: require('../assets/DaresOnly/adventure.jpg'),
  bar: require('../assets/DaresOnly/bar.jpg'),
  spicy: require('../assets/DaresOnly/spicy.jpg'),
  houseparty: require('../assets/DaresOnly/houseparty.jpg'),
};

// Enhanced Casino-style Alert Component
const CasinoAlert = ({ visible, title, message, onCancel, onConfirm, cancelText = "Cancel", confirmText = "Confirm" }) => {
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.alertOverlay}>
        <Animatable.View 
          animation="fadeIn" 
          duration={300} 
          style={styles.alertContainer}
        >
          <Text style={styles.alertTitle}>{title}</Text>
          <View style={styles.casinoSeparator}>
            <View style={styles.separatorLine} />
            <Ionicons name="diamond" size={16} color="#FFD700" />
            <View style={styles.separatorLine} />
          </View>
          <Text style={styles.alertMessage}>{message}</Text>
          
          <View style={styles.alertButtonContainer}>
            <TouchableOpacity
              style={styles.alertCancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.alertCancelText}>{cancelText}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.alertConfirmButton}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.alertConfirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animatable.View>
      </View>
    </Modal>
  );
};

const DareOnlyScreen = ({ navigation, route }) => {
  const { 
    players, 
    setPlayers, 
    addPendingDare, 
    pendingDares 
  } = useGame();
  
  const packName = route.params?.packName.toLowerCase().replace(/\s/g, '');
  const dareCount = route.params?.dareCount;

  const [dares, setDares] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [completedDares, setCompletedDares] = useState(Array(players.length).fill(0));
  const [currentDareIndex, setCurrentDareIndex] = useState(0);
  const [currentDareCompleted, setCurrentDareCompleted] = useState(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [daresAsked, setDaresAsked] = useState(Array(players.length).fill(0));
  const [showResults, setShowResults] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [flippedOnce, setFlippedOnce] = useState(false);
  const [revealAnimationStarted, setRevealAnimationStarted] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [totalDaresPerGame, setTotalDaresPerGame] = useState(dareCount * players.length);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstRender, setIsFirstRender] = useState(true);
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Yes',
    cancelText: 'No'
  });

  // Dealer-style Animation values
  const cardPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardRotation = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardShadowOpacity = useRef(new Animated.Value(0.5)).current;
  const nextCardPosition = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH, y: 30 })).current;
  const nextCardOpacity = useRef(new Animated.Value(0)).current;
  const nextCardRotation = useRef(new Animated.Value(15)).current;
  const nextCardScale = useRef(new Animated.Value(0.9)).current;
  const cardFlipRotation = useRef(new Animated.Value(0)).current;
  
  // Additional animation values
  const revealAnim = useRef(new Animated.Value(0)).current;
  const chipsFallAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const casinoLightsAnim = useRef(new Animated.Value(0)).current;
  const cardShineAnim = useRef(new Animated.Value(0)).current;

  const isGameOver = daresAsked.every(dares => dares >= dareCount);
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  
  // Animation for initial card entrance (dealer style)
  useEffect(() => {
    if (isFirstRender && !isLoading && !showResults) {
      // Start with card off-screen (as if dealer is holding it)
      cardPosition.setValue({ x: -SCREEN_WIDTH, y: 100 });
      cardOpacity.setValue(0);
      cardRotation.setValue(-15);
      cardScale.setValue(0.9);
      
      // Animate card being dealt onto the table
      Animated.parallel([
          Animated.timing(cardPosition, {
              toValue: { x: 0, y: 0 },
              duration: 600,
              useNativeDriver: true,
              easing: Easing.out(Easing.back(1.5))
          }),
          Animated.timing(cardOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
          }),
          Animated.timing(cardRotation, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.out(Easing.back(1.2))
          }),
          Animated.timing(cardScale, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
              easing: Easing.out(Easing.back(1.2))
          }),
          Animated.sequence([
              Animated.delay(300),
              Animated.spring(cardShadowOpacity, {
                  toValue: 1,
                  friction: 6,
                  useNativeDriver: true
              })
          ])
      ]).start(() => {
          setIsFirstRender(false);
      });
    }
  }, [isFirstRender, isLoading, showResults]);
  
  // Start card shine animation
  useEffect(() => {
    if (!isLoading && !showResults) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(cardShineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(cardShineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isLoading, showResults]);

  // Handle Android back button
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          if (isGameOver) {
            handleShowResults();
            return true;
          }
          // Show custom confirmation dialog instead of standard Alert
          showCustomAlert({
            title: "Cash Out",
            message: "Are you sure you want to end this game and cash out?",
            confirmText: "Cash Out",
            cancelText: "Continue Playing",
            onConfirm: () => navigation.goBack()
          });
          return true;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [isGameOver])
  );

  // Custom alert function
  const showCustomAlert = (config) => {
    setAlertConfig({
      title: config.title || 'Alert',
      message: config.message || '',
      onConfirm: config.onConfirm || (() => {}),
      confirmText: config.confirmText || 'OK',
      cancelText: config.cancelText || 'Cancel'
    });
    setAlertVisible(true);
  };

  // Casino lighting effects
  useEffect(() => {
    if (showResults) {
      // Start spotlight animation
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

      // Start casino lights animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(casinoLightsAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(casinoLightsAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start chips falling animation
      Animated.timing(chipsFallAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start();
    }
  }, [showResults]);

  // Keep all your existing useEffects here
  useEffect(() => {
    async function loadFont() {
      setIsLoading(true);
      try {
        await Font.loadAsync({
          'BicycleFancy': require('../assets/Fonts/BicycleFancy.ttf'),
          'Poker': require('../assets/Fonts/Poker.ttf'),
        });
        setFontLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        // Fall back to system font if loading fails
        setFontLoaded(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadFont();
  }, []);

  useEffect(() => {
    const newTotalDares = dareCount * players.length;
    setTotalDaresPerGame(newTotalDares);
    setIsLoading(true);
    
    try {
      const dareData = packData[packName] || [];
      const selectedDares = dareData
        .sort(() => 0.5 - Math.random())
        .slice(0, newTotalDares);
      setDares(selectedDares);
    } catch (error) {
      console.error('Error initializing game data:', error);
      showCustomAlert({
        title: 'Game Loading Error',
        message: 'There was a problem with the cards. Please try again.',
        confirmText: 'Return to Table',
        onConfirm: () => navigation.goBack()
      });
    } finally {
      setIsLoading(false);
    }
  }, [packName]);

  useEffect(() => {
    if (isGameOver && !showResults) {
      setShowResults(true);
      startRevealAnimation();
    }
  }, [daresAsked, dareCount]);

  useEffect(() => {
    const maxDareIndex = totalDaresPerGame - 1;
    if (currentDareIndex > maxDareIndex) {
      setCurrentDareIndex(0);
    }
  }, [currentDareIndex, totalDaresPerGame]);

  useEffect(() => {
    setDaresAsked(prev => 
      prev.map(count => Math.min(count, dareCount))
    );
    
    setCompletedDares(prev => 
      prev.map(count => Math.min(count, dareCount))
    );
  }, [dareCount, players.length]);

  // Function to get the current round
  const getCurrentRound = () => {
    return Math.min(...daresAsked);
  };

  const startRevealAnimation = () => {
    setRevealAnimationStarted(true);
    revealAnim.setValue(0);
    
    Animated.spring(revealAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleShowResults = () => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.9,
        duration: Platform.OS === 'android' ? 70 : 100, // Faster on Android
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(buttonScaleAnim, {
          toValue: 1.1,
          duration: Platform.OS === 'android' ? 150 : 200, // Faster on Android
          useNativeDriver: true,
        }),
        Animated.timing(revealAnim, {
          toValue: 2,
          duration: Platform.OS === 'android' ? 400 : 500, // Faster on Android
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 800 : 1000, // Slightly faster on Android
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Check if there are pending dares
      if (pendingDares.length > 0) {
        navigation.navigate('PendingDares', {
          players: players.map(player => player.name),
          completedDares,
          packName,
        });
      } else {
        navigation.navigate('EndGameScreen', {
          players: players.map(player => player.name),
          completedDares,
          packName,
        });
      }
    });
  };

  const handleDareCompletion = (completed) => {
    setCurrentDareCompleted(completed);
  };

  const handleNeedMoreTime = () => {
    // Add current dare to pending dares
    addPendingDare(currentDare, players[currentPlayerIndex]);
    // Move to next player without counting this as completed or failed
    handleNextPlayer(true);
  };

  const handleNextPlayer = () => {
    if (currentDareCompleted !== null) {
      const nextDareCount = daresAsked[currentPlayerIndex] + 1;
      
      if (nextDareCount <= dareCount) {
        if (currentDareCompleted === true) {
          setCompletedDares((prevDares) => {
            const updatedDares = [...prevDares];
            updatedDares[currentPlayerIndex] = Math.min(updatedDares[currentPlayerIndex] + 1, dareCount);
            return updatedDares;
          });
        } else if (currentDareCompleted === 'needTime') {
          addPendingDare(currentDare, players[currentPlayerIndex]);
        }
        
        setDaresAsked((prevDares) => {
          const updatedDares = [...prevDares];
          updatedDares[currentPlayerIndex] = nextDareCount;
          return updatedDares;
        });

        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        setCurrentPlayerIndex(nextPlayerIndex);
        
        if (currentDareIndex < dares.length - 1) {
          setCurrentDareIndex(prevIndex => prevIndex + 1);
        }

        setCurrentDareCompleted(null);
        setFlippedOnce(false);
        setFlipped(false);
        cardFlipRotation.setValue(0);

        // Dealer-style animation for switching to the next card

        // 1. First animate current card sliding off to the left (like discarding)
        Animated.parallel([
            Animated.timing(cardPosition, {
                toValue: { x: -SCREEN_WIDTH - 100, y: 100 },
                duration: 400,
                useNativeDriver: true,
                easing: Easing.out(Easing.cubic)
            }),
            Animated.timing(cardOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(cardRotation, {
                toValue: -20,
                duration: 400, 
                useNativeDriver: true,
            }),
            Animated.timing(cardShadowOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            // After card is gone, reset positions for next card
            
            // Small delay before dealing the next card
            setTimeout(() => {
                // 2. Prepare the next card to come in from the right
                cardPosition.setValue({ x: SCREEN_WIDTH, y: 30 });
                cardRotation.setValue(15);
                cardScale.setValue(0.9);
                
                // 3. Then animate the next card coming in from the right (like dealing)
                Animated.parallel([
                    Animated.timing(cardPosition, {
                        toValue: { x: 0, y: 0 },
                        duration: 600,
                        useNativeDriver: true,
                        easing: Easing.out(Easing.back(1.5))
                    }),
                    Animated.timing(cardOpacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(cardRotation, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: true,
                        easing: Easing.out(Easing.back(1.2))
                    }),
                    Animated.timing(cardScale, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                        easing: Easing.out(Easing.back(1.2))
                    }),
                    Animated.sequence([
                        Animated.delay(300),
                        Animated.spring(cardShadowOpacity, {
                            toValue: 1,
                            friction: 6,
                            useNativeDriver: true
                        })
                    ])
                ]).start();
            }, 50);
        });
      }
    }
  };

  const handleEndGame = () => {
    // Use custom alert instead of standard Alert
    showCustomAlert({
      title: "Cash Out",
      message: "Are you sure you want to cash out and end the game now?",
      confirmText: "Cash Out",
      cancelText: "Continue Playing",
      onConfirm: () => {
        setShowResults(true);
        startRevealAnimation();
      }
    });
  };

  const handleManagePlayers = () => {
    setPlayerModalVisible(true);
  };

  const handleAddPlayer = (newPlayer) => {
    setPlayers((prevPlayers) => {
      const updatedPlayers = [...prevPlayers, newPlayer];
      const currentRound = getCurrentRound();
      
      setCompletedDares(prev => [...prev, 0]);
      setDaresAsked(prev => [...prev, currentRound]);
      
      const newTotalDares = dareCount * updatedPlayers.length;
      setTotalDaresPerGame(newTotalDares);
      
      try {
        const dareData = packData[packName] || [];
        const existingDares = new Set(dares);
        const availableDares = dareData.filter(dare => !existingDares.has(dare));
        const additionalDares = availableDares
          .sort(() => 0.5 - Math.random())
          .slice(0, dareCount);
        
        setDares(prev => [...prev, ...additionalDares]);
      } catch (error) {
        console.error('Error updating dares:', error);
      }
      
      return updatedPlayers;
    });
  };

  const handleRemovePlayer = (index) => {
    if (players.length <= 2) {
      showCustomAlert({
        title: "Cannot Remove Player",
        message: "At least two players are required at this table.",
        confirmText: "OK",
        onConfirm: () => {}
      });
      return;
    }

    setPlayers(prev => {
      const updatedPlayers = prev.filter((_, i) => i !== index);
      
      setCompletedDares(prev => prev.filter((_, i) => i !== index));
      setDaresAsked(prev => prev.filter((_, i) => i !== index));
      
      const newTotalDares = dareCount * updatedPlayers.length;
      setTotalDaresPerGame(newTotalDares);
      
      if (currentPlayerIndex >= updatedPlayers.length) {
        setCurrentPlayerIndex(0);
      } else if (currentPlayerIndex === index) {
        setCurrentPlayerIndex(prev => prev > 0 ? prev - 1 : 0);
      }
      
      setDares(prev => prev.slice(0, newTotalDares));
      
      return updatedPlayers;
    });
  };

  const flipCard = () => {
    if (!flippedOnce) {
      setFlippedOnce(true);
      setFlipped(true);
      
      // Add card flip animation
      Animated.timing(cardFlipRotation, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5))
      }).start();
    }
  };

  // Card shine effect position
  const shinePosition = cardShineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-150%', '250%'],
  });

  // Front and back card rotation for 3D flip
  const frontInterpolate = cardFlipRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = cardFlipRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const chipScale = revealAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.3, 1, 1.2],
  });

  const chipRotate = revealAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0deg', '0deg', '360deg'],
  });

  // Dealer-style card transformation
  const cardAnimatedStyle = {
    transform: [
      { translateX: cardPosition.x },
      { translateY: cardPosition.y },
      { rotate: cardRotation.interpolate({
          inputRange: [-20, 0, 20],
          outputRange: ['-20deg', '0deg', '20deg'],
      })},
      { scale: cardScale }
    ],
    opacity: cardOpacity,
  };

  // Card flipping styles
  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
    backfaceVisibility: 'hidden',
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
    backfaceVisibility: 'hidden',
  };

  if (isLoading || !fontLoaded) {
    return (
      <ImageBackground source={require('../assets/redfelt.jpg')} style={styles.container}>
        <View style={styles.feltOverlay} />
        <StatusBar hidden />
        <View style={styles.loadingContainer}>
          <Animatable.Text 
            animation="pulse" 
            iterationCount="infinite" 
            style={styles.loadingText}
          >
            Dealing cards...
          </Animatable.Text>
        </View>
      </ImageBackground>
    );
  }

  const currentDare = dares.length > 0 ? dares[currentDareIndex] : "No dares available";
  const playerName = players[currentPlayerIndex] || "";

  // Generate random chip positions for the results scene
  const randomChips = Array.from({ length: 15 }, () => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: 20 + Math.random() * 30,
    rotate: Math.random() * 360,
    delay: Math.random() * 1000,
  }));

  return (
    <ImageBackground 
      source={require('../assets/redfelt.jpg')} 
      style={styles.container}
      fadeDuration={Platform.OS === 'android' ? 300 : 0}
    >
      <View style={styles.feltOverlay} />
      <StatusBar hidden />
      
      {/* Casino spotlight effect for results view */}
      {showResults && (
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
      )}
      
      {/* Casino lighting effect */}
      <Animated.View 
          style={[
              styles.casinoLights,
              {
                  opacity: casinoLightsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.2]
                  })
              }
          ]}
      />
      
      {/* Dealer's position (visual indicator where cards come from) */}
      <View style={styles.dealerPosition}>
          <Animatable.View
              animation="pulse"
              iterationCount="infinite"
              duration={2000}
              style={styles.dealerIndicator}
          >
              <Ionicons name="person" size={20} color="#FFD700" />
          </Animatable.View>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showResults ? (
          <View style={styles.resultsContainer}>
            {/* Background falling chips */}
            {randomChips.map((chip, index) => (
              <Animated.Image
                key={`chip-${index}`}
                source={require('../assets/DaresOnly/GreenChip.png')}
                style={{
                  position: 'absolute',
                  width: chip.size,
                  height: chip.size,
                  top: chip.top,
                  left: chip.left,
                  transform: [
                    { rotate: `${chip.rotate}deg` },
                    { 
                      translateY: chipsFallAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 50],
                      }) 
                    }
                  ],
                  opacity: chipsFallAnim.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [0, 0.7, 0],
                  }),
                }}
              />
            ))}
            
            {/* Card spread under the chip */}
            <View style={styles.cardSpreadContainer}>
              {[...Array(3)].map((_, index) => (
                <Image
                  key={`card-${index}`}
                  source={packImages[packName]}
                  style={[
                    styles.spreadCard,
                    {
                      transform: [
                        { rotate: `${(index-1) * 15}deg` },
                        { translateX: (index-1) * 10 }
                      ],
                      zIndex: 3-index
                    }
                  ]}
                />
              ))}
            </View>
            
            <Animated.View
              style={[
                styles.resultsButtonContainer,
                {
                  transform: [
                    { scale: buttonScaleAnim },
                    { rotate: chipRotate },
                  ],
                  opacity: revealAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.5, 1],
                  }),
                },
              ]}
            >
              <TouchableOpacity
                style={styles.resultsButton}
                onPress={handleShowResults}
                activeOpacity={Platform.OS === 'android' ? 0.7 : 0.8}
              >
                <Image
                  source={require('../assets/DaresOnly/GreenChip.png')}
                  style={styles.resultsChipImage}
                />
                <View style={styles.resultsTextContainer}>
                  <Text style={styles.resultsButtonText}>SHOW</Text>
                  <Text style={styles.resultsButtonText}>RESULTS</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : (
          <>
            {/* Header with player name */}
            <View style={styles.header}>
              <Text style={styles.title}>{playerName}</Text>
              <View style={styles.titleDecoration}>
                <View style={styles.titleLine} />
                <Ionicons name="diamond" size={24} color="#FFD700" />
                <View style={styles.titleLine} />
              </View>
            </View>
            
            {/* Chip score indicator */}
            <View style={styles.completedDaresBadge}>
              <Image
                source={require('../assets/DaresOnly/yellowpokerchip.png')}
                style={styles.pokerChip}
              />
              <Text style={styles.completedDaresText}>
                {completedDares[currentPlayerIndex]}
              </Text>
            </View>
            
            {/* Card container with dealer-style animation */}
            <View style={[styles.dareContainerWrapper, isLandscape ? styles.dareContainerLandscape : null]}>
              {/* Card shadow - animated separately for depth effect */}
              <Animated.View 
                style={[
                  styles.cardShadow,
                  {
                    opacity: cardShadowOpacity,
                    transform: [
                      { translateX: cardPosition.x.interpolate({
                          inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                          outputRange: [-10, 0, 10],
                          extrapolate: 'clamp'
                      })},
                      { translateY: cardPosition.y.interpolate({
                          inputRange: [-100, 0, 100],
                          outputRange: [-5, 6, 15],
                          extrapolate: 'clamp'
                      })}
                    ]
                  }
                ]} 
              />
              
              <Animated.View style={[styles.dareContainer, cardAnimatedStyle]}>
                <TouchableOpacity 
                  onPress={flipCard}
                  activeOpacity={Platform.OS === 'android' ? 0.8 : 0.9}
                  style={styles.cardTouchable}
                >
                  {/* Front of card */}
                  <Animated.View style={[styles.card, frontAnimatedStyle]}>
                    <Image 
                      source={packImages[packName]} 
                      style={styles.cardImage}
                      fadeDuration={Platform.OS === 'android' ? 300 : 0}
                    />
                    
                    {/* Shine effect */}
                    <Animated.View 
                      style={[
                        styles.cardShine,
                        {
                          transform: [{ translateX: shinePosition }]
                        }
                      ]}
                    />
                    
                    {!flippedOnce && (
                      <View style={styles.cardHint}>
                        <Text style={styles.cardHintText}>Tap to Flip</Text>
                      </View>
                    )}
                  </Animated.View>
                  
                  {/* Back of card (dare content) */}
                  <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
                    <View style={styles.cardBackHeader}>
                      <Ionicons name="diamond" size={18} color="#FFD700" />
                      <Text style={styles.cardPackName}>{route.params?.packName}</Text>
                      <Ionicons name="diamond" size={18} color="#FFD700" />
                    </View>
                    
                    <View style={styles.dareTextContainer}>
                      <Text 
                        style={styles.dareText}
                        adjustsFontSizeToFit={true}
                        numberOfLines={8}
                        minimumFontScale={0.5}
                      >
                        {currentDare}
                      </Text>
                    </View>
                    
                    <View style={styles.dareButtonsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.dareButton,
                          currentDareCompleted === true ? styles.dareButtonComplete : null
                        ]}
                        onPress={() => handleDareCompletion(true)}
                        disabled={isGameOver}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="checkmark" size={28} color="white" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dareButton,
                          styles.moreTimeButton,
                          currentDareCompleted === 'needTime' ? styles.moreTimeButtonActive : null
                        ]}
                        onPress={() => handleDareCompletion('needTime')}
                        disabled={isGameOver}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time" size={24} color="white" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>+ Time</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dareButton,
                          currentDareCompleted === false ? styles.dareButtonIncomplete : null
                        ]}
                        onPress={() => handleDareCompletion(false)}
                        disabled={isGameOver}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close" size={28} color="white" />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
            
            {/* Progress indicator */}
            <View style={styles.daresAskedContainer}>
              <View style={styles.daresAskedBadge}>
                <Text style={styles.daresAskedText}>
                  {daresAsked[currentPlayerIndex] + 1} / {dareCount}
                </Text>
              </View>
            </View>
            
            {/* Bottom action buttons */}
            <View style={styles.bottomButtons}>
              <TouchableOpacity 
                style={styles.endGameButton} 
                onPress={handleEndGame}
                activeOpacity={0.7}
              >
                <Ionicons name="flag" size={22} color="#fff" />
                <Text style={styles.buttonText}>Cash Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.nextPlayerButtonBottom,
                  currentDareCompleted === null || isGameOver ? styles.nextPlayerButtonDisabled : null
                ]}
                onPress={handleNextPlayer}
                disabled={currentDareCompleted === null || isGameOver}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Next Player</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.managePlayersButton} 
                onPress={handleManagePlayers} 
                disabled={isGameOver}
                activeOpacity={0.7}
              >
                <Ionicons name="people" size={22} color="#fff" />
                <Text style={styles.buttonText}>Players</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      
      {/* Custom Casino-style Alert */}
      <CasinoAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={() => {
          setAlertVisible(false);
          alertConfig.onConfirm();
        }}
        onCancel={() => setAlertVisible(false)}
      />
      
      <PlayerModal
        isVisible={playerModalVisible}
        onClose={() => setPlayerModalVisible(false)}
        players={players}
        setPlayers={setPlayers}
        onAddPlayer={handleAddPlayer}
        onRemovePlayer={handleRemovePlayer}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  scrollContent: {
    flexGrow: 1,
    padding: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 120, // Add padding at the bottom to ensure content doesn't get hidden behind buttons
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10
  },
  title: {
    fontSize: scaleFontSize(50),
    fontWeight: 'bold',
    color: '#FFD700', // Gold color for casino feel
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
    width: '60%',
    marginBottom: 20,
    marginTop:-10
  },
  titleLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
  },
  dareContainerWrapper: {
    width: 350,
    height: 450,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  cardShadow: {
    position: 'absolute',
    width: 310,
    height: 410,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    top: 15,
    left: 15,
    zIndex: 1,
  },
  dareContainer: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 0,
    width: 310,
    height: 420,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    zIndex: 2,
  },
  dareContainerLandscape: {
    flex: 1,
    marginTop: 5,
  },
  cardTouchable: {
    width: '100%',
    height: '100%',
  },
  card: {
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFD700', // Gold border
    overflow: 'hidden',
    backgroundColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  cardShine: {
    position: 'absolute',
    width: 40,
    height: '200%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ rotate: '30deg' }],
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    resizeMode: 'cover',
  },
  cardCorner: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
  },
  cardCornerBottom: {
    top: 'auto',
    left: 'auto',
    bottom: 8,
    right: 8,
    transform: [{ rotate: '180deg' }],
  },
  suitContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCornerText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardHint: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  cardHintText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  cardBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
  },
  cardPackName: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
    marginHorizontal: 8,
  },
  dareTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  dareText: {
    color: '#333',
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Montserrat-Bold',
      android: 'Montserrat-Bold', // Android system font
    }),
    fontSize: scaleFontSize(30), // Reduced from 36 for better readability with system font
    lineHeight: Platform.OS === 'android' ? 36 : 38,
    fontWeight: 'bold', // Apply bold through fontWeight instead of fontFamily
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  buttonText: {
    color: 'white',
    fontSize: scaleFontSize(14),
    fontWeight: 'bold',
    textAlign: 'center',
    flexWrap: 'nowrap',
    flexShrink: 1,
    marginTop: 4,
  },
  nextPlayerButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.7,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.2,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  dareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 15,
    paddingBottom: 20,
    gap: 10,
  },
  dareButton: {
    backgroundColor: '#555',
    padding: 10,
    borderRadius: 50, // Make it circular
    width: 80,
    height: 80,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreTimeButton: {
    backgroundColor: '#FF9800',
  },
  moreTimeButtonActive: {
    backgroundColor: '#F57C00',
  },
  buttonIcon: {
    marginBottom: 5,
  },
  dareButtonComplete: {
    backgroundColor: '#4CAF50',
  },
  dareButtonIncomplete: {
    backgroundColor: '#D32F2F',
  },
  bottomButtons: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 30 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    zIndex: 100,
  },
  endGameButton: {
    backgroundColor: '#D32F2F',
    padding: 15,
    borderRadius: 10,
    width: '30%', // Reduced width for 3-button layout
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  nextPlayerButtonBottom: {
    backgroundColor: '#304FFE',
    padding: 15,
    borderRadius: 10,
    width: '30%', // Match the width of other buttons
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  managePlayersButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    width: '30%', // Reduced width for 3-button layout
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  daresAskedContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 55,
    right: 15,
    zIndex: 10,
  },
  daresAskedBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    paddingVertical:8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  daresAskedText: {
    color: '#FFD700',
    fontSize: scaleFontSize(15),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  completedDaresBadge: {
    position: 'absolute',
    top: 105,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 11,
    marginTop: 15,
    alignItems: 'center',
    zIndex: 10,
  },
  completedDaresText: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
    position: 'absolute',
    top: '45%',
    left: '55%',
  },
  pokerChip: {
    width: 55,
    height: 55,
    resizeMode: 'contain',
  },
  dealerPosition: {
    position: 'absolute',
    right: 15,
    top: SCREEN_HEIGHT / 2 - 100,
    zIndex: 10,
  },
  dealerIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  resultsContainer: {
    flex: 1,
    minHeight: Dimensions.get('window').height - 100,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  resultsButton: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsChipImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  resultsTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFontSize(28),
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Poker',
    marginVertical: -8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFD700',
    fontSize: scaleFontSize(26),
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Poker',
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
  cardSpreadContainer: {
    position: 'absolute',
    top: '50%',  // Using percentage instead of height/2
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',  // Center horizontally
    transform: [{ translateY: -85 }],  // Offset by half the height of cards (approximately)
  },
  spreadCard: {
    position: 'absolute',
    width: 120,
    height: 170,
    borderRadius: 10,
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
    borderWidth: 2,
    borderColor: '#FFD700',
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
  // Casino-style Alert styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: '80%',
    maxWidth: 330,
    backgroundColor: 'rgba(139, 0, 0, 0.95)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  alertTitle: {
    fontSize: scaleFontSize(24),
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Poker',
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
  casinoSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginBottom: 15,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
  },
  alertMessage: {
    fontSize: scaleFontSize(18),
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  alertButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  alertCancelButton: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#999',
    minHeight: 50,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  alertConfirmButton: {
    padding: 12,
    backgroundColor: '#FF4500',
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    minHeight: 50,
    justifyContent: 'center',
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
  alertCancelText: {
    color: '#FFFFFF',
    fontSize: scaleFontSize(16),
    fontWeight: 'bold',
  },
  alertConfirmText: {
    color: '#FFFFFF',
    fontSize: scaleFontSize(16),
    fontWeight: 'bold',
  }
});

export default DareOnlyScreen;