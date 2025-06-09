// Context/multiplayer/FirebaseContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert, Platform } from 'react-native';
import { 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  ref, 
  set, 
  onValue, 
  remove, 
  update, 
  onDisconnect, 
  serverTimestamp,
  get,
  connectDatabaseEmulator
} from 'firebase/database';
import { auth, database } from '../../config/firebaseConfig';

const FirebaseContext = createContext();

export const FirebaseProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  
  // New state for multiplayer synchronization
  const [globalDare, setGlobalDare] = useState(null);
  const [dareVotes, setDareVotes] = useState({});

  // Initialize authentication
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('[Firebase] Auth state changed:', user ? 'User logged in' : 'No user');
        setUser(user);
        setIsLoading(false);
        if (user) {
          setIsConnected(true);
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('[Firebase] Auth initialization error:', err);
      setError('Failed to initialize authentication. Please restart the app.');
    }
  }, []);

  // Sign in anonymously if no user
  const signInAnonymouslyIfNeeded = async () => {
    if (!user) {
      try {
        console.log('[Firebase] Signing in anonymously...');
        const userCredential = await signInAnonymously(auth);
        console.log('[Firebase] Signed in anonymously:', userCredential.user.uid);
        return userCredential.user.uid;
      } catch (error) {
        console.error('[Firebase] Error signing in anonymously:', error);
        setError('Failed to connect to Firebase. Please check your internet connection.');
        return null;
      }
    }
    return user.uid;
  };

  // Enhance createRoom in FirebaseContext.js
  const createRoom = async (playerName, gameSettings) => {
    try {
      const userId = await signInAnonymouslyIfNeeded();
      
      if (!userId) {
        throw new Error('Authentication failed');
      }
      
      console.log('[Firebase] Creating room with player:', playerName, 'on platform:', Platform.OS);
      
      // Generate a room code (6 alphanumeric characters) and ensure uppercase
      const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      console.log('[Firebase] Generated room code:', roomCode);
      
      const roomRef = ref(database, `rooms/${roomCode}`);
      const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
      
      // Set up game room data
      await set(roomRef, {
        roomCode,
        hostId: userId,
        createdAt: serverTimestamp(),
        gameStatus: 'waiting',
        gameSettings,
      });
      
      // Add host as first player with platform info
      await set(playerRef, {
        id: userId,
        name: playerName,
        isHost: true,
        joinedAt: serverTimestamp(),
        isConnected: true,
        platform: Platform.OS,
        score: 0,
      });
      
      // Setup disconnect handling
      const onDisconnectRef = onDisconnect(playerRef);
      await onDisconnectRef.update({ isConnected: false });
      
      setCurrentRoom(roomCode);
      console.log('[Firebase] Room created successfully:', roomCode);
      return roomCode;
    } catch (error) {
      console.error('[Firebase] Error creating room:', error);
      setError(`Failed to create room: ${error.message}`);
      throw error;
    }
  };

  // Enhanced joinRoom function for FirebaseContext.js
  const joinRoom = async (roomCode, playerName) => {
    if (!roomCode || !playerName) {
      console.error('[Firebase] Missing room code or player name');
      setError('Room code and player name are required');
      return Promise.reject(new Error('Room code and player name are required'));
    }
    
    try {
      console.log('[Firebase] Joining room:', roomCode, 'as player:', playerName, 'on platform:', Platform.OS);
      const userId = await signInAnonymouslyIfNeeded();
      
      if (!userId) {
        console.error('[Firebase] Authentication failed when joining room');
        throw new Error('Authentication failed');
      }
      
      // Format room code to uppercase and trim whitespace
      roomCode = roomCode.toUpperCase().trim();
      console.log('[Firebase] Formatted room code:', roomCode);
      
      const roomRef = ref(database, `rooms/${roomCode}`);
      console.log('[Firebase] Room ref path:', roomRef.toString());
      
      return new Promise((resolve, reject) => {
        onValue(roomRef, async (snapshot) => {
          try {
            console.log('[Firebase] Room snapshot exists:', snapshot.exists());
            const roomData = snapshot.val();
            console.log('[Firebase] Room data:', roomData ? 'Found' : 'Not found');
            
            if (!roomData) {
              console.error('[Firebase] Room not found:', roomCode);
              reject(new Error('Room not found'));
              return;
            }
            
            console.log('[Firebase] Room status:', roomData.gameStatus);
            if (roomData.gameStatus !== 'waiting') {
              console.error('[Firebase] Game already started in room:', roomCode);
              reject(new Error('Game already started'));
              return;
            }
            
            // Add player to the room with platform info
            const playerRef = ref(database, `rooms/${roomCode}/players/${userId}`);
            console.log('[Firebase] Adding player to room at:', playerRef.toString());
            
            await set(playerRef, {
              id: userId,
              name: playerName,
              isHost: false,
              joinedAt: serverTimestamp(),
              isConnected: true,
              platform: Platform.OS,
              score: 0,
            });
            
            // Setup disconnect handling
            const onDisconnectRef = onDisconnect(playerRef);
            await onDisconnectRef.update({ isConnected: false });
            
            setCurrentRoom(roomCode);
            console.log('[Firebase] Successfully joined room:', roomCode);
            resolve(roomCode);
          } catch (error) {
            console.error('[Firebase] Error in room snapshot handler:', error);
            reject(error);
          }
        }, {
          onlyOnce: true
        });
      });
    } catch (error) {
      console.error('[Firebase] Error joining room:', error);
      setError(`Failed to join room: ${error.message}`);
      throw error;
    }
  };

  // Leave a room
  const leaveRoom = async () => {
    if (!currentRoom || !user) {
      console.log('[Firebase] No room to leave or user not authenticated');
      return;
    }
    
    try {
      console.log('[Firebase] Leaving room:', currentRoom);
      const playerRef = ref(database, `rooms/${currentRoom}/players/${user.uid}`);
      
      // Get room data to check if user is host
      const roomRef = ref(database, `rooms/${currentRoom}`);
      const roomSnapshot = await get(roomRef);
      const roomData = roomSnapshot.val();
      
      if (!roomData) {
        console.log('[Firebase] Room no longer exists');
        setCurrentRoom(null);
        return;
      }
      
      // Remove player from room
      await remove(playerRef);
      
      // If user is host, delete the room or transfer host status
      if (roomData.hostId === user.uid) {
        const playersRef = ref(database, `rooms/${currentRoom}/players`);
        const playersSnapshot = await get(playersRef);
        const players = playersSnapshot.val();
        
        if (players && Object.keys(players).length > 0) {
          // Transfer host status to another player
          const newHostId = Object.keys(players)[0];
          console.log('[Firebase] Transferring host status to:', newHostId);
          await update(ref(database, `rooms/${currentRoom}`), {
            hostId: newHostId
          });
          await update(ref(database, `rooms/${currentRoom}/players/${newHostId}`), {
            isHost: true
          });
        } else {
          // No players left, remove the room
          console.log('[Firebase] No players left, removing room');
          await remove(roomRef);
        }
      }
      
      setCurrentRoom(null);
      console.log('[Firebase] Successfully left room');
    } catch (error) {
      console.error('[Firebase] Error leaving room:', error);
      setError(`Failed to leave room: ${error.message}`);
    }
  };

  // New method to force remove a player from a room (host only)
  const removePlayerFromRoom = async (playerId) => {
    if (!currentRoom || !user || !gameState || gameState.hostId !== user.uid) {
      console.error('[Firebase] Cannot remove player: Not host or missing data');
      return;
    }
    
    try {
      console.log('[Firebase] Removing player:', playerId, 'from room:', currentRoom);
      const playerRef = ref(database, `rooms/${currentRoom}/players/${playerId}`);
      await remove(playerRef);
      console.log('[Firebase] Successfully removed player from room');
      return true;
    } catch (error) {
      console.error('[Firebase] Error removing player from room:', error);
      setError(`Failed to remove player: ${error.message}`);
      return false;
    }
  };

  // 🚀 ENHANCED startGame method that accepts and stores questions
  const startGame = async (gameMode, packName, questions, timeLimit, rounds = 5) => {
    if (!currentRoom || !user) {
      console.error('[Firebase] Cannot start game: No room or user');
      throw new Error('No active room or user not authenticated');
    }
    
    // Validate required parameters
    if (!gameMode || !packName || !Array.isArray(questions) || questions.length === 0) {
      console.error('[Firebase] Invalid game parameters:', { gameMode, packName, questionsLength: questions?.length });
      throw new Error('Invalid game parameters: missing gameMode, packName, or questions');
    }
    
    try {
      console.log('[Firebase] Starting game in room:', currentRoom);
      console.log('[Firebase] Game settings:', { gameMode, packName, timeLimit, rounds, questionsCount: questions.length });
      
      // Limit questions to the specified number of rounds
      const gameQuestions = questions.slice(0, rounds);
      
      // Prepare game data with questions
      const gameData = {
        gameMode,
        packName,
        packId: packName, // Using packName as ID for compatibility
        packDisplayName: packName,
        questions: gameQuestions, // 🎯 Store questions in Firebase
        timeLimit,
        rounds,
        totalQuestions: gameQuestions.length,
        createdAt: new Date().toISOString()
      };
      
      const roomRef = ref(database, `rooms/${currentRoom}`);
      
      // Update room with game data and start the game
      await update(roomRef, {
        gameStatus: 'playing',
        currentQuestionIndex: 0,
        gameData, // 🎯 This now includes questions array
        startedAt: serverTimestamp()
      });
      
      console.log('[Firebase] ✅ Game started successfully with', gameQuestions.length, 'questions');
      console.log('[Firebase] ✅ Questions stored in Firebase at: rooms/' + currentRoom + '/gameData/questions');
      
      return true;
    } catch (error) {
      console.error('[Firebase] ❌ Error starting game:', error);
      setError(`Failed to start game: ${error.message}`);
      throw error;
    }
  };

  // Listen for room updates - Enhanced with dare and vote tracking
  useEffect(() => {
    if (!currentRoom) return;
    
    try {
      console.log('[Firebase] Setting up listeners for room:', currentRoom);
      const roomRef = ref(database, `rooms/${currentRoom}`);
      const playersRef = ref(database, `rooms/${currentRoom}/players`);
      const dareRef = ref(database, `rooms/${currentRoom}/currentDare`);
      const dareVotesRef = ref(database, `rooms/${currentRoom}/dareVotes`);
      
      const roomUnsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log(`[Firebase] Room update received: status=${data.gameStatus}, player=${user?.uid === data.hostId ? 'HOST' : 'CLIENT'}`);
          
          // 🎯 Log questions sync info
          if (data.gameData?.questions) {
            console.log(`[Firebase] ✅ Questions synced: ${data.gameData.questions.length} questions available`);
          }
          
          // Log countdown state if available
          if (data.countdown) {
            console.log(`[Firebase] Countdown state received:`, data.countdown);
          }
          
          setGameState(data);
        } else {
          // Room was deleted
          console.log('[Firebase] Room no longer exists, resetting state');
          setCurrentRoom(null);
          setGameState(null);
          setPlayers({});
          if (Platform.OS === 'ios') {
            Alert.alert('Room Closed', 'The game room has been closed by the host.');
          }
        }
      });
      
      const playersUnsubscribe = onValue(playersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPlayers(data);
        } else {
          setPlayers({});
        }
      });
      
      // New listener for currentDare
      const dareUnsubscribe = onValue(dareRef, (snapshot) => {
        const data = snapshot.val();
        console.log('[Firebase] Current dare update:', data);
        setGlobalDare(data);
      });
      
      // New listener for dareVotes
      const votesUnsubscribe = onValue(dareVotesRef, (snapshot) => {
        const data = snapshot.val() || {};
        console.log('[Firebase] Dare votes update:', data);
        setDareVotes(data);
      });
      
      return () => {
        console.log('[Firebase] Cleaning up room listeners');
        roomUnsubscribe();
        playersUnsubscribe();
        dareUnsubscribe();
        votesUnsubscribe();
      };
    } catch (error) {
      console.error('[Firebase] Error setting up room listeners:', error);
      setError(`Failed to connect to room: ${error.message}`);
    }
  }, [currentRoom, user?.uid]);

  // Update game state with enhanced logging
  const updateGameState = async (updates) => {
    if (!currentRoom) {
      console.error('[Firebase] Cannot update game: No active room');
      return;
    }
    
    try {
      // Add enhanced logging for important updates
      if (updates.countdown) {
        console.log('[Firebase] Updating countdown state:', updates.countdown);
      }
      if (updates.gameStatus) {
        console.log('[Firebase] Updating game status to:', updates.gameStatus);
      }
      if (updates.performingDare !== undefined) {
        console.log('[Firebase] Updating dare state:', updates.performingDare);
      }
      
      const gameStateRef = ref(database, `rooms/${currentRoom}`);
      await update(gameStateRef, updates);
      return true;
    } catch (error) {
      console.error('[Firebase] Error updating game state:', error);
      setError(`Failed to update game: ${error.message}`);
      return false;
    }
  };

  // Update player data
  const updatePlayerData = async (updates, playerId = null) => {
    if (!currentRoom || !user) {
      console.error('[Firebase] Cannot update player: No room or user');
      return;
    }
    
    try {
      const targetId = playerId || user.uid;
      console.log('[Firebase] Updating player data for', targetId, ':', updates);
      const playerRef = ref(database, `rooms/${currentRoom}/players/${targetId}`);
      await update(playerRef, updates);
      return true;
    } catch (error) {
      console.error('[Firebase] Error updating player data:', error);
      setError(`Failed to update player data: ${error.message}`);
      return false;
    }
  };

  // Submit answer
  const submitAnswer = async (answer, isCorrect) => {
    if (!currentRoom || !user || !gameState) {
      console.error('[Firebase] Cannot submit answer: Missing required state');
      return;
    }
    
    try {
      console.log('[Firebase] Submitting answer:', answer, 'correct:', isCorrect);
      const playerRef = ref(database, `rooms/${currentRoom}/players/${user.uid}`);
      const answerRef = ref(database, `rooms/${currentRoom}/answers/${gameState.currentQuestionIndex}/${user.uid}`);
      
      // Record the answer
      await set(answerRef, {
        playerId: user.uid,
        answer,
        isCorrect,
        timestamp: serverTimestamp()
      });
      
      // Update player score if correct
      if (isCorrect) {
        const currentPlayerData = players[user.uid] || {};
        const currentScore = currentPlayerData.score || 0;
        await update(playerRef, {
          score: currentScore + 1
        });
      }

      // Check if all players have answered
      const playersCount = Object.keys(players).length;
      const answersRef = ref(database, `rooms/${currentRoom}/answers/${gameState.currentQuestionIndex}`);
      const answersSnapshot = await get(answersRef);
      const answers = answersSnapshot.val() || {};
      
      // If host and all players answered, move to next question
      if (gameState.hostId === user.uid && Object.keys(answers).length >= playersCount) {
        console.log('[Firebase] All players answered, advancing game');
        const nextQuestionIndex = gameState.currentQuestionIndex + 1;
        if (gameState.gameData && nextQuestionIndex < gameState.gameData.questions.length) {
          await updateGameState({
            currentQuestionIndex: nextQuestionIndex
          });
        } else {
          // Game is over
          console.log('[Firebase] Game complete');
          await updateGameState({
            gameStatus: 'finished',
            finishedAt: serverTimestamp()
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('[Firebase] Error submitting answer:', error);
      setError(`Failed to submit answer: ${error.message}`);
      return false;
    }
  };

  // Generate a random dare and store it in Firebase
  const generateAndSetDare = async () => {
    if (!currentRoom) {
      console.error('[Firebase] Cannot set dare: No active room');
      return null;
    }
    
    try {
      // Import dares from your local file
      const daresData = require('../../dares/dare.json');
      
      // Get a random dare
      const randomIndex = Math.floor(Math.random() * daresData.length);
      const selectedDare = daresData[randomIndex];
      
      console.log('[Firebase] Setting new dare:', selectedDare);
      
      // Store the dare in Firebase for all clients
      const dareRef = ref(database, `rooms/${currentRoom}/currentDare`);
      await set(dareRef, {
        text: selectedDare,
        timestamp: serverTimestamp(),
        pointValue: 250
      });
      
      return selectedDare;
    } catch (error) {
      console.error('[Firebase] Error generating dare:', error);
      setError(`Failed to generate dare: ${error.message}`);
      return null;
    }
  };

  // Submit a vote for a dare
  const submitDareVote = async (isCompleted) => {
    if (!currentRoom || !user) {
      console.error('[Firebase] Cannot vote: No room or user');
      return false;
    }
    
    try {
      console.log('[Firebase] Submitting dare vote:', isCompleted);
      
      // Store vote in Firebase
      const voteRef = ref(database, `rooms/${currentRoom}/dareVotes/${user.uid}`);
      await set(voteRef, isCompleted);
      
      return true;
    } catch (error) {
      console.error('[Firebase] Error submitting vote:', error);
      setError(`Failed to submit vote: ${error.message}`);
      return false;
    }
  };

  // Check if all players have voted and process result
  const processDareVotes = async () => {
    if (!currentRoom || !gameState || gameState.hostId !== user?.uid) {
      console.error('[Firebase] Cannot process votes: Not host or no room');
      return false;
    }
    
    try {
      // Get all votes
      const votesRef = ref(database, `rooms/${currentRoom}/dareVotes`);
      const votesSnapshot = await get(votesRef);
      const votes = votesSnapshot.val() || {};
      
      // Get all players
      const playersRef = ref(database, `rooms/${currentRoom}/players`);
      const playersSnapshot = await get(playersRef);
      const players = playersSnapshot.val() || {};
      
      // Check if all players have voted
      const playerIds = Object.keys(players);
      const votedIds = Object.keys(votes);
      
      if (votedIds.length >= playerIds.length) {
        console.log('[Firebase] All players have voted, processing result');
        
        // Count positive votes
        const positiveVotes = Object.values(votes).filter(v => v === true).length;
        const majority = positiveVotes >= Math.ceil(playerIds.length / 2);
        
        // Get the player who performed the dare
        const darePlayerId = gameState.currentDarePlayerId;
        
        // Award points if majority says dare was completed
        if (majority && darePlayerId) {
          const playerRef = ref(database, `rooms/${currentRoom}/players/${darePlayerId}`);
          const playerSnapshot = await get(playerRef);
          const playerData = playerSnapshot.val();
          
          if (playerData) {
            const currentScore = playerData.score || 0;
            const darePoints = 250; // Default dare points
            
            // Update player score
            await update(playerRef, {
              score: currentScore + darePoints
            });
            
            console.log('[Firebase] Awarded dare points to player:', darePlayerId);
          }
        }
        
        // Clear dare and votes
        await update(ref(database, `rooms/${currentRoom}`), {
          currentDare: null,
          dareVotes: null,
          performingDare: false,
          currentDarePlayerId: null
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Firebase] Error processing votes:', error);
      setError(`Failed to process votes: ${error.message}`);
      return false;
    }
  };

  // Get a list of players sorted by score
  const getLeaderboard = () => {
    if (!players) return [];
    
    return Object.values(players)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  };

  // Clear any errors
  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    isLoading,
    isConnected,
    currentRoom,
    players,
    gameState,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame, // 🚀 Enhanced to handle questions
    updateGameState,
    updatePlayerData,
    submitAnswer,
    getLeaderboard,
    clearError,
    removePlayerFromRoom,
    isHost: gameState?.hostId === user?.uid,
    // Add new methods and state for multiplayer
    globalDare,
    dareVotes,
    generateAndSetDare,
    submitDareVote,
    processDareVotes
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => useContext(FirebaseContext);