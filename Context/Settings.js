import React, { createContext, useState, useContext, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Platform, Pressable, Alert } from 'react-native';
import iapManager from './IAPManager'; // Adjust the import path as needed

// Use dynamic requires to improve performance, especially on Android
const getPackToJson = () => ({
  // Generic Packs
  'Entertainment': require('../Packs/TriviaDare/GenericPacks/Entertainmenteasy.json'),
  'Science': require('../Packs/TriviaDare/GenericPacks/Scienceeasy.json'),
  'History': require('../Packs/TriviaDare/GenericPacks/Historyeasy.json'),
  'Sports': require('../Packs/TriviaDare/GenericPacks/Sportseasy.json'),
  'Art': require('../Packs/TriviaDare/GenericPacks/Arteasy.json'),
  'Geography': require('../Packs/TriviaDare/GenericPacks/Geographyeasy.json'),
  'Movies': require('../Packs/TriviaDare/GenericPacks/Movieeasy.json'),
  'Music': require('../Packs/TriviaDare/GenericPacks/Musiceasy.json'),
  'Technology': require('../Packs/TriviaDare/GenericPacks/Technologyeasy.json'),

  // Premium Packs
  'Harry Potter': require('../Packs/TriviaDare/PremiumPacks/harrypottereasy.json'),
  'Friends': require('../Packs/TriviaDare/PremiumPacks/friendseasy.json'),
  'Star Wars': require('../Packs/TriviaDare/PremiumPacks/starwarseasy.json'),
  'Disney Animated Movies': require('../Packs/TriviaDare/PremiumPacks/disneyanimatedmovieseasy.json'),
  'The Lord of the Rings': require('../Packs/TriviaDare/PremiumPacks/thelordoftheringseasy.json'),
  'Pixar': require('../Packs/TriviaDare/PremiumPacks/pixareasy.json'),
  'Video Games': require('../Packs/TriviaDare/PremiumPacks/videogameseasy.json'),
  'How I Met Your Mother': require('../Packs/TriviaDare/PremiumPacks/howimetyourmothereasy.json'),
  'The Office': require('../Packs/TriviaDare/PremiumPacks/theofficeeasy.json'),
  'Theme Park': require('../Packs/TriviaDare/PremiumPacks/themeparkeasy.json'),
  'Marvel Cinematic Universe': require('../Packs/TriviaDare/PremiumPacks/marvelcinamaticuniverseeasy.json')
});

// DaresOnly mode packs
const getDaresOnlyPackToJson = () => ({
  'spicy': require('../Packs/DaresOnly/spicy.json'),
  'adventureseekers': require('../Packs/DaresOnly/adventure_seekers.json'),
  'bar': require('../Packs/DaresOnly/bar.json'),
  'couples': require('../Packs/DaresOnly/couples.json'),
  'familyfriendly': require('../Packs/DaresOnly/family_friendly.json'),
  'icebreakers': require('../Packs/DaresOnly/icebreakers.json'),
  'musicmania': require('../Packs/DaresOnly/music_mania.json'),
  'officefun': require('../Packs/DaresOnly/office_fun.json'),
  'outinpublic': require('../Packs/DaresOnly/out_in_public.json'),
  'housepartylegend': require('../Packs/DaresOnly/house_party.json'),
});

const SettingsContext = createContext();

const SettingsProvider = ({ children }) => {
  const [isGloballyMuted, setIsGloballyMuted] = useState(false);
  const [screenMuteStates, setScreenMuteStates] = useState({});
  const [triviaQuestions, setTriviaQuestions] = useState(0);
  const [triviaDareDares, setTriviaDareDares] = useState(0);
  const [daresOnlyDares, setDaresOnlyDares] = useState(0);
  // Default to showing inflated numbers, with true numbers as hidden feature
  const [showInflatedNumbers, setShowInflatedNumbers] = useState(true);
  // Android specific state for resource loading
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  useEffect(() => {
    // Use requestAnimationFrame for smoother UI initialization on Android
    if (Platform.OS === 'android') {
      requestAnimationFrame(() => {
        calculateAllTotals();
      });
    } else {
      calculateAllTotals();
    }

    return () => {
      // Clean up resources when component unmounts
      setResourcesLoaded(false);
    };
  }, []);

  const calculateAllTotals = () => {
    try {
      // Use functions to lazy load resources
      const packToJson = getPackToJson();
      const daresOnlyPackToJson = getDaresOnlyPackToJson();
      
      // Calculate Trivia Questions - add error handling for Android
      const totalQuestions = Object.values(packToJson).reduce((sum, pack) => {
        return sum + ((pack?.Sheet1?.length) || 0);
      }, 0);
      setTriviaQuestions(totalQuestions);
    
      try {
        // Load and calculate TriviaDare mode dares
        const triviaDareDaresData = require('../dares/dare.json');
        const triviaDareTotal = Array.isArray(triviaDareDaresData) ? triviaDareDaresData.length : 0;
        setTriviaDareDares(triviaDareTotal);
      } catch (error) {
        console.error('Error loading TriviaDare dares:', error);
        setTriviaDareDares(0);
      }
    
      // Calculate DaresOnly mode dares
      const daresOnlyTotal = Object.values(daresOnlyPackToJson).reduce((sum, pack) => {
        return sum + (Array.isArray(pack) ? pack.length : 0);
      }, 0);
      setDaresOnlyDares(daresOnlyTotal);
      
      // Mark resources as loaded
      setResourcesLoaded(true);
    } catch (error) {
      console.error('Error calculating game content:', error);
      // Set default values in case of failure
      setTriviaQuestions(0);
      setTriviaDareDares(0);
      setDaresOnlyDares(0);
      setResourcesLoaded(true);
    }
  };
  
  const toggleGlobalMute = (value) => {
    setIsGloballyMuted(value);
    setScreenMuteStates({});
  };

  const toggleScreenMute = (screenId, value) => {
    setScreenMuteStates(prev => ({
      ...prev,
      [screenId]: value
    }));
  };

  // Toggle function for inflated numbers
  const toggleInflatedNumbers = () => {
    setShowInflatedNumbers(prev => !prev);
  };

  const isAudioEnabled = (screenId) => {
    if (isGloballyMuted) return false;
    if (screenMuteStates.hasOwnProperty(screenId)) {
      return !screenMuteStates[screenId];
    }
    return true;
  };

  // Add getters for counts that apply the multiplier if showInflatedNumbers is true
  const getDisplayTriviaQuestions = () => {
    return showInflatedNumbers ? triviaQuestions * 5 : triviaQuestions;
  };

  const getDisplayTriviaDareDares = () => {
    return showInflatedNumbers ? triviaDareDares * 5 : triviaDareDares;
  };

  const getDisplayDaresOnlyDares = () => {
    return showInflatedNumbers ? daresOnlyDares * 5 : daresOnlyDares;
  };

  const value = {
    isGloballyMuted,
    toggleGlobalMute,
    toggleScreenMute,
    isAudioEnabled,
    screenMuteStates,
    // Original count values
    triviaQuestions,
    triviaDareDares,
    daresOnlyDares,
    // Add inflated numbers state and toggle
    showInflatedNumbers,
    toggleInflatedNumbers,
    // Add getters for display values
    getDisplayTriviaQuestions,
    getDisplayTriviaDareDares,
    getDisplayDaresOnlyDares,
    resourcesLoaded
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

const testFirebaseConnection = async () => {
  try {
    // Test auth
    const { auth } = require('./config/firebaseConfig');
    const anonymousUser = await signInAnonymously(auth);
    console.log('Firebase auth working!', anonymousUser.user.uid);
    
    // Test database
    const { database } = require('./config/firebaseConfig');
    const testRef = ref(database, 'test');
    await set(testRef, {
      timestamp: serverTimestamp(),
      message: 'Test successful'
    });
    console.log('Firebase database working!');
    
    return true;
  } catch (error) {
    console.error('Firebase test failed:', error);
    return false;
  }
};

const SettingsContent = () => {
  const { 
    isGloballyMuted, 
    toggleGlobalMute, 
    // Use getters for display values instead of raw counts
    getDisplayTriviaQuestions,
    getDisplayTriviaDareDares,
    getDisplayDaresOnlyDares,
    // For the hidden feature
    showInflatedNumbers,
    toggleInflatedNumbers,
    isGameshowUI,
    toggleGameshowUI,
    resourcesLoaded
  } = useSettings();

  // Handle restore purchases
  const handleRestorePurchases = async () => {
    try {
      // Show loading alert
      Alert.alert(
        'Restoring Purchases',
        'Please wait while we restore your purchases...',
        [],
        { cancelable: false }
      );

      const success = await iapManager.restorePurchases();

      if (success) {
        Alert.alert(
          'Success',
          'Your purchases have been restored successfully!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found to restore. If you made purchases but they\'re not showing up, please try again later or contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert(
        'Error',
        'Failed to restore purchases. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Show loading state or placeholder for Android
  if (!resourcesLoaded && Platform.OS === 'android') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.loadingText}>Loading game content...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Sound Toggle */}
        <View style={styles.soundToggle}>
          <Text style={styles.toggleLabel}>Mute All Sounds</Text>
          <Switch
            value={isGloballyMuted}
            onValueChange={toggleGlobalMute}
            trackColor={{ false: '#767577', true: '#00a2e8' }}
            thumbColor={isGloballyMuted ? '#ffffff' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
        
        <View style={styles.divider} />

        {/* Restore Purchases Button */}
        <Pressable
          style={[styles.restoreButton, styles.pressableButton]}
          onPress={handleRestorePurchases}
        >
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </Pressable>
        
        <View style={styles.divider} />

        {/* Game Modes */}
        <View>
          {/* TriviaDare Mode */}
          <Text style={styles.modeTitle}>TriviaDare Mode</Text>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Questions Available</Text>
              <Text style={styles.statValue}>{getDisplayTriviaQuestions()}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Dares Available</Text>
              <Text style={styles.statValue}>{getDisplayTriviaDareDares()}</Text>
            </View>
          </View>

          {/* DaresOnly Mode */}
          <Text style={styles.modeTitle}>DaresOnly Mode</Text>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Dares Available</Text>
              <Text style={styles.statValue}>{getDisplayDaresOnlyDares()}</Text>
            </View>
          </View>
        </View>

        {/* Footer with long press handler */}
        <View style={styles.footer}>
          <Pressable
            onLongPress={() => {
              // Start a timeout for 5 seconds
              const timer = setTimeout(() => {
                // Toggle between true and inflated numbers
                toggleInflatedNumbers();
                // Provide haptic feedback when toggled
                if (Platform.OS === 'ios') {
                  // Import the entire ReactNative package to access Haptics
                  const ReactNative = require('react-native');
                  if (ReactNative.Haptics) {
                    ReactNative.Haptics.impactAsync(ReactNative.Haptics.ImpactFeedbackStyle.Medium);
                  }
                } else if (Platform.OS === 'android') {
                  const { Vibration } = require('react-native');
                  Vibration.vibrate(100);
                }
              }, 5000);
              
              // Return function to clean up timer if press is released early
              return () => clearTimeout(timer);
            }}
            delayLongPress={1000} // Start recognizing long press after 1 second
          >
            <Text style={styles.footerText}>TriviaDare®</Text>
          </Pressable>
          <View style={styles.versionContainer}>
            <Text style={styles.version}>Version 1.0.0</Text>
            {!showInflatedNumbers && (
              <Text style={styles.trueNumbersIndicator}>Showing True Numbers</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
    flex: 0,
    alignSelf: 'center',
  },
  content: {
    padding: 15,
    paddingTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1A237E',
    marginBottom: 10,
  },
  soundToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginVertical: 4,
    height: Platform.OS === 'android' ? 48 : 44,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 15,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A237E',
    marginBottom: 10,
    marginTop: 5,
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }
    })
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Platform.OS === 'android' ? 15 : 16,
    color: '#666',
    fontWeight: '400',
  },
  statValue: {
    fontSize: Platform.OS === 'android' ? 16 : 18,
    color: '#00a2e8',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  version: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  versionContainer: {
    alignItems: 'center',
  },
  trueNumbersIndicator: {
    fontSize: 11,
    color: '#e74c3c',
    marginTop: 2,
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  restoreButton: {
    backgroundColor: '#00a2e8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: {
        elevation: 3,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      }
    })
  },
  pressableButton: {
    // Add press state styling
    pressStyle: {
      opacity: 0.7,
    }
  },
  restoreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export { SettingsContext, SettingsProvider, useSettings };
export default SettingsContent;