import React, { useState, useEffect } from 'react';
import { View, StatusBar, BackHandler, Platform, Dimensions, ToastAndroid } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GameProvider } from './Context/GameContext';
import { SettingsProvider } from './Context/Settings';
import { CustomDaresProvider } from './Context/CustomDaresContext';
import { PowerUpProvider } from './Context/PowerUp'; // NEW: Add PowerUpProvider import
import { FirebaseProvider } from './Context/multiplayer/FirebaseContext';
import { BluetoothProvider } from './Context/multiplayer/DummyBluetoothContext'; // Import the dummy provider
import MultiplayerGameFlow from './Context/multiplayer/MultiplayerGameFlow';
import FirebaseSimulatorHelper from './Context/multiplayer/FirebaseSimulatorHelper'; // Import the simulator helper
import HomeScreen from './screens/HomeScreen';
import TriviaPackSelectionScreen from './screens/TriviaPackSelectionScreen';
import DifficultyDareSelectionScreen from './screens/DifficultyDareSelectionScreen';
import QuestionScreen from './screens/QuestionScreen';
import DarePackSelectionScreen from './screens/DarePackSelectionScreen';
import GameConfirmationScreen from './screens/GameConfirmationScreen';
import DareOnlyScreen from './screens/DareOnlyScreen';
import ResultsScreen from './screens/ResultsScreen';
import EndGameScreen from './screens/EndGameScreen';
import WinnerTransitionScreen from './screens/WinnerTransitionScreen';
import PendingDaresScreen from './screens/PendingDaresScreen';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import ConnectionScreen from './screens/multiplayer/ConnectionScreen';
import LobbyScreen from './screens/multiplayer/LobbyScreen';
import MultiplayerQuestionScreen from './screens/multiplayer/MultiplayerQuestionScreen';

if (Platform.OS === 'android') {
  const originalToastAndroid = { ...ToastAndroid };
  
  global.enableToasts = () => {
    ToastAndroid.show = originalToastAndroid.show;
    ToastAndroid.showWithGravity = originalToastAndroid.showWithGravity;
    ToastAndroid.showWithGravityAndOffset = originalToastAndroid.showWithGravityAndOffset;
  };
  
  global.disableToasts = () => {
    ToastAndroid.show = () => {};
    ToastAndroid.showWithGravity = () => {};
    ToastAndroid.showWithGravityAndOffset = () => {};
  };
}

const Stack = createNativeStackNavigator();

SplashScreen.preventAutoHideAsync();

// Custom navigator component with FirebaseSimulatorHelper
const ScreenWithSimulator = ({ component: Component, ...rest }) => {
  return (
    <>
      <Component {...rest} />
      {__DEV__ && <FirebaseSimulatorHelper screenName={rest.route.name} />}
    </>
  );
};

// Special component for conditional TriviaPackSelection rendering
const TriviaPackSelectionWrapper = (props) => {
  const fromMultiplayer = props.route.params?.fromMultiplayer;
  return fromMultiplayer 
    ? <ScreenWithSimulator component={TriviaPackSelectionScreen} {...props} />
    : <TriviaPackSelectionScreen {...props} />;
};

const AppContent = () => {
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        return false;
      });

      return () => backHandler.remove();
    }
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        animation: Platform.OS === 'android' ? 'fade_from_bottom' : undefined,
        gestureEnabled: true,
        headerShown: false,
        contentStyle: { 
          backgroundColor: '#000000',
        }
      }}
    >
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="TriviaPackSelection" 
        component={TriviaPackSelectionWrapper}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GameConfirmation"
        component={GameConfirmationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DarePackSelectionScreen" 
        component={DarePackSelectionScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="DareOnlyScreen" 
        component={DareOnlyScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="DifficultyDareSelection" 
        component={DifficultyDareSelectionScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="QuestionScreen" 
        component={QuestionScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="ResultsScreen" 
        component={ResultsScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="PendingDares" 
        component={PendingDaresScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EndGameScreen" 
        component={EndGameScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="WinnerTransition" 
        component={WinnerTransitionScreen} 
        options={{ headerShown: false }}
      />
      {/* Multiplayer screens with simulator helper */}
      <Stack.Screen name="MultiplayerConnection" options={{ headerShown: false }}>
        {props => <ScreenWithSimulator component={ConnectionScreen} {...props} />}
      </Stack.Screen>
      <Stack.Screen name="LobbyScreen" options={{ headerShown: false }}>
        {props => <ScreenWithSimulator component={LobbyScreen} {...props} />}
      </Stack.Screen>
      <Stack.Screen name="MultiplayerQuestionScreen" options={{ headerShown: false }}>
        {props => <ScreenWithSimulator component={MultiplayerQuestionScreen} {...props} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const App = () => {
  const [appIsReady, setAppIsReady] = useState(false);
  const { height, width } = Dimensions.get('window');
  
  const [fontsLoaded] = useFonts({
    'Thelamonblack': require('./assets/Fonts/Thelamonblack.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  if (!appIsReady || !fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar 
        barStyle="light-content"
        backgroundColor="transparent" 
        translucent={true}
      />
      
      <View style={{ 
        flex: 1,
        width: width,
        height: height
      }}>
        <SettingsProvider>
          <CustomDaresProvider>
              <GameProvider>
                {/* NEW: Add PowerUpProvider here */}
                <PowerUpProvider>
                  <NavigationContainer>
                    <FirebaseProvider>
                      <AppContent />
                      <MultiplayerGameFlow />
                    </FirebaseProvider>
                  </NavigationContainer>
                </PowerUpProvider>
              </GameProvider>
          </CustomDaresProvider>
        </SettingsProvider>
      </View>
    </>
  );
};

export default App;