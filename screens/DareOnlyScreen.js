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
  BackHandler
} from 'react-native';
import { GameContext, useGame } from '../Context/GameContext';
import * as Font from 'expo-font';
import PlayerModal from '../Context/PlayerModal';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useSettings } from '../Context/Settings';
import { useFocusEffect } from '@react-navigation/native';

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
};

// Custom Casino-style Alert Component
const CasinoAlert = ({ visible, title, message, onCancel, onConfirm, cancelText = "Cancel", confirmText = "Confirm" }) => {
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
    >
      <View style={styles.alertOverlay}>
        <View style={styles.alertContainer}>
          <Text style={styles.alertTitle}>{title}</Text>
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
        </View>
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
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Yes',
    cancelText: 'No'
  });

  // Animation values
  const flipAnim = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const chipsFallAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const casinoLightsAnim = useRef(new Animated.Value(0)).current;

  const isGameOver = daresAsked.every(dares => dares >= dareCount);
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  

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
            title: "End Game",
            message: "Are you sure you want to exit this game?",
            confirmText: "Exit",
            cancelText: "Cancel",
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
        title: 'Error Loading Game',
        message: 'There was a problem loading the game data. Please try again.',
        confirmText: 'OK',
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

        Animated.spring(flipAnim, {
          toValue: 0,
          useNativeDriver: true,
          // Adjust spring properties for Android
          tension: Platform.OS === 'android' ? 40 : 30,
          friction: Platform.OS === 'android' ? 8 : 7,
        }).start();
      }
    }
  };

  const handleEndGame = () => {
    // Use custom alert instead of standard Alert
    showCustomAlert({
      title: "End Game",
      message: "Are you sure you want to end the game now?",
      confirmText: "End Game",
      cancelText: "Cancel",
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
        message: "At least two players are required.",
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
      Animated.spring(flipAnim, {
        toValue: flipped ? 0 : 1,
        useNativeDriver: true,
        // Adjust spring properties for Android
        tension: Platform.OS === 'android' ? 40 : 30,
        friction: Platform.OS === 'android' ? 8 : 7,
      }).start();
      setFlipped(!flipped);
      setFlippedOnce(true);
    }
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
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

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  if (isLoading || !fontLoaded) {
    return (
      <ImageBackground source={require('../assets/redfelt.jpg')} style={styles.container}>
        <StatusBar hidden />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Game...</Text>
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
            <Text style={styles.title}>{playerName}</Text>
            <View style={styles.completedDaresBadge}>
              <Image
                source={require('../assets/DaresOnly/yellowpokerchip.png')}
                style={styles.pokerChip}
              />
              <Text style={styles.completedDaresText}>
                {completedDares[currentPlayerIndex]}
              </Text>
            </View>
            <View style={[styles.dareContainer, isLandscape ? styles.dareContainerLandscape : null]}>
              <TouchableOpacity 
                onPress={flipCard}
                activeOpacity={Platform.OS === 'android' ? 0.8 : 0.9}
              >
                <Animated.View style={[styles.card, frontAnimatedStyle]}>
                  <Image 
                    source={packImages[packName]} 
                    style={styles.cardImage}
                    fadeDuration={Platform.OS === 'android' ? 300 : 0}
                  />
                  {!flippedOnce && (
                    <View style={styles.cardHint}>
                      <Text style={styles.cardHintText}>Tap to Flip</Text>
                    </View>
                  )}
                </Animated.View>
                <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
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
                      <Icon name="check" size={24} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.dareButton,
                        currentDareCompleted === 'needTime' ? styles.moreTimeButton : null
                      ]}
                      onPress={() => handleDareCompletion('needTime')}
                      disabled={isGameOver}
                      activeOpacity={0.7}
                    >
                      <Icon name="clock-o" size={20} color="white" style={styles.buttonIcon} />
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
                      <Icon name="times" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.bottomButtons}>
              <TouchableOpacity 
                style={styles.endGameButton} 
                onPress={handleEndGame}
                activeOpacity={0.7}
              >
                <Icon name="flag" size={20} color="#fff" />
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
                <Icon name="users" size={20} color="#fff" />
                <Text style={styles.buttonText}>Players</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.daresAskedContainer}>
              <Text style={styles.daresAskedText}>
                {daresAsked[currentPlayerIndex] + 1} / {dareCount}
              </Text>
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
  scrollContent: {
    flexGrow: 1,
    padding: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 120, // Add padding at the bottom to ensure content doesn't get hidden behind buttons
  },
  title: {
    fontSize: Platform.OS === 'android' ? 36 : 40,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: Platform.OS === 'android' ? 65 : 75,
    textAlign: 'center',
    fontFamily: 'Poker',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(255, 215, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(255, 215, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        elevation: 3,
      }
    }),
  },
  dareContainer: {
    backgroundColor: 'transparent', // Changed from white to transparent
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
      android: {
        elevation: 8,
      }
    }),
    width: 375,
    height: 475,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  dareContainerLandscape: {
    flex: 1,
    marginTop: 5,
  },
  card: {
    width: 350,
    height: 425,
    backfaceVisibility: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'white',
    borderRadius: 20,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    borderRadius: 20,
  },
  cardHint: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333',
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
    color: '#333',
  },
  dareTextContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 100,
    width: '100%',
    height: '70%',
  },
  dareText: {
    color: '#333',
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'Poker' : 'Poker',
    fontSize: Platform.OS === 'android' ? 40 : 45,
    lineHeight: Platform.OS === 'android' ? 44 : 48,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    flexWrap: 'nowrap',
    flexShrink: 1,
  },
  nextPlayerButtonDisabled: {
    backgroundColor: '#aaa',
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
    position: 'absolute',
    bottom: 20,
    gap: 10,
  },
  dareButton: {
    backgroundColor: 'grey',
    padding: 10,
    borderRadius: 20,
    width: '30%',
    height: 80,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
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
    backgroundColor: '#FFA500',
  },
  buttonIcon: {
    marginBottom: 5,
  },
  dareButtonComplete: {
    backgroundColor: '#4caf50',
  },
  dareButtonIncomplete: {
    backgroundColor: '#d32f2f',
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
    zIndex: 100, // Add a high zIndex to ensure it stays on top
  },
  endGameButton: {
    backgroundColor: '#d32f2f',
    padding: 15,
    borderRadius: 10,
    width: '30%', // Reduced width for 3-button layout
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
      android: {
        elevation: 5,
      }
    }),
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextPlayerButtonBottom: {
    backgroundColor: '#304FFE',
    padding: 15,
    borderRadius: 10,
    width: '30%', // Match the width of other buttons
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
      android: {
        elevation: 5,
      }
    }),
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  managePlayersButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    width: '30%', // Reduced width for 3-button layout
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
      },
      android: {
        elevation: 5,
      }
    }),
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  daresAskedContainer: {
    position: 'absolute',
    top: 65,
    right: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 5,
    ...Platform.select({
      android: {
        elevation: 3,
      }
    }),
  },
  daresAskedText: {
    color: '#fff',
    fontSize: Platform.OS === 'android' ? 26 : 30,
  },
  completedDaresBadge: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  completedDaresText: {
    color: '#000',
    fontSize: 25,
    fontWeight: 'bold',
    position: 'absolute',
    top: '40%',
    left: '55%',
  },
  pokerChip: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
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
    fontSize: Platform.OS === 'android' ? 25 : 45,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Poker',
    marginVertical: -8,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }
    }),
  },
  casinoLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    zIndex: 1,
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
    borderColor: 'white',
  },
  spotlight: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 600,
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -150 },
      { translateY: -150 },
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 15,
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
  alertMessage: {
    fontSize: 18,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default DareOnlyScreen;