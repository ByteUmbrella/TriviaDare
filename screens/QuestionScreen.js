import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ImageBackground,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  BackHandler,
  ToastAndroid
} from 'react-native';

import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useGame } from '../Context/GameContext';
import { useSettings } from '../Context/Settings';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import QuestionContainer from './QuestionContainer';
import ScoreBanner from './ScoreBanner';
import ScoringInfoModal from '../Context/ScoringInfoModal';
import DarePopup from './DarePopup.js';
import { 
  loadPackQuestions, 
  markQuestionAsUsed, 
  resetPackProgress,
  getPackStatistics,
  checkPackAvailability 
} from '../Context/triviaPacks';

// Custom Gameshow-style Alert Component
const GameshowAlert = ({ visible, title, message, onCancel, onConfirm, cancelText = "Cancel", confirmText = "OK", showCancel = true }) => {
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
          
          <View style={[
            styles.alertButtonContainer,
            !showCancel && { justifyContent: 'center' }
          ]}>
            {showCancel && (
              <TouchableOpacity
                style={styles.alertCancelButton}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.alertCancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.alertConfirmButton,
                !showCancel && { width: '80%' }
              ]}
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

// Debug logger with platform-specific logging
const DEBUG = __DEV__;
const log = (...args) => {
  if (DEBUG) {
    if (Platform.OS === 'android') {
      // Use tag-based logging for better Android debugging
      console.log('TriviaDare:QuestionScreen', ...args);
    } else {
      console.log(...args);
    }
  }
};

// Statistics tracking interface
const StatsTracker = {
  async updatePackStats(packId, questionId, correct) {
    try {
      await markQuestionAsUsed(packId, questionId);
      const stats = await getPackStatistics(packId);
      log('Updated pack statistics:', stats);
      return stats;
    } catch (error) {
      console.error('Error updating pack statistics:', error);
      // Android-specific error handling
      if (Platform.OS === 'android') {
        ToastAndroid.show('Error updating stats', ToastAndroid.SHORT);
      }
      return null;
    }
  },

  async verifyPackAvailability(pack) {
    try {
      // First check if we can load the questions
      const result = await loadPackQuestions(pack);
      
      if (!result.success) {
        console.log('Pack not found:', pack);
        return false;
      }

      // Get statistics to check if pack has been used before
      const stats = await getPackStatistics(pack);
      
      // If this is a new pack (no used questions yet), it's definitely available
      if (!stats.usedQuestions['easy']) {
        console.log('New pack detected:', pack);
        return true;
      }

      const unusedCount = stats.unusedQuestions['easy'] || 0;
      const totalQuestions = unusedCount + (stats.usedQuestions['easy'] || 0);
      
      // A pack is available if it has unused questions
      const hasQuestions = unusedCount > 0;
      
      console.log('Pack availability check:', {
        pack,
        unusedCount,
        totalQuestions,
        hasQuestions,
        isNewPack: !stats.usedQuestions['easy']
      });
      
      return hasQuestions;
    } catch (error) {
      console.error('Error checking pack availability:', error);
      // Android-specific error handling
      if (Platform.OS === 'android') {
        ToastAndroid.show('Error checking pack availability', ToastAndroid.SHORT);
      }
      return false;
    }
  }
};

// Question validation utility
const validateQuestion = (question) => {
  if (!question) return false;
  
  const requiredFields = [
    'Question ID',
    'Question Text',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer'
  ];

  return requiredFields.every(field => question[field]);
};

const MAX_PLAYERS = 8;
const MAX_RETRIES = 3;


// Sound playback functions with platform-specific optimizations
const playWrongAnswerSound = async (soundObject, isMuted) => {
  if (!isMuted && soundObject) {
    try {
      await soundObject.stopAsync();
      await soundObject.setPositionAsync(0);
      
      // Android-specific sound optimizations
      if (Platform.OS === 'android') {
        // Set lower buffer size for Android to reduce latency
        await soundObject.setRateAsync(1.0, false);
        // Use a slightly lower volume on Android to prevent distortion on some devices
        await soundObject.setVolumeAsync(0.85);
      }
      
      await soundObject.playAsync();
    } catch (error) {
      console.error('Error playing wrong answer sound:', error);
    }
  }
};

const QuestionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    numberOfQuestions,
    selectedPack: routeSelectedPack,
  } = route.params || {};

  const {
    players,
    setPlayers,
    scores,
    setScores,
    currentPlayerIndex,
    setCurrentPlayerIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    timeLimit,
    currentScore,
    setCurrentScore,
    performingDare,
    setPerformingDare,
    resetGame,
    resetTimerAndScore,
    TIMER_CONFIGS,
    questions = [],
    setQuestions,
    currentQuestion,
    setCurrentQuestion
  } = useGame();

  // Enhanced state with error tracking
  const [state, setState] = useState({
    selectedOption: null,
    questions: [],
    loadingError: null,
    retryCount: 0
  });

  // UI State
  const [uiState, setUiState] = useState({
    showWinnerButton: false,
    isGameStarted: false,
    isDareVisible: false,
    isPrompting: false,
    showScores: true,
    showQuestion: false,
    answerSubmitted: false,
    showScoringInfo: false,
  });

  // Game State
  const [gameState, setGameState] = useState({
    timeLeft: timeLimit,
    intervalId: null,
    globalQuestionIndex: 1,
    currentQuestion: null,
    isLoadingQuestions: false,
    isReadyForNextQuestion: true,
    isLowTimeWarningPlaying: false,
    packStats: null,
    currentRound: 1
  });

  // Sound State
  const [soundState, setSoundState] = useState({
    tickSound: null,
    lowTimeSound: null,
    correctSound: null,
    backgroundMusic: null  
  });

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: true
  });

  // Function to show the custom alert
  const showCustomAlert = (config) => {
    setAlertConfig({
      title: config.title || 'Alert',
      message: config.message || '',
      onConfirm: config.onConfirm || (() => {}),
      onCancel: config.onCancel || (() => {}),
      confirmText: config.confirmText || 'OK',
      cancelText: config.cancelText || 'Cancel',
      showCancel: config.showCancel !== false
    });
    setAlertVisible(true);
  };

  const { isGloballyMuted } = useSettings();

  // Timer pause state
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const selectedPack = routeSelectedPack;

  // Android back button handler
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (Platform.OS === 'android') {
          showCustomAlert({
            title: "Quit Game",
            message: "Are you sure you want to quit this game?",
            confirmText: "Quit",
            cancelText: "Stay",
            onConfirm: () => {
              resetGame();
              navigation.goBack();
            }
          });
          return true; // Prevent default behavior
        }
        return false; // Let default behavior happen for iOS
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  useEffect(() => {
    let isMounted = true;

    const cleanup = async () => {
      try {
        if (gameState.intervalId) {
          clearInterval(gameState.intervalId);
        }

        // Stop and unload background music
        if (soundState.backgroundMusic) {
          await soundState.backgroundMusic.stopAsync().catch(() => {});
          await soundState.backgroundMusic.unloadAsync();
        }

        // Android requires more aggressive sound cleanup
        if (Platform.OS === 'android') {
          Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            interruptionModeIOS: 1,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: 1,
            playThroughEarpieceAndroid: false,
          }).catch(console.error);
        }

        if (soundState.tickSound) {
          await soundState.tickSound.stopAsync().catch(() => {});
          await soundState.tickSound.unloadAsync();
        }
        if (soundState.lowTimeSound) {
          await soundState.lowTimeSound.stopAsync().catch(() => {});
          await soundState.lowTimeSound.unloadAsync();
        }
        if (soundState.correctSound) {
          await soundState.correctSound.stopAsync().catch(() => {});
          await soundState.correctSound.unloadAsync();
        }

        if (isMounted) {
          setGameState(prev => ({
            ...prev,
            intervalId: null,
            isLoadingQuestions: false,
            isNavigatingToResults: false,
            isLowTimeWarningPlaying: false
          }));

          setUiState(prev => ({
            ...prev,
            showWinnerButton: false,
            isGameStarted: false,
            isDareVisible: false,
            isPrompting: false,
            showScores: true,
            showQuestion: false,
            answerSubmitted: false,
            showScoringInfo: false
          }));

          setState(prev => ({
            ...prev,
            selectedOption: null,
            loadingError: null
          }));
        }
      } catch (error) {
        console.error('Error in cleanup:', error);
      }
    };

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  // Timer pause effect
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      if (uiState.showScoringInfo) {
        setIsTimerPaused(true);
      } else {
        setIsTimerPaused(false);
      }
    }
    return () => {
      isMounted = false;
    };
  }, [uiState.showScoringInfo]);

  // NEW: Background music control based on question visibility
  useEffect(() => {
    if (!uiState.showQuestion && soundState.backgroundMusic) {
      stopBackgroundMusic();
    }
    return () => {
      stopBackgroundMusic();
    };
  }, [uiState.showQuestion, soundState.backgroundMusic]);

  // Load sounds effect with platform-specific optimizations
  useEffect(() => {
    let isMounted = true;
    let warningSound = null;
    let wrongAnswerSound = null;
    let backgroundMusicSound = null;

    const loadSounds = async () => {
      try {
        warningSound = new Audio.Sound();
        wrongAnswerSound = new Audio.Sound();
        const correctAnswerSound = new Audio.Sound();
        backgroundMusicSound = new Audio.Sound();
        
        // Configure audio mode with Android-specific settings
        if (Platform.OS === 'android') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            interruptionModeIOS: 1,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: 1,
            playThroughEarpieceAndroid: false,
          });
        }
        
        await warningSound.loadAsync(require('../assets/Sounds/warningsound.mp3'));
        await wrongAnswerSound.loadAsync(require('../assets/Sounds/wronganswer.mp3'));
        await correctAnswerSound.loadAsync(require('../assets/Sounds/correctanswer.mp3'));
        await backgroundMusicSound.loadAsync(require('../assets/Sounds/questionbackground.mp3'));
        
        // Set background music to loop and lower volume
        await backgroundMusicSound.setIsLoopingAsync(true);
        await backgroundMusicSound.setVolumeAsync(0.5); // Adjust volume so sound effects can be heard
        
        // Apply Android-specific sound optimizations
        if (Platform.OS === 'android') {
          await warningSound.setRateAsync(1.0, false);
          await wrongAnswerSound.setRateAsync(1.0, false);
          await correctAnswerSound.setRateAsync(1.0, false);
          await backgroundMusicSound.setRateAsync(1.0, false);
        }
        
        if (isMounted) {
          setSoundState({
            lowTimeSound: warningSound,
            tickSound: wrongAnswerSound,
            correctSound: correctAnswerSound,
            backgroundMusic: backgroundMusicSound
          });
        }
      } catch (error) {
        console.error('Error loading sounds:', error);
        // Android-specific error handling
        if (Platform.OS === 'android') {
          ToastAndroid.show('Error loading sounds', ToastAndroid.SHORT);
        }
      }
    };
  
    loadSounds();
  
    return () => {
      isMounted = false;
      const cleanup = async () => {
        try {
          if (warningSound) {
            await warningSound.stopAsync().catch(() => {});
            await warningSound.unloadAsync();
          }
          if (wrongAnswerSound) {
            await wrongAnswerSound.stopAsync().catch(() => {});
            await wrongAnswerSound.unloadAsync();
          }
          if (soundState.correctSound) {
            await soundState.correctSound.stopAsync().catch(() => {});
            await soundState.correctSound.unloadAsync();
          }
          if (backgroundMusicSound) {
            await backgroundMusicSound.stopAsync().catch(() => {});
            await backgroundMusicSound.unloadAsync();
          }
        } catch (error) {
          console.error('Error in sound cleanup:', error);
        }
      };
      cleanup();
    };
  }, []);

  // Initial setup effect with platform-specific optimizations
  useEffect(() => {
    let isMounted = true;
    
    const initializeGame = async () => {
      try {
        if (!isMounted) return;
    
        setCurrentPlayerIndex(0);
        setCurrentQuestionIndex(0);
        setGameState(prev => ({ 
          ...prev, 
          globalQuestionIndex: 1,
          currentRound: 1,
          isLoadingQuestions: true
        }));
        
        setUiState(prev => ({
          ...prev,
          isGameStarted: false,
          showQuestion: false,
          answerSubmitted: false
        }));
        
        resetTimerAndScore();
    
        if (selectedPack && numberOfQuestions) {
          console.log('Loading questions for pack:', selectedPack);
          if (isMounted) {
            // Android memory optimization - break up heavy operations
            if (Platform.OS === 'android') {
              // Use setTimeout to avoid blocking UI thread
              setTimeout(async () => {
                if (isMounted) {
                  await loadQuestions();
                }
              }, 100);
            } else {
              await loadQuestions();
            }
          }
        }
      } catch (error) {
        console.error('Error in initializeGame:', error);
        if (isMounted) {
          showCustomAlert({
            title: "Error",
            message: "There was a problem starting the game. Please try again.",
            confirmText: "OK",
            showCancel: false,
            onConfirm: () => navigation.goBack()
          });
        }
      } finally {
        if (isMounted) {
          setGameState(prev => ({ ...prev, isLoadingQuestions: false }));
        }
      }
    };
  
    initializeGame();
  
    return () => {
      isMounted = false;
      const { intervalId } = gameState;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Add this useEffect right after your other useEffect hooks
useEffect(() => {
  let isMounted = true;

  if (isMounted && 
      !performingDare && 
      players.length > 0 && 
      questions.length > 0 && 
      gameState.isReadyForNextQuestion) {
    
    console.log('Triggering prompt for player:', {
      currentPlayerIndex,
      questionsLength: questions.length,
      isReady: gameState.isReadyForNextQuestion
    });
    
    // Call the promptNextPlayer function here
    promptNextPlayer(currentPlayerIndex);
    
    // Mark that we're no longer ready for the next question until this one completes
    setGameState(prev => ({ ...prev, isReadyForNextQuestion: false }));
  }
  
  return () => {
    isMounted = false;
  };
}, [
  players.length, 
  currentPlayerIndex, 
  questions.length,
  performingDare, 
  gameState.isReadyForNextQuestion,
  promptNextPlayer // Add this to the dependency array
]);

// First, add these new state variables at the top of your component
const [audioIsReady, setAudioIsReady] = useState(false);
const [firstPlayAttempted, setFirstPlayAttempted] = useState(false);

// Then, replace your existing sound loading useEffect with this enhanced version
useEffect(() => {
  let isMounted = true;
  let warningSound = null;
  let wrongAnswerSound = null;
  let backgroundMusicSound = null;
  let correctAnswerSound = null;

  const loadSounds = async () => {
    try {
     // In your loadSounds function, update this section:
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
         // Use the constant from Audio API instead of a string
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
     });
      
      console.log('Audio mode configured');
      
      // Create all sound objects
      warningSound = new Audio.Sound();
      wrongAnswerSound = new Audio.Sound();
      correctAnswerSound = new Audio.Sound();
      backgroundMusicSound = new Audio.Sound();
      
      // Load all sounds sequentially to avoid race conditions
      await warningSound.loadAsync(require('../assets/Sounds/warningsound.mp3'));
      await wrongAnswerSound.loadAsync(require('../assets/Sounds/wronganswer.mp3'));
      await correctAnswerSound.loadAsync(require('../assets/Sounds/correctanswer.mp3'));
      
      // Load background music last with explicit listener for load status
      backgroundMusicSound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && !audioIsReady && isMounted) {
          console.log('Background music is now fully loaded and ready');
          setAudioIsReady(true);
        }
      });
      
      await backgroundMusicSound.loadAsync(require('../assets/Sounds/questionbackground.mp3'));
      
      // Configure background music properties
      await backgroundMusicSound.setIsLoopingAsync(true);
      await backgroundMusicSound.setVolumeAsync(0.5);
      
      if (isMounted) {
        setSoundState({
          lowTimeSound: warningSound,
          tickSound: wrongAnswerSound,
          correctSound: correctAnswerSound,
          backgroundMusic: backgroundMusicSound
        });
        
        // Prime the audio system by doing a quick play and stop 
        // This helps on some devices with first-play issues
        try {
          await backgroundMusicSound.playAsync();
          await new Promise(resolve => setTimeout(resolve, 100));
          await backgroundMusicSound.stopAsync();
          await backgroundMusicSound.setPositionAsync(0);
          console.log('Background music primed successfully');
          
          if (isMounted) {
            setAudioIsReady(true);
          }
        } catch (e) {
          console.error('Error priming background music:', e);
          // Still mark as ready even if priming fails
          if (isMounted) {
            setAudioIsReady(true);
          }
        }
      }
    } catch (error) {
      
      // Mark audio as ready even if there's an error to prevent blocking the game
      if (isMounted) {
        setAudioIsReady(true);
      }
    }
  };

  loadSounds();

  return () => {
    isMounted = false;
    const cleanup = async () => {
      try {
        if (warningSound) {
          await warningSound.stopAsync().catch(() => {});
          await warningSound.unloadAsync();
        }
        if (wrongAnswerSound) {
          await wrongAnswerSound.stopAsync().catch(() => {});
          await wrongAnswerSound.unloadAsync();
        }
        if (correctAnswerSound) {
          await correctAnswerSound.stopAsync().catch(() => {});
          await correctAnswerSound.unloadAsync();
        }
        if (backgroundMusicSound) {
          await backgroundMusicSound.stopAsync().catch(() => {});
          await backgroundMusicSound.unloadAsync();
        }
      } catch (error) {
        console.error('Error in sound cleanup:', error);
      }
    };
    cleanup();
  };
}, []);

// Now replace your existing playBackgroundMusic function
const playBackgroundMusic = async () => {
  // Skip if muted or no sound object
  if (isGloballyMuted || !soundState.backgroundMusic) {
    console.log('Skipping background music (muted or not available)');
    return;
  }
  
  // Special handling for first play
  if (!firstPlayAttempted) {
    setFirstPlayAttempted(true);
    console.log('First play attempt for background music');
    
    // Make sure we have a fresh instance for first play
    try {
      const currentSound = soundState.backgroundMusic;
      await currentSound.stopAsync().catch(() => {});
      await currentSound.unloadAsync().catch(() => {});
      
      // Create and configure a fresh sound object
      const freshSound = new Audio.Sound();
      await freshSound.loadAsync(require('../assets/Sounds/questionbackground.mp3'));
      await freshSound.setIsLoopingAsync(true);
      await freshSound.setVolumeAsync(0.5);
      
      // Update the sound state with fresh object
      setSoundState(prev => ({
        ...prev,
        backgroundMusic: freshSound
      }));
      
      // Play the fresh sound
      console.log('Playing fresh background music instance');
      await freshSound.playAsync();
      return;
    } catch (error) {
      console.error('Error with fresh background music instance:', error);
      // Fall through to regular play as backup
    }
  }
  
  // Standard play for subsequent attempts
  try {
    const sound = soundState.backgroundMusic;
    await sound.stopAsync().catch(() => {});
    await sound.setPositionAsync(0);
    console.log('Playing background music (regular path)');
    await sound.playAsync();
  } catch (error) {
    console.error('Error playing background music:', error);
  }
};


// Update your stopBackgroundMusic function:
const stopBackgroundMusic = async () => {
  if (soundState.backgroundMusic) {
    try {
      // Check if it's loaded first
      const status = await soundState.backgroundMusic.getStatusAsync().catch(() => ({ isLoaded: false }));
      if (status.isLoaded) {
        await soundState.backgroundMusic.stopAsync();
        console.log('Background music stopped');
      }
    } catch (error) {
      console.error('Error stopping background music:', error);
    }
  }
};

  // Core game functions
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const playCorrectAnswerSound = async (soundObject, isMuted) => {
    if (!isMuted && soundObject) {
      try {
        await soundObject.stopAsync();
        await soundObject.setPositionAsync(0);
        
        // Android-specific sound optimizations
        if (Platform.OS === 'android') {
          await soundObject.setRateAsync(1.0, false);
          // Use a slightly lower volume on Android to prevent distortion on some devices
          await soundObject.setVolumeAsync(0.8);
        } else {
          await soundObject.setVolumeAsync(0.9);
        }
        
        await soundObject.playAsync();
      } catch (error) {
        console.error('Error playing correct answer sound:', error);
      }
    }
  };

  const loadQuestions = useCallback(async () => {
    let isMounted = true;
    setGameState(prev => ({ ...prev, isLoadingQuestions: true }));
    
    try {
      // Android-specific loading indicator
      if (Platform.OS === 'android') {
        ToastAndroid.show('Loading questions...', ToastAndroid.SHORT);
      }
      
      const result = await loadPackQuestions(selectedPack);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load pack questions');
      }
  
      const validQuestions = result.data.filter(validateQuestion);
      
      if (validQuestions.length < numberOfQuestions * players.length) {
        throw new Error('Not enough valid questions available');
      }
  
      const shuffledQuestions = shuffleArray(validQuestions);
      
      // Android memory optimization - break up heavy operations for large question sets
      let neededQuestions;
      if (Platform.OS === 'android' && shuffledQuestions.length > 100) {
        // Process in chunks to avoid UI freezing on Android
        const chunkSize = 50;
        const chunks = [];
        for (let i = 0; i < numberOfQuestions * players.length; i += chunkSize) {
          chunks.push(shuffledQuestions.slice(i, Math.min(i + chunkSize, numberOfQuestions * players.length)));
        }
        neededQuestions = [].concat(...chunks);
      } else {
        neededQuestions = shuffledQuestions.slice(0, numberOfQuestions * players.length);
      }
  
      console.log('Setting questions in context:', {
        count: neededQuestions.length,
        firstQuestion: neededQuestions[0]?.['Question Text']
      });
  
      if (!isMounted) return;
  
      // Update questions in context
      setQuestions(neededQuestions);
      setCurrentQuestion(neededQuestions[0]);
  
      // Set initial game state
      setGameState(prev => ({
        ...prev,
        isLoadingQuestions: false,
        timeLeft: timeLimit,
        globalQuestionIndex: 1,
        currentRound: 1,
        isReadyForNextQuestion: true
      }));
  
      const stats = await getPackStatistics(selectedPack);
      if (isMounted) {
        setGameState(prev => ({ ...prev, packStats: stats }));
        
        // Re-initialize background music after questions are loaded
        // This ensures the sound is ready for the first player
        if (soundState.backgroundMusic) {
          console.log('Re-initializing background music for first player');
          soundState.backgroundMusic.unloadAsync()
            .catch(e => console.log('Unload error (may be expected):', e.message))
            .finally(() => {
              if (isMounted) {
                soundState.backgroundMusic.loadAsync(require('../assets/Sounds/questionbackground.mp3'))
                  .then(() => {
                    soundState.backgroundMusic.setIsLoopingAsync(true);
                    soundState.backgroundMusic.setVolumeAsync(0.5);
                    console.log('Background music re-initialized successfully');
                  })
                  .catch(error => {
                    console.error('Error re-initializing background music:', error);
                  });
              }
            });
        }
      }
  
    } catch (error) {
      console.error('Error loading questions:', error);
      if (isMounted) {
        showCustomAlert({
          title: "Error Loading Questions",
          message: "There was a problem loading the questions. Would you like to try again?",
          confirmText: "Try Again",
          cancelText: "Cancel",
          onConfirm: loadQuestions,
          onCancel: () => navigation.goBack()
        });
      }
    } finally {
      if (isMounted) {
        setGameState(prev => ({ ...prev, isLoadingQuestions: false }));
      }
    }
  }, [selectedPack, numberOfQuestions, players.length, timeLimit, soundState.backgroundMusic]);

  // Enhanced next player prompt with statistics update and platform-specific optimizations
const promptNextPlayer = useCallback(async (index) => {
  let isMounted = true;
  if (!players?.length || index >= players.length || !questions.length) {
    return;
  }

  try {
    const currentQuestion = questions[currentQuestionIndex];
    console.log('promptNextPlayer debug:', {
      currentQuestionIndex,
      nextIndex: currentQuestionIndex,
      currentQuestion: currentQuestion?.['Question Text'],
      questionsAvailable: questions.length,
      currentPlayer: players[index],
      globalQuestionIndex: gameState.globalQuestionIndex
    });
    
    if (!currentQuestion) {
      const stats = await getPackStatistics(selectedPack);
      const unusedQuestions = stats.unusedQuestions['easy'] || 0;

      if (unusedQuestions < numberOfQuestions && isMounted) {
        showCustomAlert({
          title: "No More Questions",
          message: "Would you like to reset the pack and continue?",
          confirmText: "Reset and Continue",
          cancelText: "Cancel",
          onCancel: () => navigation.goBack(),
          onConfirm: async () => {
            if (isMounted) {
              await resetPackProgress(selectedPack);
              await loadQuestions();
            }
          }
        });
        return;
      }
    }

    if (isMounted) {
      setCurrentQuestion(currentQuestion);
      setGameState(prev => ({
        ...prev,
        timeLeft: timeLimit
      }));
      
      if (currentQuestion) {
        await StatsTracker.updatePackStats(
          selectedPack,
          currentQuestion['Question ID'],
          false
        );
      }
  
      setState(prev => ({ ...prev, selectedOption: null }));
      setCurrentScore(TIMER_CONFIGS[timeLimit].baseScore);
      
      if (gameState.intervalId) {
        clearInterval(gameState.intervalId);
      }
  
      // Check if this is the first player at first turn
      const isFirstPlayerFirstTurn = index === 0 && gameState.globalQuestionIndex === 1;
      
      // Pre-initialize audio for first player specifically
      if (isFirstPlayerFirstTurn && soundState.backgroundMusic) {
        console.log('Pre-initializing audio for first player');
        try {
          // Create a completely new sound instance for first player
          const tempSound = new Audio.Sound();
          await tempSound.loadAsync(require('../assets/Sounds/questionbackground.mp3'));
          
          // Play and immediately stop to "warm up" the audio system
          await tempSound.playAsync();
          await new Promise(resolve => setTimeout(resolve, 50));
          await tempSound.stopAsync();
          await tempSound.unloadAsync();
          
          console.log('Audio pre-initialization completed');
        } catch (e) {
          console.error('Audio pre-initialization error:', e);
        }
      }
  
      // IMPORTANT: Make sure this showCustomAlert is working
      showCustomAlert({
        title: "Ready to Play?",
        message: `${players[index]}, are you ready to start your turn?`,
        confirmText: "Start",
        showCancel: false,
        onConfirm: async () => {
          if (isMounted) {
            // Start the timer first
            startTimer(index);
            
            // First player needs special handling
            if (isFirstPlayerFirstTurn) {
              console.log('First player starting turn - special audio handling');
              try {
                // Create a fresh audio instance specifically for first player
                const newMusic = new Audio.Sound();
                await newMusic.loadAsync(require('../assets/Sounds/questionbackground.mp3'));
                await newMusic.setIsLoopingAsync(true);
                await newMusic.setVolumeAsync(0.5);
                
                // Update the sound state with this new instance
                setSoundState(prev => ({
                  ...prev,
                  backgroundMusic: newMusic
                }));
                
                // Show the question first
                setUiState(prev => ({
                  ...prev,
                  isGameStarted: true,
                  showQuestion: true
                }));
                
                // Play with a longer delay for first player
                setTimeout(async () => {
                  try {
                    console.log('Playing first player audio');
                    await newMusic.playAsync();
                  } catch (playError) {
                    console.error('Error playing first player audio:', playError);
                  }
                }, 300);
                
              } catch (audioError) {
                console.error('Error setting up first player audio:', audioError);
                // Still show the question even if audio fails
                setUiState(prev => ({
                  ...prev,
                  isGameStarted: true,
                  showQuestion: true
                }));
              }
            } else {
              // For all other players, use the normal flow
              setUiState(prev => ({
                ...prev,
                isGameStarted: true,
                showQuestion: true
              }));
              
              // Use normal background music function with a short delay
              setTimeout(() => {
                playBackgroundMusic();
              }, 100);
            }
          }
        }
      });
      
      // Debug this call
      console.log("Showing player prompt alert for:", players[index]);
    }
  } catch (error) {
    console.error('Error in promptNextPlayer:', error);
    if (isMounted) {
      showCustomAlert({
        title: "Error",
        message: "There was a problem loading the next question.",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => navigation.goBack()
      });
    }
  }

  return () => {
    isMounted = false;
  };
}, [players, questions, currentQuestionIndex, selectedPack, timeLimit, TIMER_CONFIGS, soundState.backgroundMusic]);
  
const handleOptionSelect = (option) => {
  setState(prev => ({ ...prev, selectedOption: option }));
  log('Option selected:', option);
  
  // Android haptic feedback
  if (Platform.OS === 'android') {
    try {
      const Vibration = require('react-native').Vibration;
      Vibration.vibrate(50); // Short vibration for feedback
    } catch (e) {
      console.log('Vibration not available');
    }
  }
};

const calculateQuestionNumber = (globalIndex, playersCount) => {
  return Math.floor(globalIndex / playersCount) + 1;
};

const isGameComplete = (currentGlobalIndex, questionsPerPlayer, playerCount) => {
  const currentQuestionNumber = calculateQuestionNumber(currentGlobalIndex, playerCount);
  const isComplete = currentQuestionNumber > questionsPerPlayer;
  
  log('Game completion check:', {
    currentGlobalIndex,
    currentQuestionNumber,
    questionsPerPlayer,
    playerCount,
    isComplete
  });
  
  return isComplete;
};

const handleAnswerConfirmation = async () => {
  let isMounted = true;
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) return;

  try {
    const correctAnswerKey = currentQuestion['Correct Answer'];
    const correctAnswer = currentQuestion[correctAnswerKey];

    if (gameState.intervalId) {
      clearInterval(gameState.intervalId);
    }
    
    // Stop background music when answer is submitted
    stopBackgroundMusic();

    if (isMounted) {
      setUiState(prev => ({ ...prev, answerSubmitted: true }));
    }

    const isCorrect = state.selectedOption === correctAnswer;
    console.log('Answer check:', { 
      isCorrect, 
      selectedOption: state.selectedOption, 
      correctAnswer,
      playerCount: players.length,
      isSinglePlayer: players.length === 1
    });

    await StatsTracker.updatePackStats(
      selectedPack,
      currentQuestion['Question ID'],
      isCorrect
    );

    if (!isMounted) return;

    if (isCorrect) {
      // Android haptic feedback for correct answer
      if (Platform.OS === 'android') {
        try {
          const Vibration = require('react-native').Vibration;
          // Pattern for success - two short vibrations
          Vibration.vibrate([0, 100, 100, 100]);
        } catch (e) {
          console.log('Vibration not available');
        }
      }
      
      // Play correct answer sound
      await playCorrectAnswerSound(soundState.correctSound, isGloballyMuted);

      const basePoints = TIMER_CONFIGS[timeLimit].baseScore;
      const timeBonus = Math.floor(gameState.timeLeft * 2);
      const totalPoints = basePoints + timeBonus;

      console.log('Score calculation:', {
        basePoints,
        timeBonus,
        totalPoints,
        currentPlayerIndex,
        currentScores: scores,
        isSinglePlayer: players.length === 1
      });

      let updatedScores;

      await new Promise(resolve => {
        if (isMounted) {
          setScores(prevScores => {
            const newScores = [...prevScores];
            newScores[currentPlayerIndex] = (Number(newScores[currentPlayerIndex]) || 0) + totalPoints;
            updatedScores = [...newScores];
            console.log('Updating scores:', {
              prevScores,
              newScores,
              currentPlayerIndex,
              totalPoints
            });
            resolve();
            return newScores;
          });
        } else {
          resolve();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isMounted) return;

      const nextGlobalIndex = gameState.globalQuestionIndex + 1;
      
      // Critical fix for single player mode - calculate next round appropriately
      // This ensures game progression when there's only one player
      const nextRound = players.length === 1 
        ? nextGlobalIndex // In single player, each question is a new round
        : Math.ceil(nextGlobalIndex / players.length);
        
      const isLastQuestion = nextRound > numberOfQuestions;

      console.log('Question progression check:', {
        nextGlobalIndex,
        nextRound,
        numberOfQuestions,
        isLastQuestion,
        currentScores: updatedScores,
        playerCount: players.length,
        isSinglePlayer: players.length === 1
      });

      setTimeout(() => {
        if (isMounted) {
          // Android-specific alert enhancement
          if (Platform.OS === 'android') {
            // Toast notification for immediate feedback
            ToastAndroid.showWithGravity(
              "Correct!",
              ToastAndroid.SHORT,
              ToastAndroid.CENTER
            );
          }
          
          showCustomAlert({
            title: "Correct!",
            message: `Base Score: ${basePoints}\nTime Bonus: ${timeBonus}\nTotal Points: ${totalPoints}`,
            confirmText: "OK",
            showCancel: false,
            onConfirm: async () => {
              if (isMounted) {
                console.log('Alert OK pressed, current scores:', updatedScores);
                
                setUiState(prev => ({
                  ...prev,
                  answerSubmitted: false,
                  showQuestion: false
                }));

                if (isLastQuestion) {
                  console.log('Last question detected, scores being used:', updatedScores);
                  
                  const finalPlayerData = players.map((player, index) => ({
                    name: player,
                    score: updatedScores[index]
                  }));

                  console.log('Final player data:', finalPlayerData);
                  
                  // Enhanced navigation data with pack information
                  console.log('Pack information being passed:', {
                    packName: selectedPack,
                    packStats: gameState.packStats
                  });

                  navigation.navigate('WinnerTransition', {
                    playerData: finalPlayerData,
                    packStats: {
                      ...gameState.packStats,
                      packName: selectedPack,
                      name: selectedPack,
                      selectedPack: selectedPack
                    },
                    packName: selectedPack,
                    selectedPack: selectedPack,
                    isMultiplayer: false
                  });
                } else {
                  console.log('Not last question, preparing next. Current scores:', updatedScores);
                  prepareNextQuestion();
                }
              }
            }
          });
        }
      }, 1000);
    } else {
      console.log('Incorrect answer, current scores:', scores);
      
      // Android haptic feedback for wrong answer
      if (Platform.OS === 'android') {
        try {
          const Vibration = require('react-native').Vibration;
          // Pattern for failure - one long vibration
          Vibration.vibrate(300);
        } catch (e) {
          console.log('Vibration not available');
        }
      }
      
      await playWrongAnswerSound(soundState.tickSound, isGloballyMuted);

      if (isMounted) {
        setTimeout(() => {
          if (isMounted) {
            console.log('Showing dare popup, current scores:', scores);
            setPerformingDare(true);
            setUiState(prev => ({ ...prev, isDareVisible: true }));
            // Make sure background music is stopped when showing dare
            stopBackgroundMusic();
          }
        }, 1000);
      }
    }

    if (isMounted) {
      setState(prev => ({ ...prev, selectedOption: null }));
    }
  } catch (error) {
    console.error('Error handling answer:', error);
    console.log('Error state scores:', scores);
    // Make sure background music is stopped on error
    stopBackgroundMusic();
    if (isMounted) {
      showCustomAlert({
        title: "Error",
        message: "There was a problem processing your answer. Please try again.",
        confirmText: "OK",
        showCancel: false
      });
    }
  }

  return () => {
    isMounted = false;
  };
};

const startTimer = async (playerIndex) => {
  clearInterval(gameState.intervalId);
  setGameState(prev => ({ ...prev, isLowTimeWarningPlaying: false }));

  // Use more efficient timer implementation for Android
  const interval = setInterval(() => {
    if (!isTimerPaused) {
      setGameState(prev => {
        const newTime = prev.timeLeft - 1;
        
        if (newTime > 0) {
          // Android-specific low time warning with vibration
          if (Platform.OS === 'android' && newTime <= 5 && !prev.isLowTimeWarningPlaying) {
            try {
              const Vibration = require('react-native').Vibration;
              // Short vibration for time warning
              Vibration.vibrate(50);
            } catch (e) {
              console.log('Vibration not available');
            }
          }
          
          if (newTime <= 5 && !prev.isLowTimeWarningPlaying && !isGloballyMuted) {
            soundState.lowTimeSound?.playAsync().catch(console.error);
            return {
              ...prev,
              timeLeft: newTime,
              isLowTimeWarningPlaying: true
            };
          }
          
          const baseScore = TIMER_CONFIGS[timeLimit].baseScore;
          const timeBonus = Math.floor(newTime * 2);
          setCurrentScore(baseScore + timeBonus);
          
          return {
            ...prev,
            timeLeft: newTime
          };
        }
        
        clearInterval(interval);
        if (!isGloballyMuted && soundState.tickSound) {
          soundState.tickSound.playAsync().catch(console.error);
        }
        handleTimesUp(playerIndex);
        
        return {
          ...prev,
          timeLeft: 0
        };
      });
    }
  }, 1000);

  setGameState(prev => ({
    ...prev,
    intervalId: interval,
    timeLeft: timeLimit
  }));
};

const handleTimesUp = async (playerIndex) => {
  clearInterval(gameState.intervalId);

  stopBackgroundMusic();
  
  // Android-specific timeout feedback
  if (Platform.OS === 'android') {
    try {
      const Vibration = require('react-native').Vibration;
      // Pattern for timeout - three short vibrations
      Vibration.vibrate([0, 100, 100, 100, 100, 100]);
      ToastAndroid.showWithGravity(
        "Time's up!",
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
    } catch (e) {
      console.log('Vibration not available');
    }
  }
  
  await playWrongAnswerSound(soundState.tickSound, isGloballyMuted);

  setUiState(prev => ({
    ...prev,
    isGameStarted: false,
    isDareVisible: true
  }));
  setPerformingDare(true);

  if (gameState.currentQuestion) {
    await StatsTracker.updatePackStats(
      selectedPack,
      gameState.currentQuestion['Question ID'],
      false
    );
  }

  log('Time up for player:', players[playerIndex]);
};

const prepareNextQuestion = useCallback(() => {
  // In single player mode, the player index stays 0, but we still need to increment the question
  const nextPlayerIndex = players.length > 1 ? (currentPlayerIndex + 1) % players.length : 0;
  const nextGlobalIndex = gameState.globalQuestionIndex + 1;
  const nextRound = Math.ceil(nextGlobalIndex / players.length);
  const nextQuestionIndex = nextGlobalIndex - 1;

  // Add debug logging
  console.log('prepareNextQuestion debug:', {
    currentPlayerIndex,
    nextPlayerIndex,
    currentQuestionIndex,
    nextQuestionIndex,
    globalIndex: gameState.globalQuestionIndex,
    nextGlobalIndex,
    playerCount: players.length,
    isSinglePlayer: players.length === 1
  });

  // Bundle state updates to ensure they happen together
  Promise.all([
      // Update game state
      new Promise(resolve => {
          setGameState(prev => ({
              ...prev,
              globalQuestionIndex: nextGlobalIndex,
              currentRound: nextRound,
              isReadyForNextQuestion: true,
              timeLeft: timeLimit,
              currentQuestion: questions[nextQuestionIndex]
          }));
          resolve();
      }),
      
      // Update indices - critical for single player mode to still advance the question
      new Promise(resolve => {
          setCurrentPlayerIndex(nextPlayerIndex);
          setCurrentQuestionIndex(nextQuestionIndex);
          resolve();
      }),

      // Reset UI states
      new Promise(resolve => {
          setState(prev => ({
              ...prev,
              selectedOption: null
          }));
          setUiState(prev => ({
              ...prev,
              showQuestion: false,
              answerSubmitted: false
          }));
          resolve();
      })
  ]).then(() => {
      console.log('Question progression:', {
          nextQuestionIndex,
          nextQuestion: questions[nextQuestionIndex]?.['Question Text'],
          nextPlayer: players[nextPlayerIndex],
          nextRound,
          globalIndex: nextGlobalIndex,
          isSinglePlayer: players.length === 1
      });
  });

}, [players, questions, timeLimit, currentPlayerIndex, gameState.globalQuestionIndex, currentQuestionIndex]);

const navigateToResults = async () => {
  try {
    if (gameState.isNavigatingToResults) {
      console.log('Already navigating to results, current scores:', scores);
      return;
    }

    console.log('Starting navigation to results');
    console.log('Initial scores:', scores);

    setGameState(prev => ({ ...prev, isNavigatingToResults: true }));

    // Wait for any pending score updates
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Scores after initial wait:', scores);

    const finalStats = await getPackStatistics(selectedPack);
    const playerData = players.map((player, index) => {
      const score = scores[index];
      console.log(`Preparing score for ${player}:`, score);
      return {
        name: player,
        score: score
      };
    });

    console.log('Final player data being sent:', playerData);
    console.log('Final scores array:', scores);
    
    // Enhanced pack information logging
    console.log('Pack information being passed:', {
      selectedPack,
      packStats: finalStats,
      packName: selectedPack
    });

    // Enhanced navigation with redundant pack information
    navigation.navigate('WinnerTransition', {
      playerData,
      packStats: {
        ...finalStats,
        packName: selectedPack,      // Include pack name in packStats
        name: selectedPack,          // Also as name
        selectedPack: selectedPack   // Also as selectedPack
      },
      packName: selectedPack,        // Also directly at top level
      selectedPack: selectedPack,    // Also directly at top level
      isMultiplayer: false           // FIXED: Always false for single device mode
    });
  } catch (error) {
    console.error('Error navigating to results:', error);
    console.log('Error state scores:', scores);
    console.log('QuestionScreen navigating with isMultiplayer:', false);
    // Even in error case, include pack information
    navigation.navigate('WinnerTransition', {
      playerData: players.map((player, index) => ({
        name: player,
        score: scores[index]
      })),
      packStats: {
        packName: selectedPack,
        name: selectedPack,
        selectedPack: selectedPack
      },
      packName: selectedPack,
      selectedPack: selectedPack,
      isMultiplayer: false           // FIXED: Always false for single device mode
    });
  }
};

const toggleScores = useCallback(() => {
  setUiState(prev => ({ ...prev, showScores: !prev.showScores }));
}, []);

// Function to explicitly load next question - used for invalid questions
const loadNextQuestion = useCallback(() => {
  const nextQuestionIndex = currentQuestionIndex + 1;
  if (nextQuestionIndex < questions.length) {
    setCurrentQuestionIndex(nextQuestionIndex);
    setCurrentQuestion(questions[nextQuestionIndex]);
  }
}, [currentQuestionIndex, questions]);

// Memoized render components with platform-specific optimizations
const QuestionCounter = memo(({ globalIndex, questionsPerPlayer, playersLength }) => {
  const playerQuestionNumber = Math.floor(globalIndex / playersLength) + 1;
  
  return (
    <View style={styles.questionCounterContainer}>
      <Text style={styles.questionCount}>
        {`Q: ${playerQuestionNumber} of ${questionsPerPlayer}`}
      </Text>
    </View>
  );
});

QuestionCounter.displayName = 'QuestionCounter';

const LightBar = memo(() => (
  <View style={styles.lightBar}>
    {[...Array(20)].map((_, i) => (
      <View key={i} style={styles.light} />
    ))}
  </View>
));

const QuestionNumber = memo(() => {
  return (
    <View style={styles.playerNameWithQuestionNumber}>
      {/* Question number on the left */}
      <View style={styles.questionNumberWrapper}>
        <Text style={styles.questionNumberText}>
          Q: {gameState.currentRound}/{numberOfQuestions}
        </Text>
      </View>
      
      {/* Player name (centered) */}
      <Text style={[
        styles.currentPlayerText,
        Platform.OS === 'android' ? styles.currentPlayerTextAndroid : {}
      ]}>
        {players[currentPlayerIndex]}
      </Text>
      
      {/* Seconds countdown on the right */}
      <View style={styles.timerWrapper}>
        <Text style={styles.timerText}>
          {gameState.timeLeft}s
        </Text>
      </View>
    </View>
  );
});

console.log('Rendering question:', {
  currentQuestionIndex,
  questionBeingRendered: questions[currentQuestionIndex]?.['Question Text'],
  totalQuestions: questions.length
});

// Return the component with platform-specific styling
return (
  <ImageBackground 
    style={styles.container} 
    source={require('../assets/questionscreen.jpg')}
    // Add Android-specific image loading optimization
    {...(Platform.OS === 'android' ? { 
      resizeMethod: 'resize',
      resizeMode: 'cover'
    } : {})}
  >
    {gameState.isLoadingQuestions ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator 
          size="large" 
          color="#FFD700"
          // Android-specific loading indicator properties
          {...(Platform.OS === 'android' ? { 
            animating: true,
            hidesWhenStopped: true
          } : {})}
        />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    ) : (
      <>
        <ScoreBanner
          players={players}
          scores={scores}
          showScores={uiState.showScores}
          toggleScores={toggleScores}
          currentPlayer={currentPlayerIndex}
          timeLeft={gameState.timeLeft}
          maxTime={timeLimit}
          currentScore={currentScore}
          isPaused={isTimerPaused}
          timerConfig={TIMER_CONFIGS[timeLimit]}
        />
 
        {/* Question Number and Player Name now together */}
        <QuestionNumber />
 
        <View style={styles.contentContainer}>
  {!uiState.showWinnerButton ? (
    uiState.showQuestion && questions[currentQuestionIndex] ? (
      <QuestionContainer
        key={`question-${currentQuestionIndex}`}
        questionText={questions[currentQuestionIndex]["Question Text"]}
        currentQuestion={{
          ...questions[currentQuestionIndex],
          // Add these properties for question reporting
          id: questions[currentQuestionIndex]?.id || `question_${currentQuestionIndex + 1}`,
          pack: selectedPack?.name || "Unknown Pack",
          correctAnswer: questions[currentQuestionIndex]?.["Correct Answer"] || questions[currentQuestionIndex]?.correctAnswer
        }}
        selectedOption={state.selectedOption}
        onSelectOption={handleOptionSelect}
        onConfirm={handleAnswerConfirmation}
        isAnswerSubmitted={uiState.answerSubmitted}
        currentScore={currentScore}
        showScoringInfo={uiState.showScoringInfo}
        onInfoPress={() => {
          setIsTimerPaused(true);
          setUiState(prev => ({
            ...prev,
            showScoringInfo: true
          }));
        }}
        onTimerPause={setIsTimerPaused}
        timerConfig={TIMER_CONFIGS[timeLimit]}
        // Pass platform info for Android-specific styling in the container
        isAndroid={Platform.OS === 'android'}
      />
    ) : (
      <View style={styles.waitingContainer}>
        <LightBar />
        <Text style={[
          styles.waitingText,
          // Android-specific text style fixes
          Platform.OS === 'android' ? styles.waitingTextAndroid : {}
        ]}>
          Waiting for player to start...
        </Text>
        <LightBar />
      </View>
    )
  ) : (
    <TouchableOpacity 
      style={styles.winnerButton} 
      onPress={navigateToResults}
      // Increase touch target size for Android 
      hitSlop={Platform.OS === 'android' ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
    >
      <Text style={styles.winnerButtonText}>
        And the Winner Is...
      </Text>
    </TouchableOpacity>
  )}
</View>
 
        <DarePopup
  visible={uiState.isDareVisible}
  onClose={async (dareCompleted) => {
    try {
      let updatedScores;
      if (dareCompleted) {
        const baseScore = TIMER_CONFIGS[timeLimit].baseScore;
        const darePoints = Math.floor(baseScore * 0.75);
        
        await new Promise(resolve => {
          setScores(prevScores => {
            const newScores = [...prevScores];
            newScores[currentPlayerIndex] = (
              Number(newScores[currentPlayerIndex]) || 0
            ) + darePoints;
            updatedScores = [...newScores];
            resolve();
            return newScores;
          });
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Android-specific toast for dare completion
        if (Platform.OS === 'android') {
          ToastAndroid.showWithGravity(
            `Dare completed! +${darePoints} points`,
            ToastAndroid.SHORT,
            ToastAndroid.CENTER
          );
        }
      }

      if (questions[currentQuestionIndex]) {
        await StatsTracker.updatePackStats(
          selectedPack,
          questions[currentQuestionIndex]['Question ID'],
          dareCompleted
        );
      }

      const nextGlobalIndex = gameState.globalQuestionIndex + 1;
      
      // Fix for single player mode - adjust round calculation
      const nextRound = players.length === 1 
        ? nextGlobalIndex 
        : Math.ceil(nextGlobalIndex / players.length);
        
      const isLastQuestion = nextRound > numberOfQuestions;

      setUiState(prev => ({
        ...prev,
        isDareVisible: false,
        answerSubmitted: false,
        showQuestion: false
      }));
      setPerformingDare(false);

      if (isLastQuestion) {
        const finalPlayerData = players.map((player, index) => ({
          name: player,
          score: updatedScores ? updatedScores[index] : scores[index]
        }));
        
        navigation.navigate('WinnerTransition', {
          playerData: finalPlayerData,
          packStats: {
            ...gameState.packStats,
            packName: selectedPack,     // Add pack name directly
            selectedPack: selectedPack, // Add as selectedPack too
            name: selectedPack          // Add as name as well
          },
          packName: selectedPack,       // Also at top level
          selectedPack: selectedPack,   // Also at top level
          isMultiplayer: false
        });
      } else {
        prepareNextQuestion();
      }
    } catch (error) {
      console.error('Error handling dare completion:', error);
    }
  }}
  currentPlayer={players[currentPlayerIndex]}
  timerConfig={TIMER_CONFIGS[timeLimit]}
  isAndroid={Platform.OS === 'android'} // Pass platform info
/>
 
        <ScoringInfoModal
          visible={uiState.showScoringInfo}
          onClose={() => {
            setIsTimerPaused(false);
            setUiState(prev => ({
              ...prev,
              showScoringInfo: false
            }));
          }}
          packStats={gameState.packStats}
          timerConfig={TIMER_CONFIGS[timeLimit]}
          isAndroid={Platform.OS === 'android'} // Pass platform info
        />

        {/* Custom Gameshow Alert */}
        <GameshowAlert
          visible={alertVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText}
          showCancel={alertConfig.showCancel}
          onConfirm={() => {
            setAlertVisible(false);
            alertConfig.onConfirm();
          }}
          onCancel={() => {
            setAlertVisible(false);
            alertConfig.onCancel();
          }}
        />
      </>
    )}
  </ImageBackground>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between', // Changed from 'flex-start' to 'space-between'
    alignItems: 'center',
    
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    paddingBottom: Platform.OS === 'android' ? 20 : 10, // Added bottom padding
  },
  // New styles for the Question Number and Player Name layout
  playerNameWithQuestionNumber: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  questionNumberWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  questionNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  timerWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  timerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  currentPlayerText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    flex: 1,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific text style fixes
  currentPlayerTextAndroid: {
    elevation: 3,
    fontWeight: '700',
    lineHeight: 48,
  },
  questionHeaderContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 3, // Reduced from 5
    marginBottom: 3, // Reduced from 5
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
  },
  questionContainer: { // Added new style
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  questionText: { // Added new style
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 15,
    // Platform-specific text shadow
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  answerOptionsContainer: { // Added new style
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'android' ? 15 : 5, // More margin on Android
  },
  optionButton: { // Added new style for answer options
    width: '95%',
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    marginVertical: 5, // Reduced vertical spacing between options
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLetter: { // Added new style
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionLetterText: { // Added new style
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  optionText: { // Added new style
    fontSize: 18,
    color: 'black',
    flex: 1,
  },
  waitingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    overflow: 'hidden',
    marginTop: 20,
    // Platform-specific shadow styling
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  waitingText: {
    fontSize: 24,
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific waiting text styles
  waitingTextAndroid: {
    elevation: 3,
    fontWeight: '700',
    lineHeight: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 10,
    // Platform-specific text shadow
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  finalAnswerButtonContainer: { // Added new style to ensure button is always visible
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: Platform.OS === 'android' ? 20 : 10,
  },
  finalAnswerButton: { // Modified from winnerButton
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
    width: '80%', // Ensure consistent width
    // Platform-specific shadow styling
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  finalAnswerButtonText: { // Modified from winnerButtonText
    color: '#FFD700',
    fontSize: 22, // Slightly smaller for Android
    fontWeight: 'bold',
    textAlign: 'center',
    // Platform-specific text shadow
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  // Android-specific light bar
  lightBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginVertical: 5,
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    opacity: 0.7,
    // Platform-specific glow effect
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  questionCounterContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  questionCount: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
  },
  winnerButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFD700',
    marginTop: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  winnerButtonText: {
    color: '#FFD700',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: '#000',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  
  // Custom Gameshow Alert Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: '85%',
    maxWidth: 350,
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
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
        elevation: 3,
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
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
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
    backgroundColor: '#304FFE',
    borderRadius: 25,
    flex: 1,
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

QuestionScreen.displayName = 'QuestionScreen';
export default QuestionScreen;