import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Gameshow style colors
const COLORS = {
  primary: '#4A148C',  // Deep purple
  secondary: '#7B1FA2', // Purple
  accent: '#FF9800',    // Orange
  text: '#FFFFFF',      // White
  highlight: '#FFEB3B', // Yellow
  shadow: 'rgba(0,0,0,0.5)',
};

const STORAGE_KEY = 'HAS_LAUNCHED_V1.0.7'; // Update this when you want to show the popup again

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

const { width, height } = Dimensions.get('window');

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
    width: width * 0.85,
    maxHeight: height * 0.7,
    borderRadius: 20,
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
    padding: 20,
    alignItems: 'center',
    borderRadius: 20,
  },
  decorativeDots: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.highlight,
    marginHorizontal: 3,
  },
  titleContainer: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 15,
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
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  messageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  message: {
    color: '#333',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 10,
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
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
});

export default PopUpAlert;