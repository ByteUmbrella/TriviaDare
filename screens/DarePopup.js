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
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import daresData from '../dares/dare.json';
import { achievementTracker } from '../Context/AchievementTracker';

const { width, height } = Dimensions.get('window');

// Device type detection and responsive functions
const getDeviceType = () => {
  const aspectRatio = height / width;
  
  if (Platform.OS === 'ios') {
    // iPad detection - iPads typically have lower aspect ratios
    if ((width >= 768 && height >= 1024) || aspectRatio < 1.6) {
      return 'tablet';
    }
  } else {
    // Android tablet detection
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
    return Math.round(phoneSize * 1.3); // 30% larger fonts for tablets
  }
  return phoneSize;
};

const responsiveSpacing = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.4); // 40% larger spacing for tablets
  }
  return phoneSize;
};

const responsiveSize = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.25); // 25% larger sizes for tablets
  }
  return phoneSize;
};

const DarePopup = ({ 
  visible, 
  onClose, 
  currentPlayer, 
  timerConfig,
  // New multiplayer support props
  isMultiplayer = false,
  isPerformingDare = false,
  onVote = null,
  votes = {},
  totalPlayers = 1,
  // NEW: Dynamic dare scoring props
  calculatedDarePoints = null,
  streakInfo = null,
  showDynamicPoints = false,
  darePointsBreakdown = null
}) => {
  const [randomDare, setRandomDare] = useState(null);
  const [usedDares, setUsedDares] = useState(new Set());
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // New multiplayer state
  const [hasVoted, setHasVoted] = useState(false);
  const [voteResult, setVoteResult] = useState(null); // 'awarded' or 'denied'
  const [isClosing, setIsClosing] = useState(false);
  const dareProcessedRef = useRef(false);
  const resultFadeAnim = useRef(new Animated.Value(0)).current;
  
  // ACHIEVEMENT TRACKING: Dare timing state
  const [dareStartTime, setDareStartTime] = useState(null);
  
  // Handle Android back button when modal is visible
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (visible && Platform.OS === 'android') {
          // Don't allow back button to dismiss the modal
          return true;
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [visible])
  );

  const getRandomDare = () => {
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

  useEffect(() => {
    if (visible) {
      setRandomDare(getRandomDare());
      
      // ACHIEVEMENT TRACKING: Start dare timer when modal opens
      setDareStartTime(Date.now());
      
      // NEW: Log dynamic dare scoring info
      if (showDynamicPoints && darePointsBreakdown) {
        console.log('🎯 DarePopup opened with dynamic scoring:', {
          calculatedDarePoints,
          darePointsBreakdown,
          streakInfo
        });
      }
      
      // Reset multiplayer state
      if (isMultiplayer) {
        setHasVoted(false);
        setVoteResult(null);
        setIsClosing(false);
        dareProcessedRef.current = false;
        resultFadeAnim.setValue(0);
      }
      
      // Start fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset fade animation when not visible
      fadeAnim.setValue(0);
      // Reset dare timing
      setDareStartTime(null);
    }
  }, [visible, showDynamicPoints, darePointsBreakdown, calculatedDarePoints, streakInfo]);
  
  // Process votes when all players have voted in multiplayer mode
  useEffect(() => {
    if (!isMultiplayer) return;
    
    // Check if all votes are in
    const votesReceived = Object.keys(votes).length;
    
    // Only process UI updates here - NOT score updates!
    if (visible && votesReceived >= totalPlayers && !isClosing && !dareProcessedRef.current) {
      // Mark as closing and processed to prevent multiple triggers
      setIsClosing(true);
      dareProcessedRef.current = true;
      
      // Count positive votes
      const yesVotes = Object.values(votes).filter(v => v === true).length;
      const totalVoteCount = Object.values(votes).length;
      const majorityCompleted = yesVotes >= Math.ceil(totalVoteCount / 2);
      
      // Show result and animate it
      setVoteResult(majorityCompleted ? 'awarded' : 'denied');
      
      // Animate result appearance
      Animated.timing(resultFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
      
      // ACHIEVEMENT TRACKING: Track dare completion with timing for multiplayer
      if (majorityCompleted && dareStartTime) {
        const completionTimeMs = Date.now() - dareStartTime;
        achievementTracker.trackDareCompleted(completionTimeMs).catch(error => {
          console.error('Error tracking dare completion:', error);
        });
      }
      
      // Pass the result to parent after a delay
      setTimeout(() => {
        if (onClose) {
          onClose(majorityCompleted);
        }
      }, 2000);
    }
  }, [votes, visible, isMultiplayer, totalPlayers, isClosing, onClose, dareStartTime]);

  const handleDareCompleted = async (dareCompleted) => {
    // Prevent voting multiple times in multiplayer
    if (isMultiplayer && hasVoted) return;
    
    // Android haptic feedback
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(dareCompleted ? 100 : 200);
      } catch (e) {
        console.log('Vibration not available');
      }
    }
    
    // NEW: Log dare completion with dynamic points
    console.log('🎯 Dare completion attempted:', {
      dareCompleted,
      dynamicPoints: calculatedDarePoints,
      staticFallback: timerConfig ? Math.floor(timerConfig.baseScore * 0.5) : 50
    });
    
    // ACHIEVEMENT TRACKING: Track dare completion for single player mode
    if (!isMultiplayer && dareCompleted && dareStartTime) {
      try {
        const completionTimeMs = Date.now() - dareStartTime;
        await achievementTracker.trackDareCompleted(completionTimeMs);
        console.log('🎯 Dare completion tracked successfully:', completionTimeMs + 'ms');
      } catch (error) {
        console.error('Error tracking dare completion:', error);
      }
    }
    
    if (isMultiplayer && onVote) {
      // In multiplayer, send your vote instead of immediately closing
      onVote(dareCompleted);
      setHasVoted(true);
    } else {
      // Single player mode - close as usual
      // Fade out animation before closing
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 150 : 200,
        useNativeDriver: true,
      }).start(() => {
        onClose(dareCompleted);
      });
    }
  };

  if (!randomDare) return null;
  
  // NEW: Calculate points - use dynamic if available, otherwise fallback to static
  const getDarePoints = () => {
    if (showDynamicPoints && calculatedDarePoints !== null) {
      console.log('🎯 Using dynamic dare points:', calculatedDarePoints);
      return calculatedDarePoints;
    }
    
    // Fallback to static calculation
    const staticPoints = timerConfig ? Math.floor(timerConfig.baseScore * 0.5) : 50;
    console.log('🎯 Using static fallback dare points:', staticPoints);
    return staticPoints;
  };

  const darePoints = getDarePoints();

  // For multiplayer vote tracking
  const voteYesCount = isMultiplayer ? Object.values(votes).filter(v => v === true).length : 0;
  const voteNoCount = isMultiplayer ? Object.values(votes).filter(v => v === false).length : 0;
  const votesReceived = voteYesCount + voteNoCount;
  const votingProgress = totalPlayers > 0 ? votesReceived / totalPlayers : 0;

  // NEW: Render dynamic points breakdown
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

  // Platform specific button rendering for single player mode
  const renderSinglePlayerButtons = () => {
    if (Platform.OS === 'android') {
      return (
        <>
          <View style={[styles.buttonWrapper, styles.completedButtonWrapper]}>
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
              onPress={() => handleDareCompleted(true)}
            >
              <View style={[styles.button, styles.completedButton, styles.buttonAndroid]}>
                <Text style={[styles.buttonText, styles.buttonTextAndroid]}>
                  Dare Completed
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
              onPress={() => handleDareCompleted(false)}
            >
              <View style={[styles.button, styles.notCompletedButton, styles.buttonAndroid]}>
                <Text style={[styles.buttonText, styles.buttonTextAndroid]}>
                  Dare Not Completed
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
          onPress={() => handleDareCompleted(true)}
        >
          <Text style={styles.buttonText}>Dare Completed</Text>
          <Text style={styles.pointsText}>+{darePoints} pts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.notCompletedButton]}
          onPress={() => handleDareCompleted(false)}
        >
          <Text style={styles.buttonText}>Dare Not Completed</Text>
          <Text style={styles.pointsText}>+0 pts</Text>
        </TouchableOpacity>
      </>
    );
  };
  
  // Render multiplayer voting UI
  const renderMultiplayerContent = () => {
    if (hasVoted) {
      // Show voting status after voting
      return (
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
              <Ionicons name="thumbs-up" size={responsiveSize(20)} color="#4CAF50" />
              <Text style={styles.voteCountText}>{voteYesCount}</Text>
            </View>
            <View style={styles.voteCountItem}>
              <Ionicons name="thumbs-down" size={responsiveSize(20)} color="#f44336" />
              <Text style={styles.voteCountText}>{voteNoCount}</Text>
            </View>
          </View>
          {votingProgress < 1 && !isClosing && (
            <ActivityIndicator size="small" color="#FFD700" style={styles.loadingIndicator} />
          )}
        </View>
      );
    }
    
    // Show voting buttons if not voted yet
    return (
      <>
        <Text style={styles.votingInstructionText}>
          {isPerformingDare 
            ? "Complete the dare then press the button below:" 
            : `Did ${currentPlayer} complete the dare successfully?`}
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.completedButton]}
          onPress={() => handleDareCompleted(true)}
          disabled={isClosing}
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
          onPress={() => handleDareCompleted(false)}
          disabled={isClosing}
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
        // This prevents the modal from closing on Android back button
        if (Platform.OS === 'android') {
          return;
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

          <View style={styles.content}>
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
                {isMultiplayer ? "DARE CHALLENGE" : "DARE"}
              </Text>
            </View>

            {isMultiplayer && (
              <View style={styles.multiplayerIndicator}>
                <Ionicons name="people" size={responsiveSize(16)} color="#FFD700" />
                <Text style={styles.multiplayerText}>Multiplayer Mode</Text>
              </View>
            )}

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

            {/* NEW: Dynamic Points Breakdown */}
            {renderPointsBreakdown()}

            {/* Vote result animation overlay */}
            {isMultiplayer && voteResult && (
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
                    size={responsiveSize(40)} 
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

            {isMultiplayer ? renderMultiplayerContent() : renderSinglePlayerButtons()}
          </View>

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
    fontSize: responsiveFont(18),
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dareCounterTextAndroid: {
    fontSize: responsiveFont(16),
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
    fontSize: responsiveFont(14),
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
  // NEW: Dynamic Points Breakdown Styles
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
  // Multiplayer-specific styles
  votingInstructionText: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: responsiveSpacing(15),
    fontStyle: 'italic',
  },
  votingStatusContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(15),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  votingStatusText: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: responsiveSpacing(10),
  },
  votingProgressContainer: {
    width: '100%',
    height: responsiveSize(10),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: responsiveSize(5),
    marginBottom: responsiveSpacing(10),
    overflow: 'hidden',
  },
  votingProgress: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  votingCountText: {
    fontSize: responsiveFont(14),
    color: '#FFFFFF',
    marginBottom: responsiveSpacing(10),
  },
  voteCountsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
    marginTop: responsiveSpacing(5),
  },
  voteCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: responsiveSpacing(15),
    paddingVertical: responsiveSpacing(5),
    borderRadius: responsiveSize(15),
  },
  voteCountText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
    marginLeft: responsiveSpacing(5),
  },
  loadingIndicator: {
    marginTop: responsiveSpacing(10),
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
    borderRadius: responsiveSize(10),
  },
  resultBadge: {
    padding: responsiveSpacing(20),
    borderRadius: responsiveSize(15),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: responsiveSize(2),
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
    fontSize: responsiveFont(22),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: responsiveSpacing(10),
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  }
});

export default DarePopup;