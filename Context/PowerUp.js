import React, { createContext, useContext, useState } from 'react';

// Simple PowerUp types for testing
export const POWERUP_TYPES = {
  FIFTY_FIFTY: {
    id: 'fifty_fifty',
    name: '50/50',
    icon: '⚡',
    description: 'Eliminates two wrong answers',
    color: '#FFD700',
  },
  EXTRA_TIME: {
    id: 'extra_time',
    name: 'Extra Time',
    icon: '⏰',
    description: 'Adds 10 seconds to timer',
    color: '#00BFFF',
  },
  DARE_PASS: {
    id: 'dare_pass',
    name: 'Dare Pass',
    icon: '🛡️',
    description: 'Skip dare but keep points',
    color: '#32CD32',
  },
  POINT_BOOSTER: {
    id: 'point_booster',
    name: 'Point Booster',
    icon: '💎',
    description: 'Double points for next question/dare',
    color: '#FF69B4',
  }
};

// Create the context
const PowerUpContext = createContext(null);

// Provider component
export const PowerUpProvider = ({ children }) => {
  const [playerPowerUps, setPlayerPowerUps] = useState({});
  const [activePowerUps, setActivePowerUps] = useState({});
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [pendingPowerUp, setPendingPowerUp] = useState(null);

  // Initialize players with powerups
  const initializePlayers = (players) => {
    const newPlayerPowerUps = {};
    players.forEach(player => {
      newPlayerPowerUps[player.id] = {
        fifty_fifty: true,
        extra_time: true,
        dare_pass: true,
        point_booster: true
      };
    });
    setPlayerPowerUps(newPlayerPowerUps);
  };

  // Check if player can use a specific powerup
  const canUsePowerUp = (playerId, powerUpType) => {
    return playerPowerUps[playerId]?.[powerUpType] === true;
  };

  // Get available powerups for a player
  const getPlayerPowerUps = (playerId) => {
    return playerPowerUps[playerId] || {};
  };

  // Use a powerup
  const usePowerUp = async (playerId, powerUpType, options = {}) => {
    if (!canUsePowerUp(playerId, powerUpType)) {
      throw new Error('PowerUp not available');
    }

    // Mark powerup as used
    setPlayerPowerUps(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [powerUpType]: false
      }
    }));

    // Handle specific powerup effects
    switch (powerUpType) {
      case 'fifty_fifty':
        const { answers, correctAnswerIndex } = options;
        const wrongIndices = answers
          .map((_, index) => index)
          .filter(index => index !== correctAnswerIndex);
        const shuffled = wrongIndices.sort(() => Math.random() - 0.5);
        const toRemove = shuffled.slice(0, 2);
        return { removedIndices: toRemove };

      case 'extra_time':
        const { addTime = 10 } = options;
        return { addedTime: addTime };

      case 'dare_pass':
        const { points = 0 } = options;
        return { points, skipped: true };

      case 'point_booster':
        setActivePowerUps(prev => ({
          ...prev,
          point_booster: { active: true, playerId, multiplier: 2 }
        }));
        return { multiplier: 2 };

      default:
        throw new Error('Unknown powerup type');
    }
  };

  // Show confirmation dialog
  const showPowerUpConfirmation = (powerUp, callback) => {
    setPendingPowerUp(powerUp);
    setIsConfirmationVisible(true);
  };

  // Hide confirmation dialog
  const hidePowerUpConfirmation = () => {
    setIsConfirmationVisible(false);
    setPendingPowerUp(null);
  };

  // Confirm powerup usage
  const confirmPowerUp = () => {
    // Implementation for confirmation
    hidePowerUpConfirmation();
  };

  // Get point multiplier
  const getPointMultiplier = (playerId) => {
    const booster = activePowerUps.point_booster;
    if (booster && booster.playerId === playerId && booster.active) {
      return booster.multiplier;
    }
    return 1;
  };

  // Deactivate point booster
  const deactivatePointBooster = () => {
    setActivePowerUps(prev => {
      const newActive = { ...prev };
      delete newActive.point_booster;
      return newActive;
    });
  };

  // Check achievements
  const checkAchievements = (gameResult) => {
    return []; // Simplified for now
  };

  // Reset powerups
  const resetPowerUps = () => {
    setPlayerPowerUps({});
    setActivePowerUps({});
    setIsConfirmationVisible(false);
    setPendingPowerUp(null);
  };

  // Create animation (simplified)
  const createAnimation = (key, initialValue = 0) => {
    // Return a mock animation value for now
    return { _value: initialValue };
  };

  // Animate powerup activation (simplified)
  const animatePowerUpActivation = (powerUpType, callback) => {
    // Simplified animation
    if (callback) callback();
  };

  const value = {
    // State
    playerPowerUps,
    activePowerUps,
    isConfirmationVisible,
    pendingPowerUp,
    
    // Actions
    initializePlayers,
    canUsePowerUp,
    getPlayerPowerUps,
    usePowerUp,
    showPowerUpConfirmation,
    hidePowerUpConfirmation,
    confirmPowerUp,
    getPointMultiplier,
    deactivatePointBooster,
    checkAchievements,
    resetPowerUps,
    createAnimation,
    animatePowerUpActivation,
    
    // Constants
    POWERUP_TYPES
  };

  return (
    <PowerUpContext.Provider value={value}>
      {children}
    </PowerUpContext.Provider>
  );
};

// Custom hook
export const usePowerUp = () => {
  const context = useContext(PowerUpContext);
  if (!context) {
    throw new Error('usePowerUp must be used within a PowerUpProvider');
  }
  return context;
};

// Default export
export default PowerUpContext;