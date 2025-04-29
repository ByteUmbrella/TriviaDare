import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import iapManager, { PACK_TO_PRODUCT_MAP } from './IAPManager';

// Define lazy loading functions for packs to improve startup time on Android
const getGenericPacks = () => ({
  entertainment: {
    easy: require('../Packs/TriviaDare/GenericPacks/Entertainmenteasy.json'),
  },
  science: {
    easy: require('../Packs/TriviaDare/GenericPacks/Scienceeasy.json'),
  },
  history: {
    easy: require('../Packs/TriviaDare/GenericPacks/Historyeasy.json'),
  },
  sports: {
    easy: require('../Packs/TriviaDare/GenericPacks/Sportseasy.json'),
  },
  art: {
    easy: require('../Packs/TriviaDare/GenericPacks/Arteasy.json'),
  },
  geography: {
    easy: require('../Packs/TriviaDare/GenericPacks/Geographyeasy.json'),
  },
  music: {
    easy: require('../Packs/TriviaDare/GenericPacks/Musiceasy.json'),
  },
  technology: {
    easy: require('../Packs/TriviaDare/GenericPacks/Technologyeasy.json'),
  }
});

const getPremiumPacks = () => ({
  harrypotter: {
    easy: require('../Packs/TriviaDare/PremiumPacks/harrypottereasy.json'),
  },
  friends: {
    easy: require('../Packs/TriviaDare/PremiumPacks/friendseasy.json'),
  },
  starwars: {
    easy: require('../Packs/TriviaDare/PremiumPacks/starwarseasy.json'),
  },
  disneyanimatedmovies: {
    easy: require('../Packs/TriviaDare/PremiumPacks/disneyanimatedmovieseasy.json'),
  },
  thelordoftherings: {
    easy: require('../Packs/TriviaDare/PremiumPacks/thelordoftheringseasy.json'),
  },
  pixar: {
    easy: require('../Packs/TriviaDare/PremiumPacks/pixareasy.json'),
  },
  videogames: {
    easy: require('../Packs/TriviaDare/PremiumPacks/videogameseasy.json'),
  },
  howimetyourmother: {
    easy: require('../Packs/TriviaDare/PremiumPacks/howimetyourmothereasy.json'),
  },
  theoffice: {
    easy: require('../Packs/TriviaDare/PremiumPacks/theofficeeasy.json'),
  },
  themepark: {
    easy: require('../Packs/TriviaDare/PremiumPacks/themeparkeasy.json'),
  },
  marvelcinamaticuniverse: {
    easy: require('../Packs/TriviaDare/PremiumPacks/marvelcinamaticuniverseeasy.json'),
  }
});

// Modified to only include 'easy' for now, but keeps expandability
export const DIFFICULTIES = ['easy'];

// Cache configuration - adjust for Android performance
const CACHE_CONFIG = {
  expirationTime: Platform.OS === 'android' ? 1000 * 60 * 120 : 1000 * 60 * 60, // 2 hours for Android, 1 hour for iOS
  cachePrefix: 'trivia_cache_',
  chunkSize: Platform.OS === 'android' ? 50 : 100, // Smaller chunks for Android
};

// JSON Schema for validation
const QUESTION_SCHEMA = {
  requiredFields: [
    'Question ID',
    'Question Text',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer',
    'Difficulty'
  ],
  correctAnswerOptions: ['Option A', 'Option B', 'Option C', 'Option D'],
  difficultyOptions: ['Easy', 'Medium', 'Hard', 'Impossible']
};

// Error types for better error handling
const ErrorTypes = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MALFORMED_JSON: 'MALFORMED_JSON',
  CACHE_ERROR: 'CACHE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Default prices for display purposes (will be replaced with actual IAP later)
const DEFAULT_PRICES = {
  'harrypotter': '$3.99',
  'marvelcinamaticuniverse': '$3.99',
  'starwars': '$3.99',
  'disneyanimatedmovies': '$3.99',
  'thelordoftherings': '$3.99',
  'pixar': '$3.99',
  'friends': '$3.99',
  'videogames': '$3.99',
  'howimetyourmother': '$3.99',
  'theoffice': '$3.99',
  'themepark': '$3.99',
};

// Featured packs rotation system
const FEATURED_ROTATION = {
  // Time in milliseconds between featured pack rotations (3 days)
  rotationInterval: 1000 * 60 * 60 * 24 * 3,
  
  // Get the featured packs based on current time or manual override
  async getFeaturedPacks() {
    try {
      // Check for manual override first
      const manualOverrideJson = await AsyncStorage.getItem('trivia_featured_override');
      if (manualOverrideJson) {
        const override = JSON.parse(manualOverrideJson);
        
        // Check if override is still active
        if (override.expiryDate && new Date(override.expiryDate) > new Date()) {
          return override.featuredPacks;
        } else {
          // Clean up expired override
          await AsyncStorage.removeItem('trivia_featured_override');
        }
      }
      
      // Calculate featured packs based on time if no override
      const timeBasedFeatured = this.calculateTimeFeaturedPacks();
      return timeBasedFeatured;
    } catch (error) {
      console.warn('Error getting featured packs:', error);
      // Fallback to default featured
      return ['harrypotter', 'marvelcinamaticuniverse'];
    }
  },
  
  // Calculate featured packs based on time (2 packs every 3 days)
  calculateTimeFeaturedPacks() {
    const premiumPackIds = TRIVIA_PACKS.Premium.map(pack => pack.id);
    const now = new Date().getTime();
    const cyclePosition = Math.floor(now / this.rotationInterval) % Math.floor(premiumPackIds.length / 2);
    
    // Get 2 packs for the current cycle
    return [
      premiumPackIds[cyclePosition * 2],
      premiumPackIds[cyclePosition * 2 + 1]
    ];
  },
  
  // Set manual override for featured packs
  async setFeaturedPacksOverride(packIds, durationDays = 7) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);
      
      const override = {
        featuredPacks: packIds,
        expiryDate: expiryDate.toISOString()
      };
      
      await AsyncStorage.setItem('trivia_featured_override', JSON.stringify(override));
      return true;
    } catch (error) {
      console.warn('Error setting featured packs override:', error);
      return false;
    }
  },
  
  // Clear manual override
  async clearFeaturedPacksOverride() {
    try {
      await AsyncStorage.removeItem('trivia_featured_override');
      return true;
    } catch (error) {
      console.warn('Error clearing featured packs override:', error);
      return false;
    }
  }
};

// Beta mode management system
const BetaSystem = {
  // Set beta mode flag
  async setBetaMode(enabled) {
    try {
      await AsyncStorage.setItem('trivia_beta_mode', JSON.stringify({ enabled }));
      return true;
    } catch (error) {
      console.warn('Error setting beta mode:', error);
      return false;
    }
  },
  
  // Check if beta mode is enabled
  async isBetaMode() {
    try {
      const betaJson = await AsyncStorage.getItem('trivia_beta_mode');
      if (!betaJson) return false;
      
      const beta = JSON.parse(betaJson);
      return beta.enabled === true;
    } catch (error) {
      console.warn('Error checking beta mode:', error);
      return false;
    }
  },
  
  // Get a list of packs that should be unlocked in beta mode or purchased
  async getUnlockedPacks() {
    const isBeta = await this.isBetaMode();
    
    if (isBeta) {
      // In beta mode, all premium packs are unlocked
      return TRIVIA_PACKS.Premium.map(pack => pack.id);
    }
    
    // Get purchased packs from IAP Manager
    try {
      // Initialize IAP if not initialized
      if (!iapManager.isInitialized) {
        await iapManager.initialize();
      }
      
      const purchasedPacks = await iapManager.getPurchasedPacks();
      return purchasedPacks;
    } catch (error) {
      console.warn('Error getting purchased packs:', error);
      return [];
    }
  },
  
  // Check if a specific pack is unlocked
  async isPackUnlocked(packId) {
    const isBeta = await this.isBetaMode();
    
    // Basic packs are always unlocked
    const isBasic = TRIVIA_PACKS.Basic.some(p => p.id === packId);
    if (isBasic) {
      return true;
    }
    
    // In beta mode, all premium packs are unlocked
    if (isBeta) {
      return true;
    }
    
    // Otherwise, check if it's been purchased
    try {
      // Initialize IAP if not initialized
      if (!iapManager.isInitialized) {
        await iapManager.initialize();
      }
      
      return await iapManager.isPackPurchased(packId);
    } catch (error) {
      console.warn(`Error checking if pack ${packId} is unlocked:`, error);
      return false;
    }
  }
};

// Complete Trivia Packs Configuration
export const TRIVIA_PACKS = {
  Basic: [
    {
      id: 'entertainment',
      name: 'Entertainment',
      image: require('../assets/TriviaPackSelection/entertainment.jpeg'),
      description: 'Questions about movies, TV shows, and more.',
      enabled: true,
      category: 'General',
      tags: ['general', 'entertainment']
    },
    {
      id: 'science',
      name: 'Science',
      image: require('../assets/TriviaPackSelection/science.jpeg'),
      description: 'Explore the wonders of science.',
      enabled: true,
      category: 'General',
      tags: ['general', 'science', 'educational']
    },
    {
      id: 'history',
      name: 'History',
      image: require('../assets/TriviaPackSelection/history.png'),
      description: 'Dive into historical events and figures.',
      enabled: true,
      category: 'General',
      tags: ['general', 'history', 'educational']
    },
    {
      id: 'sports',
      name: 'Sports',
      image: require('../assets/TriviaPackSelection/sports.jpeg'),
      description: 'Challenge your sports knowledge.',
      enabled: true,
      category: 'General',
      tags: ['general', 'sports']
    },
    {
      id: 'art',
      name: 'Art & Literature',
      image: require('../assets/TriviaPackSelection/artliterature.jpeg'),
      description: 'Questions on art, books, and literature.',
      enabled: true,
      category: 'General',
      tags: ['general', 'art', 'literature', 'educational']
    },
    {
      id: 'geography',
      name: 'Geography',
      image: require('../assets/TriviaPackSelection/geography.jpeg'),
      description: 'Test your knowledge of the world.',
      enabled: true,
      category: 'General',
      tags: ['general', 'geography', 'educational']
    },
    {
      id: 'music',
      name: 'Music',
      image: require('../assets/TriviaPackSelection/music.jpeg'),
      description: 'Questions about music and artists.',
      enabled: true,
      category: 'General',
      tags: ['general', 'music']
    },
    {
      id: 'technology',
      name: 'Technology',
      image: require('../assets/TriviaPackSelection/tech.jpeg'),
      description: 'Explore the world of technology.',
      enabled: true,
      category: 'General',
      tags: ['general', 'technology', 'educational']
    }
  ],
  Premium: [
    {
      id: 'harrypotter',
      name: 'Harry Potter Movies',
      image: require('../assets/TriviaPackSelection/hogwarts.jpg'),
      description: 'Questions about the Harry Potter movie series.',
      enabled: true,
      category: 'Movies',
      tags: ['movies', 'fantasy', 'magic', 'harry potter'],
      defaultPrice: '$3.99',
      featured: true,
      isPopular: true
    },
    {
      id: 'marvelcinamaticuniverse',
      name: 'Marvel Cinematic Universe',
      image: require('../assets/TriviaPackSelection/mcu.jpg'),
      description: 'Assemble your knowledge of the MCU!',
      enabled: true,
      category: 'Movies',
      tags: ['movies', 'superheroes', 'marvel', 'action'],
      defaultPrice: '$3.99',
      isPopular: true,
      dateAdded: '2023-12-01'
    },
    {
      id: 'starwars',
      name: 'Star Wars',
      image: require('../assets/TriviaPackSelection/starwars.webp'),
      description: 'Queue the John Williams Score... All Movies!',
      enabled: true,
      category: 'Movies',
      tags: ['movies', 'sci-fi', 'space', 'star wars'],
      defaultPrice: '$3.99',
      isPopular: true
    },
    {
      id: 'disneyanimatedmovies',
      name: 'Disney Animated Movies',
      image: require('../assets/TriviaPackSelection/disneyanimated.jpg'),
      description: 'Test your knowledge of Disney animated classics!',
      enabled: true,
      category: 'Movies',
      tags: ['movies', 'animation', 'disney', 'family'],
      defaultPrice: '$3.99',
      featured: true
    },
    {
      id: 'thelordoftherings',
      name: 'The Lord of the Rings',
      image: require('../assets/TriviaPackSelection/lotr.jpg'),
      description: 'Journey through Middle-earth with these LOTR questions.',
      enabled: true,
      category: 'Movies',
      tags: ['movies', 'fantasy', 'adventure', 'lotr'],
      defaultPrice: '$3.99'
    },
    {
      id: 'pixar',
      name: 'Pixar Movies',
      image: require('../assets/TriviaPackSelection/pixar.jpg'),
      description: 'From Toy Story to beyond - test your Pixar knowledge!',
      enabled: true,
      category: 'Movies',
      tags: ['movies', 'animation', 'pixar', 'family'],
      defaultPrice: '$3.99'
    },
    {
      id: 'friends',
      name: 'Friends Sitcom',
      image: require('../assets/TriviaPackSelection/friends.jpg'),
      description: 'Trivia about the Friends TV show.',
      enabled: true,
      category: 'TV',
      tags: ['tv', 'sitcom', 'comedy', 'friends'],
      defaultPrice: '$3.99',
      isNew: true,
      dateAdded: '2024-02-15'
    },
    {
      id: 'videogames',
      name: 'Video Games',
      image: require('../assets/TriviaPackSelection/videogames.jpg'),
      description: 'Level up your gaming knowledge!',
      enabled: true,
      category: 'Games',
      tags: ['games', 'video games', 'gaming'],
      defaultPrice: '$3.99',
      isNew: true,
      dateAdded: '2024-02-01'
    },
    {
      id: 'howimetyourmother',
      name: 'How I Met Your Mother',
      image: require('../assets/TriviaPackSelection/himym.jpg'),
      description: 'Challenge yourself with HIMYM trivia!',
      enabled: true,
      category: 'TV',
      tags: ['tv', 'sitcom', 'comedy', 'himym'],
      defaultPrice: '$3.99'
    },
    {
      id: 'theoffice',
      name: 'The Office',
      image: require('../assets/TriviaPackSelection/office.jpg'),
      description: 'That\'s what she said! Test your Office knowledge.',
      enabled: true,
      category: 'TV',
      tags: ['tv', 'sitcom', 'comedy', 'office'],
      defaultPrice: '$3.99'
    },
    {
      id: 'themepark',
      name: 'Theme Parks',
      image: require('../assets/TriviaPackSelection/themepark.jpg'),
      description: 'Trivia about the world\'s most famous theme parks',
      enabled: true,
      category: 'Other',
      tags: ['theme parks', 'attractions', 'disney', 'universal'],
      defaultPrice: '$3.99',
      isNew: true,
      dateAdded: '2024-01-10'
    }
  ]
};

// Optimized cache management with chunking for Android
const PackCache = {
  async set(key, data) {
    try {
      // For large datasets on Android, chunk the data
      if (Platform.OS === 'android' && Array.isArray(data) && data.length > CACHE_CONFIG.chunkSize) {
        const chunks = [];
        for (let i = 0; i < data.length; i += CACHE_CONFIG.chunkSize) {
          chunks.push(data.slice(i, i + CACHE_CONFIG.chunkSize));
        }
        
        // Store chunk info
        const chunkInfo = {
          isChunked: true,
          timestamp: Date.now(),
          totalChunks: chunks.length,
          totalItems: data.length
        };
        
        await AsyncStorage.setItem(
          `${CACHE_CONFIG.cachePrefix}${key}_info`,
          JSON.stringify(chunkInfo)
        );
        
        // Store each chunk separately
        for (let i = 0; i < chunks.length; i++) {
          await AsyncStorage.setItem(
            `${CACHE_CONFIG.cachePrefix}${key}_chunk_${i}`,
            JSON.stringify({
              timestamp: Date.now(),
              data: chunks[i]
            })
          );
        }
      } else {
        // Regular caching for small datasets or iOS
        const cacheData = {
          timestamp: Date.now(),
          data: data
        };
        await AsyncStorage.setItem(
          `${CACHE_CONFIG.cachePrefix}${key}`,
          JSON.stringify(cacheData)
        );
      }
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  },

  async get(key) {
    try {
      // Check if this is a chunked cache
      const chunkInfoJson = await AsyncStorage.getItem(`${CACHE_CONFIG.cachePrefix}${key}_info`);
      
      if (chunkInfoJson) {
        const chunkInfo = JSON.parse(chunkInfoJson);
        
        // Check expiration
        if (Date.now() - chunkInfo.timestamp > CACHE_CONFIG.expirationTime) {
          await this.removeChunkedCache(key, chunkInfo.totalChunks);
          return null;
        }
        
        // Reassemble chunked data
        let allData = [];
        for (let i = 0; i < chunkInfo.totalChunks; i++) {
          const chunkJson = await AsyncStorage.getItem(`${CACHE_CONFIG.cachePrefix}${key}_chunk_${i}`);
          if (!chunkJson) continue;
          
          const chunk = JSON.parse(chunkJson);
          allData = [...allData, ...chunk.data];
        }
        
        // Verify we have all data
        if (allData.length !== chunkInfo.totalItems) {
          console.warn('Cache reconstruction incomplete, missing items');
          await this.removeChunkedCache(key, chunkInfo.totalChunks);
          return null;
        }
        
        return allData;
      }
      
      // Regular cache handling
      const cached = await AsyncStorage.getItem(`${CACHE_CONFIG.cachePrefix}${key}`);
      if (!cached) return null;

      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_CONFIG.expirationTime) {
        await AsyncStorage.removeItem(`${CACHE_CONFIG.cachePrefix}${key}`);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('Cache get failed:', error);
      return null;
    }
  },
  
  async removeChunkedCache(key, totalChunks) {
    try {
      await AsyncStorage.removeItem(`${CACHE_CONFIG.cachePrefix}${key}_info`);
      for (let i = 0; i < totalChunks; i++) {
        await AsyncStorage.removeItem(`${CACHE_CONFIG.cachePrefix}${key}_chunk_${i}`);
      }
    } catch (error) {
      console.warn('Error removing chunked cache:', error);
    }
  },

  async clear() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_CONFIG.cachePrefix));
      
      // For Android, we remove in batches to avoid performance issues
      if (Platform.OS === 'android' && cacheKeys.length > 50) {
        const batches = [];
        for (let i = 0; i < cacheKeys.length; i += 50) {
          batches.push(cacheKeys.slice(i, i + 50));
        }
        
        for (const batch of batches) {
          await AsyncStorage.multiRemove(batch);
        }
      } else {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }
};

// Helper function with improved error handling for Android
const getPackFile = (packId, difficulty = 'easy', isBasic) => {
  try {
    // Lazy load pack files to improve performance
    const packGroup = isBasic ? getGenericPacks() : getPremiumPacks();
    const packData = packGroup[packId]?.['easy'];
    
    if (!packData) {
      return {
        success: false,
        data: null,
        error: `Pack file not found for ${packId}`
      };
    }

    if (!packData.Sheet1 || !Array.isArray(packData.Sheet1)) {
      return {
        success: false,
        data: null,
        error: 'Invalid pack format'
      };
    }

    return {
      success: true,
      data: packData.Sheet1,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message || 'Unknown error loading pack'
    };
  }
};

// Check if a premium pack should be enabled based on beta status or purchase
export const checkPremiumPackAvailability = async (packId) => {
  return await BetaSystem.isPackUnlocked(packId);
};

// Pack statistics function with Android optimizations
export const getPackStatistics = async (packId) => {
  try {
    const stats = {
      total: 0,
      byDifficulty: {},
      usedQuestions: {},
      completionRates: {},
      unusedQuestions: {}
    };

    const storageKey = `${packId}_used`;
    const usedQuestionsData = await AsyncStorage.getItem(storageKey);
    const usedQuestions = usedQuestionsData ? JSON.parse(usedQuestionsData) : {};
    stats.usedQuestions['easy'] = Object.keys(usedQuestions).length;

    const pack = [...TRIVIA_PACKS.Basic, ...TRIVIA_PACKS.Premium]
      .find(p => p.id === packId);
    
    if (pack) {
      const isBasic = TRIVIA_PACKS.Basic.some(p => p.id === packId);
      
      // Try to get from cache first
      const cacheKey = `pack_stats_${packId}`;
      const cachedStats = await PackCache.get(cacheKey);
      
      if (cachedStats && Platform.OS === 'android') {
        // For Android, prioritize cache to reduce JSON parsing overhead
        Object.assign(stats.byDifficulty, cachedStats.byDifficulty);
        stats.total = cachedStats.total;
        
        // Only compute the dynamic parts
        const usedCount = stats.usedQuestions['easy'] || 0;
        stats.unusedQuestions['easy'] = stats.byDifficulty['easy'] - usedCount;
        stats.completionRates['easy'] = (usedCount / stats.byDifficulty['easy']) * 100;
        
        return stats;
      }
      
      // No cache hit, compute fresh
      const result = getPackFile(pack.id, 'easy', isBasic);
      
      if (result.success) {
        const totalQuestions = result.data.length;
        const usedCount = stats.usedQuestions['easy'] || 0;
        
        stats.byDifficulty['easy'] = totalQuestions;
        stats.total = totalQuestions;
        stats.unusedQuestions['easy'] = totalQuestions - usedCount;
        stats.completionRates['easy'] = (usedCount / totalQuestions) * 100;
        
        // Cache the stats for future use
        await PackCache.set(cacheKey, {
          byDifficulty: stats.byDifficulty,
          total: stats.total
        });
      }
    }

    return stats;
  } catch (error) {
    console.error(`Error getting statistics for ${packId}:`, error);
    return {
      total: 0,
      byDifficulty: {},
      usedQuestions: {},
      completionRates: {},
      unusedQuestions: {}
    };
  }
};

// Pack availability function with caching
export const checkPackAvailability = async (pack) => {
  try {
    // Try to get from cache first to improve Android performance
    const cacheKey = `pack_avail_${pack.id}`;
    const cachedAvailability = await PackCache.get(cacheKey);
    
    if (cachedAvailability && Platform.OS === 'android') {
      const stats = await getPackStatistics(pack.id);
      
      // Check if pack is unlocked in beta mode or purchased
      const isUnlocked = await BetaSystem.isPackUnlocked(pack.id);
      
      return {
        ...cachedAvailability,
        stats,
        purchased: isUnlocked,
        price: isUnlocked ? null : pack.defaultPrice || DEFAULT_PRICES[pack.id]
      };
    }
    
    const isBasic = TRIVIA_PACKS.Basic.some(p => p.id === pack.id);
    const result = getPackFile(pack.id, 'easy', isBasic);
    const stats = await getPackStatistics(pack.id);
    
    // Check if pack is unlocked in beta mode or purchased
    const isUnlocked = await BetaSystem.isPackUnlocked(pack.id);

    const availability = {
      isAvailable: result.success,
      availableDifficulties: ['easy'],
      questionCounts: {
        total: result.success ? result.data.length : 0,
        byDifficulty: {
          easy: result.success ? result.data.length : 0
        }
      },
      validationErrors: result.success ? [] : [result.error],
      purchased: isUnlocked,
      price: isUnlocked ? null : pack.defaultPrice || DEFAULT_PRICES[pack.id]
    };
    
    // Cache availability info (excluding purchased info which could change)
    const cacheData = {
      isAvailable: availability.isAvailable,
      availableDifficulties: availability.availableDifficulties,
      questionCounts: availability.questionCounts,
      validationErrors: availability.validationErrors
    };
    await PackCache.set(cacheKey, cacheData);
    
    return {
      ...availability,
      stats
    };
  } catch (error) {
    console.error(`Error checking availability for ${pack.name}:`, error);
    return {
      isAvailable: false,
      availableDifficulties: [],
      questionCounts: { total: 0, byDifficulty: {} },
      validationErrors: [error.message || 'Unknown error checking availability'],
      stats: { total: 0, byDifficulty: {}, usedQuestions: {} },
      purchased: false,
      price: pack.defaultPrice || DEFAULT_PRICES[pack.id]
    };
  }
};

export const loadPackQuestions = async (packName, difficulty = 'easy') => {
  try {
    const pack = [...TRIVIA_PACKS.Basic, ...TRIVIA_PACKS.Premium]
      .find(p => p.name === packName);
    
    if (!pack) {
      throw new Error(`Pack "${packName}" not found`);
    }

    // Check if this is a premium pack and needs purchase verification
    const isPremium = TRIVIA_PACKS.Premium.some(p => p.name === packName);
    
    if (isPremium) {
      // Initialize IAP if needed
      if (!iapManager.isInitialized) {
        await iapManager.initialize();
      }
      
      // Check if beta mode is enabled
      const isBetaMode = await BetaSystem.isBetaMode();
      
      // If not in beta mode, verify purchase
      if (!isBetaMode) {
        const isPurchased = await iapManager.isPackPurchased(pack.id);
        
        // If not purchased, return an error
        if (!isPurchased) {
          return {
            success: false,
            data: [],
            error: 'This premium pack requires purchase',
            source: null,
            requiresPurchase: true
          };
        }
      }
    }

    // Try to get from cache first
    const cacheKey = `pack_questions_${pack.id}`;
    const cachedQuestions = await PackCache.get(cacheKey);
    
    if (cachedQuestions) {
      return {
        success: true,
        data: cachedQuestions,
        error: null,
        source: 'cache'
      };
    }
    
    const isBasic = TRIVIA_PACKS.Basic.some(p => p.name === packName);
    const result = getPackFile(pack.id, 'easy', isBasic);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Cache the questions for future use
    await PackCache.set(cacheKey, result.data);

    return {
      success: true,
      data: result.data,
      error: null,
      source: 'file'
    };
  } catch (error) {
    console.error('Error loading pack questions:', error);
    return {
      success: false,
      data: [],
      error: error.message || 'Unknown error loading questions',
      source: null
    };
  }
};

export const markQuestionAsUsed = async (packId, questionId) => {
  try {
    const storageKey = `${packId}_used`;
    const usedQuestionsData = await AsyncStorage.getItem(storageKey);
    const usedQuestions = usedQuestionsData ? JSON.parse(usedQuestionsData) : {};
    
    usedQuestions[questionId] = true;
    await AsyncStorage.setItem(storageKey, JSON.stringify(usedQuestions));
    
    return true;
  } catch (error) {
    console.error('Error marking question as used:', error);
    return false;
  }
};

export const resetPackProgress = async (packId) => {
  try {
    await AsyncStorage.removeItem(`${packId}_used`);
    return true;
  } catch (error) {
    console.error('Error resetting pack progress:', error);
    return false;
  }
};

// Get currently featured packs
export const getFeaturedPacks = async () => {
  return await FEATURED_ROTATION.getFeaturedPacks();
};

// Set manual featured pack override
export const setFeaturedPacksOverride = async (packIds, durationDays = 7) => {
  return await FEATURED_ROTATION.setFeaturedPacksOverride(packIds, durationDays);
};

// Clear manual featured pack override
export const clearFeaturedPacksOverride = async () => {
  return await FEATURED_ROTATION.clearFeaturedPacksOverride();
};

// Set beta mode status
export const setBetaMode = async (enabled) => {
  return await BetaSystem.setBetaMode(enabled);
};

// Check if beta mode is enabled
export const isBetaMode = async () => {
  return await BetaSystem.isBetaMode();
};

// Get all packs unlocked in beta mode or purchased
export const getUnlockedPacks = async () => {
  return await BetaSystem.getUnlockedPacks();
};

// Check if a specific pack has been purchased
export const isPackPurchased = async (packId) => {
  // Initialize IAP if not initialized
  if (!iapManager.isInitialized) {
    await iapManager.initialize();
  }
  
  return await iapManager.isPackPurchased(packId);
};

// Purchase a pack
export const purchasePack = async (packId) => {
  // Initialize IAP if not initialized
  if (!iapManager.isInitialized) {
    await iapManager.initialize();
  }
  
  const productId = PACK_TO_PRODUCT_MAP[packId];
  if (!productId) {
    return {
      success: false,
      error: 'Invalid pack ID'
    };
  }
  
  try {
    const result = await iapManager.purchaseProduct(productId);
    return {
      success: result,
      error: result ? null : 'Purchase failed'
    };
  } catch (error) {
    console.error('Error purchasing pack:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during purchase'
    };
  }
};

// Restore purchases
export const restorePurchases = async () => {
  // Initialize IAP if not initialized
  if (!iapManager.isInitialized) {
    await iapManager.initialize();
  }
  
  try {
    const result = await iapManager.restorePurchases();
    return {
      success: result,
      error: result ? null : 'No purchases to restore'
    };
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return {
      success: false,
      error: error.message || 'Unknown error restoring purchases'
    };
  }
};

// Default export with all functions
export default {
  DIFFICULTIES,
  TRIVIA_PACKS,
  checkPackAvailability,
  checkPremiumPackAvailability,
  getPackStatistics,
  loadPackQuestions,
  markQuestionAsUsed,
  resetPackProgress,
  getFeaturedPacks,
  setFeaturedPacksOverride,
  clearFeaturedPacksOverride,
  setBetaMode,
  isBetaMode,
  getUnlockedPacks,
  isPackPurchased,
  purchasePack,
  restorePurchases
};