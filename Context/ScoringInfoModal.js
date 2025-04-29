import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  BackHandler, 
  Platform,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ScoringInfoModal = ({ visible, onClose }) => {
  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android' && visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      
      return () => backHandler.remove();
    }
  }, [visible, onClose]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <SafeAreaView style={styles.centeredView}>
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.7)" translucent={true} />
        <View style={styles.modalView}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.modalTitle}>Scoring System</Text>
          
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollViewContent}
            overScrollMode={Platform.OS === 'android' ? 'never' : 'always'}
          >
            <Text style={styles.sectionTitle}>Base Scores</Text>
            <View style={styles.scoreBreakdown}>
              <Text style={styles.scoreText}>• Easy: 50 points</Text>
              <Text style={styles.scoreText}>• Medium: 100 points</Text>
              <Text style={styles.scoreText}>• Hard: 200 points</Text>
              <Text style={styles.scoreText}>• Impossible: 400 points</Text>
            </View>

            <Text style={styles.sectionTitle}>Time Limits</Text>
            <View style={styles.scoreBreakdown}>
              <Text style={styles.scoreText}>• Easy: 20 seconds</Text>
              <Text style={styles.scoreText}>• Medium: 15 seconds</Text>
              <Text style={styles.scoreText}>• Hard: 12 seconds</Text>
              <Text style={styles.scoreText}>• Impossible: 10 seconds</Text>
            </View>

            <Text style={styles.sectionTitle}>Time Bonus</Text>
            <View style={styles.scoreBreakdown}>
              <Text style={styles.scoreText}>• 2 points per second remaining</Text>
              <Text style={styles.explanationText}>Example: If you answer with 5 seconds left, you get 10 bonus points!</Text>
            </View>

            <Text style={styles.sectionTitle}>Dare Points</Text>
            <View style={styles.scoreBreakdown}>
              <Text style={styles.scoreText}>Wrong Answer:</Text>
              <Text style={styles.explanationText}>• Get 75% of base points if dare completed</Text>
              <Text style={[styles.scoreText, { marginTop: 10 }]}>Time Out:</Text>
              <Text style={styles.explanationText}>• Get 50% of base points if dare completed</Text>
            </View>

            <Text style={styles.sectionTitle}>Maximum Possible Scores</Text>
            <View style={styles.scoreBreakdown}>
              <Text style={styles.scoreText}>Easy: 90 points</Text>
              <Text style={styles.subText}>(50 base + 40 max time bonus)</Text>
              
              <Text style={styles.scoreText}>Medium: 130 points</Text>
              <Text style={styles.subText}>(100 base + 30 max time bonus)</Text>
              
              <Text style={styles.scoreText}>Hard: 224 points</Text>
              <Text style={styles.subText}>(200 base + 24 max time bonus)</Text>
              
              <Text style={styles.scoreText}>Impossible: 420 points</Text>
              <Text style={styles.subText}>(400 base + 20 max time bonus)</Text>
            </View>
            
            {/* Add padding at bottom for better scrolling on Android */}
            <View style={{ height: Platform.OS === 'android' ? 20 : 0 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: Platform.OS === 'android' ? '85%' : '80%',
    backgroundColor: '#304FFE',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 8 : 5
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 10,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'center',
    width: '80%',
  },
  scrollView: {
    width: '100%',
  },
  scrollViewContent: {
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'android' ? 18 : 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 15,
    marginBottom: 10,
  },
  scoreBreakdown: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  scoreText: {
    fontSize: Platform.OS === 'android' ? 15 : 16,
    color: 'white',
    marginVertical: 5,
    fontWeight: '500',
  },
  explanationText: {
    fontSize: Platform.OS === 'android' ? 15 : 16,
    color: 'white',
    marginVertical: 5,
    paddingLeft: 15,
  },
  subText: {
    fontSize: Platform.OS === 'android' ? 13 : 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 15,
    marginBottom: 10,
  }
});

export default ScoringInfoModal;