import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  ImageBackground,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign, MaterialCommunityIcons, FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFirebase } from '../../Context/multiplayer/FirebaseContext';
import { useGame } from '../../Context/GameContext';
import * as Haptics from 'expo-haptics';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Timer configurations
const TIMER_CONFIGS = {
  10: { baseScore: 250, label: "10s" },
  20: { baseScore: 500, label: "20s" },
  30: { baseScore: 750, label: "30s" }
};

// Maximum number of players allowed
const MAX_PLAYERS = 8;

// For animated effects
const PLAYER_COLORS = [
  '#FFD700', // Gold
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#FF5722', // Deep Orange
  '#00BCD4', // Cyan
  '#FF9800', // Orange
  '#E91E63', // Pink
];

// Debug flag - set to false in production
const DEBUG_MODE = false;

const LobbyScreen = ({ navigation, route }) => {
  // Get Firebase context
  const firebase = useFirebase();
  
  // Extract parameters from route
  const { isHost = false, roomCode, selectedPack: routeSelectedPack, packName: routePackName } = route.params || {};
  
  // Access game context
  const gameContext = useGame();
  
  // Use ref to track if sync has been performed
  const syncPerformedRef = useRef(false);
  
  // Animation values - separated by useNativeDriver type
  const spinAnim = useRef(new Animated.Value(0)).current; // native (transforms)
  const countdownAnim = useRef(new Animated.Value(1)).current; // native (transforms)
  const staticLightsAnim = 0.1; // Reduced opacity for better touch handling

  // DEBUG: Add debug state
  const [debugTouches, setDebugTouches] = useState([]);
  const [debugInfo, setDebugInfo] = useState({
    lastPressedButton: 'None',
    isOverlayActive: false,
  });

  // Local state
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [isGameStarting, setIsGameStarting] = useState(false);
  const [usedNames, setUsedNames] = useState([]);
  const [selectedPackName, setSelectedPackName] = useState(routePackName || '');
  const [selectedPack, setSelectedPack] = useState(routeSelectedPack || null);
  const [showPlayerLimitWarning, setShowPlayerLimitWarning] = useState(false);
  const [playerAnimations, setPlayerAnimations] = useState({});
  const [countdown, setCountdown] = useState(null);
  const [removedByHost, setRemovedByHost] = useState(false);

  // Get all players and the current user from Firebase
  const players = firebase?.players || {};
  const user = firebase?.user;
  const gameState = firebase?.gameState || {};
  const currentUserIsHost = isHost || (gameState?.hostId === user?.uid);

  // DEBUG: Add comprehensive logging on component mount
  useEffect(() => {
    if (DEBUG_MODE) {
      console.log('========== DEBUG LOG START ==========');
      console.log('Firebase Context:', firebase ? 'Available' : 'Unavailable');
      console.log('Game Context:', gameContext ? 'Available' : 'Unavailable');
      console.log('Route Params:', route.params);
      console.log('Current User ID:', user?.uid);
      console.log('Is Host:', currentUserIsHost);
      console.log('Game State:', gameState);
      console.log('Game State Status:', gameState?.gameStatus);
      console.log('Selected Pack:', selectedPack);
      console.log('Selected Pack Name:', selectedPackName);
      console.log('Is Game Starting:', isGameStarting);
      console.log('========== DEBUG LOG END ==========');
    }
  }, []);

  // DEBUG: Track overlay state changes
  useEffect(() => {
    if (DEBUG_MODE) {
      setDebugInfo(prev => ({
        ...prev,
        isOverlayActive: isGameStarting,
      }));
      console.log('isGameStarting changed to:', isGameStarting);
    }
  }, [isGameStarting]);

  useEffect(() => {
    if (firebase && firebase.gameState && firebase.gameState.gameData) {
      console.log('[LobbyScreen] Firebase gameState changed:', firebase.gameState.gameData);
      
      const { packName, packId, packDisplayName } = firebase.gameState.gameData;
      
      if (packName || packId) {
        console.log('[LobbyScreen] Updating pack selection from Firebase:', 
                    packId || packName, packDisplayName);
        
        // Update the local state with the pack from Firebase
        setSelectedPack(packId || packName);
        setSelectedPackName(packDisplayName || packName || packId);
      }
    }
  }, [firebase?.gameState?.gameData]);

  // Get player array for easier rendering - memoized to avoid excessive recalculations
  const playerArray = React.useMemo(() => {
    console.log('[LobbyScreen] Raw player data:', players);
    
    return Object.entries(players).map(([id, player], index) => {
      console.log(`[LobbyScreen] Player ${player.name} platform:`, player.platform || Platform.OS);
      
      return {
        id,
        name: player.name,
        isHost: player.isHost,
        ready: player.ready || false,
        isConnected: player.isConnected !== false,
        platform: player.platform || Platform.OS,
        color: PLAYER_COLORS[index % PLAYER_COLORS.length], // Assign color based on position
        isSimulated: false
      };
    });
  }, [players]);

  // Check if maximum number of players has been reached
  const isPlayerLimitReached = playerArray.length >= MAX_PLAYERS;

  // Get current game settings from Firebase
  const gameSettings = React.useMemo(() => {
    console.log('[LobbyScreen] Game settings from Firebase:', gameState?.gameSettings);
    return gameState?.gameSettings || {
      timeLimit: 20,
      rounds: 5
    };
  }, [gameState?.gameSettings]);

  // Create spin transform for icons - NATIVE
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Start animations when screen loads
  useEffect(() => {
    // Spinning animation (for icons or elements) - NATIVE
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true // Can be true for transforms
      })
    ).start();
  }, []);
    
  // Track new players and animate their entrance
  useEffect(() => {
    // Track previous length
    const prevLength = Object.keys(playerAnimations).length;
    
    // If a new player has joined
    if (playerArray.length > prevLength) {
      const newPlayerEntries = {};
      
      // Create animations for players that don't have one
      playerArray.forEach(player => {
        if (!playerAnimations[player.id]) {
          newPlayerEntries[player.id] = {
            translateX: new Animated.Value(-300),
            opacity: new Animated.Value(0)
          };
          
          // Start animation for this new player - NATIVE
          Animated.spring(newPlayerEntries[player.id].translateX, {
            toValue: 0,
            friction: 6,
            tension: 40,
            useNativeDriver: true // Can use native driver for transforms
          }).start();
          
          Animated.timing(newPlayerEntries[player.id].opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true // Can use native driver for opacity
          }).start();
          
          // Haptic feedback on Android when someone joins (subtle)
          if (Platform.OS === 'android') {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
              console.log('Haptics not supported');
            }
          }
        }
      });
      
      // Update animations state
      if (Object.keys(newPlayerEntries).length > 0) {
        setPlayerAnimations(prev => ({...prev, ...newPlayerEntries}));
      }
    }
  }, [playerArray]);

  // Listen for player removed status
  useEffect(() => {
    // Check if current user's removal flag is set in Firebase
    if (gameState?.removedPlayers && gameState.removedPlayers[user?.uid]) {
      setRemovedByHost(true);
      
      // Show alert about being removed
      Alert.alert(
        "Removed from Game",
        "The host has removed you from this game.",
        [
          { 
            text: "OK", 
            onPress: () => {
              navigation.navigate('Home');
            }
          }
        ],
        { cancelable: false }
      );
    }
  }, [gameState?.removedPlayers, user?.uid, navigation]);

  // Listen for game state changes to handle non-host navigation
  useEffect(() => {
    if (gameState && gameState.gameStatus === 'playing' && !currentUserIsHost && !isGameStarting) {
      console.log('[LobbyScreen] Game started by host, client navigating...');
      setIsGameStarting(true);
      
      // Show feedback for Android users
      if (Platform.OS === 'android') {
        ToastAndroid.show('Game starting!', ToastAndroid.SHORT);
      }
      
      // Navigate to the question screen with the game settings
      setTimeout(() => {
        navigation.navigate('MultiplayerQuestionScreen', {
          selectedPack: gameState.gameData?.packName,
          packName: gameState.gameData?.packDisplayName || gameState.gameData?.packName,
          numberOfQuestions: gameState.gameSettings?.rounds || 5,
          timeLimit: gameState.gameSettings?.timeLimit || 20
        });
      }, 500);
    }
  }, [gameState?.gameStatus, currentUserIsHost, navigation, isGameStarting, gameState]);

  // Show warning when player limit is reached (for host only)
  useEffect(() => {
    if (isPlayerLimitReached && currentUserIsHost && !showPlayerLimitWarning) {
      setShowPlayerLimitWarning(true);
      Alert.alert(
        "Player Limit Reached",
        `The maximum of ${MAX_PLAYERS} players has been reached. No more players can join this game.`,
        [{ text: "OK", onPress: () => setShowPlayerLimitWarning(false) }]
      );
    }
  }, [isPlayerLimitReached, currentUserIsHost, showPlayerLimitWarning]);

  // Check for pack info from route params when returning from TriviaPackSelection
  useEffect(() => {
    if (route.params?.selectedPack) {
      setSelectedPack(route.params.selectedPack);
      setSelectedPackName(route.params.packName || route.params.selectedPack);
      
      // If we're in Firebase multiplayer, ensure the game state is updated
      if (firebase && firebase.updateGameState && currentUserIsHost) {
        firebase.updateGameState({
          gameData: {
            ...firebase.gameState?.gameData,
            packName: route.params.selectedPack,
            packId: route.params.selectedPack, // Using the name as ID for compatibility
            packDisplayName: route.params.packName || route.params.selectedPack
          }
        }).catch(error => {
          console.error('Error updating Firebase with pack selection:', error);
        });
      }
    }
  }, [route.params?.selectedPack, route.params?.packName, firebase, currentUserIsHost]);

  // Check for pack info in Firebase gameState
  useEffect(() => {
    if (gameState?.gameData?.packName && !selectedPack) {
      console.log('[LobbyScreen] Received pack from Firebase:', gameState.gameData.packName);
      setSelectedPack(gameState.gameData.packName);
      setSelectedPackName(gameState.gameData.packDisplayName || gameState.gameData.packName);
    }
  }, [gameState?.gameData]);

  // Sync players between contexts
  useEffect(() => {
    if (gameContext && !syncPerformedRef.current && playerArray.length > 0) {
      // Get player names
      const playerNames = playerArray.map(player => player.name);
      
      if (playerNames.length > 0 && gameContext.setPlayers) {
        // Update Game context with player names
        console.log('Syncing player names to game context:', playerNames);
        gameContext.setPlayers(playerNames);
        syncPerformedRef.current = true;
      }
    }
  }, [gameContext, playerArray]);

  // Check if all players are ready
  const checkAllPlayersReady = useCallback(() => {
    if (playerArray.length > 1) {
      const allReady = playerArray.every(player => 
        player.isHost || player.ready
      );
      setAllPlayersReady(allReady);
    } else {
      setAllPlayersReady(false);
    }
    
    // Update used names list for quick add
    setUsedNames(playerArray.map(player => player.name));
    
    // Update my ready status
    const myPlayer = playerArray.find(player => player.id === user?.uid);
    if (myPlayer) {
      setIsReady(myPlayer.ready || false);
    }
  }, [playerArray, user?.uid]);

  // Use a separate effect to call the memoized function
  useEffect(() => {
    checkAllPlayersReady();
  }, [checkAllPlayersReady]);

 // DEBUG: Handler for debug touch tracking
 const handleDebugTouch = (evt, buttonName) => {
  if (!DEBUG_MODE) return;
  
  const touch = evt.nativeEvent.touches[0];
  const newTouch = {
    id: Date.now(),
    x: touch.pageX,
    y: touch.pageY,
    buttonName,
    timestamp: Date.now()
  };
  
  console.log(`DEBUG: Touch on ${buttonName} at ${newTouch.x},${newTouch.y}`);
  setDebugTouches(prev => [...prev, newTouch]);
  setDebugInfo(prev => ({...prev, lastPressedButton: buttonName}));
  
  // Remove after 3 seconds
  setTimeout(() => {
    setDebugTouches(prev => prev.filter(t => t.id !== newTouch.id));
  }, 3000);
};

// DEBUG: Reset function for emergency debugging
const handleDebugReset = () => {
  // Reset critical state values to defaults
  setIsGameStarting(false);
  setCountdown(null);
  
  if (Platform.OS === 'android') {
    ToastAndroid.show('Debug: State Reset', ToastAndroid.SHORT);
  } else {
    Alert.alert('Debug', 'State has been reset');
  }
};

const startCountdown = () => {
  // Guard against double-start
  if (countdown !== null) {
    console.log('Countdown already in progress, not starting another one');
    return;
  }
  
  // If host, update the game state in Firebase to trigger countdown for all players
  if (currentUserIsHost && firebase) {
    if (typeof firebase.updateGameState === 'function') {
      // Set the initial countdown value and timestamp in Firebase
      firebase.updateGameState({
        countdown: {
          value: 3,
          startTimestamp: new Date().toISOString(),
          inProgress: true
        }
      }).catch(error => {
        console.error('Error starting countdown:', error);
        setIsGameStarting(false);
      });
    } else {
      console.error("Firebase updateGameState function not available", firebase);
      setIsGameStarting(false);
      Alert.alert('Connection Error', 'Unable to start game. Please try again.');
      return;
    }
  }
  
  // Start local countdown (will be overridden by Firebase for non-host players)
  setCountdown(3);
  
  // Animate the first number
  animateCountdownNumber(3);
  
  // This function manages the animation for countdown numbers
  function animateCountdownNumber(number) {
    // Reset animation value
    countdownAnim.setValue(0.5);
    
    // Scale up and down
    Animated.sequence([
      Animated.timing(countdownAnim, {
        toValue: 1.5,
        duration: 500,
        easing: Easing.out(Easing.back),
        useNativeDriver: true
      }),
      Animated.timing(countdownAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true
      })
    ]).start();
    
    // Haptic feedback for each countdown number
    if (Platform.OS === 'android') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptics not supported');
      }
    }
  }
};
  
 // Add this effect to monitor Firebase countdown state
useEffect(() => {
  // Skip if no Firebase or game state
  if (!firebase || !gameState) return;
  
  // Check if countdown is in progress from Firebase
  if (gameState.countdown && gameState.countdown.inProgress) {
    console.log('[LobbyScreen] Countdown in progress detected from Firebase:', gameState.countdown);
    
    // Parse the initial countdown value
    const countdownValue = gameState.countdown.value;
    
    // Set local state to show countdown
    setIsGameStarting(true);
    setCountdown(countdownValue);
    
    // Animate the first number immediately
    const animateCountdownNumber = (number) => {
      // Reset animation value
      countdownAnim.setValue(0.5);
      
      // Scale up and down
      Animated.sequence([
        Animated.timing(countdownAnim, {
          toValue: 1.5,
          duration: 500,
          easing: Easing.out(Easing.back),
          useNativeDriver: true
        }),
        Animated.timing(countdownAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ]).start();
      
      // Haptic feedback
      if (Platform.OS === 'android') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
          console.log('Haptics not supported');
        }
      }
    };
    
    animateCountdownNumber(countdownValue);
    
    // Calculate time elapsed since start timestamp if provided
    let timeOffset = 0;
    if (gameState.countdown.startTimestamp) {
      const startTime = new Date(gameState.countdown.startTimestamp);
      const currentTime = new Date();
      timeOffset = Math.floor((currentTime - startTime) / 1000);
      console.log('[LobbyScreen] Time offset calculated:', timeOffset);
    }
    
    // Adjust countdown number based on elapsed time
    let adjustedCountdown = Math.max(countdownValue - timeOffset, 0);
    console.log('[LobbyScreen] Adjusted countdown:', adjustedCountdown);
    
    // If we're already past the initial number, but not finished
    if (adjustedCountdown < countdownValue && adjustedCountdown > 0) {
      setCountdown(adjustedCountdown);
      animateCountdownNumber(adjustedCountdown);
    }
    
    // If we've already completed the countdown, go straight to the game
    if (adjustedCountdown <= 0) {
      console.log('[LobbyScreen] Countdown already completed, navigating directly');
      navigateToGame();
      return;
    }
    
    // Schedule the subsequent numbers and game start
    const timer1 = setTimeout(() => {
      setCountdown(2);
      animateCountdownNumber(2);
      
      const timer2 = setTimeout(() => {
        setCountdown(1);
        animateCountdownNumber(1);
        
        const timer3 = setTimeout(() => {
          navigateToGame();
        }, 1000);
        
        return () => clearTimeout(timer3);
      }, 1000);
      
      return () => clearTimeout(timer2);
    }, 1000);
    
    return () => clearTimeout(timer1);
  }
}, [gameState?.countdown]);

// Helper function to navigate to game
const navigateToGame = () => {
  // Make sure we have the latest players in game context
  const playerNames = playerArray.map(player => player.name);
  if (gameContext && gameContext.setPlayers) {
    gameContext.setPlayers(playerNames);
  }
  
  // Only the host should update the Firebase game state
  if (currentUserIsHost && firebase && firebase.updateGameState) {
    firebase.updateGameState({
      gameData: {
        ...firebase.gameState?.gameData,
        packName: selectedPack,
        packId: selectedPack,
        packDisplayName: selectedPackName
      },
      gameStatus: 'playing',
      startedAt: new Date().toISOString(),
      // Clear countdown state
      countdown: {
        inProgress: false
      }
    }).then(() => {
      navigation.navigate('MultiplayerQuestionScreen', {
        selectedPack: selectedPack,
        packName: selectedPackName,
        numberOfQuestions: gameSettings.rounds || 5,
        timeLimit: gameSettings.timeLimit || 20
      });
    }).catch(error => {
      setIsGameStarting(false);
      setCountdown(null);
      console.error('Error updating game state:', error);
      Alert.alert('Error', 'Failed to start the game. Please try again.');
    });
  } else {
    // Non-host clients also navigate
    navigation.navigate('MultiplayerQuestionScreen', {
      selectedPack: selectedPack,
      packName: selectedPackName,
      numberOfQuestions: gameSettings.rounds || 5,
      timeLimit: gameSettings.timeLimit || 20
    });
  }
};

// Function to handle player name editing
const handleEditName = (item) => {
  setEditingPlayer(item.id);
  setEditedName(item.name);
};

// Function to save edited player name
const handleSaveEdit = async () => {
  if (editedName.trim() === '') {
    Alert.alert('Invalid Name', 'Please enter a valid name.');
    return;
  }

  try {
    // Update player data in Firebase
    await firebase.updatePlayerData({
      name: editedName.trim()
    });
    
    setEditingPlayer(null);
    setEditedName('');
  } catch (error) {
    console.error('Error updating name:', error);
    Alert.alert('Error', 'Failed to update player name');
  }
};

// Function to toggle ready status
const handleToggleReady = async () => {
  if (!user) return;
  
  try {
    // Debug press info
    console.log('Toggle Ready button pressed. Current ready state:', isReady);
    
    // Update player ready status in Firebase
    await firebase.updatePlayerData({
      ready: !isReady
    });
  } catch (error) {
    console.error('Error toggling ready status:', error);
    Alert.alert('Error', 'Failed to update ready status');
  }
};

// Function to handle round count changes (Host only)
const handleRoundsChange = async (newRounds) => {
  if (!currentUserIsHost) return;
  
  try {
    // Debug press info
    console.log('Rounds change button pressed. Current:', gameSettings.rounds, 'New:', newRounds);
    
    // Update game settings in Firebase
    await firebase.updateGameState({
      gameSettings: {
        ...gameSettings,
        rounds: newRounds
      }
    });
  } catch (error) {
    console.error('Error updating rounds:', error);
    Alert.alert('Error', 'Failed to update game settings');
  }
};

// Function to handle timer selection (Host only)
const handleTimerSelect = async (seconds) => {
  if (!currentUserIsHost) return;
  
  try {
    // Debug press info
    console.log('Timer button pressed. Current:', gameSettings.timeLimit, 'New:', seconds);
    
    // Update game settings in Firebase
    await firebase.updateGameState({
      gameSettings: {
        ...gameSettings,
        timeLimit: seconds
      }
    });
  } catch (error) {
    console.error('Error updating timer:', error);
    Alert.alert('Error', 'Failed to update game settings');
  }
};

// Function to remove a player (Host only)
const handleRemovePlayer = (playerId, playerName) => {
  if (!currentUserIsHost || playerId === user?.uid) return;

  Alert.alert(
    "Remove Player",
    `Are you sure you want to remove ${playerName} from the game?`,
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive",
        onPress: async () => {
          try {
            // Update Firebase game state to flag player as removed
            const removedPlayers = gameState?.removedPlayers || {};
            removedPlayers[playerId] = true;
            
            await firebase.updateGameState({
              removedPlayers
            });
            
            // Force disconnect player from room
            await firebase.removePlayerFromRoom(playerId);
            
            // Show confirmation
            if (Platform.OS === 'android') {
              ToastAndroid.show(`${playerName} has been removed`, ToastAndroid.SHORT);
            } else {
              Alert.alert("Player Removed", `${playerName} has been removed from the game.`);
            }
          } catch (error) {
            console.error('Error removing player:', error);
            Alert.alert('Error', 'Failed to remove player from the game');
          }
        } 
      }
    ]
  );
};

const handleStartGame = () => {
  if (!currentUserIsHost) return;
  
  // Need a selected pack - check first!
  if (!selectedPack) {
    // Navigate to pack selection
    navigation.navigate('TriviaPackSelection', { fromMultiplayer: true });
    return;
  }
  
  // Minimum 2 players required
  if (playerArray.length < 2) {
    Alert.alert('Not Enough Players', 'You need at least 2 players to start the game.');
    return;
  }
  
  // All players should be ready
  if (!allPlayersReady) {
    Alert.alert('Players Not Ready', 'All players must be ready before starting the game.');
    return;
  }
  
  // Choose the first player (typically the first player in the array who isn't the host)
  let firstPlayerId = null;
  for (const player of playerArray) {
    if (!player.isHost) {
      firstPlayerId = player.id;
      break;
    }
  }
  
  // If no non-host player found, use the first player in the array
  if (!firstPlayerId && playerArray.length > 0) {
    firstPlayerId = playerArray[0].id;
  }
  
  // Update Firebase with the first player
  if (firebase && typeof firebase.updateGameState === 'function') {
    try {
      firebase.updateGameState({
        currentPlayerId: firstPlayerId,
        currentQuestionIndex: 0,  // Start at the first question
      });
      
      // Show loading state with a game show feel
      setIsGameStarting(true);
      
      // Start the synchronized countdown
      startCountdown();
    } catch (error) {
      console.error("Error updating game state:", error);
      Alert.alert('Error', 'Failed to start the game. Please try again.');
    }
  } else {
    // Debug information
    console.error("updateGameState not available:", 
      firebase ? "Firebase exists but function missing" : "Firebase object missing");
    Alert.alert('Error', 'Connection issue. Please try again or restart the app.');
  }
};

// Function to handle leaving the game
const handleLeave = () => {
  Alert.alert(
    'Leave Game',
    'Are you sure you want to leave this game?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await firebase.leaveRoom();
            navigation.navigate('Home');
          } catch (error) {
            console.error('Error leaving room:', error);
            navigation.navigate('Home');
          }
        }
      }
    ]
  );
};

// Add this focus listener to refresh data when returning to screen
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    console.log('[LobbyScreen] Screen focused, checking for updated pack data');
    
    // Force refresh from Firebase
    if (firebase && firebase.currentRoom && firebase.gameState?.gameData) {
      const { packName, packId, packDisplayName } = firebase.gameState.gameData;
      
      // Only update if we have valid data
      if (packId || packName) {
        console.log('[LobbyScreen] Refreshing pack selection on focus:', 
                  packId || packName, packDisplayName);
        
        // Update local state with the latest pack info
        setSelectedPack(packId || packName);
        setSelectedPackName(packDisplayName || packName || packId);
      }
    }
  });
  
  // Clean up listener on component unmount
  return unsubscribe;
}, [navigation, firebase]);

// Add this to ensure route params are properly handled regardless of Firebase state
useEffect(() => {
  if (route.params?.selectedPack) {
    console.log('[LobbyScreen] Route params updated with pack:', 
                route.params.selectedPack, route.params.packName);
    
    setSelectedPack(route.params.selectedPack);
    setSelectedPackName(route.params.packName || route.params.selectedPack);
  }
}, [route.params?.selectedPack, route.params?.packName]);


const handleSelectPack = () => {
  if (!currentUserIsHost) return;
  
  console.log('[LobbyScreen] Select Pack button pressed');
  
  // Store current state in a ref before navigation
  const savedStateRef = {
    roomCode: firebase?.currentRoom,
    isHost: currentUserIsHost,
    players: playerArray
  };
  
  // Use a direct push without the simulator wrapper
  // This ensures we go directly to the TriviaPackSelection screen
  navigation.push('TriviaPackSelection', { 
    fromMultiplayer: true,
    roomCode: firebase?.currentRoom,
    // Pass extra info to ensure we can return properly
    __fromLobby: true, 
    __timestamp: Date.now()
  });
};

// Render player platform indicator with animation
const renderPlatformIndicator = (playerPlatform, playerColor) => {
  // Default to current platform if not specified
  const platformToShow = playerPlatform || Platform.OS;
  
  // Apply player-specific color for platform icon
  const iconColor = playerColor || '#FFFFFF';
  
  if (platformToShow === 'ios') {
    return <FontAwesome name="apple" size={16} color={iconColor} style={styles.platformIcon} />;
  } else if (platformToShow === 'android') {
    return <FontAwesome name="android" size={16} color={iconColor} style={styles.platformIcon} />;
  }
  
  // If unknown, show generic icon
  return <FontAwesome name="mobile" size={16} color={iconColor} style={styles.platformIcon} />;
};

// Render an individual player item with game show styling
const renderPlayerItem = ({ item, index }) => {
  const isEditing = editingPlayer === item.id;
  const isCurrentUser = item.id === user?.uid;
  
  // Use player's assigned color for styling
  const playerColor = item.color;
  
  // Get or create animation values for this player
  const playerAnim = playerAnimations[item.id] || {
    translateX: new Animated.Value(0),
    opacity: new Animated.Value(1)
  };
  
  return (
    <Animated.View 
      style={[
        styles.playerItem,
        {
          backgroundColor: isCurrentUser 
            ? 'rgba(0, 0, 0, 0.7)'  // Darker background for current user
            : 'rgba(0, 0, 0, 0.6)', // Normal background for others
          borderLeftWidth: 4,
          borderLeftColor: playerColor,
          transform: [
            { translateX: playerAnim.translateX }
          ],
          opacity: playerAnim.opacity
        }
      ]}
    >
      {item.isHost && (
        <View style={[styles.hostBadge, { backgroundColor: playerColor }]}>
          <Text style={styles.hostBadgeText}>HOST</Text>
        </View>
      )}
      
      {isEditing ? (
        <View style={styles.editNameContainer}>
          <TextInput
            style={styles.editNameInput}
            value={editedName}
            onChangeText={setEditedName}
            autoFocus
            maxLength={15}
          />
          <TouchableOpacity
            style={[styles.saveNameButton, { backgroundColor: playerColor }]}
            onPress={handleSaveEdit}
            activeOpacity={0.7}
          >
            <AntDesign name="check" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.playerNameAndPlatform}>
            <Text 
              style={[
                styles.playerName, 
                item.ready && [styles.playerReady, { color: playerColor }],
                !item.isConnected && styles.disconnectedPlayer
              ]}
            >
              {item.name}
              {!item.isConnected && " (Disconnected)"}
            </Text>
            {renderPlatformIndicator(item.platform, playerColor)}
          </View>
          
          <View style={styles.playerControls}>
            {isCurrentUser && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditName(item)}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <FontAwesome name="pencil" size={18} color={playerColor} />
              </TouchableOpacity>
            )}
            
            {currentUserIsHost && !item.isHost && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemovePlayer(item.id, item.name)}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <AntDesign name="close" size={18} color="#FF5555" />
              </TouchableOpacity>
            )}
            
            {item.ready && (
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={playerColor}
                style={styles.readyIcon}
              />
            )}
          </View>
        </>
      )}
    </Animated.View>
  );
};

// Render game settings for non-host players with game show styling
const renderNonHostGameSettings = () => (
  <LinearGradient
    colors={['rgba(0,0,0,0.7)', 'rgba(25,25,112,0.9)']}
    style={styles.bottomContainer}
  >
    <View style={styles.gameInfoContainer}>
      {/* Pack Info Section - Read Only */}
      <View style={styles.settingRow}>
        <View style={styles.settingLabelContainer}>
          <MaterialCommunityIcons name="cards" size={20} color="#FFD700" />
          <Text style={styles.settingLabel}>Pack:</Text>
        </View>
        <View style={styles.gameInfoValue}>
          <Text style={styles.gameInfoValueText} numberOfLines={1}>
            {selectedPackName || 'Waiting for host...'}
          </Text>
        </View>
      </View>

      {/* Game Settings Row */}
      <View style={styles.settingsRow}>
        {/* Questions display */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <MaterialIcons name="quiz" size={20} color="#FFD700" />
            <Text style={styles.settingLabel}>Questions:</Text>
          </View>
          <View style={styles.gameInfoSmallValue}>
            <Text style={styles.gameInfoValueText}>{gameSettings.rounds}</Text>
          </View>
        </View>

        {/* Timer display */}
        <View style={styles.settingItem}>
          <View style={styles.settingLabelContainer}>
            <MaterialCommunityIcons name="timer" size={20} color="#FFD700" />
            <Text style={styles.settingLabel}>Timer:</Text>
          </View>
          <View style={styles.gameInfoSmallValue}>
            <Text style={styles.gameInfoValueText}>{gameSettings.timeLimit}s</Text>
          </View>
        </View>
      </View>
    </View>

    {/* Ready button or Waiting message based on ready state */}
    {isReady ? (
      <View style={styles.waitingContainer}>
        <Animated.View style={{ transform: [{ rotate: spin }], marginRight: 10 }}>
          <MaterialCommunityIcons name="autorenew" size={24} color="#FFD700" />
        </Animated.View>
        <Text style={styles.waitingText}>
          Waiting for host to start the game...
        </Text>
      </View>
    ) : (
      <TouchableOpacity
        style={styles.fullWidthReadyButton}
        onPress={handleToggleReady}
        activeOpacity={0.7}
        onTouchStart={(evt) => DEBUG_MODE && handleDebugTouch(evt, 'Ready Button')}
      >
        <LinearGradient
          colors={['#4CAF50', '#2E7D32']}
          style={styles.readyButtonGradient}
        >
          <Text style={styles.readyButtonText}>I'M READY!</Text>
        </LinearGradient>
      </TouchableOpacity>
    )}
  </LinearGradient>
);

// Render host controls with improved touch handling
const renderHostControls = () => (
  <LinearGradient
    colors={['rgba(0,0,0,0.7)', 'rgba(25,25,112,0.9)']}
    style={styles.bottomContainer}
  >
    {/* Pack Selection */}
    <TouchableOpacity 
      style={styles.packSelectionButton} 
      onPress={handleSelectPack}
      activeOpacity={0.7}
      onTouchStart={(evt) => DEBUG_MODE && handleDebugTouch(evt, 'Pack Selection')}
    >
      <LinearGradient
        colors={['#1A237E', '#3949AB']}
        style={styles.packSelectionGradient}
      >
        <View style={styles.packHeaderRow}>
          <MaterialCommunityIcons name="cards" size={24} color="#FFD700" />
          <Text style={styles.packSelectionLabel}>Trivia Pack</Text>
        </View>
        
        <View style={styles.packNameContainer}>
          <Text style={styles.packSelectionValue} numberOfLines={1}>
            {selectedPackName || 'Select a Pack'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FFD700" />
        </View>
      </LinearGradient>
    </TouchableOpacity>

    {/* Game Settings */}
    <View style={styles.hostSettingsContainer}>
      {/* Questions control */}
      <View style={styles.hostSettingItem}>
        <View style={styles.settingLabelContainer}>
          <MaterialIcons name="quiz" size={20} color="#FFD700" />
          <Text style={styles.settingLabel}>Questions</Text>
        </View>
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => handleRoundsChange(Math.max(1, gameSettings.rounds - 1))}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            activeOpacity={0.7}
            onTouchStart={(evt) => DEBUG_MODE && handleDebugTouch(evt, 'Decrease Questions')}
          >
            <LinearGradient colors={['#E53935', '#C62828']} style={styles.circleGradient}>
              <AntDesign name="minus" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.settingValueText}>{gameSettings.rounds}</Text>
          
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => handleRoundsChange(Math.min(20, gameSettings.rounds + 1))}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            activeOpacity={0.7}
            onTouchStart={(evt) => DEBUG_MODE && handleDebugTouch(evt, 'Increase Questions')}
          >
            <LinearGradient colors={['#43A047', '#2E7D32']} style={styles.circleGradient}>
              <AntDesign name="plus" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timer controls */}
      <View style={styles.hostSettingItem}>
        <View style={styles.settingLabelContainer}>
          <MaterialCommunityIcons name="timer" size={20} color="#FFD700" />
          <Text style={styles.settingLabel}>Timer</Text>
        </View>
        <View style={styles.timerControls}>
          {Object.keys(TIMER_CONFIGS).map(seconds => (
            <TouchableOpacity
              key={seconds}
              style={[
                styles.timerButton,
                gameSettings.timeLimit === parseInt(seconds) && styles.timerButtonSelected
              ]}
              onPress={() => handleTimerSelect(parseInt(seconds))}
              activeOpacity={0.7}
              onTouchStart={(evt) => DEBUG_MODE && handleDebugTouch(evt, `Timer ${seconds}s`)}
            >
              <Text style={styles.timerButtonText}>{seconds}s</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>

    {/* Start Game Button */}
    <TouchableOpacity
      style={[
        styles.startButton,
        (!allPlayersReady || playerArray.length < 2 || !selectedPack || isGameStarting) && 
        styles.startButtonDisabled
      ]}
      onPress={handleStartGame}
      disabled={!allPlayersReady || playerArray.length < 2 || !selectedPack || isGameStarting}
      activeOpacity={0.7}
      onTouchStart={(evt) => DEBUG_MODE && handleDebugTouch(evt, 'Start Game')}
    >
      <LinearGradient
        colors={['#FFD700', '#FFA500']}
        style={styles.startButtonGradient}
      >
        <Text style={styles.startButtonText}>
          {!selectedPack ? 'SELECT PACK FIRST' : (isGameStarting ? 'STARTING GAME...' : 'START THE SHOW!')}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  </LinearGradient>
);

// DEBUG: Render debug overlay - only in DEBUG mode
const renderDebugOverlay = () => {
  if (!DEBUG_MODE) return null;
  
  return (
    <View 
      style={styles.debugOverlay}
      pointerEvents="box-none" // Allow touches to pass through
    >
      {/* Debug touches */}
      {debugTouches.map(touch => (
        <View 
          key={touch.id}
          style={[
            styles.debugTouch,
            { left: touch.x - 15, top: touch.y - 15 }
          ]}
          pointerEvents="none"
        >
          <Text style={styles.debugTouchText}>{touch.buttonName}</Text>
        </View>
      ))}
      
      {/* Debug info panel */}
      <View style={styles.debugPanel} pointerEvents="box-none">
        <Text style={styles.debugTitle}>DEBUG MODE</Text>
        <Text style={styles.debugText}>Last Button: {debugInfo.lastPressedButton}</Text>
        <Text style={styles.debugText}>Overlay Active: {debugInfo.isOverlayActive ? 'YES' : 'NO'}</Text>
        <Text style={styles.debugText}>Game Starting: {isGameStarting ? 'YES' : 'NO'}</Text>
        <Text style={styles.debugText}>Is Host: {currentUserIsHost ? 'YES' : 'NO'}</Text>
        <Text style={styles.debugText}>Pack: {selectedPack || 'None'}</Text>
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={handleDebugReset}
        >
          <Text style={styles.debugButtonText}>Reset State</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Show removal message if player was removed by host
if (removedByHost) {
  return (
    <View style={styles.removedContainer}>
      <MaterialCommunityIcons name="account-remove" size={80} color="#FF5555" />
      <Text style={styles.removedTitle}>You've Been Removed</Text>
      <Text style={styles.removedMessage}>The host has removed you from this game.</Text>
      <TouchableOpacity
        style={styles.removedButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.7}
      >
        <Text style={styles.removedButtonText}>Return to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

return (
  <View style={styles.container}>
    {/* Background Image */}
    <ImageBackground
      source={require('../../assets/LobbyScreen.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Studio lights effect - with reduced opacity and no pointer events */}
      <View style={[styles.studioLights, { opacity: staticLightsAnim }]} pointerEvents="none">
        <LinearGradient
          colors={['#FFD700', 'transparent', '#4CAF50']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.studioLightsGradient}
        />
      </View>

      {/* Header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)']}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.leaveButton} 
          onPress={handleLeave}
          activeOpacity={0.7}
        >
          <AntDesign name="arrowleft" size={24} color="#FFD700" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Game Lobby</Text>
        </View>
        
        <View style={styles.roomCodeContainer}>
          <Text style={styles.roomCodeLabel}>ROOM:</Text>
          <Text style={styles.roomCodeValue}>{firebase.currentRoom}</Text>
        </View>
      </LinearGradient>

      {/* Players Section */}
      <View style={styles.playersContainer}>
        <View style={styles.playersHeader}>
          <LinearGradient
            colors={['#FFD700', '#FFC107']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.playerHeaderGradient}
          >
            <Text style={styles.playersTitle}>Contestants</Text>
            <View style={styles.playerCountBadge}>
              <Text style={styles.playerCountText}>{playerArray.length}/{MAX_PLAYERS}</Text>
            </View>
          </LinearGradient>
        </View>

        <FlatList
          data={playerArray}
          keyExtractor={(item) => item.id}
          renderItem={renderPlayerItem}
          style={styles.playerList}
          contentContainerStyle={styles.playerListContent}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Game Settings - Different UI for host and clients */}
      {currentUserIsHost ? renderHostControls() : renderNonHostGameSettings()}

      {/* Loading or Countdown overlay when game is starting - with fixed zIndex and pointerEvents */}
      {isGameStarting && (
        <View style={[styles.loadingOverlay, { zIndex: 900 }]} pointerEvents="auto">
          <LinearGradient
            colors={['rgba(26, 35, 126, 0.9)', 'rgba(13, 71, 161, 0.9)']}
            style={styles.loadingContainer}
          >
            {countdown ? (
              <Animated.Text 
                style={[
                  styles.countdownText,
                  { transform: [{ scale: countdownAnim }] }
                ]}
              >
                {countdown}
              </Animated.Text>
            ) : (
              <>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <MaterialCommunityIcons name="gamepad-variant" size={50} color="#FFD700" />
                </Animated.View>
                <Text style={styles.loadingTitle}>Get Ready!</Text>
                <ActivityIndicator size="large" color="#FFD700" style={{ marginVertical: 15 }} />
                <Text style={styles.loadingText}>The show is about to begin...</Text>
              </>
            )}
          </LinearGradient>
        </View>
      )}
      
      {/* Debug overlay on top of everything */}
      {renderDebugOverlay()}
    </ImageBackground>
  </View>
);
}

// Define styles
const styles = StyleSheet.create({
  // Debug styles
  debugOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999, // Above everything
  },
  debugTouch: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugTouchText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  debugPanel: {
    position: 'absolute',
    top: 40,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF0000',
    width: 150,
  },
  debugTitle: {
    color: '#FF0000',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    marginBottom: 3,
  },
  debugButton: {
    backgroundColor: '#FF0000',
    padding: 8,
    borderRadius: 5,
    marginTop: 5,
    alignItems: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  spotlightOverlay: {
    position: 'absolute',
    width: width,
    height: height,
    left: 0,
    top: 0,
    opacity: 0.3,
  },
  spotlightGradient: {
    width: '100%',
    height: '100%'
  },
  // Studio lights effect
  studioLights: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1, // Above background but below content
  },
  studioLightsGradient: {
    width: '100%',
    height: '100%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
    zIndex: 2, // Ensure it's above the studio lights
  },
  leaveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  roomCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  roomCodeLabel: {
    color: '#FFD700',
    marginRight: 5,
    fontWeight: 'bold',
  },
  roomCodeValue: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  playersContainer: {
    flex: 1,
    padding: 15,
  },
  playersHeader: {
    marginBottom: 15,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playerHeaderGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
  },
  playersTitle: {
    color: '#1A237E',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  playerCountBadge: {
    backgroundColor: '#1A237E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  playerCountText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
  },
  playerList: {
    flex: 1,
  },
  playerListContent: {
    paddingBottom: 10,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  hostBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  hostBadgeText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  playerNameAndPlatform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    marginLeft: 8,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 24,
    marginRight: 10,
    fontWeight: 'bold', // Changed from '500' to 'bold'
  },
  playerReady: {
    fontWeight: 'bold',
  },
  disconnectedPlayer: {
    color: '#999',
    fontStyle: 'italic',
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    marginRight: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  removeButton: {
    padding: 8,
    marginRight: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF5555',
  },
  readyIcon: {
    marginLeft: 5,
  },
  editNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editNameInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 10,
  },
  saveNameButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContainer: {
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  gameInfoContainer: {
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  settingItem: {
    flex: 1,
    marginRight: 10,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  gameInfoValue: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  gameInfoSmallValue: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  gameInfoValueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  waitingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  waitingText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  fullWidthReadyButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  readyButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Host control styles
  packSelectionButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
  },
  packSelectionGradient: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 10,
  },
  packHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  packSelectionLabel: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  packNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packSelectionValue: {
    color: 'white',
    fontSize: 18,
    flex: 1,
  },
  hostSettingsContainer: {
    marginBottom: 15,
  },
  hostSettingItem: {
    marginBottom: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  circleGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingValueText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  timerControls: {
    flexDirection: 'row',
    marginTop: 5,
  },
  timerButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  timerButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timerButtonSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: '#FFD700',
  },
  startButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  startButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#1A237E',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },

  // Loading overlay and countdown styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 900
  },
  loadingContainer: {
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    height: 300,
    maxWidth: 350,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  loadingTitle: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Countdown number styles
  countdownText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 5,
  },

  // Removal screen styles
  removedContainer: {
    flex: 1,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  removedTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  removedMessage: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  removedButton: {
    backgroundColor: '#FF5555',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  removedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default LobbyScreen;