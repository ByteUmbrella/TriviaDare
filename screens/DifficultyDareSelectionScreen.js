import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSettings } from '../Context/Settings';

/**
 * NOTE: This screen is currently inactive but preserved for future development
 * when difficulty selection is reintroduced. For now, all games use 'easy' difficulty
 * and route through GameConfirmationScreen instead.
 */

const DifficultyDareSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedPack, numberOfQuestions } = route.params;
  
  const difficulties = ['Easy', 'Medium', 'Hard', 'Impossible'];
  const [triviaDifficultyLocal, setTriviaDifficultyLocal] = useState(null);
  const [dareDifficultyLocal, setDareDifficultyLocal] = useState(null);
  const isReadyToStart = triviaDifficultyLocal !== null && dareDifficultyLocal !== null;

  const handleStartGame = () => {
    if (isReadyToStart) {
      navigation.navigate('QuestionScreen', {
        selectedPack,
        numberOfQuestions,
        triviaDifficulty: triviaDifficultyLocal.toLowerCase(),
        dareDifficulty: dareDifficultyLocal.toLowerCase(),
        currentQuestionIndex: 0,
      });
    }
  };
  
  return (
    <ImageBackground source={require('../assets/gameshow.jpg')} style={styles.container}>
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
    fontSize: 28,
    color: '#FFD700', // Gold color for game show feel
    fontWeight: 'bold',
    marginBottom: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 22,
    color: '#FFFFFF', // White color to stand out
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginTop: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  button: {
    backgroundColor: '#FFD700', // Gold color for game show feel
    padding: 15,
    marginVertical: 5,
    width: '90%',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  selected: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#FF4500', // Bright color for the start button
    padding: 15,
    marginTop: 30,
    width: '90%',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
});

export default DifficultyDareSelectionScreen;