import { Platform, View, Text } from 'react-native';
import {
  initConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  consumePurchase
} from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Development and Beta mode configuration
const isDevelopmentMode = __DEV__;
// Beta mode flag - set to false for production release
const isBetaMode = false;

// SINGLE TOGGLE FOR ALL BUILDS
// true = Production build (normal IAP behavior)
// false = Simulator/TestFlight/Testing build (everything unlocked)
const IS_PRODUCTION_BUILD = true; // Change this to false for TestFlight/Simulator builds

// Simplified helper function
export const shouldUnlockAllFeatures = () => {
  // If not a production build, unlock everything
  return !IS_PRODUCTION_BUILD;
};

// Helper to determine if beta indicator should be shown
export const shouldShowBetaIndicator = () => {
  return isBetaMode;
};

// Beta UI component that can be used within your app screens
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

// Define product IDs
export const PRODUCT_IDS = {
    // Premium packs at $3.99 each
    PACK_HARRYPOTTER: Platform.select({
      ios: 'HarryPotter1',
      android: 'harrypotter1'
    }),
    PACK_MARVELCINAMATICUNIVERSE: Platform.select({
      ios: 'MarvelCinematicUniverse1',
      android: 'marvelcinamaticu­niverse1'
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
    // Everything bundle for $49.99
    EVERYTHING_BUNDLE: Platform.select({
      ios: 'EverythingBundle1',
      android: 'everythingbundle1'
    }),
    // DaresONLY packs at $3.99 each
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

// Map pack IDs to product IDs
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

// Map DaresONLY pack IDs to product IDs
export const DARES_TO_PRODUCT_MAP = {
  'spicy': PRODUCT_IDS.DARES_SPICY,
  'houseparty': PRODUCT_IDS.DARES_HOUSEPARTY,
  'couples': PRODUCT_IDS.DARES_COUPLES,
  'bar': PRODUCT_IDS.DARES_BAR
};

// Get all product IDs for fetching
export const getAllProductIds = () => 
  Object.values(PRODUCT_IDS);

// AsyncStorage keys
const PURCHASE_KEY = 'triviadare_purchases';
const RECEIPT_KEY = 'triviadare_receipts';

// Class to manage IAP functionality
class IAPManager {
  constructor() {
    this.products = [];
    this.purchaseUpdateSubscription = null;
    this.purchaseErrorSubscription = null;
    this.isInitialized = false;
    this.pendingPurchases = [];
    
    // Add properties to access maps from the instance
    this.PRODUCT_IDS = PRODUCT_IDS;
    this.PACK_TO_PRODUCT_MAP = PACK_TO_PRODUCT_MAP;
    this.DARES_TO_PRODUCT_MAP = DARES_TO_PRODUCT_MAP;
  }

  // Method to check if we're in a test environment (Simulator/Emulator)
  isTestEnvironment() {
    // Common ways to detect simulator/test environment
    const isSimulator = Platform.OS === 'ios' && (
      // Check for iOS Simulator
      Platform.isPad === undefined || // Simulator doesn't have this prop
      Platform.isTVOS === false ||
      typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
    );
    
    const isEmulator = Platform.OS === 'android' && (
      // Check for Android Emulator
      global.nativeCallSyncHook || // Metro/Debug mode
      __DEV__ === true
    );
    
    // Also check for common test/debug flags
    const isDebugMode = __DEV__ || global.__DEV__ === true;
    
    return isDebugMode || isSimulator || isEmulator || !global.nativeCallSyncHook;
  }

  // Log environment info for debugging
  logEnvironmentInfo() {
    console.log('=== IAP Environment Info ===');
    console.log('Platform:', Platform.OS);
    console.log('isDevelopmentMode:', isDevelopmentMode);
    console.log('isBetaMode:', isBetaMode);
    console.log('IS_PRODUCTION_BUILD:', IS_PRODUCTION_BUILD);
    console.log('shouldUnlockAllFeatures():', shouldUnlockAllFeatures());
    console.log('isTestEnvironment():', this.isTestEnvironment());
    console.log('__DEV__:', __DEV__);
    console.log('==========================');
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    // Log environment info for debugging
    if (__DEV__) {
      this.logEnvironmentInfo();
    }
    
    // If not a production build, skip real IAP and use mock data
    if (!IS_PRODUCTION_BUILD) {
      console.log('🔧 Non-production build - using mock IAP data');
      this.isInitialized = true;
      this.products = this.getMockProducts();
      return true;
    }
    
    // In production builds, check if we're in a test environment first
    if (this.isTestEnvironment()) {
      console.log('🔧 Test environment detected in production build - using mock IAP data');
      this.isInitialized = true;
      this.products = this.getMockProducts();
      return true;
    }
    
    try {
      console.log('🛒 Initializing real IAP connection...');
      await initConnection();
      this.setupListeners();
      this.isInitialized = true;
      
      // Fetch available products
      await this.fetchProducts();
      console.log('✅ IAP initialized successfully');
      
      return true;
    } catch (error) {
      // Handle specific IAP errors gracefully
      if (error.code === 'E_IAP_NOT_AVAILABLE' || 
          error.message?.includes('E_IAP_NOT_AVAILABLE') ||
          error.message?.includes('not available')) {
        console.log('ℹ️ IAP not available (likely running on simulator or device without app store capabilities)');
        // Fall back to mock mode
        this.isInitialized = true;
        this.products = this.getMockProducts();
        return true;
      }
      
      // Handle network or other errors
      if (error.code === 'E_SERVICE_ERROR' || error.message?.includes('network')) {
        console.log('🌐 Network error during IAP initialization - falling back to mock mode');
        this.isInitialized = true;
        this.products = this.getMockProducts();
        return true;
      }
      
      // Log other types of errors but still try to continue
      console.warn('⚠️ IAP initialization error (continuing with mock data):', error.message);
      
      // Always fall back to mock mode in case of errors
      this.isInitialized = true;
      this.products = this.getMockProducts();
      return true;
    }
  }
  
  // Add this method to provide mock products during development
  getMockProducts() {
    const triviaProducts = Object.entries(PACK_TO_PRODUCT_MAP).map(([packId, productId]) => ({
      productId: productId,
      title: `Premium Pack: ${packId}`,
      description: `This is a mock description for ${packId}`,
      price: '3.99',
      localizedPrice: '$3.99',
      currency: 'USD',
    }));

    const daresProducts = Object.entries(DARES_TO_PRODUCT_MAP).map(([packId, productId]) => ({
      productId: productId,
      title: `DaresONLY Pack: ${packId}`,
      description: `This is a mock description for DaresONLY ${packId}`,
      price: '3.99',
      localizedPrice: '$3.99',
      currency: 'USD',
    }));

    return [
      ...triviaProducts,
      ...daresProducts,
      {
        productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
        title: 'Everything Bundle',
        description: 'Get all current and future packs',
        price: '49.99',
        localizedPrice: '$49.99',
        currency: 'USD',
      }
    ];
  }

  // Set up purchase listeners
  setupListeners() {
    // Remove existing listeners if they exist
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }

    // Set up new listeners
    this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
      try {
        console.log('✅ Purchase successful:', purchase.productId);
        // Process and validate the purchase
        await this.processPurchase(purchase);
        
        // Finish the transaction
        await finishTransaction(purchase);
      } catch (error) {
        console.error('❌ Error processing purchase:', error);
      }
    });

    this.purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.error('❌ Purchase error:', error);
      
      // Handle any pending purchase errors
      if (this.pendingPurchases.length > 0) {
        const pendingProductId = this.pendingPurchases.pop();
        console.log('🔄 Removed failed purchase from pending:', pendingProductId);
      }
    });
  }

  // Fetch available products from the store
  async fetchProducts() {
    try {
      if (!IS_PRODUCTION_BUILD || this.isTestEnvironment()) {
        console.log('📦 Using mock products in non-production environment');
        return this.products;
      }
      
      const productIds = getAllProductIds();
      console.log('🔍 Fetching products:', productIds.length);
      this.products = await getProducts(productIds);
      console.log('✅ Products fetched:', this.products.length);
      return this.products;
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      // Fall back to mock products
      this.products = this.getMockProducts();
      return this.products;
    }
  }

  // Get product details by ID
  getProductById(productId) {
    return this.products.find(product => product.productId === productId);
  }

  // Process a successful purchase
  async processPurchase(purchase) {
    try {
      // For Android, we need to acknowledge/consume non-consumable purchases
      if (Platform.OS === 'android' && purchase.purchaseToken) {
        // For subscriptions or non-consumables, just acknowledge
        // For consumables, consume the purchase
        // await consumePurchase(purchase.purchaseToken);
      }
      
      // Store the purchase information
      await this.savePurchase(purchase.productId, purchase.transactionReceipt);
      
      // If this is the everything bundle, mark all packs as purchased
      if (purchase.productId === PRODUCT_IDS.EVERYTHING_BUNDLE) {
        await this.saveEverythingBundle();
      }
      
      // Remove from pending purchases list
      this.pendingPurchases = this.pendingPurchases.filter(id => id !== purchase.productId);
      
      return true;
    } catch (error) {
      console.error('❌ Error processing purchase:', error);
      return false;
    }
  }

  // Save purchase information to AsyncStorage
  async savePurchase(productId, receipt) {
    try {
      // Get existing purchases
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      const purchases = purchasesJson ? JSON.parse(purchasesJson) : {};
      
      // Add the new purchase
      purchases[productId] = {
        purchaseDate: new Date().toISOString(),
        productId
      };
      
      // Save updated purchases
      await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(purchases));
      
      // Save receipt for verification
      const receiptsJson = await AsyncStorage.getItem(RECEIPT_KEY);
      const receipts = receiptsJson ? JSON.parse(receiptsJson) : {};
      
      receipts[productId] = receipt;
      
      await AsyncStorage.setItem(RECEIPT_KEY, JSON.stringify(receipts));
      
      return true;
    } catch (error) {
      console.error('❌ Error saving purchase:', error);
      return false;
    }
  }

  // Mark all packs as purchased (for the everything bundle)
  async saveEverythingBundle() {
    try {
      // Get existing purchases
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      const purchases = purchasesJson ? JSON.parse(purchasesJson) : {};
      
      // Mark the bundle as purchased
      purchases[PRODUCT_IDS.EVERYTHING_BUNDLE] = {
        purchaseDate: new Date().toISOString(),
        productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
        isBundle: true
      };
      
      // Mark all individual packs as purchased through the bundle
      Object.values(PACK_TO_PRODUCT_MAP).forEach(productId => {
        if (!purchases[productId]) {
          purchases[productId] = {
            purchaseDate: new Date().toISOString(),
            productId,
            viaBundle: true
          };
        }
      });
      
      // Mark all DaresONLY packs as purchased through the bundle
      Object.values(DARES_TO_PRODUCT_MAP).forEach(productId => {
        if (!purchases[productId]) {
          purchases[productId] = {
            purchaseDate: new Date().toISOString(),
            productId,
            viaBundle: true
          };
        }
      });
      
      // Save updated purchases
      await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(purchases));
      
      return true;
    } catch (error) {
      console.error('❌ Error saving everything bundle:', error);
      return false;
    }
  }

  async isPurchased(productId) {
    try {
      // If not a production build, automatically return true
      if (!IS_PRODUCTION_BUILD) {
        return true;
      }
      
      // Check actual purchases in production
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      if (!purchasesJson) return false;
      
      const purchases = JSON.parse(purchasesJson);
      
      // Check for bundle
      if (purchases[PRODUCT_IDS.EVERYTHING_BUNDLE]) {
        return true;
      }
      
      // Check for specific product
      return !!purchases[productId];
    } catch (error) {
      console.error('❌ Error checking purchase status:', error);
      return false;
    }
  }
  
  async purchaseProduct(productId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Add to pending purchases
      this.pendingPurchases.push(productId);
      
      // If not a production build, simulate successful purchase immediately
      if (!IS_PRODUCTION_BUILD) {
        console.log('🧪 Simulating purchase in non-production environment:', productId);
        await this.processPurchase({ 
          productId,
          transactionReceipt: 'mock-receipt-for-non-production'
        });
        return true;
      }
      
      // If in test environment, also simulate
      if (this.isTestEnvironment()) {
        console.log('🧪 Simulating purchase in test environment:', productId);
        await this.processPurchase({ 
          productId,
          transactionReceipt: 'mock-receipt-for-test-environment'
        });
        return true;
      }
      
      // Request the real purchase
      console.log('💳 Requesting purchase:', productId);
      await requestPurchase(productId);
      return true;
    } catch (error) {
      // Handle specific IAP errors gracefully
      if (error.code === 'E_IAP_NOT_AVAILABLE') {
        console.log('ℹ️ Purchase not available - likely in simulator');
        // Remove from pending purchases
        this.pendingPurchases = this.pendingPurchases.filter(id => id !== productId);
        return false;
      }
      
      if (error.code === 'E_USER_CANCELLED') {
        console.log('🚫 User cancelled purchase');
        // Remove from pending purchases
        this.pendingPurchases = this.pendingPurchases.filter(id => id !== productId);
        return false;
      }
      
      console.error('❌ Error requesting purchase:', error);
      
      // Remove from pending purchases
      this.pendingPurchases = this.pendingPurchases.filter(id => id !== productId);
      return false;
    }
  }

  // Check if a pack is purchased
  async isPackPurchased(packId) {
    // If not a production build, all packs are purchased
    if (!IS_PRODUCTION_BUILD) {
      return true;
    }
    
    // First check if they have the everything bundle
    const hasBundle = await this.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
    if (hasBundle) return true;
    
    // If not, check for the specific pack
    const productId = PACK_TO_PRODUCT_MAP[packId];
    if (!productId) return false;
    
    return await this.isPurchased(productId);
  }

  // Check if a DaresONLY pack is purchased
  async isDaresPurchased(packId) {
    // If not a production build, all packs are purchased
    if (!IS_PRODUCTION_BUILD) {
      return true;
    }
    
    // First check if they have the everything bundle
    const hasBundle = await this.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
    if (hasBundle) return true;
    
    // If not, check for the specific DaresONLY pack
    const productId = DARES_TO_PRODUCT_MAP[packId];
    if (!productId) return false;
    
    return await this.isPurchased(productId);
  }

  // Get all purchased packs
  async getPurchasedPacks() {
    try {
      // If not a production build, return all packs
      if (!IS_PRODUCTION_BUILD) {
        return Object.keys(PACK_TO_PRODUCT_MAP);
      }
      
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      if (!purchasesJson) return [];
      
      const purchases = JSON.parse(purchasesJson);
      
      // If the bundle is purchased, return all packs
      if (purchases[PRODUCT_IDS.EVERYTHING_BUNDLE]) {
        return Object.keys(PACK_TO_PRODUCT_MAP);
      }
      
      // Otherwise, find which packs are purchased
      const purchasedPacks = [];
      
      for (const [packId, productId] of Object.entries(PACK_TO_PRODUCT_MAP)) {
        if (purchases[productId]) {
          purchasedPacks.push(packId);
        }
      }
      
      return purchasedPacks;
    } catch (error) {
      console.error('❌ Error getting purchased packs:', error);
      return [];
    }
  }

  // Get all purchased DaresONLY packs
  async getPurchasedDaresPacks() {
    try {
      // If not a production build, return all dares packs
      if (!IS_PRODUCTION_BUILD) {
        return Object.keys(DARES_TO_PRODUCT_MAP);
      }
      
      const purchasesJson = await AsyncStorage.getItem(PURCHASE_KEY);
      if (!purchasesJson) return [];
      
      const purchases = JSON.parse(purchasesJson);
      
      // If the bundle is purchased, return all dares packs
      if (purchases[PRODUCT_IDS.EVERYTHING_BUNDLE]) {
        return Object.keys(DARES_TO_PRODUCT_MAP);
      }
      
      // Otherwise, find which dares packs are purchased
      const purchasedDaresPacks = [];
      
      for (const [packId, productId] of Object.entries(DARES_TO_PRODUCT_MAP)) {
        if (purchases[productId]) {
          purchasedDaresPacks.push(packId);
        }
      }
      
      return purchasedDaresPacks;
    } catch (error) {
      console.error('❌ Error getting purchased dares packs:', error);
      return [];
    }
  }

  // Restore purchases from the store
  async restorePurchases() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // If not a production build, simulate all purchases restored
      if (!IS_PRODUCTION_BUILD || this.isTestEnvironment()) {
        console.log('🧪 Simulating purchase restoration in non-production environment');
        // Simulate everything bundle purchase
        await this.processPurchase({
          productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
          transactionReceipt: 'mock-receipt-for-restoration'
        });
        return true;
      }
      
      console.log('🔄 Restoring purchases from store...');
      // Get available purchases from store
      const purchases = await getAvailablePurchases();
      
      if (purchases && purchases.length > 0) {
        console.log('✅ Found purchases to restore:', purchases.length);
        // Process each purchase
        for (const purchase of purchases) {
          await this.processPurchase(purchase);
        }
        return true;
      }
      
      console.log('ℹ️ No purchases found to restore');
      return false;
    } catch (error) {
      if (error.code === 'E_IAP_NOT_AVAILABLE') {
        console.log('ℹ️ Restore not available - likely in simulator');
        return false;
      }
      
      console.error('❌ Error restoring purchases:', error);
      return false;
    }
  }

  // Clean up listeners
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
    
    this.isInitialized = false;
  }
}

// Create and export singleton instance
const iapManager = new IAPManager();
export default iapManager;