// Context/PromoCode.js - Local Promo Code Management for TriviaDARE
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PROMO_STORAGE_KEY = '@trivia_dare_promo_codes';
const PACK_VISIBILITY_KEY = '@trivia_dare_pack_visibility';

// Define PRODUCT_IDS directly here to avoid circular dependency
const PRODUCT_IDS = {
  PACK_HARRYPOTTER: Platform.select({
    ios: 'HarryPotter1',
    android: 'harrypotter1'
  }),
  PACK_MARVELCINAMATICUNIVERSE: Platform.select({
    ios: 'MarvelCinematicUniverse1',
    android: 'marvelcinamaticuniverse1'
  }),
  PACK_STARWARS: Platform.select({
    ios: 'StarWars1',
    android: 'starwars1'
  }),
  PACK_DISNEYANIMATEDMOVIES: Platform.select({
    ios: 'DisneyAnimatedMovies1',
    android: 'disneyanimatedmovies1'
  }),
  PACK_THELORDOFTHERINGS: Platform.select({
    ios: 'TheLordOfTheRings1',
    android: 'thelordoftherings1'
  }),
  PACK_PIXAR: Platform.select({
    ios: 'Pixar1',
    android: 'pixar1'
  }),
  PACK_FRIENDS: Platform.select({
    ios: 'Friends1',
    android: 'friends1'
  }),
  PACK_VIDEOGAMES: Platform.select({
    ios: 'VideoGames1',
    android: 'videogames1'
  }),
  PACK_HOWIMETYOURMOTHER: Platform.select({
    ios: 'HowIMetYourMother1',
    android: 'howimetyourmother1'
  }),
  PACK_THEOFFICE: Platform.select({
    ios: 'TheOffice1',
    android: 'theoffice1'
  }),
  PACK_THEMEPARK: Platform.select({
    ios: 'ThemePark1',
    android: 'themepark1'
  }),
  EVERYTHING_BUNDLE: Platform.select({
    ios: 'EverythingBundle1',
    android: 'everythingbundle1'
  }),
  DARES_SPICY: Platform.select({
    ios: 'DarePack3',
    android: 'darepack2'
  }),
  DARES_HOUSEPARTY: Platform.select({
    ios: 'DarePack2',
    android: 'darepack3'
  }),
  DARES_COUPLES: Platform.select({
    ios: 'DarePack1',
    android: 'darepack1'
  }),
  DARES_BAR: Platform.select({
    ios: 'DarePack4',
    android: 'darepack4'
  })
};

// Promo codes for each IAP product - customize these codes as needed
const PROMO_CODES = {
  // === TRIVIA PACKS ===
  [PRODUCT_IDS.PACK_HARRYPOTTER]: {
    standardCode: 'HARRY20',
    standardMaxUses: 20,
    alwaysCode: 'POTTER',
    packName: 'Harry Potter Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_MARVELCINAMATICUNIVERSE]: {
    standardCode: 'MARVEL50',
    standardMaxUses: 50,
    alwaysCode: 'AVENGERS',
    packName: 'Marvel Cinematic Universe Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_STARWARS]: {
    standardCode: 'JEDI25',
    standardMaxUses: 25,
    alwaysCode: 'FORCE',
    packName: 'Star Wars Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_DISNEYANIMATEDMOVIES]: {
    standardCode: 'DISNEY30',
    standardMaxUses: 30,
    alwaysCode: 'MAGIC',
    packName: 'Disney Animated Movies Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_THELORDOFTHERINGS]: {
    standardCode: 'LOTR15',
    standardMaxUses: 15,
    alwaysCode: 'GANDALF',
    packName: 'The Lord of the Rings Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_PIXAR]: {
    standardCode: 'PIXAR40',
    standardMaxUses: 40,
    alwaysCode: 'TOYSTORY',
    packName: 'Pixar Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_FRIENDS]: {
    standardCode: 'FRIENDS35',
    standardMaxUses: 35,
    alwaysCode: 'CENTRAL',
    packName: 'Friends Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_VIDEOGAMES]: {
    standardCode: 'GAMER20',
    standardMaxUses: 20,
    alwaysCode: 'PLAYER1',
    packName: 'Video Games Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_HOWIMETYOURMOTHER]: {
    standardCode: 'HIMYM25',
    standardMaxUses: 25,
    alwaysCode: 'LEGENDARY',
    packName: 'How I Met Your Mother Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_THEOFFICE]: {
    standardCode: 'OFFICE30',
    standardMaxUses: 30,
    alwaysCode: 'SCRANTON',
    packName: 'The Office Pack',
    packType: 'trivia'
  },
  [PRODUCT_IDS.PACK_THEMEPARK]: {
    standardCode: 'PARK20',
    standardMaxUses: 20,
    alwaysCode: 'RIDES',
    packName: 'Theme Park Pack',
    packType: 'trivia'
  },
  
  // === DARES PACKS ===
  [PRODUCT_IDS.DARES_SPICY]: {
    standardCode: 'SPICY20',
    standardMaxUses: 20,
    alwaysCode: 'HOT',
    packName: 'Spicy Dares Pack',
    packType: 'dares'
  },
  [PRODUCT_IDS.DARES_HOUSEPARTY]: {
    standardCode: 'PARTY25',
    standardMaxUses: 25,
    alwaysCode: 'LEGEND',
    packName: 'House Party Dares Pack',
    packType: 'dares'
  },
  [PRODUCT_IDS.DARES_COUPLES]: {
    standardCode: 'LOVE15',
    standardMaxUses: 15,
    alwaysCode: 'ROMANCE',
    packName: 'Couples Dares Pack',
    packType: 'dares'
  },
  [PRODUCT_IDS.DARES_BAR]: {
    standardCode: 'BAR30',
    standardMaxUses: 30,
    alwaysCode: 'DRINKS',
    packName: 'Bar Dares Pack',
    packType: 'dares'
  },
  
  // === EVERYTHING BUNDLE ===
  [PRODUCT_IDS.EVERYTHING_BUNDLE]: {
    standardCode: 'BUNDLE100',
    standardMaxUses: 100,
    alwaysCode: 'EVERYTHING',
    packName: 'Everything Bundle',
    packType: 'bundle'
  }
};

class PromoCodeManager {
  
  // Get current promo code usage data
  async getPromoData() {
    try {
      const data = await AsyncStorage.getItem(PROMO_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting promo data:', error);
      return {};
    }
  }

  // Save promo code usage data
  async savePromoData(data) {
    try {
      await AsyncStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving promo data:', error);
    }
  }

  // Get pack visibility data
  async getPackVisibility() {
    try {
      const data = await AsyncStorage.getItem(PACK_VISIBILITY_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting pack visibility:', error);
      return {};
    }
  }

  // Save pack visibility data
  async savePackVisibility(data) {
    try {
      await AsyncStorage.setItem(PACK_VISIBILITY_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving pack visibility:', error);
    }
  }

  // Validate and redeem a promo code
  async redeemPromoCode(inputCode) {
    const trimmedCode = inputCode.trim().toUpperCase();
    
    // Find which product this code belongs to
    let foundProductId = null;
    let foundPromoConfig = null;
    let codeType = null;
    
    for (const [productId, promoConfig] of Object.entries(PROMO_CODES)) {
      if (promoConfig.standardCode === trimmedCode) {
        foundProductId = productId;
        foundPromoConfig = promoConfig;
        codeType = 'standard';
        break;
      } else if (promoConfig.alwaysCode === trimmedCode) {
        foundProductId = productId;
        foundPromoConfig = promoConfig;
        codeType = 'always';
        break;
      }
    }

    if (!foundProductId || !foundPromoConfig) {
      return {
        success: false,
        error: 'Invalid promo code'
      };
    }

    // Check if user already redeemed this product
    const promoData = await this.getPromoData();
    if (promoData[foundProductId]) {
      return {
        success: false,
        error: `${foundPromoConfig.packName} already unlocked on this device`
      };
    }

    // For standard codes, check usage limit
    if (codeType === 'standard') {
      const usageKey = `${foundProductId}_standard_usage`;
      const currentUsage = promoData[usageKey] || 0;
      
      if (currentUsage >= foundPromoConfig.standardMaxUses) {
        return {
          success: false,
          error: 'Promo code usage limit reached'
        };
      }

      // Increment usage count
      promoData[usageKey] = currentUsage + 1;
    }

    // Mark product as unlocked
    promoData[foundProductId] = {
      unlockedAt: Date.now(),
      codeUsed: trimmedCode,
      codeType: codeType,
      packName: foundPromoConfig.packName,
      packType: foundPromoConfig.packType
    };

    // Save the data
    await this.savePromoData(promoData);

    // Make pack visible
    await this.setPackVisibility(foundProductId, true);

    return {
      success: true,
      productId: foundProductId,
      packName: foundPromoConfig.packName,
      packType: foundPromoConfig.packType,
      codeType: codeType
    };
  }

  // Check if a product is unlocked via promo code
  async isProductUnlocked(productId) {
    const promoData = await this.getPromoData();
    return !!promoData[productId];
  }

  // Get all unlocked products
  async getUnlockedProducts() {
    const promoData = await this.getPromoData();
    const unlockedProducts = [];
    
    for (const [key, value] of Object.entries(promoData)) {
      if (value && value.unlockedAt) {
        unlockedProducts.push({
          productId: key,
          unlockedAt: value.unlockedAt,
          codeUsed: value.codeUsed,
          codeType: value.codeType,
          packName: value.packName,
          packType: value.packType
        });
      }
    }
    
    return unlockedProducts;
  }

  // Set pack visibility
  async setPackVisibility(productId, isVisible) {
    const visibilityData = await this.getPackVisibility();
    visibilityData[productId] = isVisible;
    await this.savePackVisibility(visibilityData);
  }

  // Check if pack should be visible
  async isPackVisible(productId) {
    const visibilityData = await this.getPackVisibility();
    const isUnlocked = await this.isProductUnlocked(productId);
    
    // Pack is visible if:
    // 1. It's explicitly set to visible, OR
    // 2. It's unlocked via promo code
    return visibilityData[productId] === true || isUnlocked;
  }

  // Get remaining uses for a standard promo code
  async getRemainingUses(productId) {
    const promoConfig = PROMO_CODES[productId];
    if (!promoConfig) return 0;

    const promoData = await this.getPromoData();
    const usageKey = `${productId}_standard_usage`;
    const currentUsage = promoData[usageKey] || 0;
    
    return Math.max(0, promoConfig.standardMaxUses - currentUsage);
  }

  // Get promo code info for a specific product
  getPromoCodeInfo(productId) {
    return PROMO_CODES[productId] || null;
  }

  // Get all promo codes for a specific pack type
  getPromoCodesByType(packType) {
    const filteredCodes = {};
    for (const [productId, config] of Object.entries(PROMO_CODES)) {
      if (config.packType === packType) {
        filteredCodes[productId] = config;
      }
    }
    return filteredCodes;
  }

  // Reset promo data (for testing/debugging)
  async resetPromoData() {
    try {
      await AsyncStorage.removeItem(PROMO_STORAGE_KEY);
      await AsyncStorage.removeItem(PACK_VISIBILITY_KEY);
      return true;
    } catch (error) {
      console.error('Error resetting promo data:', error);
      return false;
    }
  }

  // Get all available promo codes (for admin/testing)
  getAvailablePromoCodes() {
    return PROMO_CODES;
  }

  // Check if Everything Bundle is unlocked via promo
  async isEverythingBundleUnlocked() {
    return await this.isProductUnlocked(PRODUCT_IDS.EVERYTHING_BUNDLE);
  }

  // Get promo unlock status for debugging
  async getPromoUnlockStatus() {
    const promoData = await this.getPromoData();
    const visibilityData = await this.getPackVisibility();
    
    const status = {
      unlockedProducts: [],
      visibleProducts: [],
      usageCounts: {}
    };

    // Get unlocked products
    for (const [productId, data] of Object.entries(promoData)) {
      if (data && data.unlockedAt) {
        status.unlockedProducts.push({
          productId,
          packName: data.packName,
          codeUsed: data.codeUsed,
          codeType: data.codeType,
          unlockedAt: new Date(data.unlockedAt).toLocaleDateString()
        });
      } else if (productId.includes('_usage')) {
        // Extract product ID from usage key
        const baseProductId = productId.replace('_standard_usage', '');
        if (PROMO_CODES[baseProductId]) {
          status.usageCounts[baseProductId] = {
            used: data,
            remaining: await this.getRemainingUses(baseProductId),
            packName: PROMO_CODES[baseProductId].packName
          };
        }
      }
    }

    // Get visible products
    for (const [productId, isVisible] of Object.entries(visibilityData)) {
      if (isVisible && PROMO_CODES[productId]) {
        status.visibleProducts.push({
          productId,
          packName: PROMO_CODES[productId].packName
        });
      }
    }

    return status;
  }
}

export default new PromoCodeManager();