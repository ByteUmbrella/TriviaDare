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
  Share,
  Linking
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useGame } from '../Context/GameContext';
import { useFirebase } from '../Context/multiplayer/FirebaseContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');
const CROWN_SIZE = Platform.OS === 'android' ? 28 : 32;

// Helper function to extract pack name from packStats
const getPackName = (packStatsObj, routeParams) => {
  // First check direct route params (highest priority)
  if (routeParams?.packName) return routeParams.packName;
  if (routeParams?.selectedPack) return routeParams.selectedPack;
  
  // Check if packStatsObj is a direct string (the pack name itself)
  if (typeof packStatsObj === 'string') return packStatsObj;
  
  // Check if packStatsObj is missing or null
  if (!packStatsObj) return "Trivia Pack";
  
  // Check packStatsObj properties
  if (packStatsObj.packName) return packStatsObj.packName;
  if (packStatsObj.name) return packStatsObj.name;
  if (packStatsObj.selectedPack) return packStatsObj.selectedPack;
  
  // Check for packId and then match it to name
  const packId = packStatsObj.packId || packStatsObj.selectedPackId || packStatsObj.id;
  if (packId) {
    // Match the ID to the name using a lookup table
    const packIdToName = {
      'entertainment': 'Entertainment',
      'science': 'Science',
      'history': 'History',
      'sports': 'Sports',
      'art': 'Art & Literature',
      'geography': 'Geography',
      'music': 'Music',
      'technology': 'Technology',
      'harrypotter': 'Harry Potter Movies',
      'marvelcinamaticuniverse': 'Marvel Cinematic Universe',
      'starwars': 'Star Wars',
      'disneyanimatedmovies': 'Disney Animated Movies',
      'thelordoftherings': 'The Lord of the Rings',
      'pixar': 'Pixar Movies',
      'friends': 'Friends Sitcom',
      'videogames': 'Video Games',
      'howimetyourmother': 'How I Met Your Mother',
      'theoffice': 'The Office',
      'themepark': 'Theme Parks'
    };
    
    if (packIdToName[packId]) return packIdToName[packId];
  }
  
  // Check nested objects
  if (packStatsObj.pack) {
    if (typeof packStatsObj.pack === 'string') return packStatsObj.pack;
    if (packStatsObj.pack && packStatsObj.pack.name) return packStatsObj.pack.name;
  }
  
  if (packStatsObj.packInfo) {
    if (typeof packStatsObj.packInfo === 'string') return packStatsObj.packInfo;
    if (packStatsObj.packInfo && packStatsObj.packInfo.name) return packStatsObj.packInfo.name;
  }
  
  // Default fallback
  return "Trivia Pack";
};

// Create shortened app store links with icons
const getAppStoreLinks = () => {
  // Use short links for both stores
  const appStoreLink = "https://apple.co/triviadare"; // Replace with your actual short link
  const playStoreLink = "https://bit.ly/triviadare-android"; // Replace with your actual short link
  
  return {
    ios: `📱 iOS: ${appStoreLink}`,
    android: `🤖 Android: ${playStoreLink}`,
    both: `📱 iOS: ${appStoreLink} | 🤖 Android: ${playStoreLink}`
  };
};

// Floating stars component for winner celebration
const FloatingStars = () => {
  const stars = Array(Platform.OS === 'android' ? 4 : 6).fill(0).map(() => ({
    translateY: useRef(new Animated.Value(0)).current,
    translateX: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
    rotate: useRef(new Animated.Value(0)).current,
  }));

  useEffect(() => {
    stars.forEach((star, index) => {
      const startPositionX = (index % 2 === 0 ? -1 : 1) * (Math.random() * 50 + 25);
      const animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(star.translateY, {
              toValue: -100 - (index * 15),
              duration: 2000 + (index * 300),
              useNativeDriver: true,
            }),
            Animated.timing(star.translateX, {
              toValue: startPositionX,
              duration: 2000 + (index * 300),
              useNativeDriver: true,
            }),
            Animated.timing(star.scale, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(star.rotate, {
              toValue: 1,
              duration: 2000 + (index * 300),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(star.scale, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      setTimeout(() => animation.start(), index * 100);
    });
    
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
            size={Platform.OS === 'android' ? 22 : 26} 
            color="#FFD700" 
          />
        </Animated.View>
      ))}
    </View>
  );
};

// Helper function to format numbers with commas
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Helper function to get podium styles based on placement
const getPodiumStyles = (rank, totalPlayers) => {
  const baseHeight = Platform.OS === 'android' ? 65 : 75;
  const baseFontSize = Platform.OS === 'android' ? 20 : 24;
  const baseScoreSize = Platform.OS === 'android' ? 16 : 18;
  const basePadding = Platform.OS === 'android' ? 10 : 12;
  
  switch (rank) {
    case 0: // 1st place
      return {
        minHeight: baseHeight + 30,
        fontSize: baseFontSize + 6,
        scoreSize: baseScoreSize + 4,
        padding: basePadding + 4,
        marginVertical: 6,
        scale: 1.0,
      };
    case 1: // 2nd place
      return {
        minHeight: baseHeight + 20,
        fontSize: baseFontSize + 3,
        scoreSize: baseScoreSize + 2,
        padding: basePadding + 2,
        marginVertical: 4,
        scale: 0.98,
      };
    case 2: // 3rd place
      return {
        minHeight: baseHeight + 10,
        fontSize: baseFontSize + 1,
        scoreSize: baseScoreSize + 1,
        padding: basePadding + 1,
        marginVertical: 3,
        scale: 0.96,
      };
    default: // 4th and below
      return {
        minHeight: baseHeight,
        fontSize: baseFontSize - 1,
        scoreSize: baseScoreSize,
        padding: basePadding,
        marginVertical: 2,
        scale: 0.94,
      };
  }
};

const ResultsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { hardReset } = useGame();
  
  // Enhanced destructuring to catch all pack name sources
  const { 
    playerData = [], 
    packStats, 
    isMultiplayer = false,
    packName: directPackName,
    selectedPack: directSelectedPack
  } = route.params || {};
  
  // Log all possible sources of pack name
  useEffect(() => {
    console.log('ResultsScreen received params:', {
      packStats,
      directPackName,
      directSelectedPack,
      routeParams: route.params
    });
    
    // Try to find pack name from all sources
    const packName = getPackName(packStats, route.params);
    console.log('ResultsScreen determined pack name:', packName);
  }, []);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  
  // Use Firebase context
  const firebase = useFirebase();
  const { resetGame } = useGame();

  // State for multiplayer rematch voting
  const [rematchVotes, setRematchVotes] = useState({});
  const [showRematchOption, setShowRematchOption] = useState(true);
  
  // State for background music
  const [resultsMusic, setResultsMusic] = useState(null);
  const [musicIsPlaying, setMusicIsPlaying] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

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

  // Enhanced share results function with proper pack name and short links
  const handleShareResults = async () => {
    try {
      // Get the winner's score
      const winner = sortedPlayers[0];
      const winnerScore = formatNumber(winner.score);
      const winnerName = winner.player || winner.name;
      
      // Debug logging for all pack information sources
      console.log('Share function - all pack sources:', {
        packStats,
        directPackName,
        directSelectedPack,
        routeParams: route.params
      });
      
      // Get pack name using the enhanced helper function
      const packName = getPackName(packStats, route.params);
      console.log('Share using pack name:', packName);
      
      // Get app store links with icons
      const storeLinks = getAppStoreLinks();
      
      // Create a dynamic share message based on game mode
      let shareMessage;
      
      if (isMultiplayer) {
        // Create multiplayer message with all player scores
        const playerResults = sortedPlayers
          .map((player, index) => `${index + 1}. ${player.player || player.name}: ${formatNumber(player.score)} pts`)
          .join('\n');
          
        shareMessage = `🏆 TriviaDare Multiplayer Results 🏆\n\n${playerResults}\n\nWe played the "${packName}" pack! Can you beat our scores?\n\nDownload TriviaDare now! #TriviaDare\n${storeLinks.both}`;
      } else {
        // Create single player message with proper pack name
        shareMessage = `🎮 I just scored ${winnerScore} points playing TriviaDare on the "${packName}" pack! Can you beat my score?\n\nDownload TriviaDare now and challenge me! #TriviaDare\n${storeLinks.both}`;
      }
      
      // Configure share options
      const shareOptions = {
        message: shareMessage,
        title: 'Share TriviaDare Results',
      };
      
      // Show the share dialog
      const result = await Share.share(shareOptions);
      
      // Haptic feedback when share sheet appears
      if (Platform.OS === 'android') {
        try {
          Vibration.vibrate(50);
        } catch (e) {
          console.log('Vibration not available');
        }
      }
      
      // Optional: Analytics tracking of shares
      if (result.action === Share.sharedAction) {
        console.log('Shared successfully with pack:', packName);
      }
    } catch (error) {
      console.error('Error sharing results:', error);
      Alert.alert('Error', 'Could not share results. Please try again.');
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
    // Only use Firebase implementation if we're in Firebase multiplayer
    if (firebase && firebase.currentRoom) {
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
      // Single player or other modes - simplified implementation
      return {
        yesVotes: 0,
        noVotes: 0,
        totalVotes: 0,
        requiredPlayers: 1,
        votingProgress: 0
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
    
    // Only use Firebase if we're in a Firebase multiplayer game
    if (firebase && firebase.currentRoom) {
      try {
        await firebase.updatePlayerData({
          rematchVote: wantsRematch  // Vote for rematch
        });
        
        // If rematch has majority votes, handle it (host only)
        if (firebase && firebase.isHost) {
          const stats = getRematchStats();
          if (stats.totalVotes === stats.requiredPlayers) {
            // Only process if everyone has voted for rematch
            if (stats.yesVotes === stats.requiredPlayers) {
              handlePlayAgain();
            }
          }
        }
      } catch (error) {
        console.error('Error updating rematch vote in Firebase:', error);
      }
    }
  };

  // Listen for rematch votes from Firebase
  useEffect(() => {
    if (firebase && firebase.isHost) {
      // Check if all players have voted
      const stats = getRematchStats();
      if (stats.totalVotes === stats.requiredPlayers) {
        // Only play again if ALL players voted for rematch
        if (stats.yesVotes === stats.requiredPlayers) {
          handlePlayAgain();
        }
      }
    }
  }, [firebase?.players]);
  
  const handlePlayAgain = async () => {
    try {
      // Stop the music before navigating
      await stopResultsMusic();
      
      // Reset game state
      await hardReset();
      
      // Firebase multiplayer implementation
      if (firebase && firebase.currentRoom) {
        if (firebase && firebase.isHost) {
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
    } catch (error) {
      console.error('Error starting new game:', error);
      navigation.navigate('Home');
    }
  };

  const handleReturnHome = async () => {
    try {
      // Stop the music before navigating
      await stopResultsMusic();
      
      // If in Firebase multiplayer, leave the room
      if (firebase && firebase.currentRoom) {
        try {
          await firebase.updateGameState({
            gameStatus: 'finished',
            finishedAt: new Date().toISOString()
          });
          
          // Leave room if not host, otherwise wait for players to leave
          if (firebase && !firebase.isHost) {
            await firebase.leaveRoom();
          }
        } catch (error) {
          console.error('Error updating game state in Firebase:', error);
        }
      }
      
      // Reset game state
      await hardReset();
      
      // Create params with player data to pass to Home
      const params = playerData && playerData.length > 0 
        ? { players: playerData.map(p => p.player || p.name) }
        : undefined;
      
      console.log("Navigating to Home with players:", params?.players);
      
      // Navigate to home screen with player data
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'Home',
          params
        }],
      });
    } catch (error) {
      console.error('Error returning to home:', error);
      navigation.navigate('Home');
    }
  };

  // Sort players by score
  const sortedPlayers = [...(playerData || [])].sort((a, b) => b.score - a.score);

  // Helper function to get dynamic button styles based on player count
  const getButtonStyles = () => {
    const playerCount = sortedPlayers.length;
    const isMultiplePlayerView = playerCount > 2;
    
    // Make buttons smaller for multiple players
    const basePadding = isMultiplePlayerView ? 
      (Platform.OS === 'android' ? 8 : 10) : 
      (Platform.OS === 'android' ? 10 : 12);
    
    const fontSize = isMultiplePlayerView ? 
      (Platform.OS === 'android' ? 14 : 16) : 
      (Platform.OS === 'android' ? 16 : 18);
      
    return {
      button: {
        ...styles.button,
        padding: basePadding,
      },
      buttonText: {
        ...styles.buttonText,
        fontSize: fontSize,
      }
    };
  };

  // Render an enhanced share button with platform-specific styling
  const renderShareButton = () => {
    const playerCount = sortedPlayers.length;
    const isMultiplePlayerView = playerCount > 2;
    
    const shareButtonStyles = {
      padding: isMultiplePlayerView ? 
        (Platform.OS === 'ios' ? 10 : 8) : 
        (Platform.OS === 'ios' ? 12 : 10),
      fontSize: isMultiplePlayerView ? 14 : 16,
    };
    
    return (
      <Animatable.View
        animation="pulse"
        iterationCount={3}
        duration={Platform.OS === 'android' ? 2000 : 2500}
      >
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShareResults}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#0088cc', '#005580']} // Twitter blue color scheme
            style={[styles.shareGradient, { padding: shareButtonStyles.padding }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.shareContent}>
              <Ionicons name="share-social" size={isMultiplePlayerView ? 20 : 24} color="#FFFFFF" />
              <Text style={[styles.shareButtonText, { fontSize: shareButtonStyles.fontSize }]}>Share Results</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  // Platform-specific button rendering with dynamic sizing
  const renderButton = (onPress, style, text, voteCount = null) => {
    const dynamicStyles = getButtonStyles();
    
    if (Platform.OS === 'android') {
      return (
        <View style={[styles.buttonWrapper, style]}>
          <TouchableNativeFeedback
            onPress={onPress}
            background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
          >
            <View style={[dynamicStyles.button, style, styles.buttonAndroid]}>
              <Text style={[dynamicStyles.buttonText, styles.buttonTextAndroid]}>{text}</Text>
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
        style={[dynamicStyles.button, style]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={dynamicStyles.buttonText}>{text}</Text>
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
            {firebase && firebase.currentRoom ? 'Firebase Multiplayer' : 'Multiplayer Mode'}
          </Text>
        </View>
      )}
      
      <View style={styles.container}>
        {/* Podium Container - No Scrolling */}
        <View style={styles.podiumContainer}>
          {sortedPlayers.map((player, index) => {
            const isWinner = index === 0;
            const isRunnerUp = index === 1;
            const isThird = index === 2;
            const podiumStyles = getPodiumStyles(index, sortedPlayers.length);
            
            // Platform-specific animation durations
            const animationDuration = Platform.OS === 'android' ? 800 : 1000;
            const pulseDuration = Platform.OS === 'android' ? 1200 : 1500;
            
            return (
              <Animatable.View
                key={`${player.player || player.name}-${index}`}
                animation={isWinner ? "bounceIn" : "fadeInUp"}
                delay={index * (Platform.OS === 'android' ? 150 : 200)}
                duration={animationDuration}
                style={{ transform: [{ scale: podiumStyles.scale }] }}
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
                    {
                      minHeight: podiumStyles.minHeight,
                      marginVertical: podiumStyles.marginVertical,
                      padding: podiumStyles.padding,
                    },
                    isWinner && styles.winnerContainer,
                    Platform.OS === 'android' && styles.playerContainerAndroid,
                    Platform.OS === 'android' && isWinner && styles.winnerContainerAndroid
                  ]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                >
                  {isWinner && <FloatingStars />}
                  
                  {/* Left side - Rank */}
                  <View style={styles.rankContainer}>
                  <Text style={[
                        styles.rankText,
                        { fontSize: podiumStyles.fontSize },
                        isWinner && styles.winnerRank,
                        Platform.OS === 'android' && styles.rankTextAndroid,
                        Platform.OS === 'android' && isWinner && styles.winnerRankAndroid
                      ]}>
                        #{index + 1}
                      </Text>
                      {isWinner && (
                        <Animatable.View 
                          animation="swing" 
                          iterationCount="infinite" 
                          duration={pulseDuration}
                          style={styles.trophyContainer}
                        >
                          <Ionicons name="trophy" size={CROWN_SIZE} color="#FFD700" />
                        </Animatable.View>
                      )}
                    </View>

                    {/* Center - Player Info */}
                    <View style={styles.playerInfo}>
                      <Text style={[
                        styles.playerName, 
                        { fontSize: podiumStyles.fontSize },
                        isWinner && styles.winnerText,
                        Platform.OS === 'android' && styles.playerNameAndroid,
                        Platform.OS === 'android' && isWinner && styles.winnerTextAndroid
                      ]}>
                        {player.player || player.name}
                        {isWinner && ' 👑'}
                      </Text>
                      <Animatable.Text 
                        style={[
                          styles.playerScore, 
                          { fontSize: podiumStyles.scoreSize },
                          isWinner && styles.winnerScore,
                          Platform.OS === 'android' && styles.playerScoreAndroid,
                          Platform.OS === 'android' && isWinner && styles.winnerScoreAndroid
                        ]}
                        animation={isWinner ? "flash" : "fadeIn"}
                        iterationCount={isWinner ? "infinite" : 1}
                        duration={pulseDuration}
                      >
                        {formatNumber(player.score)} pts
                      </Animatable.Text>
                    </View>

                    {/* Right side - Winner Badge for 1st place */}
                    {isWinner && (
                      <Animatable.View 
                        style={[
                          styles.winnerBadge,
                          Platform.OS === 'android' && styles.winnerBadgeAndroid
                        ]}
                        animation="pulse" 
                        easing="ease-out" 
                        iterationCount="infinite"
                        duration={pulseDuration}
                      >
                        <Text style={[
                          styles.winnerBadgeText,
                          Platform.OS === 'android' && styles.winnerBadgeTextAndroid
                        ]}>CHAMPION!</Text>
                      </Animatable.View>
                    )}
                  </LinearGradient>
                </Animatable.View>
              );
            })}
          </View>
          
          {/* Button Container */}
          <Animatable.View 
            style={[
              styles.buttonContainer,
              Platform.OS === 'android' && styles.buttonContainerAndroid
            ]}
            animation="bounceIn"
            delay={Platform.OS === 'android' ? 500 : 700}
          >
            {/* Enhanced Share Results Button */}
            {renderShareButton()}
            
            {isMultiplayer ? (
              // Multiplayer buttons
              <>
                {showRematchOption ? (
                  <>
                    {renderButton(
                      () => handleRematchVote(true),
                      styles.playAgainButton,
                      "Vote to Play Again",
                      `${yesVotes} of ${requiredPlayers}`
                    )}
                    
                    {renderButton(
                      () => handleRematchVote(false),
                      styles.returnButton,
                      "Vote to Return Home",
                      `${noVotes} of ${requiredPlayers}`
                    )}
                    
                    {totalVotes > 0 && (
                      <View style={styles.votingProgressContainer}>
                        <View style={[
                          styles.votingProgressBackground,
                          Platform.OS === 'android' && styles.votingProgressBackgroundAndroid
                        ]}>
                          <View 
                             style={[
                              styles.votingProgressFill,
                              { width: `${votingProgress * 100}%` },
                              Platform.OS === 'android' && styles.votingProgressFillAndroid
                            ]} 
                          />
                        </View>
                        <Text style={[
                          styles.votingText,
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
                      handleReturnHome,
                      styles.returnButton,
                      "Return Home"
                    )}
                  </>
                )}
              </>
            ) : (
              // Single player buttons - Only showing Return Home button
              <>
                {renderButton(
                  handleReturnHome,
                  styles.returnButton,
                  "Return Home"
                )}
              </>
            )}
          </Animatable.View>
        </View>
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
      justifyContent: 'space-between',
      paddingHorizontal: 15,
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
      backgroundColor: 'rgba(0, 100, 255, 0.8)',
      elevation: 3,
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
      fontSize: 14,
      fontWeight: '700',
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 2,
    },
    // Podium Container - No ScrollView
    podiumContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 10,
    },
    playerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 10,
      borderRadius: 25,
      marginBottom: 12,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    // Android-specific player container styling
    playerContainerAndroid: {
      borderWidth: 1.5,
      shadowColor: undefined,
      shadowOffset: undefined,
      shadowOpacity: undefined,
      shadowRadius: undefined,
      elevation: 6,
    },
    winnerContainer: {
      borderWidth: 3,
      borderColor: '#FFD700',
      shadowColor: '#FFD700',
      shadowOpacity: 0.6,
      shadowRadius: 15,
    },
    // Android-specific winner container styling
    winnerContainerAndroid: {
      borderWidth: 2,
      shadowColor: undefined,
      shadowOffset: undefined,
      shadowOpacity: undefined,
      shadowRadius: undefined,
      elevation: 10,
    },
    rankContainer: {
      width: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      fontWeight: 'bold',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 4,
    },
    // Android-specific rank text styling
    rankTextAndroid: {
      fontWeight: '700',
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 4,
    },
    winnerRank: {
      color: '#FFD700',
      textShadowColor: '#000',
      textShadowRadius: 10,
    },
    // Android-specific winner rank styling
    winnerRankAndroid: {
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 6,
    },
    playerInfo: {
      flex: 1,
      marginLeft: 10,
      marginRight: 10,
    },
    playerName: {
      fontWeight: 'bold',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: -1, height: 1 },
      textShadowRadius: 10,
    },
    // Android-specific player name styling
    playerNameAndroid: {
      fontWeight: '700',
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 4,
    },
    playerScore: {
      color: '#00FF00',
      marginTop: 4,
      fontWeight: 'bold',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    },
    // Android-specific player score styling
    playerScoreAndroid: {
      fontWeight: '700',
      marginTop: 3,
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 3,
    },
    winnerText: {
      color: '#FFFFFF',
    },
    // Android-specific winner text styling
    winnerTextAndroid: {
      // Keep same as base
    },
    winnerScore: {
      color: '#00FF00',
    },
    // Android-specific winner score styling
    winnerScoreAndroid: {
      // Keep same as base
    },
    winnerBadge: {
      backgroundColor: '#FFD700',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 7,
      transform: [{ rotate: '10deg' }],
    },
    // Android-specific winner badge styling
    winnerBadgeAndroid: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      shadowColor: undefined,
      shadowOffset: undefined,
      shadowOpacity: undefined,
      shadowRadius: undefined,
      elevation: 10,
    },
    winnerBadgeText: {
      color: '#000000',
      fontWeight: 'bold',
      fontSize: 12,
    },
    // Android-specific winner badge text styling
    winnerBadgeTextAndroid: {
      fontSize: 11,
      fontWeight: '700',
    },
    // Updated button container styles
    buttonContainer: {
      padding: 15,
      paddingBottom: Platform.OS === 'ios' ? 30 : 15,
      paddingTop: 10,
    },
    // Android-specific button container styling
    buttonContainerAndroid: {
      padding: 12,
      paddingTop: 8,
    },
    // Button wrapper for Android TouchableNativeFeedback
    buttonWrapper: {
      borderRadius: 20,
      marginBottom: 8,
      overflow: 'hidden',
    },
    // Updated button styles - more compact
    button: {
      padding: 12,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      borderWidth: 2,
      marginBottom: 8,
      minHeight: 50,
    },
    // Android-specific button styling
    buttonAndroid: {
      padding: 12,
      borderRadius: 0,
      marginBottom: 0,
      borderWidth: 1.5,
      shadowColor: undefined,
      shadowOffset: undefined,
      shadowOpacity: undefined,
      shadowRadius: undefined,
      elevation: 5,
      minHeight: 48,
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
    // Updated button text styles - smaller
    buttonText: {
      color: '#000000',
      fontSize: 18,
      fontWeight: 'bold',
      textShadowColor: 'rgba(255, 255, 255, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 5,
      textAlign: 'center',
    },
    // Android-specific button text styling
    buttonTextAndroid: {
      fontSize: 16,
      fontWeight: '700',
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 3,
    },
    // Updated vote count styles - smaller
    voteCount: {
      color: '#FFFFFF',
      fontSize: 14,
      marginTop: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    // Android-specific vote count styling
    voteCountAndroid: {
      fontSize: 12,
      marginTop: 3,
      textShadowColor: undefined,
      textShadowOffset: undefined,
      textShadowRadius: undefined,
      elevation: 2,
    },
    votingProgressContainer: {
      width: '100%',
      alignItems: 'center',
      marginTop: 8,
    },
    votingProgressBackground: {
      width: '100%',
      height: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    // Android-specific voting progress background styling
    votingProgressBackgroundAndroid: {
      height: 6,
      borderRadius: 3,
    },
    votingProgressFill: {
      height: '100%',
      backgroundColor: '#FFD700',
    },
    // Android-specific voting progress fill styling
    votingProgressFillAndroid: {
      backgroundColor: '#FFC107',
    },
    votingText: {
      color: '#FFFFFF',
      fontSize: 12,
      marginTop: 4,
      fontStyle: 'italic',
    },
    // Android-specific voting text styling
    votingTextAndroid: {
      fontSize: 11,
      marginTop: 3,
    },
    starsContainer: {
      position: 'absolute',
      top: -30,
      left: -50,
      right: -50,
      bottom: -30,
      zIndex: 2,
      pointerEvents: 'none',
    },
    star: {
      position: 'absolute',
      zIndex: 2,
      top: '50%',
      left: '50%',
    },
    trophyContainer: {
      marginTop: 3,
    },
    // Enhanced share button styles - more compact
    shareButton: {
      width: '100%',
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 12,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    shareGradient: {
      width: '100%',
      padding: Platform.OS === 'ios' ? 12 : 10,
    },
    shareContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });

  export default ResultsScreen;