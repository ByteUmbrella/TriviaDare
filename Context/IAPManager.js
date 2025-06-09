import { Platform, View, Text, Alert } from 'react-native';
import {
  initConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  consumePurchase,
  endConnection
} from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { achievementTracker } from './AchievementTracker';
import PromoCodeManager from './PromoCode'; // Add this import

// =====================================================
// APPLICATION CONFIGURATION
// =====================================================

const IS_PRODUCTION_BUILD = true; // change to true for production and make sure you change the unlock everything to false.
const SHOW_BETA_INDICATOR = false;

// =====================================================
// SAFE DEVELOPMENT UNLOCK - NEVER AFFECTS PRODUCTION
// =====================================================

export const shouldUnlockAllFeatures = () => {
  // SAFETY: Only return true in development builds
  if (IS_PRODUCTION_BUILD) {
    return true; // Always false in production - NEVER unlock in production
  }
  
  // Change this to true during development to unlock everything
  return true;
};

// Helper function with triple safety checks
const checkUnlockStatus = (context = '') => {
  // TRIPLE SAFETY CHECK
  if (IS_PRODUCTION_BUILD) {
    return false; // NEVER unlock in production builds
  }
  
  if (!__DEV__) {
    return false; // NEVER unlock in release mode
  }
  
  const shouldUnlock = shouldUnlockAllFeatures();
  if (!shouldUnlock) {
    return false; // Respect the unlock flag
  }
  
  // Only if all three conditions pass
  console.log(`🔓 DEBUG MODE: All features unlocked (${context})`);
  console.log(`🔓 This ONLY works in development and will NOT affect production!`);
  return true;
};

// =====================================================
// EXPORTS
// =====================================================

export const shouldShowBetaIndicator = () => {
  return SHOW_BETA_INDICATOR;
};

export const BetaIndicator = ({ style }) => {
  if (!shouldShowBetaIndicator()) {
    return null;
  }
  
  return (
    <View style={[{
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'red',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    }, style]}>
      <Text style={{
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
      }}>BETA</Text>
    </View>
  );
};

// =====================================================
// PRODUCT DEFINITIONS
// =====================================================

export const PRODUCT_IDS = {
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

export const PACK_TO_PRODUCT_MAP = {
  'harrypotter': PRODUCT_IDS.PACK_HARRYPOTTER,
  'marvelcinamaticuniverse': PRODUCT_IDS.PACK_MARVELCINAMATICUNIVERSE,
  'starwars': PRODUCT_IDS.PACK_STARWARS,
  'disneyanimatedmovies': PRODUCT_IDS.PACK_DISNEYANIMATEDMOVIES,
  'thelordoftherings': PRODUCT_IDS.PACK_THELORDOFTHERINGS,
  'pixar': PRODUCT_IDS.PACK_PIXAR,
  'friends': PRODUCT_IDS.PACK_FRIENDS,
  'videogames': PRODUCT_IDS.PACK_VIDEOGAMES,
  'howimetyourmother': PRODUCT_IDS.PACK_HOWIMETYOURMOTHER,
  'theoffice': PRODUCT_IDS.PACK_THEOFFICE,
  'themepark': PRODUCT_IDS.PACK_THEMEPARK
};

export const DARES_TO_PRODUCT_MAP = {
  'spicy': PRODUCT_IDS.DARES_SPICY,
  'houseparty': PRODUCT_IDS.DARES_HOUSEPARTY,
  'couples': PRODUCT_IDS.DARES_COUPLES,
  'bar': PRODUCT_IDS.DARES_BAR
};

// ACHIEVEMENT TRACKING: Create reverse mappings for tracking
const PRODUCT_TO_PACK_MAP = {};
Object.entries(PACK_TO_PRODUCT_MAP).forEach(([packId, productId]) => {
  PRODUCT_TO_PACK_MAP[productId] = packId;
});

const PRODUCT_TO_DARES_MAP = {};
Object.entries(DARES_TO_PRODUCT_MAP).forEach(([packId, productId]) => {
  PRODUCT_TO_DARES_MAP[productId] = packId;
});

export const getAllProductIds = () => 
  Object.values(PRODUCT_IDS);

const PURCHASE_KEY = 'triviadare_purchases';
const RECEIPT_KEY = 'triviadare_receipts';

// =====================================================
// IAP MANAGER CLASS
// =====================================================

class IAPManager {
  constructor() {
    this.products = [];
    this.purchaseUpdateSubscription = null;
    this.purchaseErrorSubscription = null;
    this.isInitialized = false;
    this.pendingPurchases = [];
    this.onPurchaseComplete = null;
    this.isProcessingPurchase = false;
    
    // FLAGS TO PREVENT CONCURRENT OPERATIONS
    this.isFetchingProducts = false;
    this.isInitializing = false;
    
    // Purchase state management to fix endless loading
    this.purchaseCallbacks = new Map(); // Track callbacks per purchase
    this.activePurchases = new Set(); // Track active purchases
    
    this.PRODUCT_IDS = PRODUCT_IDS;
    this.PACK_TO_PRODUCT_MAP = PACK_TO_PRODUCT_MAP;
    this.DARES_TO_PRODUCT_MAP = DARES_TO_PRODUCT_MAP;
  }

  logEnvironmentInfo() {
    console.log('=== IAP Environment Info ===');
    console.log('Platform:', Platform.OS);
    console.log('isDevelopmentMode:', __DEV__);
    console.log('IS_PRODUCTION_BUILD:', IS_PRODUCTION_BUILD);
    console.log('shouldUnlockAllFeatures():', shouldUnlockAllFeatures());
    console.log('🔒 SAFETY: Unlock only works when IS_PRODUCTION_BUILD=false AND __DEV__=true');
    console.log('==========================');
  }

  async debugIAPSetup() {
    if (!__DEV__) return true; // Only run in development
    
    try {
      console.log('🔍 Debugging IAP setup...');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔧 Is initialized:', this.isInitialized);
      console.log('📦 Products loaded:', this.products.length);
      
      if (this.products.length === 0) {
        console.log('⚠️ No products loaded! Trying to fetch...');
        await this.fetchProducts();
      }
      
      console.log('👂 Purchase listener set:', !!this.purchaseUpdateSubscription);
      console.log('👂 Error listener set:', !!this.purchaseErrorSubscription);
      
      const testProductId = PRODUCT_IDS.DARES_BAR;
      const testProduct = this.getProductById(testProductId);
      console.log('🧪 Test product (DarePack4):', testProduct ? 'Found' : 'Not found');
      
      return true;
    } catch (error) {
      console.log('❌ Debug setup error:', error.message);
      return false;
    }
  }

  // SILENT INITIALIZATION - prevents auto-triggering purchases on app load
  async initializeSilently() {
    if (this.isInitialized || this.isInitializing) {
      console.log('🔄 IAP already initialized or initializing, skipping...');
      return this.isInitialized;
    }
    
    this.isInitializing = true;
    
    try {
      console.log('🔄 Silent IAP initialization...');
      
      // Try to initialize with a shorter timeout
      const initPromise = initConnection();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Silent init timeout')), 8000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      console.log('✅ Silent IAP connection established');
      
      this.setupListeners();
      this.isInitialized = true;
      
      // Try to fetch products silently - but don't throw on failure
      try {
        await this.fetchProducts();
        console.log('✅ Silent product fetch completed');
      } catch (error) {
        console.log('⚠️ Silent product fetch failed:', error.message);
        // Don't throw - just log and continue
      }
      
      console.log('✅ Silent IAP initialization completed');
      return true;
      
    } catch (error) {
      console.log('⚠️ Silent IAP initialization failed:', error.message);
      // Don't set as initialized if silent init fails
      this.isInitialized = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  async initialize() {
    if (this.isInitialized || this.isInitializing) {
      console.log('🔄 IAP already initialized or initializing, skipping...');
      return this.isInitialized;
    }
    
    this.isInitializing = true;
    this.logEnvironmentInfo();
    
    try {
      console.log('🛒 Starting IAP initialization...');
      
      // Add timeout for initialization
      const initPromise = initConnection();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('IAP initialization timeout')), 10000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      console.log('✅ IAP connection established');
      
      this.setupListeners();
      console.log('✅ Purchase listeners set up');
      
      this.isInitialized = true;
      
      console.log('📦 Fetching products from App Store...');
      await this.fetchProducts();
      
      console.log('✅ IAP initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ IAP initialization failed:', error.message);
      
      // Set as initialized to prevent infinite retry loops
      this.isInitialized = true;
      this.products = [];
      
      // NEVER show alerts during initialization - this causes popups on load
      console.log('🔒 Keeping premium features locked despite initialization error');
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // Simple way for UI to know when purchases complete
  async purchaseProductWithCallback(productId, onComplete) {
    console.log('🚀 Starting purchase with callback for', productId);
    
    // Prevent multiple purchases of same product
    if (this.activePurchases.has(productId)) {
      console.log('⚠️ Purchase already active for:', productId);
      onComplete({ success: false, error: 'Purchase already in progress' });
      return false;
    }
    
    // Store the callback for this specific purchase
    this.purchaseCallbacks.set(productId, onComplete);
    this.activePurchases.add(productId);
    
    try {
      const result = await this.purchaseProduct(productId);
      
      // If purchaseProduct fails immediately, clean up and call callback
      if (!result) {
        this.cleanupPurchase(productId, { success: false, error: 'Purchase request failed' });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Purchase request failed:', error);
      this.cleanupPurchase(productId, { success: false, error: error.message });
      return false;
    }
  }

  // Clean up purchase state and call callbacks
  cleanupPurchase(productId, result) {
    console.log('🧹 Cleaning up purchase:', productId, result.success ? 'SUCCESS' : 'FAILED');
    
    // Remove from active purchases
    this.activePurchases.delete(productId);
    
    // Call the callback if it exists
    const callback = this.purchaseCallbacks.get(productId);
    if (callback && typeof callback === 'function') {
      try {
        callback(result);
      } catch (error) {
        console.error('❌ Error in purchase callback:', error);
      }
    }
    
    // Clean up the callback
    this.purchaseCallbacks.delete(productId);
  }

  // Setup listeners with improved transaction finishing and cleanup
  setupListeners() {
    // Clean up existing listeners
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }

    this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
      // Prevent concurrent purchase processing
      if (this.isProcessingPurchase) {
        console.log('⚠️ Already processing a purchase, skipping...');
        return;
      }
      
      this.isProcessingPurchase = true;
      
      try {
        console.log('✅ Purchase successful:', purchase.productId);
        
        // Validate purchase object before processing
        if (!purchase || !purchase.productId) {
          throw new Error('Invalid purchase object received');
        }
        
        // CHECK IF THIS IS A NEW PURCHASE (user-initiated) vs restoration
        const isNewPurchase = this.pendingPurchases.includes(purchase.productId);
        
        await this.processPurchase(purchase);
        
        // Skip transaction finishing entirely to avoid errors
        try {
          // Check if we should attempt to finish the transaction
          const shouldFinishTransaction = this.shouldFinishTransaction(purchase);
          
          if (shouldFinishTransaction) {
            console.log('🔄 Attempting to finish transaction for:', purchase.productId);
            
            // Try with the exact purchase object as received
            await finishTransaction(purchase);
            console.log('✅ Transaction finished successfully for:', purchase.productId);
          } else {
            console.log('⚠️ Skipping transaction finish - will be handled automatically by the system');
            console.log('⚠️ This is normal and does not affect the purchase functionality');
          }
        } catch (finishError) {
          // Don't log this as an error since it doesn't affect functionality
          console.log('ℹ️ Transaction finish unsuccessful, but purchase was processed correctly');
          console.log('ℹ️ The system will handle transaction cleanup automatically');
          
          // Only log detailed error info in development mode
          if (__DEV__) {
            console.log('🔍 Debug: Transaction finish error details:', {
              error: finishError.message,
              purchaseKeys: purchase ? Object.keys(purchase) : 'no purchase object',
              hasProductId: !!purchase?.productId,
              hasTransactionId: !!purchase?.transactionId
            });
          }
        }
        
        // Remove from pending purchases
        this.pendingPurchases = this.pendingPurchases.filter(id => id !== purchase.productId);
        
        // Clean up purchase and notify UI components
        this.cleanupPurchase(purchase.productId, { 
          success: true, 
          productId: purchase.productId 
        });
        
        // ONLY show success dialog and call callback for NEW purchases
        if (isNewPurchase) {
          console.log('🎉 New purchase detected - showing success dialog');
          
          // Call completion callback
          if (this.onPurchaseComplete && typeof this.onPurchaseComplete === 'function') {
            try {
              this.onPurchaseComplete();
            } catch (callbackError) {
              console.error('❌ Error in purchase completion callback:', callbackError);
            }
          }
          
          Alert.alert(
            'Purchase Successful!',
            'Your premium content has been unlocked.',
            [{ text: 'OK' }]
          );
        } else {
          console.log('📱 Purchase processed silently (restoration/initialization)');
        }
        
      } catch (error) {
        console.error('❌ Error processing purchase:', error);
        
        // Clean up failed purchase
        this.cleanupPurchase(purchase?.productId, { 
          success: false, 
          error: error.message,
          productId: purchase?.productId 
        });
        
        Alert.alert(
          'Purchase Error',
          'There was an issue processing your purchase. Please try again or contact support if the problem persists.',
          [{ text: 'OK' }]
        );
      } finally {
        this.isProcessingPurchase = false;
      }
    });

    this.purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.error('❌ Purchase error:', error.code, error.message);
      
      // Find which product failed (get from pending purchases)
      const failedProductId = this.pendingPurchases.length > 0 ? this.pendingPurchases[0] : null;
      
      // Clean up pending purchases
      if (this.pendingPurchases.length > 0) {
        const pendingProductId = this.pendingPurchases.pop();
        console.log('🔄 Removed failed purchase from pending:', pendingProductId);
      }
      
      // Clean up failed purchase and notify UI
      if (failedProductId) {
        const isUserCancelled = error.code === 'E_USER_CANCELLED';
        this.cleanupPurchase(failedProductId, { 
          success: false, 
          error: error.message,
          cancelled: isUserCancelled,
          productId: failedProductId
        });
      }
      
      // Don't show alert for user cancellation
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert(
          'Purchase Error',
          error.message || 'An error occurred during purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    });
  }

  // Prevent concurrent product fetching
  async fetchProducts() {
    if (this.isFetchingProducts) {
      console.log('⚠️ Already fetching products, skipping duplicate request');
      return this.products;
    }
    
    this.isFetchingProducts = true;
    
    try {      
      const productIds = getAllProductIds();
      console.log('🔍 Fetching products count:', productIds.length);
      
      // Add timeout for product fetching
      const fetchPromise = getProducts({ skus: productIds });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Product fetch timeout')), 15000);
      });
      
      this.products = await Promise.race([fetchPromise, timeoutPromise]);
      console.log('✅ Products fetched:', this.products.length);
      
      if (this.products.length > 0) {
        console.log('✅ Products loaded successfully');
        // Only show detailed product info in development mode
        if (__DEV__) {
          this.products.forEach(p => {
            console.log(`  - ${p.productId}: ${p.title} - ${p.localizedPrice}`);
          });
        }
      } else {
        console.log('⚠️ No products returned from App Store');
        console.log('⚠️ This usually means products are not approved or have issues in App Store Connect');
      }
      
      return this.products;
    } catch (error) {
      console.error('❌ Failed to fetch products:', error.message);
      
      this.products = [];
      return this.products;
    } finally {
      this.isFetchingProducts = false;
    }
  }

  // Determine if we should attempt to finish transaction
  shouldFinishTransaction(purchase) {
    if (!purchase) {
      return false;
    }
    
    // For production builds, be more conservative about transaction finishing
    if (!__DEV__) {
      // Only finish transactions that have all required fields and are structured correctly
      const hasRequiredFields = purchase.productId && 
                               purchase.transactionId && 
                               purchase.transactionDate;
      
      // Additional check: ensure the purchase object structure is what finishTransaction expects
      const hasExpectedStructure = typeof purchase === 'object' && 
                                  purchase !== null &&
                                  !Array.isArray(purchase);
      
      return hasRequiredFields && hasExpectedStructure;
    }
    
    // In development, try to finish all transactions for debugging
    return !!purchase.productId;
  }

  getProductById(productId) {
    const product = this.products.find(product => product.productId === productId);
    if (!product && __DEV__) {
      console.log(`⚠️ Product not found: ${productId}`);
      console.log(`⚠️ Available products: ${this.products.map(p => p.productId).join(', ')}`);
    }
    return product;
  }

  async processPurchase(purchase) {
    try {
      console.log('🔄 Processing purchase:', purchase.productId);
      
      // Validate purchase object more thoroughly
      if (!purchase || !purchase.productId) {
        throw new Error('Invalid purchase object - missing productId');
      }
      
      // Handle receipt data more safely
      const receipt = purchase.transactionReceipt || 
                    purchase.receiptData || 
                    purchase.originalTransactionIdentifierIOS ||
                    purchase.transactionId ||
                    JSON.stringify(purchase); // Fallback to full purchase object
      
      console.log('📄 Receipt data available:', !!receipt);
      
      // Save purchase with improved error handling
      const saveResult = await this.savePurchase(purchase.productId, receipt);
      if (!saveResult) {
        throw new Error('Failed to save purchase to local storage');
      }
      
      console.log('💾 Purchase saved successfully');
      
      // ACHIEVEMENT TRACKING: Track pack purchase
      await this.trackPurchaseAchievements(purchase.productId);
      
      // Handle everything bundle
      if (purchase.productId === PRODUCT_IDS.EVERYTHING_BUNDLE) {
        await this.saveEverythingBundle();
        console.log('🎁 Everything bundle activated - all packs unlocked');
      }
      
      console.log('✅ Purchase processing completed for:', purchase.productId);
      
      return true;
    } catch (error) {
      console.error('❌ Error processing purchase:', error.message);
      
      // Log purchase object structure for debugging (only in dev mode)
      if (__DEV__ && purchase) {
        console.error('❌ Purchase object keys:', Object.keys(purchase));
        console.error('❌ Purchase object (safe):', {
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          transactionDate: purchase.transactionDate,
          hasReceipt: !!(purchase.transactionReceipt || purchase.receiptData)
        });
      }
      
      throw error; // Re-throw to be handled by caller
    }
  }

  // ACHIEVEMENT TRACKING: New method to track pack purchases
  async trackPurchaseAchievements(productId) {
    try {
      console.log('🏆 Tracking purchase achievements for:', productId);
      
      // Check if it's a trivia pack
      const triviaPackId = PRODUCT_TO_PACK_MAP[productId];
      if (triviaPackId) {
        console.log('📚 Trivia pack purchased:', triviaPackId);
        await achievementTracker.trackPackPurchase(triviaPackId);
        return;
      }
      
      // Check if it's a dares pack
      const daresPackId = PRODUCT_TO_DARES_MAP[productId];
      if (daresPackId) {
        console.log('🎭 Dares pack purchased:', daresPackId);
        await achievementTracker.trackPackPurchase(daresPackId);
        return;
      }
      
      // Check if it's the everything bundle
      if (productId === PRODUCT_IDS.EVERYTHING_BUNDLE) {
        console.log('🎁 Everything bundle purchased - tracking all packs');
        
        // Track all trivia packs
        for (const packId of Object.keys(PACK_TO_PRODUCT_MAP)) {
          await achievementTracker.trackPackPurchase(packId);
        }
        
        // Track all dares packs
        for (const packId of Object.keys(DARES_TO_PRODUCT_MAP)) {
          await achievementTracker.trackPackPurchase(packId);
        }
        
        return;
      }
      
      console.log('⚠️ Unknown product type for achievement tracking:', productId);
    } catch (error) {
      console.error('❌ Error tracking purchase achievements:', error);
      // Don't throw - achievement tracking shouldn't block purchase processing
    }
  }

  async savePurchase(productId, receipt) {
    try {
      // Validate inputs
      if (!productId) {
        throw new Error('ProductId is required for saving purchase');
      }
      
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      const purchases = purchasesJson ? JSON.parse(purchasesJson) : {};
      
      purchases[productId] = {
        purchaseDate: new Date().toISOString(),
        productId
      };
      
      await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(purchases));
      
      // Save receipt separately
      if (receipt && receipt !== 'no_receipt_available') {
        const receiptsJson = await AsyncStorage.getItem(RECEIPT_KEY);
        const receipts = receiptsJson ? JSON.parse(receiptsJson) : {};
        
        receipts[productId] = receipt;
        
        await AsyncStorage.setItem(RECEIPT_KEY, JSON.stringify(receipts));
      }
      
      console.log('💾 Purchase and receipt saved for:', productId);
      return true;
    } catch (error) {
      console.error('❌ Error saving purchase:', error);
      return false;
    }
  }

  async saveEverythingBundle() {
    try {
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      const purchases = purchasesJson ? JSON.parse(purchasesJson) : {};
      
      purchases[PRODUCT_IDS.EVERYTHING_BUNDLE] = {
        purchaseDate: new Date().toISOString(),
        productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
        isBundle: true
      };
      
      // Unlock all trivia packs
      Object.values(PACK_TO_PRODUCT_MAP).forEach(productId => {
        if (!purchases[productId]) {
          purchases[productId] = {
            purchaseDate: new Date().toISOString(),
            productId,
            viaBundle: true
          };
        }
      });
      
      // Unlock all dare packs
      Object.values(DARES_TO_PRODUCT_MAP).forEach(productId => {
        if (!purchases[productId]) {
          purchases[productId] = {
            purchaseDate: new Date().toISOString(),
            productId,
            viaBundle: true
          };
        }
      });
      
      await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(purchases));
      
      return true;
    } catch (error) {
      console.error('❌ Error saving everything bundle:', error);
      return false;
    }
  }

  // =====================================================
  // PROMO CODE INTEGRATION METHODS
  // =====================================================

  // Check if product is available (either purchased via IAP OR unlocked via promo)
  async isProductAvailable(productId) {
    // Check if purchased via IAP first
    const isPurchased = await this.isPurchased(productId);
    if (isPurchased) {
      return {
        isAvailable: true,
        method: 'purchase',
        source: 'In-App Purchase'
      };
    }
    
    // Check if unlocked via promo code
    const isPromoUnlocked = await PromoCodeManager.isProductUnlocked(productId);
    if (isPromoUnlocked) {
      const unlockedProducts = await PromoCodeManager.getUnlockedProducts();
      const productInfo = unlockedProducts.find(p => p.productId === productId);
      
      return {
        isAvailable: true,
        method: 'promo',
        source: `Promo Code: ${productInfo?.codeUsed || 'Unknown'}`,
        codeType: productInfo?.codeType,
        unlockedAt: productInfo?.unlockedAt
      };
    }
    
    return {
      isAvailable: false,
      method: null,
      source: null
    };
  }

  // Enhanced version of isPackPurchased that includes promo unlocks
  async isPackAvailable(packId) {
    // 🔒 SAFE UNLOCK CHECK - Only works in development
    if (checkUnlockStatus(`isPackAvailable(${packId})`)) {
      return {
        isAvailable: true,
        method: 'debug',
        source: 'Development Mode'
      };
    }
    
    // Check if everything bundle is available
    const bundleStatus = await this.isProductAvailable(PRODUCT_IDS.EVERYTHING_BUNDLE);
    if (bundleStatus.isAvailable) {
      return {
        isAvailable: true,
        method: bundleStatus.method,
        source: `Everything Bundle (${bundleStatus.source})`
      };
    }
    
    // Check individual pack
    const productId = PACK_TO_PRODUCT_MAP[packId];
    if (!productId) {
      return {
        isAvailable: false,
        method: null,
        source: null
      };
    }
    
    return await this.isProductAvailable(productId);
  }

  // Enhanced version of isDaresPurchased that includes promo unlocks
  async isDaresPackAvailable(packId) {
    // 🔒 SAFE UNLOCK CHECK - Only works in development
    if (checkUnlockStatus(`isDaresPackAvailable(${packId})`)) {
      return {
        isAvailable: true,
        method: 'debug',
        source: 'Development Mode'
      };
    }
    
    // Check if everything bundle is available
    const bundleStatus = await this.isProductAvailable(PRODUCT_IDS.EVERYTHING_BUNDLE);
    if (bundleStatus.isAvailable) {
      return {
        isAvailable: true,
        method: bundleStatus.method,
        source: `Everything Bundle (${bundleStatus.source})`
      };
    }
    
    // Check individual dares pack
    const productId = DARES_TO_PRODUCT_MAP[packId];
    if (!productId) {
      return {
        isAvailable: false,
        method: null,
        source: null
      };
    }
    
    return await this.isProductAvailable(productId);
  }

  // Check if pack should be visible in the UI
  async shouldShowPack(productId, packConfiguration = {}) {
    // If pack is configured as always visible, show it
    if (packConfiguration.alwaysVisible) {
      return true;
    }
    
    // If pack is available (purchased or promo unlocked), show it
    const availability = await this.isProductAvailable(productId);
    if (availability.isAvailable) {
      return true;
    }
    
    // Check if pack should be visible due to promo code visibility setting
    const isVisible = await PromoCodeManager.isPackVisible(productId);
    return isVisible;
  }

  // Get comprehensive status for all packs
  async getAllPacksStatus() {
    const allStatuses = {
      triviaPacks: {},
      daresPacks: {},
      bundle: {}
    };
    
    // Check trivia packs
    for (const [packId, productId] of Object.entries(PACK_TO_PRODUCT_MAP)) {
      allStatuses.triviaPacks[packId] = await this.isPackAvailable(packId);
    }
    
    // Check dares packs
    for (const [packId, productId] of Object.entries(DARES_TO_PRODUCT_MAP)) {
      allStatuses.daresPacks[packId] = await this.isDaresPackAvailable(packId);
    }
    
    // Check everything bundle
    allStatuses.bundle.everything = await this.isProductAvailable(PRODUCT_IDS.EVERYTHING_BUNDLE);
    
    return allStatuses;
  }

  // Debug method to show all unlock statuses
  async debugUnlockStatus() {
    if (!__DEV__) return; // Only in development
    
    console.log('=== DEBUG: All Pack Unlock Status ===');
    
    const allStatuses = await this.getAllPacksStatus();
    
    console.log('📚 TRIVIA PACKS:');
    for (const [packId, status] of Object.entries(allStatuses.triviaPacks)) {
      console.log(`  ${packId}: ${status.isAvailable ? '✅' : '❌'} (${status.source || 'Not unlocked'})`);
    }
    
    console.log('🎭 DARES PACKS:');
    for (const [packId, status] of Object.entries(allStatuses.daresPacks)) {
      console.log(`  ${packId}: ${status.isAvailable ? '✅' : '❌'} (${status.source || 'Not unlocked'})`);
    }
    
    console.log('🎁 BUNDLE:');
    const bundleStatus = allStatuses.bundle.everything;
    console.log(`  Everything Bundle: ${bundleStatus.isAvailable ? '✅' : '❌'} (${bundleStatus.source || 'Not unlocked'})`);
    
    // Show promo code specific info
    const promoStatus = await PromoCodeManager.getPromoUnlockStatus();
    console.log('🎫 PROMO CODE UNLOCKS:');
    promoStatus.unlockedProducts.forEach(product => {
      console.log(`  ${product.packName}: ${product.codeType} code "${product.codeUsed}" (${product.unlockedAt})`);
    });
    
    if (Object.keys(promoStatus.usageCounts).length > 0) {
      console.log('📊 PROMO CODE USAGE:');
      for (const [productId, usage] of Object.entries(promoStatus.usageCounts)) {
        console.log(`  ${usage.packName}: ${usage.used} used, ${usage.remaining} remaining`);
      }
    }
    
    console.log('=====================================');
  }

  // Reset all unlocks (both IAP and promo) - for testing
  async resetAllUnlocks() {
    console.log('🔄 Resetting all unlocks (IAP + Promo)...');
    
    // Reset IAP data
    try {
      await AsyncStorage.removeItem(PURCHASE_KEY);
      await AsyncStorage.removeItem(RECEIPT_KEY);
      console.log('✅ IAP data reset');
    } catch (error) {
      console.error('❌ Error resetting IAP data:', error);
    }
    
    // Reset promo data
    const promoReset = await PromoCodeManager.resetPromoData();
    if (promoReset) {
      console.log('✅ Promo data reset');
    } else {
      console.error('❌ Error resetting promo data');
    }
    
    console.log('🔄 All unlock data has been reset');
  }

  // ✅ UPDATED: Now checks unlock status safely
  async isPurchased(productId) {
    try {
      // 🔒 SAFE UNLOCK CHECK - Only works in development
      if (checkUnlockStatus(`isPurchased(${productId})`)) {
        return true;
      }
      
      if (!productId) {
        console.error('❌ ProductId is required for purchase check');
        return false;
      }
      
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      if (!purchasesJson) return false;
      
      const purchases = JSON.parse(purchasesJson);
      
      // Check if everything bundle is purchased
      if (purchases[PRODUCT_IDS.EVERYTHING_BUNDLE]) {
        return true;
      }
      
      const isPurchased = !!purchases[productId];
      
      // Only log in development mode to reduce console clutter
      if (__DEV__) {
        console.log(`🔍 Purchase check for ${productId}:`, isPurchased);
      }
      
      return isPurchased;
    } catch (error) {
      console.error('❌ Error checking purchase status:', error);
      return false;
    }
  }
  
  // ✅ UPDATED: Now checks both IAP and promo unlocks (maintains backward compatibility)
  async isPackPurchased(packId) {
    const availability = await this.isPackAvailable(packId);
    return availability.isAvailable;
  }

  // ✅ UPDATED: Now checks both IAP and promo unlocks (maintains backward compatibility)
  async isDaresPurchased(packId) {
    const availability = await this.isDaresPackAvailable(packId);
    return availability.isAvailable;
  }

  // ✅ UPDATED: Now includes promo unlocked packs
  async getPurchasedPacks() {
    try {
      // 🔒 SAFE UNLOCK CHECK - Only works in development
      if (checkUnlockStatus('getPurchasedPacks()')) {
        return Object.keys(PACK_TO_PRODUCT_MAP);
      }
      
      const availablePacks = [];
      
      // Check if everything bundle is available
      const bundleAvailability = await this.isProductAvailable(PRODUCT_IDS.EVERYTHING_BUNDLE);
      if (bundleAvailability.isAvailable) {
        return Object.keys(PACK_TO_PRODUCT_MAP);
      }
      
      // Check individual packs
      for (const packId of Object.keys(PACK_TO_PRODUCT_MAP)) {
        const availability = await this.isPackAvailable(packId);
        if (availability.isAvailable) {
          availablePacks.push(packId);
        }
      }
      
      return availablePacks;
    } catch (error) {
      console.error('❌ Error getting available packs:', error);
      return [];
    }
  }

  // ✅ UPDATED: Now includes promo unlocked dares packs
  async getPurchasedDaresPacks() {
    try {
      // 🔒 SAFE UNLOCK CHECK - Only works in development
      if (checkUnlockStatus('getPurchasedDaresPacks()')) {
        return Object.keys(DARES_TO_PRODUCT_MAP);
      }
      
      const availableDaresPacks = [];
      
      // Check if everything bundle is available
      const bundleAvailability = await this.isProductAvailable(PRODUCT_IDS.EVERYTHING_BUNDLE);
      if (bundleAvailability.isAvailable) {
        return Object.keys(DARES_TO_PRODUCT_MAP);
      }
      
      // Check individual dares packs
      for (const packId of Object.keys(DARES_TO_PRODUCT_MAP)) {
        const availability = await this.isDaresPackAvailable(packId);
        if (availability.isAvailable) {
          availableDaresPacks.push(packId);
        }
      }
      
      return availableDaresPacks;
    } catch (error) {
      console.error('❌ Error getting available dares packs:', error);
      return [];
    }
  }

  // Add timeout protection and cleanup
  async purchaseProduct(productId) {
    console.log('🚀 Starting purchase for', productId);
    
    // Validate input
    if (!productId) {
      console.error('❌ ProductId is required for purchase');
      Alert.alert('Error', 'Invalid product selection. Please try again.');
      return false;
    }
    
    // Ensure IAP is initialized - but don't show errors to user if it fails
    if (!this.isInitialized) {
      console.log('⚠️ IAP not initialized, initializing now...');
      const initResult = await this.initialize();
      if (!initResult) {
        // Only show error when user tries to purchase, not during init
        Alert.alert(
          'Service Unavailable',
          'In-app purchases are currently unavailable. Please check your internet connection and try again later.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    
    // Double-check we have products after initialization
    if (this.products.length === 0) {
      console.log('⚠️ No products available, trying to fetch again...');
      await this.fetchProducts();
      
      if (this.products.length === 0) {
        Alert.alert(
          'Products Unavailable',
          'Product information is currently unavailable. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    
    // Add timeout protection
    const PURCHASE_TIMEOUT = 30000; // 30 seconds
    let startTime = Date.now();
    
    try {
      const product = this.getProductById(productId);
      if (!product) {
        console.log('❌ Product not found:', productId);
        Alert.alert(
          'Product Not Available',
          'This product is currently not available for purchase. Please try again later.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      console.log('✅ Product found:', product.title, product.localizedPrice);
      
      // Check if already purchased
      const alreadyPurchased = await this.isPurchased(productId);
      if (alreadyPurchased) {
        console.log('ℹ️ Product already purchased:', productId);
        Alert.alert(
          'Already Purchased',
          'You have already purchased this content.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      // Check if already in pending purchases
      if (this.pendingPurchases.includes(productId)) {
        console.log('⚠️ Purchase already in progress for:', productId);
        Alert.alert(
          'Purchase In Progress',
          'A purchase for this item is already in progress. Please wait.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      this.pendingPurchases.push(productId);
      console.log('📝 Added to pending purchases. Total pending:', this.pendingPurchases.length);
      
      console.log('💳 Requesting purchase from Apple...');
      startTime = Date.now();
      
      // Wrap the purchase request with timeout
      const purchasePromise = requestPurchase({ sku: productId });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Purchase timeout')), PURCHASE_TIMEOUT);
      });
      
      await Promise.race([purchasePromise, timeoutPromise]);
      
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`✅ Purchase request completed in ${elapsed}s`);
      console.log('✅ Purchase request sent successfully - waiting for completion...');
      
      // Don't wait for the purchase to complete here - let the listener handle it
      // This prevents endless loading
      return true;
      
    } catch (error) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`❌ Purchase failed after ${elapsed}s`);
      
      // Clean up pending purchases
      this.pendingPurchases = this.pendingPurchases.filter(id => id !== productId);
      
      // Handle timeout specifically
      if (error.message === 'Purchase timeout') {
        Alert.alert(
          'Purchase Timeout',
          'The purchase is taking longer than expected. Please try again.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return this.handlePurchaseError(error);
    }
  }

  handlePurchaseError(error) {
    if (error.code === 'E_IAP_NOT_AVAILABLE') {
      console.log('ℹ️ IAP not available - simulator or region restriction');
      Alert.alert(
        'Purchase Not Available', 
        'In-app purchases are not available on this device or in this region.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    if (error.code === 'E_USER_CANCELLED') {
      console.log('🚫 User cancelled purchase');
      return false;
    }
    
    if (error.code === 'E_NETWORK_ERROR') {
      console.log('🌐 Network error during purchase');
      Alert.alert(
        'Network Error', 
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    if (error.code === 'E_UNKNOWN') {
      console.log('❓ Unknown IAP error - possibly payment method issue');
      Alert.alert(
        'Payment Error',
        'There was an issue with your payment method. Please check your payment information and try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    console.log('❌ Unknown purchase error:', error.code, error.message);
    Alert.alert(
      'Purchase Error', 
      'An unexpected error occurred. Please try again later.',
      [{ text: 'OK' }]
    );
    return false;
  }

  async restorePurchases() {
    if (!this.isInitialized) {
      const initResult = await this.initialize();
      if (!initResult) {
        Alert.alert(
          'Service Unavailable',
          'Cannot restore purchases at this time. Please try again later.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    
    try {
      console.log('🔄 Restoring purchases from store...');
      
      // Add timeout for restore
      const restorePromise = getAvailablePurchases();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Restore timeout')), 15000);
      });
      
      const purchases = await Promise.race([restorePromise, timeoutPromise]);
      
      if (purchases && purchases.length > 0) {
        console.log('✅ Found purchases to restore:', purchases.length);
        
        let restoredCount = 0;
        for (const purchase of purchases) {
          try {
            console.log('🔄 Restoring purchase:', purchase.productId);
            await this.processPurchase(purchase);
            restoredCount++;
          } catch (error) {
            console.error('❌ Error restoring individual purchase:', error);
            // Continue with other purchases
          }
        }
        
        if (this.onPurchaseComplete && typeof this.onPurchaseComplete === 'function') {
          this.onPurchaseComplete();
        }
        
        Alert.alert(
          'Purchases Restored',
          `Successfully restored ${restoredCount} purchase(s).`,
          [{ text: 'OK' }]
        );
        
        return restoredCount > 0;
      }
      
      console.log('ℹ️ No purchases found to restore');
      Alert.alert(
        'No Purchases Found',
        'No previous purchases were found to restore.',
        [{ text: 'OK' }]
      );
      return false;
    } catch (error) {
      if (error.message === 'Restore timeout') {
        Alert.alert(
          'Restore Timeout',
          'Restore is taking longer than expected. Please try again.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      if (error.code === 'E_IAP_NOT_AVAILABLE') {
        console.log('ℹ️ Restore not available - likely in simulator');
        Alert.alert(
          'Restore Not Available',
          'Purchase restoration is not available on this device.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      console.error('❌ Error restoring purchases:', error);
      Alert.alert(
        'Restore Error',
        'There was an error restoring your purchases. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  async debugPurchaseTest(productId = 'DarePack4') {
    if (!__DEV__) return false; // Only available in development
    
    console.log('🔥 Starting debug purchase test for:', productId);
    
    try {
      if (!this.isInitialized) {
        console.log('🔧 Initializing IAP for debug test...');
        await this.initialize();
      }
      
      await this.debugIAPSetup();
      
      console.log('💳 Testing purchase flow...');
      const result = await this.purchaseProduct(productId);
      
      console.log('🏁 Debug test completed. Result:', result);
      
      Alert.alert(
        'Debug Test Complete',
        `Purchase test result: ${result ? 'SUCCESS' : 'FAILED'}. Check console for detailed logs.`,
        [{ text: 'OK' }]
      );
      
      return result;
      
    } catch (error) {
      console.log('❌ Debug test error:', error.message);
      Alert.alert('Debug Test Error', error.message);
      return false;
    }
  }

  // Check if a purchase is currently active
  isPurchaseActive(productId) {
    return this.activePurchases.has(productId);
  }

  // Get all active purchases
  getActivePurchases() {
    return Array.from(this.activePurchases);
  }

  // Reset flags method for debugging
  resetFlags() {
    this.isFetchingProducts = false;
    this.isInitializing = false;
    this.isProcessingPurchase = false;
    console.log('🔄 IAP flags reset');
  }

  cleanup() {
    console.log('🧹 Cleaning up IAP listeners');
    
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }
    
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }
    
    // Clear pending purchases
    this.pendingPurchases = [];
    this.isProcessingPurchase = false;
    
    // Reset flags
    this.resetFlags();
    
    // Clean up all active purchases and callbacks
    this.activePurchases.clear();
    this.purchaseCallbacks.clear();
    
    // End IAP connection
    try {
      endConnection();
      console.log('✅ IAP connection ended');
    } catch (error) {
      console.error('❌ Error ending IAP connection:', error);
    }
    
    this.isInitialized = false;
  }
}

const iapManager = new IAPManager();
export default iapManager;