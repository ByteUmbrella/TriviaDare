// Context/multiplayer/FirebaseSimulatorHelper.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView
} from 'react-native';
import { useFirebase } from './FirebaseContext';
import { useGame } from '../GameContext';

const FirebaseSimulatorHelper = ({ screenName }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showButton, setShowButton] = useState(false);
  
  // Get contexts
  const firebase = useFirebase();
  const gameContext = useGame();
  
  // Get all the needed values with safe defaults
  const { 
    user = { uid: 'test-user' },
    isHost = false,
    currentRoom = '',
    players = {},
    gameState = {},
    updateGameState,
    updatePlayerData,
    submitAnswer
  } = firebase || {};
  
  const { 
    currentPlayerIndex = 0, 
    currentQuestionIndex = 0,
    performingDare = false,
    setCurrentPlayerIndex,
    setCurrentQuestionIndex,
    setPerformingDare
  } = gameContext || {};
  
  // Check if we should display the button based on the current screen
  useEffect(() => {
    // Only show on MultiplayerQuestionScreen and development mode
    const shouldShow = 
      __DEV__ && 
      (screenName === 'MultiplayerQuestionScreen' || screenName === 'LobbyScreen');
    
    setShowButton(shouldShow);
  }, [screenName]);
  
  // Don't render anything if we shouldn't show the button
  if (!showButton) return null;
  
  // Force turn change (next player)
  const forceTurnChange = () => {
    try {
      if (!updateGameState || !players || Object.keys(players).length === 0) {
        setStatusMessage('ERROR: Cannot force turn change');
        return;
      }
      
      const playerIds = Object.keys(players);
      const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
      const nextPlayerId = playerIds[nextPlayerIndex];
      
      updateGameState({
        currentPlayerId: nextPlayerId,
        currentQuestionIndex: currentQuestionIndex + 1
      });
      
      // Also update Game context
      if (setCurrentPlayerIndex) {
        setCurrentPlayerIndex(nextPlayerIndex);
      }
      
      if (setCurrentQuestionIndex) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
      
      setStatusMessage(`Turn changed to player: ${players[nextPlayerId]?.name || 'Unknown'}`);
    } catch (error) {
      console.error('Error in forceTurnChange:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  // Simulate start turn (I'm ready)
  const simulateStartTurn = () => {
    try {
      if (!updateGameState) {
        setStatusMessage('ERROR: updateGameState not available');
        return;
      }
      
      updateGameState({
        currentPlayerId: user.uid,
        turnStartTimestamp: Date.now()
      });
      
      setStatusMessage("Turn started");
    } catch (error) {
      console.error('Error in simulateStartTurn:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  // Answer question (true = correct, false = incorrect)
  const answerQuestion = (correct = true) => {
    try {
      if (!submitAnswer) {
        setStatusMessage('ERROR: submitAnswer not available');
        return;
      }
      
      const answer = correct ? "CORRECT_ANSWER" : "WRONG_ANSWER";
      submitAnswer(answer, correct);
      
      setStatusMessage(`Answer sent: ${correct ? 'Correct' : 'Incorrect'}`);
    } catch (error) {
      console.error('Error in answerQuestion:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  // Toggle dare mode
  const toggleDareMode = () => {
    try {
      if (!updateGameState) {
        setStatusMessage('ERROR: updateGameState not available');
        return;
      }
      
      const newDareState = !performingDare;
      
      updateGameState({
        performingDare: newDareState
      });
      
      if (setPerformingDare) {
        setPerformingDare(newDareState);
      }
      
      setStatusMessage(`Dare mode: ${newDareState ? 'ON' : 'OFF'}`);
    } catch (error) {
      console.error('Error in toggleDareMode:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  // Vote on dare
  const voteDare = (completed) => {
    try {
      if (!updatePlayerData) {
        setStatusMessage('ERROR: updatePlayerData not available');
        return;
      }
      
      // Update the player's vote data
      updatePlayerData({
        dareVote: completed ? 'completed' : 'failed',
        lastVoteTimestamp: Date.now()
      });
      
      setStatusMessage(`Dare vote sent: ${completed ? 'Completed' : 'Failed'}`);
    } catch (error) {
      console.error('Error in voteDare:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  // Add a mock player - for development testing
  const addMockPlayer = () => {
    try {
      if (!currentRoom || !updateGameState) {
        setStatusMessage('ERROR: Cannot add mock player');
        return;
      }
      
      const mockPlayerId = 'mock-' + Math.random().toString(36).substring(2, 8);
      const mockPlayerName = 'Tester' + Object.keys(players).length;
      
      // Create a modified players object
      const updatedPlayers = {
        ...players,
        [mockPlayerId]: {
          id: mockPlayerId,
          name: mockPlayerName,
          isHost: false,
          joinedAt: new Date().toISOString(),
          isConnected: true,
          score: 0,
          ready: true
        }
      };
      
      // Update game state to include the new player
      updateGameState({
        mockPlayers: updatedPlayers
      });
      
      setStatusMessage(`Added mock player: ${mockPlayerName}`);
    } catch (error) {
      console.error('Error in addMockPlayer:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  // Simulate ending the game
  const simulateGameEnd = () => {
    try {
      if (!updateGameState) {
        setStatusMessage('ERROR: updateGameState not available');
        return;
      }
      
      updateGameState({
        gameStatus: 'finished',
        finishedAt: new Date().toISOString()
      });
      
      setStatusMessage('Game ended');
    } catch (error) {
      console.error('Error in simulateGameEnd:', error);
      setStatusMessage(`Error: ${error.message}`);
    }
  };
  
  return (
    <>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.floatingButtonText}>FB</Text>
      </TouchableOpacity>
      
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Firebase Testing</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsVisible(false)}
              >
                <Text style={styles.closeButtonText}>X</Text>
              </TouchableOpacity>
            </View>
            
            {statusMessage ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            ) : null}
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Room: {currentRoom || 'None'}</Text>
              <Text style={styles.infoText}>
                Players: {Object.keys(players).length} | 
                Host: {isHost ? 'Yes' : 'No'} | 
                User: {user?.uid?.substring(0, 8) || 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Turn Control</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#2196F3' }]}
                  onPress={simulateStartTurn}
                >
                  <Text style={styles.buttonText}>Start Turn</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#673AB7' }]}
                  onPress={forceTurnChange}
                >
                  <Text style={styles.buttonText}>Next Turn</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Answer Control</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#4CAF50' }]}
                  onPress={() => answerQuestion(true)}
                >
                  <Text style={styles.buttonText}>Correct</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#F44336' }]}
                  onPress={() => answerQuestion(false)}
                >
                  <Text style={styles.buttonText}>Incorrect</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dare Control</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#FF9800' }]}
                  onPress={toggleDareMode}
                >
                  <Text style={styles.buttonText}>
                    {performingDare ? 'Exit Dare Mode' : 'Enter Dare Mode'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#4CAF50' }]}
                  onPress={() => voteDare(true)}
                >
                  <Text style={styles.buttonText}>Vote Complete</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#F44336' }]}
                  onPress={() => voteDare(false)}
                >
                  <Text style={styles.buttonText}>Vote Failed</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Development</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#9C27B0' }]}
                  onPress={addMockPlayer}
                >
                  <Text style={styles.buttonText}>Add Mock Player</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#E91E63' }]}
                  onPress={simulateGameEnd}
                >
                  <Text style={styles.buttonText}>End Game</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.infoText}>
                Current screen: {screenName || 'Unknown'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 200,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    zIndex: 9999,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    color: '#FF9800',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8,
    borderRadius: 5,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    margin: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic'
  }
});

export default FirebaseSimulatorHelper;