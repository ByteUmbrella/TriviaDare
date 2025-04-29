import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ImageBackground,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  BackHandler,
  ToastAndroid,
  Alert,
  StyleSheet
} from 'react-native';

import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useGame } from '../../Context/GameContext';
import { useSettings } from '../../Context/Settings';
import { useFirebase } from '../../Context/multiplayer/FirebaseContext';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import QuestionContainer from '../QuestionContainer';
import ScoreBanner from '../ScoreBanner';
import ScoringInfoModal from '../../Context/ScoringInfoModal';
import DarePopup from '../DarePopup';

import triviaPacks from '../../Context/triviaPacks';
import {
  loadPackQuestions,
  markQuestionAsUsed,
  getPackStatistics
} from '../../Context/triviaPacks';

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

// Define multiplayer-specific timer configurations
const MULTIPLAYER_TIMER_CONFIGS = {
  10: { baseScore: 250, label: "10s" },
  20: { baseScore: 500, label: "20s" },
  30: { baseScore: 750, label: "30s" }
};

// Helper function to get timer config with fallback
const getMultiplayerTimerConfig = (seconds) => {
  if (MULTIPLAYER_TIMER_CONFIGS[seconds]) {
    return MULTIPLAYER_TIMER_CONFIGS[seconds];
  }
  // Default to 20 seconds if config not found
  return MULTIPLAYER_TIMER_CONFIGS[20];
};

const MultiplayerQuestionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    numberOfQuestions = 3,
    selectedPack,
    timeLimit: routeTimeLimit = 30, // Default to 30 seconds if not specified
  } = route.params || {};
  
  // Make sure timeLimit is a supported value
  const timeLimit = [10, 15, 20, 30, 45, 60].includes(routeTimeLimit) ? routeTimeLimit : 30;

  // Firebase context for multiplayer communication
  const firebase = useFirebase();
  const { 
    user,
    players,
    gameState: firebaseGameState,
    submitAnswer,
    updateGameState,
    updatePlayerData,
    isHost,
    // Add new Firebase methods
    generateAndSetDare,
    submitDareVote: firebaseSubmitDareVote, 
    processDareVotes,
    globalDare,
    dareVotes
  } = firebase || {};

  // Game context for game state
  const gameContext = useGame();
  const {
    setPlayers,
    scores,
    setScores,
    currentPlayerIndex,
    setCurrentPlayerIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    questions,
    setQuestions,
    currentScore,
    setCurrentScore,
    performingDare,
    setPerformingDare,
    resetTimerAndScore,
    TIMER_CONFIGS // Access original TIMER_CONFIGS but don't use directly for multiplayer
  } = gameContext;

  // Settings context for global settings
  const { isGloballyMuted } = useSettings();

  // Enhanced state with error tracking
  const [state, setState] = useState({
    selectedOption: null,
    loadingError: null,
    retryCount: 0
  });

  // UI State
  const [uiState, setUiState] = useState({
    isGameStarted: false,
    isDareVisible: false,
    showScores: true,
    showQuestion: false,
    answerSubmitted: false,
    showScoringInfo: false,
    showTurnPrompt: false
  });

  // Game State
  const [localGameState, setLocalGameState] = useState({
    timeLeft: timeLimit,
    intervalId: null,
    currentQuestion: null,
    isLoadingQuestions: true,
    isReadyForNextQuestion: true,
    isLowTimeWarningPlaying: false,
    packStats: null,
  });

  // Sound State
  const [soundState, setSoundState] = useState({
    tickSound: null,
    lowTimeSound: null,
    correctSound: null,
    dareSound: null
  });

  // Multiplayer specific state
  const [multiplayerState, setMultiplayerState] = useState({
    isMyTurn: false, 
    dareVotes: {}, 
    spectatorView: true, 
    activePlayerName: null,
    waitingForNextPlayer: false,
    votingComplete: false,
    processingDare: false
  });

  // Timer pause state
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const triviaPacks = require('../../Context/triviaPacks');

  // Android back button handler
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (Platform.OS === 'android') {
          Alert.alert(
            "Quit Game",
            "Are you sure you want to quit this multiplayer game?",
            [
              { text: "Stay", style: "cancel" },
              { 
                text: "Quit", 
                style: "destructive",
                onPress: () => {
                  if (firebase && firebase.leaveRoom) {
                    firebase.leaveRoom();
                  }
                  navigation.navigate('Home');
                }
              }
            ]
          );
          return true; // Prevent default behavior
        }
        return false; // Let default behavior happen for iOS
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [firebase, navigation])
  );

  // Clean up function for sounds and intervals
  const cleanup = async () => {
    try {
      if (localGameState.intervalId) {
        clearInterval(localGameState.intervalId);
      }

      // Unload all sounds
      for (const sound of Object.values(soundState)) {
        if (sound) {
          await sound.stopAsync().catch(() => {});
          await sound.unloadAsync().catch(() => {});
        }
      }
      
      setLocalGameState(prev => ({
        ...prev,
        intervalId: null,
        isLowTimeWarningPlaying: false
      }));

      setUiState(prev => ({
        ...prev,
        isGameStarted: false,
        isDareVisible: false,
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
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  };

  // Component cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Enhanced player turn detection effect
  useEffect(() => {
    if (firebase && user && firebaseGameState) {
      const isMyTurn = firebaseGameState.currentPlayerId === user.uid;
      
      // Log turn state for debugging
      log(`Turn detection: currentPlayerId=${firebaseGameState.currentPlayerId}, myId=${user.uid}, isMyTurn=${isMyTurn}`);
      
      // If it's my turn and we haven't shown the prompt yet, show it
      if (isMyTurn && !uiState.showTurnPrompt && !performingDare) {
        log('It is my turn, showing turn prompt');
        
        // Update multiplayer state to show turn prompt and ensure spectator mode is off
        setMultiplayerState(prev => ({
          ...prev,
          isMyTurn: true,
          spectatorView: false
        }));
        
        setUiState(prev => ({
          ...prev,
          showTurnPrompt: true
        }));
      } 
      // If it's not my turn, make sure I'm in spectator mode
      else if (!isMyTurn) {
        log('Not my turn, ensuring spectator mode');
        
        // Get active player name
        let activePlayerName = 'Player';
        if (firebaseGameState.currentPlayerId && firebase.players) {
          const activePlayer = firebase.players[firebaseGameState.currentPlayerId];
          if (activePlayer) {
            activePlayerName = activePlayer.name;
          }
        }
        
        setMultiplayerState(prev => ({
          ...prev,
          isMyTurn: false,
          spectatorView: true,
          activePlayerName: activePlayerName
        }));
      }

      // Monitor for dare state
      if (firebaseGameState.performingDare) {
        setPerformingDare(true);
        setUiState(prev => ({
          ...prev,
          isDareVisible: true
        }));
      } else if (uiState.isDareVisible && !firebaseGameState.performingDare) {
        // Close dare popup if it was open and Firebase says no dare
        setPerformingDare(false);
        setUiState(prev => ({
          ...prev,
          isDareVisible: false
        }));
      }
    }
  }, [firebase, user, firebaseGameState?.currentPlayerId, firebaseGameState?.performingDare, uiState.showTurnPrompt, performingDare]);

  // Player and score synchronization
  const syncPlayersWithFirebase = useCallback(() => {
    if (!firebase || !firebase.players) return;
    
    try {
      // Get player names and IDs
      const playerData = Object.entries(firebase.players).map(([id, player]) => ({
        id,
        name: player.name,
        score: player.score || 0,
        isConnected: player.isConnected !== false
      }));
      
      // Update player names in game context
      if (setPlayers && playerData.length > 0) {
        const playerNames = playerData.map(p => p.name);
        log('Syncing player names:', playerNames);
        setPlayers(playerNames);
      }
      
      // Update scores
      if (setScores && playerData.length > 0) {
        const playerScores = playerData.map(p => p.score || 0);
        log('Syncing player scores:', playerScores);
        setScores(playerScores);
      }
    } catch (error) {
      console.error('Error syncing players:', error);
    }
  }, [firebase?.players, setPlayers, setScores]);

  // Call sync function when Firebase updates
  useEffect(() => {
    syncPlayersWithFirebase();
  }, [syncPlayersWithFirebase, firebase?.players]);

// Load sounds effect - completely simplified version
useEffect(() => {
  let isMounted = true;

  const setupSoundStubs = () => {
    // Create empty sound objects without trying to load files
    const sounds = {
      tickSound: new Audio.Sound(),
      lowTimeSound: new Audio.Sound(),
      correctSound: new Audio.Sound(),
      dareSound: new Audio.Sound()
    };
    
    log('Setting up sound stubs (actual loading disabled)');
    
    // Set the sound objects in state
    if (isMounted) {
      setSoundState(sounds);
    }
  };

  // Call the setup function
  setupSoundStubs();
  
  return () => {
    isMounted = false;
  };
}, []);

// Simplified play sound function that just logs instead of playing
const playSound = (soundName) => {
  // Just log the sound name without trying to play anything
  log(`Sound effect requested: ${soundName} (disabled for stability)`);
  
  // No actual sound playing attempts
  return;
};

  // Initialize game when component mounts
  useEffect(() => {
    let isMounted = true;

    const initializeGame = async () => {
      try {
        if (!isMounted) return;
        
        // Only host loads pack questions directly
        if (isHost) {
          await loadQuestions();
        }
        
        // Set initial UI state
        setUiState(prev => ({
          ...prev,
          isGameStarted: false,
          showQuestion: true,
          answerSubmitted: false
        }));
        
        // Reset timer and score
        resetTimerAndScore();
        
        // Set initial state based on Firebase
        if (firebase && firebaseGameState) {
          // Update current question index
          if (firebaseGameState.currentQuestionIndex !== undefined) {
            setCurrentQuestionIndex(firebaseGameState.currentQuestionIndex);
          }
          
          // Update current player
          if (firebaseGameState.currentPlayerId && firebase.players) {
            const playerIds = Object.keys(firebase.players);
            const currentPlayerIdx = playerIds.indexOf(firebaseGameState.currentPlayerId);
            if (currentPlayerIdx >= 0) {
              setCurrentPlayerIndex(currentPlayerIdx);
            }
          }
          
          // Update question data if available
          if (firebaseGameState.gameData?.questions) {
            setQuestions(firebaseGameState.gameData.questions);
            
            // Also update current question
            if (firebaseGameState.currentQuestionIndex !== undefined) {
              setLocalGameState(prev => ({
                ...prev,
                currentQuestion: firebaseGameState.gameData.questions[firebaseGameState.currentQuestionIndex],
                isLoadingQuestions: false
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error in initializeGame:', error);
        if (isMounted) {
          Alert.alert(
            "Error",
            "There was a problem starting the game. Please try again.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        }
      } finally {
        if (isMounted) {
          setLocalGameState(prev => ({ ...prev, isLoadingQuestions: false }));
        }
      }
    };

    initializeGame();

    return () => {
      isMounted = false;
      
      if (localGameState.intervalId) {
        clearInterval(localGameState.intervalId);
      }
      
      cleanup();
    };
  }, []);

  // Added effect to monitor Firebase game state for question data
  useEffect(() => {
    // Skip if no Firebase data
    if (!firebase || !firebaseGameState || !firebaseGameState.gameData) return;
    
    // If we have questions data and a current question index
    if (firebaseGameState.gameData.questions && 
        firebaseGameState.currentQuestionIndex !== undefined) {
      
      // Make sure local game state has the current question
      setLocalGameState(prev => {
        // Get the target question
        const targetQuestion = firebaseGameState.gameData.questions[firebaseGameState.currentQuestionIndex];
        
        // Only update if we need to
        if (!prev.currentQuestion || 
            prev.currentQuestion['Question ID'] !== targetQuestion?.['Question ID']) {
          
          log('Updating current question from Firebase:', 
              firebaseGameState.currentQuestionIndex);
          
          return {
            ...prev,
            currentQuestion: targetQuestion,
            isLoadingQuestions: false,
            isReadyForNextQuestion: true
          };
        }
        return prev;
      });
      
      // Update questions in game context if needed
      if (!questions || questions.length === 0) {
        setQuestions(firebaseGameState.gameData.questions);
      }
      
      // Update current question index in game context
      setCurrentQuestionIndex(firebaseGameState.currentQuestionIndex);
    }
  }, [firebaseGameState?.gameData?.questions, firebaseGameState?.currentQuestionIndex]);

  // Load questions from the selected trivia pack
  const loadQuestions = useCallback(async () => {
    let isMounted = true;
    setLocalGameState(prev => ({ ...prev, isLoadingQuestions: true }));
    
    try {
      log('Attempting to load questions for pack:', selectedPack);
      
      const result = await loadPackQuestions(selectedPack);
      
      if (!result.success) {
        throw new Error(result.error || `Failed to load pack questions for: ${selectedPack}`);
      }
  
      // Process the loaded questions
      const validQuestions = result.data.filter(q => 
        q['Question ID'] && 
        q['Question Text'] && 
        q['Option A'] && 
        q['Option B'] && 
        q['Option C'] && 
        q['Option D'] && 
        q['Correct Answer']
      );
      
      if (validQuestions.length < numberOfQuestions) {
        throw new Error('Not enough valid questions available');
      }
  
      // Shuffle questions to ensure variety
      const shuffledQuestions = validQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, numberOfQuestions);
  
      if (!isMounted) return;
  
      // Update questions in context
      setQuestions(shuffledQuestions);
  
      // Set initial game state
      setLocalGameState(prev => ({
        ...prev,
        isLoadingQuestions: false,
        timeLeft: timeLimit,
        isReadyForNextQuestion: true,
        currentQuestion: shuffledQuestions[0]
      }));
  
      const stats = await getPackStatistics(selectedPack);
      if (isMounted) {
        setLocalGameState(prev => ({ ...prev, packStats: stats }));
      }
      
      // If host, update Firebase game state with questions
      if (isHost && firebase && typeof updateGameState === 'function') {
        await updateGameState({
          gameData: {
            ...firebaseGameState?.gameData,
            questions: shuffledQuestions,
            packName: selectedPack,
            packId: selectedPack
          }
        });
      }
  
    } catch (error) {
      console.error('Error loading questions:', error);
      if (isMounted) {
        Alert.alert(
          "Error Loading Questions",
          `There was a problem loading the questions: ${error.message}. Would you like to try again?`,
          [
            { text: "Try Again", onPress: loadQuestions },
            { text: "Cancel", onPress: () => navigation.goBack() }
          ]
        );
      }
    } finally {
      if (isMounted) {
        setLocalGameState(prev => ({ ...prev, isLoadingQuestions: false }));
      }
    }
  }, [selectedPack, numberOfQuestions, timeLimit, isHost, firebase, updateGameState, firebaseGameState]);

  // Handle turn prompt confirmation
  const handleTurnPromptConfirm = useCallback(() => {
    log("Turn prompt confirmed, showing question");
    
    // Make sure we have questions loaded
    if (!questions || !questions[currentQuestionIndex]) {
      console.error("No question found at index:", currentQuestionIndex);
      Alert.alert("Error", "Question not found. Please try again.");
      return;
    }
    
    // Update state in sequence to ensure proper rendering
    setLocalGameState(prev => ({
      ...prev,
      currentQuestion: questions[currentQuestionIndex],
      timeLeft: timeLimit,
      isReadyForNextQuestion: false
    }));
    
    setMultiplayerState(prev => ({
      ...prev,
      spectatorView: false
    }));
    
    setUiState(prev => ({
      ...prev,
      showTurnPrompt: false,
      isGameStarted: true,
      showQuestion: true,
      answerSubmitted: false
    }));
    
    // Start the timer
    startTimer();
  }, [currentQuestionIndex, questions, timeLimit]);

  // Start the timer for the current question
  const startTimer = useCallback(() => {
    // Clear any existing timer
    if (localGameState.intervalId) {
      clearInterval(localGameState.intervalId);
    }
    
    setLocalGameState(prev => ({ 
      ...prev, 
      timeLeft: timeLimit,
      isLowTimeWarningPlaying: false
    }));
    
    playSound('tickSound');
    
    const interval = setInterval(() => {
      // In spectator mode, we should NEVER pause the timer
      const shouldRunTimer = !isTimerPaused || multiplayerState.spectatorView;
      
      if (shouldRunTimer) {
        setLocalGameState(prev => {
          const newTime = prev.timeLeft - 1;
          
          if (newTime > 0) {
            // Play low time warning when 5 seconds or less remain
            if (newTime <= 5 && !prev.isLowTimeWarningPlaying) {
              playSound('lowTimeSound');
              return {
                ...prev,
                timeLeft: newTime,
                isLowTimeWarningPlaying: true
              };
            }
            
            // Only update score for active player, not spectator
            if (!multiplayerState.spectatorView) {
              // Update current score based on time remaining - USE MULTIPLAYER TIMER CONFIG
              const timerConfig = getMultiplayerTimerConfig(timeLimit);
              const baseScore = timerConfig.baseScore;
              const timeBonus = Math.floor(newTime * 2);
              setCurrentScore(baseScore + timeBonus);
            }
            
            return {
              ...prev,
              timeLeft: newTime
            };
          }
          
          // Time's up!
          if (!multiplayerState.spectatorView) {
            clearInterval(interval);
            handleTimeUp();
          }
          
          return {
            ...prev,
            timeLeft: 0
          };
        });
      }
    }, 1000);
    
    setLocalGameState(prev => ({
      ...prev,
      intervalId: interval
    }));
  }, [timeLimit, isTimerPaused, multiplayerState.spectatorView]);

// Stop the timer
const stopTimer = useCallback(() => {
  if (localGameState.intervalId) {
    clearInterval(localGameState.intervalId);
    setLocalGameState(prev => ({ ...prev, intervalId: null }));
  }
}, [localGameState.intervalId]);

// Handle timer expiration
const handleTimeUp = useCallback(() => {
  stopTimer();
  playSound('dareSound');
  
  // Show feedback that time's up
  setUiState(prev => ({
    ...prev,
    answerSubmitted: true
  }));
  
  // After a delay, initiate a dare
  setTimeout(async () => {
    try {
      // If this is my turn, initiate a dare in Firebase
      if (multiplayerState.isMyTurn && firebase && typeof updateGameState === 'function') {
        log('Starting dare after time up');
        
        // First set performing dare state in Firebase
        await updateGameState({
          performingDare: true,
          currentDarePlayerId: user?.uid
        });
        
        // Then generate a shared dare if we're the current player
        if (firebase.generateAndSetDare) {
          log('Generating shared dare in Firebase');
          await firebase.generateAndSetDare();
        }
      }
      
      // Update local UI
      setUiState(prev => ({
        ...prev,
        answerSubmitted: false,
        isDareVisible: true
      }));
      setPerformingDare(true);
      
      // Reset votes for new dare
      setMultiplayerState(prev => ({
        ...prev,
        dareVotes: {},
        processingDare: false,
        votingComplete: false
      }));
      
      // Update stats for the question
      if (questions[currentQuestionIndex]) {
        markQuestionAsUsed(
          selectedPack,
          questions[currentQuestionIndex]['Question ID'],
          false
        );
      }
    } catch (error) {
      console.error('Error starting dare:', error);
    }
  }, 1500);
}, [
  currentQuestionIndex, 
  multiplayerState.isMyTurn, 
  stopTimer, 
  questions, 
  firebase, 
  updateGameState, 
  user?.uid,
  selectedPack
]);

// Handle option selection
const handleOptionSelect = useCallback((option) => {
  // Only allow selection if it's my turn
  if (!multiplayerState.isMyTurn) return;
  setState(prev => ({ ...prev, selectedOption: option }));
  log('Option selected:', option);
}, [multiplayerState.isMyTurn]);

// Handle answer confirmation
const handleAnswerConfirmation = useCallback(async () => {
  // Only allow confirmation if it's my turn
  if (!multiplayerState.isMyTurn) {
    log('Not my turn, ignoring answer confirmation');
    return;
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    console.error('No question found at index:', currentQuestionIndex);
    return;
  }
  
  try {
    // Stop the timer
    stopTimer();
    
    // Mark answer as submitted in UI
    setUiState(prev => ({ ...prev, answerSubmitted: true }));
    
    // Determine if answer is correct
    const correctAnswerKey = currentQuestion['Correct Answer'];
    const correctAnswer = currentQuestion[correctAnswerKey];
    const isCorrect = state.selectedOption === correctAnswer;
    
    log('Answer check:', { 
      isCorrect, 
      selectedOption: state.selectedOption, 
      correctAnswer,
      questionIndex: currentQuestionIndex
    });
    
    // Update stats for the question
    if (selectedPack && currentQuestion['Question ID']) {
      markQuestionAsUsed(
        selectedPack,
        currentQuestion['Question ID'],
        isCorrect
      );
    }
    
    // Calculate score using multiplayer timer config
    const timerConfig = getMultiplayerTimerConfig(timeLimit);
    const baseScore = timerConfig.baseScore;
    const timeBonus = Math.floor(localGameState.timeLeft * 2);
    const totalPoints = baseScore + timeBonus;
    
    // Submit answer to Firebase
    if (firebase && typeof submitAnswer === 'function') {
      try {
        await submitAnswer(state.selectedOption, isCorrect);
        log('Answer submitted to Firebase');
        
        // If correct, update player score
        if (isCorrect && updatePlayerData) {
          // Get current score from Firebase
          const currentPlayerData = firebase.players[user.uid] || {};
          const currentPlayerScore = currentPlayerData.score || 0;
          
          // Update score with the calculated points
          await updatePlayerData({
            score: currentPlayerScore + totalPoints
          });
          
          log('Score updated:', {
            previousScore: currentPlayerScore,
            pointsAdded: totalPoints,
            newScore: currentPlayerScore + totalPoints
          });
        }
      } catch (submitError) {
        console.error('Error submitting answer, retrying:', submitError);
        // Retry once after a short delay
        setTimeout(async () => {
          try {
            await submitAnswer(state.selectedOption, isCorrect);
            
            // If correct, update player score on retry
            if (isCorrect && updatePlayerData) {
              // Get current score from Firebase
              const currentPlayerData = firebase.players[user.uid] || {};
              const currentPlayerScore = currentPlayerData.score || 0;
              
              // Update score with the calculated points
              await updatePlayerData({
                score: currentPlayerScore + totalPoints
              });
            }
          } catch (retryError) {
            console.error('Final error submitting answer:', retryError);
          }
        }, 1000);
      }
    }
    
    // Play appropriate sound
    if (isCorrect) {
      playSound('correctSound');
      
      // Show result briefly with score info
      Alert.alert(
        "Correct!",
        `Base Score: ${baseScore}\nTime Bonus: ${timeBonus}\nTotal Points: ${totalPoints}`,
        [
          { 
            text: "OK", 
            onPress: async () => {
              // Check if game is complete
              if (isHost && currentQuestionIndex >= questions.length - 1) {
                log('Game complete');
                if (firebase && typeof updateGameState === 'function') {
                  await updateGameState({
                    gameStatus: 'finished',
                    finishedAt: new Date().toISOString()
                  });
                }
              } else if (isHost && firebase && typeof updateGameState === 'function') {
                // Advance to next question
                log('Advancing to next question');
                const nextIndex = currentQuestionIndex + 1;
                
                // Get next player - important for turn rotation
                const playerIds = Object.keys(firebase.players || {});
                
                // CRITICAL FIX: Use firebaseGameState.currentPlayerId consistently
                const currentPlayerIdx = playerIds.indexOf(firebaseGameState.currentPlayerId);
                const nextPlayerIdx = (currentPlayerIdx + 1) % playerIds.length;
                const nextPlayerId = playerIds[nextPlayerIdx];
                
                log('Player rotation:', {
                  currentPlayer: firebaseGameState.currentPlayerId,
                  currentPlayerName: firebase.players[firebaseGameState.currentPlayerId]?.name,
                  nextPlayerName: firebase.players[nextPlayerId]?.name,
                  allPlayerIds: playerIds
                });
                
                // Update Firebase with next question and player
                await updateGameState({
                  currentQuestionIndex: nextIndex,
                  currentPlayerId: nextPlayerId
                });
                
                // Reset states
                setState(prev => ({ ...prev, selectedOption: null }));
                setUiState(prev => ({
                  ...prev,
                  answerSubmitted: false,
                  showQuestion: true
                }));
              }
            }
          }
        ]
      );
    } else {
      // Play incorrect answer sound
      playSound('dareSound');
      
      // Show dare popup after a delay
      setTimeout(async () => {
        try {
          log('Starting dare after incorrect answer');
          
          if (firebase && typeof updateGameState === 'function') {
            // First set currentDarePlayerId in Firebase
            await updateGameState({
              performingDare: true,
              currentDarePlayerId: user?.uid
            });
            
            // Then generate the dare (only if I'm the current player)
            if (multiplayerState.isMyTurn && firebase.generateAndSetDare) {
              log('Generating shared dare in Firebase');
              await firebase.generateAndSetDare();
            }
          }
        } catch (error) {
          console.error('Error showing dare:', error);
        }
      }, 2000);
    }
  } catch (error) {
    console.error('Error handling answer confirmation:', error);
  }
}, [
  multiplayerState.isMyTurn, 
  questions, 
  currentQuestionIndex, 
  stopTimer,
  state.selectedOption,
  firebase,
  firebaseGameState,
  updateGameState,
  submitAnswer,
  updatePlayerData,
  isHost,
  user?.uid,
  localGameState.timeLeft,
  timeLimit,
  selectedPack
]);

// Submit vote for dare completion
const submitDareVote = useCallback(async (voteValue) => {
  if (!firebase || !user) return;
  
  try {
    log('Submitting dare vote:', voteValue);
    
    // Use the renamed Firebase method
    if (firebase.submitDareVote) {
      await firebase.submitDareVote(voteValue);
      
      // If host, check votes after a delay to see if all have voted
      if (isHost && firebase.processDareVotes) {
        setTimeout(() => {
          firebase.processDareVotes()
            .catch(err => console.error('Error processing dare votes:', err));
        }, 1000);
      }
    } else {
      // Fallback to local implementation if Firebase method not available
      setMultiplayerState(prev => ({
        ...prev,
        dareVotes: {
          ...prev.dareVotes,
          [user.uid]: voteValue
        }
      }));
    }
  } catch (error) {
    console.error('Error submitting dare vote:', error);
  }
}, [firebase, user, isHost]);


// Handle dare completion - only host should call this
const handleDareComplete = useCallback(async (awardPoints) => {
// If Firebase handling is available, leave it to Firebase
if (firebase && firebase.processDareVotes && isHost) {
  log('Letting Firebase handle dare completion');
  return;
}

// Fallback to local implementation if needed
try {
  // First, mark dare as complete in Firebase
  if (typeof updateGameState === 'function') {
    await updateGameState({
      performingDare: false,
      currentDarePlayerId: null
    });
  }
  
  // Award points if the dare was completed successfully
  if (awardPoints && firebaseGameState.currentDarePlayerId) {
    const playerId = firebaseGameState.currentDarePlayerId;
    const playerData = firebase.players[playerId];
    
    if (playerData && typeof updatePlayerData === 'function') {
      // Calculate dare points using multiplayer timer config
      const timerConfig = getMultiplayerTimerConfig(timeLimit);
      const baseScore = timerConfig.baseScore;
      const darePoints = Math.floor(baseScore * 0.5);
      const currentScore = playerData.score || 0;
      
      // Update player score
      await updatePlayerData({
        id: playerId,
        score: currentScore + darePoints
      });
      
      log('Dare completed, awarded points:', {
        player: playerData.name,
        points: darePoints,
        newScore: currentScore + darePoints
      });
    }
  }
  
  // Update UI state
  setUiState(prev => ({
    ...prev,
    isDareVisible: false
  }));
  setPerformingDare(false);
  
  // Reset votes
  setMultiplayerState(prev => ({
    ...prev,
    dareVotes: {},
    processingDare: false,
    votingComplete: false
  }));
  
  // Move to next question and player after a brief delay
  setTimeout(() => {
    if (currentQuestionIndex >= questions.length - 1 && typeof updateGameState === 'function') {
      // Game is over
      updateGameState({
        gameStatus: 'finished',
        finishedAt: new Date().toISOString()
      });
    } else if (typeof updateGameState === 'function') {
      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      
      // Get next player - important for turn rotation
      const playerIds = Object.keys(firebase.players || {});
      
      // Use currentDarePlayerId instead of arbitrary user ID
      // This ensures we're working with the correct player who did the dare
      const currentDarePlayerId = firebaseGameState.currentDarePlayerId;
      const currentPlayerIdx = playerIds.indexOf(currentDarePlayerId);
      const nextPlayerIdx = (currentPlayerIdx + 1) % playerIds.length;
      const nextPlayerId = playerIds[nextPlayerIdx];
      
      log('Player rotation after dare:', {
        currentDarePlayer: currentDarePlayerId,
        currentDarePlayerName: firebase.players[currentDarePlayerId]?.name,
        nextPlayerName: firebase.players[nextPlayerId]?.name,
        allPlayerIds: playerIds
      });
      
      // Update Firebase with next question and player
      updateGameState({
        currentQuestionIndex: nextIndex,
        currentPlayerId: nextPlayerId
      });
      
      // Reset states
      setState(prev => ({ ...prev, selectedOption: null }));
      setUiState(prev => ({
        ...prev,
        answerSubmitted: false,
        showQuestion: true
      }));
    }
  }, 1000);
} catch (error) {
  console.error('Error completing dare:', error);
  setMultiplayerState(prev => ({
    ...prev,
    processingDare: false
  }));
}
}, [
firebase,
isHost,
timeLimit,
currentQuestionIndex,
questions,
firebaseGameState,
updateGameState,
updatePlayerData
]);

// Toggle scores visibility
const toggleScores = useCallback(() => {
setUiState(prev => ({ ...prev, showScores: !prev.showScores }));
}, []);

// Spectator banner component - iOS compatible version
const SpectatorBanner = memo(() => {
if (!multiplayerState.spectatorView) return null;

return (
  <View style={styles.spectatorBanner}>
    {/* Simple eye icon using View components instead of Ionicons */}
    <View style={{
      width: 16, 
      height: 16, 
      borderWidth: 2,
      borderColor: '#FFFFFF',
      borderRadius: 8,
      marginRight: 5,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <View style={{
        width: 6,
        height: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 3
      }} />
    </View>
    <Text style={styles.spectatorBannerText}>
      SPECTATOR MODE - {multiplayerState.activePlayerName || 'Player'}'s Turn
    </Text>
  </View>
);
});

// Render turn prompt modal
const renderTurnPrompt = () => {
if (!uiState.showTurnPrompt || !multiplayerState.isMyTurn) return null;

// Get the player name
const displayName = user && firebase?.players?.[user.uid]?.name || 'Player';

return (
  <View style={styles.turnPromptOverlay}>
    <View style={styles.turnPromptContainer}>
      <Text style={styles.turnPromptTitle}>It's Your Turn!</Text>
      <Text style={styles.turnPromptText}>
        {displayName}, are you ready to play?
      </Text>
      
      <TouchableOpacity 
        style={styles.turnPromptButton}
        onPress={() => {
          // First, hide the prompt locally to prevent UI flicker
          setUiState(prev => ({
            ...prev,
            showTurnPrompt: false
          }));
          
          // Then start the turn in Firebase
          handleTurnPromptConfirm();
        }}
      >
        <Text style={styles.turnPromptButtonText}>Start My Turn</Text>
      </TouchableOpacity>
    </View>
  </View>
);
};

// If still loading questions, show loading screen
if (localGameState.isLoadingQuestions) {
return (
  <View style={[styles.container, { backgroundColor: '#1A237E' }]}>
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.loadingText}>Loading questions...</Text>
    </View>
  </View>
);
}

// Get the current question from Firebase or local state
const currentFbQuestion = firebaseGameState?.gameData?.questions?.[currentQuestionIndex];
const currentQ = localGameState.currentQuestion || currentFbQuestion;

// Show loading if no question is available
if (!currentQ) {
return (
  <View style={[styles.container, { backgroundColor: '#1A237E' }]}>
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.loadingText}>Waiting for question data...</Text>
    </View>
  </View>
);
}

// If a dare is active, show the dare popup
if (firebaseGameState?.performingDare) {
const darePlayerId = firebaseGameState.currentDarePlayerId;
let playerName = "Player";

if (darePlayerId && firebase.players && firebase.players[darePlayerId]) {
  playerName = firebase.players[darePlayerId].name;
}

// Get total player count from Firebase
const totalPlayers = Object.keys(firebase.players || {}).length;

// Use Firebase dareVotes directly instead of local state
const activeVotes = firebase.dareVotes || {};

return (
  <View style={[styles.container, { backgroundColor: '#1A237E' }]}>
    <DarePopup
  visible={true}
  onClose={firebase.submitDareVote} // Use directly instead of local function
  currentPlayer={playerName}
  timerConfig={getMultiplayerTimerConfig(timeLimit)}
  isMultiplayer={true}
  isPerformingDare={firebaseGameState.currentDarePlayerId === user?.uid}
  onVote={firebase.submitDareVote} // Use directly instead of local function
  votes={activeVotes}
  totalPlayers={totalPlayers}
/>
  </View>
);
}

return (
<View style={[styles.container, { backgroundColor: '#1A237E' }]}>
  {/* Turn prompt modal */}
  {renderTurnPrompt()}
  
  {/* Score banner */}
  <ScoreBanner
    players={Object.values(firebase?.players || {}).map(p => p.name)}
    scores={Object.values(firebase?.players || {}).map(p => p.score || 0)}
    showScores={uiState.showScores}
    toggleScores={toggleScores}
    currentPlayer={currentPlayerIndex}
    timeLeft={localGameState.timeLeft}
    maxTime={timeLimit}
    currentScore={currentScore}
    isPaused={isTimerPaused}
    timerConfig={getMultiplayerTimerConfig(timeLimit)}
  />

  {/* Player name display */}
  <View style={styles.playerInfoContainer}>
    <Text style={styles.currentPlayerText}>
      {firebaseGameState?.currentPlayerId && firebase?.players?.[firebaseGameState.currentPlayerId]
        ? firebase.players[firebaseGameState.currentPlayerId].name
        : 'Player'}
    </Text>
  </View>
  
  {/* Only render spectator banner if in spectator mode */}
  {multiplayerState.spectatorView && <SpectatorBanner />}

  {/* Question number */}
  <View style={styles.questionHeaderContainer}>
    <View style={styles.questionNumberWrapper}>
      <Text style={styles.questionNumberText}>
        Question {currentQuestionIndex + 1} of {questions ? questions.length : '?'}
      </Text>
      <View style={styles.questionNumberUnderline} />
    </View>
  </View>
  
  {/* Main content container */}
  <View style={styles.contentContainer}>
    {uiState.showQuestion && currentQ ? (
      <QuestionContainer
        key={`question-${currentQuestionIndex}`}
        questionText={currentQ["Question Text"] || "Loading question..."}
        currentQuestion={currentQ}
        selectedOption={state.selectedOption}
        onSelectOption={handleOptionSelect}
        onConfirm={handleAnswerConfirmation}
        isAnswerSubmitted={uiState.answerSubmitted}
        currentScore={currentScore}
        onInfoPress={() => {
          setIsTimerPaused(true);
          setUiState(prev => ({
            ...prev,
            showScoringInfo: true
          }));
        }}
        onTimerPause={setIsTimerPaused}
        timerConfig={getMultiplayerTimerConfig(timeLimit)}
        disabled={multiplayerState.spectatorView} // Disable controls in spectator mode
      />
    ) : (
      <View style={styles.waitingContainer}>
        <View style={styles.lightBar}>
          {[...Array(20)].map((_, i) => (
            <View key={i} style={styles.light} />
          ))}
        </View>
        <Text style={styles.waitingText}>
          {multiplayerState.waitingForNextPlayer 
            ? "Moving to next player..." 
            : uiState.showTurnPrompt 
              ? "Ready to start your turn?" 
              : "Waiting for player to start..."}
        </Text>
        <View style={styles.lightBar}>
          {[...Array(20)].map((_, i) => (
            <View key={i} style={styles.light} />
          ))}
        </View>
      </View>
    )}
  </View>

  {/* Scoring info modal */}
  <ScoringInfoModal
    visible={uiState.showScoringInfo}
    onClose={() => {
      setIsTimerPaused(false);
      setUiState(prev => ({
        ...prev,
        showScoringInfo: false
      }));
    }}
    packStats={localGameState.packStats}
    timerConfig={getMultiplayerTimerConfig(timeLimit)}
  />
</View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
  },
  playerInfoContainer: {
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  currentPlayerText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginLeft: 10,
    flex: 1,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  questionHeaderContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 5,
    marginBottom: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  questionNumberWrapper: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  questionNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  questionNumberUnderline: {
    height: 2,
    backgroundColor: '#FFD700',
    width: '100%',
    marginTop: 4,
    opacity: 0.7,
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
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  spectatorBanner: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 5,
    width: '90%',
  },
  spectatorBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  lightBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    marginHorizontal: 2,
  },
  turnPromptOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  turnPromptContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.9)',
    width: '80%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  turnPromptTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  turnPromptText: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
  },
  turnPromptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  turnPromptButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  }
});

export default MultiplayerQuestionScreen;