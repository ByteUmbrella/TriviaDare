// Context/AchievementModal.js - Enhanced Version with 26 Achievements
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  FlatList,
  Animated,
  Dimensions,
  StyleSheet,
  Platform,
  TouchableNativeFeedback,
  ToastAndroid,
  StatusBar,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ACHIEVEMENTS DATA - Complete 26 achievements
export const ACHIEVEMENTS_DATA = [
  // Original achievements (updated)
  {
    id: 'first_game',
    title: 'Game Show Debut',
    description: 'Play your first game of TriviaDARE',
    icon: '🎬',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Milestone',
    rarity: 'common'
  },
  {
    id: 'dares_only',
    title: 'Dare Devil',
    description: 'Complete a Dares Only game',
    icon: '😈',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Game Mode',
    rarity: 'common'
  },
  {
    id: 'streak_5',
    title: 'Knowledge Master',
    description: 'Answer 5 questions correctly in a row',
    icon: '🧠',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Skill',
    rarity: 'uncommon'
  },
  {
    id: 'pack_collector',
    title: 'Pack Collector',
    description: 'Purchase your first trivia pack',
    icon: '💰',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Purchase',
    rarity: 'common'
  },
  {
    id: 'video_star',
    title: 'Video Star',
    description: 'Record your first dare video',
    icon: '📹',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Content',
    rarity: 'uncommon'
  },
  {
    id: 'trivia_master',
    title: 'Trivia Master',
    description: 'Complete 10 TriviaDARE games',
    icon: '👑',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Milestone',
    rarity: 'rare'
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Answer a question in under 3 seconds',
    icon: '⚡',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Skill',
    rarity: 'rare'
  },
  {
    id: 'dare_master',
    title: 'Dare Master',
    description: 'Complete 25 dares',
    icon: '🎭',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Challenge',
    rarity: 'epic'
  },

  // NEW: Game Mode achievements
  {
    id: 'dares_only_debut',
    title: 'Challenge Accepted',
    description: 'Complete your first DaresONLY game',
    icon: '🎯',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Game Mode',
    rarity: 'common'
  },
  {
    id: 'trivia_only_debut',
    title: 'Pure Knowledge',
    description: 'Complete your first TriviaONLY game',
    icon: '📚',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Game Mode',
    rarity: 'common'
  },
  {
    id: 'dares_only_master',
    title: 'Dare Champion',
    description: 'Complete 10 DaresONLY games',
    icon: '🏅',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Game Mode',
    rarity: 'uncommon'
  },
  {
    id: 'trivia_only_master',
    title: 'Scholar Supreme',
    description: 'Complete 10 TriviaONLY games',
    icon: '🎓',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Game Mode',
    rarity: 'uncommon'
  },
  {
    id: 'mixed_master',
    title: 'Triple Threat',
    description: 'Complete 5 games in each mode (TriviaDare, TriviaONLY, DaresONLY)',
    icon: '⚖️',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Game Mode',
    rarity: 'rare'
  },
  {
    id: 'pack_enthusiast',
    title: 'Pack Enthusiast',
    description: 'Purchase 3 different trivia packs',
    icon: '🛒',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Purchase',
    rarity: 'uncommon'
  },
  {
    id: 'pack_library',
    title: 'Library Owner',
    description: 'Purchase 5 different trivia packs',
    icon: '📚',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Purchase',
    rarity: 'rare'
  },
  {
    id: 'pack_completionist',
    title: 'Pack Completionist',
    description: 'Purchase all available trivia packs',
    icon: '💎',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Purchase',
    rarity: 'epic'
  },

  // NEW: Skill achievements
  {
    id: 'perfect_game',
    title: 'Flawless Victory',
    description: 'Complete a game with no wrong answers',
    icon: '💎',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Skill',
    rarity: 'rare'
  },
  {
    id: 'streak_10',
    title: 'Genius Level',
    description: 'Answer 10 questions correctly in a row',
    icon: '🔥',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Skill',
    rarity: 'rare'
  },
  {
    id: 'streak_25',
    title: 'Unstoppable Mind',
    description: 'Answer 25 questions correctly in a row',
    icon: '🌟',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Skill',
    rarity: 'epic'
  },
  {
    id: 'lightning_round',
    title: 'Lightning Round',
    description: 'Answer correctly in under 2 seconds',
    icon: '⚡',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Skill',
    rarity: 'epic'
  },

  // NEW: Milestone achievements
  {
    id: 'games_25',
    title: 'Devoted Player',
    description: 'Complete 25 games',
    icon: '🏆',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Milestone',
    rarity: 'uncommon'
  },
  {
    id: 'games_50',
    title: 'Trivia Veteran',
    description: 'Complete 50 games',
    icon: '🎖️',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Milestone',
    rarity: 'rare'
  },
  {
    id: 'games_100',
    title: 'Hall of Famer',
    description: 'Complete 100 games',
    icon: '🏛️',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Milestone',
    rarity: 'legendary'
  },

  // NEW: Challenge achievements
  {
    id: 'dare_enthusiast',
    title: 'Dare Enthusiast',
    description: 'Complete 10 dares',
    icon: '🎪',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Challenge',
    rarity: 'uncommon'
  },
  {
    id: 'dare_legend',
    title: 'Dare Legend',
    description: 'Complete 50 dares',
    icon: '🎭',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Challenge',
    rarity: 'epic'
  },
  {
    id: 'quick_dare',
    title: 'Quick on the Draw',
    description: 'Complete a dare in under 10 seconds',
    icon: '🏃',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Challenge',
    rarity: 'rare'
  },
  {
    id: 'completionist',
    title: 'The Completionist',
    description: 'Unlock all other achievements',
    icon: '🌈',
    unlocked: false,
    unlockedDate: null,
    acknowledged: false,
    category: 'Milestone',
    rarity: 'legendary'
  }
];

// ACHIEVEMENT HELPER FUNCTIONS
export const loadAchievements = async () => {
  try {
    const savedAchievements = await AsyncStorage.getItem('achievements');
    if (savedAchievements) {
      const parsed = JSON.parse(savedAchievements);
      // Merge with default data to ensure new achievements are added
      return ACHIEVEMENTS_DATA.map(defaultAchievement => {
        const saved = parsed.find(a => a.id === defaultAchievement.id);
        return saved ? { ...defaultAchievement, ...saved } : defaultAchievement;
      });
    }
    return ACHIEVEMENTS_DATA;
  } catch (error) {
    console.error('Error loading achievements:', error);
    return ACHIEVEMENTS_DATA;
  }
};

export const saveAchievements = async (achievements) => {
  try {
    await AsyncStorage.setItem('achievements', JSON.stringify(achievements));
    return true;
  } catch (error) {
    console.error('Error saving achievements:', error);
    return false;
  }
};

export const unlockAchievementHelper = async (achievementId) => {
  try {
    const currentAchievements = await loadAchievements();
    
    const updatedAchievements = currentAchievements.map(achievement => {
      if (achievement.id === achievementId && !achievement.unlocked) {
        return {
          ...achievement,
          unlocked: true,
          unlockedDate: new Date().toISOString(),
          acknowledged: false // New achievements start as unacknowledged
        };
      }
      return achievement;
    });
    
    const success = await saveAchievements(updatedAchievements);
    
    if (success) {
      // Enhanced celebration feedback
      if (Platform.OS === 'android') {
        const achievement = ACHIEVEMENTS_DATA.find(a => a.id === achievementId);
        if (achievement) {
          Vibration.vibrate([50, 100, 50]); // Celebration pattern
          ToastAndroid.show(`🏆 Achievement Unlocked: ${achievement.title}`, ToastAndroid.LONG);
        }
      }
      return updatedAchievements;
    }
    
    return null;
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return null;
  }
};

// NEW: Function to acknowledge an achievement
export const acknowledgeAchievement = async (achievementId) => {
  try {
    const currentAchievements = await loadAchievements();
    
    const updatedAchievements = currentAchievements.map(achievement => {
      if (achievement.id === achievementId && achievement.unlocked && !achievement.acknowledged) {
        return {
          ...achievement,
          acknowledged: true
        };
      }
      return achievement;
    });
    
    const success = await saveAchievements(updatedAchievements);
    
    if (success) {
      return updatedAchievements;
    }
    
    return null;
  } catch (error) {
    console.error('Error acknowledging achievement:', error);
    return null;
  }
};

// NEW: Function to get count of unacknowledged achievements
export const getUnacknowledgedCount = (achievements) => {
  return achievements.filter(achievement => 
    achievement.unlocked && !achievement.acknowledged
  ).length;
};

// Export this for easy importing in game screens
export { unlockAchievementHelper as unlockAchievement };

// Device type detection and responsive functions
const getDeviceType = () => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  
  if (Platform.OS === 'ios') {
    if ((SCREEN_WIDTH >= 768 && SCREEN_HEIGHT >= 1024) || aspectRatio < 1.6) {
      return 'tablet';
    }
  } else {
    if (SCREEN_WIDTH >= 600 || aspectRatio < 1.6) {
      return 'tablet';
    }
  }
  
  return 'phone';
};

const isTablet = () => getDeviceType() === 'tablet';

// Enhanced responsive scaling functions
const responsiveFont = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.3);
  }
  return phoneSize;
};

const responsiveSpacing = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.4);
  }
  return phoneSize;
};

const responsiveSize = (phoneSize) => {
  if (isTablet()) {
    return Math.round(phoneSize * 1.25);
  }
  return phoneSize;
};

// Enhanced Achievement Card Component with acknowledgment handling
const AchievementCard = React.memo(({ achievement, index, onAcknowledge }) => {
  const slideInAnim = useRef(new Animated.Value(0)).current;
  
  // Rarity color mapping
  const rarityColors = {
    common: '#8E8E8E',
    uncommon: '#2E7D32',
    rare: '#1976D2',
    epic: '#7B1FA2',
    legendary: '#FF6F00'
  };

  const rarityColor = rarityColors[achievement.rarity] || rarityColors.common;
  
  // Check if this is a new (unacknowledged) achievement
  const isNewAchievement = achievement.unlocked && !achievement.acknowledged;

  useEffect(() => {
    // Staggered entrance animation
    Animated.timing(slideInAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [index]);

  // Handle acknowledgment when user taps on unlocked achievement
  const handleAcknowledge = async () => {
    if (isNewAchievement && onAcknowledge) {
      await onAcknowledge(achievement.id);
    }
  };

  const cardStyle = [
    styles.achievementCard,
    achievement.unlocked ? styles.achievementUnlocked : styles.achievementLocked,
    // Add special styling for new achievements
    isNewAchievement && styles.newAchievementCard,
    // Enhanced border for rare achievements
    achievement.unlocked && achievement.rarity !== 'common' && {
      borderColor: rarityColor,
      borderWidth: responsiveSize(3),
    },
    {
      opacity: slideInAnim,
      transform: [{
        translateY: slideInAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        })
      }]
    }
  ];

  return (
    <TouchableOpacity 
      onPress={handleAcknowledge} 
      disabled={!isNewAchievement}
      activeOpacity={isNewAchievement ? 0.7 : 1}
    >
      <Animated.View style={cardStyle}>
        {/* NEW: Notification indicator for unacknowledged achievements */}
        {isNewAchievement && (
          <View style={styles.newAchievementIndicator}>
            <Text style={styles.newAchievementText}>NEW!</Text>
          </View>
        )}
        
        <View style={styles.achievementHeader}>
          <Text style={[
            styles.achievementIcon,
            !achievement.unlocked && styles.lockedIcon
          ]}>
            {achievement.icon}
          </Text>
          <View style={styles.achievementInfo}>
            <View style={styles.titleRow}>
              <Text style={[
                styles.achievementTitle,
                !achievement.unlocked && styles.lockedText,
                isNewAchievement && styles.newAchievementTitle
              ]}>
                {achievement.title}
              </Text>
              {achievement.rarity !== 'common' && (
                <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
                  <Text style={styles.rarityText}>
                    {achievement.rarity.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.achievementDescription,
              !achievement.unlocked && styles.lockedText
            ]}>
              {achievement.description}
            </Text>
          </View>
          {achievement.unlocked && (
            <View style={styles.checkmarkBadge}>
              <Icon name="check" size={responsiveSize(16)} color="#FFFFFF" />
            </View>
          )}
        </View>
        
        <View style={styles.achievementFooter}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{achievement.category}</Text>
          </View>
          {achievement.unlocked && achievement.unlockedDate ? (
            <Text style={styles.unlockDate}>
              Unlocked: {new Date(achievement.unlockedDate).toLocaleDateString()}
            </Text>
          ) : (
            <Text style={styles.lockedIndicator}>🔒 Locked</Text>
          )}
        </View>
        
        {/* NEW: Tap hint for new achievements */}
        {isNewAchievement && (
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to acknowledge</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// Enhanced Main Achievement Modal Component with acknowledgment handling
const AchievementModal = ({ 
  visible, 
  onClose, 
  achievements = [], 
  onAchievementsUpdate // NEW: Callback to update achievements in parent
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Milestone');
  const modalScale = useRef(new Animated.Value(0)).current;

  // Handle achievement acknowledgment
  const handleAchievementAcknowledge = async (achievementId) => {
    try {
      const updatedAchievements = await acknowledgeAchievement(achievementId);
      if (updatedAchievements && onAchievementsUpdate) {
        onAchievementsUpdate(updatedAchievements);
        
        // Provide feedback
        if (Platform.OS === 'android') {
          const achievement = achievements.find(a => a.id === achievementId);
          if (achievement) {
            Vibration.vibrate(50);
            ToastAndroid.show(`✨ ${achievement.title} acknowledged!`, ToastAndroid.SHORT);
          }
        }
      }
    } catch (error) {
      console.error('Error acknowledging achievement:', error);
    }
  };

  // Memoized calculations for performance
  const achievementStats = useMemo(() => {
    const unlockedAchievements = achievements.filter(a => a.unlocked).length;
    const totalAchievements = achievements.length;
    const completionRate = totalAchievements > 0 ? Math.round((unlockedAchievements / totalAchievements) * 100) : 0;
    
    return { unlockedAchievements, totalAchievements, completionRate };
  }, [achievements]);

  const { unlockedAchievements, totalAchievements, completionRate } = achievementStats;

  // Memoized filtered achievements
  const filteredAchievements = useMemo(() => {
    return achievements.filter(a => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  // Memoized categories
  const achievementCategories = useMemo(() => {
    return [...new Set(achievements.map(a => a.category))];
  }, [achievements]);

  // Animation when modal opens/closes
  useEffect(() => {
    if (visible) {
      // Set status bar style for better modal appearance
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('rgba(0,0,0,0.8)', true);
      }
      
      Animated.spring(modalScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      modalScale.setValue(0);
      
      // Reset status bar
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent', true);
      }
    }
  }, [visible]);

  // Enhanced close handler
  const handleClose = useCallback(() => {
    Animated.timing(modalScale, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose]);

  // Enhanced category selection with haptic feedback
  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category);
    if (Platform.OS === 'android') {
      Vibration.vibrate(25); // Light haptic feedback
    }
  }, []);

  const CloseButton = () => {
    if (Platform.OS === 'android') {
      return (
        <View style={{
          borderRadius: responsiveSize(20),
          overflow: 'hidden'
        }}>
          <TouchableNativeFeedback
            onPress={handleClose}
            background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true)}
          >
            <View style={styles.closeButton}>
              <Icon name="times" size={responsiveSize(24)} color="#FFD700" />
            </View>
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
        <Icon name="times" size={responsiveSize(24)} color="#FFD700" />
      </TouchableOpacity>
    );
  };

  const CategoryButton = ({ category }) => {
    const isActive = selectedCategory === category;
    
    if (Platform.OS === 'android') {
      return (
        <View style={{
          borderRadius: responsiveSize(15),
          overflow: 'hidden',
          marginRight: responsiveSpacing(10),
        }}>
          <TouchableNativeFeedback
            onPress={() => handleCategorySelect(category)}
            background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', false)}
          >
            <View style={[
              styles.categoryButton,
              isActive && styles.categoryButtonActive
            ]}>
              <Text style={[
                styles.categoryButtonText,
                isActive && styles.categoryButtonTextActive
              ]}>
                {category}
              </Text>
            </View>
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={category}
        style={[
          styles.categoryButton,
          isActive && styles.categoryButtonActive
        ]}
        onPress={() => handleCategorySelect(category)}
      >
        <Text style={[
          styles.categoryButtonText,
          isActive && styles.categoryButtonTextActive
        ]}>
          {category}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={e => e.stopPropagation()}
        >
          <Animated.View style={[
            styles.modalContainer,
            {
              transform: [{ scale: modalScale }]
            }
          ]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>🏆 HALL OF FAME 🏆</Text>
                <Text style={styles.completionStats}>
                  {unlockedAchievements}/{totalAchievements} Complete ({completionRate}%)
                </Text>
              </View>
              <CloseButton />
            </View>

            {/* Enhanced Progress Bar with gradient */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    { width: `${completionRate}%` }
                  ]} 
                />
              </View>
              {completionRate === 100 && (
                <Text style={styles.perfectText}>🌟 PERFECT! 🌟</Text>
              )}
            </View>

            {/* Category Filter */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryFilter}
              contentContainerStyle={{ paddingHorizontal: responsiveSpacing(20) }}
            >
              {achievementCategories.map(category => (
                <CategoryButton key={category} category={category} />
              ))}
            </ScrollView>

            {/* Achievements List */}
            <View style={[styles.achievementsContainer, { 
              height: SCREEN_HEIGHT * 0.85 - 220 // Modal height minus header/progress/categories space
            }]}>
              {filteredAchievements.length > 0 ? (
                <FlatList
                  data={filteredAchievements}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => (
                    <AchievementCard 
                      achievement={item} 
                      index={index}
                      onAcknowledge={handleAchievementAcknowledge}
                    />
                  )}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  contentContainerStyle={styles.achievementsContentContainer}
                  style={styles.achievementsList}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Icon 
                    name="trophy" 
                    size={responsiveSize(50)} 
                    color="#FFD700" 
                    style={{ opacity: 0.5 }}
                  />
                  <Text style={styles.emptyStateText}>
                    No {selectedCategory} achievements unlocked yet!
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContainer: {
    backgroundColor: 'rgba(26,35,126,0.98)',
    borderRadius: responsiveSize(20),
    width: isTablet() ? Math.min(600, SCREEN_WIDTH * 0.8) : SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.85,
    borderWidth: responsiveSize(3),
    borderColor: '#FFD700',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 10,
      }
    })
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing(15),
    borderBottomWidth: responsiveSize(2),
    borderBottomColor: '#FFD700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopLeftRadius: responsiveSize(17),
    borderTopRightRadius: responsiveSize(17),
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: responsiveFont(24),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  completionStats: {
    color: '#FFFFFF',
    fontSize: responsiveFont(14),
    textAlign: 'center',
    marginTop: responsiveSpacing(5),
    opacity: 0.9,
  },
  closeButton: {
    padding: responsiveSpacing(10),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: responsiveSize(20),
    marginLeft: responsiveSpacing(10),
    minWidth: responsiveSize(44),
    minHeight: responsiveSize(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    padding: responsiveSpacing(15),
    paddingBottom: responsiveSpacing(8),
  },
  progressBar: {
    height: responsiveSize(8),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: responsiveSize(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: responsiveSize(4),
  },
  perfectText: {
    color: '#FFD700',
    fontSize: responsiveFont(16),
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: responsiveSpacing(10),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  categoryFilter: {
    marginBottom: responsiveSpacing(8),
    maxHeight: responsiveSize(45),
    flexGrow: 0,
  },
  categoryButton: {
    paddingHorizontal: responsiveSpacing(15),
    paddingVertical: responsiveSpacing(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: responsiveSize(15),
    marginRight: responsiveSpacing(10),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFFFFF',
  },
  categoryButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(14),
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#1A237E',
    fontWeight: 'bold',
  },
  achievementsContainer: {
    paddingHorizontal: responsiveSpacing(20),
    paddingBottom: responsiveSpacing(10),
  },
  achievementsList: {
    flex: 1,
  },
  achievementsContentContainer: {
    paddingBottom: responsiveSpacing(40),
    paddingTop: responsiveSpacing(5),
  },
  achievementCard: {
    borderRadius: responsiveSize(15),
    padding: responsiveSpacing(15),
    marginBottom: responsiveSpacing(15),
    borderWidth: responsiveSize(2),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    })
  },
  achievementUnlocked: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      }
    })
  },
  achievementLocked: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: '#666666',
    opacity: 0.7,
  },
  newAchievementCard: {
    borderColor: '#FF4444',
    borderWidth: responsiveSize(3),
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  newAchievementIndicator: {
    position: 'absolute',
    top: responsiveSpacing(-5),
    right: responsiveSpacing(-5),
    backgroundColor: '#FF4444',
    borderRadius: responsiveSize(12),
    paddingHorizontal: responsiveSpacing(8),
    paddingVertical: responsiveSpacing(2),
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  newAchievementText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(10),
    fontWeight: 'bold',
  },
  newAchievementTitle: {
    color: '#FF4444',
    textShadowColor: 'rgba(255,68,68,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tapHint: {
    position: 'absolute',
    bottom: responsiveSpacing(-8),
    right: responsiveSpacing(10),
    backgroundColor: 'rgba(255,68,68,0.9)',
    paddingHorizontal: responsiveSpacing(8),
    paddingVertical: responsiveSpacing(2),
    borderRadius: responsiveSize(8),
  },
  tapHintText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(10),
    fontWeight: '500',
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: responsiveSpacing(10),
  },
  achievementIcon: {
    fontSize: responsiveFont(40),
    marginRight: responsiveSpacing(15),
  },
  lockedIcon: {
    opacity: 0.5,
  },
  achievementInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing(5),
  },
  achievementTitle: {
    color: '#FFD700',
    fontSize: responsiveFont(18),
    fontWeight: 'bold',
    flex: 1,
  },
  rarityBadge: {
    paddingHorizontal: responsiveSpacing(6),
    paddingVertical: responsiveSpacing(2),
    borderRadius: responsiveSize(8),
    marginLeft: responsiveSpacing(8),
  },
  rarityText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(10),
    fontWeight: 'bold',
  },
  achievementDescription: {
    color: '#FFFFFF',
    fontSize: responsiveFont(14),
    opacity: 0.9,
    lineHeight: responsiveFont(20),
  },
  lockedText: {
    opacity: 0.5,
    color: '#CCCCCC',
  },
  checkmarkBadge: {
    width: responsiveSize(30),
    height: responsiveSize(30),
    backgroundColor: '#4CAF50',
    borderRadius: responsiveSize(15),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: responsiveSize(2),
    borderColor: '#FFFFFF',
  },
  achievementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: responsiveSpacing(10),
    paddingVertical: responsiveSpacing(4),
    borderRadius: responsiveSize(10),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  categoryText: {
    color: '#FFD700',
    fontSize: responsiveFont(12),
    fontWeight: '600',
  },
  unlockDate: {
    color: '#FFFFFF',
    fontSize: responsiveFont(12),
    opacity: 0.7,
  },
  lockedIndicator: {
    color: '#666666',
    fontSize: responsiveFont(12),
    fontWeight: '500',
  },
  emptyState: {
    padding: responsiveSpacing(40),
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyStateText: {
    color: '#FFFFFF',
    fontSize: responsiveFont(16),
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: responsiveFont(24),
    marginTop: responsiveSpacing(15),
  },
});

export default AchievementModal;