import React, { createContext, useContext, useState, useEffect } from 'react';

export const GameContext = createContext(null);

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);
  const [triviaDifficulty, setTriviaDifficulty] = useState('easy');
  const [dareDifficulty, setDareDifficulty] = useState('easy');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [numberOfQuestions, setNumberOfQuestions] = useState();
  const [selectedPack, setSelectedPack] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentScore, setCurrentScore] = useState(0);
  const [performingDare, setPerformingDare] = useState(false);

  const handleSetTriviaDifficulty = (difficulty) => {
    const formattedDifficulty = difficulty.toLowerCase();
    setTriviaDifficulty(formattedDifficulty);
  };

  const handleSetDareDifficulty = (difficulty) => {
    const formattedDifficulty = difficulty.toLowerCase();
    setDareDifficulty(formattedDifficulty);
  };

  useEffect(() => {
    setScores(prevScores => {
      const newScores = new Array(players.length).fill(0);
      for (let i = 0; i < prevScores.length; i++) {
        if (i < newScores.length) {
          newScores[i] = prevScores[i];
        }
      }
      return newScores;
    });
  }, [players.length]);

  const calculateInitialScore = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 30;
      case 'medium': return 50;
      case 'hard': return 100;
      case 'impossible': return 200;
      default: return 0;
    }
  };

  const resetTimerAndScore = () => {
    const initialScore = calculateInitialScore(triviaDifficulty);
    setTimeLeft(30);
    setCurrentScore(initialScore);
  };

  const resetGame = (options = { resetQuestions: true, resetPlayers: false }) => {
    setScores(new Array(players.length).fill(0));
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    resetTimerAndScore();
    if (options.resetPlayers) {
      setPlayers([]);
    }
  };

  const addPlayer = (playerName) => {
    const newPlayer = { name: playerName.trim() };
    setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
  };

  const removePlayer = (index) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const value = {
    players, setPlayers, scores, triviaDifficulty, dareDifficulty,
    currentPlayerIndex, setCurrentPlayerIndex, currentQuestionIndex, setCurrentQuestionIndex, numberOfQuestions,
    selectedPack, timeLeft, currentScore, performingDare, setPerformingDare,
    addPlayer, removePlayer, setPlayers, setScores,
    setTriviaDifficulty: handleSetTriviaDifficulty,
    setDareDifficulty: handleSetDareDifficulty,
    setCurrentPlayerIndex, setCurrentQuestionIndex, setNumberOfQuestions, setSelectedPack,
    resetGame, resetTimerAndScore, calculateInitialScore, setCurrentScore, setTimeLeft
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export default GameProvider;