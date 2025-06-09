import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform, View, Text, Alert, TextInput, TouchableOpacity, Switch, StyleSheet, Pressable } from 'react-native';
import Constants from 'expo-constants';
import iapManager from './IAPManager';
import PromoCodeManager from './PromoCode';

// Keep all your existing pack loading logic...
const getPackToJson = () => ({
  'Entertainment': require('../Packs/TriviaDare/GenericPacks/Entertainmenteasy.json'),
  'Science': require('../Packs/TriviaDare/GenericPacks/Scienceeasy.json'),
  'History': require('../Packs/TriviaDare/GenericPacks/Historyeasy.json'),
  'Sports': require('../Packs/TriviaDare/GenericPacks/Sportseasy.json'),
  'Art': require('../Packs/TriviaDare/GenericPacks/Arteasy.json'),
  'Geography': require('../Packs/TriviaDare/GenericPacks/Geographyeasy.json'),
  'Movies': require('../Packs/TriviaDare/GenericPacks/Movieeasy.json'),
  'Music': require('../Packs/TriviaDare/GenericPacks/Musiceasy.json'),
  'Technology': require('../Packs/TriviaDare/GenericPacks/Technologyeasy.json'),
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

// Compact Promo Code Section Component
const PromoCodeSection = ({ onPromoSuccess }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRedeemCode = async () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }

    setIsRedeeming(true);

    try {
      const result = await PromoCodeManager.redeemPromoCode(promoCode);
      
      if (result.success) {
        const packTypeText = result.packType === 'trivia' ? 'Trivia Pack' : 
                           result.packType === 'dares' ? 'Dares Pack' : 
                           result.packType === 'bundle' ? 'Bundle' : 'Pack';
        
        Alert.alert(
          'Success!', 
          `${result.packName} has been unlocked!\n\n🎉 ${packTypeText} is now available to play.\n\n⚠️ Note: This unlock is tied to your device.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setPromoCode('');
                setIsExpanded(false);
                if (onPromoSuccess && typeof onPromoSuccess === 'function') {
                  onPromoSuccess(result);
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to redeem promo code. Please try again.');
      console.error('Promo code redemption error:', error);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <View style={styles.promoSection}>
      <TouchableOpacity 
        style={styles.promoHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.promoHeaderContent}>
          <Text style={styles.promoHeaderIcon}>🎁</Text>
          <Text style={styles.promoHeaderText}>Promo Code</Text>
        </View>
        <Text style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
          ▼
        </Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.promoContent}>
          <Text style={styles.promoDisclaimer}>
            Unlock premium content with promo codes
          </Text>
          
          <TextInput
            style={styles.promoInput}
            placeholder="Enter promo code"
            placeholderTextColor="#999"
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            editable={!isRedeeming}
          />
          
          <TouchableOpacity 
            style={[styles.redeemButton, isRedeeming && styles.redeemButtonDisabled]}
            onPress={handleRedeemCode}
            disabled={isRedeeming}
            activeOpacity={0.7}
          >
            <Text style={styles.redeemButtonText}>
              {isRedeeming ? 'Redeeming...' : 'Redeem Code'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const SettingsProvider = ({ children }) => {
  const [isGloballyMuted, setIsGloballyMuted] = useState(false);
  const [screenMuteStates, setScreenMuteStates] = useState({});
  const [triviaQuestions, setTriviaQuestions] = useState(0);
  const [triviaDareDares, setTriviaDareDares] = useState(0);
  const [daresOnlyDares, setDaresOnlyDares] = useState(0);
  const [showInflatedNumbers, setShowInflatedNumbers] = useState(true);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      requestAnimationFrame(() => {
        calculateAllTotals();
      });
    } else {
      calculateAllTotals();
    }

    return () => {
      setResourcesLoaded(false);
    };
  }, []);

  const calculateAllTotals = () => {
    try {
      const packToJson = getPackToJson();
      const daresOnlyPackToJson = getDaresOnlyPackToJson();
      
      const totalQuestions = Object.values(packToJson).reduce((sum, pack) => {
        return sum + ((pack?.Sheet1?.length) || 0);
      }, 0);
      setTriviaQuestions(totalQuestions);
    
      try {
        const triviaDareDaresData = require('../dares/dare.json');
        const triviaDareTotal = Array.isArray(triviaDareDaresData) ? triviaDareDaresData.length : 0;
        setTriviaDareDares(triviaDareTotal);
      } catch (error) {
        console.error('Error loading TriviaDare dares:', error);
        setTriviaDareDares(0);
      }
    
      const daresOnlyTotal = Object.values(daresOnlyPackToJson).reduce((sum, pack) => {
        return sum + (Array.isArray(pack) ? pack.length : 0);
      }, 0);
      setDaresOnlyDares(daresOnlyTotal);
      
      setResourcesLoaded(true);
    } catch (error) {
      console.error('Error calculating game content:', error);
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
    triviaQuestions,
    triviaDareDares,
    daresOnlyDares,
    showInflatedNumbers,
    toggleInflatedNumbers,
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

const SettingsContent = () => {
  const { 
    isGloballyMuted, 
    toggleGlobalMute, 
    getDisplayTriviaQuestions,
    getDisplayTriviaDareDares,
    getDisplayDaresOnlyDares,
    showInflatedNumbers,
    toggleInflatedNumbers,
    resourcesLoaded
  } = useSettings();

  // Mode toggle state - true for TriviaDare, false for DaresOnly
  const [isTriviaDareMode, setIsTriviaDareMode] = useState(true);

  const handleRestorePurchases = async () => {
    try {
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
        {/* Audio Settings */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingIcon}>🔊</Text>
            <Text style={styles.settingLabel}>Sound Effects</Text>
          </View>
          <Switch
            value={!isGloballyMuted}
            onValueChange={(value) => toggleGlobalMute(!value)}
            trackColor={{ false: '#ccc', true: '#00a2e8' }}
            thumbColor={'#fff'}
            ios_backgroundColor="#ccc"
          />
        </View>
        
        <View style={styles.divider} />

        {/* Game Content Stats - With Mode Toggle */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <View style={styles.statsHeaderLeft}>
              <Text style={styles.statsIcon}>📊</Text>
              <Text style={styles.statsSectionTitle}>Game Content</Text>
            </View>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  styles.segmentButtonLeft,
                  isTriviaDareMode && styles.segmentButtonActive
                ]}
                onPress={() => setIsTriviaDareMode(true)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  isTriviaDareMode && styles.segmentTextActive
                ]}>
                  Trivia{'\n'}DARE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  styles.segmentButtonRight,
                  !isTriviaDareMode && styles.segmentButtonActive
                ]}
                onPress={() => setIsTriviaDareMode(false)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  !isTriviaDareMode && styles.segmentTextActive
                ]}>
                  Dares{'\n'}ONLY
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.compactStatsGrid}>
            {isTriviaDareMode ? (
              <>
                <View style={styles.compactStatItem}>
                  <Text style={styles.compactStatValue}>{getDisplayTriviaQuestions()}</Text>
                  <Text style={styles.compactStatLabel}>Trivia Questions</Text>
                </View>
                <View style={styles.compactStatItem}>
                  <Text style={styles.compactStatValue}>{getDisplayTriviaDareDares()}</Text>
                  <Text style={styles.compactStatLabel}>Dares Available</Text>
                </View>
              </>
            ) : (
              <View style={styles.compactStatItemFull}>
                <Text style={styles.compactStatValue}>{getDisplayDaresOnlyDares()}</Text>
                <Text style={styles.compactStatLabel}>Dares Available</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Promo Code Section - Expandable */}
        <PromoCodeSection 
          onPromoSuccess={(result) => {
            console.log('Promo code redeemed successfully:', result);
          }}
        />
        
        <View style={styles.divider} />

        {/* Restore Purchases - Smaller */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreIcon}>🔄</Text>
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            onLongPress={() => {
              const timer = setTimeout(() => {
                toggleInflatedNumbers();
                if (Platform.OS === 'ios') {
                  const ReactNative = require('react-native');
                  if (ReactNative.Haptics) {
                    ReactNative.Haptics.impactAsync(ReactNative.Haptics.ImpactFeedbackStyle.Medium);
                  }
                } else if (Platform.OS === 'android') {
                  const { Vibration } = require('react-native');
                  Vibration.vibrate(100);
                }
              }, 5000);
              
              return () => clearTimeout(timer);
            }}
            delayLongPress={1000}
          >
            <Text style={styles.footerText}>TriviaDare®</Text>
          </Pressable>
          <View style={styles.versionContainer}>
            <Text style={styles.version}>Version {Constants.expoConfig?.version || Constants.manifest?.version || '1.0.1'}</Text>
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
    padding: 20,
  },
  
  // Setting Row Style
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },

  // Compact Stats Section
  statsSection: {
    marginVertical: 8,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  statsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A237E',
  },
  
  // Segmented Control Styles (True/False style)
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E8D5FF', // Light purple background
    borderRadius: 8,
    padding: 2,
    minWidth: 140,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40, // Ensure enough height for two lines
  },
  segmentButtonLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentButtonRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#7C4DFF', // Dark purple for active
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C4DFF', // Dark purple text for inactive
    textAlign: 'center',
    lineHeight: 14,
  },
  segmentTextActive: {
    color: '#FFFFFF', // White text for active
  },
  
  compactStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  compactStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  compactStatItemFull: {
    alignItems: 'center',
    flex: 1,
  },
  compactStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00a2e8',
    marginBottom: 4,
  },
  compactStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Promo Code Section - Expandable
  promoSection: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  promoHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoHeaderIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  promoHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A237E',
  },
  expandIcon: {
    fontSize: 12,
    color: '#666',
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  promoContent: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  promoDisclaimer: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  promoInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  redeemButton: {
    backgroundColor: '#00a2e8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  redeemButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  redeemButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Restore Purchases - Simplified
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  restoreIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  restoreButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },

  // Dividers
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 16,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  versionContainer: {
    alignItems: 'center',
  },
  version: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
});

export { SettingsContext, SettingsProvider, useSettings };
export default SettingsContent;