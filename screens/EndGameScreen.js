import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { GameContext } from '../Context/GameContext';
import accoladesData from '../assets/accolades.json';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import Icon from 'react-native-vector-icons/FontAwesome';

const EndGameScreen = ({ navigation, route }) => {
  const { players, resetGame } = useContext(GameContext);
  const { packName, completedDares } = route.params;
  const [accolades, setAccolades] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!players || !completedDares) {
      console.error("Required data not available");
      return;
    }

    const availableAccolades = accoladesData[packName] ? shuffleArray([...accoladesData[packName]]) : shuffleArray(["Great effort!"]);
    
    const playerAccolades = players.map((player, index) => {
      const totalCompleted = completedDares[index];
      const accolade = availableAccolades[index % availableAccolades.length]; // Cycle through accolades if not enough
      return `${player} completed ${totalCompleted} dares. ${accolade}`;
    });

    setAccolades(playerAccolades);
    setShowConfetti(true);
  }, [packName, players, completedDares]);

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // ES6 destructuring swap
    }
    return array;
  };

  const handleReset = () => {
    resetGame();
    setShowConfetti(false);
    navigation.navigate('DarePackSelectionScreen');
  };

  return (
    <LinearGradient colors={['#ff652f', '#ffaa32']} style={styles.container}>
      {showConfetti && <ConfettiCannon count={200} origin={{x: -10, y: 0}} />}
      <Text style={styles.title}>Game Over!</Text>
      <View style={styles.accoladesContainer}>
        {accolades.map((accolade, index) => (
          <Animated.Text key={index} style={[styles.accolade, { opacity: 1, transform: [{ translateY: -10 }, { translateX: -5 }]}]}>
            {accolade}
          </Animated.Text>
        ))}
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Icon name="refresh" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.buttonText}>Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { resetGame(); navigation.navigate('Home'); }}>
          <Icon name="home" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  accoladesContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  accolade: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  button: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    elevation: 3,
  },
  buttonText: {
    color: '#ff652f',
    fontSize: 16,
    textAlign: 'center',
    marginLeft: 10,
  },
  icon: {
    marginRight: 10,
  },
});

export default EndGameScreen;
