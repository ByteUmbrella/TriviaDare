import React, { useContext, useRef, useEffect, useState } from 'react';
import { View, Text, ImageBackground, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GameContext } from '../Context/GameContext';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';

const ResultsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { resetGame } = useContext(GameContext);
  const { playerData } = route.params;
  const confettiRef = useRef();
  const scaleAnim = useRef(new Animated.Value(0)).current;  // For scaling winner text

  // Confetti animation when the screen loads
  useEffect(() => {
    confettiRef.current.start();
    console.log('Received player data in ResultsScreen:', playerData);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 2,
      useNativeDriver: true
    }).start();
  }, []);

  const handleReturnHome = () => {
    resetGame({ resetQuestions: true, resetPlayers: false });
    navigation.navigate('Home');
  };

  const sortedPlayers = playerData.sort((a, b) => b.score - a.score);

  return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.fullscreen}>
      <ScrollView style={styles.container}>
        {sortedPlayers.map((player, index) => {
          const isTie = index < sortedPlayers.length - 1 && player.score === sortedPlayers[index + 1].score;
          const isWinner = index === 0 && !isTie;
          return (
            <LinearGradient
              key={player.name}
              colors={isWinner ? ['#ffd700', '#ff8c00'] : ['#282828', '#484848']}
              style={styles.playerContainer}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}>
              <Animated.Text style={[styles.playerName, isWinner ? {transform: [{scale: scaleAnim}]} : {}]}>
                {player.name + (isWinner ? ' - THE WINNER!!' : '')}
              </Animated.Text>
              <Text style={styles.playerScore}>{player.score}</Text>
            </LinearGradient>
          );
        })}
      </ScrollView>
      <ConfettiCannon count={200} origin={{x: -10, y: 0}} ref={confettiRef} />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleReturnHome}>
          <Text style={styles.buttonText}>Return to Home Screen</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 20,
  },
  playerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    marginHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 5,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  playerScore: {
    fontSize: 24,
    color: '#00FF00',
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  button: {
    backgroundColor: '#FFA500',
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default ResultsScreen;
