import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  BackHandler
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';


const PlayerModal = ({ isVisible, onClose, players, setPlayers, onAddPlayer }) => {
  const [newPlayer, setNewPlayer] = useState('');
  

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android' && isVisible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      
      return () => backHandler.remove();
    }
  }, [isVisible, onClose]);

  const handleAddPlayer = () => {
    if (newPlayer.trim()) {
      onAddPlayer(newPlayer.trim());
      setNewPlayer('');
      if (Platform.OS === 'android') {
        Keyboard.dismiss();
      }
    }
  };

  const handleRemovePlayer = (index) => {
    // Remove setTimeout to prevent timing issues
    setPlayers(prevPlayers => {
      const updatedPlayers = [...prevPlayers];
      updatedPlayers.splice(index, 1);
      return updatedPlayers;
    });
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={true}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <KeyboardAvoidingView 
        style={styles.centeredView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={Keyboard.dismiss}
        >
          <View style={styles.modalView}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter player's name"
                value={newPlayer}
                onChangeText={setNewPlayer}
                onSubmitEditing={handleAddPlayer}
                returnKeyType="done"
                blurOnSubmit={Platform.OS === 'android'}
              />
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={handleAddPlayer}
                activeOpacity={0.7}
              >
                <AntDesign name="pluscircle" size={24} color="green" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={players}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.playerItem}>
                  <Text 
                    style={styles.playerName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item}
                  </Text>
                  <TouchableOpacity 
                    style={styles.removeButton} 
                    onPress={() => handleRemovePlayer(index)}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  >
                    <AntDesign name="delete" size={24} color="red" />
                  </TouchableOpacity>
                </View>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  modalOverlay: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: Platform.OS === 'android' ? '90%' : '80%',
    maxHeight: '80%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    padding: Platform.OS === 'android' ? 8 : 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    fontSize: 16,
  },
  addButton: {
    marginLeft: 10,
    padding: 5,
  },
  closeButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#d3d3d3',
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
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
    fontSize: Platform.OS === 'android' ? 22 : 26,
    color: '#333',
    flex: 1,
    minWidth: 100,
    marginRight: 10,
  },
  removeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  listContent: {
    width: '100%',
    paddingBottom: 5,
  }
});

export default PlayerModal;