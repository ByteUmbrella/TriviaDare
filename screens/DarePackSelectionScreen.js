import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView, View, Modal, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DarePackSelectionScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [dareCount, setDareCount] = useState(5);
  
  const packs = [
    {
      name: 'Family Friendly',
      color: '#0A3264', // Adjusted for consistency
      description: 'Fun for the whole family! Dares suitable for all ages.',
    },
    {
      name: 'IceBreakers',
      color: '#0A3264', // Adjusted for consistency
      description: 'Get to know each other with these light-hearted challenges.',
    },
    {
      name: 'Couples',
      color: '#0A3264', // Adjusted for consistency
      description: 'Strengthen your bond with fun and romantic dares.',
    },
    {
      name: 'Out In Public',
      color: '#0A3264', // Adjusted for consistency
      description: 'Dares that involve interactions in social settings.',
    },
    {
      name: 'Music Mania',
      color: '#00BCD4', // Cool Cyan
      description: 'For music lovers, dares involve singing, dancing, or performing to your favorite tunes.',
    },
    {
      name: 'Office Fun',
      color: '#3F51B5', // Professional Blue
      description: 'Lighten up the workday with office-appropriate dares that build teamwork and camaraderie.',
    },
    {
      name: 'Adventure Seekers',
      color: '#4CAF50', // Energetic Green
      description: 'Challenge your limits with thrilling and adventurous dares perfect for the fearless.',
    },
    {
      name: 'Bar',
      color: '#FF0000', // Solid color for better rendering
      description: 'Night out? Spice it up with these bar-themed dares. 18+ only.',
      ageRestricted: true,
    },
    {
      name: 'Spicy',
      color: '#FF0000', // Solid color for better rendering
      description: 'Turn up the heat with these daring challenges. 18+ only.',
      ageRestricted: true,
    },
  ];

  const handleSelectPack = (pack) => {
    setSelectedPack(pack);
    setDareCount(5); // reset to default minimum
    setModalVisible(true);
  };

  const handleConfirmDares = () => {
    navigation.navigate('DareOnlyScreen', { packName: selectedPack.name, dareCount });
    setModalVisible(false);
  };

  return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Select Your Dare Pack</Text>
        {packs.map((pack, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.packButton, { backgroundColor: pack.color }]}
            onPress={() => handleSelectPack(pack)}
          >
            <Text style={styles.packButtonText}>{pack.name}</Text>
          </TouchableOpacity>
        ))}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close-circle" size={24} color="black" />
              </TouchableOpacity>
              <Text style={styles.modalText}>{selectedPack?.name}</Text>
              <Text style={styles.modalDescription}>{selectedPack?.description}</Text>
              
              <View style={styles.counterContainer}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setDareCount(Math.max(dareCount - 1, 5))}
                >
                  <Text style={styles.counterButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterText}>{dareCount}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setDareCount(Math.min(dareCount + 1, 25))}
                >
                  <Text style={styles.counterButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.dareCountLabel}>Dares per Person: {dareCount}</Text>
              <TouchableOpacity
                style={styles.buttonClose}
                onPress={handleConfirmDares}
              >
                <Text style={styles.textStyle}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white', // Changed to white for better visibility on dark background
    marginBottom: 20,
    textAlign: 'center',
  },
  packButton: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, // Reduced opacity
    shadowRadius: 2, // Reduced radius
    elevation: 5,
  },
  packButtonText: {
    color: 'white', // Adjusted for contrast
    fontSize: 18,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
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
  },
  modalDescription: {
    marginBottom: 20,
    textAlign: 'center',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ddd',
    marginHorizontal: 20,
  },
  counterButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  counterText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonClose: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'transparent',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dareCountLabel: {
    fontSize: 18,
    marginBottom: 10,
  },
});

export default DarePackSelectionScreen;
