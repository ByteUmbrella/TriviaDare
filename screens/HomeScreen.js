import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ImageBackground, StyleSheet } from 'react-native';
import { useGame } from '../Context/GameContext'; // Adjust the import path as necessary

const HomeScreen = ({ navigation }) => {
  const [newPlayer, setNewPlayer] = useState('');
  const { players, setPlayers } = useGame();

  const handleAddPlayer = () => {
    if (newPlayer.trim()) {
      setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
      setNewPlayer('');
    }
  };

  const handleRemovePlayer = (player) => {
    setPlayers(prevPlayers => prevPlayers.filter(p => p !== player));
  };

  return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
      <Text style={styles.title}>Enter Player Names</Text>
      <TextInput
        style={styles.input}
        placeholder="New Player"
        placeholderTextColor="#CCCCCC"
        value={newPlayer}
        onChangeText={setNewPlayer}
      />
      <TouchableOpacity style={styles.addButton} onPress={handleAddPlayer}>
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
      <Text style={styles.playerListTitle}>Player List:</Text>
      <FlatList
        data={players}
        keyExtractor={(item, index) => `player-${index}`}
        renderItem={({ item }) => (
          <View style={styles.playerItem}>
            <Text style={styles.playerName}>{item}</Text>
            <TouchableOpacity onPress={() => handleRemovePlayer(item)}>
  <Text style={{ fontSize: 20, color: 'red' }}>X</Text>
</TouchableOpacity>
          </View>
        )}
      />
      <View style={styles.gameModeSelection}>
        <View style={styles.modeContainer}>
          <TouchableOpacity style={styles.modeButton} onPress={() => navigation.navigate('TriviaPackSelection', { players })}>
            <Text style={styles.modeButtonText}>TriviaDare</Text>
          </TouchableOpacity>
          <Text style={styles.modeDescription}>Answer trivia questions correctly or face fun dares!</Text>
        </View>
        <View style={styles.modeContainer}>
        <TouchableOpacity style={styles.modeButton} onPress={() => navigation.navigate('DarePackSelectionScreen', { players })}>
  <Text style={styles.modeButtonText}>Dares Only</Text>
</TouchableOpacity>
          <Text style={styles.modeDescription}>Skip trivia and jump straight to performing dares!</Text>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f4f4f8', // Light background for contrast
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'white', // Trivia Crack blue for titles
  },
  input: {
    height: 50,
    borderColor: '#005a9c',
    borderWidth: 2,
    marginBottom: 10,
    borderRadius: 20,
    padding: 10,
    color: '#333333',
    fontSize: 20,
    backgroundColor: 'white', // Bright input field
  },
  addButton: {
    backgroundColor: '#00a2e8', // Bright blue for buttons
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  playerListTitle: {
    fontSize: 18,
    marginTop: 20,
    color: 'white', // Consistent use of blue
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  playerName: {
    fontSize: 20,
  },
  gameModeSelection: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 20,
  },
  modeContainer: {
    alignItems: 'center',
    width: '50%',
  },
  modeButton: {
    backgroundColor: '#e91e63', // A vibrant pink
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  modeButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  modeDescription: {
    marginTop: 10,
    fontSize: 17,
    color: '#FFFFFF', // Soft contrast for text
    textAlign: 'center',
  },
});

export default HomeScreen;