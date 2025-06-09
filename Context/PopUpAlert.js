import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  SafeAreaView,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Add responsive functions at the top of the file
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Device type detection
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

// Gameshow style colors
const COLORS = {
  primary: '#4A148C',  // Deep purple
  secondary: '#7B1FA2', // Purple
  accent: '#FF9800',    // Orange
  text: '#FFFFFF',      // White
  highlight: '#FFEB3B', // Yellow
  shadow: 'rgba(0,0,0,0.5)',
};

const STORAGE_KEY = 'HAS_LAUNCHED_V1.0.9'; // Update this when you want to show the popup again

const PopUpAlert = ({ 
  title = "Welcome to TriviaDare!", 
  message = "Thank you for downloading TriviaDare! This game is crafted with care by a solo developer dedicated to creating a fun and engaging trivia experience. All questions are being carefully verified to ensure accuracy. If you spot any issues, there's an easy way to report them in the game. Enjoy the challenge, and may the best trivia master win!",
  buttonText = "Let's Play!"
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // Check if this is first launch
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (!hasLaunched) {
        // Show popup for new users or after updates
        setModalVisible(true);
        
        // Save that we've shown the popup for this version
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch (error) {
      console.log('Error checking first launch:', error);
    }
  };

  const handleClose = () => {
    setModalVisible(false);
  };

  // Don't render anything if the modal isn't showing
  if (!modalVisible) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.centeredView}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={styles.gradientBackground}
            >
              {/* Decorative elements - gameshow style */}
              <View style={styles.decorativeDots}>
                {[...Array(8)].map((_, i) => (
                  <View key={i} style={styles.dot} />
                ))}
              </View>
              
              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{title}</Text>
              </View>
              
              {/* Message */}
              <View style={styles.messageContainer}>
                <Text style={styles.message}>{message}</Text>
              </View>
              
              {/* Button */}
              <TouchableOpacity
                style={styles.button}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[COLORS.accent, '#F57C00']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>{buttonText}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Updated responsive styles
const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: isTablet() ? Math.min(600, SCREEN_WIDTH * 0.7) : SCREEN_WIDTH * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderRadius: responsiveSize(20),
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  gradientBackground: {
    padding: responsiveSpacing(20),
    alignItems: 'center',
    borderRadius: responsiveSize(20),
  },
  decorativeDots: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: responsiveSpacing(15),
  },
  dot: {
    width: responsiveSize(10),
    height: responsiveSize(10),
    borderRadius: responsiveSize(5),
    backgroundColor: COLORS.highlight,
    marginHorizontal: responsiveSpacing(3),
  },
  titleContainer: {
    backgroundColor: COLORS.accent,
    paddingVertical: responsiveSpacing(10),
    paddingHorizontal: responsiveSpacing(20),
    borderRadius: responsiveSize(15),
    marginBottom: responsiveSpacing(15),
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  title: {
    color: COLORS.text,
    fontSize: responsiveFont(22),
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  messageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: responsiveSize(10),
    padding: responsiveSpacing(15),
    marginBottom: responsiveSpacing(20),
    alignSelf: 'stretch',
  },
  message: {
    color: '#333',
    fontSize: responsiveFont(16),
    textAlign: 'center',
    lineHeight: responsiveFont(22),
  },
  button: {
    borderRadius: responsiveSize(25),
    overflow: 'hidden',
    marginTop: responsiveSpacing(10),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: responsiveSpacing(12),
    paddingHorizontal: responsiveSpacing(30),
    borderRadius: responsiveSize(25),
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: responsiveFont(18),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
});

export default PopUpAlert;