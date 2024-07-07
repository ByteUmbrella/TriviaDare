import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ImageBackground } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGame } from '../Context/GameContext';
import ScoreBanner from './ScoreBanner';
import PlayerModal from '../Context/PlayerModal';
import * as Progress from 'react-native-progress';

const packToJson = {
  'Entertainment': require('../Packs/Entertainmentpack.json'),
  // Add other packs
};

const QuestionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { numberOfQuestions, selectedPack: routeSelectedPack, triviaDifficulty: routeTriviaDifficulty, currentQuestionIndex: routeCurrentQuestionIndex } = route.params || {};

  const {
    players,
    setPlayers,
    scores,
    setScores,
    currentPlayerIndex,
    setCurrentPlayerIndex,
    currentQuestionIndex: contextCurrentQuestionIndex,
    setCurrentQuestionIndex,
    triviaDifficulty: contextTriviaDifficulty,
    setTriviaDifficulty,
    currentScore,
    setCurrentScore,
    calculateInitialScore,
    performingDare,
    setPerformingDare,
  } = useGame();

  const [selectedOption, setSelectedOption] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [showWinnerButton, setShowWinnerButton] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [intervalId, setIntervalId] = useState(null);
  const [playerQuestions, setPlayerQuestions] = useState(players.map(() => new Set()));

  const currentQuestionIndex = routeCurrentQuestionIndex !== undefined ? routeCurrentQuestionIndex : contextCurrentQuestionIndex;
  const selectedPack = routeSelectedPack; 
  const triviaDifficulty = routeTriviaDifficulty || contextTriviaDifficulty;

  useEffect(() => {
    if (routeTriviaDifficulty) {
      setTriviaDifficulty(routeTriviaDifficulty);
    }
  }, [routeTriviaDifficulty]);

  useEffect(() => {
    if (selectedPack && triviaDifficulty) {
      const packData = packToJson[selectedPack];
      if (packData && Array.isArray(packData.Sheet1)) {
        const filteredQuestions = packData.Sheet1.filter(question => question.Difficulty.toLowerCase() === triviaDifficulty.toLowerCase());
        setQuestions(filteredQuestions);
        console.log('Questions set:', filteredQuestions);
      } else {
        setQuestions([]);
      }
    }
  }, [selectedPack, triviaDifficulty]);

  useEffect(() => {
    if (!isGameStarted && !performingDare && players.length > 0 && questions.length > 0) {
      promptNextPlayer(currentPlayerIndex);
    }
  }, [players.length, currentPlayerIndex, questions.length, isGameStarted, performingDare, currentPlayerIndex]);
  
  useEffect(() => {
    if (isGameStarted && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime > 0) {
            return prevTime - 1;
          } else {
            clearInterval(interval);
            return 0;
          }
        });
        setCurrentScore(prevScore => Math.max(prevScore - calculateDecrementPerSecond(triviaDifficulty), 0));
      }, 1000);
      setIntervalId(interval);
      return () => clearInterval(interval);
    } else if (timeLeft === 0) {
      setIsGameStarted(false);
      handleTimesUp();
    }
  }, [isGameStarted, timeLeft]);

  useEffect(() => {
    if (!performingDare && players.length > 0 && questions.length > 0) {
      promptNextPlayer(currentPlayerIndex);
    }
  }, [currentQuestionIndex]);
  

  const calculateDecrementPerSecond = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 1;
      case 'medium': return 2;
      case 'hard': return Math.round(100 / 30);
      case 'impossible': return Math.round(200 / 30);
      default: return 1;
    }
  };

  const promptNextPlayer = (index) => {
    if (players && players.length > 0 && players[index]) {
      setPlayerQuestions(prevPlayerQuestions => {
        const newPlayerQuestions = [...prevPlayerQuestions];
        let nextQuestionIndex = Math.floor(Math.random() * questions.length);
        while (newPlayerQuestions[index].has(nextQuestionIndex)) {
          nextQuestionIndex = (nextQuestionIndex + 1) % questions.length;
        }
        newPlayerQuestions[index].add(nextQuestionIndex);
        setCurrentQuestionIndex(nextQuestionIndex);
        return newPlayerQuestions;
      });
  
      Alert.alert(
        "Ready to Play?",
        `${players[index]}, are you ready to start your turn?`,
        [
          {
            text: "Start",
            onPress: () => {
              setCurrentScore(calculateInitialScore(triviaDifficulty));
              setTimeLeft(30);
              setIsGameStarted(true);
              console.log(`Prompting player ${index}: ${players[index]}`);
            }
          }
        ],
        { cancelable: false }
      );
    } else {
      console.error('Player data is missing or index is out of bounds:', { players, index });
    }
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    console.log('Option selected:', option);
  };

  const handleAnswerConfirmation = () => {
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const currentQuestion = questions[currentQuestionIndex];
      const correctAnswerKey = currentQuestion['Correct Answer'];
      const correctAnswer = currentQuestion[correctAnswerKey];

      console.log('Answer confirmed. Selected option:', selectedOption, 'Correct answer:', correctAnswer);

      if (selectedOption === correctAnswer) {
        const pointsEarned = currentScore;
        setScores(prevScores => {
          const newScores = [...prevScores];
          newScores[currentPlayerIndex] += pointsEarned;
          return newScores;
        });
        Alert.alert("Correct!", `You've earned ${pointsEarned} points!`, [{ text: "OK", onPress: () => prepareNextQuestion() }]);
      } else {
        setPerformingDare(true);
        navigation.navigate('DareScreen', {
          currentPlayer: players[currentPlayerIndex],
          currentPlayerIndex,
          numberOfQuestions,
          currentQuestionIndex,
          triviaDifficulty
        });
      }
      setSelectedOption(null);
    } else {
      console.error("No questions available or index out of bounds.");
    }
  };

  const prepareNextQuestion = () => {
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const nextQuestionIndex = currentQuestionIndex + 1;
  
    console.log('Preparing next question. Next player index:', nextPlayerIndex, 'Next question index:', nextQuestionIndex);
  
    if (nextQuestionIndex >= questions.length) {
      navigateToResults();
    } else {
      setCurrentPlayerIndex(nextPlayerIndex);
      setCurrentQuestionIndex(nextQuestionIndex);
      setPerformingDare(false);
    }
  };

  const handleTimesUp = () => {
    setIsGameStarted(false);
    setPerformingDare(true);
    Alert.alert("Times Up!", "You ran out of time!", [{
      text: "OK", onPress: () => {
        navigation.navigate('DareScreen', {
          currentPlayer: players[currentPlayerIndex],
          currentPlayerIndex,
          numberOfQuestions,
          currentQuestionIndex,
          triviaDifficulty
        });
      }
    }]);
    console.log('Time is up for player:', players[currentPlayerIndex]);
  };

  const navigateToResults = () => {
    const playerData = players.map((player, index) => ({
      name: player.name,
      score: scores[index]
    }));
    navigation.navigate('ResultsScreen', { playerData });
    console.log('Navigating to results with player data:', playerData);
  };

  const globalQuestionIndex = Math.floor(currentQuestionIndex / players.length) + 1;

  const [showScores, setShowScores] = useState(false);

  const toggleScores = () => {
    setShowScores(prevShowScores => !prevShowScores);
  };


  return (
    <ImageBackground style={styles.container} source={require('../assets/Background.jpg')}>
      <ScoreBanner 
      players={players} 
      scores={scores} 
      showScores={showScores} 
      toggleScores={toggleScores} 
    />
  
      <View style={styles.header}>
        <Text style={styles.currentPlayerText}>{players[currentPlayerIndex]}</Text>
        <View style={styles.progressContainer}>
          <Progress.Bar 
            progress={timeLeft / 30}
            style={styles.progress}
            color={timeLeft > 10 ? '#76FF03' : '#FF3D00'}
            unfilledColor="#BBDEFB"
            borderWidth={0}
            borderRadius={5}
            width={250}
          />
          <Text style={styles.timerTextInside}>{`${timeLeft}s`}</Text>
        </View>
        <Text style={styles.pointsText}>
          Points for this question: <Text style={styles.pointsValue}>{currentScore}</Text>
        </Text>
      </View>
      
      {!showWinnerButton ? (
        <View style={styles.questionContainer}>
           <Text style={styles.questionCount}>{`Question ${globalQuestionIndex} of ${numberOfQuestions}`}</Text>
          <Text style={styles.questionText}>{questions.length > 0 ? questions[currentQuestionIndex]["Question Text"] : 'Loading question...'}</Text>
          {questions.length > 0 && ['Option A', 'Option B', 'Option C', 'Option D'].map(optionKey => (
            <TouchableOpacity
              key={optionKey}
              style={[styles.optionButton, selectedOption === questions[currentQuestionIndex][optionKey] && styles.selectedOption]}
              onPress={() => handleOptionSelect(questions[currentQuestionIndex][optionKey])}
            >
              <Text style={styles.optionText}>{questions[currentQuestionIndex][optionKey]}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.confirmButton, !selectedOption && styles.confirmButtonDisabled]}
            onPress={handleAnswerConfirmation}
            disabled={!selectedOption}
          >
            <Text style={styles.confirmButtonText}>Confirm Answer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.winnerButton} onPress={navigateToResults}>
          <Text style={styles.winnerButtonText}>And the Winner Is...</Text>
        </TouchableOpacity>
      )}
  
      <TouchableOpacity
        style={styles.managePlayersButton}
        onPress={() => setPlayerModalVisible(true)}
      >
        <Text style={styles.managePlayersButtonText}>Manage Players</Text>
      </TouchableOpacity>
  
      <PlayerModal
        isVisible={playerModalVisible}
        onClose={() => setPlayerModalVisible(false)}
        players={players}
        setPlayers={setPlayers}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A237E',
    paddingVertical: 1,
  },
  currentPlayerText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginTop: -75,
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  
  pointsValue: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 300,  // Container width larger than the progress bar to include padding
    paddingVertical: 5,
    paddingHorizontal: 25,  // Padding to ensure progress bar does not touch the edges
  },
  progress: {
    height: 20,
  },
  timerTextInside: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    top: 2,  // Adjust top position to vertically center the text
  },
  scoreText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 5,
  },
  questionCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 5,
  },
  questionContainer: {
    backgroundColor: '#304FFE',
    padding: 20,
    borderRadius: 10,
    margin: 5,
    width: '95%',
    alignItems: 'center',
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'white',
    marginBottom: 30,
    width: '100%',
  },
  optionButton: {
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOption: {
    backgroundColor: '#64B5F6',
  },
  optionText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#007bff',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 10,
    width: '100%',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#aaa',
  },
  managePlayersButton: {
    padding: 10,
    backgroundColor: '#4CAF50',
    marginTop: 10,
    width: '90%',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 20,
  },
  managePlayersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  winnerButtonContainer: {
    position: 'absolute',
    bottom: 10, // Adjust as needed
    width: '100%',
    alignItems: 'center',
  },
  winnerButton: {
    backgroundColor: 'gold',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginTop: 10,
    borderWidth: 3,
    borderColor: 'black',
  },
  winnerButtonText: {
    color: 'black',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default QuestionScreen;
