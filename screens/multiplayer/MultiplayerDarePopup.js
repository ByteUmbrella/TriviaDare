import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  Platform,
  BackHandler,
  Vibration,
  TouchableNativeFeedback,
  Animated,
  Dimensions,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import daresData from '../../dares/dare.json';
import { achievementTracker } from '../../Context/AchievementTracker';
import { useFirebase } from '../../Context/multiplayer/FirebaseContext';

const { width, height } = Dimensions.get('window');

// Device type detection and responsive functions
const getDeviceType = () => {
  const aspectRatio = height / width;
  
  if (Platform.OS === 'ios') {
    if ((width >= 768 && height >= 1024) || aspectRatio < 1.6) {
      return 'tablet';
    }
  } else {
    if (width >= 600 || aspectRatio < 1.6) {
      return 'tablet';
    }
  }
  
  return 'phone';
};

const isTablet = () => getDeviceType() === 'tablet';

// Responsive scaling functions
const responsiveFont = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.3);
  }
  return phoneSize;
};

const responsiveSpacing = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.4);
  }
  return phoneSize;
};

const responsiveSize = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.25);
  }
  return phoneSize;
};

// Multiplayer Vote Progress Component
const VoteProgressIndicator = memo(({ 
  votesReceived, 
  totalPlayers, 
  yesVotes, 
  noVotes, 
  isProcessing 
}) => {
  const progressPercentage = totalPlayers > 0 ? (votesReceived / totalPlayers) * 100 : 0;
  
  return (
    <View style={styles.voteProgressContainer}>
      <Text style={styles.voteProgressTitle}>Vote Progress</Text>
      
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View 
            style={[
              styles.progressBarFill,
              { width: `${progressPercentage}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {votesReceived} / {totalPlayers} votes
        </Text>
      </View>
      
      <View style={styles.voteCountsRow}>
        <View style={styles.voteCountItem}>
          <Ionicons name="thumbs-up" size={responsiveSize(18)} color="#4CAF50" />
          <Text style={styles.voteCountNumber}>{yesVotes}</Text>
          <Text style={styles.voteCountLabel}>Yes</Text>
        </View>
        
        <View style={styles.voteCountSeparator} />
        
        <View style={styles.voteCountItem}>
          <Ionicons name="thumbs-down" size={responsiveSize(18)} color="#f44336" />
          <Text style={styles.voteCountNumber}>{noVotes}</Text>
          <Text style={styles.voteCountLabel}>No</Text>
        </View>
      </View>
      
      {isProcessing && (
        <View style={styles.processingIndicator}>
          <ActivityIndicator size="small" color="#FFD700" />
          <Text style={styles.processingText}>Processing votes...</Text>
        </View>
      )}
    </View>
  );
});

// Real-time Player Voting Status Component
const PlayerVotingStatus = memo(({ players, votes, currentUserId }) => {
  if (!players || players.length <= 1) return null;
  
  return (
    <View style={styles.playerVotingContainer}>
      <Text style={styles.playerVotingTitle}>Player Votes:</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.playerVotingScroll}
      >
        {players.map((player, index) => {
          const playerEntry = Object.entries(player).find(
            ([_, data]) => typeof data === 'object'
          );
          const playerId = playerEntry ? playerEntry[0] : `player_${index}`;
          const playerData = playerEntry ? playerEntry[1] : player;
          const playerName = playerData.name || `Player ${index + 1}`;
          const hasVoted = votes[playerId] !== undefined;
          const voteValue = votes[playerId];
          const isCurrentUser = playerId === currentUserId;
          
          return (
            <View 
              key={`${playerId}-${index}`}
              style={[
                styles.playerVoteItem,
                hasVoted && styles.playerVoteItemVoted,
                isCurrentUser && styles.playerVoteItemSelf
              ]}
            >
              <Text style={[
                styles.playerVoteName,
                hasVoted && styles.playerVoteNameVoted,
                isCurrentUser && styles.playerVoteNameSelf
              ]}>
                {playerName}
              </Text>
              
              {hasVoted ? (
                <View style={styles.playerVoteStatus}>
                  <Ionicons 
                    name={voteValue ? "thumbs-up" : "thumbs-down"} 
                    size={responsiveSize(16)} 
                    color={voteValue ? "#4CAF50" : "#f44336"} 
                  />
                  <Text style={[
                    styles.playerVoteText,
                    { color: voteValue ? "#4CAF50" : "#f44336" }
                  ]}>
                    {voteValue ? "Yes" : "No"}
                  </Text>
                </View>
              ) : (
                <View style={styles.playerVoteStatus}>
                  <Ionicons name="time" size={responsiveSize(14)} color="#FFD700" />
                  <Text style={styles.playerVoteWaiting}>Waiting</Text>
                </View>
              )}
              
              {isCurrentUser && (
                <View style={styles.selfIndicator}>
                  <Text style={styles.selfIndicatorText}>You</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

// Vote Result Animation Component
const VoteResultOverlay = memo(({ visible, result, darePoints, onAnimationComplete }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        })
      ]).start();
      
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.5,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start(() => {
          if (onAnimationComplete) {
            onAnimationComplete();
          }
        });
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const isSuccess = result === 'awarded';

  return (
    <Animated.View 
      style={[
        styles.voteResultOverlay,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <View style={[
        styles.resultContainer,
        isSuccess ? styles.successResult : styles.failureResult
      ]}>
        <Ionicons 
          name={isSuccess ? "checkmark-circle" : "close-circle"} 
          size={responsiveSize(60)} 
          color={isSuccess ? "#4CAF50" : "#f44336"} 
        />
        <Text style={styles.resultTitle}>
          {isSuccess ? "Dare Completed!" : "Dare Failed"}
        </Text>
        <Text style={styles.resultSubtitle}>
          {isSuccess ? `+${darePoints} points awarded` : "No points awarded"}
        </Text>
        <Text style={styles.resultDescription}>
          {isSuccess ? "The majority voted that the dare was completed successfully!" : "The majority voted that the dare was not completed."}
        </Text>
      </View>
    </Animated.View>
  );
});

const MultiplayerDarePopup = ({ 
  visible, 
  onClose, 
  currentPlayer, 
  timerConfig,
  // Multiplayer specific props
  isMultiplayer = true,
  isPerformingDare = false,
  onVote = null,
  votes = {},
  totalPlayers = 1,
  // Dynamic dare scoring props
  calculatedDarePoints = null,
  streakInfo = null,
  showDynamicPoints = false,
  darePointsBreakdown = null
}) => {
  const firebase = useFirebase();
  const [randomDare, setRandomDare] = useState(null);
  const [usedDares, setUsedDares] = useState(new Set());
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Multiplayer state
  const [hasVoted, setHasVoted] = useState(false);
  const [voteResult, setVoteResult] = useState(null); // 'awarded' or 'denied'
  const [isClosing, setIsClosing] = useState(false);
  const [showVoteResult, setShowVoteResult] = useState(false);
  const dareProcessedRef = useRef(false);
  
  // Achievement tracking
  const [dareStartTime, setDareStartTime] = useState(null);

  // Get Firebase data
  const players = firebase?.players ? Object.values(firebase.players) : [];
  const currentUserId = firebase?.user?.uid;

  // Handle Android back button when modal is visible
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (visible && Platform.OS === 'android') {
          return true; // Prevent back button from dismissing
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [visible])
  );

  const getRandomDare = () => {
    if (usedDares.size >= daresData.length) {
      setUsedDares(new Set());
    }
    
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

  useEffect(() => {
    if (visible) {
      setRandomDare(getRandomDare());
      setDareStartTime(Date.now());
      
      // Log dynamic dare scoring info
      if (showDynamicPoints && darePointsBreakdown) {
        console.log('🎯 Multiplayer DarePopup opened with dynamic scoring:', {
          calculatedDarePoints,
          darePointsBreakdown,
          streakInfo
        });
      }
      
      // Reset multiplayer state
      setHasVoted(false);
      setVoteResult(null);
      setIsClosing(false);
      setShowVoteResult(false);
      dareProcessedRef.current = false;
      
      // Start fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
      setDareStartTime(null);
    }
  }, [visible, showDynamicPoints, darePointsBreakdown, calculatedDarePoints, streakInfo]);
  
  // Process votes when all players have voted
  useEffect(() => {
    if (!isMultiplayer || !visible) return;
    
    // Count votes
    const voteEntries = Object.entries(votes);
    const votesReceived = voteEntries.length;
    const yesVotes = voteEntries.filter(([_, vote]) => vote === true).length;
    const noVotes = voteEntries.filter(([_, vote]) => vote === false).length;
    
    // Check if all players have voted
    if (votesReceived >= totalPlayers && !isClosing && !dareProcessedRef.current) {
      setIsClosing(true);
      dareProcessedRef.current = true;
      
      // Determine result
      const majorityCompleted = yesVotes >= Math.ceil(totalPlayers / 2);
      setVoteResult(majorityCompleted ? 'awarded' : 'denied');
      
      // Achievement tracking for multiplayer
      if (majorityCompleted && dareStartTime) {
        const completionTimeMs = Date.now() - dareStartTime;
        achievementTracker.trackDareCompleted(completionTimeMs).catch(error => {
          console.error('Error tracking dare completion:', error);
        });
      }
      
      // Show result overlay
      setShowVoteResult(true);
    }
  }, [votes, visible, isMultiplayer, totalPlayers, isClosing, dareStartTime]);

  const handleDareAction = async (dareCompleted) => {
    if (hasVoted) return;
    
    // Android haptic feedback
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(dareCompleted ? 100 : 200);
      } catch (e) {
        console.log('Vibration not available');
      }
    }
    
    console.log('🎯 Multiplayer dare action:', {
      dareCompleted,
      isPerformingDare,
      dynamicPoints: calculatedDarePoints,
      staticFallback: timerConfig ? Math.floor(timerConfig.baseScore * 0.5) : 50
    });
    
    // Submit vote through Firebase
    if (onVote) {
      onVote(dareCompleted);
      setHasVoted(true);
    }
  };

  const handleVoteResultComplete = () => {
    setShowVoteResult(false);
    
    // Close the modal with the result
    const majorityCompleted = voteResult === 'awarded';
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: Platform.OS === 'android' ? 150 : 200,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) {
        onClose(majorityCompleted);
      }
    });
  };

  if (!randomDare) return null;
  
  // Calculate points - use dynamic if available, otherwise fallback
  const getDarePoints = () => {
    if (showDynamicPoints && calculatedDarePoints !== null) {
      console.log('🎯 Using dynamic dare points:', calculatedDarePoints);
      return calculatedDarePoints;
    }
    
    const staticPoints = timerConfig ? Math.floor(timerConfig.baseScore * 0.5) : 50;
    console.log('🎯 Using static fallback dare points:', staticPoints);
    return staticPoints;
  };

  const darePoints = getDarePoints();

  // Count votes for progress display
  const voteEntries = Object.entries(votes);
  const voteYesCount = voteEntries.filter(([_, vote]) => vote === true).length;
  const voteNoCount = voteEntries.filter(([_, vote]) => vote === false).length;
  const votesReceived = voteYesCount + voteNoCount;
  const isProcessingVotes = votesReceived >= totalPlayers && !showVoteResult;

  // Render dynamic points breakdown
  const renderPointsBreakdown = () => {
    if (!showDynamicPoints || !darePointsBreakdown) {
      return null;
    }

    const { 
      baseDarePoints, 
      questionCountMultiplier, 
      adjustedBaseDarePoints,
      catchUpBonus, 
      streakMultiplier, 
      finalDarePoints, 
      streakInfo 
    } = darePointsBreakdown;

    return (
      <View style={styles.pointsBreakdownContainer}>
        <Text style={styles.pointsBreakdownTitle}>Dare Worth:</Text>
        
        <View style={styles.pointsBreakdownRow}>
          <Text style={styles.pointsBreakdownLabel}>Base Points:</Text>
          <Text style={styles.pointsBreakdownValue}>+{Math.round(baseDarePoints)}</Text>
        </View>
        
        {questionCountMultiplier && questionCountMultiplier !== 1 && (
          <View style={styles.pointsBreakdownRow}>
            <Text style={styles.pointsBreakdownLabel}>
              Game Length Bonus ({questionCountMultiplier.toFixed(1)}x):
            </Text>
            <Text style={[styles.pointsBreakdownValue, 
              questionCountMultiplier > 1 ? styles.bonusText : styles.reductionText
            ]}>
              {questionCountMultiplier > 1 ? '+' : ''}{Math.round(adjustedBaseDarePoints - baseDarePoints)}
            </Text>
          </View>
        )}
        
        {catchUpBonus > 0 && (
          <View style={styles.pointsBreakdownRow}>
            <Text style={styles.pointsBreakdownLabel}>Catch-up Bonus:</Text>
            <Text style={[styles.pointsBreakdownValue, styles.bonusText]}>+{Math.round(catchUpBonus)}</Text>
          </View>
        )}
        
        {streakInfo && streakInfo.currentStreak > 0 && (
          <View style={styles.pointsBreakdownRow}>
            <Text style={styles.pointsBreakdownLabel}>Streak Bonus ({streakInfo.currentStreak}x):</Text>
            <Text style={[styles.pointsBreakdownValue, styles.streakText]}>+{Math.round(streakInfo.streakBonus)}</Text>
          </View>
        )}
        
        <View style={[styles.pointsBreakdownRow, styles.totalPointsRow]}>
          <Text style={styles.totalPointsLabel}>Total:</Text>
          <Text style={styles.totalPointsValue}>{finalDarePoints} pts</Text>
        </View>
        
        {streakInfo && (
          <Text style={styles.streakInfoText}>
            {streakInfo.currentStreak > 0 
              ? `Current streak: ${streakInfo.currentStreak} dares`
              : 'Complete this dare to start a streak!'
            }
          </Text>
        )}
      </View>
    );
  };

  // Render voting content based on user role
  const renderVotingContent = () => {
    if (hasVoted || isProcessingVotes) {
      return (
        <View style={styles.votingStatusContainer}>
          <VoteProgressIndicator
            votesReceived={votesReceived}
            totalPlayers={totalPlayers}
            yesVotes={voteYesCount}
            noVotes={voteNoCount}
            isProcessing={isProcessingVotes}
          />
          
          <PlayerVotingStatus 
            players={players}
            votes={votes}
            currentUserId={currentUserId}
          />
          
          <Text style={styles.votingStatusText}>
            {isProcessingVotes 
              ? "Processing results..." 
              : `Waiting for ${totalPlayers - votesReceived} more votes...`}
          </Text>
        </View>
      );
    }
    
    // Show voting buttons
    return (
      <>
        <Text style={styles.votingInstructionText}>
          {isPerformingDare 
            ? "Complete the dare then press the button below:" 
            : `Did ${currentPlayer} complete the dare successfully?`}
        </Text>

        {renderPlatformButtons()}
      </>
    );
  };

  // Platform-specific button rendering
  const renderPlatformButtons = () => {
    const isDisabled = isClosing || hasVoted;
    
    if (Platform.OS === 'android') {
      return (
        <>
          <View style={[styles.buttonWrapper, styles.completedButtonWrapper]}>
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
              onPress={() => handleDareAction(true)}
              disabled={isDisabled}
            >
              <View style={[styles.button, styles.completedButton, styles.buttonAndroid]}>
                <Text style={[styles.buttonText, styles.buttonTextAndroid]}>
                  {isPerformingDare 
                    ? "I Completed It" 
                    : "Vote: Completed"}
                </Text>
                <Text style={[styles.pointsText, styles.buttonTextAndroid]}>
                  +{darePoints} pts
                </Text>
              </View>
            </TouchableNativeFeedback>
          </View>

          <View style={[styles.buttonWrapper, styles.notCompletedButtonWrapper]}>
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
              onPress={() => handleDareAction(false)}
              disabled={isDisabled}
            >
              <View style={[styles.button, styles.notCompletedButton, styles.buttonAndroid]}>
                <Text style={[styles.buttonText, styles.buttonTextAndroid]}>
                  {isPerformingDare
                    ? "I Didn't Complete It"
                    : "Vote: Not Completed"}
                </Text>
                <Text style={[styles.pointsText, styles.buttonTextAndroid]}>
                  +0 pts
                </Text>
              </View>
            </TouchableNativeFeedback>
          </View>
        </>
      );
    }

    return (
      <>
        <TouchableOpacity
          style={[styles.button, styles.completedButton]}
          onPress={() => handleDareAction(true)}
          disabled={isDisabled}
        >
          <Text style={styles.buttonText}>
            {isPerformingDare 
              ? "I Completed It" 
              : "Vote: Completed"}
          </Text>
          <Text style={styles.pointsText}>+{darePoints} pts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.notCompletedButton]}
          onPress={() => handleDareAction(false)}
          disabled={isDisabled}
        >
          <Text style={styles.buttonText}>
            {isPerformingDare
              ? "I Didn't Complete It"
              : "Vote: Not Completed"}
          </Text>
          <Text style={styles.pointsText}>+0 pts</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={() => {
        if (Platform.OS === 'android') {
          return; // Prevent modal from closing on Android back button
        }
      }}
    >
      <Animated.View 
        style={[
          styles.container,
          { opacity: fadeAnim }
        ]}
      >
        <LinearGradient
          colors={['#1a0f3d', '#2d1b4e']}
          style={[
            styles.popupGradient,
            Platform.OS === 'android' ? styles.popupGradientAndroid : {}
          ]}
        >
          {/* Top light bar */}
          <View style={styles.lightBar}>
            {[...Array(Platform.OS === 'android' ? 8 : 10)].map((_, i) => (
              <View 
                key={`top-${i}`} 
                style={[
                  styles.light,
                  Platform.OS === 'android' ? styles.lightAndroid : {}
                ]} 
              />
            ))}
          </View>

          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[
              styles.playerName,
              Platform.OS === 'android' ? styles.playerNameAndroid : {}
            ]}>
              {currentPlayer}
            </Text>
            
            <View style={[
              styles.dareCounter,
              Platform.OS === 'android' ? styles.dareCounterAndroid : {}
            ]}>
              <Text style={[
                styles.dareCounterText,
                Platform.OS === 'android' ? styles.dareCounterTextAndroid : {}
              ]}>
                MULTIPLAYER DARE CHALLENGE
              </Text>
            </View>

            <View style={styles.multiplayerIndicator}>
              <Ionicons name="people" size={responsiveSize(16)} color="#FFD700" />
              <Text style={styles.multiplayerText}>
                {totalPlayers} Players • {isPerformingDare ? "You're performing" : "Vote on completion"}
              </Text>
            </View>

            <View style={[
              styles.dareContainer,
              Platform.OS === 'android' ? styles.dareContainerAndroid : {}
            ]}>
              <Text style={[
                styles.dareText,
                Platform.OS === 'android' ? styles.dareTextAndroid : {}
              ]}>
                {randomDare}
              </Text>
            </View>

            {/* Dynamic Points Breakdown */}
            {renderPointsBreakdown()}

            {/* Multiplayer voting content */}
            {renderVotingContent()}
          </ScrollView>

          {/* Bottom light bar */}
          <View style={styles.lightBar}>
            {[...Array(Platform.OS === 'android' ? 8 : 10)].map((_, i) => (
              <View 
                key={`bottom-${i}`} 
                style={[
                  styles.light,
                  Platform.OS === 'android' ? styles.lightAndroid : {}
                ]} 
              />
            ))}
          </View>
        </LinearGradient>
        
        {/* Vote Result Overlay */}
        <VoteResultOverlay
          visible={showVoteResult}
          result={voteResult}
          darePoints={darePoints}
          onAnimationComplete={handleVoteResultComplete}
        />
      </Animated.View>
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
  popupGradient: {
    width: isTablet() ? Math.min(width * 0.8, 600) : '90%',
    maxWidth: isTablet() ? 600 : 400,
    maxHeight: height * 0.9,
    borderRadius: responsiveSize(15),
    overflow: 'hidden',
    borderWidth: responsiveSize(2),
    borderColor: '#FFD700',
    padding: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
    }),
  },
  popupGradientAndroid: {
    elevation: 8,
    borderWidth: responsiveSize(1.5),
    width: isTablet() ? Math.min(width * 0.75, 550) : width * 0.85,
    maxWidth: isTablet() ? 550 : 380,
  },
  scrollContainer: {
    flex: 1,
  },
  lightBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingVertical: responsiveSpacing(10),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  light: {
    width: responsiveSize(8),
    height: responsiveSize(8),
    borderRadius: responsiveSize(4),
    backgroundColor: '#FFD700',
    opacity: 0.8,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
    }),
  },
  lightAndroid: {
    width: responsiveSize(7),
    height: responsiveSize(7),
    borderRadius: responsiveSize(3.5),
    opacity: 0.7,
    elevation: 2,
  },
  content: {
    padding: responsiveSpacing(20),
    alignItems: 'center',
    flexGrow: 1,
  },
  playerName: {
    fontSize: responsiveFont(32),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: responsiveSpacing(10),
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  playerNameAndroid: {
    fontSize: responsiveFont(28),
    fontWeight: '700',
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 3,
    marginBottom: responsiveSpacing(8),
  },
  dareCounter: {
    backgroundColor: '#000000',
    paddingHorizontal: responsiveSpacing(20),
    paddingVertical: responsiveSpacing(5),
    borderRadius: responsiveSize(15),
    marginBottom: responsiveSpacing(10),
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
    }),
  },
  dareCounterAndroid: {
    elevation: 4,
    paddingHorizontal: responsiveSpacing(18),
    marginBottom: responsiveSpacing(16),
  },
  dareCounterText: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dareCounterTextAndroid: {
    fontSize: responsiveFont(14),
    fontWeight: '700',
  },
  multiplayerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: responsiveSpacing(10),
    paddingVertical: responsiveSpacing(5),
    borderRadius: responsiveSize(10),
    marginBottom: responsiveSpacing(15),
  },
  multiplayerText: {
    color: '#FFD700',
    marginLeft: responsiveSpacing(5),
    fontWeight: 'bold',
    fontSize: responsiveFont(13),
    textAlign: 'center',
  },
  dareContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(20),
    marginBottom: responsiveSpacing(20),
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  dareContainerAndroid: {
    elevation: 5,
    padding: responsiveSpacing(16),
    marginBottom: responsiveSpacing(16),
  },
  dareText: {
    fontSize: responsiveFont(18),
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: responsiveFont(24),
  },
  dareTextAndroid: {
    fontSize: responsiveFont(16),
    lineHeight: responsiveFont(22),
  },
  
  // Dynamic Points Breakdown Styles
  pointsBreakdownContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(15),
    marginBottom: responsiveSpacing(15),
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pointsBreakdownTitle: {
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: responsiveSpacing(10),
  },
  pointsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: responsiveSpacing(2),
  },
  pointsBreakdownLabel: {
    fontSize: responsiveFont(14),
    color: '#FFFFFF',
    flex: 1,
  },
  pointsBreakdownValue: {
    fontSize: responsiveFont(14),
    color: '#FFFFFF',
    fontWeight: 'bold',
    minWidth: responsiveSize(40),
    textAlign: 'right',
  },
  bonusText: {
    color: '#4CAF50',
  },
  reductionText: {
    color: '#FF5722',
  },
  streakText: {
    color: '#FF9800',
  },
  totalPointsRow: {
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
    marginTop: responsiveSpacing(5),
    paddingTop: responsiveSpacing(5),
  },
  totalPointsLabel: {
    fontSize: responsiveFont(16),
    color: '#FFD700',
    fontWeight: 'bold',
    flex: 1,
  },
  totalPointsValue: {
    fontSize: responsiveFont(18),
    color: '#FFD700',
    fontWeight: 'bold',
    minWidth: responsiveSize(60),
    textAlign: 'right',
  },
  streakInfoText: {
    fontSize: responsiveFont(12),
    color: '#CCCCCC',
    textAlign: 'center',
    marginTop: responsiveSpacing(8),
    fontStyle: 'italic',
  },
  
  // Multiplayer Voting Progress Styles
  voteProgressContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(15),
    marginBottom: responsiveSpacing(15),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  voteProgressTitle: {
    color: '#FFD700',
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: responsiveSpacing(10),
  },
  progressBarContainer: {
    marginBottom: responsiveSpacing(15),
  },
  progressBarBackground: {
    width: '100%',
    height: responsiveSize(8),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: responsiveSize(4),
    overflow: 'hidden',
    marginBottom: responsiveSpacing(5),
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(14),
    textAlign: 'center',
  },
  voteCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  voteCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(6),
    borderRadius: responsiveSize(15),
  },
  voteCountNumber: {
    color: '#FFFFFF',
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
    marginHorizontal: responsiveSpacing(5),
  },
  voteCountLabel: {
    color: '#FFFFFF',
    fontSize: responsiveFont(14),
  },
  voteCountSeparator: {
    width: 1,
    height: responsiveSize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: responsiveSpacing(10),
  },
  processingText: {
    color: '#FFD700',
    fontSize: responsiveFont(14),
    marginLeft: responsiveSpacing(8),
  },
  
  // Player Voting Status Styles
  playerVotingContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: responsiveSize(8),
    padding: responsiveSpacing(10),
    marginBottom: responsiveSpacing(15),
  },
  playerVotingTitle: {
    color: '#FFD700',
    fontSize: responsiveFont(14),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(8),
  },
  playerVotingScroll: {
    maxHeight: responsiveSize(60),
  },
  playerVoteItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: responsiveSize(6),
    paddingHorizontal: responsiveSpacing(8),
    paddingVertical: responsiveSpacing(6),
    marginRight: responsiveSpacing(8),
    marginBottom: responsiveSpacing(4),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
  },
  playerVoteItemVoted: {
    borderColor: '#4CAF50',
  },
  playerVoteItemSelf: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  playerVoteName: {
    color: '#FFFFFF',
    fontSize: responsiveFont(12),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(2),
  },
  playerVoteNameVoted: {
    color: '#4CAF50',
  },
  playerVoteNameSelf: {
    color: '#FFD700',
  },
  playerVoteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerVoteText: {
    fontSize: responsiveFont(11),
    fontWeight: 'bold',
    marginLeft: responsiveSpacing(3),
  },
  playerVoteWaiting: {
    color: '#FFD700',
    fontSize: responsiveFont(10),
    marginLeft: responsiveSpacing(3),
  },
  selfIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFD700',
    borderRadius: responsiveSize(6),
    paddingHorizontal: responsiveSpacing(4),
    paddingVertical: responsiveSpacing(1),
  },
  selfIndicatorText: {
    color: '#000',
    fontSize: responsiveFont(8),
    fontWeight: 'bold',
  },
  
  // Voting Status Container
  votingStatusContainer: {
    width: '100%',
    alignItems: 'center',
  },
  votingStatusText: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: responsiveSpacing(10),
    fontStyle: 'italic',
  },
  
  // Voting Instruction Text
  votingInstructionText: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: responsiveSpacing(15),
    fontStyle: 'italic',
  },
  
  // Button Styles
  buttonWrapper: {
    width: '100%',
    borderRadius: responsiveSize(25),
    marginVertical: responsiveSpacing(8),
    overflow: 'hidden',
  },
  completedButtonWrapper: {
    backgroundColor: '#4CAF50',
  },
  notCompletedButtonWrapper: {
    backgroundColor: '#f44336',
  },
  button: {
    width: '100%',
    paddingVertical: responsiveSpacing(15),
    paddingHorizontal: responsiveSpacing(20),
    borderRadius: responsiveSize(25),
    marginVertical: responsiveSpacing(8),
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
    }),
  },
  buttonAndroid: {
    elevation: 5,
    marginVertical: 0,
    borderRadius: 0,
    paddingVertical: responsiveSpacing(16),
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  notCompletedButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  buttonTextAndroid: {
    fontSize: responsiveFont(16),
    fontWeight: '700',
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2,
  },
  pointsText: {
    color: 'white',
    fontSize: responsiveFont(14),
    marginTop: responsiveSpacing(5),
    fontWeight: 'bold',
  },
  
  // Vote Result Overlay Styles
  voteResultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resultContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: responsiveSize(20),
    padding: responsiveSpacing(30),
    alignItems: 'center',
    borderWidth: responsiveSize(3),
    maxWidth: width * 0.8,
  },
  successResult: {
    borderColor: '#4CAF50',
  },
  failureResult: {
    borderColor: '#f44336',
  },
  resultTitle: {
    fontSize: responsiveFont(28),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: responsiveSpacing(15),
    marginBottom: responsiveSpacing(10),
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: responsiveFont(20),
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(10),
    textAlign: 'center',
  },
  resultDescription: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: responsiveFont(22),
    opacity: 0.9,
  }
});

export default MultiplayerDarePopup;