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
const isBetaMode = true;

// Helper function to determine if all features should be unlocked
export const shouldUnlockAllFeatures = () => {
  return isDevelopmentMode || isBetaMode;
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
      android: 'HarryPotter1'
    }),
    PACK_MARVELCINAMATICUNIVERSE: Platform.select({
      ios: 'MarvelCinematicUniverse1',
      android: 'MarvelCinematicUniverse1'
    }),
    PACK_STARWARS: Platform.select({
      ios: 'StarWars1',
      android: 'StarWars1'
    }),
    PACK_DISNEYANIMATEDMOVIES: Platform.select({
      ios: 'DisneyAnimatedMovies1',
      android: 'DisneyAnimatedMovies1'
    }),
    PACK_THELORDOFTHERINGS: Platform.select({
      ios: 'TheLordOfTheRings1',
      android: 'TheLordOfTheRings1'
    }),
    PACK_PIXAR: Platform.select({
      ios: 'Pixar1',
      android: 'Pixar1'
    }),
    PACK_FRIENDS: Platform.select({
      ios: 'Friends1',
      android: 'Friends1'
    }),
    PACK_VIDEOGAMES: Platform.select({
      ios: 'VideoGames1',
      android: 'VideoGames1'
    }),
    PACK_HOWIMETYOURMOTHER: Platform.select({
      ios: 'HowIMetYourMother1',
      android: 'HowIMetYourMother1'
    }),
    PACK_THEOFFICE: Platform.select({
      ios: 'TheOffice1',
      android: 'TheOffice1'
    }),
    PACK_THEMEPARK: Platform.select({
      ios: 'ThemePark1',
      android: 'ThemePark1'
    }),
    // Everything bundle for $49.99
    EVERYTHING_BUNDLE: Platform.select({
      ios: 'EverythingBundle1',
      android: 'EverythingBundle1'
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
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Skip actual IAP initialization in development or beta mode
      if (shouldUnlockAllFeatures()) {
        console.log('Running in development/beta mode - using mock IAP data');
        this.isInitialized = true;
        // Load mock product data
        this.products = this.getMockProducts();
        return true;
      }
      
      await initConnection();
      this.setupListeners();
      this.isInitialized = true;
      
      // Fetch available products
      await this.fetchProducts();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize IAP:', error);
      // Even if initialization fails, consider it initialized in dev/beta mode
      if (shouldUnlockAllFeatures()) {
        this.isInitialized = true;
        this.products = this.getMockProducts();
        return true;
      }
      return false;
    }
  }
  
  // Add this method to provide mock products during development
  getMockProducts() {
    return Object.entries(PACK_TO_PRODUCT_MAP).map(([packId, productId]) => ({
      productId: productId,
      title: `Premium Pack: ${packId}`,
      description: `This is a mock description for ${packId}`,
      price: '3.99',
      localizedPrice: '$3.99',
      currency: 'USD',
    })).concat([{
      productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
      title: 'Everything Bundle',
      description: 'Get all current and future packs',
      price: '49.99',
      localizedPrice: '$49.99',
      currency: 'USD',
    }]);
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
        // Process and validate the purchase
        await this.processPurchase(purchase);
        
        // Finish the transaction
        await finishTransaction(purchase);
      } catch (error) {
        console.error('Error processing purchase:', error);
      }
    });

    this.purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.error('Purchase error:', error);
      
      // Handle any pending purchase errors
      if (this.pendingPurchases.length > 0) {
        const pendingProductId = this.pendingPurchases.pop();
        // Here you could implement error callbacks
      }
    });
  }

  // Fetch available products from the store
  async fetchProducts() {
    try {
      const productIds = getAllProductIds();
      this.products = await getProducts(productIds);
      return this.products;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return [];
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
      console.error('Error processing purchase:', error);
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
      console.error('Error saving purchase:', error);
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
      
      // Save updated purchases
      await AsyncStorage.setItem(PURCHASE_KEY, JSON.stringify(purchases));
      
      return true;
    } catch (error) {
      console.error('Error saving everything bundle:', error);
      return false;
    }
  }

  async isPurchased(productId) {
    try {
      // In development or beta mode, automatically return true for all products
      if (shouldUnlockAllFeatures()) {
        return true;
      }
      
      // Original code for production
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
      console.error('Error checking purchase status:', error);
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
      
      // For development or beta mode, simulate successful purchase immediately
      if (shouldUnlockAllFeatures()) {
        await this.processPurchase({ 
          productId,
          transactionReceipt: 'mock-receipt-for-development'
        });
        
        return true;
      }
      
      // Request the purchase
      await requestPurchase(productId);
      
      return true;
    } catch (error) {
      console.error('Error requesting purchase:', error);
      
      // Remove from pending purchases
      this.pendingPurchases = this.pendingPurchases.filter(id => id !== productId);
      
      return false;
    }
  }

  // Check if a pack is purchased
  async isPackPurchased(packId) {
    // In development or beta mode, all packs are purchased
    if (shouldUnlockAllFeatures()) {
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

  // Get all purchased packs
  async getPurchasedPacks() {
    try {
      // In development or beta mode, return all packs
      if (shouldUnlockAllFeatures()) {
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
      console.error('Error getting purchased packs:', error);
      return [];
    }
  }

  // Restore purchases from the store
  async restorePurchases() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // In development or beta mode, simulate all purchases restored
      if (shouldUnlockAllFeatures()) {
        // Simulate everything bundle purchase
        await this.processPurchase({
          productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
          transactionReceipt: 'mock-receipt-for-development'
        });
        return true;
      }
      
      // Get available purchases from store
      const purchases = await getAvailablePurchases();
      
      if (purchases && purchases.length > 0) {
        // Process each purchase
        for (const purchase of purchases) {
          await this.processPurchase(purchase);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return false;
    }
  }

  // Clean up listeners
  cleanup() {
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