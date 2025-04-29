import React, { useState, useEffect, memo } from 'react';
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

// AnimatedScore component with Android optimizations
const AnimatedScore = memo(({ score, isLeader }) => {
  const animatedValue = React.useRef(new Animated.Value(1)).current;
  const [prevScore, setPrevScore] = useState(score);

  useEffect(() => {
    if (score !== prevScore) {
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
      setPrevScore(score);
    }
    
    // Cleanup animation on unmount
    return () => {
      animatedValue.stopAnimation();
    };
  }, [score]);

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
        {score}
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

// TimerBar component with Android optimizations
const TimerBar = memo(({ timeLeft, maxTime, currentScore, isPaused }) => {
  const progress = timeLeft / maxTime;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const progressAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isPaused) {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: Platform.OS === 'android' ? 800 : 1000, // Faster animation on Android
        useNativeDriver: true,
        easing: Easing.linear,
      }).start();

      if (timeLeft <= 5) {
        // Platform-specific animation parameters
        const scaleDuration = Platform.OS === 'android' ? 150 : 200; // Faster on Android
        
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: Platform.OS === 'android' ? 1.08 : 1.1, // Less scale on Android
            duration: scaleDuration,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: scaleDuration,
            useNativeDriver: true,
          }),
        ]).start();
        
        // Add vibration feedback on Android for low time
        if (Platform.OS === 'android' && timeLeft === 5) {
          try {
            Vibration.vibrate(50);
          } catch (e) {
            console.log('Vibration not available');
          }
        }
      }
    }
    
    // Cleanup animations on unmount
    return () => {
      progressAnim.stopAnimation();
      scaleAnim.stopAnimation();
    };
  }, [timeLeft, isPaused]);

  return (
    <View style={styles.timerContainer}>
      <View style={styles.timerBarBackground}>
        <Animated.View
          style={[
            styles.timerBarFill,
            {
              transform: [
                { scaleX: progressAnim },
                { scale: scaleAnim }
              ],
              backgroundColor: timeLeft > maxTime / 3 ? '#76FF03' : '#FF3D00',
            },
            // Platform-specific timer bar styling
            Platform.OS === 'android' ? styles.timerBarFillAndroid : null
          ]}
        />
      </View>
      <View style={[
        styles.timerInfo,
        // Platform-specific timer info styling
        Platform.OS === 'android' ? styles.timerInfoAndroid : null
      ]}>
        <Text style={[
          styles.timerInfoText,
          // Platform-specific timer text styling
          Platform.OS === 'android' ? styles.timerInfoTextAndroid : null
        ]}>{timeLeft}s • {currentScore}</Text>
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

// PlayerScore component with Android optimizations
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
            score={score} 
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

// Main ScoreBanner component with Android optimizations
const ScoreBanner = ({ 
  players = [], 
  scores = [], 
  showScores = true, 
  toggleScores,
  currentPlayer = null,
  timeLeft,
  maxTime,
  currentScore,
  isPaused = false
}) => {
  const [streaks, setStreaks] = useState(new Array(players.length).fill(0));
  const [previousScores, setPreviousScores] = useState(new Array(players.length).fill(0));
  const maxScore = Math.max(...scores);

  useEffect(() => {
    if (currentPlayer !== null) {
      const newStreaks = [...streaks];
      
      if (scores[currentPlayer] > previousScores[currentPlayer]) {
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

      players.forEach((_, index) => {
        if (index !== currentPlayer) {
          newStreaks[index] = 0;
        }
      });

      setStreaks(newStreaks);
      setPreviousScores([...scores]);
    }
  }, [scores, currentPlayer]);

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
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContainer}
            // Android-specific scroll optimizations
            overScrollMode={Platform.OS === 'android' ? 'never' : 'auto'}
            bounces={Platform.OS === 'ios'}
            removeClippedSubviews={Platform.OS === 'android'}
          >
            {players.map((playerName, index) => (
              <PlayerScore
                key={`player-${index}`}
                playerName={playerName}
                score={scores[index]}
                showScores={showScores}
                isLeader={scores[index] === maxScore && maxScore > 0}
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
            currentScore={currentScore}
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
    justifyContent: 'space-between',
    paddingHorizontal: 5,
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

  // Timer-related styles
  timerContainer: {
    width: '100%',
    position: 'absolute',
    bottom: -2,
    alignItems: 'center',
  },
  timerBarBackground: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
  },
  timerBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    height: '100%',
    width: '100%',  // Set to 100% since we're using transform
    transformOrigin: 'left',  // This makes the scale transform start from the left
  },
  // Android-specific timer bar fill styling
  timerBarFillAndroid: {
    height: '100%',
  },
  timerInfo: {
    position: 'absolute',
    right: 10,
    top: -22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  // Android-specific timer info styling
  timerInfoAndroid: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5, // Thinner border
    elevation: 4, // Use elevation for shadow effect
  },
  timerInfoText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific timer info text styling
  timerInfoTextAndroid: {
    fontSize: 12, // Slightly smaller for better Android display
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2, // Use elevation instead of text shadow
  },
  timerLights: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    width: '100%',
    justifyContent: 'space-evenly',
    paddingHorizontal: 10,
  },
  timerLight: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
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