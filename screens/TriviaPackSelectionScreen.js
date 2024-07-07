import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, ImageBackground } from 'react-native';

const TriviaPackSelectionScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [activeTab, setActiveTab] = useState('Basic'); // 'Basic' or 'Premium'

  const triviaPacks = {
    Basic: [
      'General Knowledge', 'Science', 'History', 'Entertainment', 'Sports',
      'Art & Literature', 'Geography', 'Movies', 'Music', 'Technology'
    ],
    Premium: [
      'Harry Potter Movies', 
      'Friends Sitcom', 
      'Halloween Horror Nights', 
      'Walt Disney World', 
      'Fallout (TV Show)', 
      'Star Wars',
      '2000s Boy Bands',
      'Disneys Animated Mov'
    ]
  };

  const handleSelectPack = (pack) => {
    setSelectedPack(pack);
    setModalVisible(true);
  };

  const handleSetNumberOfQuestions = (change) => {
    setNumberOfQuestions(prev => Math.max(5, Math.min(prev + change, 25)));
  };

  const handleStartGame = () => {
    setModalVisible(false);
    navigation.navigate('DifficultyDareSelection', { selectedPack, numberOfQuestions });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={activeTab === 'Basic' ? styles.activeTab : styles.tab} onPress={() => setActiveTab('Basic')}>
          <Text style={styles.tabText}>Basic Packs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={activeTab === 'Premium' ? styles.activeTab : styles.tab} onPress={() => setActiveTab('Premium')}>
          <Text style={styles.tabText}>Premium Packs</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={triviaPacks[activeTab]}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.packItem} onPress={() => handleSelectPack(item)}>
            <Text style={styles.packText}>{item}</Text>
          </TouchableOpacity>
        )}
        numColumns={2}
        key={'two-columns'}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Select the number of questions:</Text>
            <View style={styles.counterContainer}>
              <TouchableOpacity style={styles.counterButton} onPress={() => handleSetNumberOfQuestions(-1)}>
                <Text style={styles.counterButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.questionCount}>{numberOfQuestions}</Text>
              <TouchableOpacity style={styles.counterButton} onPress={() => handleSetNumberOfQuestions(1)}>
                <Text style={styles.counterButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={handleStartGame}>
              <Text style={styles.confirmButtonText}>Start Game</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.returnButton} onPress={handleCloseModal}>
              <Text style={styles.returnButtonText}>Return To Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)' // Enhance contrast with a dark overlay
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 2,
    borderColor: 'transparent'
  },
  activeTab: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 2,
    borderColor: '#00ff00'
  },
  tabText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold'
  },
  packItem: {
    backgroundColor: '#0A3264', // Solid color for better shadow calculation
    padding: 20,
    margin: 8,
    flex: 0.5, // Each item takes half of the horizontal space
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff00', // Neon green for a pop of color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, // Reduced opacity for better performance
    shadowRadius: 3, // Reduced radius
    elevation: 5,
  },
  packText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 0, 0.75)', // Neon green text shadow for glow effect
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
    backgroundColor: 'rgba(0,0,0,0.4)' // Semi-transparent overlay for modal background
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold'
  },
  counterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  counterButton: {
    backgroundColor: '#ff4500', // Bright red for a dynamic, attention-grabbing button
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 4,
    shadowRadius: 6,
    shadowOpacity: 0.8,
    shadowColor: '#ff4500', // Adding shadow to enhance the button's pop-out effect
    shadowOffset: { width: 0, height: 0 }
  },
  counterButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  questionCount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 20,
  },
  confirmButton: {
    backgroundColor: '#34C759', // Lively green for the confirmation button
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginTop: 20,
    shadowColor: '#34C759', // Matching shadow color
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18
  },
  returnButton: {
    backgroundColor: '#007aff', // Nice blue color
    borderRadius: 20,
    padding: 10,
    marginTop: 10,
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  returnButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18
  },
});

export default TriviaPackSelectionScreen;