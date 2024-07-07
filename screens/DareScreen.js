import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useGame } from '../Context/GameContext';
import daresData from '../dares/dare.json';
import { useNavigation, useRoute } from '@react-navigation/native';

const DareScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    players, scores, setScores, currentPlayerIndex, currentQuestionIndex, numberOfQuestions: contextNumberOfQuestions,
    dareDifficulty, setCurrentPlayerIndex, setCurrentQuestionIndex, triviaDifficulty
  } = useGame();
  const [randomDare, setRandomDare] = useState(null);

  const numberOfQuestions = route.params?.numberOfQuestions || contextNumberOfQuestions;

  useEffect(() => {
    const filteredDares = daresData.filter(dare =>
      dare['Dare Level'].toLowerCase() === dareDifficulty.toLowerCase()
    );
    setRandomDare(filteredDares[Math.floor(Math.random() * filteredDares.length)]);
  }, [dareDifficulty]);

  const handleDareCompleted = (dareCompleted) => {
    const newScores = [...scores];
    newScores[currentPlayerIndex] += dareCompleted ? 1 : 0;
    setScores(newScores);

    const nextQuestionIndex = currentQuestionIndex + 1;
    const totalQuestions = numberOfQuestions * players.length;

    if (nextQuestionIndex >= totalQuestions) {
      navigation.navigate('QuestionScreen', { showWinner: true });
    } else {
      setCurrentPlayerIndex(nextQuestionIndex % players.length);
      setCurrentQuestionIndex(nextQuestionIndex);
      navigation.navigate('QuestionScreen', {
        currentPlayer: players[currentPlayerIndex],
        currentPlayerIndex,
        numberOfQuestions,
        currentQuestionIndex: nextQuestionIndex,
        triviaDifficulty
      });
    }
  };

  if (!randomDare) {
    return (
      <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
        <Text style={styles.dareText}>Loading dare...</Text>
      </ImageBackground>
    );
  }

  const currentPlayerName = players[currentPlayerIndex] || 'Player';

  return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
      <Text style={styles.dareText}>{`${currentPlayerName}, it's your turn for a dare!`}</Text>
      <Text style={styles.dareText}>{randomDare['Dare Text']}</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleDareCompleted(true)}>
        <Text style={styles.buttonText}>Dare Completed</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleDareCompleted(false)}>
        <Text style={styles.buttonText}>Dare Not Completed</Text>
      </TouchableOpacity>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dareText: {
    fontSize: 24,
    color: 'white',
    textAlign: 'center',
    margin: 20,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#ff4500',
    padding: 15,
    borderRadius: 10,
    margin: 10,
    width: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

export default DareScreen;
