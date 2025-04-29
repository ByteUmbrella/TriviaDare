import React, { createContext, useState, useContext, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';

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
});

const SettingsContext = createContext();

const SettingsProvider = ({ children }) => {
  const [isGloballyMuted, setIsGloballyMuted] = useState(false);
  const [screenMuteStates, setScreenMuteStates] = useState({});
  const [triviaQuestions, setTriviaQuestions] = useState(0);
  const [triviaDareDares, setTriviaDareDares] = useState(0);
  const [daresOnlyDares, setDaresOnlyDares] = useState(0);
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

  const isAudioEnabled = (screenId) => {
    if (isGloballyMuted) return false;
    if (screenMuteStates.hasOwnProperty(screenId)) {
      return !screenMuteStates[screenId];
    }
    return true;
  };

  const value = {
    isGloballyMuted,
    toggleGlobalMute,
    toggleScreenMute,
    isAudioEnabled,
    screenMuteStates,
    triviaQuestions,
    triviaDareDares,
    daresOnlyDares,
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
    triviaQuestions,
    triviaDareDares,
    daresOnlyDares,
    isGameshowUI,
    toggleGameshowUI,
    resourcesLoaded
  } = useSettings();

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

        {/* Game Modes */}
        <View>
          {/* TriviaDare Mode */}
          <Text style={styles.modeTitle}>TriviaDare Mode</Text>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Questions Available</Text>
              <Text style={styles.statValue}>{triviaQuestions}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Dares Available</Text>
              <Text style={styles.statValue}>{triviaDareDares}</Text>
            </View>
          </View>

          {/* DaresOnly Mode */}
          <Text style={styles.modeTitle}>DaresOnly Mode</Text>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Dares Available</Text>
              <Text style={styles.statValue}>{daresOnlyDares}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>TriviaDare®</Text>
          <Text style={styles.version}>Version 1.0.4</Text>
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
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    padding: 20,
  }
});

export { SettingsContext, SettingsProvider, useSettings };
export default SettingsContent;