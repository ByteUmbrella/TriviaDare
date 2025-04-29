import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import QuestionContainer from '../QuestionContainer'; // Import the working component
import { Ionicons } from '@expo/vector-icons';

// Debug logger
const debug = (message, data) => {
  if (__DEV__) {
    console.log(`[MultiplayerQuestionContainer] ${message}`, data || '');
  }
};

// Wrapper component that adapts QuestionContainer for multiplayer
const MultiplayerQuestionContainer = memo((props) => {
  const {
    questionText,
    currentQuestion,
    selectedOption,
    onSelectOption,
    onConfirm,
    isAnswerSubmitted,
    currentScore,
    onInfoPress,
    onTimerPause,
    spectatorMode = false,
    isMultiplayer = true,
    timerConfig,
    activePlayerName = null, // New prop to display active player name
    deviceId = null, // Optional device ID for debugging
    hierarchicalId = null // Optional hierarchical ID for debugging
  } = props;

  // Log props for debugging
  React.useEffect(() => {
    debug('Render with props', {
      hasQuestion: !!currentQuestion,
      questionText,
      spectatorMode,
      activePlayer: activePlayerName,
      deviceInfo: {
        deviceId,
        hierarchicalId
      },
      options: currentQuestion ? {
        A: currentQuestion['Option A'],
        B: currentQuestion['Option B'],
        C: currentQuestion['Option C'],
        D: currentQuestion['Option D']
      } : 'No options'
    });
  }, [currentQuestion, questionText, spectatorMode, activePlayerName, deviceId, hierarchicalId]);

  // Helper to extract device ID from hierarchical identifier
  const extractDeviceId = useCallback((identifier) => {
    if (!identifier || typeof identifier !== 'string') {
      return identifier; // Return the original value if not a string
    }
    
    try {
      // Parse TDARE::{GameName}::{DeviceId} format
      const parts = identifier.split('::');
      return parts.length === 3 ? parts[2] : identifier;
    } catch (error) {
      console.error('Error extracting device ID:', error, identifier);
      return identifier; // Return the original value if split fails
    }
  }, []);
  
  // Create spectator-aware wrapper functions
  const handleOptionSelect = (option) => {
    if (!spectatorMode && onSelectOption) {
      onSelectOption(option);
    }
  };

  const handleConfirm = () => {
    if (!spectatorMode && onConfirm) {
      onConfirm();
    }
  };

  // Enhanced spectator banner
  const renderSpectatorBanner = () => {
    if (!spectatorMode) return null;
    
    return (
      <View style={styles.spectatorBanner}>
        <Ionicons name="eye" size={16} color="#FFFFFF" />
        <Text style={styles.spectatorBannerText}>
          SPECTATOR MODE {activePlayerName ? `- ${activePlayerName}'s turn` : ''}
        </Text>
      </View>
    );
  };

  // Just return your existing QuestionContainer with adapted props
  return (
    <View style={styles.container}>
      
      {/* Use the regular QuestionContainer */}
      <QuestionContainer
        questionText={questionText}
        currentQuestion={currentQuestion}
        selectedOption={selectedOption}
        onSelectOption={handleOptionSelect} // Use our wrapper
        onConfirm={handleConfirm} // Use our wrapper
        isAnswerSubmitted={isAnswerSubmitted}
        currentScore={currentScore}
        onInfoPress={onInfoPress}
        onTimerPause={onTimerPause}
        disabled={spectatorMode} // Ensure controls are disabled in spectator mode
      />
      
      {/* Do NOT show debug info in live app view */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  spectatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 5,
    width: '90%',
    alignSelf: 'center'
  },
  spectatorBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  debugContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    marginTop: 5,
    borderRadius: 4,
    alignSelf: 'center',
    display: 'none', // Hidden by default
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
  }
});

MultiplayerQuestionContainer.displayName = 'MultiplayerQuestionContainer';
export default MultiplayerQuestionContainer;