import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ImageBackground, StyleSheet, StatusBar } from 'react-native';
import { GameContext } from '../Context/GameContext';
import PlayerModal from '../Context/PlayerModal';
import { LinearGradient } from 'expo-linear-gradient';

// Placeholder data to simulate JSON content
const placeholderDares = {
  "Family Friendly": [
    "Sing a song",
    "Dance for 1 minute",
    "Do a funny walk across the room",
    "Tell a joke that makes everyone laugh",
    "Make a silly face and hold it for 10 seconds",
    "Pretend you're a cat and meow around the room",
    "Balance a book on your head",
    "Say the alphabet backwards",
    "Do 10 jumping jacks",
    "Imitate your favorite cartoon character",
    "Create a secret handshake with someone",
    "Pretend to be a statue for 30 seconds",
    // Add 3 more dares of your choice
  ],
  "IceBreakers": [
    "Tell a funny story",
    "Imitate someone",
    "Share an embarrassing moment",
    "Compliment each person in the room",
    "Share your dream job as a child",
    "Do your best celebrity impression",
    "Share a unique talent or party trick",
    "Name five things you like about the person on your right",
    "Describe your first memory",
    "Pretend to walk on a tightrope",
    "Share your go-to dance move",
    "Demonstrate how to make your favorite sandwich",
    // Add 3 more dares of your choice
  ],
  "Couples": [
    "Give a compliment",
    "Hold hands for 5 minutes",
    "Write a love note on a napkin",
    "Share a six-word love story",
    "Dedicate a song to your partner",
    "Share what you admire most about your partner",
    "Give your partner a hug",
    "Reenact your first date in 30 seconds",
    "Whisper a secret to your partner",
    "Do a couples' yoga pose",
    "Share your partner's favorite characteristic",
    "Take a romantic selfie together",
    // Add 3 more dares of your choice
  ],
  "Out In Public": [
    "Wave to a stranger",
    "Yell 'I love React Native!' in public",
    "Ask someone for the time and then tell a joke",
    "Compliment a stranger's outfit",
    "Do a little dance without music",
    "Ask for a high five from a stranger",
    "Sing a song out loud",
    "Act like you recognize someone you don't",
    "Walk like a model down an imaginary runway",
    "Call a random contact and sing 'Happy Birthday'",
    "Propose a toast to everyone around",
    "Take a funny selfie with a statue",
    // Add 3 more dares of your choice
  ],
  "Music Mania": [
    "Perform an air guitar solo to a rock song",
    "Sing the chorus of the last song you listened to",
    "Impersonate a famous singer",
    "Hum a song and others guess it",
    "Dance to a song chosen by the group",
    "Create a band name and album cover idea",
    "Write a short rap about the person to your left",
    "Perform a dramatic opera note",
    "Whistle a popular tune while others guess",
    "Play a song on an imaginary piano",
    "Choose a song and act out the lyrics silently",
    "Sing a song in a silly voice",
    // Add 3 more dares of your choice
  ],
  "Office Fun": [
    "Spin in a chair for 30 seconds",
    "Pretend to be your boss for 1 minute",
    "Organize a quick office parade",
    "Share a funny office story",
    "Take a selfie with the office plant",
    "Lead a 2-minute office workout",
    "Do your best impression of a coworker",
    "Start a spontaneous 'wave' in your office",
    "Create a handshake with the nearest coworker",
    "Leave an anonymous compliment on someone's desk",
    "Tell a joke that's safe for work",
    "Find something in common with everyone in the room",
    // Add 3 more dares of your choice
  ],
  "Adventure Seekers": [
    "Pretend you're climbing a mountain",
    "Mimic an extreme sport using office supplies",
    "Act like a pirate searching for treasure",
    "Describe your dream adventure",
    "Lead the group in a jungle expedition around the room",
    "Do your best animal impression",
    "Invent a new outdoor game",
    "Draw a map of an imaginary island",
    "Pretend you're in a kayak race",
    "Act out a scene from a survival show",
    "Build a 'campfire' with objects around you",
    "Create a quick survival kit with nearby items",
    // Add 3 more dares of your choice
  ],
  "Bar": [
    "Order the strangest drink",
    "Cheers the table next to you",
    "Lead a toast to the bar",
    "Swap a drink with someone (safely)",
    "Sing a karaoke song",
    "Dance with a stranger",
    "Take a shot without flinching",
    "Invent a new cocktail with the bartender",
    "Start a conga line",
    "Pose for a photo with the bouncer",
    "Tell the bar your best joke",
    "Give a speech about your 'first time' at this bar",
    // Add 3 more dares of your choice
  ],
  "Spicy": [
    "Share a secret",
    "Give someone a lap dance",
    "Do your sexiest dance",
    "Leave a flirty note for someone",
    "Kiss someone on the cheek",
    "Confess a fantasy",
    "Take an attractive selfie and share it",
    "Seductively eat a piece of fruit",
    "Give a body shot (if appropriate and consensual)",
    "Whisper something dirty in someone's ear",
    "Do a striptease (keep it PG-13 if needed)",
    "Send a flirty text to your crush",
    // Add 3 more dares of your choice
  ]
};

const DareOnlyScreen = ({ navigation, route }) => {
  const { players, setPlayers } = useContext(GameContext);
  const packName = route.params?.packName;
  const dareCount = route.params?.dareCount;
  
  const [dares, setDares] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [completedDares, setCompletedDares] = useState(Array(players.length).fill(0));
  const [currentDareIndex, setCurrentDareIndex] = useState(0);
  const [currentDareCompleted, setCurrentDareCompleted] = useState(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);

  useEffect(() => {
    const loadedDares = placeholderDares[packName] || [];
    const selectedDares = loadedDares.sort(() => 0.5 - Math.random()).slice(0, dareCount * players.length);
    setDares(selectedDares);
    setCurrentDareIndex(0); // Reset dare index whenever dares are reloaded
}, [packName, dareCount, players.length]);

const currentDare = dares.length > 0 ? dares[currentDareIndex] : "No dares available";

const handleDareCompletion = (completed) => {
    setCurrentDareCompleted(completed);
};

const handleNextPlayer = () => {
    if (currentDareCompleted) {
        // First, update the completed dares for the current player
        setCompletedDares((prevDares) => {
            const updatedDares = [...prevDares];
            updatedDares[currentPlayerIndex]++;
            return updatedDares;
        });
    }
    // After ensuring the 'completedDares' is updated, proceed to set the next player
    setCurrentPlayerIndex(prevIndex => (prevIndex + 1) % players.length);
    setCurrentDareIndex(prevIndex => (prevIndex + 1) % dares.length);
    setCurrentDareCompleted(null); // Reset the dare completion status
};

const handleEndGame = () => {
  const playerNames = players.map(player => player.name); // Extract player names
  navigation.navigate('EndGameScreen', { players: playerNames, completedDares, packName });
};

const handleManagePlayers = () => {
    setPlayerModalVisible(true);
};

return (
    <ImageBackground source={require('../assets/Background.jpg')} style={styles.container}>
      <StatusBar hidden />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 2 }}>
        <Text style={styles.title}>Dare for {players[currentPlayerIndex]}</Text>
        <Text style={styles.counterText}>Completed Dares: {completedDares[currentPlayerIndex]}</Text>
        <View style={styles.dareContainer}>
          <Text style={styles.dareText}>{currentDare}</Text>
          <View style={styles.dareButtonsContainer}>
            <TouchableOpacity
              style={[styles.button, currentDareCompleted === true ? styles.buttonActive : styles.buttonInactive]}
              onPress={() => handleDareCompletion(true)}
            >
              <LinearGradient
                colors={currentDareCompleted === true ? ['#4caf50', '#81c784'] : ['#555', '#888']}
                style={styles.gradientButton}
              >
                <Text style={styles.buttonText}>Complete</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, currentDareCompleted === false ? styles.buttonActive : styles.buttonInactive]}
              onPress={() => handleDareCompletion(false)}
            >
              <LinearGradient
                colors={currentDareCompleted === false ? ['#d32f2f', '#ef9a9a'] : ['#555', '#888']}
                style={styles.gradientButton}
              >
                <Text style={styles.buttonText}>Did Not Complete</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.nextPlayerButton,
            currentDareCompleted === null ? styles.nextPlayerButtonDisabled : null
          ]}
          onPress={handleNextPlayer}
          disabled={currentDareCompleted === null}
        >
          <Text style={styles.buttonText}>Next Player</Text>
        </TouchableOpacity>
        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.endGameButton} onPress={handleEndGame}>
            <Text style={styles.buttonText}>End Game</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.managePlayersButton} onPress={handleManagePlayers}>
            <Text style={styles.buttonText}>Manage Players</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  contentContainer: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 50,
    textAlign: 'center',
  },
  dareContainer: {
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 10,
    padding: 20,
  },
  counterText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 10,
  },
  dareText: {
    fontSize: 35,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonActive: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  buttonInactive: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  gradientButton: {
    padding: 15,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  nextPlayerButton: {
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignSelf: 'center',
    minWidth: '30%',
    backgroundColor: '#304FFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  nextPlayerButtonDisabled: {
    backgroundColor: '#aaa',
    shadowOpacity: 0.2,
  },
  dareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '75%',
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center', // Center items horizontally
    padding: 20,
  },
  endGameButton: {
    backgroundColor: '#d32f2f',
    padding: 15,
    borderRadius: 10,
    width: '60%', // Use width instead of minWidth for precise control
    marginBottom: 10, // Space between buttons
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  managePlayersButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    width: '43%', // Control width directly
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
});

export default DareOnlyScreen;