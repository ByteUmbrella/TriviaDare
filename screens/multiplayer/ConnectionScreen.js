// screens/multiplayer/ConnectionScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableNativeFeedback,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  Switch,
  Pressable,
  BackHandler,
  ToastAndroid,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useFirebase } from '../../Context/multiplayer/FirebaseContext';
import { AntDesign, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Game name options array
const GAME_NAME_OPTIONS = [
  "Trivia Champions",
  "Brain Busters Quiz",
  "Golden Challenge",
  "Knowledge Showdown",
  "Dare Masters",
  "Quiz Wizards",
  "The Big Brain Game",
  "Mind Blasters",
  "Ultimate Trivia Battle",
  "Champions Arena",
  "Trivia Titans",
  "Dare Devils Quiz",
  "Gameshow Legends",
  "Victory Challenge",
  "Celebrity Trivia"
];

// Function to get a random game name
const getRandomGameName = () => {
  const randomIndex = Math.floor(Math.random() * GAME_NAME_OPTIONS.length);
  return GAME_NAME_OPTIONS[randomIndex];
};

const ConnectionScreen = ({ navigation }) => {
  // Error state for debugging
  const [errorState, setErrorState] = useState(null);
  
  // Get Firebase context
  const firebase = useFirebase();
  
  // Screen state - initialize with a random game name
  const [mode, setMode] = useState(null); // 'host' or 'join' or null
  const [gameName, setGameName] = useState(getRandomGameName());
  const [hostPlayerName, setHostPlayerName] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  
  // Game info modal state
  const [showGameInfoModal, setShowGameInfoModal] = useState(false);
  const [gameCreationInfo, setGameCreationInfo] = useState({ name: '', roomCode: '' });
  const hasShownModal = useRef(false);
  
  // Modal visibility
  const [roomCodeModalVisible, setRoomCodeModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameModalMode, setNameModalMode] = useState(''); // 'host' or 'join'
  const [hostSetupModalVisible, setHostSetupModalVisible] = useState(false);
  const [devModeModalVisible, setDevModeModalVisible] = useState(false);
  
  // Dev mode tap detection
  const devModeTapCounter = useRef(0);
  const devModeTapTimer = useRef(null);

  // Debug initialization
  useEffect(() => {
    try {
      console.log("ConnectionScreen initializing");
      console.log("Firebase initialized:", !!firebase);
      
      if (!firebase) {
        setErrorState("Firebase context is not available");
        return;
      }
      
      console.log("Firebase currentRoom:", firebase.currentRoom);
      console.log("Firebase user:", !!firebase.user);
    } catch (error) {
      console.error("Error in initialization:", error);
      setErrorState(error.toString());
    }
  }, [firebase]);

  // Android back button handling
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          if (roomCodeModalVisible) {
            setRoomCodeModalVisible(false);
            return true;
          }
          
          if (nameModalVisible) {
            setNameModalVisible(false);
            return true;
          }
          
          if (hostSetupModalVisible) {
            setHostSetupModalVisible(false);
            return true;
          }
          
          if (devModeModalVisible) {
            setDevModeModalVisible(false);
            return true;
          }
          
          if (showGameInfoModal) {
            setShowGameInfoModal(false);
            return true;
          }
          
          // Let default back behavior happen
          return false;
        };
        
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [roomCodeModalVisible, nameModalVisible, hostSetupModalVisible, 
        devModeModalVisible, showGameInfoModal])
  );

  // Reset modal state when the screen is focused
  useEffect(() => {
    console.log("Setting up navigation listener");
    
    const unsubscribe = navigation.addListener('focus', () => {
      console.log("ConnectionScreen focused");
      
      // If we're coming back to this screen and already have a connected room
      if (firebase && firebase.currentRoom) {
        console.log("Found existing room, leaving it:", firebase.currentRoom);
        setShowGameInfoModal(false);
        
        // If room exists, leave it when returning to this screen
        firebase.leaveRoom().catch(error => {
          console.error("Error leaving room:", error);
        });
      }
    });

    return unsubscribe;
  }, [navigation, firebase]);

  // Reset state when unmounting
  useEffect(() => {
    return () => {
      console.log("ConnectionScreen unmounting");
      setMode(null);
      setRoomCode('');
    };
  }, []);

  // Handle successful room creation
  useEffect(() => {
    try {
      // Only show the modal if we've created a room and we're not already showing it
      if (firebase && firebase.currentRoom && !showGameInfoModal && !hasShownModal.current && mode === 'host') {
        console.log("Updating game info with room code:", firebase.currentRoom);
        setGameCreationInfo({
          name: gameName,
          roomCode: firebase.currentRoom
        });
        setShowGameInfoModal(true);
        hasShownModal.current = true; // Set the flag so we don't show it again
        
        // Android toast notification
        if (Platform.OS === 'android') {
          ToastAndroid.show(`Room Code: ${firebase.currentRoom}`, ToastAndroid.LONG);
        }
      }
    } catch (error) {
      console.error("Error handling room creation:", error);
      setErrorState(error.toString());
    }
  }, [firebase?.currentRoom, gameName, showGameInfoModal, mode]);

  // Handle Firebase errors
  useEffect(() => {
    if (firebase?.error) {
      Alert.alert(
        'Firebase Error',
        firebase.error,
        [{ text: 'OK', onPress: () => firebase.clearError && firebase.clearError() }]
      );
    }
  }, [firebase?.error, firebase?.clearError]);

  // Handle triple tap for dev mode
  const handleTitlePress = () => {
    devModeTapCounter.current += 1;
    
    // Clear existing timer
    if (devModeTapTimer.current) {
      clearTimeout(devModeTapTimer.current);
    }
    
    // Set a new timer for 800ms
    devModeTapTimer.current = setTimeout(() => {
      // Check if we reached 3 taps
      if (devModeTapCounter.current >= 3) {
        setDevModeModalVisible(true);
        
        // Android toast notification
        if (Platform.OS === 'android') {
          ToastAndroid.show('Developer options enabled', ToastAndroid.SHORT);
        }
      }
      
      // Reset counter
      devModeTapCounter.current = 0;
    }, 800);
  };

  // Show host setup modal with a fresh random name
  const showHostSetupModal = () => {
    // Generate a new random game name each time the modal opens
    setGameName(getRandomGameName());
    setHostPlayerName('');
    setHostSetupModalVisible(true);
  };

  const handleHostSetupSubmit = async () => {
    try {
      if (gameName.trim() === '') {
        Alert.alert('Invalid Name', 'Please enter a name for your game.');
        return;
      }
      
      if (hostPlayerName.trim() === '') {
        Alert.alert('Invalid Name', 'Please enter your name as the host.');
        return;
      }
      
      // Dismiss keyboard on Android
      if (Platform.OS === 'android') {
        Keyboard.dismiss();
      }
      
      // Close the modal
      setHostSetupModalVisible(false);
      
      // Set mode to host
      setMode('host');
      
      // Now create the room
      handleCreateRoom(hostPlayerName);
    } catch (error) {
      console.error("Error in host setup submit:", error);
      setErrorState(error.toString());
    }
  };

  // Handle join name input
  const showJoinNameModal = () => {
    setJoinPlayerName('');
    setNameModalVisible(true);
    setNameModalMode('join');
  };

  // Handle join name submission
  const handleJoinNameSubmit = () => {
    try {
      if (joinPlayerName.trim() === '') {
        Alert.alert('Invalid Name', 'Please enter your name.');
        return;
      }
      
      // Dismiss keyboard on Android
      if (Platform.OS === 'android') {
        Keyboard.dismiss();
      }
      
      // Close the modal
      setNameModalVisible(false);
      
      // Show room code modal
      setRoomCode('');
      setRoomCodeModalVisible(true);
      
      // Show Android-specific toast
      if (Platform.OS === 'android') {
        ToastAndroid.show('Enter the room code', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error("Error in join name submit:", error);
      setErrorState(error.toString());
    }
  };

  // Create a new room
  const handleCreateRoom = async (playerNameParam) => {
    try {
      if (!firebase || !firebase.createRoom) {
        throw new Error("Firebase context or createRoom method not available");
      }
      
      // Reset modal shown flag
      hasShownModal.current = false;
      
      // Set loading state
      setIsCreatingGame(true);
      
      // Android-specific feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Creating game...', ToastAndroid.SHORT);
      }
      
      // Make sure we have the most recent player name
      const finalPlayerName = playerNameParam || hostPlayerName;
      
      // Game settings
      const gameSettings = {
        timeLimit: 20, // Default time limit
        rounds: 5      // Default number of rounds
      };
      
      console.log("Creating room with player:", finalPlayerName);
      
      // Create the room
      await firebase.createRoom(finalPlayerName, gameSettings);
      
      // Clear loading state
      setIsCreatingGame(false);
      
      // Success handled in useEffect that watches for currentRoom
      
      // Android success feedback
      if (Platform.OS === 'android') {
        ToastAndroid.show('Game created successfully!', ToastAndroid.SHORT);
      }
    } catch (error) {
      // Clear loading state on error
      setIsCreatingGame(false);
      console.error('Error creating room:', error);
      setErrorState(error.toString());
      
      Alert.alert('Error', `Failed to create game: ${error.message || 'Unknown error'}`);
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Game creation failed', ToastAndroid.SHORT);
      }
    }
  };

  // In handleRoomCodeSubmit function in ConnectionScreen.js
const handleRoomCodeSubmit = async () => {
  try {
    if (!firebase || !firebase.joinRoom) {
      throw new Error("Firebase context or joinRoom method not available");
    }
    
    // Clean and validate the room code - make sure to get the complete code
    const cleanedRoomCode = roomCode.trim().toUpperCase();
    
    console.log("[ConnectionScreen] Full room code to join:", cleanedRoomCode, "Length:", cleanedRoomCode.length);
    
    if (cleanedRoomCode === '') {
      Alert.alert('Invalid Code', 'Please enter a room code.');
      return;
    }
    
    // Validate that we have a complete 4-character code
    if (cleanedRoomCode.length !== 4) {
      Alert.alert('Invalid Code', 'Room code must be 4 characters.');
      return;
    }

    // Dismiss keyboard on Android
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }

    setRoomCodeModalVisible(false);
    setIsJoiningGame(true);
    
    // Android feedback
    if (Platform.OS === 'android') {
      ToastAndroid.show(`Joining room ${cleanedRoomCode}...`, ToastAndroid.SHORT);
    }
    
    console.log("[ConnectionScreen] Joining room:", cleanedRoomCode, "with player:", joinPlayerName, "on platform:", Platform.OS);
    
    // Join the room with the provided code and player name
    await firebase.joinRoom(cleanedRoomCode, joinPlayerName.trim());
    setIsJoiningGame(false);
    
    // Success
    if (Platform.OS === 'android') {
      ToastAndroid.show('Joined successfully!', ToastAndroid.SHORT);
    }
    
    // Navigate to lobby
    console.log("Navigation to LobbyScreen");
    navigation.navigate('LobbyScreen', { isHost: false });
  } catch (error) {
    setIsJoiningGame(false);
    console.error('[ConnectionScreen] Error joining room:', error);
    
    let errorMessage = 'Failed to join room. Please check the room code and try again.';
    
    if (error.message?.includes('Room not found')) {
      errorMessage = 'Room not found. Please check the room code and try again.';
    } else if (error.message?.includes('Game already started')) {
      errorMessage = 'This game has already started. Please join another game.';
    }
    
    Alert.alert('Error', errorMessage);
    
    if (Platform.OS === 'android') {
      ToastAndroid.show('Failed to join game', ToastAndroid.SHORT);
    }
  }
};

  // Placeholder function for TV connection - for future development
  const handleTVConnection = () => {
    Alert.alert(
      'Coming Soon',
      'Connection to TV devices will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  // Render the options mode UI (initial state)
  const renderOptionsMode = () => (
    <View style={styles.playerSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderBadge}>
          <Text style={styles.sectionHeaderText}>Choose an Option</Text>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        {Platform.OS === 'android' ? (
          <TouchableNativeFeedback
            onPress={showHostSetupModal}
            background={TouchableNativeFeedback.Ripple('#FFD700', false)}
          >
            <View style={styles.modeButton}>
              <MaterialCommunityIcons name="access-point" size={30} color="#FFD700" style={styles.modeButtonIcon} />
              <Text style={styles.modeButtonText}>Host a Game</Text>
              <Text style={styles.modeButtonSubtext}>
                Create a new game and invite friends to join
              </Text>
            </View>
          </TouchableNativeFeedback>
        ) : (
          <TouchableOpacity
            style={styles.modeButton}
            onPress={showHostSetupModal}
          >
            <MaterialCommunityIcons name="access-point" size={30} color="#FFD700" style={styles.modeButtonIcon} />
            <Text style={styles.modeButtonText}>Host a Game</Text>
            <Text style={styles.modeButtonSubtext}>
              Create a new game and invite friends to join
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        {Platform.OS === 'android' ? (
          <TouchableNativeFeedback
            onPress={showJoinNameModal}
            background={TouchableNativeFeedback.Ripple('#FFD700', false)}
          >
            <View style={styles.modeButton}>
              <MaterialCommunityIcons name="account-multiple-plus" size={30} color="#FFD700" style={styles.modeButtonIcon} />
              <Text style={styles.modeButtonText}>Join a Game</Text>
              <Text style={styles.modeButtonSubtext}>
                Join an existing game with a room code
              </Text>
            </View>
          </TouchableNativeFeedback>
        ) : (
          <TouchableOpacity
            style={styles.modeButton}
            onPress={showJoinNameModal}
          >
            <MaterialCommunityIcons name="account-multiple-plus" size={30} color="#FFD700" style={styles.modeButtonIcon} />
            <Text style={styles.modeButtonText}>Join a Game</Text>
            <Text style={styles.modeButtonSubtext}>
              Join an existing game with a room code
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {Platform.OS === 'android' ? (
          <TouchableNativeFeedback
            onPress={handleTVConnection}
            background={TouchableNativeFeedback.Ripple('#FFD700', false)}
          >
            <View style={styles.modeButton}>
              <Ionicons name="tv" size={30} color="#FFD700" style={styles.modeButtonIcon} />
              <Text style={styles.modeButtonText}>Connect to TV Game</Text>
              <Text style={styles.modeButtonSubtext}>
                Join a game on Apple TV or Roku (Coming Soon)
              </Text>
            </View>
          </TouchableNativeFeedback>
        ) : (
          <TouchableOpacity
            style={styles.modeButton}
            onPress={handleTVConnection}
          >
            <Ionicons name="tv" size={30} color="#FFD700" style={styles.modeButtonIcon} />
            <Text style={styles.modeButtonText}>Connect to TV Game</Text>
            <Text style={styles.modeButtonSubtext}>
              Join a game on Apple TV or Roku (Coming Soon)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Render the custom game info modal (for created room)
  const renderGameInfoModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showGameInfoModal}
      onRequestClose={() => {
        setShowGameInfoModal(false);
      }}
    >
      <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
        <View style={styles.modalOverlay}>
          <View style={styles.gameInfoModalContainer}>
            <Text style={styles.gameInfoTitle}>Game Created!</Text>
            
            <View style={styles.gameInfoContent}>
              <View style={styles.gameInfoItem}>
                <Text style={styles.gameInfoLabel}>Game Name:</Text>
                <Text style={styles.gameInfoValue}>{gameCreationInfo.name}</Text>
              </View>
              
              <View style={styles.gameInfoItem}>
                <Text style={styles.gameInfoLabel}>Room Code:</Text>
                <Text style={styles.gameInfoPIN}>{gameCreationInfo.roomCode}</Text>
              </View>
              
              <Text style={styles.gameInfoInstructions}>
                Share this code with players who want to join your game!
              </Text>
            </View>
            
            {Platform.OS === 'android' ? (
              <TouchableNativeFeedback
                onPress={() => {
                  // First set the state to hide the modal
                  setShowGameInfoModal(false);
                  
                  // Then navigate after a short delay to ensure modal is hidden
                  setTimeout(() => {
                    console.log("Navigating to LobbyScreen as host");
                    navigation.navigate('LobbyScreen', { 
                      isHost: true,
                      roomCode: firebase.currentRoom 
                    });
                  }, Platform.OS === 'android' ? 150 : 100);
                }}
                background={TouchableNativeFeedback.Ripple('#FFD700', false)}
              >
                <View style={styles.gameInfoButton}>
                  <Text style={styles.gameInfoButtonText}>Continue to Lobby</Text>
                </View>
              </TouchableNativeFeedback>
            ) : (
              <TouchableOpacity
                style={styles.gameInfoButton}
                onPress={() => {
                  setShowGameInfoModal(false);
                  
                  setTimeout(() => {
                    console.log("Navigating to TriviaPackSelection as host");
                    navigation.navigate('TriviaPackSelection', { 
                      isHost: true,
                      fromMultiplayer: true,
                      roomCode: firebase.currentRoom 
                    });
                  }, 100);
                }}
              >
                <Text style={styles.gameInfoButtonText}>Continue to Lobby</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // Render the host setup modal
  const renderHostSetupModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={hostSetupModalVisible}
      onRequestClose={() => setHostSetupModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
        <View style={styles.modalOverlay}>
          <View style={styles.hostSetupModalContainer}>
            <Text style={styles.pinModalTitle}>Host Game Setup</Text>
            
            <Text style={styles.inputLabel}>Game Name:</Text>
            <TextInput
              style={styles.nameInput}
              value={gameName}
              onChangeText={setGameName}
              placeholder="Game Name"
              placeholderTextColor="rgba(255, 215, 0, 0.5)"
              maxLength={20}
              returnKeyType={Platform.OS === 'android' ? "next" : "default"}
              blurOnSubmit={false}
              onSubmitEditing={() => {
                // Focus the next field on Android
                if (Platform.OS === 'android') {
                  this.hostPlayerNameInput && this.hostPlayerNameInput.focus();
                }
              }}
            />
            
            <Text style={styles.inputLabel}>Your Name:</Text>
            <TextInput
              ref={input => { this.hostPlayerNameInput = input; }}
              style={styles.nameInput}
              value={hostPlayerName}
              onChangeText={setHostPlayerName}
              placeholder="Your Name"
              placeholderTextColor="rgba(255, 215, 0, 0.5)"
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={Platform.OS === 'android' ? handleHostSetupSubmit : undefined}
            />
            
            <View style={styles.modalButtonRow}>
              {Platform.OS === 'android' ? (
                <>
                  <TouchableNativeFeedback
                    onPress={() => setHostSetupModalVisible(false)}
                    background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
                  >
                    <View style={[styles.modalButton, styles.cancelButton]}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </View>
                  </TouchableNativeFeedback>
                  
                  <TouchableNativeFeedback
                    onPress={handleHostSetupSubmit}
                    background={TouchableNativeFeedback.Ripple('#FFD700', false)}
                  >
                    <View style={[styles.modalButton, styles.submitButton]}>
                      <Text style={styles.modalButtonText}>Create Game</Text>
                    </View>
                  </TouchableNativeFeedback>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setHostSetupModalVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.submitButton]}
                    onPress={handleHostSetupSubmit}
                  >
                    <Text style={styles.modalButtonText}>Create Game</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // Render the join name modal
  const renderJoinNameModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={nameModalVisible && nameModalMode === 'join'}
      onRequestClose={() => setNameModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
        <View style={styles.modalOverlay}>
          <View style={styles.pinModalContainer}>
            <Text style={styles.pinModalTitle}>Enter Your Name</Text>
            <Text style={styles.pinModalSubtitle}>
              This will be displayed to other players
            </Text>
            
            <TextInput
              style={styles.nameInput}
              value={joinPlayerName}
              onChangeText={setJoinPlayerName}
              placeholder="Your Name"
              placeholderTextColor="rgba(255, 215, 0, 0.5)"
              autoFocus={true}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={Platform.OS === 'android' ? handleJoinNameSubmit : undefined}
            />
            
            <View style={styles.modalButtonRow}>
              {Platform.OS === 'android' ? (
                <>
                  <TouchableNativeFeedback
                    onPress={() => setNameModalVisible(false)}
                    background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
                  >
                    <View style={[styles.modalButton, styles.cancelButton]}>
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </View>
                  </TouchableNativeFeedback>
                  
                  <TouchableNativeFeedback
                    onPress={handleJoinNameSubmit}
                    background={TouchableNativeFeedback.Ripple('#FFD700', false)}
                  >
                    <View style={[styles.modalButton, styles.submitButton]}>
                      <Text style={styles.modalButtonText}>Continue</Text>
                    </View>
                  </TouchableNativeFeedback>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setNameModalVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.submitButton]}
                    onPress={handleJoinNameSubmit}
                  >
                    <Text style={styles.modalButtonText}>Continue</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // Render the room code entry modal
const renderRoomCodeEntryModal = () => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={roomCodeModalVisible}
    onRequestClose={() => setRoomCodeModalVisible(false)}
  >
    <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
      <View style={styles.modalOverlay}>
        <View style={styles.pinModalContainer}>
          <Text style={styles.pinModalTitle}>Enter Room Code</Text>
          <Text style={styles.pinModalSubtitle}>
            Enter the 4-character room code to join the game
          </Text>
          
          <TextInput
            style={styles.pinInput}
            value={roomCode}
            onChangeText={text => {
              // Only allow alphanumeric and limit to 4 characters
              if (/^[A-Za-z0-9]*$/.test(text) && text.length <= 4) {
                setRoomCode(text.toUpperCase());
                console.log("Room code updated:", text.toUpperCase(), "Length:", text.toUpperCase().length);
              }
              // Remove auto-submission to prevent truncation issues
            }}
            placeholder="Enter 4-character code"
            placeholderTextColor="rgba(255, 215, 0, 0.5)"
            autoCapitalize="characters"
            maxLength={4}
            autoFocus={true}
            returnKeyType="done"
            // Remove auto-submission on input completion
          />
          
          <View style={styles.modalButtonRow}>
            {Platform.OS === 'android' ? (
              <>
                <TouchableNativeFeedback
                  onPress={() => setRoomCodeModalVisible(false)}
                  background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
                >
                  <View style={[styles.modalButton, styles.cancelButton]}>
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </View>
                </TouchableNativeFeedback>
                
                <TouchableNativeFeedback
                  onPress={handleRoomCodeSubmit}
                  background={roomCode.length !== 4 ? null : TouchableNativeFeedback.Ripple('#FFD700', false)}
                  disabled={roomCode.length !== 4}
                >
                  <View style={[styles.modalButton, styles.submitButton, roomCode.length !== 4 && styles.disabledButton]}>
                    <Text style={styles.modalButtonText}>Join Game</Text>
                  </View>
                </TouchableNativeFeedback>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setRoomCodeModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton, roomCode.length !== 4 && styles.disabledButton]}
                  onPress={handleRoomCodeSubmit}
                  disabled={roomCode.length !== 4}
                >
                  <Text style={styles.modalButtonText}>Join Game</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

  // Fix for renderDevModeModal function (replace the incomplete part):
const renderDevModeModal = () => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={devModeModalVisible}
    onRequestClose={() => setDevModeModalVisible(false)}
  >
    <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
      <View style={styles.modalOverlay}>
        <View style={styles.pinModalContainer}>
          <Text style={styles.pinModalTitle}>Firebase Info</Text>
          <Text style={styles.pinModalSubtitle}>
            Firebase connection status
          </Text>
          
          <View style={styles.devModeToggleContainer}>
            <Text style={styles.devModeToggleText}>
              Connection Status
            </Text>
            <Text style={[
              styles.devModeToggleText, 
              { color: firebase.isConnected ? '#4CAF50' : '#F44336' }
            ]}>
              {firebase.isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          
          <Text style={styles.devModeDescription}>
            Firebase Realtime Database is being used for multiplayer functionality.
            {firebase.error ? `\n\nError: ${firebase.error}` : ''}
          </Text>
          
          {Platform.OS === 'android' ? (
            <TouchableNativeFeedback
              onPress={() => setDevModeModalVisible(false)}
              background={TouchableNativeFeedback.Ripple('#FFD700', false)}
            >
              <View style={[styles.modalButton, { width: '80%', marginTop: 10 }]}>
                <Text style={styles.modalButtonText}>Close</Text>
              </View>
            </TouchableNativeFeedback>
          ) : (
            <TouchableOpacity
              style={[styles.modalButton, { width: '80%', marginTop: 10 }]}
              onPress={() => setDevModeModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

return (
  <View style={styles.container}>
    {errorState ? (
      // Error state UI
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{errorState}</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => setErrorState(null)}
        >
          <Text style={styles.errorButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    ) : (
      // Main UI
      <>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <AntDesign name="arrowleft" size={24} color="#FFD700" />
          </TouchableOpacity>
          
          <Text style={styles.title} onPress={handleTitlePress}>Multiplayer</Text>
          
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.contentContainer}>
          {mode === null ? renderOptionsMode() : null}
        </View>
        
        {/* Modals */}
        {renderGameInfoModal()}
        {renderHostSetupModal()}
        {renderJoinNameModal()}
        {renderRoomCodeEntryModal()}
        {renderDevModeModal()}
        
        {/* Loading states */}
        {(isCreatingGame || isJoiningGame) && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.loadingText}>
                {isCreatingGame ? 'Creating Game...' : 'Joining Game...'}
              </Text>
            </View>
          </View>
        )}
      </>
    )}
  </View>
);
}

// Styles that should be at the end of the file:
const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: '#1A237E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  headerSpacer: {
    width: 48,
  },
  multiplayerButton: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      android: {
        elevation: 3,
      }
    })
  },
  contentContainer: {
    flex: 1,
    padding: 15,
    paddingBottom: 0,
  },
  playerSection: {
    backgroundColor: 'rgba(26, 35, 126, 0.85)',
    borderRadius: 15,
    padding: 15,
    margin: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      }
    })
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
  },
  sectionHeaderBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'white',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      }
    })
  },
  sectionHeaderText: {
    color: '#1A237E',
    fontWeight: 'bold',
    fontSize: 18,
  },
  buttonContainer: {
    marginBottom: 15,
  },
  modeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      }
    })
  },
  modeButtonIcon: {
    marginBottom: 5,
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  modeButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalContainer: {
    backgroundColor: '#1A237E',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      android: {
        elevation: 10,
      }
    })
  },
  hostSetupModalContainer: {
    backgroundColor: '#1A237E',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    alignItems: 'stretch',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      android: {
        elevation: 10,
      }
    })
  },
  pinModalTitle: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  pinModalSubtitle: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
  },
  pinInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 10,
    fontSize: 24,
    padding: 15,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 5,
    marginBottom: 20,
  },
  nameInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 10,
    fontSize: 20,
    padding: 15,
    width: '100%',
    marginBottom: 15,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: '45%',
    alignItems: 'center',
    ...Platform.select({
      android: {
        elevation: 3,
      }
    })
  },
  cancelButton: {
    backgroundColor: 'rgba(100, 100, 100, 0.7)',
    borderWidth: 1,
    borderColor: 'white',
  },
  submitButton: {
    backgroundColor: 'rgba(0, 100, 0, 0.7)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  disabledButton: {
    backgroundColor: 'rgba(100, 100, 100, 0.7)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    ...Platform.select({
      android: {
        elevation: 0,
      }
    })
  },
  modalButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Loading overlay styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  loadingContainer: {
    backgroundColor: '#1A237E',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    minWidth: 200,
    ...Platform.select({
      android: {
        elevation: 8,
      }
    })
  },
  loadingText: {
    color: 'white',
    marginTop: 15,
    fontSize: 16,
    fontWeight: 'bold'
  },
  
  // Game info modal styles
  gameInfoModalContainer: {
    backgroundColor: '#1A237E',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      android: {
        elevation: 12,
      },
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      }
    })
  },
  gameInfoTitle: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      }
    })
  },
  gameInfoContent: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  gameInfoItem: {
    marginBottom: 15,
  },
  gameInfoLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  gameInfoValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  gameInfoPIN: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  gameInfoInstructions: {
    color: '#FFD700',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 15,
  },
  gameInfoButton: {
    backgroundColor: 'rgba(0, 150, 0, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      android: {
        elevation: 5,
      }
    })
  },
  gameInfoButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  devModeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 20,
    paddingHorizontal: 10
  },
  devModeToggleText: {
    color: 'white',
    fontSize: 16
  },
  devModeDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 15,
    paddingHorizontal: 10
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1A237E',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  errorButtonText: {
    color: '#1A237E',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerSpacer: {
    width: 40,
  },
});


export default ConnectionScreen;