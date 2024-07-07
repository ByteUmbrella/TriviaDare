// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GameProvider } from './Context/GameContext'; // Ensure path is correct
import HomeScreen from './screens/HomeScreen';
import TriviaPackSelectionScreen from './screens/TriviaPackSelectionScreen';
import DifficultyDareSelectionScreen from './screens/DifficultyDareSelectionScreen';
import QuestionScreen from './screens/QuestionScreen';
import DareScreen from './screens/DareScreen';
import DarePackSelectionScreen from './screens/DarePackSelectionScreen'; // New import
import DareOnlyScreen from './screens/DareOnlyScreen'; // New import
import ResultsScreen from './screens/ResultsScreen';
import EndGameScreen from './screens/EndGameScreen';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <GameProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Players' }} />
          <Stack.Screen name="TriviaPackSelection" component={TriviaPackSelectionScreen} options={{ title: 'Select Trivia Pack' }} />
          <Stack.Screen name="DarePackSelectionScreen" component={DarePackSelectionScreen} options={{ title: 'Select Dare Pack' }} />
          <Stack.Screen name="DareOnlyScreen" component={DareOnlyScreen} options={{ title: 'Dares Only' }} />
          <Stack.Screen name="DifficultyDareSelection" component={DifficultyDareSelectionScreen} options={{ title: 'Select Difficulty' }} />
          <Stack.Screen name="QuestionScreen" component={QuestionScreen} options={{ title: 'Trivia Question' }} />
          <Stack.Screen name="DareScreen" component={DareScreen} options={{ title: 'Dare' }} />
          <Stack.Screen name="ResultsScreen" component={ResultsScreen} />
          <Stack.Screen name="EndGameScreen" component={EndGameScreen} options={{ title: 'Game Over' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </GameProvider>
  );
};

export default App;