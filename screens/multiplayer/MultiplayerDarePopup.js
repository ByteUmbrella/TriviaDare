import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFirebase } from '../../Context/multiplayer/FirebaseContext';
import daresData from '../../dares/dare.json';

const MultiplayerDarePopup = ({ 
  visible, 
  onClose, 
  currentPlayer,
  timerConfig,
  isMultiplayer = true,
  showVoting = true,
  onVote = null,
  votes = {},
  totalPlayers = 1
}) => {
  // State variables
  const [randomDare, setRandomDare] = useState(null);
  const [usedDares, setUsedDares] = useState(new Set());
  const [hasVoted, setHasVoted] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);
  const [voteResult, setVoteResult] = useState(null); // 'awarded' or 'denied'
  const [isClosing, setIsClosing] = useState(false);
  
  // Firebase context for players and game state
  const firebase = useFirebase();
  const { user, players, gameState, isHost, updatePlayerData, globalDare, dareVotes, submitDareVote, processDareVotes } = firebase || {};
  
  // Added a ref to track if the dare result has been processed
  const dareProcessedRef = useRef(false);
  
  // Animation values
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const resultFadeAnim = useRef(new Animated.Value(0)).current;

  // Get a random dare from local data - only used as fallback
  const getRandomDareFromLocal = () => {
    // Reset used dares if we've used them all
    if (usedDares.size >= daresData.length) {
      setUsedDares(new Set());
    }
    
    // Filter out used dares
    const availableDares = daresData.filter((_, index) => !usedDares.has(index));
    
    if (availableDares.length === 0) {
      setUsedDares(new Set());
      return daresData[Math.floor(Math.random() * daresData.length)];
    }
    
    const selectedIndex = Math.floor(Math.random() * availableDares.length);
    const selectedDare = availableDares[selectedIndex];
    const originalIndex = daresData.indexOf(selectedDare);
    
    setUsedDares(prev => new Set([...prev, originalIndex]));
    return selectedDare;
  };

  // When the popup becomes visible, reset states and get dare from Firebase
  useEffect(() => {
    if (visible) {
      // Reset all state variables when the dare popup becomes visible
      setHasVoted(false);
      setSimulationActive(false);
      setVoteResult(null);
      setIsClosing(false);
      dareProcessedRef.current = false; // Reset the processed flag
      
      // Use the global dare from Firebase instead of generating locally
      if (firebase && globalDare && globalDare.text) {
        console.log('[DarePopup] Using dare from Firebase:', globalDare.text);
        setRandomDare(globalDare.text);
      } else if (!randomDare) {
        // Fallback to local generation only if needed
        const localDare = getRandomDareFromLocal();
        console.log('[DarePopup] Using locally generated dare:', localDare);
        setRandomDare(localDare);
      }
      
      // Run entrance animations
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Reset result animation
      resultFadeAnim.setValue(0);
    } else {
      // Reset animations when hidden
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, globalDare]);
  
  // Update dare content whenever Firebase global dare changes
  useEffect(() => {
    if (globalDare && globalDare.text) {
      console.log('[DarePopup] Updating dare from Firebase:', globalDare.text);
      setRandomDare(globalDare.text);
    }
  }, [globalDare]);

  // Process votes when all players have voted - Fixed to prevent multiple point awards
  useEffect(() => {
    // Use Firebase dareVotes if available, otherwise use local votes
    const activeVotes = dareVotes || votes;
    
    // Check if all votes are in
    const votesReceived = Object.keys(activeVotes).length;
    
    // Only process UI updates here - NOT score updates!
    if (visible && isMultiplayer && votesReceived >= totalPlayers && !isClosing && !dareProcessedRef.current) {
      console.log('[DarePopup] All votes received, processing result');
      
      // Mark as closing and processed to prevent multiple triggers
      setIsClosing(true);
      dareProcessedRef.current = true;
      
      // Count positive votes
      const yesVotes = Object.values(activeVotes).filter(v => v === true).length;
      const totalVotes = Object.values(activeVotes).length;
      const majorityCompleted = yesVotes >= Math.ceil(totalVotes / 2);
      
      // Show result and animate it
      setVoteResult(majorityCompleted ? 'awarded' : 'denied');
      
      // Animate result appearance
      Animated.timing(resultFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
      
      // If this client is the host, process the votes in Firebase
      if (isHost && processDareVotes) {
        setTimeout(() => {
          console.log('[DarePopup] Host processing dare votes in Firebase');
          processDareVotes().catch(err => console.error('Error processing dare votes:', err));
        }, 1000);
      }
      
      // Close popup after showing result
      setTimeout(() => {
        if (onClose) {
          onClose(majorityCompleted);
        }
      }, 2000);
    }
  }, [dareVotes, votes, visible, isMultiplayer, totalPlayers, isClosing, onClose, isHost, processDareVotes]);

  // Handle when a player submits their vote
  const handleDareCompleted = (dareCompleted) => {
    // Prevent voting multiple times
    if (hasVoted) return;
    
    console.log('[DarePopup] Submitting dare vote:', dareCompleted);
    
    if (isMultiplayer && firebase && submitDareVote) {
      // Use Firebase function to submit vote
      submitDareVote(dareCompleted)
        .then(() => {
          console.log('[DarePopup] Vote submitted successfully');
          setHasVoted(true);
        })
        .catch(err => console.error('Error submitting dare vote:', err));
    } else if (onVote) {
      // Fallback to local voting
      onVote(dareCompleted);
      setHasVoted(true);
    } else {
      // Single player mode - close as usual
      onClose(dareCompleted);
    }
  };

  // Calculate points for completing the dare
  const darePoints = timerConfig ? Math.floor(timerConfig.baseScore * 0.5) : 50;

  // For multiplayer vote tracking - use Firebase dareVotes if available
  const activeVotes = dareVotes || votes;
  const voteYesCount = isMultiplayer ? Object.values(activeVotes).filter(v => v === true).length : 0;
  const voteNoCount = isMultiplayer ? Object.values(activeVotes).filter(v => v === false).length : 0;
  const votesReceived = voteYesCount + voteNoCount;
  const votingProgress = totalPlayers > 0 ? votesReceived / totalPlayers : 0;
  
  // Calculate whether the current player is the one performing the dare
  // In Firebase implementation we check by userId
  const isPerformingDare = user && gameState && gameState.currentDarePlayerId === user.uid;

  if (!randomDare) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none" // Using custom animations
    >
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#1a0f3d', '#2d1b4e']}
            style={styles.popupGradient}
          >
            {/* Top light bar */}
            <View style={styles.lightBar}>
              {[...Array(10)].map((_, i) => (
                <View key={`top-${i}`} style={styles.light} />
              ))}
            </View>

            <View style={styles.content}>
              <Text style={styles.playerName}>{currentPlayer}</Text>
              
              <View style={styles.dareCounter}>
                <Text style={styles.dareCounterText}>
                  {isMultiplayer ? "DARE CHALLENGE" : "DARE"}
                </Text>
              </View>

              {isMultiplayer && (
                <View style={styles.multiplayerIndicator}>
                  <Ionicons name="people" size={16} color="#FFD700" />
                  <Text style={styles.multiplayerText}>Multiplayer Mode</Text>
                </View>
              )}

              <View style={styles.dareContainer}>
                <Text style={styles.dareText}>
                  {randomDare}
                </Text>
              </View>

              {/* Vote result animation overlay */}
              {voteResult && (
                <Animated.View 
                  style={[
                    styles.voteResultContainer,
                    { opacity: resultFadeAnim }
                  ]}
                >
                  <View style={[
                    styles.resultBadge,
                    voteResult === 'awarded' ? styles.awardedBadge : styles.deniedBadge
                  ]}>
                    <Ionicons 
                      name={voteResult === 'awarded' ? "checkmark-circle" : "close-circle"} 
                      size={40} 
                      color={voteResult === 'awarded' ? "#4CAF50" : "#f44336"} 
                    />
                    <Text style={styles.resultText}>
                      {voteResult === 'awarded' 
                        ? `Points Awarded: +${darePoints}` 
                        : "No Points Awarded"}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {isMultiplayer && hasVoted ? (
                // Show voting status after voting
                <View style={styles.votingStatusContainer}>
                  <Text style={styles.votingStatusText}>
                    Waiting for other players to vote...
                  </Text>
                  <View style={styles.votingProgressContainer}>
                    <Animated.View 
                      style={[
                        styles.votingProgress, 
                        { width: `${votingProgress * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.votingCountText}>
                    {votesReceived} of {totalPlayers} votes received
                  </Text>
                  <View style={styles.voteCountsContainer}>
                    <View style={styles.voteCountItem}>
                      <Ionicons name="thumbs-up" size={20} color="#4CAF50" />
                      <Text style={styles.voteCountText}>{voteYesCount}</Text>
                    </View>
                    <View style={styles.voteCountItem}>
                      <Ionicons name="thumbs-down" size={20} color="#f44336" />
                      <Text style={styles.voteCountText}>{voteNoCount}</Text>
                    </View>
                  </View>
                  {votingProgress < 1 && !isClosing && (
                    <ActivityIndicator size="small" color="#FFD700" style={styles.loadingIndicator} />
                  )}
                </View>
              ) : (
                // Show voting buttons if not voted yet
                <>
                  {isMultiplayer && (
                    <Text style={styles.votingInstructionText}>
                      {isPerformingDare 
                        ? "Complete the dare then press the button below:" 
                        : `Did ${currentPlayer} complete the dare successfully?`}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.button, styles.completedButton]}
                    onPress={() => handleDareCompleted(true)}
                    disabled={isClosing || hasVoted}
                  >
                    <Text style={styles.buttonText}>
                      {isMultiplayer 
                        ? isPerformingDare 
                          ? "I Completed It" 
                          : "Vote: Completed" 
                        : "Dare Completed"}
                    </Text>
                    {isMultiplayer && <Text style={styles.pointsText}>+{darePoints} pts</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.notCompletedButton]}
                    onPress={() => handleDareCompleted(false)}
                    disabled={isClosing || hasVoted}
                  >
                    <Text style={styles.buttonText}>
                      {isMultiplayer 
                        ? isPerformingDare
                          ? "I Didn't Complete It"
                          : "Vote: Not Completed" 
                        : "Dare Not Completed"}
                    </Text>
                    {isMultiplayer && <Text style={styles.pointsText}>+0 pts</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Bottom light bar */}
            <View style={styles.lightBar}>
              {[...Array(10)].map((_, i) => (
                <View key={`bottom-${i}`} style={styles.light} />
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  animatedContainer: {
    width: '90%',
    maxWidth: 400,
  },
  popupGradient: {
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 0,
  },
  lightBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    opacity: 0.8,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  playerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  dareCounter: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  dareCounterText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  multiplayerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 15,
  },
  multiplayerText: {
    color: '#FFD700',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  dareContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  dareText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  votingInstructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  button: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  notCompletedButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pointsText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  votingStatusContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  votingStatusText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  votingProgressContainer: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  votingProgress: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  votingCountText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  voteCountsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
    marginTop: 5,
  },
  voteCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  voteCountText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  loadingIndicator: {
    marginTop: 10,
  },
  voteResultContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
    borderRadius: 10,
  },
  resultBadge: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  awardedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  deniedBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#f44336',
  },
  resultText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  }
});

export default MultiplayerDarePopup;