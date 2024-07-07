import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

const PlayerModal = ({ isVisible, onClose, players, setPlayers }) => {
  const [newPlayer, setNewPlayer] = useState('');

  const handleAddPlayer = () => {
    if (newPlayer.trim()) {
      setPlayers(prev => [...prev, newPlayer.trim()]);
      setNewPlayer('');
    }
  };

  const handleRemovePlayer = (index) => {
    if (players.length > 2) {
      setPlayers(prev => prev.filter((_, i) => i !== index));
    } else {
      // Alert the user that at least two players are needed
      Alert.alert("Cannot Remove Player", "At least two players are required.", [{ text: "OK" }]);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <TextInput
            style={styles.input}
            placeholder="Enter player's name"
            value={newPlayer}
            onChangeText={setNewPlayer}
            onSubmitEditing={handleAddPlayer}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer}>
            <Text style={styles.addButtonText}>Add Player</Text>
          </TouchableOpacity>
          <FlatList
            data={players}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.playerItem}>
                <Text style={styles.playerName}>{item}</Text>
                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemovePlayer(index)}>
                  <AntDesign name="closecircle" size={24} color="white" />
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  input: {
    width: '100%',
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
  },
  addButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#d3d3d3',
    borderRadius: 10,
  },
  closeButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#aaa',
  },
  playerName: {
    fontSize: 26,
    color: '#333',
    flex: 1, // Ensures it takes up the rest of the space not used by the button
    minWidth: 100, // Ensures that the name has at least 100 pixels of space
    backgroundColor: 'white', // Temporary for debugging
  },
  removeButton: {
    padding: 5,
    backgroundColor: '#ff6347',
    borderRadius: 2,
    minWidth: 54, // Ensures the button is at least 60 pixels wide
  },
  removeButtonText: {
    color: 'white',
    fontSize: 19,
    textAlign: 'center',
  },
  disclaimerText: {
    marginTop: 10,
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

export default PlayerModal;
