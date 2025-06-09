import React, { memo, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions, 
  ScrollView, 
  Platform,
  TouchableNativeFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReportQuestionModal from '../Context/ReportQuestionModal';

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

// Animated light component for the decorative bars
const Light = memo(({ delay }) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      const duration = Platform.OS === 'android' ? 750 : 600;
      
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: duration,
          delay: Platform.OS === 'android' ? delay * 70 : delay * 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: duration,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };

    animate();
    
    return () => {
      opacity.stopAnimation();
    };
  }, []);

  return (
    <Animated.View style={[styles.light, { opacity }]} />
  );
});

const LightBar = memo(() => {
  const lightsCount = Platform.OS === 'android' ? 12 : 20;
  
  return (
    <View style={styles.lightBar}>
      {[...Array(lightsCount)].map((_, i) => (
        <Light key={i} delay={i % 5} />
      ))}
    </View>
  );
});

// NEW: PowerUp Effect Overlay Component
const PowerUpEffectOverlay = memo(({ effect, visible }) => {
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && effect) {
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      animation.setValue(0);
    }
  }, [visible, effect]);

  if (!visible || !effect) return null;

  return (
    <Animated.View 
      style={[
        styles.powerUpOverlay,
        {
          opacity: animation,
          transform: [
            {
              scale: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.1]
              })
            }
          ]
        }
      ]}
      pointerEvents="none"
    >
      <Text style={styles.powerUpOverlayIcon}>⚡</Text>
      <Text style={styles.powerUpOverlayText}>50/50 Active!</Text>
      <Text style={styles.powerUpOverlaySubtext}>Two wrong answers removed</Text>
    </Animated.View>
  );
});

const QuestionContainer = memo(({ 
    questionText,
    currentQuestion,
    selectedOption,
    onSelectOption,
    onConfirm,
    isAnswerSubmitted,
    currentScore,
    onInfoPress,
    onTimerPause,
    // New props for multiplayer support
    disabled = false,
    isMultiplayer = false,
    spectatorMode = false,
    activePlayerName = null,
    // Report modal callbacks
    onReportModalOpen,
    onReportModalClose,
    // NEW: PowerUp props
    removedAnswerIndices = [],
    powerUpEffects = {}
  }) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);
    
    // NEW: PowerUp effect state
    const [showPowerUpEffect, setShowPowerUpEffect] = useState(false);

    // NEW: Check if 50/50 is active
    const isFiftyFiftyActive = removedAnswerIndices.length > 0;

    // NEW: Show powerup effect when 50/50 activates
    useEffect(() => {
      if (isFiftyFiftyActive) {
        setShowPowerUpEffect(true);
        const timer = setTimeout(() => {
          setShowPowerUpEffect(false);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }, [isFiftyFiftyActive]);
  
    const handleOptionPress = (option) => {
      if (disabled || spectatorMode) return;
      
      const friction = Platform.OS === 'android' ? 4 : 3;
      const duration = Platform.OS === 'android' ? 150 : 300;
      
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.02,
          useNativeDriver: true,
          friction: friction,
          duration: duration,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: friction,
          duration: duration,
        }),
      ]).start();
  
      onSelectOption(option);
    };
  
    const handleInfoPress = () => {
      if (onTimerPause) onTimerPause(true);
      if (onInfoPress) onInfoPress();
    };
    
    const handleReportQuestion = () => {
      console.log('📝 Report button clicked - opening modal and pausing timer');
      setIsReportModalVisible(true);
      if (onTimerPause) onTimerPause(true);
      if (onReportModalOpen) onReportModalOpen();
    };
    
    useEffect(() => {
      return () => {
        if (isReportModalVisible && onTimerPause) {
          onTimerPause(false);
        }
      };
    }, [isReportModalVisible, onTimerPause]);

    // NEW: Check if an option index is removed by 50/50
    const isOptionRemoved = (index) => {
      return removedAnswerIndices.includes(index);
    };
  
    const renderSpectatorBanner = () => {
      if (!spectatorMode || !isMultiplayer) return null;
      
      return (
        <View style={styles.spectatorBanner}>
          <Ionicons name="eye" size={responsiveSize(16)} color="#FFFFFF" />
          <Text style={styles.spectatorBannerText}>
            SPECTATOR MODE {activePlayerName ? `- ${activePlayerName}'s turn` : ''}
          </Text>
        </View>
      );
    };

    // NEW: Enhanced points section with powerup indicators
    const renderPointsSection = () => {
      const hasActiveEffects = Object.keys(powerUpEffects).length > 0;
      
      return (
        <View style={styles.pointsContainer}>
          <View style={styles.scoreSection}>
            <Text style={[
              styles.pointsText,
              Platform.OS === 'android' && styles.pointsTextAndroid
            ]}>
              Points: <Text style={[
                styles.pointsValue,
                Platform.OS === 'android' && styles.pointsValueAndroid
              ]}>{currentScore}</Text>
            </Text>
            
            {/* NEW: PowerUp effect indicators */}
            {hasActiveEffects && (
              <View style={styles.activeEffectsContainer}>
                {powerUpEffects.point_booster && (
                  <View style={styles.effectIndicator}>
                    <Text style={styles.effectIcon}>💎</Text>
                    <Text style={styles.effectText}>2x</Text>
                  </View>
                )}
                {isFiftyFiftyActive && (
                  <View style={styles.effectIndicator}>
                    <Text style={styles.effectIcon}>⚡</Text>
                    <Text style={styles.effectText}>50/50</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                Platform.OS === 'android' && { 
                  padding: responsiveSpacing(8), 
                  marginHorizontal: responsiveSpacing(3) 
                }
              ]}
              onPress={handleReportQuestion}
              hitSlop={Platform.OS === 'android' ? { 
                top: 10, bottom: 10, left: 10, right: 10 
              } : undefined}
              disabled={disabled}
            >
              <Ionicons name="flag-outline" size={responsiveSize(18)} color="#FFD700" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.iconButton,
                Platform.OS === 'android' && { 
                  padding: responsiveSpacing(8), 
                  marginHorizontal: responsiveSpacing(3) 
                }
              ]}
              onPress={handleInfoPress}
              hitSlop={Platform.OS === 'android' ? { 
                top: 10, bottom: 10, left: 10, right: 10 
              } : undefined}
              disabled={disabled}
            >
              <Ionicons name="information-circle" size={responsiveSize(20)} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>
      );
    };
  
    if (isAnswerSubmitted) {
      return (
        <View style={styles.container}>
          {renderSpectatorBanner()}
          <LightBar />
          <View style={styles.waitingContainer}>
            <Text style={[
              styles.waitingText,
              Platform.OS === 'android' && styles.waitingTextAndroid
            ]}>Let's Check To See If You're Correct!</Text>
            <View style={styles.sparkleContainer}>
              {[...Array(3)].map((_, i) => (
                <Text key={i} style={styles.sparkle}>✨</Text>
              ))}
            </View>
          </View>
          <LightBar />
          
          <ReportQuestionModal 
            visible={isReportModalVisible}
            question={{
              id: currentQuestion?.id || `question_${Math.random().toString(36).substring(2, 7)}`,
              pack: currentQuestion?.pack || "Unknown Pack",
              questionText: questionText,
              correctAnswer: currentQuestion?.['Correct Answer'] || currentQuestion?.correctAnswer
            }}
            onClose={() => {
              console.log('📝 Report modal closing from answer submitted state');
              setIsReportModalVisible(false);
              if (onTimerPause) onTimerPause(false);
              if (onReportModalClose) onReportModalClose();
            }}
          />
        </View>
      );
    }
  
    // NEW: Enhanced option button rendering with 50/50 support
    const renderOptionButton = (optionKey, index) => {
      const isSelected = currentQuestion && selectedOption === currentQuestion[optionKey];
      const isRemoved = isOptionRemoved(index);
      
      // NEW: Handle removed options for 50/50 powerup
      if (isRemoved) {
        return (
          <View
            key={optionKey}
            style={[
              styles.optionButton,
              styles.removedOption
            ]}
          >
            <View style={styles.optionContent}>
              <View style={[styles.optionLetterContainer, styles.removedOptionLetter]}>
                <Text style={[styles.optionLetter, styles.removedOptionLetterText]}>
                  {String.fromCharCode(65 + index)}
                </Text>
              </View>
              <View style={styles.removedOptionTextContainer}>
                <Text style={styles.removedOptionText}>
                  Eliminated by 50/50
                </Text>
                <View style={styles.strikethrough} />
              </View>
            </View>
            <View style={styles.removedOptionLightBar} />
          </View>
        );
      }
      
      // Common option content for available options
      const optionContent = (
        <View style={styles.optionContent}>
          <View style={styles.optionLetterContainer}>
            <Text style={styles.optionLetter}>
              {String.fromCharCode(65 + index)}
            </Text>
          </View>
          <Text 
            style={[
              styles.optionText,
              isSelected && styles.selectedOptionText
            ]}
            numberOfLines={3}
          >
            {currentQuestion?.[optionKey] || ''}
          </Text>
        </View>
      );
      
      // Platform-specific rendering for available options
      if (Platform.OS === 'android') {
        return (
          <View
            key={optionKey}
            style={[
              styles.optionButton,
              isSelected && styles.selectedOption,
              (disabled || spectatorMode) && styles.disabledButton,
              { elevation: 3, shadowColor: null, shadowOffset: null, shadowOpacity: null, shadowRadius: null }
            ]}
          >
            <TouchableNativeFeedback
              onPress={() => currentQuestion && handleOptionPress(currentQuestion[optionKey])}
              background={TouchableNativeFeedback.Ripple(isSelected ? '#212121' : '#FFD700', false)}
              useForeground={true}
              disabled={disabled || spectatorMode}
            >
              <View style={{ width: '100%' }}>
                {optionContent}
                <View style={[
                  styles.optionLightBar,
                  isSelected && styles.selectedOptionLightBar
                ]} />
              </View>
            </TouchableNativeFeedback>
          </View>
        );
      }
      
      return (
        <TouchableOpacity
          key={optionKey}
          style={[
            styles.optionButton,
            isSelected && styles.selectedOption,
            (disabled || spectatorMode) && styles.disabledButton
          ]}
          onPress={() => currentQuestion && handleOptionPress(currentQuestion[optionKey])}
          activeOpacity={0.8}
          disabled={disabled || spectatorMode}
        >
          {optionContent}
          <View style={[
            styles.optionLightBar,
            isSelected && styles.selectedOptionLightBar
          ]} />
        </TouchableOpacity>
      );
    };
  
    const renderConfirmButton = () => {
      const isDisabled = !selectedOption || disabled || spectatorMode;
      
      if (Platform.OS === 'android') {
        return (
          <View
            style={[
              styles.confirmButton,
              isDisabled && styles.confirmButtonDisabled,
              { 
                overflow: 'hidden',
                elevation: isDisabled ? 0 : 5,
                shadowColor: null,
                shadowOffset: null,
                shadowOpacity: null,
                shadowRadius: null
              }
            ]}
          >
            <TouchableNativeFeedback
              onPress={onConfirm}
              disabled={isDisabled}
              background={TouchableNativeFeedback.Ripple('#212121', false)}
              useForeground={true}
            >
              <View style={{ 
                alignItems: 'center', 
                width: '100%', 
                paddingVertical: responsiveSpacing(12) 
              }}>
                <Text style={styles.confirmButtonText}>FINAL ANSWER</Text>
              </View>
            </TouchableNativeFeedback>
            <View style={styles.confirmButtonLightBar} />
          </View>
        );
      }
      
      return (
        <TouchableOpacity
          style={[
            styles.confirmButton,
            isDisabled && styles.confirmButtonDisabled
          ]}
          onPress={onConfirm}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>FINAL ANSWER</Text>
          <View style={styles.confirmButtonLightBar} />
        </TouchableOpacity>
      );
    };
  
    return (
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        {renderSpectatorBanner()}
        <LightBar />
        
        {/* NEW: PowerUp Effect Overlay */}
        <PowerUpEffectOverlay 
          effect="fifty_fifty" 
          visible={showPowerUpEffect && isFiftyFiftyActive} 
        />
        
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
          overScrollMode={Platform.OS === 'android' ? 'never' : 'auto'}
          alwaysBounceVertical={!Platform.OS === 'android'}
        >
          <View style={styles.innerContainer}>
            {renderPointsSection()}
  
            <Text style={[
              styles.questionText,
              Platform.OS === 'android' && styles.questionTextAndroid
            ]}>
              {questionText}
            </Text>
  
            <View style={styles.optionsContainer}>
              {['Option A', 'Option B', 'Option C', 'Option D'].map((optionKey, index) => 
                renderOptionButton(optionKey, index)
              )}
            </View>
  
            {renderConfirmButton()}
          </View>
        </ScrollView>
        <LightBar />
        
        <ReportQuestionModal 
          visible={isReportModalVisible}
          question={{
            id: currentQuestion?.id || `question_${Math.random().toString(36).substring(2, 7)}`,
            pack: currentQuestion?.pack || "Unknown Pack",
            questionText: questionText,
            correctAnswer: currentQuestion?.['Correct Answer'] || currentQuestion?.correctAnswer
          }}
          onClose={() => {
            console.log('📝 Report modal closing from main game state');
            setIsReportModalVisible(false);
            if (onTimerPause) onTimerPause(false);
            if (onReportModalClose) onReportModalClose();
          }}
        />
      </Animated.View>
    );
  });

// Calculate safe maximum height to prevent off-screen rendering
const getSafeMaxHeight = () => {
  const statusBarHeight = Platform.OS === 'ios' ? 44 : 24;
  const navigationHeight = 100;
  const bottomSafeArea = Platform.OS === 'ios' ? 34 : 24;
  const safeMargin = 40;
  
  const availableHeight = height - statusBarHeight - navigationHeight - bottomSafeArea - safeMargin;
  
  let maxHeight;
  if (isTablet()) {
    maxHeight = Math.min(availableHeight * 0.85, 700);
  } else {
    maxHeight = Math.min(availableHeight * 0.80, 600);
  }
  
  const minHeight = 400;
  const finalHeight = Math.max(maxHeight, minHeight);
  
  console.log('📱 Screen dimensions:', { width, height });
  console.log('📏 Safe height calculation:', {
    availableHeight,
    calculatedMaxHeight: maxHeight,
    finalHeight,
    deviceType: isTablet() ? 'tablet' : 'phone'
  });
  
  return finalHeight;
};

const styles = StyleSheet.create({
  container: {
    width: isTablet() ? Math.min(width * 0.9, 800) : width * 0.95,
    maxHeight: getSafeMaxHeight(),
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: responsiveSize(15),
    overflow: 'hidden',
    borderWidth: responsiveSize(2),
    borderColor: '#FFD700',
    marginVertical: responsiveSpacing(5),
  },
  innerContainer: {
    padding: responsiveSpacing(15),
    alignItems: 'center',
  },
  lightBar: {
    height: responsiveSize(8),
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing(5),
  },
  light: {
    width: responsiveSize(6),
    height: responsiveSize(6),
    borderRadius: responsiveSize(3),
    backgroundColor: '#FFFFFF',
    marginVertical: responsiveSpacing(1),
  },
  questionText: {
    fontSize: responsiveFont(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: responsiveSpacing(15),
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: responsiveSpacing(10),
  },
  questionTextAndroid: {
    textShadowColor: null,
    textShadowOffset: null,
    textShadowRadius: null,
  },
  optionsContainer: {
    width: '100%',
    marginBottom: responsiveSpacing(15),
  },
  optionButton: {
    marginVertical: responsiveSpacing(5),
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: responsiveSize(10),
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing(10),
    minHeight: isTablet() ? responsiveSize(60) : (Platform.OS === 'android' ? 50 : 44),
  },
  optionLetterContainer: {
    width: responsiveSize(30),
    height: responsiveSize(30),
    borderRadius: responsiveSize(15),
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSpacing(15),
  },
  optionLetter: {
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
    color: '#000',
  },
  optionText: {
    fontSize: responsiveFont(18),
    color: '#000',
    flex: 1,
  },
  selectedOption: {
    backgroundColor: '#FFD700',
  },
  selectedOptionText: {
    color: '#000',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: 'rgba(200, 200, 200, 0.9)',
  },
  
  // NEW: 50/50 PowerUp Styles
  removedOption: {
    backgroundColor: 'rgba(100, 100, 100, 0.6)',
    opacity: 0.5,
  },
  removedOptionLetter: {
    backgroundColor: '#666',
  },
  removedOptionLetterText: {
    color: '#999',
  },
  removedOptionTextContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  removedOptionText: {
    fontSize: responsiveFont(16),
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  strikethrough: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF0000',
    top: '50%',
    marginTop: -1,
  },
  removedOptionLightBar: {
    height: responsiveSize(2),
    backgroundColor: '#666',
    opacity: 0.5,
  },
  
  // NEW: PowerUp Effect Overlay Styles
  powerUpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: responsiveSize(15),
  },
  powerUpOverlayIcon: {
    fontSize: responsiveFont(48),
    marginBottom: responsiveSpacing(10),
  },
  powerUpOverlayText: {
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: responsiveSpacing(5),
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  powerUpOverlaySubtext: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  optionLightBar: {
    height: responsiveSize(2),
    backgroundColor: '#FFD700',
    opacity: 0.7,
  },
  selectedOptionLightBar: {
    opacity: 1,
    height: responsiveSize(3),
  },
  confirmButton: {
    backgroundColor: '#FFD700',
    paddingVertical: responsiveSpacing(12),
    paddingHorizontal: responsiveSpacing(30),
    borderRadius: responsiveSize(25),
    marginTop: responsiveSpacing(10),
    width: isTablet() ? '70%' : '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confirmButtonText: {
    color: '#000',
    fontSize: responsiveFont(20),
    fontWeight: 'bold',
  },
  confirmButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  confirmButtonLightBar: {
    height: responsiveSize(2),
    backgroundColor: '#000',
    opacity: 0.2,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  
  // NEW: Enhanced points container with powerup effects
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(8),
    paddingHorizontal: responsiveSpacing(12),
    borderRadius: responsiveSize(15),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#FFD700',
    width: '100%',
  },
  scoreSection: {
    flex: 1,
  },
  pointsText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(14),
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pointsTextAndroid: {
    textShadowColor: null,
    textShadowOffset: null,
    textShadowRadius: null,
  },
  pointsValue: {
    color: '#FFD700',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pointsValueAndroid: {
    textShadowColor: null,
    textShadowOffset: null,
    textShadowRadius: null,
  },
  
  // NEW: Active effects container
  activeEffectsContainer: {
    flexDirection: 'row',
    marginTop: responsiveSpacing(4),
  },
  effectIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: responsiveSize(8),
    paddingHorizontal: responsiveSpacing(6),
    paddingVertical: responsiveSpacing(2),
    marginRight: responsiveSpacing(4),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  effectIcon: {
    fontSize: responsiveFont(12),
    marginRight: responsiveSpacing(2),
  },
  effectText: {
    fontSize: responsiveFont(10),
    color: '#FFD700',
    fontWeight: 'bold',
  },
  
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: responsiveSpacing(5),
    marginHorizontal: responsiveSpacing(5),
  },
  waitingContainer: {
    padding: responsiveSpacing(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    color: '#FFD700',
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  waitingTextAndroid: {
    textShadowColor: null,
    textShadowOffset: null,
    textShadowRadius: null,
  },
  sparkleContainer: {
    flexDirection: 'row',
    marginTop: responsiveSpacing(15),
  },
  sparkle: {
    fontSize: responsiveFont(24),
    marginHorizontal: responsiveSpacing(10),
  },
  scrollContainer: {
    maxHeight: Platform.OS === 'android' ? getSafeMaxHeight() : undefined,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  spectatorBanner: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsiveSpacing(8),
    borderRadius: responsiveSize(8),
    marginVertical: responsiveSpacing(5),
    width: '100%',
  },
  spectatorBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: responsiveFont(16),
    marginLeft: responsiveSpacing(5),
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  }
});

QuestionContainer.displayName = 'QuestionContainer';
export default QuestionContainer;