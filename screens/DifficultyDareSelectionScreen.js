import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useGame } from '../Context/GameContext'; // Adjust the import path as necessary
import { useNavigation, useRoute } from '@react-navigation/native';

const DifficultyDareSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedPack, numberOfQuestions } = route.params;
  const { setTriviaDifficulty, setDareDifficulty } = useGame();
  
  const difficulties = ['Easy', 'Medium', 'Hard', 'Impossible'];
  const [triviaDifficultyLocal, setTriviaDifficultyLocal] = useState(null);
  const [dareDifficultyLocal, setDareDifficultyLocal] = useState(null);
  const isReadyToStart = triviaDifficultyLocal !== null && dareDifficultyLocal !== null;

  const handleStartGame = () => {
    if (isReadyToStart) {
      setTriviaDifficulty(triviaDifficultyLocal.toLowerCase());  // Convert to lower case
      setDareDifficulty(dareDifficultyLocal.toLowerCase());  // Convert to lower case
      navigation.navigate('QuestionScreen', {
        selectedPack,
        numberOfQuestions,
        triviaDifficulty: triviaDifficultyLocal.toLowerCase(),  // Ensure this is also in lower case
        currentQuestionIndex: 0,
      });
    }
  };
  
  return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
      <Text style={styles.title}>Select Difficulty Levels</Text>
      <Text style={styles.subtitle}>Trivia Difficulty</Text>
      {difficulties.map((difficulty) => (
        <TouchableOpacity
          key={difficulty}
          style={[styles.button, triviaDifficultyLocal === difficulty && styles.selected]}
          onPress={() => setTriviaDifficultyLocal(difficulty)}
        >
          <Text style={styles.buttonText}>{difficulty}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.subtitle}>Dare Difficulty</Text>
      {difficulties.map((difficulty) => (
        <TouchableOpacity
          key={difficulty}
          style={[styles.button, dareDifficultyLocal === difficulty && styles.selected]}
          onPress={() => setDareDifficultyLocal(difficulty)}
        >
          <Text style={styles.buttonText}>{difficulty}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.startButton, !isReadyToStart && styles.disabledButton]}
        onPress={handleStartGame}
        disabled={!isReadyToStart}
      >
        <Text style={styles.startButtonText}>Start Trivia Game</Text>
      </TouchableOpacity>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginTop: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    marginVertical: 5,
    width: '90%',
    alignItems: 'center',
    borderRadius: 10,
  },
  selected: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
  startButton: {
    backgroundColor: '#FF9500',
    padding: 15,
    marginTop: 30,
    width: '90%',
    alignItems: 'center',
    borderRadius: 10,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
});

export default DifficultyDareSelectionScreen;
