// Context/multiplayer/MultiplayerGameFlow.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFirebase } from './FirebaseContext';
import { useGame } from '../GameContext';
import { Alert, Platform, ToastAndroid, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * This component handles multiplayer game flow coordination using Firebase.
 * Manages game state synchronization, turn handling, and player coordination.
 */
const MultiplayerGameFlow = () => {
  const navigation = useNavigation();
  const firebase = useFirebase();
  const gameContext = useGame();
  
  // Track navigation and state
  const navigationInProgress = useRef(false);
  const dareCompleteProcessedRef = useRef(null);
  const turnTransitionInProgressRef = useRef(false);
  const lastProcessedGameStateRef = useRef(null);
  const lastProcessedCountdownRef = useRef(null);
  const lastSyncedDataRef = useRef(null);
  
  // State for app behavior 
  const [isGameActive, setIsGameActive] = useState(false);
  
  // Extract key props from contexts with fallbacks
  const isHost = firebase?.isHost || false;
  const user = firebase?.user;
  const players = firebase?.players || {};
  const gameState = firebase?.gameState;
  const questions = gameContext?.questions || [];
  const currentQuestionIndex = gameContext?.currentQuestionIndex || 0;
  
  // Enhanced debug logging
  const log = (...args) => {
    if (__DEV__) {
      console.log('[MultiplayerGameFlow]', ...args);
    }
  };
  
  // Android-specific back button handling during active games
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== 'android' || !isGameActive) return;
      
      const onBackPress = () => {
        // If a multiplayer game is active, confirm before leaving
        Alert.alert(
          "Leave Game?",
          "Are you sure you want to leave this multiplayer game?",
          [
            { text: "Stay", style: "cancel" },
            { 
              text: "Leave", 
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
      };
      
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [isGameActive, navigation, firebase])
  );
  
  // Sync player data with game context
  const syncPlayersWithGame = useCallback(() => {
    if (!firebase?.players || !gameContext.setPlayers || !gameContext.setScores) return;
    
    try {
      const playerData = Object.entries(firebase.players);
      if (playerData.length === 0) return;
      
      // Generate a signature of the current data
      const playerNames = playerData.map(([_, player]) => player.name);
      const playerScores = playerData.map(([_, player]) => player.score || 0);
      const dataSignature = JSON.stringify({ names: playerNames, scores: playerScores });
      
      // Skip update if data hasn't changed
      if (lastSyncedDataRef.current === dataSignature) {
        return;
      }
      
      // Update player names in game context
      gameContext.setPlayers(playerNames);
      
      // Update player scores
      gameContext.setScores(playerScores);
      
      // Only log when data actually changes
      log('Synced player data:', { names: playerNames, scores: playerScores });
      
      // Save signature of synced data
      lastSyncedDataRef.current = dataSignature;
    } catch (error) {
      console.error('Error syncing player data:', error);
    }
  }, [firebase?.players, gameContext]);
  
  // Trigger player sync when player data changes with debounce
  useEffect(() => {
    // Debounce player sync to prevent excessive updates
    const timeoutId = setTimeout(() => {
      syncPlayersWithGame();
    }, 500); // Only sync at most once every 500ms
    
    return () => clearTimeout(timeoutId);
  }, [syncPlayersWithGame, firebase?.players]);
  
  // Handle turn transition logic
  const handleTurnTransition = useCallback(async (nextPlayerId) => {
    if (!isHost || !firebase?.updateGameState || !nextPlayerId) return;
    
    // Prevent duplicate transitions
    if (turnTransitionInProgressRef.current) return;
    turnTransitionInProgressRef.current = true;
    
    try {
      log('Transitioning turn to player:', nextPlayerId);
      
      // Reset all relevant states first
      await firebase.updateGameState({
        performingDare: false,
        currentDarePlayerId: null
      });
      
      // Wait to ensure cleanup
      setTimeout(async () => {
        await firebase.updateGameState({
          currentPlayerId: nextPlayerId,
          // Reset any existing dare votes
          dareVotes: {}
        });
        
        turnTransitionInProgressRef.current = false;
        log('Turn transition complete');
      }, 500);
    } catch (error) {
      turnTransitionInProgressRef.current = false;
      console.error('Error in turn transition:', error);
    }
  }, [firebase, isHost]);
  
  // Function to determine the next player in rotation
  const determineNextPlayer = useCallback(() => {
    if (!firebase?.players || !gameState?.currentPlayerId) return null;
    
    const playerIds = Object.keys(firebase.players);
    if (playerIds.length <= 1) return playerIds[0]; // Only one player
    
    const currentIndex = playerIds.indexOf(gameState.currentPlayerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    
    return playerIds[nextIndex];
  }, [firebase?.players, gameState?.currentPlayerId]);
  
  // Monitor game state for changes with improved signature detection
  useEffect(() => {
    if (!gameState || !firebase.currentRoom) return;
    
    // Create signature including important state elements
    const gameStateSignature = JSON.stringify({
      status: gameState.gameStatus,
      question: gameState.currentQuestionIndex,
      player: gameState.currentPlayerId,
      dare: gameState.performingDare,
      darePlayer: gameState.currentDarePlayerId,
      pack: gameState.gameData?.packName
    });
    
    // Skip processing if we've already processed this state
    if (lastProcessedGameStateRef.current === gameStateSignature) {
      return;
    }
    
    // Update the processed reference
    lastProcessedGameStateRef.current = gameStateSignature;
    log('Processing new game state');
    
    // Sync selected pack information to game context
    if (gameState.gameData?.packName && gameContext.setSelectedPack) {
      gameContext.setSelectedPack(gameState.gameData.packName);
    }
    
    // Update game active state
    setIsGameActive(gameState.gameStatus === 'playing');
    
    // Process changes in playing state
    if (gameState.gameStatus === 'playing') {
      // Update question index if changed
      if (gameState.currentQuestionIndex !== undefined && 
          gameContext.setCurrentQuestionIndex &&
          gameState.currentQuestionIndex !== gameContext.currentQuestionIndex) {
        
        gameContext.setCurrentQuestionIndex(gameState.currentQuestionIndex);
        
        // Also update current question if available
        if (gameState.gameData?.questions?.[gameState.currentQuestionIndex] && 
            gameContext.setCurrentQuestion) {
          gameContext.setCurrentQuestion(
            gameState.gameData.questions[gameState.currentQuestionIndex]
          );
        }
      }
      
      // Update spectator mode based on whose turn it is
      if (gameState.currentPlayerId && user && gameContext.setSpectatorMode) {
        const isMyTurn = user.uid === gameState.currentPlayerId;
        gameContext.setSpectatorMode(!isMyTurn);
      }
      
      // Handle dare state changes
      if (gameState.performingDare !== undefined && 
          gameState.performingDare !== gameContext.performingDare && 
          gameContext.setPerformingDare) {
        gameContext.setPerformingDare(gameState.performingDare);
      }
      
      // Handle finished state
      if (gameState.gameStatus === 'finished' && !navigationInProgress.current) {
        handleGameEnd();
      }
    }
  }, [gameState, firebase.currentRoom, gameContext, user?.uid, handleGameEnd]);
  
  // Monitor countdown state specifically
  useEffect(() => {
    if (!gameState?.countdown || !firebase.currentRoom) return;
    
    // Create countdown signature 
    const countdownSignature = JSON.stringify({
      value: gameState.countdown.value,
      inProgress: gameState.countdown.inProgress,
      startTimestamp: gameState.countdown.startTimestamp
    });
    
    // Skip if already processed
    if (lastProcessedCountdownRef.current === countdownSignature) {
      return;
    }
    
    // Update the processed reference
    lastProcessedCountdownRef.current = countdownSignature;
    
    // Process countdown state 
    if (gameState.countdown.inProgress) {
      log('Countdown in progress:', gameState.countdown);
      
      // If host, ensure we have a first player selected
      if (isHost && !gameState.currentPlayerId && Object.keys(players).length > 0) {
        // Choose the first player who isn't the host
        const nonHostPlayer = Object.entries(players).find(([id, player]) => !player.isHost);
        const firstPlayerId = nonHostPlayer ? nonHostPlayer[0] : Object.keys(players)[0];
        
        // Set the first player
        if (firstPlayerId && firebase.updateGameState) {
          firebase.updateGameState({
            currentPlayerId: firstPlayerId
          }).catch(err => console.error('Error setting first player:', err));
        }
      }
    }
  }, [gameState?.countdown, firebase, isHost, players]);
  
  // Handle game end and navigate to results
  const handleGameEnd = useCallback(() => {
    if (!firebase || !players || navigationInProgress.current) return;
    
    navigationInProgress.current = true;
    log('Game ending, navigating to results');
    
    // Convert player data to the format expected by the results screen
    const playerData = Object.entries(players).map(([id, player]) => ({
      player: player.name,
      score: player.score || 0,
      id
    }));
    
    // Sort by score descending
    playerData.sort((a, b) => b.score - a.score);
    
    // Mark game as inactive
    setIsGameActive(false);
    
    // Android-specific notification
    if (Platform.OS === 'android') {
      ToastAndroid.show('Game complete!', ToastAndroid.SHORT);
    }
    
    // Navigate to results screen with improved pack stats
    setTimeout(() => {
      navigation.navigate('WinnerTransition', {
        playerData,
        packStats: gameState?.gameData?.packName ? {
          name: gameState.gameData.packName,
          id: gameState.gameData.packId || gameState.gameData.packName,
          displayName: gameState.gameData.packDisplayName || gameState.gameData.packName
        } : null,
        isMultiplayer: true
      });
      navigationInProgress.current = false;
    }, Platform.OS === 'android' ? 800 : 500);
  }, [firebase, players, gameState, navigation]);
  
  // Expose methods to parent components via global helpers
  useEffect(() => {
    // Create global methods for other components to call
    if (typeof global !== 'undefined') {
      global.multiplayerGameFlow = {
        endGame: handleGameEnd,
        nextTurn: () => {
          const nextPlayerId = determineNextPlayer();
          if (nextPlayerId) {
            handleTurnTransition(nextPlayerId);
          }
        },
        syncPlayers: syncPlayersWithGame
      };
    }
    
    return () => {
      // Clean up global if it exists
      if (typeof global !== 'undefined' && global.multiplayerGameFlow) {
        delete global.multiplayerGameFlow;
      }
    };
  }, [handleGameEnd, determineNextPlayer, handleTurnTransition, syncPlayersWithGame]);
  
  // Monitor for disconnected players and handle gracefully
  useEffect(() => {
    if (!isHost || !firebase || !players) return;
    
    const disconnectedPlayers = Object.entries(players)
      .filter(([_, player]) => player.isConnected === false)
      .map(([id, player]) => ({id, name: player.name}));
    
    if (disconnectedPlayers.length > 0) {
      log('Disconnected players detected:', disconnectedPlayers);
      
      // Check if current player is disconnected
      if (gameState?.currentPlayerId) {
        const currentPlayerDisconnected = disconnectedPlayers
          .some(p => p.id === gameState.currentPlayerId);
        
        // If current player is disconnected, move to next player
        if (currentPlayerDisconnected && !turnTransitionInProgressRef.current) {
          log('Current player disconnected, moving to next player');
          const nextPlayerId = determineNextPlayer();
          if (nextPlayerId) {
            handleTurnTransition(nextPlayerId);
          }
        }
      }
    }
  }, [players, isHost, firebase, gameState?.currentPlayerId, determineNextPlayer, handleTurnTransition]);
  
  // Monitor for players completing all questions
  useEffect(() => {
    if (!isHost || !firebase || !gameState) return;
    
    const isLastQuestion = gameState.currentQuestionIndex >= 
      (gameState.gameData?.questions?.length - 1 || 0);
    
    // If we're on the last question and not already finishing
    if (isLastQuestion && gameState.gameStatus === 'playing' && !navigationInProgress.current) {
      log('Last question detected, preparing for game finish');
      
      // Set a flag in the game state to prepare other clients
      if (firebase.updateGameState) {
        firebase.updateGameState({
          gameFinishing: true
        }).catch(err => console.error('Error setting game finishing state:', err));
      }
    }
  }, [gameState?.currentQuestionIndex, gameState?.gameData?.questions, gameState?.gameStatus, isHost, firebase]);
  
  // Helper function for properly advancing to next question
  const advanceToNextQuestion = useCallback(() => {
    if (!isHost || !firebase?.updateGameState || !gameState) return;
    
    const currentIndex = gameState.currentQuestionIndex || 0;
    const nextIndex = currentIndex + 1;
    
    // Check if there are more questions
    if (gameState.gameData?.questions && nextIndex < gameState.gameData.questions.length) {
      log('Advancing to next question:', nextIndex);
      
      firebase.updateGameState({
        currentQuestionIndex: nextIndex,
        // Reset any dare state
        performingDare: false,
        currentDarePlayerId: null
      }).catch(err => console.error('Error advancing question:', err));
    } else {
      // End the game if no more questions
      log('No more questions, ending game');
      
      firebase.updateGameState({
        gameStatus: 'finished',
        finishedAt: new Date().toISOString()
      }).catch(err => console.error('Error ending game:', err));
    }
  }, [firebase, isHost, gameState]);
  
  // Expose advanceToNextQuestion to global for other components
  useEffect(() => {
    if (typeof global !== 'undefined' && global.multiplayerGameFlow) {
      global.multiplayerGameFlow.nextQuestion = advanceToNextQuestion;
    }
    
    return () => {
      if (typeof global !== 'undefined' && global.multiplayerGameFlow) {
        delete global.multiplayerGameFlow.nextQuestion;
      }
    };
  }, [advanceToNextQuestion]);
  
  // This is a utility component that doesn't render anything visible
  return null;
};
  
export default React.memo(MultiplayerGameFlow);