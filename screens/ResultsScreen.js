import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ImageBackground, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Animated,
  Platform,
  Dimensions,
  BackHandler,
  Vibration,
  TouchableNativeFeedback,
  Alert,
  Share
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useGame } from '../Context/GameContext';
import { useFirebase } from '../Context/multiplayer/FirebaseContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');
const CROWN_SIZE = Platform.OS === 'android' ? 36 : 40; // Slightly smaller crown on Android

// Floating stars component for winner celebration with Android optimizations
const FloatingStars = () => {
  const stars = Array(Platform.OS === 'android' ? 6 : 8).fill(0).map(() => ({
    translateY: useRef(new Animated.Value(0)).current,
    translateX: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
    rotate: useRef(new Animated.Value(0)).current,
  }));

  useEffect(() => {
    // Platform-specific animation durations for better Android performance
    const baseDuration = Platform.OS === 'android' ? 2500 : 3000;
    const delayIncrement = Platform.OS === 'android' ? 400 : 500;
    
    stars.forEach((star, index) => {
      const startPositionX = (index % 2 === 0 ? -1 : 1) * (Math.random() * 100 + 50);
      const animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(star.translateY, {
              toValue: -200 - (index * 30),
              duration: baseDuration + (index * delayIncrement),
              useNativeDriver: true,
            }),
            Animated.timing(star.translateX, {
              toValue: startPositionX,
              duration: baseDuration + (index * delayIncrement),
              useNativeDriver: true,
            }),
            Animated.timing(star.scale, {
              toValue: 1,
              duration: Platform.OS === 'android' ? 800 : 1000, // Faster scaling on Android
              useNativeDriver: true,
            }),
            Animated.timing(star.rotate, {
              toValue: 1,
              duration: baseDuration + (index * delayIncrement),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(star.scale, {
            toValue: 0,
            duration: Platform.OS === 'android' ? 400 : 500, // Faster fade out on Android
            useNativeDriver: true,
          }),
        ])
      );
      // Stagger the start of animations
      setTimeout(() => animation.start(), index * (Platform.OS === 'android' ? 150 : 200));
    });
    
    // Clean up animations on unmount
    return () => {
      stars.forEach(star => {
        star.translateY.stopAnimation();
        star.translateX.stopAnimation();
        star.scale.stopAnimation();
        star.rotate.stopAnimation();
      });
    };
  }, []);

  return (
    <View style={styles.starsContainer}>
      {stars.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.star,
            {
              transform: [
                { translateY: star.translateY },
                { translateX: star.translateX },
                { scale: star.scale },
                {
                  rotate: star.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons 
            name="star" 
            size={Platform.OS === 'android' ? 26 : 30} // Smaller stars on Android
            color="#FFD700" 
          />
        </Animated.View>
      ))}
    </View>
  );
};

// Shimmer effect component for winner's card with Android optimizations
const ShimmerEffect = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    // Platform-specific animation durations for better Android performance
    const opacityDuration = Platform.OS === 'android' ? 1200 : 1500;
    const translationDuration = Platform.OS === 'android' ? 1600 : 2000;
    
    const shimmerOpacity = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: opacityDuration,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: opacityDuration,
          useNativeDriver: true,
        }),
      ])
    );

    const shimmerTranslation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: width,
          duration: translationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -width,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerOpacity.start();
    shimmerTranslation.start();
    
    // Clean up animations on unmount
    return () => {
      shimmerAnim.stopAnimation();
      translateX.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.shimmerContainer}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1],
            }),
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

const ResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { hardReset } = useGame();
  const { playerData = [], packStats, isMultiplayer = false } = route.params || {};
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const bluetooth = useBluetooth();
  const firebase = useFirebase(); // Add Firebase context
  const { resetGame } = useGame();

  // State for Firebase multiplayer rematch voting
  const [rematchVotes, setRematchVotes] = useState({});
  const [showRematchOption, setShowRematchOption] = useState(isMultiplayer);
  
  // State for background music
  const [resultsMusic, setResultsMusic] = useState(null);
  const [musicIsPlaying, setMusicIsPlaying] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  // Determine which multiplayer system to use
  const isFirebaseMultiplayer = !!firebase?.currentRoom;
  const isBluetoothMultiplayer = isMultiplayer && !isFirebaseMultiplayer;

  // Handle screen focus state
  useFocusEffect(
    React.useCallback(() => {
      setIsFocused(true);
      
      return () => {
        setIsFocused(false);
        stopResultsMusic();
      };
    }, [])
  );

  // Handle Android back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (Platform.OS === 'android') {
          handleReturnHome();
          return true; // Prevent default behavior
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  // Initialize and play background music
  useEffect(() => {
    let isMounted = true;
    let backgroundMusic = null;

    const loadAndPlayMusic = async () => {
      try {
        // Create a new sound instance
        backgroundMusic = new Audio.Sound();

        // Configure audio mode with numeric constants
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          interruptionModeIOS: 1, // This is Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // This is Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
          playThroughEarpieceAndroid: false,
        });
        
        console.log('Loading results screen music...');
        await backgroundMusic.loadAsync(require('../assets/Sounds/ResultsScreenBackground.mp3'));
        await backgroundMusic.setIsLoopingAsync(true);
        await backgroundMusic.setVolumeAsync(0.5);
        
        // Check if component is still mounted before updating state
        if (isMounted) {
          setResultsMusic(backgroundMusic);
          
          // Play the music with a small delay to ensure it's fully loaded
          setTimeout(async () => {
            try {
              // Check status before playing
              const status = await backgroundMusic.getStatusAsync().catch(() => ({ isLoaded: false }));
              if (status.isLoaded && isMounted && isFocused) {
                await backgroundMusic.playAsync();
                setMusicIsPlaying(true);
                console.log('Results screen music started');
              }
            } catch (playError) {
              console.error('Error playing results music:', playError);
            }
          }, 300);
        }
      } catch (error) {
        console.error('Error loading results music:', error);
      }
    };

    if (isFocused) {
      loadAndPlayMusic();
    }

    // Clean up function to stop and unload the music when the component unmounts
    return () => {
      isMounted = false;
      const cleanup = async () => {
        try {
          if (backgroundMusic) {
            console.log('Cleaning up results music');
            await backgroundMusic.stopAsync().catch(() => {});
            await backgroundMusic.unloadAsync().catch(() => {});
            if (isMounted) {
              setMusicIsPlaying(false);
            }
          }
        } catch (error) {
          console.error('Error cleaning up results music:', error);
        }
      };
      cleanup();
    };
  }, [isFocused]);

  // Function to stop the background music
  const stopResultsMusic = async () => {
    if (resultsMusic) {
      try {
        // Check if it's loaded first
        const status = await resultsMusic.getStatusAsync().catch(() => ({ isLoaded: false }));
        if (status.isLoaded) {
          await resultsMusic.stopAsync();
          setMusicIsPlaying(false);
          console.log('Results music stopped');
        }
      } catch (error) {
        console.error('Error stopping results music:', error);
      }
    }
  };

  // Handle sharing results
  const handleShareResults = async () => {
    try {
      // Format results for sharing
      const resultsText = `TriviaDare Results:\n\n${playerData
        .map((player, index) => `${index + 1}. ${player.player}: ${player.score} points`)
        .join('\n')}\n\nCome play TriviaDare with me!`;
      
      await Share.share({
        message: resultsText,
        title: 'TriviaDare Results'
      });
    } catch (error) {
      console.error('Error sharing results:', error);
      Alert.alert('Error', 'Could not share results.');
    }
  };

  useEffect(() => {
    // Platform-specific spring animation parameters for smoother Android animations
    const friction = Platform.OS === 'android' ? 3 : 2;
    const tension = Platform.OS === 'android' ? 30 : 40;
    
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: friction,
      tension: tension,
      useNativeDriver: true
    }).start();
    
    // Vibrate on Android when results appear
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(100);
      } catch (e) {
        console.log('Vibration not available');
      }
    }
    
    // Clean up animations on unmount
    return () => {
      scaleAnim.stopAnimation();
    };
  }, []);

  // Calculate the total votes and percentage for multiplayer rematch
  const getRematchStats = () => {
    if (isFirebaseMultiplayer) {
      // Firebase implementation
      const players = firebase?.players || {};
      const totalPlayers = Object.keys(players).length;
      
      // Count votes from Firebase players
      let yesCount = 0;
      let totalVotes = 0;
      
      Object.values(players).forEach(player => {
        if (player.rematchVote !== undefined) {
          totalVotes++;
          if (player.rematchVote === true) {
            yesCount++;
          }
        }
      });
      
      return {
        yesVotes: yesCount,
        noVotes: totalVotes - yesCount,
        totalVotes: totalVotes,
        requiredPlayers: totalPlayers,
        votingProgress: totalPlayers > 0 ? totalVotes / totalPlayers : 0
      };
    } else {
      // Bluetooth implementation
      const totalVotes = Object.values(rematchVotes).length;
      const yesVotes = Object.values(rematchVotes).filter(vote => vote === true).length;
      const noVotes = totalVotes - yesVotes;
      const requiredPlayers = playerData?.length || 1;
      const votingProgress = requiredPlayers > 0 ? totalVotes / requiredPlayers : 0;
      
      return {
        yesVotes,
        noVotes,
        totalVotes,
        requiredPlayers,
        votingProgress
      };
    }
  };
  
  const { yesVotes, noVotes, totalVotes, requiredPlayers, votingProgress } = getRematchStats();
  
  // Handle voting for rematch in multiplayer
  const handleRematchVote = async (wantsRematch) => {
    // Add Android haptic feedback
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(50);
      } catch (e) {
        console.log('Vibration not available');
      }
    }
    
    if (isFirebaseMultiplayer) {
      // Firebase implementation
      try {
        await firebase.updatePlayerData({
          rematchVote: wantsRematch
        });
        
        // If rematch has majority votes, handle it (host only)
        if (firebase.isHost) {
          const stats = getRematchStats();
          if (stats.totalVotes === stats.requiredPlayers && stats.yesVotes > stats.noVotes) {
            handlePlayAgain();
          } else if (stats.totalVotes === stats.requiredPlayers && stats.yesVotes <= stats.noVotes) {
            handleReturnHome();
          }
        }
      } catch (error) {
        console.error('Error updating rematch vote in Firebase:', error);
      }
    } else if (isBluetoothMultiplayer && bluetooth) {
      // Bluetooth implementation
      // Add local vote
      const playerName = bluetooth.playerName || 'unknown';
      setRematchVotes(prev => ({
        ...prev,
        [playerName]: wantsRematch
      }));
      
      // Send vote to other players
      if (bluetooth.sendData) {
        bluetooth.sendData({
          type: 'rematchVote',
          playerName,
          vote: wantsRematch
        });
      }
    }
  };

  // Listen for rematch votes from Firebase
  useEffect(() => {
    if (isFirebaseMultiplayer && firebase.isHost) {
      // Check if all players have voted
      const stats = getRematchStats();
      if (stats.totalVotes === stats.requiredPlayers) {
        if (stats.yesVotes > stats.noVotes) {
          // Majority wants to play again
          handlePlayAgain();
        } else {
          // Majority wants to return home
          handleReturnHome();
        }
      }
    }
  }, [firebase.players]);

  // Listen for rematch votes from other players (Bluetooth)
  useEffect(() => {
    if (isBluetoothMultiplayer && bluetooth && bluetooth.onDataReceived) {
      const handleData = (data) => {
        if (data && data.type === 'rematchVote') {
          setRematchVotes(prev => ({
            ...prev,
            [data.playerName]: data.vote
          }));
        }
      };
      
      // Set up listener
      bluetooth.onDataReceived = handleData;
      
      return () => {
        bluetooth.onDataReceived = null;
      };
    }
  }, [isBluetoothMultiplayer, bluetooth]);

  // Check if enough votes to start rematch (Bluetooth)
  useEffect(() => {
    if (isBluetoothMultiplayer && totalVotes === requiredPlayers && yesVotes > noVotes) {
      handlePlayAgain();
    }
  }, [rematchVotes]);

  const handleReturnHome = async () => {
    try {
      // Stop the music before navigating
      await stopResultsMusic();
      
      // If in Firebase multiplayer, leave the room
      if (isFirebaseMultiplayer) {
        try {
          await firebase.updateGameState({
            gameStatus: 'finished',
            finishedAt: new Date().toISOString()
          });
          
          // Leave room if not host, otherwise wait for players to leave
          if (!firebase.isHost) {
            await firebase.leaveRoom();
          }
        } catch (error) {
          console.error('Error updating game state in Firebase:', error);
        }
      }
      
      // If in Bluetooth multiplayer, send event that we're returning to lobby
      if (isBluetoothMultiplayer && bluetooth && bluetooth.sendData) {
        bluetooth.sendData({
          type: 'returnToLobby'
        });
      }
      
      // Reset game state
      await hardReset();
      
      // Navigate to home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Error returning to home:', error);
      navigation.navigate('Home');
    }
  };

  const handlePlayAgain = async () => {
    try {
      // Stop the music before navigating
      await stopResultsMusic();
      
      // Reset game state
      await hardReset();
      
      // Firebase multiplayer implementation
      if (isFirebaseMultiplayer) {
        if (firebase.isHost) {
          try {
            // Reset player scores and ready states
            const playerPromises = Object.keys(firebase.players || {}).map(playerId => {
              return firebase.updatePlayerData({
                id: playerId,
                score: 0,
                ready: false,
                rematchVote: undefined
              });
            });
            
            await Promise.all(playerPromises);
            
            // Reset game to waiting state
            await firebase.updateGameState({
              gameStatus: 'waiting',
              currentQuestionIndex: 0,
              currentPlayerId: null,
              performingDare: false,
              currentDarePlayerId: null
            });
            
            // Navigate back to lobby
            navigation.navigate('LobbyScreen', { isHost: true });
          } catch (error) {
            console.error('Error resetting game in Firebase:', error);
            Alert.alert('Error', 'Failed to reset game. Returning to home screen.');
            handleReturnHome();
          }
        } else {
          // Non-host players just return to lobby
          navigation.navigate('LobbyScreen', { isHost: false });
        }
      }
      // Bluetooth multiplayer implementation
      else if (isBluetoothMultiplayer) {
        // In Bluetooth multiplayer, return to the lobby to start a new game
        navigation.reset({
          index: 0,
          routes: [
            { name: 'Home' },
            { name: 'MultiplayerConnection' },
            { name: 'LobbyScreen' }
          ],
        });
      } 
      // Single player implementation
      else {
        // In single player, go to pack selection
        navigation.reset({
          index: 0,
          routes: [
            { name: 'Home' },
            { name: 'TriviaPackSelectionScreen' }
          ],
        });
      }
    } catch (error) {
      console.error('Error starting new game:', error);
      navigation.navigate('TriviaPackSelectionScreen');
    }
  };

  // Sort players by score
  const sortedPlayers = [...(playerData || [])].sort((a, b) => b.score - a.score);

  // Platform-specific button rendering
  const renderButton = (onPress, style, text, voteCount = null) => {
    if (Platform.OS === 'android') {
      return (
        <View style={[styles.buttonWrapper, style]}>
          <TouchableNativeFeedback
            onPress={onPress}
            background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
          >
            <View style={[styles.button, style, styles.buttonAndroid]}>
              <Text style={[styles.buttonText, styles.buttonTextAndroid]}>{text}</Text>
              {voteCount !== null && (
                <Text style={[styles.voteCount, styles.voteCountAndroid]}>{voteCount}</Text>
              )}
            </View>
          </TouchableNativeFeedback>
        </View>
      );
    }
    
    return (
      <TouchableOpacity 
        style={[styles.button, style]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>{text}</Text>
        {voteCount !== null && (
          <Text style={styles.voteCount}>{voteCount}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground 
      source={require('../assets/questionscreen.jpg')} 
      style={styles.fullscreen}
      // Android-specific image loading optimization
      {...(Platform.OS === 'android' ? { 
        resizeMethod: 'resize',
        resizeMode: 'cover'
      } : {})}
    >
      {isMultiplayer && (
        <View style={[
          styles.multiplayerBanner,
          Platform.OS === 'android' ? styles.multiplayerBannerAndroid : null
        ]}>
          <Ionicons name="people" size={18} color="#FFFFFF" />
          <Text style={[
            styles.multiplayerText,
            Platform.OS === 'android' ? styles.multiplayerTextAndroid : null
          ]}>
            {isFirebaseMultiplayer ? 'Firebase Multiplayer' : 'Multiplayer Mode'}
          </Text>
        </View>
      )}
      
      <ScrollView 
        style={styles.container}
        // Android-specific ScrollView optimizations
        overScrollMode={Platform.OS === 'android' ? 'never' : 'auto'}
        bounces={Platform.OS === 'ios'}
        removeClippedSubviews={Platform.OS === 'android'}
      >
        {sortedPlayers.map((player, index) => {
          const isWinner = index === 0;
          const isRunnerUp = index === 1;
          const isThird = index === 2;
          
          // Platform-specific animation durations
          const animationDuration = Platform.OS === 'android' ? 1000 : 1200;
          const pulseDuration = Platform.OS === 'android' ? 1200 : 1500;
          
          return (
            <Animatable.View
              key={`${player.player || player.name}-${index}`}
              animation={isWinner ? "bounceIn" : "fadeInUp"}
              delay={index * (Platform.OS === 'android' ? 200 : 300)} // Faster delay for Android
              duration={animationDuration}
            >
              <LinearGradient
                colors={isWinner 
                  ? ['#ffd700', '#ff8c00', '#ffd700'] 
                  : isRunnerUp 
                    ? ['#E8E8E8', '#C0C0C0', '#E8E8E8']
                    : isThird 
                      ? ['#CD7F32', '#8B4513', '#CD7F32']
                      : ['#282828', '#484848', '#282828']}
                style={[
                  styles.playerContainer, 
                  isWinner && styles.winnerContainer,
                  // Platform-specific styling
                  Platform.OS === 'android' && styles.playerContainerAndroid,
                  Platform.OS === 'android' && isWinner && styles.winnerContainerAndroid
                ]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
              >
                {isWinner && <FloatingStars />}
                {isWinner && <ShimmerEffect />}
                
                <Animatable.View 
                  style={styles.rankContainer}
                  animation={isWinner ? "pulse" : "fadeIn"}
                  iterationCount={isWinner ? "infinite" : 1}
                  duration={pulseDuration}
                >
                  <Text style={[
                    styles.rankText, 
                    isWinner && styles.winnerRank,
                    // Platform-specific styling
                    Platform.OS === 'android' && styles.rankTextAndroid,
                    Platform.OS === 'android' && isWinner && styles.winnerRankAndroid
                  ]}>
                    #{index + 1}
                  </Text>
                  {isWinner && (
                    <Animatable.View 
                      animation="swing" 
                      iterationCount="infinite" 
                      duration={Platform.OS === 'android' ? 1800 : 2000} // Slightly faster on Android
                      style={styles.trophyContainer}
                    >
                      <Ionicons name="trophy" size={CROWN_SIZE} color="#FFD700" />
                    </Animatable.View>
                  )}
                </Animatable.View>

                <View style={styles.playerInfo}>
                  <Text style={[
                    styles.playerName, 
                    isWinner && styles.winnerText,
                    // Platform-specific styling
                    Platform.OS === 'android' && styles.playerNameAndroid,
                    Platform.OS === 'android' && isWinner && styles.winnerTextAndroid
                  ]}>
                    {player.player || player.name}
                    {isWinner && ' 👑'}
                  </Text>
                  <Animatable.Text 
                    style={[
                      styles.playerScore, 
                      isWinner && styles.winnerScore,
                      // Platform-specific styling
                      Platform.OS === 'android' && styles.playerScoreAndroid,
                      Platform.OS === 'android' && isWinner && styles.winnerScoreAndroid
                    ]}
                    animation={isWinner ? "flash" : "fadeIn"}
                    iterationCount={isWinner ? "infinite" : 1}
                    duration={Platform.OS === 'android' ? 1800 : 2000} // Slightly faster on Android
                  >
                    {player.score} pts
                  </Animatable.Text>
                </View>

                {isWinner && (
                  <Animatable.View 
                    style={[
                      styles.winnerBadge,
                      // Platform-specific styling
                      Platform.OS === 'android' && styles.winnerBadgeAndroid
                    ]}
                    animation="pulse" 
                    easing="ease-out" 
                    iterationCount="infinite"
                    duration={pulseDuration}
                  >
                    <Text style={[
                      styles.winnerBadgeText,
                      // Platform-specific styling
                      Platform.OS === 'android' && styles.winnerBadgeTextAndroid
                    ]}>CHAMPION!</Text>
                  </Animatable.View>
                )}
              </LinearGradient>
            </Animatable.View>
          );
        })}
      </ScrollView>
      
      <Animatable.View 
        style={[
          styles.buttonContainer,
          // Platform-specific styling
          Platform.OS === 'android' && styles.buttonContainerAndroid
        ]}
        animation="bounceIn"
        delay={Platform.OS === 'android' ? 800 : 1000} // Faster delay for Android
      >
        {/* Share Results Button */}
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShareResults}
        >
          <Ionicons name="share-social" size={24} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Results</Text>
        </TouchableOpacity>
        
        {isMultiplayer ? (
          // Multiplayer buttons
          <>
            {showRematchOption ? (
              <>
                {renderButton(
                  () => handleRematchVote(true),
                  styles.rematchButton,
                  "Vote for Rematch",
                  `${yesVotes} of ${requiredPlayers} votes`
                )}
                
                {renderButton(
                  () => handleRematchVote(false),
                  styles.returnButton,
                  isFirebaseMultiplayer ? "Vote to Return to Home" : "Vote to Return to Lobby",
                  `${noVotes} of ${requiredPlayers} votes`
                )}
                
                {totalVotes > 0 && (
                  <View style={styles.votingProgressContainer}>
                    <View style={[
                      styles.votingProgressBackground,
                      // Platform-specific styling
                      Platform.OS === 'android' && styles.votingProgressBackgroundAndroid
                    ]}>
                      <View 
                         style={[
                          styles.votingProgressFill,
                          { width: `${votingProgress * 100}%` },
                          // Platform-specific styling
                          Platform.OS === 'android' && styles.votingProgressFillAndroid
                        ]} 
                      />
                    </View>
                    <Text style={[
                      styles.votingText,
                      // Platform-specific styling
                      Platform.OS === 'android' && styles.votingTextAndroid
                    ]}>
                      Voting: {totalVotes} of {requiredPlayers} players voted
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {renderButton(
                  handlePlayAgain,
                  styles.playAgainButton,
                  isFirebaseMultiplayer && !firebase.isHost 
                    ? "Waiting for Host" 
                    : "Play Again"
                )}
                
                {renderButton(
                  handleReturnHome,
                  styles.returnButton,
                  isFirebaseMultiplayer ? "Return to Home" : "Return to Lobby"
                )}
              </>
            )}
          </>
        ) : (
          // Single player buttons
          <>
            {renderButton(
              handlePlayAgain,
              styles.playAgainButton,
              "Play Again!"
            )}
            
            {renderButton(
              handleReturnHome,
              styles.returnButton,
              "Return Home"
            )}
          </>
        )}
      </Animatable.View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    resizeMode: 'cover',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  container: {
    flex: 1,
    paddingVertical: 20,
  },
  multiplayerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 100, 255, 0.7)',
    paddingVertical: 5,
    width: '100%',
    marginBottom: 5,
  },
  // Android-specific multiplayer banner styling
  multiplayerBannerAndroid: {
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 100, 255, 0.8)', // Slightly more opaque for better visibility
    elevation: 3, // Add elevation for better look
  },
  multiplayerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific multiplayer text styling
  multiplayerTextAndroid: {
    fontSize: 14, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2, // Use elevation instead of text shadow
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 25,
    marginHorizontal: 15,
    borderRadius: 50,
    marginBottom: 20,
    marginTop: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'visible',
  },
  // Android-specific player container styling
  playerContainerAndroid: {
    padding: 20, // Slightly more compact
    borderWidth: 1.5, // Thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 8, // Use elevation for shadow effect
  },
  winnerContainer: {
    borderWidth: 4,
    borderColor: '#FFD700',
    transform: [{ scale: 1.05 }],
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  // Android-specific winner container styling
  winnerContainerAndroid: {
    borderWidth: 3, // Slightly thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 12, // Higher elevation for emphasis
    transform: [{ scale: 1.03 }], // Slightly smaller scale for better performance
  },
  rankContainer: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  // Android-specific rank text styling
  rankTextAndroid: {
    fontSize: 32, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 4, // Use elevation instead of text shadow
  },
  winnerRank: {
    fontSize: 42,
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowRadius: 10,
  },
  // Android-specific winner rank styling
  winnerRankAndroid: {
    fontSize: 38, // Slightly smaller text
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 6, // Use elevation instead of text shadow
  },
  playerInfo: {
    flex: 1,
    marginLeft: 20,
  },
  playerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  // Android-specific player name styling
  playerNameAndroid: {
    fontSize: 28, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 4, // Use elevation instead of text shadow
  },
  playerScore: {
    fontSize: 28,
    color: '#00FF00',
    marginTop: 8,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  // Android-specific player score styling
  playerScoreAndroid: {
    fontSize: 24, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    marginTop: 6, // Slightly less margin
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 3, // Use elevation instead of text shadow
  },
  winnerText: {
    fontSize: 36,
    color: '#FFFFFF',
  },
  // Android-specific winner text styling
  winnerTextAndroid: {
    fontSize: 32, // Slightly smaller text
  },
  winnerScore: {
    fontSize: 32,
    color: '#00FF00',
  },
  // Android-specific winner score styling
  winnerScoreAndroid: {
    fontSize: 28, // Slightly smaller text
  },
  winnerBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    position: 'absolute',
    right: 10,
    top: 3,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    transform: [{ rotate: '15deg' }],
    zIndex: 1,
  },
  // Android-specific winner badge styling
  winnerBadgeAndroid: {
    paddingHorizontal: 16, // Slightly smaller padding
    paddingVertical: 8, // Slightly smaller padding
    borderRadius: 16, // Smaller radius
    right: 5, // Adjust position
    top: 2, // Adjust position
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 10, // Use elevation for shadow effect
  },
  winnerBadgeText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Android-specific winner badge text styling
  winnerBadgeTextAndroid: {
    fontSize: 14, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  // Android-specific button container styling
  buttonContainerAndroid: {
    padding: 16, // Slightly smaller padding
  },
  // Button wrapper for Android TouchableNativeFeedback
  buttonWrapper: {
    borderRadius: 30,
    marginBottom: 10,
    overflow: 'hidden',
  },
  button: {
    padding: 20,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 2,
    marginBottom: 10,
  },
  // Android-specific button styling
  buttonAndroid: {
    padding: 18, // Slightly smaller padding
    borderRadius: 0, // No border radius because it's applied to wrapper
    marginBottom: 0, // No margin because it's applied to wrapper
    borderWidth: 1.5, // Thinner border
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 6, // Use elevation for shadow effect
  },
  playAgainButton: {
    backgroundColor: '#FFD700',
    borderColor: '#FFA500',
  },
  returnButton: {
    backgroundColor: '#4682B4',
    borderColor: '#1E90FF',
  },
  rematchButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  buttonText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  // Android-specific button text styling
  buttonTextAndroid: {
    fontSize: 22, // Slightly smaller text
    fontWeight: '700', // Android may have issues with certain font weights
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 3, // Use elevation instead of text shadow
  },
  voteCount: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Android-specific vote count styling
  voteCountAndroid: {
    fontSize: 14, // Slightly smaller text
    marginTop: 4, // Slightly less margin
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2, // Use elevation instead of text shadow
  },
  votingProgressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  votingProgressBackground: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  // Android-specific voting progress background styling
  votingProgressBackgroundAndroid: {
    height: 8, // Slightly smaller height
    borderRadius: 4, // Smaller radius
  },
  votingProgressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  // Android-specific voting progress fill styling
  votingProgressFillAndroid: {
    backgroundColor: '#FFC107', // Slightly different gold shade for better Android appearance
  },
  votingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 5,
    fontStyle: 'italic',
  },
  // Android-specific voting text styling
  votingTextAndroid: {
    fontSize: 12, // Slightly smaller text
    marginTop: 4, // Slightly less margin
  },
  starsContainer: {
    position: 'absolute',
    top: -50,
    left: -100,
    right: -100,
    bottom: -50,
    zIndex: 2,
    pointerEvents: 'none',
  },
  star: {
    position: 'absolute',
    zIndex: 2,
    top: '50%',
    left: '50%',
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 50,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    transform: [{ skewX: '-20deg' }],
    width: '100%',
  },
  trophyContainer: {
    marginTop: 5,
  },
});

export default ResultsScreen;