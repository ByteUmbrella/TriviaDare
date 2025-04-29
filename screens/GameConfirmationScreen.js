import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  TextInput,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Platform,
  BackHandler,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useGame } from '../Context/GameContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TRIVIA_PACKS } from '../Context/triviaPacks';
import { Audio } from 'expo-av';

const GameConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedPack } = route.params || {};
  const { 
    players, 
    setPlayers,
    timeLimit,
    TIMER_CONFIGS,
    updateTimeConfig,
    numberOfQuestions,
    setNumberOfQuestions
  } = useGame();
  
  const [localPlayers, setLocalPlayers] = useState(players);
  
  // Background music state
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const backgroundMusicRef = useRef(null);
  
  // Get pack description from TRIVIA_PACKS
  const packDetails = [...TRIVIA_PACKS.Basic, ...TRIVIA_PACKS.Premium]
    .find(pack => pack.name === selectedPack);

  // Handle background music from previous screen
  useEffect(() => {
    // Check if music was passed from previous screen
    if (route.params?.backgroundMusic) {
      // Store the music reference
      backgroundMusicRef.current = route.params.backgroundMusic;
      setBackgroundMusic(route.params.backgroundMusic);
      
      // Stop the music from TriviaPackSelectionScreen
      const stopMusic = async () => {
        try {
          if (backgroundMusicRef.current) {
            await backgroundMusicRef.current.stopAsync();
          }
        } catch (error) {
          console.error('Error stopping background music:', error);
        }
      };
      
      stopMusic();
    }
  }, [route.params?.backgroundMusic]);

  // Handle Android back button
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          handleBackPress();
          return true;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [])
  );

  const updatePlayerName = (index, newName) => {
    const updatedPlayers = [...localPlayers];
    updatedPlayers[index] = newName;
    setLocalPlayers(updatedPlayers);
  };

  const handleStartGame = () => {
    // Dismiss keyboard on Android before navigation
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
    
    // Make sure music is stopped AND unloaded when navigating to QuestionScreen
    if (backgroundMusicRef.current) {
      // Using async/await inside a try/catch to handle any errors
      const stopAndUnloadMusic = async () => {
        try {
          // First stop the music
          await backgroundMusicRef.current.stopAsync().catch(() => {});
          // Then unload it to fully release resources
          await backgroundMusicRef.current.unloadAsync().catch(() => {});
          // Set refs to null to prevent further attempts to access
          backgroundMusicRef.current = null;
          setBackgroundMusic(null);
        } catch (error) {
          console.error('Error stopping and unloading music:', error);
        }
      };
      
      // Execute the async function
      stopAndUnloadMusic();
    }
    
    // Original single-player flow with Android optimizations
    setPlayers(localPlayers);
    navigation.navigate('QuestionScreen', {
      selectedPack,
      numberOfQuestions,
      currentQuestionIndex: 0,
      // Android-specific navigation options
      ...(Platform.OS === 'android' ? {
        animation: 'slide_from_right'
      } : {})
    });
  };

  const handleTimerChange = (value) => {
    const validTimes = Object.keys(TIMER_CONFIGS).map(Number);
    const nearestTime = validTimes.reduce((prev, curr) => {
      return (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
    });
    updateTimeConfig(nearestTime);
  };

  const handleQuestionNumberChange = (value) => {
    setNumberOfQuestions(value);
  };

  // Handle back button press
  const handleBackPress = () => {
    console.log('Back button pressed');
    
    // Restart music when going back to TriviaPackSelectionScreen
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.playAsync().catch(() => {});
    }
    
    // Original behavior for single player
    navigation.reset({
      index: 0,
      routes: [{ 
        name: 'TriviaPackSelection',
        params: { restartMusic: true }
      }],
    });
  };

  const renderPlayers = () => {
    // Original grid layout for single player mode
    const rows = [];
    for (let i = 0; i < localPlayers.length; i += 2) {
      const row = (
        <View key={i} style={styles.playerRow}>
          <View style={styles.playerColumn}>
            <Text style={styles.playerLabel}>PLAYER {i + 1}</Text>
            <TextInput
              style={styles.playerInput}
              value={localPlayers[i]}
              onChangeText={(text) => updatePlayerName(i, text)}
              placeholder="Enter name"
              placeholderTextColor="rgba(255, 215, 0, 0.5)"
              returnKeyType="done"
              blurOnSubmit={Platform.OS === 'android'}
            />
          </View>
          {i + 1 < localPlayers.length && (
            <View style={styles.playerColumn}>
              <Text style={styles.playerLabel}>PLAYER {i + 2}</Text>
              <TextInput
                style={styles.playerInput}
                value={localPlayers[i + 1]}
                onChangeText={(text) => updatePlayerName(i + 1, text)}
                placeholder="Enter name"
                placeholderTextColor="rgba(255, 215, 0, 0.5)"
                returnKeyType="done"
                blurOnSubmit={Platform.OS === 'android'}
              />
            </View>
          )}
        </View>
      );
      rows.push(row);
    }
    return rows;
  };

  // Wrap content in keyboard avoiding view for Android
  const ContentWrapper = Platform.OS === 'android' ? KeyboardAvoidingView : React.Fragment;
  const contentWrapperProps = Platform.OS === 'android' ? {
    behavior: 'height',
    keyboardVerticalOffset: 0,
    style: { flex: 1 }
  } : {};

  return (
    <ImageBackground 
      source={require('../assets/gameshow.jpg')} 
      style={styles.container}
      fadeDuration={Platform.OS === 'android' ? 300 : 0}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.overlay} />
        <ContentWrapper {...contentWrapperProps}>
          <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
            <View style={styles.mainContainer}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleBackPress}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Ionicons name="arrow-back" size={30} color="#FFD700" />
              </TouchableOpacity>

              <View style={styles.gameInfoSection}>
                <Text style={styles.mainTitle}>{selectedPack}</Text>
                <Text style={styles.packDescription}>{packDetails?.description}</Text>

                <View style={styles.sliderSection}>
                  <Text style={styles.sliderTitle}>QUESTIONS PER PLAYER</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={3}
                    maximumValue={10}
                    step={1}
                    value={numberOfQuestions}
                    onValueChange={handleQuestionNumberChange}
                    minimumTrackTintColor="#FFD700"
                    maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                    thumbTintColor="#FFD700"
                  />
                  <Text style={styles.sliderValue}>{numberOfQuestions}</Text>
                </View>

                <View style={styles.sliderSection}>
                  <Text style={styles.sliderTitle}>TIMER SETTING</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={15}
                    maximumValue={60}
                    step={15}
                    value={timeLimit}
                    onValueChange={handleTimerChange}
                    minimumTrackTintColor="#FFD700"
                    maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                    thumbTintColor="#FFD700"
                  />
                  <View style={styles.timerInfo}>
                    <Text style={styles.timerValue}>{TIMER_CONFIGS[timeLimit].label}</Text>
                    <Text style={styles.timerDetail}>{timeLimit}s - {TIMER_CONFIGS[timeLimit].baseScore} pts</Text>
                  </View>
                </View>
              </View>

              <View style={styles.playersSection}>
                <Text style={styles.sectionTitle}>PLAYERS</Text>
                <View style={styles.playersGrid}>
                  {renderPlayers()}
                </View>
              </View>

              <TouchableOpacity 
                style={styles.startButton}
                onPress={handleStartGame}
                activeOpacity={0.7}
              >
                <Text style={styles.startButtonText}>START GAME</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </ContentWrapper>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 30 : 0, // Add padding for Android status bar
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  mainContainer: {
    flex: 1,
    padding: Platform.OS === 'android' ? 10 : 15, // Reduced padding for Android
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  gameInfoSection: {
    marginTop: Platform.OS === 'android' ? 40 : 50, // Reduced top margin for Android
  },
  mainTitle: {
    fontSize: Platform.OS === 'android' ? 24 : 32, // Smaller on Android
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5, // Reduced bottom margin
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      }
    }),
    letterSpacing: 3,
  },
  packDescription: {
    fontSize: 16, // Reduced font size 
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15, // Reduced bottom margin
    fontStyle: 'italic',
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }
    }),
  },
  sliderSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: Platform.OS === 'android' ? 10 : 15, // Reduced padding for Android
    marginBottom: Platform.OS === 'android' ? 10 : 15, // Reduced margin for Android
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  sliderTitle: {
    fontSize: 14, // Reduced font size
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 5, // Reduced margin
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    color: '#FFFFFF',
    fontSize: 22, // Reduced font size
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 3, // Reduced margin
  },
  timerInfo: {
    alignItems: 'center',
    marginTop: 3, // Reduced margin
  },
  timerValue: {
    color: '#FFD700',
    fontSize: Platform.OS === 'android' ? 20 : 24, // Smaller on Android
    fontWeight: 'bold',
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }
    }),
  },
  timerDetail: {
    color: '#FFFFFF',
    fontSize: 14, // Reduced font size
    marginTop: 2,
  },
  playersSection: {
    flex: 1,
    marginTop: Platform.OS === 'android' ? 5 : 15, // Reduced margin for Android
  },
  sectionTitle: {
    fontSize: Platform.OS === 'android' ? 20 : 24, // Smaller on Android
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: 8, // Reduced margin
    textAlign: 'center',
    letterSpacing: 2,
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }
    }),
  },
  playersGrid: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6, // Reduced margin
  },
  playerColumn: {
    flex: 1,
    marginHorizontal: 3, // Reduced margin
  },
  playerLabel: {
    fontSize: 12, // Reduced font size
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: 3, // Reduced margin
    letterSpacing: 1,
  },
  playerInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    padding: Platform.OS === 'android' ? 4 : 6, // Reduced padding
    height: Platform.OS === 'android' ? 38 : 40, // Reduced height
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  startButton: {
    backgroundColor: '#FF4500',
    padding: Platform.OS === 'android' ? 10 : 15, // Reduced padding for Android
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10, // Reduced margin
    marginBottom: 8, // Reduced margin
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
        elevation: 8,
      }
    }),
  },
  startButtonText: {
    color: 'white',
    fontSize: Platform.OS === 'android' ? 20 : 24, // Smaller on Android
    fontWeight: 'bold',
    letterSpacing: 3,
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: '#000',
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
    marginTop: 20,
    fontSize: 20,
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }
    }),
  }
});

export default GameConfirmationScreen;