import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
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
  ToastAndroid,
  Alert
} from 'react-native';

import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useGame } from '../../Context/GameContext';
import { useFirebase } from '../../Context/multiplayer/FirebaseContext';
import { useSettings } from '../../Context/Settings';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import QuestionContainer from '../QuestionContainer';
import ScoreBanner from '../ScoreBanner';
import ScoringInfoModal from '../../Context/ScoringInfoModal';
import DarePopup from '../DarePopup.js';
import CorrectAnswerPopUp from '../CorrectAnswerPopUp.js';
import { 
  markQuestionAsUsed, 
  getPackStatistics
} from '../../Context/triviaPacks';

// Achievement tracking imports
import { achievementTracker } from '../../Context/AchievementTracker';

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
      console.log('TriviaDare:MultiplayerQuestionScreen', ...args);
    } else {
      console.log(...args);
    }
  }
};

// Enhanced achievement tracking helper function
const trackAchievementSafely = async (methodName, ...args) => {
  try {
    console.log(`🏆 Tracking achievement: ${methodName}`, args);
    await achievementTracker[methodName](...args);
    console.log(`✅ Achievement tracking successful: ${methodName}`);
  } catch (error) {
    console.error(`❌ Achievement tracking error for ${methodName}:`, error);
    // Don't throw - we don't want achievement tracking to break gameplay
  }
};

// Statistics tracking interface for multiplayer
const StatsTracker = {
  async updatePackStats(packId, questionId, correct) {
    try {
      await markQuestionAsUsed(packId, questionId);
      const stats = await getPackStatistics(packId);
      log('Updated pack statistics:', stats);
      return stats;
    } catch (error) {
      console.error('Error updating pack statistics:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Error updating stats', ToastAndroid.SHORT);
      }
      return null;
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

// Sound playback functions with platform-specific optimizations
const playWrongAnswerSound = async (soundObject, isMuted) => {
  if (!isMuted && soundObject) {
    try {
      await soundObject.stopAsync();
      await soundObject.setPositionAsync(0);
      
      if (Platform.OS === 'android') {
        await soundObject.setRateAsync(1.0, false);
        await soundObject.setVolumeAsync(0.85);
      }
      
      await soundObject.playAsync();
    } catch (error) {
      console.error('Error playing wrong answer sound:', error);
    }
  }
};

const MultiplayerQuestionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const firebase = useFirebase();
  
  const {
    numberOfQuestions,
    selectedPack: routeSelectedPack,
    gameMode,
    packName,
    timeLimit: routeTimeLimit
  } = route.params || {};

  const {
    timeLimit,
    currentScore,
    setCurrentScore,
    performingDare,
    setPerformingDare,
    TIMER_CONFIGS,
    setSpectatorMode,
    // Dynamic dare scoring functions
    calculateDarePoints,
    updateDareStreak,
    resetDareStreak,
    getDareStreakInfo
  } = useGame();

  // 🎮 Enhanced state for multiplayer questions from Firebase
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questions, setQuestions] = useState([]);

  // 🎮 Move the console.log here, after TIMER_CONFIGS is available
  console.log('🎮 MultiplayerQuestionScreen initialized with:', {
    gameMode,
    selectedPack: routeSelectedPack,
    packName,
    timeLimit: routeTimeLimit,
    availableTimerConfigs: TIMER_CONFIGS ? Object.keys(TIMER_CONFIGS) : 'undefined'
  });

  // Enhanced state with multiplayer tracking
  const [state, setState] = useState({
    selectedOption: null,
    loadingError: null,
    retryCount: 0
  });

  // UI State for multiplayer
  const [uiState, setUiState] = useState({
    showWinnerButton: false,
    isGameStarted: false,
    isDareVisible: false,
    isPrompting: false,
    showScores: true,
    showQuestion: false,
    answerSubmitted: false,
    showScoringInfo: false,
    isCorrectAnswerVisible: false,
  });

  // Multiplayer Game State
  const [gameState, setGameState] = useState({
    timeLeft: routeTimeLimit || timeLimit || 20,
    intervalId: null,
    isLoadingQuestions: true, // Start as loading until Firebase provides questions
    isReadyForNextQuestion: true,
    isLowTimeWarningPlaying: false,
    packStats: null,
    isMyTurn: false,
    activePlayerName: '',
    isNavigatingToResults: false
  });

  // Achievement tracking state
  const [achievementState, setAchievementState] = useState({
    questionStartTime: null,
    currentGameWrongAnswers: 0,
    gameStartTracked: false
  });

  // Dynamic dare scoring state
  const [dareState, setDareState] = useState({
    calculatedDarePoints: null,
    dareStreakInfo: null,
    showDynamicPoints: false
  });

  // Multiplayer dare voting state
  const [dareVotingState, setDareVotingState] = useState({
    votes: {},
    hasVoted: false,
    voteResult: null,
    darePerformerId: null
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
  const isTimerPausedRef = useRef(false);
  
  // Report modal state tracking
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const selectedPack = routeSelectedPack;

  // Helper function to safely get timer config
  const getTimerConfig = useCallback((timerValue = null) => {
    const timeToUse = timerValue || routeTimeLimit || timeLimit || 20;
    
    // 🔧 Add safety check for TIMER_CONFIGS
    if (!TIMER_CONFIGS) {
      console.warn('⚠️ TIMER_CONFIGS not available, using fallback');
      return { baseScore: 500, label: "Standard" };
    }
    
    const config = TIMER_CONFIGS[timeToUse] || TIMER_CONFIGS[30] || TIMER_CONFIGS[Object.keys(TIMER_CONFIGS)[0]];
    
    if (!config) {
      console.warn('⚠️ Timer config not found for:', timeToUse, 'falling back to default');
      return { baseScore: 500, label: "Standard" }; // Fallback config
    }
    
    return config;
  }, [routeTimeLimit, timeLimit, TIMER_CONFIGS]);

  // Helper function to check if dares should be shown
  const shouldShowDares = () => {
    return gameMode !== 'TriviaONLY';
  };

  // Get players from Firebase
  const players = firebase?.players ? Object.values(firebase.players).map(p => p.name) : [];
  const playersData = firebase?.players || {};
  const currentPlayerData = firebase?.user ? playersData[firebase.user.uid] : null;
  const scores = players.map((_, index) => {
    const playerEntries = Object.entries(playersData);
    return playerEntries[index] ? playerEntries[index][1].score || 0 : 0;
  });

  // 🚀 ENHANCED Firebase game state tracking - Questions from Firebase
  useEffect(() => {
    if (!firebase?.gameState) return;

    const gameStateData = firebase.gameState;
    
    // 🎯 Load questions from Firebase gameData (set by host in lobby)
    if (gameStateData.gameData?.questions) {
      const firebaseQuestions = gameStateData.gameData.questions;
      
      console.log('[MultiplayerQuestionScreen] 🎯 Received questions from Firebase:', {
        count: firebaseQuestions.length,
        currentIndex: gameStateData.currentQuestionIndex || 0
      });
      
      // Set questions in local state
      setQuestions(firebaseQuestions);
      
      // Get current question based on index
      const questionIndex = gameStateData.currentQuestionIndex || 0;
      const currentQ = firebaseQuestions[questionIndex];
      
      if (currentQ) {
        console.log('[MultiplayerQuestionScreen] 🎯 Setting current question:', currentQ['Question Text']);
        setCurrentQuestion(currentQ);
        
        // Mark that we're no longer loading questions
        setGameState(prev => ({ ...prev, isLoadingQuestions: false }));
      }
    } else {
      console.log('[MultiplayerQuestionScreen] ⏳ Waiting for questions from Firebase...');
    }

    // Determine if it's my turn
    const isMyTurn = firebase.user?.uid === gameStateData.currentPlayerId;
    const activePlayer = gameStateData.currentPlayerId ? 
      playersData[gameStateData.currentPlayerId]?.name || 'Unknown Player' : '';

    setGameState(prev => ({
      ...prev,
      isMyTurn,
      activePlayerName: activePlayer
    }));

    // Update spectator mode
    setSpectatorMode(!isMyTurn);

    // Handle dare state changes
    if (gameStateData.performingDare !== undefined) {
      setPerformingDare(gameStateData.performingDare);
      
      if (gameStateData.performingDare && gameStateData.currentDarePlayerId) {
        // Someone is performing a dare
        setDareVotingState(prev => ({
          ...prev,
          darePerformerId: gameStateData.currentDarePlayerId,
          votes: {},
          hasVoted: false
        }));
      }
    }

    // Handle game completion
    if (gameStateData.gameStatus === 'finished' && !gameState.isNavigatingToResults) {
      handleGameEnd();
    }

    log('Firebase game state updated:', {
      isMyTurn,
      activePlayer,
      currentQuestionIndex: gameStateData.currentQuestionIndex,
      performingDare: gameStateData.performingDare,
      hasQuestions: !!gameStateData.gameData?.questions?.length
    });

  }, [firebase?.gameState, firebase?.user?.uid, playersData]);

  // Enhanced timer pause effect
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      if (uiState.showScoringInfo || isReportModalOpen) {
        setIsTimerPaused(true);
        isTimerPausedRef.current = true;
        console.log('🛑 Timer paused - Scoring info:', uiState.showScoringInfo, 'Report modal:', isReportModalOpen);
      } else {
        setIsTimerPaused(false);
        isTimerPausedRef.current = false;
        console.log('▶️ Timer resumed - Both modals closed');
      }
    }
    return () => {
      isMounted = false;
    };
  }, [uiState.showScoringInfo, isReportModalOpen]);

  // Report modal callbacks
  const handleReportModalOpen = useCallback(() => {
    console.log('📝 Report modal opening - pausing timer');
    setIsReportModalOpen(true);
  }, []);

  const handleReportModalClose = useCallback(() => {
    console.log('📝 Report modal closing - will resume timer if no other modals open');
    setIsReportModalOpen(false);
  }, []);

  // Android back button handler
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (Platform.OS === 'android') {
          showCustomAlert({
            title: "Leave Game",
            message: "Are you sure you want to leave this multiplayer game?",
            confirmText: "Leave",
            cancelText: "Stay",
            onConfirm: async () => {
              if (firebase && firebase.leaveRoom) {
                await firebase.leaveRoom();
              }
              navigation.navigate('Home');
            }
          });
          return true;
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  // Cleanup effect
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

        // Cleanup other sounds
        ['tickSound', 'lowTimeSound', 'correctSound'].forEach(async (soundKey) => {
          if (soundState[soundKey]) {
            await soundState[soundKey].stopAsync().catch(() => {});
            await soundState[soundKey].unloadAsync();
          }
        });

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
            showScoringInfo: false,
            isCorrectAnswerVisible: false,
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

  // Load sounds effect
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
        
        await warningSound.loadAsync(require('../../assets/Sounds/warningsound.mp3'));
        await wrongAnswerSound.loadAsync(require('../../assets/Sounds/wronganswer.mp3'));
        await correctAnswerSound.loadAsync(require('../../assets/Sounds/correctanswer.mp3'));
        await backgroundMusicSound.loadAsync(require('../../assets/Sounds/questionbackground.mp3'));
        
        await backgroundMusicSound.setIsLoopingAsync(true);
        await backgroundMusicSound.setVolumeAsync(0.5);
        
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

  // 🎯 Initial setup effect - simplified for Firebase questions
  useEffect(() => {
    let isMounted = true;
    
    const initializeGame = async () => {
      try {
        if (!isMounted) return;
        
        console.log('[MultiplayerQuestionScreen] 🎮 Initializing multiplayer game...');
        
        setUiState(prev => ({
          ...prev,
          isGameStarted: true,
          showQuestion: true,
          answerSubmitted: false,
          isCorrectAnswerVisible: false,
        }));
        
        // Questions will be loaded from Firebase, so we just wait
        console.log('[MultiplayerQuestionScreen] 🎮 Waiting for questions from Firebase...');
        
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
      }
    };
  
    initializeGame();
  
    return () => {
      isMounted = false;
    };
  }, []);

  // Achievement tracking for game start
  useEffect(() => {
    const trackGameStart = async () => {
      if (players && players.length > 0 && !achievementState.gameStartTracked && !gameState.isLoadingQuestions) {
        try {
          console.log('🏆 Tracking multiplayer game start');
          
          await trackAchievementSafely(
            'trackGameStart', 
            players,
            gameMode || 'TriviaDare',
            packName || selectedPack || 'Unknown Pack'
          );

          setAchievementState(prev => ({ ...prev, gameStartTracked: true }));
          
        } catch (error) {
          console.error('❌ Error in game start tracking:', error);
        }
      }
    };
    
    trackGameStart();
  }, [players, gameState.isLoadingQuestions, gameMode, packName, selectedPack, achievementState.gameStartTracked]);

  // Background music functions
  const playBackgroundMusic = async () => {
    if (isGloballyMuted || !soundState.backgroundMusic) {
      console.log('Skipping background music (muted or not available)');
      return;
    }
    
    try {
      const sound = soundState.backgroundMusic;
      await sound.stopAsync().catch(() => {});
      await sound.setPositionAsync(0);
      console.log('Playing background music');
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing background music:', error);
    }
  };

  const stopBackgroundMusic = async () => {
    if (soundState.backgroundMusic) {
      try {
        const status = await soundState.backgroundMusic.getStatusAsync().catch(() => ({ isLoaded: false }));
        if (status.isLoaded && status.isPlaying) {
          await soundState.backgroundMusic.stopAsync().catch((error) => {
            if (error.message && error.message.includes('Seeking interrupted')) {
              console.log('🎵 Background music stop interrupted (normal during transitions)');
            } else {
              console.error('Error stopping background music:', error);
            }
          });
          console.log('🎵 Background music stopped successfully');
        }
      } catch (error) {
        if (error.message && error.message.includes('Seeking interrupted')) {
          console.log('🎵 Background music stop interrupted (normal during transitions)');
        } else {
          console.error('Error stopping background music:', error);
        }
      }
    }
  };

  // Handle option selection
  const handleOptionSelect = (option) => {
    if (!gameState.isMyTurn) return; // Only active player can select
    
    setState(prev => ({ ...prev, selectedOption: option }));
    log('Option selected:', option);
    
    // Android haptic feedback
    if (Platform.OS === 'android') {
      try {
        const Vibration = require('react-native').Vibration;
        Vibration.vibrate(50);
      } catch (e) {
        console.log('Vibration not available');
      }
    }
  };

  // Play correct answer sound
  const playCorrectAnswerSound = async (soundObject, isMuted) => {
    if (!isMuted && soundObject) {
      try {
        await soundObject.stopAsync();
        await soundObject.setPositionAsync(0);
        
        if (Platform.OS === 'android') {
          await soundObject.setRateAsync(1.0, false);
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

  // Enhanced incorrect answer handling for multiplayer
  const handleIncorrectAnswer = async () => {
    let isMounted = true;
    
    // Achievement tracking
    await trackAchievementSafely('trackIncorrectAnswer');
    
    setAchievementState(prev => ({
      ...prev,
      currentGameWrongAnswers: prev.currentGameWrongAnswers + 1
    }));
    
    console.log('🏆 Wrong answer tracked, total wrong answers this game:', achievementState.currentGameWrongAnswers + 1);
    
    // Android haptic feedback
    if (Platform.OS === 'android') {
      try {
        const Vibration = require('react-native').Vibration;
        Vibration.vibrate(300);
      } catch (e) {
        console.log('Vibration not available');
      }
    }
    
    await playWrongAnswerSound(soundState.tickSound, isGloballyMuted);

    if (isMounted) {
      setTimeout(() => {
        if (isMounted) {
          console.log('Showing correct answer popup');
          setUiState(prev => ({ 
            ...prev, 
            isCorrectAnswerVisible: true,
            answerSubmitted: false,
            showQuestion: false
          }));
          stopBackgroundMusic();
        }
      }, 1000);
    }

    return () => {
      isMounted = false;
    };
  };

  // Handle continue from CorrectAnswerPopUp for multiplayer
  const handleCorrectAnswerContinue = () => {
    let isMounted = true;
    
    setUiState(prev => ({ ...prev, isCorrectAnswerVisible: false }));
    
    if (shouldShowDares()) {
      // TriviaDare mode - show dare popup
      console.log('🎯 TriviaDare mode - calculating dynamic dare points for multiplayer');
      
      const currentPlayerIndex = players.findIndex(name => 
        name === playersData[firebase.gameState?.currentPlayerId]?.name
      );
      
      const darePointsCalculation = calculateDarePoints(currentPlayerIndex, scores, numberOfQuestions);
      const streakInfo = getDareStreakInfo(currentPlayerIndex);
      
      console.log('🎯 Multiplayer dynamic dare calculation:', darePointsCalculation);
      
      setDareState({
        calculatedDarePoints: darePointsCalculation,
        dareStreakInfo: streakInfo,
        showDynamicPoints: true
      });
      
      // Update Firebase with dare state
      if (firebase.isHost && firebase.updateGameState) {
        firebase.updateGameState({
          performingDare: true,
          currentDarePlayerId: firebase.gameState?.currentPlayerId
        });
      }
      
      setTimeout(() => {
        if (isMounted) {
          console.log('Showing dare popup (multiplayer TriviaDare mode)');
          setPerformingDare(true);
          setUiState(prev => ({ ...prev, isDareVisible: true }));
        }
      }, 500);
    } else {
      // TriviaONLY mode - proceed to next question
      setTimeout(() => {
        if (isMounted) {
          console.log('Skipping dare (TriviaONLY mode), advancing to next question');
          advanceToNextQuestion();
        }
      }, 500);
    }

    return () => {
      isMounted = false;
    };
  };

  // Enhanced answer confirmation for multiplayer
  const handleAnswerConfirmation = async () => {
    if (!gameState.isMyTurn) return; // Only active player can confirm
    
    let isMounted = true;
    
    if (!currentQuestion) return;

    try {
      const correctAnswerKey = currentQuestion['Correct Answer'];
      const correctAnswer = currentQuestion[correctAnswerKey];

      if (gameState.intervalId) {
        clearInterval(gameState.intervalId);
      }
      
      stopBackgroundMusic();

      if (isMounted) {
        setUiState(prev => ({ ...prev, answerSubmitted: true }));
      }

      const isCorrect = state.selectedOption === correctAnswer;
      console.log('Multiplayer answer check:', { 
        isCorrect, 
        selectedOption: state.selectedOption, 
        correctAnswer,
        playerCount: players.length,
        gameMode
      });

      // Update pack statistics if it's my question
      if (selectedPack && currentQuestion['Question ID']) {
        await StatsTracker.updatePackStats(
          selectedPack,
          currentQuestion['Question ID'],
          isCorrect
        );
      }

      if (!isMounted) return;

      if (isCorrect) {
        // Achievement tracking for correct answer
        const answerEndTime = Date.now();
        const questionStartTime = achievementState.questionStartTime || answerEndTime;
        const answerTimeMs = answerEndTime - questionStartTime;
        
        console.log('🏆 Correct answer timing:', {
          questionStartTime,
          answerEndTime,
          answerTimeMs,
          timeLimitMs: gameState.timeLeft * 1000
        });
        
        await trackAchievementSafely('trackCorrectAnswer', answerTimeMs);

        // Android haptic feedback
        if (Platform.OS === 'android') {
          try {
            const Vibration = require('react-native').Vibration;
            Vibration.vibrate([0, 100, 100, 100]);
          } catch (e) {
            console.log('Vibration not available');
          }
        }
        
        await playCorrectAnswerSound(soundState.correctSound, isGloballyMuted);

        // Safe timer config access with fallback
        const currentTimerLimit = routeTimeLimit || timeLimit || 30;
        const timerConfig = getTimerConfig(currentTimerLimit);
        const basePoints = timerConfig.baseScore;
        const timeBonus = Math.floor(gameState.timeLeft * 2);
        const totalPoints = basePoints + timeBonus;

        console.log('Multiplayer score calculation:', {
          basePoints,
          timeBonus,
          totalPoints,
          currentUserId: firebase.user?.uid
        });

        // Update score in Firebase
        if (firebase.updatePlayerData && firebase.user) {
          const currentScore = playersData[firebase.user.uid]?.score || 0;
          await firebase.updatePlayerData({
            score: currentScore + totalPoints
          });
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        if (!isMounted) return;

        setTimeout(() => {
          if (isMounted) {
            if (Platform.OS === 'android') {
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
                  setUiState(prev => ({
                    ...prev,
                    answerSubmitted: false,
                    showQuestion: false
                  }));

                  // Advance to next question
                  advanceToNextQuestion();
                }
              }
            });
          }
        }, 1000);
      } else {
        console.log('Incorrect answer in multiplayer');
        await handleIncorrectAnswer();
      }

      if (isMounted) {
        setState(prev => ({ ...prev, selectedOption: null }));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
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

  // Timer functions for multiplayer
  const startTimer = async () => {
    if (!gameState.isMyTurn) return; // Only start timer for active player
    
    clearInterval(gameState.intervalId);
    setGameState(prev => ({ ...prev, isLowTimeWarningPlaying: false }));

    // Set achievement timing
    setAchievementState(prev => ({
      ...prev,
      questionStartTime: Date.now()
    }));

    const interval = setInterval(() => {
      if (!isTimerPausedRef.current) {
        console.log('⏱️ Timer tick - not paused, decrementing time');
        setGameState(prev => {
          const newTime = prev.timeLeft - 1;
          
          if (newTime > 0) {
            if (Platform.OS === 'android' && newTime <= 5 && !prev.isLowTimeWarningPlaying) {
              try {
                const Vibration = require('react-native').Vibration;
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
            
            // Safe timer config access with fallback
            const currentTimerLimit = routeTimeLimit || timeLimit || 30;
            const timerConfig = getTimerConfig(currentTimerLimit);
            const baseScore = timerConfig.baseScore;
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
          handleTimesUp();
          
          return {
            ...prev,
            timeLeft: 0
          };
        });
      } else {
        console.log('⏸️ Timer tick - paused, skipping decrement');
      }
    }, 1000);

    setGameState(prev => ({
      ...prev,
      intervalId: interval,
      timeLeft: routeTimeLimit || timeLimit || 30
    }));

    // Start background music
    setTimeout(() => {
      playBackgroundMusic();
    }, 100);
  };

  // Handle time's up for multiplayer
  const handleTimesUp = async () => {
    if (!gameState.isMyTurn) return;
    
    clearInterval(gameState.intervalId);
    stopBackgroundMusic();
    
    // Achievement tracking
    await trackAchievementSafely('trackIncorrectAnswer');
    
    setAchievementState(prev => ({
      ...prev,
      currentGameWrongAnswers: prev.currentGameWrongAnswers + 1
    }));
    
    console.log('🏆 Time out tracked as wrong answer, total wrong answers this game:', achievementState.currentGameWrongAnswers + 1);
    
    if (Platform.OS === 'android') {
      try {
        const Vibration = require('react-native').Vibration;
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
      showQuestion: false,
      isCorrectAnswerVisible: true
    }));

    if (currentQuestion && selectedPack) {
      await StatsTracker.updatePackStats(
        selectedPack,
        currentQuestion['Question ID'],
        false
      );
    }

    log('Time up for active player');
  };

  // Advance to next question in multiplayer
  const advanceToNextQuestion = useCallback(() => {
    if (firebase.isHost && global.multiplayerGameFlow?.nextQuestion) {
      console.log('Host advancing to next question');
      global.multiplayerGameFlow.nextQuestion();
    } else {
      console.log('Non-host waiting for game state update');
    }
    
    // Reset local UI states
    setState(prev => ({
      ...prev,
      selectedOption: null
    }));
    
    setUiState(prev => ({
      ...prev,
      showQuestion: true,
      answerSubmitted: false,
      isCorrectAnswerVisible: false,
    }));

    // Reset dare state
    setDareState({
      calculatedDarePoints: null,
      dareStreakInfo: null,
      showDynamicPoints: false
    });

  }, [firebase.isHost]);

  // Handle game end for multiplayer
  const handleGameEnd = useCallback(() => {
    if (gameState.isNavigatingToResults) {
      console.log('Already navigating to results');
      return;
    }

    console.log('Multiplayer game ending');
    setGameState(prev => ({ ...prev, isNavigatingToResults: true }));

    // Achievement tracking for game completion
    try {
      console.log('🏆 Tracking multiplayer game completion');
      trackAchievementSafely('trackGameComplete', gameMode || 'TriviaDare');

      if (achievementState.currentGameWrongAnswers === 0) {
        console.log('🏆 Perfect multiplayer game detected!');
      }
    } catch (error) {
      console.error('❌ Error in game completion achievement tracking:', error);
    }

    // Let MultiplayerGameFlow handle navigation
    if (global.multiplayerGameFlow?.endGame) {
      global.multiplayerGameFlow.endGame();
    }
  }, [gameState.isNavigatingToResults, gameMode, achievementState.currentGameWrongAnswers]);

  // Handle dare voting for multiplayer
  const handleDareVote = (isCompleted) => {
    if (dareVotingState.hasVoted) return;
    
    console.log('🎯 Submitting dare vote:', isCompleted);
    
    // Submit vote through Firebase
    if (firebase.submitDareVote) {
      firebase.submitDareVote(isCompleted);
    }
    
    setDareVotingState(prev => ({
      ...prev,
      hasVoted: true,
      votes: {
        ...prev.votes,
        [firebase.user?.uid]: isCompleted
      }
    }));
  };

  // Handle dare completion for multiplayer
  const handleDareCompletion = async (dareCompleted) => {
    try {
      console.log('🎯 Multiplayer dare completion:', dareCompleted);
      
      if (dareCompleted) {
        // Achievement tracking
        await trackAchievementSafely('trackDareCompleted');
        
        // Update dare streak
        const currentPlayerIndex = players.findIndex(name => 
          name === playersData[firebase.gameState?.currentDarePlayerId]?.name
        );
        
        if (currentPlayerIndex !== -1) {
          updateDareStreak(currentPlayerIndex, true);
        }
        
        if (Platform.OS === 'android') {
          const darePoints = dareState.calculatedDarePoints?.finalDarePoints || 250;
          ToastAndroid.showWithGravity(
            `Dare completed! +${darePoints} points`,
            ToastAndroid.SHORT,
            ToastAndroid.CENTER
          );
        }
      } else {
        // Reset streak for failed dare
        const currentPlayerIndex = players.findIndex(name => 
          name === playersData[firebase.gameState?.currentDarePlayerId]?.name
        );
        
        if (currentPlayerIndex !== -1) {
          updateDareStreak(currentPlayerIndex, false);
        }
        
        setAchievementState(prev => ({
          ...prev,
          currentGameWrongAnswers: prev.currentGameWrongAnswers + 1
        }));
      }

      // Update Firebase to end dare state
      if (firebase.isHost && firebase.updateGameState) {
        firebase.updateGameState({
          performingDare: false,
          currentDarePlayerId: null
        });
      }

      setUiState(prev => ({
        ...prev,
        isDareVisible: false,
        answerSubmitted: false,
        showQuestion: false
      }));
      
      setPerformingDare(false);
      
      // Reset dare state
      setDareState({
        calculatedDarePoints: null,
        dareStreakInfo: null,
        showDynamicPoints: false
      });

      // Advance to next question
      advanceToNextQuestion();
      
    } catch (error) {
      console.error('Error handling dare completion:', error);
    }
  };

  const toggleScores = useCallback(() => {
    setUiState(prev => ({ ...prev, showScores: !prev.showScores }));
  }, []);

  // Start timer when it's my turn
  useEffect(() => {
    if (gameState.isMyTurn && uiState.showQuestion && !uiState.answerSubmitted) {
      console.log('Starting timer for my turn');
      startTimer();
    }
  }, [gameState.isMyTurn, uiState.showQuestion, uiState.answerSubmitted]);

  // Memoized components
  const QuestionNumber = memo(() => {
    const currentRound = firebase.gameState?.currentQuestionIndex ? 
      Math.floor((firebase.gameState.currentQuestionIndex + players.length) / players.length) : 1;
    
    return (
      <View style={styles.playerNameWithQuestionNumber}>
        <View style={styles.questionNumberWrapper}>
          <Text style={styles.questionNumberText}>
            Q: {currentRound}/{numberOfQuestions}
          </Text>
        </View>
        
        <Text style={[
          styles.currentPlayerText,
          Platform.OS === 'android' ? styles.currentPlayerTextAndroid : {}
        ]}>
          {gameState.activePlayerName || 'Waiting...'}
        </Text>
        
        <View style={styles.timerWrapper}>
          <Text style={styles.timerText}>
            {gameState.timeLeft}s
          </Text>
        </View>
      </View>
    );
  });

  const LightBar = memo(() => (
    <View style={styles.lightBar}>
      {[...Array(20)].map((_, i) => (
        <View key={i} style={styles.light} />
      ))}
    </View>
  ));

  console.log('🎯 Rendering multiplayer question screen:', {
    currentQuestion: currentQuestion?.['Question Text'],
    isMyTurn: gameState.isMyTurn,
    spectatorMode: !gameState.isMyTurn,
    activePlayer: gameState.activePlayerName,
    isLoadingQuestions: gameState.isLoadingQuestions,
    hasQuestions: !!currentQuestion
  });

  return (
    <ImageBackground 
      style={styles.container} 
      source={require('../../assets/questionscreen.jpg')}
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
            {...(Platform.OS === 'android' ? { 
              animating: true,
              hidesWhenStopped: true
            } : {})}
          />
          <Text style={styles.loadingText}>Loading questions from host...</Text>
        </View>
      ) : (
        <>
          <ScoreBanner
            players={players}
            scores={scores}
            showScores={uiState.showScores}
            toggleScores={toggleScores}
            currentPlayer={players.findIndex(name => 
              name === gameState.activePlayerName
            )}
            timeLeft={gameState.timeLeft}
            maxTime={routeTimeLimit || timeLimit || 30}
            currentScore={currentScore}
            isPaused={isTimerPaused}
            timerConfig={getTimerConfig()}
          />
 
          <QuestionNumber />
 
          <View style={styles.contentContainer}>
            {uiState.showQuestion && currentQuestion ? (
              <QuestionContainer
                key={`question-${firebase.gameState?.currentQuestionIndex || 0}`}
                questionText={currentQuestion["Question Text"]}
                currentQuestion={{
                  ...currentQuestion,
                  id: currentQuestion?.id || `question_${(firebase.gameState?.currentQuestionIndex || 0) + 1}`,
                  pack: selectedPack?.name || "Unknown Pack",
                  correctAnswer: currentQuestion?.["Correct Answer"] || currentQuestion?.correctAnswer
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
                timerConfig={getTimerConfig()}
                isAndroid={Platform.OS === 'android'}
                onReportModalOpen={handleReportModalOpen}
                onReportModalClose={handleReportModalClose}
                // Multiplayer specific props
                disabled={!gameState.isMyTurn}
                isMultiplayer={true}
                spectatorMode={!gameState.isMyTurn}
                activePlayerName={gameState.activePlayerName}
              />
            ) : (
              <View style={styles.waitingContainer}>
                <LightBar />
                <Text style={[
                  styles.waitingText,
                  Platform.OS === 'android' ? styles.waitingTextAndroid : {}
                ]}>
                  {gameState.isMyTurn ? "Get ready for your question!" : `Waiting for ${gameState.activePlayerName}...`}
                </Text>
                <LightBar />
              </View>
            )}
          </View>

          {/* CorrectAnswerPopUp Component */}
          <CorrectAnswerPopUp
            visible={uiState.isCorrectAnswerVisible}
            onContinue={handleCorrectAnswerContinue}
            currentPlayer={gameState.activePlayerName}
            question={currentQuestion}
            gameMode={gameMode}
            onReportModalOpen={handleReportModalOpen}
            onReportModalClose={handleReportModalClose}
          />
 
          {/* Conditionally render DarePopup for TriviaDARE mode */}
          {shouldShowDares() && (
            <DarePopup
              visible={uiState.isDareVisible}
              onClose={handleDareCompletion}
              currentPlayer={gameState.activePlayerName}
              timerConfig={getTimerConfig()}
              isAndroid={Platform.OS === 'android'}
              // Multiplayer props
              isMultiplayer={true}
              isPerformingDare={firebase.gameState?.currentDarePlayerId === firebase.user?.uid}
              onVote={handleDareVote}
              votes={dareVotingState.votes}
              totalPlayers={players.length}
              // Dynamic dare scoring props
              calculatedDarePoints={dareState.calculatedDarePoints?.finalDarePoints}
              streakInfo={dareState.dareStreakInfo}
              showDynamicPoints={dareState.showDynamicPoints}
              darePointsBreakdown={dareState.calculatedDarePoints}
            />
          )}
 
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
            timerConfig={getTimerConfig()}
            isAndroid={Platform.OS === 'android'}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    paddingBottom: Platform.OS === 'android' ? 20 : 10,
  },
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
  currentPlayerTextAndroid: {
    elevation: 3,
    fontWeight: '700',
    lineHeight: 48,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
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

MultiplayerQuestionScreen.displayName = 'MultiplayerQuestionScreen';
export default MultiplayerQuestionScreen;