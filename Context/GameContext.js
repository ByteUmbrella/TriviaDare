import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useFirebase } from './multiplayer/FirebaseContext';

export const GameContext = createContext(null);

export const useGame = () => useContext(GameContext);

export const TIMER_CONFIGS = {
  15: { label: 'Quick', baseScore: 200 },    // Highest points for fastest time
  30: { label: 'Standard', baseScore: 150 },
  45: { label: 'Relaxed', baseScore: 100 },
  60: { label: 'Extended', baseScore: 50 }   // Lowest points for most time
};

// Helper function to create a unique identifier for dares
const createDareId = (playerIndex, timestamp) => {
  return `dare-${playerIndex}-${timestamp || Date.now()}`;
};

export const GameProvider = ({ children }) => {
  // Firebase context for multiplayer integration
  const firebase = useFirebase();

  // Original state - PRESERVED
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [numberOfQuestions, setNumberOfQuestions] = useState(3);
  const [selectedPack, setSelectedPack] = useState(null);
  const [timeLimit, setTimeLimit] = useState(30); // Default to Standard
  const [baseScore, setBaseScore] = useState(TIMER_CONFIGS[30].baseScore);
  const [currentScore, setCurrentScore] = useState(0);
  const [performingDare, setPerformingDare] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState({});
  const [gameInProgress, setGameInProgress] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [pendingDares, setPendingDares] = useState([]);
  
  // NEW: Dynamic dare scoring state
  const [dareStreaks, setDareStreaks] = useState([]);
  
  // Questions state - PRESERVED
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);

  // Multiplayer-specific state
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [dareVotes, setDareVotes] = useState({});
  const [spectatorMode, setSpectatorMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [dareProcessingComplete, setDareProcessingComplete] = useState(false);
  const [isProcessingDareVotes, setIsProcessingDareVotes] = useState(false);
  
  // Use refs to track processed dares
  const lastProcessedDareRef = useRef(null);
  const turnTransitionInProgressRef = useRef(false);

  // NEW: Initialize dare streaks when players change
  useEffect(() => {
    if (players.length > 0 && (dareStreaks.length !== players.length)) {
      console.log('🎯 Initializing dare streaks for players:', players.length);
      const newStreaks = new Array(players.length).fill(0);
      setDareStreaks(newStreaks);
      console.log('🎯 Dare streaks initialized:', newStreaks);
    }
  }, [players.length]);

  // NEW: Calculate dynamic dare points based on current game state
  const calculateDarePoints = useCallback((playerIndex, currentScores, totalQuestions = numberOfQuestions) => {
    console.log('🎯 Calculating dare points for player', playerIndex);
    console.log('🎯 Current scores:', currentScores);
    console.log('🎯 Current dare streaks:', dareStreaks);
    console.log('🎯 Total questions in game:', totalQuestions);
    
    // Get base dare points (75% of timer config base score)
    const timerConfig = TIMER_CONFIGS[timeLimit];
    const baseDarePoints = timerConfig.baseScore * 0.75;
    console.log('🎯 Base dare points:', baseDarePoints, 'from timer config:', timerConfig);
    
    // Calculate question count multiplier (shorter games = higher value dares)
    // Formula: fewer questions = higher multiplier, more questions = lower multiplier
    const questionCountMultiplier = Math.max(0.8, Math.min(1.5, 5 / totalQuestions));
    console.log('🎯 Question count multiplier calculation:', {
      totalQuestions,
      questionCountMultiplier: questionCountMultiplier.toFixed(2)
    });
    
    // Apply question count multiplier to base points
    const adjustedBaseDarePoints = baseDarePoints * questionCountMultiplier;
    console.log('🎯 Adjusted base dare points after question multiplier:', adjustedBaseDarePoints);
    
    // Calculate catch-up bonus
    let catchUpBonus = 0;
    if (currentScores.length > 1) {
      const averageScore = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
      const currentPlayerScore = currentScores[playerIndex] || 0;
      catchUpBonus = Math.max(0, (averageScore - currentPlayerScore) * 0.2);
      console.log('🎯 Catch-up calculation:', {
        averageScore,
        currentPlayerScore,
        catchUpBonus
      });
    } else {
      console.log('🎯 Single player mode - no catch-up bonus');
    }
    
    // Calculate streak multiplier
    const playerStreak = dareStreaks[playerIndex] || 0;
    const streakMultiplier = 1 + (playerStreak * 0.25);
    console.log('🎯 Streak calculation:', {
      playerStreak,
      streakMultiplier
    });
    
    // Calculate final points
    const finalDarePoints = Math.round((adjustedBaseDarePoints + catchUpBonus) * streakMultiplier);
    
    console.log('🎯 Final dare points calculation:', {
      baseDarePoints,
      questionCountMultiplier,
      adjustedBaseDarePoints,
      catchUpBonus,
      streakMultiplier,
      finalDarePoints
    });
    
    return {
      baseDarePoints,
      questionCountMultiplier,
      adjustedBaseDarePoints,
      catchUpBonus,
      streakMultiplier,
      finalDarePoints,
      streakInfo: {
        currentStreak: playerStreak,
        streakBonus: Math.round((adjustedBaseDarePoints + catchUpBonus) * (streakMultiplier - 1))
      }
    };
  }, [timeLimit, dareStreaks, numberOfQuestions]);

  // NEW: Update dare streak for a player
  const updateDareStreak = useCallback((playerIndex, dareCompleted) => {
    console.log('🎯 Updating dare streak for player', playerIndex, 'completed:', dareCompleted);
    
    setDareStreaks(prevStreaks => {
      const newStreaks = [...prevStreaks];
      
      if (dareCompleted) {
        // Increment streak for successful dare
        newStreaks[playerIndex] = (newStreaks[playerIndex] || 0) + 1;
        console.log('🎯 Streak incremented to:', newStreaks[playerIndex]);
      } else {
        // Reset streak for failed dare
        const previousStreak = newStreaks[playerIndex] || 0;
        newStreaks[playerIndex] = 0;
        console.log('🎯 Streak reset from', previousStreak, 'to 0');
      }
      
      console.log('🎯 Updated dare streaks:', newStreaks);
      return newStreaks;
    });
  }, []);

  // NEW: Reset dare streak for a specific player
  const resetDareStreak = useCallback((playerIndex) => {
    console.log('🎯 Resetting dare streak for player', playerIndex);
    
    setDareStreaks(prevStreaks => {
      const newStreaks = [...prevStreaks];
      const previousStreak = newStreaks[playerIndex] || 0;
      newStreaks[playerIndex] = 0;
      console.log('🎯 Dare streak reset from', previousStreak, 'to 0');
      return newStreaks;
    });
  }, []);

  // NEW: Get dare streak info for a player
  const getDareStreakInfo = useCallback((playerIndex) => {
    const currentStreak = dareStreaks[playerIndex] || 0;
    const nextStreakBonus = (currentStreak + 1) * 0.25; // What the multiplier would be with one more
    
    const info = {
      currentStreak,
      nextStreakBonus,
      hasStreak: currentStreak > 0
    };
    
    console.log('🎯 Dare streak info for player', playerIndex, ':', info);
    return info;
  }, [dareStreaks]);

  // Monitor Firebase state for changes
  useEffect(() => {
    if (!isMultiplayer || !firebase) return;

    // Update players from Firebase
    if (firebase.players) {
      const playerNames = Object.values(firebase.players).map(player => player.name);
      setPlayers(playerNames);
    }
    
    // Update scores from Firebase
    if (firebase.players) {
      const playerScores = Object.values(firebase.players).map(player => player.score || 0);
      setScores(playerScores);
    }
    
    // Update game state from Firebase
    if (firebase.gameState) {
      // Update currentQuestionIndex if it's different
      if (firebase.gameState.currentQuestionIndex !== undefined &&
          firebase.gameState.currentQuestionIndex !== currentQuestionIndex) {
        setCurrentQuestionIndex(firebase.gameState.currentQuestionIndex);
      }
      
      // Update questions from Firebase if available and we don't have them locally
      if (firebase.gameState.gameData?.questions && 
          (!questions || questions.length === 0)) {
        setQuestions(firebase.gameState.gameData.questions);
      }
      
      // Get current question based on index
      if (firebase.gameState.gameData?.questions?.[firebase.gameState.currentQuestionIndex]) {
        setCurrentQuestion(firebase.gameState.gameData.questions[firebase.gameState.currentQuestionIndex]);
      }
      
      // Update dare state
      if (firebase.gameState.performingDare !== undefined) {
        setPerformingDare(firebase.gameState.performingDare);
      }
      
      // Check if it's our turn
      if (firebase.gameState.currentPlayerId) {
        const isMyTurn = firebase.gameState.currentPlayerId === firebase.user?.uid;
        setSpectatorMode(!isMyTurn);
      }
    }
    
  }, [firebase, isMultiplayer, currentQuestionIndex, questions]);

  // Submit a vote for dare completion in multiplayer mode
  const voteDareCompletion = useCallback((completed) => {
    if (!isMultiplayer || !firebase) return false;
    
    try {
      // Update local state
      if (firebase.user) {
        setDareVotes(prev => ({
          ...prev,
          [firebase.user.uid]: completed
        }));
      }
      
      // Submit vote to Firebase
      if (firebase.updatePlayerData) {
        firebase.updatePlayerData({
          dareVote: {
            value: completed,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error submitting dare vote:', error);
      return false;
    }
  }, [isMultiplayer, firebase]);
  
  // Process pending dare votes using Firebase with DYNAMIC SCORING
  const processPendingDareVotes = useCallback(() => {
    // Skip if not doing a dare or already processing or already complete
    if (!performingDare || isProcessingDareVotes || dareProcessingComplete || !firebase || !isMultiplayer) {
      return false;
    }
    
    // Only host processes votes
    if (!firebase.isHost) {
      return false;
    }
    
    try {
      // Mark as processing to prevent re-entry
      setIsProcessingDareVotes(true);
      
      // Get all players and their votes
      const allPlayers = firebase.players || {};
      const votes = {};
      let allVoted = true;
      let playerCount = 0;
      
      // Collect votes
      Object.entries(allPlayers).forEach(([playerId, playerData]) => {
        playerCount++;
        if (playerData.dareVote) {
          votes[playerId] = playerData.dareVote.value;
        } else {
          allVoted = false;
        }
      });
      
      // If all players have voted, process the result
      if (allVoted && playerCount > 0) {
        // Count votes
        const yesVotes = Object.values(votes).filter(v => v === true).length;
        const totalVotes = Object.values(votes).length;
        const majorityCompleted = yesVotes >= Math.ceil(totalVotes / 2);
        
        console.log('🎯 Processing dare votes in multiplayer:', {
          yesVotes,
          totalVotes,
          majorityCompleted
        });
        
        // Generate unique ID for this processing
        const timestamp = Date.now();
        const darePlayerId = firebase.gameState?.currentDarePlayerId;
        const processingId = createDareId(darePlayerId || 0, timestamp);
        
        // Skip if already processed
        if (lastProcessedDareRef.current === processingId) {
          return true;
        }
        
        // Mark as processed
        lastProcessedDareRef.current = processingId;
        
        // Award points if majority completed
        if (majorityCompleted && darePlayerId) {
          const playerData = firebase.players[darePlayerId];
          
          if (playerData) {
            // NEW: Use dynamic dare scoring instead of fixed calculation
            const currentScores = Object.values(firebase.players).map(p => p.score || 0);
            const playerIndex = Object.keys(firebase.players).indexOf(darePlayerId);
            
            const darePointsCalculation = calculateDarePoints(playerIndex, currentScores, numberOfQuestions);
            const darePoints = darePointsCalculation.finalDarePoints;
            
            console.log('🎯 Multiplayer dare completion - using dynamic scoring with question count:', darePointsCalculation);
            
            const currentScore = playerData.score || 0;
            
            // Update player score
            firebase.updatePlayerData({
              id: darePlayerId,
              score: currentScore + darePoints
            });
            
            // Update dare streak
            updateDareStreak(playerIndex, true);
          }
        } else if (darePlayerId) {
          // Failed dare - reset streak
          const playerIndex = Object.keys(firebase.players).indexOf(darePlayerId);
          updateDareStreak(playerIndex, false);
        }
        
        // Move to next question
        if (firebase.updateGameState) {
          // Reset dare state
          firebase.updateGameState({
            performingDare: false,
            currentDarePlayerId: null
          });
        }
        
        // Mark as complete
        setDareProcessingComplete(true);
        setIsProcessingDareVotes(false);
        
        return true;
      }
      
      // Not all players have voted yet
      setIsProcessingDareVotes(false);
      return false;
      
    } catch (error) {
      console.error('Error processing dare votes:', error);
      setIsProcessingDareVotes(false);
      return false;
    }
  }, [
    performingDare, 
    isProcessingDareVotes, 
    dareProcessingComplete, 
    firebase, 
    isMultiplayer,
    baseScore,
    calculateDarePoints,
    updateDareStreak
  ]);
  
  // Move to next player's turn in multiplayer
  const nextMultiplayerTurn = useCallback(() => {
    if (!isMultiplayer || !firebase || !firebase.isHost) return;
    
    // Prevent multiple simultaneous turn transitions
    if (turnTransitionInProgressRef.current) {
      console.log('[GameContext] Turn transition already in progress, skipping');
      return;
    }
    
    // Set flag to prevent duplicate transitions
    turnTransitionInProgressRef.current = true;
    
    try {
      // Get current and next question indices
      const nextIndex = currentQuestionIndex + 1;
      
      // Check if game is complete
      if (nextIndex >= numberOfQuestions) {
        // End the game
        if (firebase.updateGameState) {
          firebase.updateGameState({
            gameStatus: 'finished',
            finishedAt: new Date().toISOString()
          });
        }
        turnTransitionInProgressRef.current = false;
        return;
      }
      
      // Move to next question
      if (firebase.updateGameState) {
        firebase.updateGameState({
          currentQuestionIndex: nextIndex
        });
      }
      
      // Reset state for next question
      setDareVotes({});
      setPerformingDare(false);
      setDareProcessingComplete(false);
      setIsProcessingDareVotes(false);
      lastProcessedDareRef.current = null;
      
      // Update local states
      setCurrentQuestionIndex(nextIndex);
      
      // Clear transition flag after a delay
      setTimeout(() => {
        turnTransitionInProgressRef.current = false;
      }, 300);
      
    } catch (error) {
      console.error('Error moving to next turn:', error);
      turnTransitionInProgressRef.current = false;
    }
  }, [
    isMultiplayer, 
    firebase, 
    currentQuestionIndex, 
    numberOfQuestions
  ]);
  
  // Update scores in multiplayer mode
  const updateScoresMultiplayer = useCallback((newScores) => {
    if (!isMultiplayer || !firebase || !firebase.isHost) return;
    
    try {
      // Update local scores
      setScores(newScores);
      
      // Update each player's score in Firebase
      if (firebase.players && firebase.updatePlayerData) {
        // Assuming players array and scores array are aligned by index
        Object.entries(firebase.players).forEach(([playerId, playerData], index) => {
          if (index < newScores.length) {
            firebase.updatePlayerData({
              id: playerId,
              score: newScores[index]
            });
          }
        });
      }
    } catch (error) {
      console.error('Error updating multiplayer scores:', error);
    }
  }, [isMultiplayer, firebase]);

  // === EXISTING FUNCTIONS - PRESERVED ===
  
  const addPendingDare = (dare, player) => {
    setPendingDares(prev => [...prev, { 
      dare, 
      player, 
      completed: null,
      packName: selectedPack 
    }]);
  };

  const updatePendingDareStatus = (index, completed) => {
    setPendingDares(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index].completed = completed;
      }
      return updated;
    });
  };

  const updateTimeConfig = (seconds) => {
    setTimeLimit(seconds);
    setTimeLeft(seconds);
    setBaseScore(TIMER_CONFIGS[seconds].baseScore);
    
    // Sync with other players if in multiplayer
    if (isMultiplayer && firebase && firebase.updateGameState) {
      firebase.updateGameState({
        gameSettings: {
          ...firebase.gameState?.gameSettings,
          timeLimit: seconds
        }
      });
    }
  };

  const calculateTimeBonus = (timeLeft) => {
    // Add a small buffer for Android devices which might run slower
    const adjustedTimeLeft = Platform.OS === 'android' ? 
      Math.min(timeLeft + 1, timeLimit) : timeLeft;
      
    const bonusPercentage = (adjustedTimeLeft / timeLimit);
    return Math.floor(bonusPercentage * 100);
  };

  const calculateFinalScore = (timeLeft) => {
    const timeBonus = calculateTimeBonus(timeLeft);
    return baseScore + timeBonus;
  };

  const resetTimerAndScore = () => {
    setTimeLimit(30); // Reset to Standard
    setTimeLeft(30);
    setCurrentScore(TIMER_CONFIGS[30].baseScore);
  };

  const hardReset = () => {
    setPlayers([]);
    setScores([]);
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setNumberOfQuestions(3);
    setSelectedPack(null);
    setTimeLimit(30);
    setTimeLeft(30);
    setCurrentScore(0);
    setPerformingDare(false);
    setGameInProgress(false);
    setUsedQuestions({});
    
    // NEW: Reset dare streaks
    setDareStreaks([]);
    console.log('🎯 Dare streaks reset in hardReset');
    
    // Memory optimization - explicitly empty arrays and objects
    setPendingDares([]);
    setQuestions([]);
    setCurrentQuestion(null);
    
    // Reset multiplayer state
    setIsMultiplayer(false);
    setSpectatorMode(false);
    setDareVotes({});
    setLastSyncTime(0);
    setDareProcessingComplete(false);
    setIsProcessingDareVotes(false);
    lastProcessedDareRef.current = null;
    turnTransitionInProgressRef.current = false;
  };

  const softReset = () => {
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setScores(new Array(players.length).fill(0));
    
    // NEW: Reset dare streaks but keep players
    if (players.length > 0) {
      setDareStreaks(new Array(players.length).fill(0));
      console.log('🎯 Dare streaks reset in softReset for', players.length, 'players');
    }
    
    resetTimerAndScore();
    setPerformingDare(false);
    setGameInProgress(false);
    
    // Memory optimization for soft reset
    setPendingDares([]);
    setCurrentQuestion(questions[0] || null);
    
    // Reset multiplayer turn state
    if (isMultiplayer) {
      // In Firebase, check if it's my turn based on user ID
      const isMyTurn = firebase?.user?.uid === firebase?.gameState?.currentPlayerId;
      setSpectatorMode(!isMyTurn);
      setDareVotes({});
      setDareProcessingComplete(false);
      setIsProcessingDareVotes(false);
      lastProcessedDareRef.current = null;
      turnTransitionInProgressRef.current = false;
    }
  };

  const resetGame = async (options = { resetQuestions: true, resetPlayers: false }) => {
    if (options.resetPlayers) {
      hardReset();
    } else {
      softReset();
    }

    if (options.resetQuestions) {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const usedQuestionKeys = keys.filter(key => key.endsWith('_used'));
        const allUsedQuestions = {};
        
        for (const key of usedQuestionKeys) {
          const usedQuestionsForPack = await AsyncStorage.getItem(key);
          if (usedQuestionsForPack) {
            allUsedQuestions[key] = JSON.parse(usedQuestionsForPack);
          }
        }
        setUsedQuestions(allUsedQuestions);
        // Clear questions when resetting
        setQuestions([]);
        setCurrentQuestion(null);
      } catch (error) {
        console.error('Error resetting questions:', error);
        setUsedQuestions({});
      }
    }
    
    // Reset state in Firebase if in multiplayer mode
    if (isMultiplayer && firebase && firebase.isHost && firebase.updateGameState) {
      try {
        await firebase.updateGameState({
          gameStatus: 'waiting',
          currentQuestionIndex: 0
        });
        
        // Reset player scores
        if (firebase.players && firebase.updatePlayerData) {
          Object.keys(firebase.players).forEach(async playerId => {
            await firebase.updatePlayerData({
              id: playerId,
              score: 0
            });
          });
        }
      } catch (error) {
        console.error('Error resetting Firebase game state:', error);
      }
    }
  };

  const addPlayer = (playerName) => {
    const newPlayer = { name: playerName.trim() };
    setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
  };

  const removePlayer = (index) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  // Start a multiplayer game session
  const startMultiplayerGame = (isHost = false) => {
    setIsMultiplayer(true);
    setSpectatorMode(!isHost);
    setGameInProgress(true);
      
    // Initialize Firebase multiplayer state if host
    if (isHost && firebase && firebase.updateGameState) {
      firebase.updateGameState({
        gameStatus: 'waiting',
        currentQuestionIndex: 0,
        gameSettings: {
          timeLimit: timeLimit,
          rounds: numberOfQuestions
        }
      });
    }
  };

  // Set up game context value with all functions and state
  const value = {
    // Original state - PRESERVED
    players,
    setPlayers,
    scores,
    setScores,
    currentPlayerIndex,
    setCurrentPlayerIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    numberOfQuestions,
    setNumberOfQuestions,
    selectedPack,
    setSelectedPack,
    timeLimit,
    setTimeLimit,
    timeLeft,
    setTimeLeft,
    baseScore,
    setBaseScore,
    currentScore,
    setCurrentScore,
    performingDare,
    setPerformingDare,
    usedQuestions,
    setUsedQuestions,
    gameInProgress,
    setGameInProgress,
    questions,
    setQuestions,
    currentQuestion,
    setCurrentQuestion,
    pendingDares,
    setPendingDares,
    
    // NEW: Dynamic dare scoring state and functions
    dareStreaks,
    setDareStreaks,
    calculateDarePoints,
    updateDareStreak,
    resetDareStreak,
    getDareStreakInfo,
    
    // Multiplayer specific
    isMultiplayer,
    setIsMultiplayer,
    spectatorMode,
    setSpectatorMode,
    dareVotes,
    dareProcessingComplete,
    setDareProcessingComplete,
    
    // Original functions - PRESERVED
    addPlayer,
    removePlayer,
    resetGame,
    hardReset,
    softReset,
    resetTimerAndScore,
    calculateFinalScore,
    TIMER_CONFIGS,
    updateTimeConfig,
    addPendingDare,
    updatePendingDareStatus,
    
    // Firebase multiplayer functions
    startMultiplayerGame,
    nextMultiplayerTurn,
    voteDareCompletion,
    processPendingDareVotes,
    updateScoresMultiplayer
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export default GameProvider;