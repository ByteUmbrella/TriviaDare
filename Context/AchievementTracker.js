import AsyncStorage from '@react-native-async-storage/async-storage';
import { unlockAchievement } from './AchievementModal';

class AchievementTracker {
  constructor() {
    this.gameStats = {
      // General game stats
      gamesPlayed: 0,
      currentCorrectStreak: 0,
      maxCorrectStreak: 0,
      uniquePlayers: new Set(),
      // NEW: Session tracking
      gamesInCurrentSession: 0,
      usedPacks: new Set(), // Track which packs have been used for games
      daresCompleted: 0,
      fastestAnswerTime: null,
      
      // NEW: Game mode specific tracking
      triviaOnlyGamesCompleted: 0,
      daresOnlyGamesCompleted: 0,
      triviaDareGamesCompleted: 0,
      
      // NEW: Perfect game tracking
      perfectGames: 0,
      currentGameWrongAnswers: 0, // Track wrong answers in current game
      
      // NEW: Pack purchase tracking
      purchasedPacks: new Set(), // Track purchased pack IDs
      
      // NEW: Quick dare tracking
      quickestDareTime: null,
      
      // NEW: Lightning answer tracking  
      lightningAnswerAchieved: false, // Track if under 2 seconds achieved
    };
  }

  // Load saved stats
  async loadStats() {
    try {
      const savedStats = await AsyncStorage.getItem('gameStats');
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        this.gameStats = {
          ...this.gameStats,
          ...parsed,
          uniquePlayers: new Set(parsed.uniquePlayers || []),
          purchasedPacks: new Set(parsed.purchasedPacks || []),
          usedPacks: new Set(parsed.usedPacks || [])
        };
      }
    } catch (error) {
      console.error('Error loading game stats:', error);
    }
  }

  // Save stats
  async saveStats() {
    try {
      const statsToSave = {
        ...this.gameStats,
        uniquePlayers: Array.from(this.gameStats.uniquePlayers),
        purchasedPacks: Array.from(this.gameStats.purchasedPacks),
        usedPacks: Array.from(this.gameStats.usedPacks)
      };
      await AsyncStorage.setItem('gameStats', JSON.stringify(statsToSave));
    } catch (error) {
      console.error('Error saving game stats:', error);
    }
  }

  // Achievement check functions
  async checkAndUnlockAchievements() {
    // First Game
    if (this.gameStats.gamesPlayed >= 1) {
      await unlockAchievement('first_game');
    }

    // Milestone achievements
    if (this.gameStats.gamesPlayed >= 10) {
      await unlockAchievement('trivia_master');
    }
    if (this.gameStats.gamesPlayed >= 25) {
      await unlockAchievement('games_25');
    }
    if (this.gameStats.gamesPlayed >= 50) {
      await unlockAchievement('games_50');
    }
    if (this.gameStats.gamesPlayed >= 100) {
      await unlockAchievement('games_100');
    }

    // Game mode specific achievements
    if (this.gameStats.daresOnlyGamesCompleted >= 1) {
      await unlockAchievement('dares_only');
      await unlockAchievement('dares_only_debut');
    }
    if (this.gameStats.daresOnlyGamesCompleted >= 10) {
      await unlockAchievement('dares_only_master');
    }
    
    if (this.gameStats.triviaOnlyGamesCompleted >= 1) {
      await unlockAchievement('trivia_only_debut');
    }
    if (this.gameStats.triviaOnlyGamesCompleted >= 10) {
      await unlockAchievement('trivia_only_master');
    }

    // Mixed Master - 5 games in each mode
    if (this.gameStats.triviaDareGamesCompleted >= 5 && 
        this.gameStats.triviaOnlyGamesCompleted >= 5 && 
        this.gameStats.daresOnlyGamesCompleted >= 5) {
      await unlockAchievement('mixed_master');
    }

    // Skill achievements
    if (this.gameStats.maxCorrectStreak >= 5) {
      await unlockAchievement('streak_5');
    }
    if (this.gameStats.maxCorrectStreak >= 10) {
      await unlockAchievement('streak_10');
    }
    if (this.gameStats.maxCorrectStreak >= 25) {
      await unlockAchievement('streak_25');
    }

    // Perfect game achievement
    if (this.gameStats.perfectGames >= 1) {
      await unlockAchievement('perfect_game');
    }

    // Speed achievements
    if (this.gameStats.fastestAnswerTime && this.gameStats.fastestAnswerTime < 3000) {
      await unlockAchievement('speed_demon');
    }
    if (this.gameStats.lightningAnswerAchieved) {
      await unlockAchievement('lightning_round');
    }

    // Dare achievements
    if (this.gameStats.daresCompleted >= 10) {
      await unlockAchievement('dare_enthusiast');
    }
    if (this.gameStats.daresCompleted >= 25) {
      await unlockAchievement('dare_master');
    }
    if (this.gameStats.daresCompleted >= 50) {
      await unlockAchievement('dare_legend');
    }

    // Quick dare achievement
    if (this.gameStats.quickestDareTime && this.gameStats.quickestDareTime < 10000) {
      await unlockAchievement('quick_dare');
    }

    // Session achievements
    if (this.gameStats.gamesInCurrentSession >= 3) {
      await unlockAchievement('session_player');
    }
    if (this.gameStats.gamesInCurrentSession >= 5) {
      await unlockAchievement('marathon_player');
    }

    // Pack exploration achievement
    if (this.gameStats.usedPacks.size >= 3) {
      await unlockAchievement('pack_explorer');
    }

    // Pack purchase achievements
    if (this.gameStats.purchasedPacks.size >= 1) {
      await unlockAchievement('pack_collector');
    }
    if (this.gameStats.purchasedPacks.size >= 3) {
      await unlockAchievement('pack_enthusiast');
    }
    if (this.gameStats.purchasedPacks.size >= 5) {
      await unlockAchievement('pack_library');
    }

    // Pack completionist (you'll need to define how many total packs exist)
    // For now, assuming 10 total packs - adjust this number based on your actual pack count
    const TOTAL_PACKS_AVAILABLE = 10;
    if (this.gameStats.purchasedPacks.size >= TOTAL_PACKS_AVAILABLE) {
      await unlockAchievement('pack_completionist');
    }

    // Completionist achievement - check if all other achievements are unlocked
    await this.checkCompletionistAchievement();
  }

  // NEW: Check if all other achievements are unlocked
  async checkCompletionistAchievement() {
    try {
      const { loadAchievements } = require('./AchievementModal');
      const achievements = await loadAchievements();
      
      // Count unlocked achievements excluding completionist itself
      const nonCompletionistAchievements = achievements.filter(a => a.id !== 'completionist');
      const unlockedNonCompletionist = nonCompletionistAchievements.filter(a => a.unlocked);
      
      // If all other achievements are unlocked, unlock completionist
      if (unlockedNonCompletionist.length === nonCompletionistAchievements.length) {
        await unlockAchievement('completionist');
      }
    } catch (error) {
      console.error('Error checking completionist achievement:', error);
    }
  }

  // Tracking methods

  // NEW: Game start with mode and pack tracking
  async trackGameStart(players, gameMode = 'TriviaDare', packName = null) {
    await this.loadStats();
    
    // Add unique players
    players.forEach(player => this.gameStats.uniquePlayers.add(player));
    
    // Track pack usage for pack explorer achievement
    if (packName) {
      this.gameStats.usedPacks.add(packName);
    }
    
    // Reset current game wrong answers counter
    this.gameStats.currentGameWrongAnswers = 0;
    
    await this.saveStats();
    await this.checkAndUnlockAchievements();
  }

  // NEW: Enhanced game completion with mode and session tracking
  async trackGameComplete(gameMode = 'TriviaDare') {
    await this.loadStats();
    
    this.gameStats.gamesPlayed++;
    this.gameStats.gamesInCurrentSession++;
    
    // Track by game mode
    switch(gameMode) {
      case 'DaresONLY':
        this.gameStats.daresOnlyGamesCompleted++;
        break;
      case 'TriviaONLY':
        this.gameStats.triviaOnlyGamesCompleted++;
        break;
      case 'TriviaDare':
      default:
        this.gameStats.triviaDareGamesCompleted++;
        break;
    }
    
    // Check if this was a perfect game (no wrong answers)
    if (this.gameStats.currentGameWrongAnswers === 0) {
      this.gameStats.perfectGames++;
    }
    
    await this.saveStats();
    await this.checkAndUnlockAchievements();
  }

  // Enhanced correct answer tracking with lightning detection
  async trackCorrectAnswer(answerTime) {
    await this.loadStats();
    
    this.gameStats.currentCorrectStreak++;
    this.gameStats.maxCorrectStreak = Math.max(
      this.gameStats.maxCorrectStreak, 
      this.gameStats.currentCorrectStreak
    );

    // Track fastest answer time
    if (!this.gameStats.fastestAnswerTime || answerTime < this.gameStats.fastestAnswerTime) {
      this.gameStats.fastestAnswerTime = answerTime;
    }

    // NEW: Check for lightning round (under 2 seconds = 2000ms)
    if (answerTime < 2000) {
      this.gameStats.lightningAnswerAchieved = true;
    }
    
    await this.saveStats();
    await this.checkAndUnlockAchievements();
  }

  // Enhanced incorrect answer tracking
  async trackIncorrectAnswer() {
    await this.loadStats();
    
    this.gameStats.currentCorrectStreak = 0; // Reset streak
    this.gameStats.currentGameWrongAnswers++; // Track for perfect game detection
    
    await this.saveStats();
  }

  // Enhanced dare completion with timing
  async trackDareCompleted(completionTime = null) {
    await this.loadStats();
    
    this.gameStats.daresCompleted++;
    
    // NEW: Track quickest dare time
    if (completionTime) {
      if (!this.gameStats.quickestDareTime || completionTime < this.gameStats.quickestDareTime) {
        this.gameStats.quickestDareTime = completionTime;
      }
    }
    
    await this.saveStats();
    await this.checkAndUnlockAchievements();
  }

  // NEW: Reset session counter (call when app starts)
  async trackNewSession() {
    await this.loadStats();
    
    this.gameStats.gamesInCurrentSession = 0;
    
    await this.saveStats();
  }

  // NEW: Pack purchase tracking
  async trackPackPurchase(packId) {
    await this.loadStats();
    
    // Add pack to purchased set (prevents duplicates)
    this.gameStats.purchasedPacks.add(packId);
    
    await this.saveStats();
    await this.checkAndUnlockAchievements();
  }

  // NEW: Get current stats for debugging/display
  async getCurrentStats() {
    await this.loadStats();
    return {
      ...this.gameStats,
      uniquePlayers: Array.from(this.gameStats.uniquePlayers),
      purchasedPacks: Array.from(this.gameStats.purchasedPacks),
      usedPacks: Array.from(this.gameStats.usedPacks)
    };
  }

  // NEW: Reset all stats (for testing/debugging)
  async resetAllStats() {
    this.gameStats = {
      gamesPlayed: 0,
      currentCorrectStreak: 0,
      maxCorrectStreak: 0,
      uniquePlayers: new Set(),
      daresCompleted: 0,
      fastestAnswerTime: null,
      triviaOnlyGamesCompleted: 0,
      daresOnlyGamesCompleted: 0,
      triviaDareGamesCompleted: 0,
      perfectGames: 0,
      currentGameWrongAnswers: 0,
      purchasedPacks: new Set(),
      quickestDareTime: null,
      lightningAnswerAchieved: false,
      gamesInCurrentSession: 0,
      usedPacks: new Set(),
    };
    
    await this.saveStats();
  }
}

export const achievementTracker = new AchievementTracker();