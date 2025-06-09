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
  Easing,
  Pressable,
  Vibration,
} from 'react-native';
import { useGame } from '../Context/GameContext';
import PopUpAlert from '../Context/PopUpAlert';
import AchievementModal, { 
  ACHIEVEMENTS_DATA, 
  loadAchievements, 
  saveAchievements, 
  unlockAchievement,
  getUnacknowledgedCount // NEW: Import acknowledgment function
} from '../Context/AchievementModal';
import { achievementTracker } from '../Context/AchievementTracker'; // ACHIEVEMENT TRACKER IMPORT
import Icon from 'react-native-vector-icons/FontAwesome';
import SettingsContent from '../Context/Settings';
import { useSettings } from '../Context/Settings';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import triviaPacks from '../Context/triviaPacks';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Enhanced device type detection and responsive functions
const getDeviceType = () => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  
  if (Platform.OS === 'ios') {
    // iPad detection - iPads typically have lower aspect ratios
    if ((SCREEN_WIDTH >= 768 && SCREEN_HEIGHT >= 1024) || aspectRatio < 1.6) {
      return 'tablet';
    }
  } else {
    // Android tablet detection
    if (SCREEN_WIDTH >= 600 || aspectRatio < 1.6) {
      return 'tablet';
    }
  }
  
  return 'phone';
};

const isTablet = () => getDeviceType() === 'tablet';

// Enhanced responsive scaling functions with better small screen support
const getScreenScale = () => {
  if (isTablet()) {
    return 'large';
  } else if (SCREEN_HEIGHT < 600 || SCREEN_WIDTH < 350) {
    return 'small';
  } else if (SCREEN_HEIGHT < 700) {
    return 'medium';
  }
  return 'normal';
};

const responsiveFont = (phoneSize) => {
  const scale = getScreenScale();
  switch (scale) {
    case 'large': return Math.round(phoneSize * 1.3); // 30% larger for tablets
    case 'small': return Math.round(phoneSize * 0.85); // 15% smaller for small screens
    case 'medium': return Math.round(phoneSize * 0.95); // 5% smaller for medium screens
    default: return phoneSize;
  }
};

const responsiveSpacing = (phoneSize) => {
  const scale = getScreenScale();
  switch (scale) {
    case 'large': return Math.round(phoneSize * 1.4); // 40% larger for tablets
    case 'small': return Math.round(phoneSize * 0.8); // 20% smaller for small screens
    case 'medium': return Math.round(phoneSize * 0.9); // 10% smaller for medium screens
    default: return phoneSize;
  }
};

const responsiveSize = (phoneSize) => {
  const scale = getScreenScale();
  switch (scale) {
    case 'large': return Math.round(phoneSize * 1.25); // 25% larger for tablets
    case 'small': return Math.round(phoneSize * 0.8); // 20% smaller for small screens
    case 'medium': return Math.round(phoneSize * 0.9); // 10% smaller for medium screens
    default: return phoneSize;
  }
};

// NEW: Enhanced responsive sizing specifically for modal elements
const responsiveModalFont = (phoneSize) => {
  const scale = getScreenScale();
  switch (scale) {
    case 'large': return Math.round(phoneSize * 1.2);
    case 'small': return Math.round(phoneSize * 0.75); // More aggressive scaling for small screens
    case 'medium': return Math.round(phoneSize * 0.9);
    default: return phoneSize;
  }
};

const responsiveModalSpacing = (phoneSize) => {
  const scale = getScreenScale();
  switch (scale) {
    case 'large': return Math.round(phoneSize * 1.3);
    case 'small': return Math.round(phoneSize * 0.65); // More aggressive scaling for small screens
    case 'medium': return Math.round(phoneSize * 0.85);
    default: return phoneSize;
  }
};

const responsiveModalSize = (phoneSize) => {
  const scale = getScreenScale();
  switch (scale) {
    case 'large': return Math.round(phoneSize * 1.2);
    case 'small': return Math.round(phoneSize * 0.7); // More aggressive scaling for small screens
    case 'medium': return Math.round(phoneSize * 0.85);
    default: return phoneSize;
  }
};

// UPDATED: Much smaller empty state container - reduced by 15-20%
const getEmptyStateHeight = () => {
  const scale = getScreenScale();
  const baseHeight = 160; // Reduced from 200 to 160 (20% reduction)
  
  switch (scale) {
    case 'large': return Math.round(baseHeight * 1.1); // Reduced from 1.3 to 1.1 for tablets
    case 'small': return Math.min(Math.round(baseHeight * 0.55), SCREEN_HEIGHT * 0.18); // Reduced from 0.7 to 0.55, max 18% of screen
    case 'medium': return Math.min(Math.round(baseHeight * 0.7), SCREEN_HEIGHT * 0.22); // Reduced from 0.85 to 0.7, max 22% of screen
    default: return Math.min(Math.round(baseHeight * 0.82), SCREEN_HEIGHT * 0.25); // Reduced from 1.0 to 0.82, max 25% of screen
  }
};

const DEFAULT_SLIDE_WIDTH = SCREEN_WIDTH * 0.75;
const MAX_PLAYERS = 6;
const MULTIPLAYER_ACCESS_PIN = '1234'; // You can change this to any 4-digit PIN you prefer

// Error Boundary Component
class PlayerListErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PlayerList error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 18, textAlign: 'center' }}>
            Something went wrong with the player list. Please restart the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Secret Multiplayer Popup Component
const MultiplayerPopup = ({ visible, onClose, onNavigateToMultiplayer }) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [isHolding, setIsHolding] = useState(false);
  
  // You can change this to whatever code you want
  const SECRET_CODE = '1234';
  
  // For the hold detection
  const holdTimeoutRef = useRef(null);
  
  const handleHoldStart = () => {
    setIsHolding(true);
    holdTimeoutRef.current = setTimeout(() => {
      setShowKeypad(true);
      Vibration.vibrate(50); // Haptic feedback
    }, 5000);
  };
  
  const handleHoldEnd = () => {
    setIsHolding(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
  };
  
  const handleKeypadPress = (digit) => {
    const newCode = enteredCode + digit;
    setEnteredCode(newCode);
    
    if (newCode === SECRET_CODE) {
      // Code is correct, navigate to multiplayer
      onNavigateToMultiplayer();
      onClose();
      // Reset state
      setShowKeypad(false);
      setEnteredCode('');
    } else if (newCode.length >= SECRET_CODE.length) {
      // Code is wrong, shake and reset
      Vibration.vibrate(500);
      setEnteredCode('');
    }
  };
  
  const handleBackspace = () => {
    setEnteredCode(enteredCode.slice(0, -1));
  };
  
  const renderKeypad = () => {
    if (!showKeypad) return null;
    
    const buttons = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['⬅', '0', 'X']
    ];
    
    return (
      <View style={styles.keypadContainer}>
        <Text style={styles.keypadTitle}>Enter Code</Text>
        <View style={styles.codeDisplay}>
          {Array.from({ length: SECRET_CODE.length }).map((_, index) => (
            <View key={index} style={styles.codeDigit}>
              <Text style={styles.codeDigitText}>
                {enteredCode[index] ? '●' : ''}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.keypadGrid}>
          {buttons.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((button, buttonIndex) => (
                <TouchableOpacity
                  key={buttonIndex}
                  style={styles.keypadButton}
                  onPress={() => {
                    if (button === '⬅') {
                      handleBackspace();
                    } else if (button === 'X') {
                      setShowKeypad(false);
                      setEnteredCode('');
                    } else {
                      handleKeypadPress(button);
                    }
                  }}
                >
                  <Text style={styles.keypadButtonText}>{button}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.popupOverlay}>
        <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>Multiplayer Coming Soon!</Text>
          
          <Text style={styles.popupDescription}>
            We're working hard to bring you multiplayer to play on your own device 
            with your friends in the same room or around the world
          </Text>
          
          {/* Completely invisible secret area - full width at bottom */}
          <Pressable
            style={styles.secretArea}
            onPressIn={handleHoldStart}
            onPressOut={handleHoldEnd}
          />
          
          {renderKeypad()}
          
          {!showKeypad && (
            <TouchableOpacity style={styles.popupCloseButton} onPress={onClose}>
              <Text style={styles.popupCloseButtonText}>OK</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Friends List Popup Component
const FriendsListPopup = ({ visible, onClose, onNavigateToFriendsList }) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [isHolding, setIsHolding] = useState(false);
  
  // You can change this to whatever code you want (different from multiplayer)
  const SECRET_CODE = '5678';
  
  // For the hold detection
  const holdTimeoutRef = useRef(null);
  
  const handleHoldStart = () => {
    setIsHolding(true);
    holdTimeoutRef.current = setTimeout(() => {
      setShowKeypad(true);
      Vibration.vibrate(50); // Haptic feedback
    }, 5000);
  };
  
  const handleHoldEnd = () => {
    setIsHolding(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
  };
  
  const handleKeypadPress = (digit) => {
    const newCode = enteredCode + digit;
    setEnteredCode(newCode);
    
    if (newCode === SECRET_CODE) {
      // Code is correct, navigate to friends list
      onNavigateToFriendsList();
      onClose();
      // Reset state
      setShowKeypad(false);
      setEnteredCode('');
    } else if (newCode.length >= SECRET_CODE.length) {
      // Code is wrong, shake and reset
      Vibration.vibrate(500);
      setEnteredCode('');
    }
  };
  
  const handleBackspace = () => {
    setEnteredCode(enteredCode.slice(0, -1));
  };
  
  const renderKeypad = () => {
    if (!showKeypad) return null;
    
    const buttons = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['⬅', '0', 'X']
    ];
    
    return (
      <View style={styles.keypadContainer}>
        <Text style={styles.keypadTitle}>Enter Code</Text>
        <View style={styles.codeDisplay}>
          {Array.from({ length: SECRET_CODE.length }).map((_, index) => (
            <View key={index} style={styles.codeDigit}>
              <Text style={styles.codeDigitText}>
                {enteredCode[index] ? '●' : ''}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.keypadGrid}>
          {buttons.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((button, buttonIndex) => (
                <TouchableOpacity
                  key={buttonIndex}
                  style={styles.keypadButton}
                  onPress={() => {
                    if (button === '⬅') {
                      handleBackspace();
                    } else if (button === 'X') {
                      setShowKeypad(false);
                      setEnteredCode('');
                    } else {
                      handleKeypadPress(button);
                    }
                  }}
                >
                  <Text style={styles.keypadButtonText}>{button}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.popupOverlay}>
        <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>Friends List Coming Soon!</Text>
          
          <Text style={styles.popupDescription}>
            We're working on an amazing friends system where you can add friends, 
            see their progress, challenge them to games, and compete on leaderboards!
          </Text>
          
          {/* Completely invisible secret area - full width at bottom */}
          <Pressable
            style={styles.secretArea}
            onPressIn={handleHoldStart}
            onPressOut={handleHoldEnd}
          />
          
          {renderKeypad()}
          
          {!showKeypad && (
            <TouchableOpacity style={styles.popupCloseButton} onPress={onClose}>
              <Text style={styles.popupCloseButtonText}>OK</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

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
        <View style={{ borderRadius: responsiveSize(20), overflow: 'hidden' }}>
          <TouchableNativeFeedback
            onPress={handlePress}
            background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true)}
          >
            <View style={[styles.infoButton, { padding: responsiveSpacing(12) }]}>
              <Icon name="info-circle" size={responsiveSize(25)} color="white" />
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
        <Icon name="info-circle" size={responsiveSize(25)} color="white" />
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

// Simplified AnimatedPlayer - NATIVE DRIVER ONLY VERSION
const AnimatedPlayer = ({ item, onRemove, onSelect, isSelected, style, index }) => {
  // Only transform/opacity animations (all use native driver)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  
  const { isGloballyMuted } = useSettings();
  const soundRef = useRef(null);

  // Player sparkle positions for gameshow effect
  const playerSparkles = [
    { x: 10, y: 10 },
    { x: 90, y: 20 },
    { x: 20, y: 80 },
    { x: 85, y: 70 },
  ];

  // SIMPLIFIED: Only native driver animations
  useEffect(() => {
    if (isSelected) {
      // Pulse animation - native driver
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

      // Sparkle effect - native driver
      Animated.loop(
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
      
    } else {
      // Reset animations when not selected
      pulseAnim.setValue(1);
      sparkleAnim.setValue(0);
    }
  }, [isSelected, pulseAnim, sparkleAnim]);

  const playEraseSound = async () => {
    try {
      if (!isGloballyMuted) {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/Sounds/chalk-eraser.mp3'),
          { volume: Platform.OS === 'android' ? 0.8 : 0.9 }
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
    
    // Removal animation - native driver only
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
      if (typeof onRemove === 'function' && typeof item === 'string') {
        onRemove(item);
      }
    });
  };

  // Safe player selection handler
  const handlePlayerSelect = useCallback(() => {
    if (typeof onSelect === 'function' && typeof item === 'string') {
      onSelect(item);
    }
  }, [onSelect, item]);
  
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Validate item prop
  if (typeof item !== 'string') {
    return null;
  }

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
            }
          ]}
        >
          {/* Simplified sparkles - only show when selected */}
          {isSelected && (
            <>
              <Animated.View
                style={[
                  { position: 'absolute', left: 10, top: 10, opacity: sparkleAnim }
                ]}
              >
                <Text style={{ fontSize: responsiveFont(12), color: '#FFD700' }}>✨</Text>
              </Animated.View>
              <Animated.View
                style={[
                  { position: 'absolute', right: 10, top: 10, opacity: sparkleAnim }
                ]}
              >
                <Text style={{ fontSize: responsiveFont(12), color: '#FFD700' }}>✨</Text>
              </Animated.View>
            </>
          )}
          
          <TouchableNativeFeedback
            onPress={handlePlayerSelect}
            background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: responsiveSize(48) }}>
              <View style={styles.playerNumberBadge}>
                <Text style={styles.playerNumberText}>{playerNumber}</Text>
              </View>
              <Text style={[styles.playerName, style]}>
                {item}
              </Text>
              {isSelected && (
                <TouchableOpacity 
                  onPress={handleRemove}
                  style={[styles.removeButton, { marginLeft: responsiveSpacing(8) }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="times" size={responsiveSize(18)} color="#FFFFFF" />
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
      onPress={handlePlayerSelect}
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
          }
        ]}
      >
        {/* Simplified sparkles - only show when selected */}
        {isSelected && playerSparkles.map((pos, idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.gameShowSparkle,
              {
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                opacity: sparkleAnim,
              },
            ]}
          >
            <Text style={styles.gameShowSparkleText}>✨</Text>
          </Animated.View>
        ))}
        
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
            <Icon name="times" size={responsiveSize(18)} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Enhanced HomeScreen component with Android optimizations and gameshow UI - UPDATED VERSION WITH ACHIEVEMENT TRACKING
const HomeScreen = ({ navigation }) => {
  const [newPlayer, setNewPlayer] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isDaresOnlyWarningVisible, setDaresOnlyWarningVisible] = useState(false);
  
  // Secret multiplayer popup state
  const [isSecretMultiplayerModalVisible, setSecretMultiplayerModalVisible] = useState(false);
  
  // Friends list popup state
  const [isFriendsListModalVisible, setFriendsListModalVisible] = useState(false);
  
  // ACHIEVEMENTS STATE
  const [achievements, setAchievements] = useState(ACHIEVEMENTS_DATA || []); // Fix: Add fallback to empty array
  const [isAchievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [achievementTrackerInitialized, setAchievementTrackerInitialized] = useState(false); // NEW: Track initialization
  
  // Add safety check for GameContext
  const gameContext = useGame();
  const players = gameContext?.players || [];
  const isMounted = useRef(true);
  const setPlayers = gameContext?.setPlayers || (() => {
    console.warn('setPlayers not available');
  });
  
  // Modal states
  const [isTriviaModalVisible, setTriviaModalVisible] = useState(false);
  const [isTriviaOnlyModalVisible, setTriviaOnlyModalVisible] = useState(false); // NEW: TriviaONLY modal
  const [isDareModalVisible, setDareModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  // NEW: Game Mode Selection Modal
  const [isGameModeModalVisible, setGameModeModalVisible] = useState(false);
  
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

  // Enhanced gameshow header animations
  const headerSparkleRotation = useRef(new Animated.Value(0)).current;
  const headerSparkleOpacity = useRef(new Animated.Value(0)).current;
  const headerGlowPulse = useRef(new Animated.Value(0)).current;
  const headerLogoFloat = useRef(new Animated.Value(0)).current;
  const headerStageLight1 = useRef(new Animated.Value(0)).current;
  const headerStageLight2 = useRef(new Animated.Value(0)).current;

  // NEW: Game Show Modal Animations
  const modalSlideUp = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalSpotlight = useRef(new Animated.Value(0)).current;
  const modalSparkles = useRef(new Animated.Value(0)).current;
  const curtainLeft = useRef(new Animated.Value(-SCREEN_WIDTH/2)).current;
  const curtainRight = useRef(new Animated.Value(SCREEN_WIDTH/2)).current;

  // UPDATED: Get unacknowledged achievement stats instead of unlocked
  const unacknowledgedAchievements = getUnacknowledgedCount(achievements || []);

  // UPDATED: Enhanced achievement initialization with session tracking
  useEffect(() => {
    const initializeAchievementSystem = async () => {
      try {
        console.log('🏆 Initializing Achievement System...');
        
        // Step 1: Initialize achievement tracker and call trackNewSession
        await achievementTracker.loadStats();
        await achievementTracker.trackNewSession(); // IMPORTANT: Reset session counter on app start
        
        console.log('📊 Session tracking initialized');
        
        // Step 2: Load current achievements
        const loadedAchievements = await loadAchievements();
        setAchievements(loadedAchievements || ACHIEVEMENTS_DATA);
        
        // Step 3: Mark as initialized
        setAchievementTrackerInitialized(true);
        
        console.log('🎯 Achievement system fully initialized');
        
        // Optional: Log current stats for debugging
        if (__DEV__) {
          const stats = await achievementTracker.getCurrentStats();
          console.log('📈 Current Achievement Stats:', stats);
        }
        
      } catch (error) {
        console.error('❌ Error initializing achievement system:', error);
        // Fallback to default achievements if there's an error
        setAchievements(ACHIEVEMENTS_DATA);
        setAchievementTrackerInitialized(true); // Still mark as initialized to prevent blocking
      }
    };

    initializeAchievementSystem();
  }, []);

  // NEW: Achievement refresh handler for when we return to HomeScreen
  useFocusEffect(
    useCallback(() => {
      const refreshAchievements = async () => {
        try {
          if (achievementTrackerInitialized) {
            const refreshedAchievements = await loadAchievements();
            setAchievements(refreshedAchievements || ACHIEVEMENTS_DATA);
          }
        } catch (error) {
          console.error('Error refreshing achievements:', error);
        }
      };

      refreshAchievements();
    }, [achievementTrackerInitialized])
  );

  // Android back button handling
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isSettingsModalVisible) {
          setSettingsModalVisible(false);
          return true;
        }
        if (isAchievementsModalVisible) {
          setAchievementsModalVisible(false);
          return true;
        }
        if (isSecretMultiplayerModalVisible) {
          setSecretMultiplayerModalVisible(false);
          return true;
        }
        if (isFriendsListModalVisible) {
          setFriendsListModalVisible(false);
          return true;
        }
        if (isGameModeModalVisible) { // NEW: Handle game mode modal
          setGameModeModalVisible(false);
          return true;
        }
        if (isTriviaModalVisible) {
          setTriviaModalVisible(false);
          return true;
        }
        if (isTriviaOnlyModalVisible) { // NEW: Handle TriviaONLY modal
          setTriviaOnlyModalVisible(false);
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
    }, [isSettingsModalVisible, isAchievementsModalVisible, isSecretMultiplayerModalVisible, isFriendsListModalVisible, isGameModeModalVisible, isTriviaModalVisible, isTriviaOnlyModalVisible, isDareModalVisible, selectedPlayer])
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

  // Enhanced gameshow animations in the main component
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

    // Header gameshow animations
    Animated.loop(
      Animated.timing(headerSparkleRotation, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerSparkleOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(headerSparkleOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerLogoFloat, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(headerLogoFloat, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlowPulse, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(headerGlowPulse, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerStageLight1, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(headerStageLight1, {
          toValue: 0.2,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerStageLight2, {
          toValue: 0.6,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(headerStageLight2, {
          toValue: 0.1,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Update the multiplayer access handler
  const handleMultiplayerAccess = () => {
    setSecretMultiplayerModalVisible(true);
    
    // Dismiss keyboard on Android when showing modal
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
  };

  // Friends list access handler
  const handleFriendsListAccess = () => {
    setFriendsListModalVisible(true);
    
    // Dismiss keyboard on Android when showing modal
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
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

  // FIXED: handleSelectPlayer function with proper async state handling
  const handleSelectPlayer = (player) => {
    const wasSelected = selectedPlayer === player;
    
    if (wasSelected) {
      setSelectedPlayer(null);
      setNewPlayer('');
    } else {
      setSelectedPlayer(player);
      setNewPlayer(player);
    }
    
    // Provide feedback on Android - use the wasSelected variable instead of checking state
    if (Platform.OS === 'android') {
      try {
        if (wasSelected) {
          ToastAndroid.show('Selection cleared', ToastAndroid.SHORT);
        } else {
          ToastAndroid.show(`${player} selected`, ToastAndroid.SHORT);
        }
      } catch (error) {
        console.error('Error showing toast:', error);
      }
    }
  };

  // FIXED: Enhanced handleAddOrUpdatePlayer with better error handling
  const handleAddOrUpdatePlayer = () => {
    // Validate input first
    if (!newPlayer || typeof newPlayer !== 'string') {
      return;
    }
    
    // First, trim and limit the newPlayer to 25 characters
    const trimmedPlayer = newPlayer.trim().slice(0, 25);
    
    if (trimmedPlayer) {
      const capitalizedPlayer = capitalizeFirstLetter(trimmedPlayer);
      
      if (selectedPlayer) {
        // Update existing player
        setPlayers(prevPlayers => {
          const updatedPlayers = prevPlayers.map(p => 
            p === selectedPlayer ? capitalizedPlayer : p
          );
          return updatedPlayers;
        });
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
        // Add new player
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
      
      // Button animation
      Animated.sequence([
        Animated.timing(addButtonScale, {
          toValue: 0.9,
          duration: Platform.OS === 'android' ? 70 : 100,
          useNativeDriver: true
        }),
        Animated.timing(addButtonScale, {
          toValue: 1,
          duration: Platform.OS === 'android' ? 70 : 100,
          useNativeDriver: true
        })
      ]).start();
    }
  };

  // FIXED: handleRemovePlayer function - removed double setPlayers call
  const handleRemovePlayer = (player) => {
    // Clear selection if needed
    if (selectedPlayer === player) {
      setSelectedPlayer(null);
      setNewPlayer('');
    }
    
    // Create a temporary copy of the players array without the removed player
    const updatedPlayers = players.filter(p => p !== player);
    
    // Update state with the new array - FIXED: removed setTimeout and double update
    setPlayers(updatedPlayers);
  };

  // NEW: Game Mode Modal Animation Functions
  const openGameModeModal = () => {
    setGameModeModalVisible(true);
    
    // Reset animations
    modalSlideUp.setValue(SCREEN_HEIGHT);
    modalOpacity.setValue(0);
    modalSpotlight.setValue(0);
    modalSparkles.setValue(0);
    curtainLeft.setValue(-SCREEN_WIDTH/2);
    curtainRight.setValue(SCREEN_WIDTH/2);
    
    // Dramatic entrance sequence
    Animated.sequence([
      // Stage curtains open
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(curtainLeft, {
          toValue: -SCREEN_WIDTH,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(curtainRight, {
          toValue: SCREEN_WIDTH,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Modal slides up with bounce
      Animated.spring(modalSlideUp, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      // Spotlight and sparkles
      Animated.parallel([
        Animated.timing(modalSpotlight, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(modalSparkles, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(modalSparkles, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]),
    ]).start();
  };

  const closeGameModeModal = () => {
    Animated.parallel([
      Animated.timing(modalSlideUp, {
        toValue: SCREEN_HEIGHT,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setGameModeModalVisible(false);
    });
  };

  // NEW: Handle Start Game Button
  const handleStartGame = () => {
    if (players.length >= 1) {
      openGameModeModal();
    } else {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Add at least 1 player to start', ToastAndroid.LONG);
      }
    }
  };

  // UPDATED: Enhanced Game Mode Selection Handlers with achievement tracking
  const handleGameModeSelection = async (gameMode, minPlayers = 1) => {
    if (players.length < minPlayers) {
      if (minPlayers === 2) {
        setDaresOnlyWarningVisible(true);
      } else {
        if (Platform.OS === 'android') {
          ToastAndroid.show(`Add at least ${minPlayers} player${minPlayers > 1 ? 's' : ''} to start`, ToastAndroid.LONG);
        }
      }
      return;
    }

    closeGameModeModal();

    try {
      // UPDATED: Enhanced game start tracking with error handling
      if (achievementTrackerInitialized) {
        console.log(`🎮 Starting ${gameMode} game with ${players.length} players`);
        
        // Note: We're not passing packName here because it's selected later
        // The trackGameStart in AchievementTracker will handle missing packName gracefully
        await achievementTracker.trackGameStart(players, gameMode);
        
        // Refresh achievements to show any newly unlocked ones
        const refreshedAchievements = await loadAchievements();
        setAchievements(refreshedAchievements || ACHIEVEMENTS_DATA);
        
        console.log('🏆 Game start tracked successfully');
      } else {
        console.warn('⚠️ Achievement tracker not initialized yet, skipping tracking');
      }
      
      if (isPackScreenReady) {
        if (gameMode === 'DaresOnly') {
          navigation.navigate('DarePackSelectionScreen', {
            players,
            navigationConfig: {
              animationEnabled: false,
              detachInactiveScreens: false
            }
          });
        } else {
          navigation.navigate('TriviaPackSelection', {
            players,
            gameMode,
            navigationConfig: {
              animationEnabled: false,
              detachInactiveScreens: false
            }
          });
        }
      } else {
        // Loading message
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
    } catch (error) {
      console.error('❌ Error tracking game start:', error);
      // Continue with navigation even if tracking fails
      if (isPackScreenReady) {
        if (gameMode === 'DaresOnly') {
          navigation.navigate('DarePackSelectionScreen', {
            players,
            navigationConfig: {
              animationEnabled: false,
              detachInactiveScreens: false
            }
          });
        } else {
          navigation.navigate('TriviaPackSelection', {
            players,
            gameMode,
            navigationConfig: {
              animationEnabled: false,
              detachInactiveScreens: false
            }
          });
        }
      }
    }
  };
  
  // For spotlight animation
  const spotlightInterpolation = spotlightRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const borderColorInterpolation = containerGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 215, 0, 0.5)', 'rgba(255, 215, 0, 1)']
  });

  // Enhanced gameshow header interpolations
  const headerSparkleInterpolation = headerSparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  const headerFloatInterpolation = headerLogoFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  
  const headerGlowColorInterpolation = headerGlowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.8)'],
  });

  // Gameshow sparkle positions for header
  const sparklePositions = [
    { x: 15, y: 20, delay: 0 },
    { x: 85, y: 25, delay: 0.5 },
    { x: 25, y: 70, delay: 1 },
    { x: 75, y: 65, delay: 1.5 },
    { x: 45, y: 15, delay: 2 },
    { x: 55, y: 80, delay: 2.5 },
  ];

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
          
  {/* Enhanced Gameshow Header with ABSOLUTE PERFECT CENTERING */}
<View style={{
  alignItems: 'center',
  paddingHorizontal: responsiveSpacing(15),
  paddingTop: responsiveSpacing(20),
  paddingBottom: responsiveSpacing(15),
  backgroundColor: 'rgba(0,0,0,0.9)',
  zIndex: 2,
  borderBottomWidth: responsiveSize(3),
  borderBottomColor: '#FFD700',
  position: 'relative',
  height: responsiveSpacing(80), // Fixed height for consistent layout
}}>
  {/* Left Side - Multiplayer & Friends - ABSOLUTELY POSITIONED */}
  <View style={{ 
    position: 'absolute',
    left: responsiveSpacing(15),
    top: responsiveSpacing(20),
    bottom: responsiveSpacing(15),
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing(8),
    zIndex: 10,
  }}>
    {/* Multiplayer Button */}
    {Platform.OS === 'android' ? (
      <View style={{borderRadius: responsiveSize(20), overflow: 'hidden'}}>
        <TouchableNativeFeedback
          onPress={handleMultiplayerAccess}
          background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.2)', true)}
        >
          <View style={styles.multiplayerButton}>
            <Icon name="users" size={responsiveSize(18)} color="#FFD700" />
          </View>
        </TouchableNativeFeedback>
      </View>
    ) : (
      <TouchableOpacity 
        style={styles.multiplayerButton} 
        onPress={handleMultiplayerAccess}
      >
        <Icon name="users" size={responsiveSize(18)} color="#FFD700" />
      </TouchableOpacity>
    )}
    
    {/* Friends List Button */}
    {Platform.OS === 'android' ? (
      <View style={{borderRadius: responsiveSize(20), overflow: 'hidden'}}>
        <TouchableNativeFeedback
          onPress={handleFriendsListAccess}
          background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.2)', true)}
        >
          <View style={styles.multiplayerButton}>
            <Icon name="user-plus" size={responsiveSize(16)} color="#FFD700" />
          </View>
        </TouchableNativeFeedback>
      </View>
    ) : (
      <TouchableOpacity 
        style={styles.multiplayerButton} 
        onPress={handleFriendsListAccess}
      >
        <Icon name="user-plus" size={responsiveSize(16)} color="#FFD700" />
      </TouchableOpacity>
    )}
  </View>
  
  {/* Right Side - Achievements & Settings - ABSOLUTELY POSITIONED */}
  <View style={{ 
    position: 'absolute',
    right: responsiveSpacing(15),
    top: responsiveSpacing(20),
    bottom: responsiveSpacing(15),
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing(8),
    zIndex: 10,
  }}>
    {/* UPDATED: Achievements Button with enhanced notification badge */}
    {Platform.OS === 'android' ? (
      <View style={{borderRadius: responsiveSize(16), overflow: 'hidden'}}>
        <TouchableNativeFeedback
          onPress={() => setAchievementsModalVisible(true)}
          background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.2)', true)}
        >
          <View style={[styles.headerRightButton, { position: 'relative' }]}>
            <Icon name="trophy" size={responsiveSize(20)} color="#FFD700" />
            {/* UPDATED: Enhanced notification badge for unacknowledged achievements */}
            {unacknowledgedAchievements > 0 && (
              <View style={styles.achievementNotificationBadge}>
                <Text style={styles.achievementNotificationText}>
                  {unacknowledgedAchievements > 99 ? '99+' : unacknowledgedAchievements}
                </Text>
              </View>
            )}
          </View>
        </TouchableNativeFeedback>
      </View>
    ) : (
      <TouchableOpacity 
        style={[styles.headerRightButton, { position: 'relative' }]} 
        onPress={() => setAchievementsModalVisible(true)}
      >
        <Icon name="trophy" size={responsiveSize(20)} color="#FFD700" />
        {/* UPDATED: Enhanced notification badge for unacknowledged achievements */}
        {unacknowledgedAchievements > 0 && (
          <View style={styles.achievementNotificationBadge}>
            <Text style={styles.achievementNotificationText}>
              {unacknowledgedAchievements > 99 ? '99+' : unacknowledgedAchievements}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    )}

    {/* Settings Button */}
    {Platform.OS === 'android' ? (
      <View style={{borderRadius: responsiveSize(16), overflow: 'hidden'}}>
        <TouchableNativeFeedback
          onPress={() => setSettingsModalVisible(true)}
          background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.2)', true)}
        >
          <View style={styles.headerRightButton}>
            <Icon name="cog" size={responsiveSize(22)} color="#FFD700" />
          </View>
        </TouchableNativeFeedback>
      </View>
    ) : (
      <TouchableOpacity 
        style={styles.headerRightButton} 
        onPress={() => setSettingsModalVisible(true)}
      >
        <Icon name="cog" size={responsiveSize(22)} color="#FFD700" />
      </TouchableOpacity>
    )}
  </View>

  {/* Central Logo - TRULY CENTERED */}
  <View style={{
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 1, // Lower than buttons so they remain clickable
  }}>
    <Animated.View
      style={[
        { position: 'absolute', left: -15, top: -5, opacity: headerSparkleOpacity }
      ]}
    >
      <Text style={{ fontSize: responsiveFont(10), color: '#FFD700' }}>✨</Text>
    </Animated.View>
    <Animated.View
      style={[
        { position: 'absolute', right: -15, top: -5, opacity: headerSparkleOpacity }
      ]}
    >
      <Text style={{ fontSize: responsiveFont(10), color: '#FFD700' }}>✨</Text>
    </Animated.View>
    
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
      TriviaDARE
    </Animated.Text>
    
    <View style={{
      width: responsiveSize(80),
      height: responsiveSize(2),
      backgroundColor: '#FFD700',
      marginTop: responsiveSpacing(3),
      opacity: 0.8,
    }} />
  </View>
</View>
          
          {/* Main content (players section) - ENHANCED SCALING */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : null}
            style={{ flex: 1, zIndex: 2 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            <View style={{ 
              flex: 1, 
              padding: responsiveSpacing(15), 
              paddingTop: Platform.OS === 'android' ? responsiveSpacing(5) : responsiveSpacing(15),
              paddingBottom: Platform.OS === 'android' ? (isKeyboardVisible ? responsiveSpacing(50) : responsiveSpacing(50)) : responsiveSpacing(15),
              // Add extra horizontal padding for tablets
              paddingHorizontal: isTablet() ? responsiveSpacing(40) : responsiveSpacing(15),
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
                    borderRadius: responsiveSize(15),
                    padding: responsiveSpacing(15),
                    margin: Platform.OS === 'android' ? responsiveSpacing(2) : responsiveSpacing(10),
                    borderWidth: responsiveSize(3),
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
                      <View style={[styles.inputContainer, { marginBottom: responsiveSpacing(8) }]}>
                        <TextInput
                          style={[
                            styles.input,
                            players.length >= MAX_PLAYERS && !selectedPlayer && styles.inputDisabled
                          ]}
                          placeholder="New Contestant"
                          placeholderTextColor="#FFD700"
                          value={newPlayer || ''} // FIXED: Add fallback for null/undefined
                          onChangeText={(text) => {
                            // FIXED: Add input validation
                            if (typeof text === 'string' && text.length <= 25) {
                              setNewPlayer(text);
                            }
                          }}
                          editable={Boolean(players.length < MAX_PLAYERS || Boolean(selectedPlayer))}
                          returnKeyType="done"
                          blurOnSubmit={true}
                          onSubmitEditing={handleAddOrUpdatePlayer}
                          maxLength={25} // FIXED: Add native maxLength for extra safety
                        />
                        <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
                          <View style={{
                            borderRadius: responsiveSize(28), 
                            overflow: 'hidden',
                            width: responsiveSize(56),
                            height: responsiveSize(56),
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
                                <Icon name={selectedPlayer ? "check" : "plus"} size={responsiveSize(20)} color="white" />
                              </View>
                            </TouchableNativeFeedback>
                          </View>
                        </Animated.View>
                      </View>

                      {/* Player list below input for Android */}
                      <View style={{ 
                        flex: 1, 
                        marginTop: responsiveSpacing(8),
                        maxHeight: SCREEN_HEIGHT * (isTablet() ? 0.5 : 0.4)
                      }}>
                        {players.length > 0 ? (
                          <PlayerListErrorBoundary>
                            <FlatList
                              data={players}
                              keyExtractor={(item, index) => `player-${typeof item === 'string' ? item.replace(/[^a-zA-Z0-9]/g, '') : 'unknown'}-${index}`}
                              renderItem={({ item, index }) => {
                                if (typeof item !== 'string') {
                                  return null; // Skip invalid items
                                }
                                return (
                                  <AnimatedPlayer
                                    item={item}
                                    onRemove={handleRemovePlayer}
                                    onSelect={handleSelectPlayer}
                                    isSelected={selectedPlayer === item}
                                    style={styles.playerName}
                                    index={index}
                                  />
                                );
                              }}
                              showsVerticalScrollIndicator={false}
                              style={styles.playerList}
                              contentContainerStyle={{
                                paddingBottom: responsiveSpacing(15)
                              }}
                              extraData={selectedPlayer} // FIXED: Simplified extraData
                              removeClippedSubviews={false}
                              initialNumToRender={10}
                              onEndReachedThreshold={0.1}
                            />
                          </PlayerListErrorBoundary>
                        ) : (
                          <View style={{ 
                            flex: 1, 
                            alignItems: 'center', 
                            justifyContent: 'center'
                          }}>
                            {!isKeyboardVisible && (
                              <Animated.View 
                                style={[
                                  styles.emptyContainer,
                                  {
                                    transform: [{ translateY: emptyStateY }]
                                  }
                                ]}
                              >
                                <Icon name="trophy" size={responsiveSize(60)} color="#FFD700" />
                                <Text style={styles.emptyText}>Game On!</Text>
                                <Text style={styles.emptySubtext}>Add your first contestant</Text>
                                <Text style={styles.emptySubtext}>to start the show!</Text>
                                <Icon 
                                  name="arrow-up" 
                                  size={responsiveSize(30)} 
                                  color="#FFD700" 
                                  style={{ marginTop: responsiveSpacing(20) }} 
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
                          <PlayerListErrorBoundary>
                            <FlatList
                              data={players}
                              keyExtractor={(item, index) => `player-${typeof item === 'string' ? item.replace(/[^a-zA-Z0-9]/g, '') : 'unknown'}-${index}`}
                              renderItem={({ item, index }) => {
                                if (typeof item !== 'string') {
                                  return null; // Skip invalid items
                                }
                                return (
                                  <AnimatedPlayer
                                    item={item}
                                    onRemove={handleRemovePlayer}
                                    onSelect={handleSelectPlayer}
                                    isSelected={selectedPlayer === item}
                                    style={styles.playerName}
                                    index={index}
                                  />
                                );
                              }}
                              showsVerticalScrollIndicator={false}
                              style={styles.playerList}
                              contentContainerStyle={{
                                paddingBottom: responsiveSpacing(10)
                              }}
                              extraData={selectedPlayer} // FIXED: Simplified extraData
                              removeClippedSubviews={false}
                              initialNumToRender={10}
                              onEndReachedThreshold={0.1}
                            />
                          </PlayerListErrorBoundary>
                        ) : (
                          <View style={{ 
                            flex: 1, 
                            alignItems: 'center', 
                            justifyContent: 'center'
                          }}>
                            <Animated.View 
                              style={[
                                styles.emptyContainer,
                                {
                                  transform: [{ translateY: emptyStateY }]
                                }
                              ]}
                            >
                              <Icon name="trophy" size={responsiveSize(60)} color="#FFD700" />
                              <Text style={styles.emptyText}>Game On!</Text>
                              <Text style={styles.emptySubtext}>Add your first contestant</Text>
                              <Text style={styles.emptySubtext}>to start the show!</Text>
                              <Icon 
                                name="arrow-down" 
                                size={responsiveSize(30)} 
                                color="#FFD700" 
                                style={{ marginTop: responsiveSpacing(20) }} 
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
                          value={newPlayer || ''} // FIXED: Add fallback for null/undefined
                          onChangeText={(text) => {
                            // FIXED: Add input validation
                            if (typeof text === 'string' && text.length <= 25) {
                              setNewPlayer(text);
                            }
                          }}
                          editable={Boolean(players.length < MAX_PLAYERS || Boolean(selectedPlayer))}
                          returnKeyType="default"
                          blurOnSubmit={false}
                          maxLength={25} // FIXED: Add native maxLength for extra safety
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
                            <Icon name={selectedPlayer ? "check" : "plus"} size={responsiveSize(20)} color="white" />
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    </View>
                  )}
                </View>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>

          {/* NEW: Single Start Game Button */}
          {!(Platform.OS === 'android' && isKeyboardVisible) && (
            <View style={styles.startGameContainer}>
              <Text style={styles.startGameTitle}>READY TO PLAY?</Text>
              
              {Platform.OS === 'android' ? (
                <View style={styles.startGameButtonWrapper}>
                  <TouchableNativeFeedback
                    onPress={handleStartGame}
                    disabled={players.length < 1}
                    background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
                  >
                    <View style={[
                      styles.startGameButton,
                      players.length < 1 && styles.startGameButtonDisabled
                    ]}>
                      <Icon name="play" size={responsiveSize(32)} color="#1A237E" style={{marginRight: responsiveSpacing(8)}} />
                      <Text style={styles.startGameButtonText}>START GAME</Text>
                      <View style={styles.startGameSparkle1}>
                        <Text style={styles.startGameSparkleText}>✨</Text>
                      </View>
                      <View style={styles.startGameSparkle2}>
                        <Text style={styles.startGameSparkleText}>✨</Text>
                      </View>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.startGameButton,
                    players.length < 1 && styles.startGameButtonDisabled
                  ]} 
                  onPress={handleStartGame}
                  disabled={players.length < 1}
                >
                  <Icon name="play" size={responsiveSize(32)} color="#1A237E" style={{marginRight: responsiveSpacing(8)}} />
                  <Text style={styles.startGameButtonText}>START GAME</Text>
                  <View style={styles.startGameSparkle1}>
                    <Text style={styles.startGameSparkleText}>✨</Text>
                  </View>
                  <View style={styles.startGameSparkle2}>
                    <Text style={styles.startGameSparkleText}>✨</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
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
              width: isTablet() ? Math.min(500, SCREEN_WIDTH * 0.6) : (Platform.OS === 'android' ? 320 : 350),
              backgroundColor: 'white',
              borderRadius: responsiveSize(20),
              padding: 0,
              maxHeight: '100%',
              minHeight: responsiveSize(300),
              borderWidth: responsiveSize(4),
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
                borderBottomWidth: responsiveSize(2),
                borderBottomColor: '#FFD700',
                paddingHorizontal: responsiveSpacing(15),
                paddingVertical: responsiveSpacing(12),
                backgroundColor: 'rgba(26, 35, 126, 0.9)',
                borderTopLeftRadius: responsiveSize(17),
                borderTopRightRadius: responsiveSize(17),
              }}>
                <Text style={{
                  fontSize: responsiveFont(24),
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
                    borderRadius: responsiveSize(20),
                    overflow: 'hidden'
                  }}>
                    <TouchableNativeFeedback
                      onPress={() => setSettingsModalVisible(false)}
                      background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true)}
                    >
                      <View style={{
                        padding: responsiveSpacing(8),
                        minWidth: responsiveSize(40),
                        minHeight: responsiveSize(40),
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Icon name="times" size={responsiveSize(24)} color="#FFD700" />
                      </View>
                    </TouchableNativeFeedback>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => setSettingsModalVisible(false)}
                    style={{
                      padding: responsiveSpacing(8),
                      minWidth: responsiveSize(40),
                      minHeight: responsiveSize(40),
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Icon name="times" size={responsiveSize(24)} color="#FFD700" />
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
                  borderRadius: responsiveSize(25),
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

      {/* NEW: TriviaONLY Modal */}
      <Modal
        transparent={true}
        visible={isTriviaOnlyModalVisible}
        onRequestClose={() => setTriviaOnlyModalVisible(false)}
      >
        <TouchableOpacity 
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }}
          activeOpacity={1}
          onPress={() => setTriviaOnlyModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>TriviaONLY Mode</Text>
              <Text style={styles.modalText}>
                Pure trivia experience - answer questions to test your knowledge without any dares!
              </Text>
              {Platform.OS === 'android' ? (
                <View style={{
                  borderRadius: responsiveSize(25),
                  overflow: 'hidden',
                  width: '100%'
                }}>
                  <TouchableNativeFeedback
                    onPress={() => setTriviaOnlyModalVisible(false)}
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
                  onPress={() => setTriviaOnlyModalVisible(false)}
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
                  borderRadius: responsiveSize(25),
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
              <Icon name="users" size={responsiveSize(38)} color="#FF6B6B" style={{ marginBottom: responsiveSpacing(10) }} />
              <Text style={styles.daresOnlyWarningTitle}>More Players Needed!</Text>
              <Text style={styles.daresOnlyWarningText}>
                Dares Only mode requires at least 2 contestants to play.
              </Text>
              {Platform.OS === 'android' ? (
                <View style={{
                  borderRadius: responsiveSize(25),
                  overflow: 'hidden',
                  marginTop: responsiveSpacing(15),
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

      <PopUpAlert 
        title="Welcome to TriviaDare!" 
        message="Thank you for downloading TriviaDare! This game is crafted with care by a solo developer dedicated to creating a fun and engaging trivia experience. All questions are being carefully verified to ensure accuracy. If you spot any issues, there's an easy way to report them in the game. Enjoy the challenge, and may the best trivia master win!"
        buttonText="Let's Play!"
      />

      {/* Secret Multiplayer Popup Modal */}
      <MultiplayerPopup
        visible={isSecretMultiplayerModalVisible}
        onClose={() => setSecretMultiplayerModalVisible(false)}
        onNavigateToMultiplayer={() => {
          setSecretMultiplayerModalVisible(false);
          navigation.navigate('MultiplayerConnection');
        }}
      />

      {/* Friends List Popup Modal */}
      <FriendsListPopup
        visible={isFriendsListModalVisible}
        onClose={() => setFriendsListModalVisible(false)}
        onNavigateToFriendsList={() => {
          setFriendsListModalVisible(false);
          // For now, just show an alert since the friends screen doesn't exist yet
          Alert.alert(
            'Friends List Access Granted!',
            'Friends list functionality will be implemented here.',
            [{ text: 'OK' }]
          );
          // Later, when you create the friends screen, replace the alert with:
          // navigation.navigate('FriendsListScreen');
        }}
      />

      {/* UPDATED: ACHIEVEMENTS MODAL with enhanced acknowledgment support */}
      <AchievementModal
        visible={isAchievementsModalVisible}
        onClose={() => setAchievementsModalVisible(false)}
        achievements={achievements || []}
        onAchievementsUpdate={setAchievements} // Achievement acknowledgment callback
      />

      {/* NEW: GAME SHOW STYLE GAME MODE SELECTION MODAL */}
      <Modal
        visible={isGameModeModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeGameModeModal}
      >
        <Animated.View 
          style={[
            styles.gameShowModalOverlay,
            { opacity: modalOpacity }
          ]}
        >
          {/* Stage Curtains */}
          <Animated.View 
            style={[
              styles.curtainLeft,
              { transform: [{ translateX: curtainLeft }] }
            ]}
          />
          <Animated.View 
            style={[
              styles.curtainRight,
              { transform: [{ translateX: curtainRight }] }
            ]}
          />
          
          {/* Spotlight Effect */}
          <Animated.View 
            style={[
              styles.modalSpotlight,
              { opacity: modalSpotlight }
            ]}
          />
          
          {/* Main Modal Content */}
          <Animated.View 
            style={[
              styles.gameShowModalContainer,
              { transform: [{ translateY: modalSlideUp }] }
            ]}
          >
            {/* Header with sparkles */}
            <View style={styles.gameShowModalHeader}>
              <Animated.View style={[styles.modalSparkle1, { opacity: modalSparkles }]}>
                <Text style={styles.modalSparkleText}>✨</Text>
              </Animated.View>
              <Animated.View style={[styles.modalSparkle2, { opacity: modalSparkles }]}>
                <Text style={styles.modalSparkleText}>⭐</Text>
              </Animated.View>
              <Animated.View style={[styles.modalSparkle3, { opacity: modalSparkles }]}>
                <Text style={styles.modalSparkleText}>🎪</Text>
              </Animated.View>
              
              <Text style={styles.gameShowModalTitle}>🎭 CHOOSE YOUR ADVENTURE! 🎭</Text>
              <Text style={styles.gameShowModalSubtitle}>Ladies and Gentlemen, select your game mode!</Text>
              
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={closeGameModeModal}
              >
                <Icon name="times" size={responsiveModalSize(20)} color="#FFD700" />
              </TouchableOpacity>
            </View>
            
            {/* Game Mode Buttons - ENHANCED FOR SMALL SCREENS */}
            <View style={styles.gameShowButtonsContainer}>
              {/* TriviaDare Button */}
              {Platform.OS === 'android' ? (
                <View style={styles.gameShowButtonWrapper}>
                  <TouchableNativeFeedback
                    onPress={() => handleGameModeSelection('TriviaDare')}
                    background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.3)', false)}
                  >
                    <View style={styles.gameShowButton}>
                      <View style={styles.gameShowButton}>
                        <View style={styles.gameShowButtonIcon}>
                          <Icon name="question-circle" size={responsiveModalSize(36)} color="#FFD700" />
                        </View>
                        <Text style={styles.gameShowButtonTitle}>TriviaDare</Text>
                        <Text style={styles.gameShowButtonDesc}>Answer trivia or face fun dares!</Text>
                        <TouchableOpacity 
                          style={styles.gameShowInfoButton}
                          onPress={() => setTriviaModalVisible(true)}
                        >
                          <Icon name="info-circle" size={responsiveModalSize(16)} color="#FFD700" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.gameShowButton}
                  onPress={() => handleGameModeSelection('TriviaDare')}
                >
                  <View style={styles.gameShowButtonIcon}>
                    <Icon name="question-circle" size={responsiveModalSize(36)} color="#FFD700" />
                  </View>
                  <Text style={styles.gameShowButtonTitle}>TriviaDare</Text>
                  <Text style={styles.gameShowButtonDesc}>Answer trivia or face fun dares!</Text>
                  <TouchableOpacity 
                    style={styles.gameShowInfoButton}
                    onPress={() => setTriviaModalVisible(true)}
                  >
                    <Icon name="info-circle" size={responsiveModalSize(16)} color="#FFD700" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              
              {/* TriviaONLY Button */}
              {Platform.OS === 'android' ? (
                <View style={styles.gameShowButtonWrapper}>
                  <TouchableNativeFeedback
                    onPress={() => handleGameModeSelection('TriviaONLY')}
                    background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.3)', false)}
                  >
                    <View style={styles.gameShowButton}>
                      <View style={styles.gameShowButtonIcon}>
                        <Icon name="lightbulb-o" size={responsiveModalSize(36)} color="#FFD700" />
                      </View>
                      <Text style={styles.gameShowButtonTitle}>TriviaONLY</Text>
                      <Text style={styles.gameShowButtonDesc}>Pure trivia without any dares!</Text>
                      <TouchableOpacity 
                        style={styles.gameShowInfoButton}
                        onPress={() => setTriviaOnlyModalVisible(true)}
                      >
                        <Icon name="info-circle" size={responsiveModalSize(16)} color="#FFD700" />
                      </TouchableOpacity>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.gameShowButton}
                  onPress={() => handleGameModeSelection('TriviaONLY')}
                >
                  <View style={styles.gameShowButtonIcon}>
                    <Icon name="lightbulb-o" size={responsiveModalSize(36)} color="#FFD700" />
                  </View>
                  <Text style={styles.gameShowButtonTitle}>TriviaONLY</Text>
                  <Text style={styles.gameShowButtonDesc}>Pure trivia without any dares!</Text>
                  <TouchableOpacity 
                    style={styles.gameShowInfoButton}
                    onPress={() => setTriviaOnlyModalVisible(true)}
                  >
                    <Icon name="info-circle" size={responsiveModalSize(16)} color="#FFD700" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              
              {/* Dares Only Button */}
              {Platform.OS === 'android' ? (
                <View style={styles.gameShowButtonWrapper}>
                  <TouchableNativeFeedback
                    onPress={() => handleGameModeSelection('DaresOnly', 2)}
                    background={TouchableNativeFeedback.Ripple('rgba(255,215,0,0.3)', false)}
                  >
                    <View style={[
                      styles.gameShowButton,
                      players.length < 2 && styles.gameShowButtonDisabled
                    ]}>
                      <View style={styles.gameShowButtonIcon}>
                        <Icon name="exclamation-circle" size={responsiveModalSize(36)} color="#FFD700" />
                      </View>
                      <Text style={styles.gameShowButtonTitle}>Dares Only</Text>
                      <Text style={styles.gameShowButtonDesc}>Skip trivia, go straight to dares!</Text>
                      {players.length < 2 && (
                        <Text style={styles.gameShowButtonWarning}>Needs 2+ players</Text>
                      )}
                      <TouchableOpacity 
                        style={styles.gameShowInfoButton}
                        onPress={() => setDareModalVisible(true)}
                      >
                        <Icon name="info-circle" size={responsiveModalSize(16)} color="#FFD700" />
                      </TouchableOpacity>
                    </View>
                  </TouchableNativeFeedback>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.gameShowButton,
                    players.length < 2 && styles.gameShowButtonDisabled
                  ]}
                  onPress={() => handleGameModeSelection('DaresOnly', 2)}
                >
                  <View style={styles.gameShowButtonIcon}>
                    <Icon name="exclamation-circle" size={responsiveModalSize(36)} color="#FFD700" />
                  </View>
                  <Text style={styles.gameShowButtonTitle}>Dares Only</Text>
                  <Text style={styles.gameShowButtonDesc}>Skip trivia, go straight to dares!</Text>
                  {players.length < 2 && (
                    <Text style={styles.gameShowButtonWarning}>Needs 2+ players</Text>
                  )}
                  <TouchableOpacity 
                    style={styles.gameShowInfoButton}
                    onPress={() => setDareModalVisible(true)}
                  >
                    <Icon name="info-circle" size={responsiveModalSize(16)} color="#FFD700" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    marginTop: Platform.OS === 'ios' ? responsiveSpacing(40) : responsiveSpacing(20),
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
    paddingHorizontal: responsiveSpacing(20),
    paddingTop: responsiveSpacing(20),
    paddingBottom: responsiveSpacing(15),
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  title: {
    fontSize: responsiveFont(30), // Reduced from 36 to 30
    fontWeight: 'bold',
    color: '#FFD700',
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
  gameShowSparkle: {
    position: 'absolute',
    width: responsiveSize(15),
    height: responsiveSize(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameShowSparkleText: {
    fontSize: responsiveFont(12),
  },
  contentContainer: {
    flex: 1,
    padding: responsiveSpacing(15),
    paddingBottom: Platform.OS === 'ios' ? 0 : responsiveSpacing(10),
  },
  playerSection: {
    backgroundColor: 'rgba(26, 35, 126, 0.85)',
    borderRadius: responsiveSize(15),
    padding: responsiveSpacing(15),
    margin: Platform.OS === 'ios' ? responsiveSpacing(10) : responsiveSpacing(15),
    borderWidth: responsiveSize(2),
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsiveSpacing(15),
    position: 'relative',
  },
  sectionHeaderBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: responsiveSpacing(20),
    paddingVertical: responsiveSpacing(8),
    borderRadius: responsiveSize(20),
    borderWidth: responsiveSize(2),
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
    fontSize: responsiveFont(18),
  },
  playerCountBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: responsiveSpacing(10),
    paddingVertical: responsiveSpacing(5),
    borderRadius: responsiveSize(15),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  playerCount: {
    color: '#FFD700',
    fontSize: responsiveFont(20),
    fontWeight: 'bold',
  },
  playerList: {
    width: '100%',
    marginBottom: responsiveSpacing(10),
    ...(Platform.OS === 'android' ? { 
      maxHeight: SCREEN_HEIGHT * (isTablet() ? 0.5 : 0.4),
    } : {})
  },
  playerItemContainer: {
    width: '100%',
    marginVertical: responsiveSpacing(4),
  },
  playerItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(10),
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: responsiveSize(5),
    borderLeftColor: '#FFD700',
    minHeight: isTablet() ? responsiveSize(64) : (Platform.OS === 'android' ? 56 : 44),
  },
  playerItemSelected: {
    backgroundColor: 'rgba(255, 165, 0, 0.3)',
    borderLeftColor: '#FFFFFF',
  },
  playerNumberBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: responsiveSize(15),
    width: responsiveSize(30),
    height: responsiveSize(30),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing(10),
  },
  playerNumberText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: responsiveFont(22),
    fontWeight: 'bold',
    flex: 1,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        backgroundColor: 'transparent',
      }
    }),
  },
  removeButton: {
    width: isTablet() ? responsiveSize(44) : (Platform.OS === 'android' ? 40 : 30),
    height: isTablet() ? responsiveSize(44) : (Platform.OS === 'android' ? 40 : 30),
    backgroundColor: 'rgba(233, 30, 99, 0.7)',
    borderRadius: isTablet() ? responsiveSize(22) : (Platform.OS === 'android' ? 20 : 15),
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSpacing(10),
    marginBottom: responsiveSpacing(Platform.OS === 'android' ? 15 : 10),
  },
  input: {
    flex: 1,
    height: isTablet() ? responsiveSize(64) : (Platform.OS === 'android' ? 56 : 50),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(25),
    borderWidth: responsiveSize(2),
    borderColor: '#FFD700',
    color: '#FFFFFF',
    paddingHorizontal: responsiveSpacing(20),
    fontSize: responsiveFont(Platform.OS === 'android' ? 16 : 18),
    marginRight: responsiveSpacing(10),
  },
  inputDisabled: {
    opacity: 0.5,
  },
  addButton: {
    width: isTablet() ? responsiveSize(64) : (Platform.OS === 'android' ? 56 : 50),
    height: isTablet() ? responsiveSize(64) : (Platform.OS === 'android' ? 56 : 50),
    backgroundColor: '#4CAF50',
    borderRadius: isTablet() ? responsiveSize(32) : (Platform.OS === 'android' ? 28 : 25),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: responsiveSize(2),
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
  // NEW: Game Mode Container Styles
  gameModeContainer: {
    backgroundColor: 'rgba(0, 0, 51, 0.9)',
    padding: responsiveSpacing(15),
    paddingBottom: responsiveSpacing(20),
    borderTopWidth: responsiveSize(3),
    borderTopColor: '#FFD700',
    zIndex: 3,
    elevation: 10,
  },
  // NEW: Start Game Button Styles
  startGameContainer: {
    backgroundColor: 'rgba(0, 0, 51, 0.9)',
    padding: responsiveSpacing(20),
    paddingBottom: responsiveSpacing(25),
    borderTopWidth: responsiveSize(3),
    borderTopColor: '#FFD700',
    zIndex: 3,
    elevation: 10,
    alignItems: 'center',
  },
  startGameTitle: {
    color: '#FFD700',
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: responsiveSpacing(15),
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  startGameButtonWrapper: {
    borderRadius: responsiveSize(25),
    overflow: 'hidden',
    width: '100%',
    maxWidth: isTablet() ? 400 : 300,
  },
  startGameButton: {
    backgroundColor: '#FFD700',
    borderRadius: responsiveSize(25),
    paddingVertical: responsiveSpacing(16),
    paddingHorizontal: responsiveSpacing(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: responsiveSize(3),
    borderColor: '#FFFFFF',
    minHeight: responsiveSize(70),
    position: 'relative',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
      },
      android: {
        elevation: 12,
      }
    }),
  },
  startGameButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  startGameButtonText: {
    color: '#1A237E',
    fontSize: responsiveFont(isTablet() ? 24 : 20),
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  startGameSparkle1: {
    position: 'absolute',
    top: responsiveSpacing(8),
    left: responsiveSpacing(15),
  },
  startGameSparkle2: {
    position: 'absolute',
    bottom: responsiveSpacing(8),
    right: responsiveSpacing(15),
  },
  startGameSparkleText: {
    fontSize: responsiveFont(16),
  },
  
  // NEW: Enhanced Game Show Modal Styles for Better Small Screen Support
  gameShowModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  curtainLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#8B0000',
    zIndex: 1,
    borderRightWidth: 5,
    borderRightColor: '#FFD700',
  },
  curtainRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#8B0000',
    zIndex: 1,
    borderLeftWidth: 5,
    borderLeftColor: '#FFD700',
  },
  modalSpotlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
  },
  gameShowModalContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: responsiveModalSize(25),
    padding: responsiveModalSpacing(20),
    width: isTablet() ? Math.min(600, SCREEN_WIDTH * 0.9) : SCREEN_WIDTH * 0.92, // Slightly wider for small screens
    maxHeight: SCREEN_HEIGHT * 0.85, // More height for small screens
    borderWidth: responsiveModalSize(4),
    borderColor: '#FFD700',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      }
    }),
  },
  gameShowModalHeader: {
    alignItems: 'center',
    marginBottom: responsiveModalSpacing(15), // Reduced from 20
    position: 'relative',
  },
  modalSparkle1: {
    position: 'absolute',
    top: -10,
    left: 20,
  },
  modalSparkle2: {
    position: 'absolute',
    top: 5,
    right: 30,
  },
  modalSparkle3: {
    position: 'absolute',
    top: -5,
    left: '50%',
    marginLeft: -10,
  },
  modalSparkleText: {
    fontSize: responsiveModalFont(24),
  },
  gameShowModalTitle: {
    fontSize: responsiveModalFont(isTablet() ? 28 : 22), // Slightly smaller for small screens
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: responsiveModalSpacing(8),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  gameShowModalSubtitle: {
    fontSize: responsiveModalFont(isTablet() ? 16 : 12), // Smaller for small screens
    color: '#FFFFFF',
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.9,
  },
  modalCloseButton: {
    position: 'absolute',
    top: -5,
    right: 0,
    padding: responsiveModalSpacing(10),
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: responsiveModalSize(20),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  gameShowButtonsContainer: {
    gap: responsiveModalSpacing(12), // Reduced gap for small screens
    paddingBottom: responsiveModalSpacing(10),
  },
  gameShowButtonWrapper: {
    borderRadius: responsiveModalSize(20),
    overflow: 'hidden',
  },
  gameShowButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: responsiveModalSize(20),
    padding: responsiveModalSpacing(15), // Reduced padding for small screens
    alignItems: 'center',
    borderWidth: responsiveModalSize(3),
    borderColor: '#FFD700',
    position: 'relative',
    minHeight: responsiveModalSize(100), // Reduced min height for small screens
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  gameShowButtonDisabled: {
    opacity: 0.5,
    borderColor: '#999',
  },
  gameShowButtonIcon: {
    marginBottom: responsiveModalSpacing(8), // Reduced spacing
    padding: responsiveModalSpacing(6), // Reduced padding
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: responsiveModalSize(25),
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  gameShowButtonTitle: {
    fontSize: responsiveModalFont(isTablet() ? 22 : 18), // Smaller for small screens
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: responsiveModalSpacing(6), // Reduced spacing
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  gameShowButtonDesc: {
    fontSize: responsiveModalFont(isTablet() ? 14 : 11), // Smaller for small screens
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: responsiveModalFont(16), // Adjusted line height
    paddingHorizontal: responsiveModalSpacing(8), // Add padding to prevent text from touching edges
  },
  gameShowButtonWarning: {
    fontSize: responsiveModalFont(11), // Smaller warning text
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: responsiveModalSpacing(4), // Reduced spacing
    fontWeight: 'bold',
  },
  gameShowInfoButton: {
    position: 'absolute',
    top: responsiveModalSpacing(6), // Reduced spacing
    right: responsiveModalSpacing(6), // Reduced spacing
    padding: responsiveModalSpacing(4), // Reduced padding
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: responsiveModalSize(12), // Smaller radius
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  modeSectionTitle: {
    color: '#FFD700',
    fontSize: responsiveFont(22),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: responsiveSpacing(15),
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  modeButtonDisabled: {
    borderColor: '#999',
    opacity: 0.6,
  },
  // ENHANCED: Empty Container with responsive scaling - CLEAN LOOK (no border)
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: getEmptyStateHeight(), // Using the new reduced height function
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Slightly more transparent
    borderRadius: responsiveSize(15),
    padding: responsiveSpacing(12), // Reduced from 15 to 12
    marginHorizontal: responsiveSpacing(5), // Add horizontal margin for small screens
  },
  emptyText: {
    color: '#FFD700',
    fontSize: responsiveFont(28),
    fontWeight: 'bold',
    marginTop: responsiveSpacing(8), // Reduced from 10 to 8
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  emptySubtext: {
    color: '#FFFFFF',
    fontSize: responsiveFont(18),
    marginTop: responsiveSpacing(4), // Reduced from 5 to 4
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  emptyArrow: {
    position: 'absolute',
    bottom: responsiveSpacing(15),
  },
  multiplayerButton: {
    padding: responsiveSpacing(10),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(16),
    borderWidth: 1,
    borderColor: '#FFD700',
    minWidth: responsiveSize(40),
    minHeight: responsiveSize(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightButton: {
    padding: responsiveSpacing(8),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(16),
    borderWidth: 1,
    borderColor: '#FFD700',
    minWidth: responsiveSize(36),
    minHeight: responsiveSize(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    padding: responsiveSpacing(12),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsiveSize(20),
    borderWidth: 1,
    borderColor: '#FFD700',
    minWidth: isTablet() ? responsiveSize(52) : (Platform.OS === 'android' ? 48 : 44),
    minHeight: isTablet() ? responsiveSize(52) : (Platform.OS === 'android' ? 48 : 44),
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
    fontSize: responsiveFont(18),
    textAlign: 'center',
    marginTop: responsiveSpacing(20),
  },
  infoButton: {
    padding: responsiveSpacing(8),
    minWidth: isTablet() ? responsiveSize(48) : (Platform.OS === 'android' ? 44 : 36),
    minHeight: isTablet() ? responsiveSize(48) : (Platform.OS === 'android' ? 44 : 36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  modalContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: responsiveSize(20),
    padding: responsiveSpacing(20),
    width: isTablet() ? Math.min(500, SCREEN_WIDTH * 0.6) : SCREEN_WIDTH * 0.85,
    borderWidth: responsiveSize(3),
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
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: responsiveSpacing(15),
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modalText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(16),
    marginBottom: responsiveSpacing(20),
    textAlign: 'center',
    lineHeight: responsiveFont(22)
  },
  modalButton: {
    backgroundColor: '#FFD700',
    borderRadius: responsiveSize(25),
    padding: responsiveSpacing(12),
    alignItems: 'center',
    borderWidth: responsiveSize(2),
    borderColor: '#FFFFFF'
  },
  modalButtonText: {
    color: '#1A237E',
    fontWeight: 'bold',
    fontSize: responsiveFont(18)
  },
  // Styles for the Dares Only warning modal
  daresOnlyWarningContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: responsiveSize(20),
    padding: responsiveSpacing(20),
    width: isTablet() ? Math.min(500, SCREEN_WIDTH * 0.6) : SCREEN_WIDTH * 0.85,
    borderWidth: responsiveSize(3),
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
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: responsiveSpacing(15),
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  daresOnlyWarningText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(16),
    marginBottom: responsiveSpacing(20),
    textAlign: 'center',
    lineHeight: responsiveFont(22)
  },
  daresOnlyWarningButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: responsiveSize(25),
    padding: responsiveSpacing(12),
    alignItems: 'center',
    width: '100%',
    borderWidth: responsiveSize(2),
    borderColor: '#FFFFFF',
    marginTop: responsiveSpacing(10)
  },
  daresOnlyWarningButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: responsiveFont(18)
  },
  // Secret Multiplayer Popup Styles
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    backgroundColor: 'white',
    borderRadius: responsiveSize(15),
    padding: responsiveSpacing(20),
    width: isTablet() ? Math.min(450, SCREEN_WIDTH * 0.7) : '90%',
    maxWidth: isTablet() ? 450 : 350,
    alignItems: 'center',
    position: 'relative',
  },
  popupTitle: {
    fontSize: responsiveFont(20),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(15),
    textAlign: 'center',
  },
  popupDescription: {
    fontSize: responsiveFont(16),
    textAlign: 'center',
    marginBottom: responsiveSpacing(20),
    lineHeight: responsiveFont(22),
  },
  // Completely invisible secret area covering the full width at the bottom
  secretArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: responsiveSize(80), // Taller for easier access
    backgroundColor: 'transparent', // Completely transparent
  },
  keypadContainer: {
    marginTop: responsiveSpacing(20),
  },
  keypadTitle: {
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(10),
    textAlign: 'center',
  },
  codeDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: responsiveSpacing(20),
  },
  codeDigit: {
    width: responsiveSize(40),
    height: responsiveSize(40),
    backgroundColor: '#f0f0f0',
    borderRadius: responsiveSize(20),
    marginHorizontal: responsiveSpacing(5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeDigitText: {
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
  },
  keypadGrid: {
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    marginBottom: responsiveSpacing(10),
  },
  keypadButton: {
    width: responsiveSize(60),
    height: responsiveSize(60),
    backgroundColor: '#e0e0e0',
    borderRadius: responsiveSize(30),
    marginHorizontal: responsiveSpacing(5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
  },
  popupCloseButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: responsiveSpacing(30),
    paddingVertical: responsiveSpacing(10),
    borderRadius: responsiveSize(25),
    marginTop: responsiveSpacing(10),
  },
  popupCloseButtonText: {
    color: 'white',
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
  },
  // ACHIEVEMENT NOTIFICATION BADGE STYLES
  achievementNotificationBadge: {
    position: 'absolute',
    top: responsiveSpacing(-4),
    right: responsiveSpacing(-4),
    backgroundColor: '#FF4444',
    borderRadius: responsiveSize(10),
    paddingHorizontal: responsiveSpacing(5),
    paddingVertical: responsiveSpacing(1),
    minWidth: responsiveSize(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  achievementNotificationText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(11), // Slightly smaller for the smaller buttons
    fontWeight: 'bold',
  },
});

export default HomeScreen;