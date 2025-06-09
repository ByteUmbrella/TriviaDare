import React, { useState, useEffect, memo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Animated, 
  Easing,
  Platform,
  Vibration 
} from 'react-native';

// AnimatedScore component with Android optimizations and fixed undefined score display
const AnimatedScore = memo(({ score, isLeader }) => {
  const animatedValue = React.useRef(new Animated.Value(1)).current;
  // FIX: Always default to 0 if score is undefined/null
  const displayScore = score || 0;
  const [prevScore, setPrevScore] = useState(displayScore);

  useEffect(() => {
    if (displayScore !== prevScore) {
      // Platform-specific animation parameters
      const frictionValue = Platform.OS === 'android' ? 4 : 3; // Higher friction on Android for smoother animation
      const toValue = Platform.OS === 'android' ? 1.15 : 1.2; // Smaller scale change on Android
      
      Animated.sequence([
        Animated.spring(animatedValue, {
          toValue: toValue,
          useNativeDriver: true,
          friction: frictionValue,
          tension: Platform.OS === 'android' ? 40 : 50, // Lower tension for smoother Android animations
        }),
        Animated.spring(animatedValue, {
          toValue: 1,
          useNativeDriver: true,
          friction: frictionValue,
          tension: Platform.OS === 'android' ? 40 : 50,
        }),
      ]).start();
      setPrevScore(displayScore);
    }
    
    // Cleanup animation on unmount
    return () => {
      animatedValue.stopAnimation();
    };
  }, [displayScore]);

  return (
    <View style={styles.scoreWrapper}>
      <Animated.Text 
        style={[
          styles.score,
          { 
            transform: [{ scale: animatedValue }],
          },
          // Platform-specific text styling
          Platform.OS === 'android' ? styles.scoreAndroid : null
        ]}
      >
        {displayScore}
      </Animated.Text>
      {isLeader && (
        <Text style={[
          styles.leaderIcon,
          // Platform-specific icon styling
          Platform.OS === 'android' ? styles.leaderIconAndroid : null
        ]}>👑</Text>
      )}
    </View>
  );
});

// Light component with Android optimizations
const Light = memo(({ delay }) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      // Platform-specific animation parameters
      const duration = Platform.OS === 'android' ? 500 : 600; // Faster on Android
      const delayMs = Platform.OS === 'android' ? delay * 80 : delay * 100; // Less delay on Android
      
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: duration,
          delay: delayMs,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: duration,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]).start(() => animate());
    };

    animate();
    
    // Cleanup animation on unmount
    return () => {
      opacity.stopAnimation();
    };
  }, []);

  return (
    <Animated.View style={[
      styles.light, 
      { opacity },
      // Platform-specific light styling
      Platform.OS === 'android' ? styles.lightAndroid : null
    ]} />
  );
});

const LightStrip = memo(() => (
  <View style={styles.lightStrip}>
    {/* Reduce number of lights on Android for better performance */}
    {[...Array(Platform.OS === 'android' ? 15 : 20)].map((_, i) => (
      <Light key={i} delay={i % 5} />
    ))}
  </View>
));

// TimerBar component with ONLY gameshow bulbs (green progress bar removed)
const TimerBar = memo(({ timeLeft, maxTime, isPaused }) => {
  const progress = timeLeft / maxTime;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const flashAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isPaused) {
      // Add flashing effect when time is low
      if (timeLeft <= 10) {
        // Create pulsing animation for low time
        Animated.loop(
          Animated.sequence([
            Animated.timing(flashAnim, {
              toValue: 1,
              duration: timeLeft <= 5 ? 300 : 500, // Faster flashing when very low
              useNativeDriver: false,
            }),
            Animated.timing(flashAnim, {
              toValue: 0,
              duration: timeLeft <= 5 ? 300 : 500,
              useNativeDriver: false,
            }),
          ])
        ).start();
        
        // Add scale pulsing for urgency
        Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: Platform.OS === 'android' ? 1.05 : 1.08,
              duration: timeLeft <= 5 ? 300 : 500,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: timeLeft <= 5 ? 300 : 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        // Add vibration feedback on Android for low time
        if (Platform.OS === 'android' && timeLeft === 5) {
          try {
            Vibration.vibrate(50);
          } catch (e) {
            console.log('Vibration not available');
          }
        }
      } else {
        // Stop animations if time is not low
        flashAnim.setValue(0);
        scaleAnim.setValue(1);
      }
    }
    
    // Cleanup animations on unmount
    return () => {
      scaleAnim.stopAnimation();
      flashAnim.stopAnimation();
    };
  }, [timeLeft, isPaused]);

  return (
    <View style={styles.timerContainer}>
      {/* GREEN PROGRESS BAR REMOVED - Only timer bulbs remain */}
      
      {/* Timer bulbs/lights that you want to keep */}
      <View style={styles.gameShowLights}>
        {Array.from({ length: 10 }).map((_, index) => {
          // Calculate if this light should be on based on time remaining
          const lightPosition = index / 10;
          const isLightOn = lightPosition <= progress;
          
          return (
            <Animated.View 
              key={`light-${index}`} 
              style={[
                styles.gameShowLight,
                isLightOn && (timeLeft <= 5 ? styles.gameShowLightUrgent : styles.gameShowLightOn),
                // Add pulsing animation to active lights when time is critical
                isLightOn && timeLeft <= 5 && {
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            />
          );
        })}
      </View>
    </View>
  );
});

// FireText component with Android optimizations
const FireText = memo(({ text, isHot }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isHot) {
      // Platform-specific animation parameters
      const duration = Platform.OS === 'android' ? 400 : 500; // Faster on Android
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: Platform.OS === 'android' ? 1.03 : 1.05, // Less scale on Android
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
    
    // Cleanup animation on unmount
    return () => {
      scaleAnim.stopAnimation();
    };
  }, [isHot]);

  return (
    <View style={styles.nameContainer}>
      <Animated.Text
        style={[
          styles.playerName,
          {
            transform: [{ scale: scaleAnim }],
            color: isHot ? '#FFA500' : '#FFFFFF',
          },
          // Platform-specific player name styling
          Platform.OS === 'android' ? styles.playerNameAndroid : null
        ]}
      >
        {text}
      </Animated.Text>
      {isHot && (
        <Text style={[
          styles.streakIcon,
          // Platform-specific streak icon styling
          Platform.OS === 'android' ? styles.streakIconAndroid : null
        ]}>🔥</Text>
      )}
    </View>
  );
});

// PlayerScore component with Android optimizations and fixed score display
const PlayerScore = memo(({ 
  playerName, 
  score, 
  showScores, 
  isLeader,
  streakCount = 0,
  isHighlighted 
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const isHot = streakCount >= 3;
  // FIX: Always default to 0 if score is undefined/null
  const displayScore = score || 0;

  useEffect(() => {
    if (isHighlighted) {
      // Platform-specific animation parameters
      const frictionValue = Platform.OS === 'android' ? 4 : 3; // Higher friction on Android
      const toValue = Platform.OS === 'android' ? 1.05 : 1.1; // Less scale on Android
      
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: toValue,
          useNativeDriver: true,
          friction: frictionValue,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: frictionValue,
        }),
      ]).start();
    }
    
    // Cleanup animation on unmount
    return () => {
      scaleAnim.stopAnimation();
    };
  }, [isHighlighted]);

  return (
    <Animated.View style={[
      styles.playerScore,
      { transform: [{ scale: scaleAnim }] }
    ]}>
      <View style={[
        styles.scoreContainer,
        isLeader && styles.leaderContainer,
        isHot && styles.hotContainer,
        // Platform-specific container styling
        Platform.OS === 'android' && isLeader && styles.leaderContainerAndroid,
        Platform.OS === 'android' && isHot && styles.hotContainerAndroid,
        Platform.OS === 'android' && styles.scoreContainerAndroid
      ]}>
        <FireText 
          text={playerName}
          isHot={isHot}
        />
        {showScores && (
          <AnimatedScore 
            score={displayScore} 
            isLeader={isLeader}
          />
        )}
      </View>
      <View style={[
        styles.lightBar,
        isHot && styles.hotLightBar,
        // Platform-specific light bar styling
        Platform.OS === 'android' && isHot && styles.hotLightBarAndroid
      ]} />
    </Animated.View>
  );
});

// Main ScoreBanner component with Android optimizations and auto-scrolling and fixed score handling
const ScoreBanner = ({ 
  players = [], 
  scores = [], 
  showScores = true, 
  toggleScores,
  currentPlayer = null,
  timeLeft,
  maxTime,
  isPaused = false
}) => {
  const [streaks, setStreaks] = useState(new Array(players.length).fill(0));
  const [previousScores, setPreviousScores] = useState(new Array(players.length).fill(0));
  
  // FIX: Use useMemo to prevent infinite re-renders
  const safeScores = React.useMemo(() => {
    return scores.map(score => score || 0);
  }, [scores]);
  
  const maxScore = React.useMemo(() => {
    return Math.max(...safeScores);
  }, [safeScores]);
  
  const scrollViewRef = useRef(null);
  const scrollTimer = useRef(null);
  const scrollPosition = useRef(0);
  const scrollWidth = useRef(0);
  const containerWidth = useRef(0);
  const isScrolling = useRef(false);

  // Auto-scroll logic when there are more than 3 players
  useEffect(() => {
    // Only enable auto-scroll if there are more than 3 players
    if (players.length > 3 && scrollViewRef.current) {
      const startAutoScroll = () => {
        if (scrollTimer.current) {
          clearInterval(scrollTimer.current);
        }

        // Calculate if scrolling is needed (content width > container width)
        if (scrollWidth.current > containerWidth.current) {
          scrollTimer.current = setInterval(() => {
            // Only scroll if the user isn't currently manually scrolling
            if (!isScrolling.current) {
              // Increment scroll position
              scrollPosition.current += 1;
              
              // Reset scroll position when we reach the end
              if (scrollPosition.current > scrollWidth.current - containerWidth.current) {
                scrollPosition.current = 0;
                
                // To avoid jerkiness, use scrollTo with zero animation for reset
                scrollViewRef.current?.scrollTo({
                  x: 0,
                  animated: false
                });
              } else {
                // Apply smooth scroll
                scrollViewRef.current?.scrollTo({
                  x: scrollPosition.current,
                  animated: true
                });
              }
            }
          }, 50); // Adjust speed as needed - lower is faster
        }
      };

      // Start auto-scrolling after a delay to let the UI render properly
      const initTimer = setTimeout(() => {
        startAutoScroll();
      }, 1000);

      // Get content width after render
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.measure((x, y, width, height, pageX, pageY) => {
            containerWidth.current = width;
          });
        }
      }, 500);

      // Cleanup timers on unmount
      return () => {
        clearTimeout(initTimer);
        if (scrollTimer.current) {
          clearInterval(scrollTimer.current);
        }
      };
    }
  }, [players.length]);

  // Handle content size change to recalculate scroll area
  const handleContentSizeChange = (width) => {
    scrollWidth.current = width;
  };

  // Handle container layout to get its width
  const handleLayout = (event) => {
    containerWidth.current = event.nativeEvent.layout.width;
  };

  // Pause auto-scroll when user is manually scrolling
  const handleScrollBeginDrag = () => {
    isScrolling.current = true;
  };

  // Resume auto-scroll after user stops manually scrolling
  const handleScrollEndDrag = (event) => {
    // Update current scroll position based on where user left off
    scrollPosition.current = event.nativeEvent.contentOffset.x;
    
    // Wait a moment before restarting auto-scroll
    setTimeout(() => {
      isScrolling.current = false;
    }, 3000); // Wait 3 seconds after user stops scrolling
  };

  // Streaks calculation and update with fixed score handling
  useEffect(() => {
    if (currentPlayer !== null && currentPlayer < safeScores.length) {
      const newStreaks = [...streaks];
      
      // FIX: Use safe scores for streak calculation
      const currentPlayerScore = safeScores[currentPlayer];
      const previousPlayerScore = previousScores[currentPlayer] || 0;
      
      console.log('🎯 Streak calculation debug:', {
        currentPlayer,
        currentPlayerScore,
        previousPlayerScore,
        willIncrement: currentPlayerScore > previousPlayerScore
      });
      
      if (currentPlayerScore > previousPlayerScore) {
        newStreaks[currentPlayer]++;
        
        // Add Android vibration feedback for streak milestone
        if (Platform.OS === 'android' && newStreaks[currentPlayer] === 3) {
          try {
            Vibration.vibrate(100);
          } catch (e) {
            console.log('Vibration not available');
          }
        }
      } else {
        newStreaks[currentPlayer] = 0;
      }

      // Reset streaks for other players
      players.forEach((_, index) => {
        if (index !== currentPlayer) {
          newStreaks[index] = 0;
        }
      });

      // Only update if streaks actually changed
      const streaksChanged = JSON.stringify(newStreaks) !== JSON.stringify(streaks);
      const scoresChanged = JSON.stringify(safeScores) !== JSON.stringify(previousScores);
      
      if (streaksChanged) {
        setStreaks(newStreaks);
      }
      
      if (scoresChanged) {
        setPreviousScores([...safeScores]);
      }
    }
  }, [safeScores, currentPlayer, players.length]); // Removed streaks and previousScores from dependencies to prevent loops

  // Platform-specific toggle button rendering
  const renderToggleButton = () => {
    if (Platform.OS === 'android') {
      return (
        <TouchableOpacity 
          style={[styles.toggleButton, styles.toggleButtonAndroid]} 
          onPress={toggleScores}
          activeOpacity={0.6} // More responsive feel on Android
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Larger touch target for Android
        >
          <Text style={[styles.toggleButtonText, styles.toggleButtonTextAndroid]}>
            {showScores ? "↑" : "↓"}
          </Text>
        </TouchableOpacity>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={toggleScores}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleButtonText}>
          {showScores ? "↑" : "↓"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.bannerContainer,
        // Platform-specific banner styling
        Platform.OS === 'android' ? styles.bannerContainerAndroid : null
      ]}>
        <View style={styles.topDecoration}>
          <LightStrip />
        </View>
        
        <View style={styles.mainContent}>
          {renderToggleButton()}
          
          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContainer}
            // Android-specific scroll optimizations
            overScrollMode={Platform.OS === 'android' ? 'never' : 'auto'}
            bounces={Platform.OS === 'ios'}
            removeClippedSubviews={Platform.OS === 'android'}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
          >
            {players.map((playerName, index) => (
              <PlayerScore
                key={`player-${index}`}
                playerName={playerName}
                score={safeScores[index]} // Use safe scores
                showScores={showScores}
                isLeader={safeScores[index] === maxScore && maxScore > 0} // Use safe scores
                streakCount={streaks[index]}
                isHighlighted={currentPlayer === index}
              />
            ))}
          </ScrollView>
        </View>

        {timeLeft !== undefined && (
          <TimerBar
            timeLeft={timeLeft}
            maxTime={maxTime}
            isPaused={isPaused}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Original styles
  wrapper: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  bannerContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderBottomWidth: 2,
    borderColor: '#FFD700',
    paddingBottom: 10,
  },
  // Android-specific banner styling
  bannerContainerAndroid: {
    borderBottomWidth: 1.5, // Slightly thinner border for better appearance
    paddingBottom: 8,
    elevation: 6, // Use elevation for shadow effect
  },
  topDecoration: {
    height: 8,
    width: '100%',
    backgroundColor: '#FFD700',
    overflow: 'hidden',
  },
  lightStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '100%',
  },
  light: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 2,
  },
  // Android-specific light styling
  lightAndroid: {
    width: 5, // Slightly smaller for better performance
    height: 5,
    borderRadius: 2.5,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingRight: 20,
  },
  playerScore: {
    marginHorizontal: 5,
    minWidth: 100,
  },
  scoreContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Android-specific score container styling
  scoreContainerAndroid: {
    padding: 6, // Slightly more compact
    borderWidth: 1, // Thinner border
    elevation: 3, // Use elevation for shadow effect
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scoreWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific player name styling
  playerNameAndroid: {
    fontSize: 14, // Slightly smaller for better Android display
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2, // Use elevation instead of text shadow
  },
  score: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific score styling
  scoreAndroid: {
    fontSize: 22, // Slightly smaller for better Android display
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 3, // Use elevation instead of text shadow
  },
  toggleButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 15,
    marginRight: 10,
  },
  // Android-specific toggle button styling
  toggleButtonAndroid: {
    width: 28, // Slightly smaller
    height: 28,
    borderRadius: 14,
    elevation: 4, // Use elevation for shadow effect
  },
  toggleButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Android-specific toggle button text styling
  toggleButtonTextAndroid: {
    fontSize: 16, // Slightly smaller
    fontWeight: '700', // Android may have issues with certain font weights
  },
  leaderIcon: {
    fontSize: 16,
    marginLeft: 5,
  },
  // Android-specific leader icon styling
  leaderIconAndroid: {
    fontSize: 14, // Slightly smaller for better Android display
  },
  streakIcon: {
    fontSize: 14,
    marginLeft: 5,
  },
  // Android-specific streak icon styling
  streakIconAndroid: {
    fontSize: 12, // Slightly smaller for better Android display
  },

  // Timer-related styles - UPDATED (green bar removed)
  timerContainer: {
    width: '100%',
    position: 'absolute',
    bottom: -2,
    alignItems: 'center',
  },
  
  // GREEN PROGRESS BAR STYLES REMOVED:
  // timerBarBackground and timerBarFill styles deleted
  
  // Game show lights for timer - ENHANCED
  gameShowLights: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '96%',
    position: 'absolute',
    bottom: -5, // Repositioned since no background bar
    alignSelf: 'center',
  },
  gameShowLight: {
    width: 16, // Larger lights for better visibility
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  gameShowLightOn: {
    backgroundColor: '#FFD700', // Gold when active
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    ...Platform.select({
      android: {
        elevation: 6,
      }
    }),
  },
  gameShowLightUrgent: {
    backgroundColor: '#FF3D00', // Red when time is critical
    borderColor: '#FF3D00',
    shadowColor: '#FF3D00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    ...Platform.select({
      android: {
        elevation: 6,
      }
    }),
  },
  
  // Special states
  leaderContainer: {
    borderColor: '#FFD700',
    borderWidth: 2,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  // Android-specific leader container styling
  leaderContainerAndroid: {
    borderWidth: 1.5, // Thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 6, // Use elevation for shadow effect
  },
  hotContainer: {
    borderColor: '#FF4500',
    borderWidth: 2,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  // Android-specific hot container styling
  hotContainerAndroid: {
    borderWidth: 1.5, // Thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 6, // Use elevation for shadow effect
  },
  lightBar: {
    height: 2,
    width: '100%',
    backgroundColor: '#FFD700',
    marginTop: 2,
    opacity: 0.7,
  },
  hotLightBar: {
    backgroundColor: '#FF4500',
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  // Android-specific hot light bar styling
  hotLightBarAndroid: {
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 4, // Use elevation for shadow effect
  },
});

export default memo(ScoreBanner);