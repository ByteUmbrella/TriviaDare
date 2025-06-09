import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
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

// Array of random messages for incorrect answers
const INCORRECT_MESSAGES = [
  "WRONG ANSWER!",
  "NOT QUITE!",
  "MISSED IT!",
  "INCORRECT!",
  "OOPS!",
  "TRY AGAIN!",
  "SO CLOSE!",
  "BETTER LUCK NEXT TIME!",
  "NOT THIS TIME!",
  "ALMOST!",
  "NOPE!",
  "SWING AND A MISS!",
  "NICE TRY!",
  "NOT TODAY!",
  "CLOSE, BUT NO CIGAR!",
  "KEEP TRYING!",
  "UNLUCKY!",
  "WHOOPS!",
  "NOT CORRECT!",
  "ALMOST HAD IT!"
];

const CorrectAnswerPopUp = ({ 
  visible, 
  onContinue,
  currentPlayer,
  question,
  gameMode,
  // Report modal callbacks
  onReportModalOpen,
  onReportModalClose
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [randomMessage] = useState(() => 
    INCORRECT_MESSAGES[Math.floor(Math.random() * INCORRECT_MESSAGES.length)]
  );
  
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

  useEffect(() => {
    if (visible) {
      // Start fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset fade animation when not visible
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleReportQuestion = () => {
    console.log('📝 Report button clicked from CorrectAnswerPopUp');
    setIsReportModalVisible(true);
    if (onReportModalOpen) onReportModalOpen();
  };

  const handleContinue = () => {
    // Android haptic feedback
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(100);
      } catch (e) {
        console.log('Vibration not available');
      }
    }

    // Fade out animation before continuing
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: Platform.OS === 'android' ? 150 : 200,
      useNativeDriver: true,
    }).start(() => {
      onContinue();
    });
  };

  if (!question) return null;

  // Get the correct answer
  const correctAnswerKey = question['Correct Answer'];
  const correctAnswer = question[correctAnswerKey];

  // Determine what happens next based on game mode
  const shouldShowDare = gameMode === 'TriviaDARE';
  const nextAction = shouldShowDare ? "See Your Dare" : "Continue";

  // Platform specific button rendering
  const renderContinueButton = () => {
    if (Platform.OS === 'android') {
      return (
        <View style={[styles.buttonWrapper, styles.continueButtonWrapper]}>
          <TouchableNativeFeedback
            background={TouchableNativeFeedback.Ripple('#FFFFFF', false)}
            onPress={handleContinue}
          >
            <View style={[styles.button, styles.continueButton, styles.buttonAndroid]}>
              <Text style={[styles.buttonText, styles.buttonTextAndroid]}>{nextAction}</Text>
            </View>
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.button, styles.continueButton]}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>{nextAction}</Text>
      </TouchableOpacity>
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
              styles.headerContainer,
              Platform.OS === 'android' ? styles.headerContainerAndroid : {}
            ]}>
              <Text style={[
                styles.headerText,
                Platform.OS === 'android' ? styles.headerTextAndroid : {}
              ]}>
                {randomMessage}
              </Text>
            </View>

            {/* Report button positioned absolutely in top-right */}
            <TouchableOpacity
              style={[
                styles.reportButtonAbsolute,
                Platform.OS === 'android' && { 
                  padding: responsiveSpacing(8),
                  top: responsiveSpacing(15),
                  right: responsiveSpacing(15)
                }
              ]}
              onPress={handleReportQuestion}
              hitSlop={Platform.OS === 'android' ? { 
                top: 10, bottom: 10, left: 10, right: 10 
              } : undefined}
            >
              <Ionicons name="flag-outline" size={responsiveSize(20)} color="#FFD700" />
            </TouchableOpacity>

            <View style={[
              styles.answerContainer,
              Platform.OS === 'android' ? styles.answerContainerAndroid : {}
            ]}>
              <View style={styles.answerHeader}>
                <Text style={[
                  styles.answerLabel,
                  Platform.OS === 'android' ? styles.answerLabelAndroid : {}
                ]}>
                  The correct answer was:
                </Text>
              </View>
              
              <View style={styles.correctAnswerBox}>
                <View style={styles.answerLetterContainer}>
                  <Text style={styles.answerLetter}>
                    {correctAnswerKey?.slice(-1) || '?'}
                  </Text>
                </View>
                <Text style={[
                  styles.correctAnswerText,
                  Platform.OS === 'android' ? styles.correctAnswerTextAndroid : {}
                ]}>
                  {correctAnswer}
                </Text>
              </View>
            </View>

            <View style={styles.encouragementContainer}>
              <Text style={[
                styles.encouragementText,
                Platform.OS === 'android' ? styles.encouragementTextAndroid : {}
              ]}>
                {shouldShowDare 
                  ? "Better luck next time! Now complete your dare!" 
                  : "Better luck next time! Let's continue playing!"}
              </Text>
            </View>

            {renderContinueButton()}
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
      
      {/* Report Question Modal */}
      <ReportQuestionModal 
        visible={isReportModalVisible}
        question={{
          id: question?.id || `question_${Math.random().toString(36).substring(2, 7)}`,
          pack: question?.pack || "Unknown Pack",
          questionText: question?.['Question Text'] || "Unknown Question",
          correctAnswer: correctAnswer
        }}
        onClose={() => {
          console.log('📝 Report modal closing from CorrectAnswerPopUp');
          setIsReportModalVisible(false);
          if (onReportModalClose) onReportModalClose();
        }}
      />
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
    marginBottom: responsiveSpacing(15),
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
    marginBottom: responsiveSpacing(12),
  },
  headerContainer: {
    backgroundColor: '#000000',
    paddingHorizontal: responsiveSpacing(20),
    paddingVertical: responsiveSpacing(8),
    borderRadius: responsiveSize(15),
    marginBottom: responsiveSpacing(20),
    borderWidth: 1,
    borderColor: '#FFD700',
    width: '100%',
    justifyContent: 'center', // Center the content
    alignItems: 'center', // Center the content
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
    }),
  },
  headerContainerAndroid: {
    elevation: 4,
    paddingHorizontal: responsiveSpacing(18),
    marginBottom: responsiveSpacing(16),
  },
  headerText: {
    fontSize: responsiveFont(18),
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerTextAndroid: {
    fontSize: responsiveFont(16),
    fontWeight: '700',
  },
  reportButtonAbsolute: {
    position: 'absolute',
    top: responsiveSpacing(20),
    right: responsiveSpacing(20),
    padding: responsiveSpacing(5),
    zIndex: 10,
  },
  answerContainer: {
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
  answerContainerAndroid: {
    elevation: 5,
    padding: responsiveSpacing(16),
    marginBottom: responsiveSpacing(16),
  },
  answerHeader: {
    marginBottom: responsiveSpacing(15),
  },
  answerLabel: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  answerLabelAndroid: {
    fontSize: responsiveFont(14),
  },
  correctAnswerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(15),
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  answerLetterContainer: {
    width: responsiveSize(40),
    height: responsiveSize(40),
    borderRadius: responsiveSize(20),
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSpacing(15),
  },
  answerLetter: {
    fontSize: responsiveFont(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  correctAnswerText: {
    fontSize: responsiveFont(18),
    color: '#FFFFFF',
    flex: 1,
    fontWeight: 'bold',
  },
  correctAnswerTextAndroid: {
    fontSize: responsiveFont(16),
  },
  encouragementContainer: {
    marginBottom: responsiveSpacing(20),
  },
  encouragementText: {
    fontSize: responsiveFont(16),
    color: '#FFFFFF',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: responsiveFont(22),
  },
  encouragementTextAndroid: {
    fontSize: responsiveFont(14),
    lineHeight: responsiveFont(20),
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: responsiveSize(25),
    marginVertical: responsiveSpacing(8),
    overflow: 'hidden',
  },
  continueButtonWrapper: {
    backgroundColor: '#FFD700',
  },
  button: {
    width: '100%',
    paddingVertical: responsiveSpacing(15),
    paddingHorizontal: responsiveSpacing(20),
    borderRadius: responsiveSize(25),
    marginVertical: responsiveSpacing(8),
    borderWidth: 1,
    borderColor: '#000',
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
  continueButton: {
    backgroundColor: '#FFD700',
  },
  buttonText: {
    color: '#000',
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  buttonTextAndroid: {
    fontSize: responsiveFont(16),
    fontWeight: '700',
    textShadowColor: undefined,
    textShadowOffset: undefined,
    textShadowRadius: undefined,
    elevation: 2,
  }
});

export default CorrectAnswerPopUp;