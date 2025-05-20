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
    activePlayerName = null
  }) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    // Add state for report modal
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  
    const handleOptionPress = (option) => {
      // Don't allow selection if disabled or in spectator mode
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
    
    // Add handler for report button
    const handleReportQuestion = () => {
      setIsReportModalVisible(true);
      if (onTimerPause) onTimerPause(true);
    };
    
    // Add effect to ensure timer resumes if component unmounts with modal open
    useEffect(() => {
      return () => {
        if (isReportModalVisible && onTimerPause) {
          onTimerPause(false);
        }
      };
    }, [isReportModalVisible, onTimerPause]);
  
    // Render spectator banner when in spectator mode
    const renderSpectatorBanner = () => {
      if (!spectatorMode || !isMultiplayer) return null;
      
      return (
        <View style={styles.spectatorBanner}>
          <Ionicons name="eye" size={16} color="#FFFFFF" />
          <Text style={styles.spectatorBannerText}>
            SPECTATOR MODE {activePlayerName ? `- ${activePlayerName}'s turn` : ''}
          </Text>
        </View>
      );
    };
  
    const renderPointsSection = () => (
      <View style={styles.pointsContainer}>
        <Text style={[
          styles.pointsText,
          Platform.OS === 'android' && styles.pointsTextAndroid
        ]}>
          Points: <Text style={[
            styles.pointsValue,
            Platform.OS === 'android' && styles.pointsValueAndroid
          ]}>{currentScore}</Text>
        </Text>
        
        <View style={styles.buttonsRow}>
          {/* Report button */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              Platform.OS === 'android' && { padding: 8, marginHorizontal: 3 }
            ]}
            onPress={handleReportQuestion}
            hitSlop={Platform.OS === 'android' ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
            disabled={disabled}
          >
            <Ionicons name="flag-outline" size={18} color="#FFD700" />
          </TouchableOpacity>
          
          {/* Info button */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              Platform.OS === 'android' && { padding: 8, marginHorizontal: 3 }
            ]}
            onPress={handleInfoPress}
            hitSlop={Platform.OS === 'android' ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
            disabled={disabled}
          >
            <Ionicons name="information-circle" size={20} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>
    );
  
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
          
          {/* Add the report modal */}
          <ReportQuestionModal 
            visible={isReportModalVisible}
            question={{
              id: currentQuestion?.id || `question_${Math.random().toString(36).substring(2, 7)}`,
              pack: currentQuestion?.pack || "Unknown Pack",
              questionText: questionText,
              correctAnswer: currentQuestion?.['Correct Answer'] || currentQuestion?.correctAnswer
            }}
            onClose={() => {
              setIsReportModalVisible(false);
              // Resume timer when the modal is closed
              if (onTimerPause) onTimerPause(false);
            }}
          />
        </View>
      );
    }
  
    // Render option button based on platform
    const renderOptionButton = (optionKey, index) => {
      const isSelected = currentQuestion && selectedOption === currentQuestion[optionKey];
      
      // Common option content for both platforms
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
      
      // Use TouchableNativeFeedback on Android for better touch feedback
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
      
      // Use TouchableOpacity for iOS
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
  
    // Render confirm button based on platform
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
              <View style={{ alignItems: 'center', width: '100%', paddingVertical: 12 }}>
                <Text style={styles.confirmButtonText}>FINAL ANSWER</Text>
              </View>
            </TouchableNativeFeedback>
            <View style={styles.confirmButtonLightBar} />
          </View>
        );
      }
      
      // Use TouchableOpacity for iOS
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
        
        {/* Add the report modal */}
        <ReportQuestionModal 
          visible={isReportModalVisible}
          question={{
            id: currentQuestion?.id || `question_${Math.random().toString(36).substring(2, 7)}`,
            pack: currentQuestion?.pack || "Unknown Pack",
            questionText: questionText,
            correctAnswer: currentQuestion?.['Correct Answer'] || currentQuestion?.correctAnswer
          }}
          onClose={() => {
            setIsReportModalVisible(false);
            // Resume timer when the modal is closed
            if (onTimerPause) onTimerPause(false);
          }}
        />
      </Animated.View>
    );
  });

const styles = StyleSheet.create({
    container: {
        width: width * 0.95,
        maxHeight: height * 0.65,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FFD700',
        marginVertical: 5,
      },
  innerContainer: {
    padding: 15,
    alignItems: 'center',
  },
  lightBar: {
    height: 8,
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  light: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginVertical: 1,
  },
  questionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: 10,
  },
  questionTextAndroid: {
    textShadowColor: null,
    textShadowOffset: null,
    textShadowRadius: null,
  },
  optionsContainer: {
    width: '100%',
    marginBottom: 15,
  },
  optionButton: {
    marginVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
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
    padding: 10,
    minHeight: Platform.OS === 'android' ? 50 : 44,
  },
  optionLetterContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionLetter: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  optionText: {
    fontSize: 18,
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
  // New style for disabled buttons
  disabledButton: {
    opacity: 0.7,
    backgroundColor: 'rgba(200, 200, 200, 0.9)',
  },
  optionLightBar: {
    height: 2,
    backgroundColor: '#FFD700',
    opacity: 0.7,
  },
  selectedOptionLightBar: {
    opacity: 1,
    height: 3,
  },
  confirmButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 10,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  confirmButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  confirmButtonLightBar: {
    height: 2,
    backgroundColor: '#000',
    opacity: 0.2,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Changed from 'center' to 'space-between'
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#FFD700',
    width: '100%', // Added to ensure full width
  },
  pointsText: {
    color: '#FFFFFF',
    fontSize: 14,
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
  // New styles for the buttons row
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 5,
    marginHorizontal: 5,
  },
  waitingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    color: '#FFD700',
    fontSize: 24,
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
    marginTop: 15,
  },
  sparkle: {
    fontSize: 24,
    marginHorizontal: 10,
  },
  scrollContainer: {
    maxHeight: Platform.OS === 'android' ? height * 0.65 : undefined,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  // Styles for spectator banner
  spectatorBanner: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    marginVertical: 5,
    width: '100%',
  },
  spectatorBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  }
});

QuestionContainer.displayName = 'QuestionContainer';
export default QuestionContainer;