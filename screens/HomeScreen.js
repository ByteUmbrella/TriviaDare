import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Alert,
  BackHandler,
  ToastAndroid,
  TouchableNativeFeedback,
  Keyboard,
  ActivityIndicator,
  Easing
} from 'react-native';
import { useGame } from '../Context/GameContext';
import Icon from 'react-native-vector-icons/FontAwesome';
import SettingsContent from '../Context/Settings';
import { useSettings } from '../Context/Settings';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import triviaPacks from '../Context/triviaPacks';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_SLIDE_WIDTH = SCREEN_WIDTH * 0.75;
const MAX_PLAYERS = 6;
const MULTIPLAYER_ACCESS_PIN = '1234'; // You can change this to any 4-digit PIN you prefer

// Enhanced Info Icon with animation - optimized for Android
const InfoIcon = ({ onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  
  const handlePress = () => {
    // More efficient animation for Android
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.8,
        duration: Platform.OS === 'android' ? 70 : 100, // Slightly faster on Android for better perceived response
        useNativeDriver: true // Ensure native driver for better performance
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 70 : 100,
        useNativeDriver: true
      })
    ]).start();
    
    // Add haptic feedback on Android
    if (Platform.OS === 'android') {
      try {
        // Light toast notification for feedback
        ToastAndroid.showWithGravity('Info', ToastAndroid.SHORT, ToastAndroid.BOTTOM);
      } catch (error) {
        console.error('Error showing toast:', error);
      }
    }
    
    onPress();
  };

  // Use TouchableNativeFeedback for Android ripple effect
  if (Platform.OS === 'android') {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={{ borderRadius: 20, overflow: 'hidden' }}>
          <TouchableNativeFeedback
            onPress={handlePress}
            background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true)}
          >
            <View style={[styles.infoButton, { padding: 12 }]}>
              <Icon name="info-circle" size={25} color="white" />
            </View>
          </TouchableNativeFeedback>
        </View>
      </Animated.View>
    );
  }

  // iOS version
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity 
        onPress={handlePress}
        style={styles.infoButton}
      >
        <Icon name="info-circle" size={25} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Utility function for chunking arrays
const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + Math.min(size, array.length - i)));
  }
  return chunks;
};

// AnimatedPlayer for gameshow UI only
const AnimatedPlayer = ({ item, onRemove, onSelect, isSelected, style, index }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { isGloballyMuted } = useSettings();
  const soundRef = useRef(null);

  // Start pulsing animation for gameshow effect
  useEffect(() => {
    if (isSelected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      // Reset animation when not selected
      pulseAnim.setValue(1);
    }
  }, [isSelected]);

  const playEraseSound = async () => {
    try {
      if (!isGloballyMuted) {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/Sounds/chalk-eraser.mp3'),
          { volume: Platform.OS === 'android' ? 0.8 : 0.9 } // Slightly lower volume on Android
        );
        soundRef.current = sound;
        await sound.playAsync();
        
        // Add haptic feedback on Android
        if (Platform.OS === 'android') {
          try {
            ToastAndroid.show('Player removed', ToastAndroid.SHORT);
          } catch (error) {
            console.error('Error showing toast:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error playing eraser sound:', error);
    }
  };

  const handleRemove = () => {
    playEraseSound();
    
    // Start removal animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Call onRemove after animation completes
      onRemove(item);
    });
  };
  
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Gameshow-style player item with number badge
  const playerNumber = index + 1;
  
  // Use TouchableNativeFeedback for better feedback on Android
  if (Platform.OS === 'android') {
    return (
      <View style={styles.playerItemContainer}>
        <Animated.View 
          style={[
            styles.playerItem,
            isSelected && styles.playerItemSelected,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { scale: pulseAnim }
              ],
              overflow: 'hidden',
            },
          ]}
        >
          <TouchableNativeFeedback
            onPress={() => onSelect(item)}
            background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 48 }}>
              <View style={styles.playerNumberBadge}>
                <Text style={styles.playerNumberText}>{playerNumber}</Text>
              </View>
              <Text style={[styles.playerName, style]}>
                {item}
              </Text>
              {isSelected && (
                <TouchableOpacity 
                  onPress={handleRemove}
                  style={[styles.removeButton, { marginLeft: 8 }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Larger hit area
                >
                  <Icon name="times" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableNativeFeedback>
        </Animated.View>
      </View>
    );
  }
  
  // iOS version
  return (
    <TouchableOpacity
      onPress={() => onSelect(item)}
      style={styles.playerItemContainer}
    >
      <Animated.View 
        style={[
          styles.playerItem,
          isSelected && styles.playerItemSelected,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim }
            ],
          },
        ]}
      >
        <View style={styles.playerNumberBadge}>
          <Text style={styles.playerNumberText}>{playerNumber}</Text>
        </View>
        <Text style={[styles.playerName, style]}>
          {item}
        </Text>
        {isSelected && (
          <TouchableOpacity 
            onPress={handleRemove}
            style={styles.removeButton}
          >
            <Icon name="times" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Enhanced HomeScreen component with Android optimizations and gameshow UI
const HomeScreen = ({ navigation }) => {
  const [newPlayer, setNewPlayer] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isDaresOnlyWarningVisible, setDaresOnlyWarningVisible] = useState(false);
  
  // PIN protection state
  const [isPinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  
  // Add safety check for GameContext
  const gameContext = useGame();
  const players = gameContext?.players || [];
  const isMounted = useRef(true);
  const setPlayers = gameContext?.setPlayers || (() => {
    console.warn('setPlayers not available');
  });
  
  // Modal states
  const [isTriviaModalVisible, setTriviaModalVisible] = useState(false);
  const [isDareModalVisible, setDareModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  // Audio and loading states
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [musicPlayed, setMusicPlayed] = useState(false);
  const { isGloballyMuted } = useSettings();
  const addButtonScale = useRef(new Animated.Value(1)).current;
  const [isMultiplayerAlertVisible, setMultiplayerAlertVisible] = useState(false);
  const [isPackScreenReady, setPackScreenReady] = useState(false);
  const backgroundMusicRef = useRef(null);
  
  // Android-specific loading state
  const [isLoading, setIsLoading] = useState(Platform.OS === 'android');
  
  // Animation values for gameshow UI
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const containerSlideIn = useRef(new Animated.Value(-300)).current;
  const spotlightRotate = useRef(new Animated.Value(0)).current;
  const containerGlow = useRef(new Animated.Value(0)).current;
  const emptyStateY = useRef(new Animated.Value(0)).current;

  // Android back button handling
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isSettingsModalVisible) {
          setSettingsModalVisible(false);
          return true;
        }
        if (isPinModalVisible) {
          setPinModalVisible(false);
          return true;
        }
        if (isTriviaModalVisible) {
          setTriviaModalVisible(false);
          return true;
        }
        if (isDareModalVisible) {
          setDareModalVisible(false);
          return true;
        }
        if (selectedPlayer) {
          setSelectedPlayer(null);
          setNewPlayer('');
          return true;
        }
        
        // Exit app confirmation on Android
        if (Platform.OS === 'android') {
          Alert.alert(
            'Exit App',
            'Are you sure you want to exit the app?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Exit', 
                onPress: () => BackHandler.exitApp(),
                style: 'destructive'
              }
            ]
          );
          return true;
        }
        
        return false;
      };

      // Only add the event listener on Android
      if (Platform.OS === 'android') {
        BackHandler.addEventListener('hardwareBackPress', onBackPress);
      }

      return () => {
        if (Platform.OS === 'android') {
          BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        }
      };
    }, [isSettingsModalVisible, isPinModalVisible, isTriviaModalVisible, isDareModalVisible, selectedPlayer])
  );

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );
  
    // Clean up listeners
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // In the main HomeScreen component where animations are defined
useEffect(() => {
  // Rotating spotlight effect - keep using native driver
  Animated.loop(
    Animated.timing(spotlightRotate, {
      toValue: 1,
      duration: 20000,
      easing: Easing.linear,
      useNativeDriver: true
    })
  ).start();
  
  // Container glow effect - separate from transform animations
  Animated.loop(
    Animated.sequence([
      Animated.timing(containerGlow, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false
      }),
      Animated.timing(containerGlow, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: false
      })
    ])
  ).start();
  
  // Empty state animation - keep using native driver
  Animated.loop(
    Animated.sequence([
      Animated.timing(emptyStateY, {
        toValue: -10,
        duration: 1000,
        useNativeDriver: true
      }),
      Animated.timing(emptyStateY, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true
      })
    ])
  ).start();
}, []);

  // PIN protection methods
  const handleMultiplayerAccess = () => {
    setPinError('');
    setEnteredPin('');
    setPinModalVisible(true);
    
    // Dismiss keyboard on Android when showing modal
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
  };

  const verifyPin = () => {
    // PIN validation
    if (enteredPin === MULTIPLAYER_ACCESS_PIN) {
      setPinModalVisible(false);
      navigation.navigate('MultiplayerConnection');
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setEnteredPin('');
      
      // Provide feedback on Android
      if (Platform.OS === 'android') {
        try {
          ToastAndroid.show('Incorrect PIN', ToastAndroid.SHORT);
        } catch (error) {
          console.error('Error showing toast:', error);
        }
      }
    }
  };

  // Preload assets when component mounts
  useEffect(() => {
    const preloadAssets = async () => {
      try {
        // Show loading state on Android
        if (Platform.OS === 'android') {
          setIsLoading(true);
        }
        
        // Use chunking for Android to prevent UI blocking
        if (Platform.OS === 'android') {
          // Preload images in chunks
          const assetChunks = [
            [Asset.loadAsync(require('../assets/gameshow.jpg'))],
            ...chunk(Object.values(triviaPacks.TRIVIA_PACKS).flat().map(pack => 
              Asset.loadAsync(pack.image)
            ), 3) // Load 3 at a time to prevent blocking
          ];
          
          for (const chunkPromises of assetChunks) {
            await Promise.all(chunkPromises);
            // Allow UI to breathe between chunks
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else {
          // iOS can handle loading all at once
          await Promise.all([
            Asset.loadAsync(require('../assets/gameshow.jpg')),
            ...Object.values(triviaPacks.TRIVIA_PACKS).flat().map(pack => 
              Asset.loadAsync(pack.image)
            )
          ]);
        }

        // Initialize background music
        const { sound: newSound } = await Audio.Sound.createAsync(
          require('../assets/Sounds/background.mp3'),
          { 
            shouldPlay: !isGloballyMuted,
            isLooping: false,
            volume: Platform.OS === 'android' ? 0.9 : 1.0 // Slightly lower volume on Android
          }
        );
        
        backgroundMusicRef.current = newSound;
        setBackgroundMusic(newSound);
        setPackScreenReady(true);

        if (!isGloballyMuted) {
          await newSound.playAsync();
          setMusicPlayed(true);
        }
        
        // Hide loading state
        setIsLoading(false);
      } catch (error) {
        console.error('Error preloading assets:', error);
        // Ensure loading state is removed even on error
        setIsLoading(false);
        setPackScreenReady(true); // Allow gameplay even if some assets failed
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Some assets could not be loaded', ToastAndroid.SHORT);
        }
      }
    };

    preloadAssets();

    return () => {
      // Cleanup function
      const cleanup = async () => {
        if (backgroundMusicRef.current) {
          try {
            await backgroundMusicRef.current.stopAsync();
            await backgroundMusicRef.current.unloadAsync();
          } catch (error) {
            console.error('Error cleaning up music:', error);
          }
        }
      };
      cleanup();
    };
  }, []);

  // Handle mute changes
  useEffect(() => {
    const handleMuteChange = async () => {
      if (backgroundMusicRef.current) {
        try {
          if (isGloballyMuted) {
            await backgroundMusicRef.current.pauseAsync();
          } else {
            await backgroundMusicRef.current.playAsync();
          }
        } catch (error) {
          console.error('Error handling mute change:', error);
        }
      }
    };

    handleMuteChange();
  }, [isGloballyMuted]);

  // Handle screen focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (backgroundMusicRef.current && !isGloballyMuted) {
        backgroundMusicRef.current.playAsync().catch(error => {
          console.error('Error playing music on focus:', error);
        });
      }
    });

    return unsubscribe;
  }, [navigation, isGloballyMuted]);

  // Handle screen blur
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pauseAsync().catch(error => {
          console.error('Error pausing music on blur:', error);
        });
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Animate gameshow UI elements
  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 600 : 800, // Faster on Android
        useNativeDriver: true
      }),
      Animated.timing(titleScale, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 600 : 800, // Faster on Android
        useNativeDriver: true
      }),
      Animated.timing(containerSlideIn, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 400 : 500, // Faster on Android
        useNativeDriver: true
      })
    ]).start();
  }, []);

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const handleSelectPlayer = (player) => {
    if (selectedPlayer === player) {
      setSelectedPlayer(null);
      setNewPlayer('');
    } else {
      setSelectedPlayer(player);
      setNewPlayer(player);
    }
    
    // Provide feedback on Android
    if (Platform.OS === 'android') {
      try {
        if (selectedPlayer === player) {
          ToastAndroid.show('Selection cleared', ToastAndroid.SHORT);
        } else {
          ToastAndroid.show(`${player} selected`, ToastAndroid.SHORT);
        }
      } catch (error) {
        console.error('Error showing toast:', error);
      }
    }
  };

  const handleAddOrUpdatePlayer = () => {
    // First, trim and limit the newPlayer to 25 characters
    const trimmedPlayer = newPlayer.trim().slice(0, 25);
    
    if (trimmedPlayer) {
      const capitalizedPlayer = capitalizeFirstLetter(trimmedPlayer);
      if (selectedPlayer) {
        setPlayers(prevPlayers =>
          prevPlayers.map(p => p === selectedPlayer ? capitalizedPlayer : p)
        );
        setSelectedPlayer(null);
        // Provide feedback on Android
        if (Platform.OS === 'android') {
          try {
            ToastAndroid.show(`${capitalizedPlayer} updated`, ToastAndroid.SHORT);
          } catch (error) {
            console.error('Error showing toast:', error);
          }
        }
      } else if (players.length < MAX_PLAYERS) {
        setPlayers(prevPlayers => [...prevPlayers, capitalizedPlayer]);
        // Provide feedback on Android
        if (Platform.OS === 'android') {
          try {
            ToastAndroid.show(`${capitalizedPlayer} added`, ToastAndroid.SHORT);
          } catch (error) {
            console.error('Error showing toast:', error);
          }
        }
      }
      setNewPlayer('');
      // Dismiss keyboard on Android
      if (Platform.OS === 'android') {
        Keyboard.dismiss();
      }
      Animated.sequence([
        Animated.timing(addButtonScale, {
          toValue: 0.9,
          duration: Platform.OS === 'android' ? 70 : 100, // Faster on Android
          useNativeDriver: true
        }),
        Animated.timing(addButtonScale, {
          toValue: 1,
          duration: Platform.OS === 'android' ? 70 : 100, // Faster on Android
          useNativeDriver: true
        })
      ]).start();
    }
  };

  const handleRemovePlayer = (player) => {
    // Clear selection if needed
    if (selectedPlayer === player) {
      setSelectedPlayer(null);
      setNewPlayer('');
    }
    
    // Create a temporary copy of the players array without the removed player
    const updatedPlayers = players.filter(p => p !== player);
    
    // Update state with the new array
    setPlayers(updatedPlayers);
    
    // Force FlatList to update by updating its extraData prop
    setTimeout(() => {
      // This slight delay helps ensure the UI updates properly
      setPlayers([...updatedPlayers]);
    }, 50);
  };

  const handleTriviaNavigation = () => {
    if (players.length >= 1) {
      if (isPackScreenReady) {
        navigation.navigate('TriviaPackSelection', {
          players,
          navigationConfig: {
            animationEnabled: false,
            detachInactiveScreens: false
          }
        });
      } else {
        // More detailed loading message on Android
        if (Platform.OS === 'android') {
          Alert.alert(
            'Loading Game Content',
            'Please wait while we prepare the game assets. This will just take a moment.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Loading...', 'Please wait while we prepare the game.');
        }
      }
    } else {
      // Show minimum players message on Android
      if (Platform.OS === 'android') {
        ToastAndroid.show('Add at least 1 players to start', ToastAndroid.LONG);
      }
    }
  };

  const handleDareNavigation = () => {
    if (players.length >= 2) {
      navigation.navigate('DarePackSelectionScreen', {
        players,
        navigationConfig: {
          animationEnabled: false,
          detachInactiveScreens: false
        }
      });
    } else {
      // Show minimum players message on Android
      if (Platform.OS === 'android') {
        ToastAndroid.show('Add at least 2 players to start', ToastAndroid.LONG);
      }
    }
  };
  
  // For spotlight animation
  const spotlightInterpolation = spotlightRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  // For container border glow effect
  const borderColorInterpolation = containerGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 215, 0, 0.5)', 'rgba(255, 215, 0, 1)']
  });

  if (Platform.OS === 'android' && isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>
          Loading game content...
        </Text>
      </View>
    );
  }

  return (
    <ImageBackground 
      source={require('../assets/gameshow.jpg')} 
      style={styles.container}
      fadeDuration={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <LinearGradient
          colors={['rgba(0,0,40,0.7)', 'rgba(26,35,126,0.7)']}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Rotating spotlight effect - This uses native driver */}
          <Animated.View style={[
            {
              position: 'absolute',
              width: SCREEN_WIDTH * 2,
              height: SCREEN_HEIGHT * 2,
              top: -SCREEN_HEIGHT / 2,
              left: -SCREEN_WIDTH / 2,
              transform: [{ rotate: spotlightInterpolation }],
              zIndex: 1,
            }
          ]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.0)', 'rgba(255,215,0,0.15)', 'rgba(255,255,255,0.0)']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </Animated.View>
          
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 15,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 2,
          }}>
            {Platform.OS === 'android' ? (
              <View style={{borderRadius: 20, overflow: 'hidden'}}>
                <TouchableNativeFeedback
                  onPress={handleMultiplayerAccess}
                  background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.2)', true)}
                >
                  <View style={styles.multiplayerButton}>
                    <Icon name="users" size={24} color="#FFD700" />
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.multiplayerButton} 
                onPress={handleMultiplayerAccess}
              >
                <Icon name="users" size={24} color="#FFD700" />
              </TouchableOpacity>
            )}
            
            <Animated.Text 
              style={[
                styles.title,
                {
                  opacity: titleOpacity,
                  transform: [{ scale: titleScale }],
                  textShadowColor: 'rgba(255,215,0,0.7)',
                  textShadowRadius: 10,
                  textShadowOffset: { width: 0, height: 0 }
                }
              ]}
            >
              TriviaDare
            </Animated.Text>
            
            {Platform.OS === 'android' ? (
              <View style={{borderRadius: 20, overflow: 'hidden'}}>
                <TouchableNativeFeedback
                  onPress={() => setSettingsModalVisible(true)}
                  background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.2)', true)}
                >
                  <View style={styles.settingsButton}>
                    <Icon name="cog" size={28} color="#FFD700" />
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.settingsButton} 
                onPress={() => setSettingsModalVisible(true)}
              >
                <Icon name="cog" size={28} color="#FFD700" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Main content (players section) */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : null}
            style={{ flex: 1, zIndex: 2 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View style={{ 
              flex: 1, 
              padding: 15, 
              paddingTop: Platform.OS === 'android' ? 5 : 15,
              paddingBottom: Platform.OS === 'android' ? (isKeyboardVisible ? 50 : 50) : 15 
            }}>
              <Animated.View 
                style={{
                  transform: [{ translateX: containerSlideIn }],
                  flex: 1,
                }}
              >
                <View 
                  style={{
                    backgroundColor: 'rgba(26, 35, 126, 0.85)',
                    borderRadius: 15,
                    padding: 15,
                    margin: Platform.OS === 'android' ? 2 : 10,
                    borderWidth: 3,
                    borderColor: '#FFD700',
                    shadowColor: '#FFD700',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    elevation: 8,
                    flex: 1,
                  }}
                >
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderBadge}>
                      <Text style={styles.sectionHeaderText}>CONTESTANTS</Text>
                    </View>
                    <View style={styles.playerCountBadge}>
                      <Text style={styles.playerCount}>
                        {players.length}/{MAX_PLAYERS}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Player section with platform-specific layout */}
                  {Platform.OS === 'android' ? (
                    // Android layout
                    <View style={{ flex: 1 }}>
                      {/* Input container at top for Android */}
                      <View style={[styles.inputContainer, { marginBottom: 8 }]}>
                        <TextInput
                          style={[
                            styles.input,
                            players.length >= MAX_PLAYERS && !selectedPlayer && styles.inputDisabled
                          ]}
                          placeholder="New Contestant"
                          placeholderTextColor="#FFD700"
                          value={newPlayer}
                          onChangeText={setNewPlayer}
                          editable={Boolean(players.length < MAX_PLAYERS || Boolean(selectedPlayer))}
                          returnKeyType="done"
                          blurOnSubmit={true}
                          onSubmitEditing={handleAddOrUpdatePlayer}
                        />
                        <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
                          <View style={{
                            borderRadius: 28, 
                            overflow: 'hidden',
                            width: 56,
                            height: 56,
                          }}>
                            <TouchableNativeFeedback
                              onPress={handleAddOrUpdatePlayer}
                              disabled={players.length >= MAX_PLAYERS && !selectedPlayer}
                              background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.3)', true)}
                            >
                              <View style={[
                                styles.addButton,
                                selectedPlayer && styles.updateButton,
                                players.length >= MAX_PLAYERS && !selectedPlayer && styles.addButtonDisabled
                              ]}>
                                <Icon name={selectedPlayer ? "check" : "plus"} size={20} color="white" />
                              </View>
                            </TouchableNativeFeedback>
                          </View>
                        </Animated.View>
                      </View>
  
                      {/* Player list below input for Android */}
<View style={{ 
  flex: 1, 
  marginTop: 8,
  maxHeight: SCREEN_HEIGHT * 0.65
}}>
  {players.length > 0 ? (
    <FlatList
      data={players}
      keyExtractor={(item, index) => `player-${item}-${index}`}
      renderItem={({ item, index }) => (
        <AnimatedPlayer
          item={item}
          onRemove={handleRemovePlayer}
          onSelect={handleSelectPlayer}
          isSelected={selectedPlayer === item}
          style={styles.playerName}
          index={index}
        />
      )}
      showsVerticalScrollIndicator={false}
      style={styles.playerList}
      contentContainerStyle={{
        paddingBottom: 15
      }}
      extraData={`${players.length}-${selectedPlayer || ''}`}
      removeClippedSubviews={false}
      initialNumToRender={10}
      onEndReachedThreshold={0.1}
    />
  ) : (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center'
    }}>
      {!isKeyboardVisible && (
        <Animated.View 
          style={[
            {
              alignItems: 'center',
              transform: [{ translateY: emptyStateY }]
            }
          ]}
        >
          <Icon name="trophy" size={60} color="#FFD700" />
          <Text style={styles.emptyText}>Game On!</Text>
          <Text style={styles.emptySubtext}>Add your first contestant</Text>
          <Text style={styles.emptySubtext}>to start the show!</Text>
          <Icon 
            name="arrow-up" 
            size={30} 
            color="#FFD700" 
            style={{ marginTop: 20 }} 
          />
        </Animated.View>
      )}
    </View>
  )}
</View>
                    </View>
                  ) : (
                    // iOS layout
                    <View style={{ flex: 1 }}>
                      <View style={{ flex: 1 }}>
                        {players.length > 0 ? (
                          <FlatList
                            data={players}
                            keyExtractor={(item, index) => `player-${item}-${index}`}
                            renderItem={({ item, index }) => (
                              <AnimatedPlayer
                                item={item}
                                onRemove={handleRemovePlayer}
                                onSelect={handleSelectPlayer}
                                isSelected={selectedPlayer === item}
                                style={styles.playerName}
                                index={index}
                              />
                            )}
                            showsVerticalScrollIndicator={false}
                            style={styles.playerList}
                            contentContainerStyle={{
                              paddingBottom: 10
                            }}
                            extraData={`${players.length}-${selectedPlayer || ''}`}
                            removeClippedSubviews={false}
                            initialNumToRender={10}
                            onEndReachedThreshold={0.1}
                          />
                        ) : (
                          <View style={{ 
                            flex: 1, 
                            alignItems: 'center', 
                            justifyContent: 'center'
                          }}>
                            <Animated.View 
                              style={[
                                {
                                  alignItems: 'center',
                                  transform: [{ translateY: emptyStateY }]
                                }
                              ]}
                            >
                              <Icon name="trophy" size={60} color="#FFD700" />
                              <Text style={styles.emptyText}>Game On!</Text>
                              <Text style={styles.emptySubtext}>Add your first contestant</Text>
                              <Text style={styles.emptySubtext}>to start the show!</Text>
                              <Icon 
                                name="arrow-down" 
                                size={30} 
                                color="#FFD700" 
                                style={{ marginTop: 20 }} 
                              />
                            </Animated.View>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={[
                            styles.input,
                            players.length >= MAX_PLAYERS && !selectedPlayer && styles.inputDisabled
                          ]}
                          placeholder="New Contestant"
                          placeholderTextColor="#FFD700"
                          value={newPlayer}
                          onChangeText={setNewPlayer}
                          editable={Boolean(players.length < MAX_PLAYERS || Boolean(selectedPlayer))}
                          returnKeyType="default"
                          blurOnSubmit={false}
                        />
                        <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
                          <TouchableOpacity 
                            style={[
                              styles.addButton,
                              selectedPlayer && styles.updateButton,
                              players.length >= MAX_PLAYERS && !selectedPlayer && styles.addButtonDisabled
                            ]} 
                            onPress={handleAddOrUpdatePlayer}
                            disabled={players.length >= MAX_PLAYERS && !selectedPlayer}
                          >
                            <Icon name={selectedPlayer ? "check" : "plus"} size={20} color="white" />
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    </View>
                  )}
                </View>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>

          {/* Game Mode Selection */}
        {!(Platform.OS === 'android' && isKeyboardVisible) && (
          Platform.OS === 'android' ? (
            <View style={{
              backgroundColor: 'rgba(0, 0, 51, 0.9)',
              padding: 15,
              paddingBottom: 20,
              borderTopWidth: 3,
              borderTopColor: '#FFD700',
              zIndex: 3,
              elevation: 10,
            }}>
              <Text style={styles.modeSectionTitle}>SELECT GAME MODE</Text>
              
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                width: '100%',
                maxWidth: 500,
                alignSelf: 'center',
              }}>
                {/* Android TriviaDare Button */}
                <View style={{
                  width: '48%',
                  borderRadius: 18,
                  overflow: 'hidden',
                }}>
                  <TouchableNativeFeedback
                    onPress={handleTriviaNavigation}
                    disabled={players.length < 1}
                    background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
                  >
                    <View style={[
                      {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: 18,
                        paddingVertical: 12,
                        paddingHorizontal: 15,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: '#FFD700',
                        minHeight: 80,
                        elevation: 10,
                        width: '100%',
                        shadowColor: "#FFD700",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                      },
                      players.length < 1 && { borderColor: '#999', opacity: 0.6 }
                    ]}>
                      <Icon name="question-circle" size={24} color="#FFD700" style={{marginBottom: 5}} />
                      
                      <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: 5 }}>
                        <Text 
                          style={[
                            {
                              color: '#FFFFFF',
                              fontSize: 18,
                              fontWeight: 'bold',
                              textAlign: 'center',
                              marginBottom: 5,
                              width: 'auto',
                              includeFontPadding: false,
                              textShadowColor: 'rgba(0,0,0,0.8)',
                              textShadowOffset: { width: 1, height: 1 },
                              textShadowRadius: 3,
                            }
                          ]}
                          numberOfLines={1}
                        >
                          TriviaDare
                        </Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={{
                          position: 'absolute',
                          bottom: 5,
                          right: 5,
                          padding: 8,
                          zIndex: 1,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#FFD700',
                        }} 
                        onPress={() => setTriviaModalVisible(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Icon name="info-circle" size={14} color="#FFD700" />
                      </TouchableOpacity>
                    </View>
                  </TouchableNativeFeedback>
                </View>
                
                {/* Android Dares Only Button */}
                <View style={{
                  width: '48%', 
                  borderRadius: 18,
                  overflow: 'hidden',
                }}>
                  <TouchableNativeFeedback
                    onPress={() => players.length < 2 ? setDaresOnlyWarningVisible(true) : handleDareNavigation()}
                    background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
                  >
                    <View style={[
                      {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: 18,
                        paddingVertical: 12,
                        paddingHorizontal: 15,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: '#FFD700',
                        minHeight: 80,
                        elevation: 10,
                        width: '100%',
                        shadowColor: "#FFD700",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                      },
                      players.length < 2 && { borderColor: '#999', opacity: 0.6 }
                    ]}>
                      <Icon name="exclamation-circle" size={24} color="#FFD700" style={{marginBottom: 5}} />
                      
                      <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: 5 }}>
                        <Text 
                          style={[
                            {
                              color: '#FFFFFF',
                              fontSize: 18,
                              fontWeight: 'bold',
                              textAlign: 'center',
                              marginBottom: 5,
                              width: 'auto',
                              includeFontPadding: false,
                              textShadowColor: 'rgba(0,0,0,0.8)',
                              textShadowOffset: { width: 1, height: 1 },
                              textShadowRadius: 3,
                            }
                          ]}
                          numberOfLines={1}
                        >
                          Dares Only
                        </Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={{
                          position: 'absolute',
                          bottom: 5,
                          right: 5,
                          padding: 8,
                          zIndex: 1,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#FFD700',
                        }} 
                        onPress={() => setDareModalVisible(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Icon name="info-circle" size={14} color="#FFD700" />
                      </TouchableOpacity>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              </View>
            </View>
          ) : (
            <View style={{
              backgroundColor: 'rgba(0, 0, 51, 0.9)',
              padding: 15,
              paddingBottom: 30,
              borderTopWidth: 3,
              borderTopColor: '#FFD700',
              zIndex: 3,
            }}>
              <Text style={styles.modeSectionTitle}>SELECT GAME MODE</Text>
              
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                width: '100%',
                maxWidth: 500,
                alignSelf: 'center',
              }}>
                <TouchableOpacity 
                  style={[
                    styles.modeButton,
                    players.length < 1 && styles.modeButtonDisabled
                  ]} 
                  onPress={handleTriviaNavigation}
                  disabled={players.length < 1}
                >
                  <Icon name="question-circle" size={30} color="#FFD700" style={styles.modeButtonIcon} />
                  <Text style={styles.modeButtonText}>TriviaDare</Text>
                  <TouchableOpacity 
                    style={styles.modeInfoBadge} 
                    onPress={() => setTriviaModalVisible(true)}
                  >
                    <Icon name="info-circle" size={16} color="#FFD700" />
                  </TouchableOpacity>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.modeButton,
                    players.length < 2 && styles.modeButtonDisabled
                  ]} 
                  onPress={() => players.length < 2 ? setDaresOnlyWarningVisible(true) : handleDareNavigation()}
                >
                  <Icon name="exclamation-circle" size={30} color="#FFD700" style={styles.modeButtonIcon} />
                  <Text style={styles.modeButtonText}>Dares Only</Text>
                  <TouchableOpacity 
                    style={styles.modeInfoBadge} 
                    onPress={() => setDareModalVisible(true)}
                  >
                    <Icon name="info-circle" size={16} color="#FFD700" />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}
        </LinearGradient>
    </TouchableWithoutFeedback>

    {/* Modals */}
    <Modal
      transparent={true}
      visible={isSettingsModalVisible}
      onRequestClose={() => setSettingsModalVisible(false)}
      animationType="fade"
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        activeOpacity={1}
        onPress={() => setSettingsModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={e => e.stopPropagation()}
        >
          <View style={{
            width: Platform.OS === 'android' ? 320 : 350,
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 0,
            maxHeight: '80%',
            minHeight: 300,
            borderWidth: 3,
            borderColor: '#FFD700',
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
              },
              android: {
                elevation: 10,
              }
            })
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: '#FFD700',
              paddingHorizontal: 15,
              paddingVertical: 12,
              backgroundColor: 'rgba(26, 35, 126, 0.9)',
              borderTopLeftRadius: 17,
              borderTopRightRadius: 17,
            }}>
              <Text style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: '#FFD700',
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}>
                Settings
              </Text>
              {Platform.OS === 'android' ? (
                <View style={{
                  borderRadius: 20,
                  overflow: 'hidden'
                }}>
                  <TouchableNativeFeedback
                    onPress={() => setSettingsModalVisible(false)}
                    background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true)}
                  >
                    <View style={{
                      padding: 8,
                      minWidth: 40,
                      minHeight: 40,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Icon name="times" size={24} color="#FFD700" />
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={() => setSettingsModalVisible(false)}
                  style={{
                    padding: 8,
                    minWidth: 40,
                    minHeight: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Icon name="times" size={24} color="#FFD700" />
                </TouchableOpacity>
              )}
            </View>
            <SettingsContent />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>

    {/* Game Mode Modals */}
    <Modal
      transparent={true}
      visible={isTriviaModalVisible}
      onRequestClose={() => setTriviaModalVisible(false)}
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        activeOpacity={1}
        onPress={() => setTriviaModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>TriviaDare Mode</Text>
            <Text style={styles.modalText}>
              Answer trivia questions correctly or face fun dares!
            </Text>
            {Platform.OS === 'android' ? (
              <View style={{
                borderRadius: 25,
                overflow: 'hidden',
                width: '100%'
              }}>
                <TouchableNativeFeedback
                  onPress={() => setTriviaModalVisible(false)}
                  background={TouchableNativeFeedback.Ripple('rgba(26,35,126,0.2)', false)}
                >
                  <View style={styles.modalButton}>
                    <Text style={styles.modalButtonText}>Got it!</Text>
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setTriviaModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Got it!</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>

    <Modal
      transparent={true}
      visible={isDareModalVisible}
      onRequestClose={() => setDareModalVisible(false)}
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        activeOpacity={1}
        onPress={() => setDareModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Dares Only Mode</Text>
            <Text style={styles.modalText}>
              Skip trivia and jump straight to performing dares!
            </Text>
            {Platform.OS === 'android' ? (
              <View style={{
                borderRadius: 25,
                overflow: 'hidden',
                width: '100%'
              }}>
                <TouchableNativeFeedback
                  onPress={() => setDareModalVisible(false)}
                  background={TouchableNativeFeedback.Ripple('rgba(26,35,126,0.2)', false)}
                >
                  <View style={styles.modalButton}>
                    <Text style={styles.modalButtonText}>Got it!</Text>
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setDareModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Got it!</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>

    {/* Other Modals */}
    <Modal
      transparent={true}
      visible={isDaresOnlyWarningVisible}
      onRequestClose={() => setDaresOnlyWarningVisible(false)}
      animationType="fade"
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        activeOpacity={1}
        onPress={() => setDaresOnlyWarningVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.daresOnlyWarningContainer}>
            <Icon name="users" size={38} color="#FF6B6B" style={{ marginBottom: 10 }} />
            <Text style={styles.daresOnlyWarningTitle}>More Players Needed!</Text>
            <Text style={styles.daresOnlyWarningText}>
              Dares Only mode requires at least 2 contestants to play.
            </Text>
            {Platform.OS === 'android' ? (
              <View style={{
                borderRadius: 25,
                overflow: 'hidden',
                marginTop: 15,
                width: '100%',
              }}>
                <TouchableNativeFeedback
                  onPress={() => setDaresOnlyWarningVisible(false)}
                  background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
                >
                  <View style={styles.daresOnlyWarningButton}>
                    <Text style={styles.daresOnlyWarningButtonText}>Add More Players</Text>
                  </View>
                </TouchableNativeFeedback>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.daresOnlyWarningButton}
                onPress={() => setDaresOnlyWarningVisible(false)}
              >
                <Text style={styles.daresOnlyWarningButtonText}>Add More Players</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>

    <Modal
      transparent={true}
      visible={isPinModalVisible}
      onRequestClose={() => setPinModalVisible(false)}
      animationType="fade"
    >
      <TouchableOpacity 
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        activeOpacity={1}
        onPress={() => setPinModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              Enter Multiplayer Access PIN
            </Text>
            <TextInput
              style={{
                width: '100%',
                height: Platform.OS === 'android' ? 56 : 50,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 10,
                borderWidth: 2,
                borderColor: pinError ? '#FF0000' : '#FFD700',
                color: '#FFFFFF',
                paddingHorizontal: 15,
                fontSize: 24,
                marginVertical: 15,
                textAlign: 'center',
                letterSpacing: 8
              }}
              placeholder="Enter 4-digit PIN"
              placeholderTextColor="rgba(255, 215, 0, 0.5)"
              value={enteredPin}
              onChangeText={(text) => {
                if (/^\d*$/.test(text) && text.length <= 4) {
                  setEnteredPin(text);
                }
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry={true}
              returnKeyType={Platform.OS === 'android' ? 'done' : 'default'}
              onSubmitEditing={enteredPin.length === 4 ? verifyPin : undefined}
            />
            {pinError ? (
              <Text style={{
                color: '#FF0000',
                marginBottom: 15,
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 16
              }}>
                {pinError}
              </Text>
            ) : null}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: 10
            }}>
              {Platform.OS === 'android' ? (
                <View style={{
                  width: '48%',
                  borderRadius: 10,
                  overflow: 'hidden'
                }}>
                  <TouchableNativeFeedback
                    onPress={() => setPinModalVisible(false)}
                    background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
                  >
                    <View style={{
                      padding: 12,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      width: '100%',
                      alignItems: 'center',
                      minHeight: 50,
                      justifyContent: 'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#999'
                    }}>
                      <Text style={{
                        color: '#FFFFFF',
                        fontWeight: 'bold',
                        fontSize: 16
                      }}>
                        Cancel
                      </Text>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  style={{
                    padding: 12,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: 10,
                    width: '48%',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#999'
                  }}
                  onPress={() => setPinModalVisible(false)}
                >
                  <Text style={{
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    fontSize: 16
                  }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
              
              {Platform.OS === 'android' ? (
                <View style={{
                  width: '48%',
                  borderRadius: 10,
                  overflow: 'hidden'
                }}>
                  <TouchableNativeFeedback
                    onPress={verifyPin}
                    disabled={enteredPin.length !== 4}
                    background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
                  >
                    <View style={{
                      padding: 12,
                      backgroundColor: enteredPin.length === 4 ? '#FFD700' : 'rgba(255, 215, 0, 0.3)',
                      width: '100%',
                      alignItems: 'center',
                      minHeight: 50,
                      justifyContent: 'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: enteredPin.length === 4 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)'
                    }}>
                      <Text style={{
                        color: enteredPin.length === 4 ? '#1A237E' : '#AAAAAA',
                        fontWeight: 'bold',
                        fontSize: 16
                      }}>
                        Submit
                      </Text>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  style={{
                    padding: 12,
                    backgroundColor: enteredPin.length === 4 ? '#FFD700' : 'rgba(255, 215, 0, 0.3)',
                    borderRadius: 10,
                    width: '48%',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: enteredPin.length === 4 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)'
                  }}
                  onPress={verifyPin}
                  disabled={enteredPin.length !== 4}
                >
                  <Text style={{
                    color: enteredPin.length === 4 ? '#1A237E' : '#AAAAAA',
                    fontWeight: 'bold',
                    fontSize: 16
                  }}>
                    Submit
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  </ImageBackground>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
  overlay: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 0,
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
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    flex: 1,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  contentContainer: {
    flex: 1,
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  playerSection: {
    backgroundColor: 'rgba(26, 35, 126, 0.85)',
    borderRadius: 15,
    padding: 15,
    margin: Platform.OS === 'ios' ? 10 : 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    })
  },
  sectionHeaderText: {
    color: '#1A237E',
    fontWeight: 'bold',
    fontSize: 18,
  },
  playerCountBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  playerCount: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  playerList: {
    width: '100%',
    marginBottom: 10,
    ...(Platform.OS === 'android' ? { 
      maxHeight: SCREEN_HEIGHT * 0.4,
    } : {})
  },
  playerItemContainer: {
    width: '100%',
    marginVertical: 4,
  },
  playerItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    borderLeftColor: '#FFD700',
    minHeight: Platform.OS === 'android' ? 56 : 44, // Taller touch target for Android
  },
  playerItemSelected: {
    backgroundColor: 'rgba(255, 165, 0, 0.3)',
    borderLeftColor: '#FFFFFF',
  },
  playerNumberBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playerNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        // No text shadow for Android - use a semi-transparent background for contrast
        backgroundColor: 'transparent',
      }
    }),
  },
  removeButton: {
    width: Platform.OS === 'android' ? 40 : 30,
    height: Platform.OS === 'android' ? 40 : 30,
    backgroundColor: 'rgba(233, 30, 99, 0.7)',
    borderRadius: Platform.OS === 'android' ? 20 : 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: Platform.OS === 'android' ? 15 : 10,
  },
  input: {
    flex: 1,
    height: Platform.OS === 'android' ? 56 : 50, // Taller for Android
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFD700',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    fontSize: Platform.OS === 'android' ? 16 : 18, // Smaller font for Android
    marginRight: 10,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  addButton: {
    width: Platform.OS === 'android' ? 56 : 50,
    height: Platform.OS === 'android' ? 56 : 50,
    backgroundColor: '#4CAF50',
    borderRadius: Platform.OS === 'android' ? 28 : 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    })
  },
  updateButton: {
    backgroundColor: '#2196F3',
  },
  addButtonDisabled: {
    backgroundColor: '#767577',
    opacity: 0.5,
  },
  gameModeSelection: {
    backgroundColor: 'rgba(26, 35, 126, 0.9)',
    padding: 15,
    paddingBottom: Platform.OS === 'android' ? 25 : 20,
    borderTopWidth: 2,
    borderTopColor: '#FFD700',
    ...Platform.select({
      android: {
        // Adding consistency for Android appearance
        alignItems: 'center',
      }
    }),
  },
  modeSectionTitle: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  modeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  modeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 15,
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  modeButtonDisabled: {
    borderColor: '#999',
    opacity: 0.6,
  },
  modeButtonIcon: {
    marginBottom: 8,
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  modeInfoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FFD700',
  },
  emptyText: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  emptySubtext: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  emptyArrow: {
    position: 'absolute',
    bottom: 15,
  },
  multiplayerButton: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    minWidth: Platform.OS === 'android' ? 48 : 44, // Better touch target for Android
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    minWidth: Platform.OS === 'android' ? 48 : 44, // Better touch target for Android
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  infoButton: {
    padding: 8,
    minWidth: Platform.OS === 'android' ? 44 : 36, // Better touch target for Android
    minHeight: Platform.OS === 'android' ? 44 : 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ADDED: Modal styles - Important for fixing modal issues
  modalContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: 20,
    padding: 20,
    width: Platform.OS === 'android' ? 320 : 350,
    borderWidth: 3,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 10,
      }
    })
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modalText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22
  },
  modalButton: {
    backgroundColor: '#FFD700',
    borderRadius: 25,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  modalButtonText: {
    color: '#1A237E',
    fontWeight: 'bold',
    fontSize: 18
  },
  // Styles for the Dares Only warning modal
  daresOnlyWarningContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: 20,
    padding: 20,
    width: Platform.OS === 'android' ? 320 : 350,
    borderWidth: 3,
    borderColor: '#FF6B6B',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: "#FF0000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 10,
      }
    })
  },
  daresOnlyWarningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  daresOnlyWarningText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22
  },
  daresOnlyWarningButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 25,
    padding: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: 10
  },
  daresOnlyWarningButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18
  }
});

export default HomeScreen;