import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, Easing } from 'react-native-reanimated';

const ScoreBanner = ({ players, scores, showScores, toggleScores }) => {
  const animatedValues = scores.map(score => ({
    scale: useSharedValue(0.5),
    opacity: useSharedValue(0),
    translateY: useSharedValue(10)
  }));

  const animatedStyles = animatedValues.map((vals, index) => useAnimatedStyle(() => ({
    opacity: withTiming(vals.opacity.value, { duration: 400, easing: Easing.linear }),
    transform: [
      { scale: withSpring(vals.scale.value, { damping: 5, stiffness: 150 }) },
      { translateY: withTiming(vals.translateY.value, { duration: 400, easing: Easing.linear }) }
    ]
  })));

  React.useEffect(() => {
    scores.forEach((score, index) => {
      const anim = animatedValues[index];
      anim.scale.value = 1; // Animate to normal size
      anim.opacity.value = 1; // Animate to full opacity
      anim.translateY.value = 0; // Animate to original position
    });
  }, [scores, animatedValues]);

  return (
    <View style={styles.bannerContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {players.map((playerName, index) => (
          <View key={index} style={styles.playerScore}>
            <Text style={styles.playerName}>{playerName}</Text>
            {showScores && <Animated.Text style={[styles.score, animatedStyles[index]]}>{scores[index]}</Animated.Text>}
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.toggleButton} onPress={toggleScores}>
        <Text style={styles.toggleButtonText}>{showScores ? "Hide" : "Show"}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-evenly', // Evenly distribute players across the space
  },
  playerScore: {
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginHorizontal: 5,
  },
  playerName: {
    color: '#fff',
    marginBottom: 5,
    fontWeight: 'bold',
    fontSize: 16,
  },
  score: {
    color: '#00ff00',
    fontWeight: 'bold',
    fontSize: 20,
  },
  toggleButton: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 5,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default ScoreBanner;