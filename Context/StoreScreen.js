import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  SafeAreaView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRIVIA_PACKS, isBetaMode, setBetaMode } from '../Context/triviaPacks';
import iapManager, { PRODUCT_IDS, PACK_TO_PRODUCT_MAP } from '../Context/IAPManager';

const StoreScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [purchasedPacks, setPurchasedPacks] = useState([]);
  const [purchasingProductId, setPurchasingProductId] = useState(null);
  const [hasEverythingBundle, setHasEverythingBundle] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevControls, setShowDevControls] = useState(false);

  // Initialize IAP and load products when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const initializeStore = async () => {
        setLoading(true);
        
        try {
          // Check if in beta test mode
          const betaModeEnabled = await isBetaMode();
          setIsTestMode(betaModeEnabled);
          
          // Initialize IAP
          await iapManager.initialize();
          
          // Get products
          const availableProducts = await iapManager.fetchProducts();
          
          if (isActive) {
            setProducts(availableProducts);
          }
          
          // Check purchased packs
          await loadPurchasedPacks();
        } catch (error) {
          console.error('Error initializing store:', error);
          if (isActive) {
            Alert.alert('Store Error', 'There was a problem loading the store. Please try again later.');
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      // Check if dev controls should be shown
      const checkDevControls = async () => {
        try {
          const devControlsVisible = await AsyncStorage.getItem('trivia_dev_controls');
          if (devControlsVisible === 'true') {
            setShowDevControls(true);
          }
        } catch (error) {
          console.error('Error checking dev controls:', error);
        }
      };

      initializeStore();
      checkDevControls();

      return () => {
        isActive = false;
      };
    }, [])
  );

  // Load purchased packs
  const loadPurchasedPacks = async () => {
    try {
      // Check if everything bundle is purchased
      const bundlePurchased = await iapManager.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
      setHasEverythingBundle(bundlePurchased);
      
      // Get all purchased packs
      const purchased = await iapManager.getPurchasedPacks();
      setPurchasedPacks(purchased);
    } catch (error) {
      console.error('Error loading purchased packs:', error);
    }
  };

  // Handle purchase
  const handlePurchase = async (productId, packId) => {
    // Prevent multiple purchase requests
    if (purchasingProductId) return;
    
    // Check if already purchased
    if (purchasedPacks.includes(packId) || hasEverythingBundle) {
      Alert.alert('Already Purchased', 'You already own this pack!');
      return;
    }
    
    try {
      setPurchasingProductId(productId);
      
      // Request purchase
      const success = await iapManager.purchaseProduct(productId);
      
      if (success) {
        // Purchase initiated successfully, will be processed by listener
        // Just show an alert to let the user know to complete the purchase
        Alert.alert('Purchase Initiated', 'Please complete the purchase in the store.');
      }
    } catch (error) {
      console.error('Error initiating purchase:', error);
      Alert.alert('Purchase Error', 'There was a problem with the purchase. Please try again.');
    } finally {
      setPurchasingProductId(null);
    }
  };

  // Restore purchases
  const handleRestorePurchases = async () => {
    setRestoringPurchases(true);
    
    try {
      const success = await iapManager.restorePurchases();
      
      if (success) {
        // Refresh purchased packs list
        await loadPurchasedPacks();
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any previous purchases to restore.');
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Restore Error', 'There was a problem restoring your purchases. Please try again.');
    } finally {
      setRestoringPurchases(false);
    }
  };

  // Toggle beta test mode
  const toggleTestMode = async () => {
    try {
      const newTestMode = !isTestMode;
      
      // Set beta mode in triviaPacks.js
      await setBetaMode(newTestMode);
      
      // Update local state
      setIsTestMode(newTestMode);
      
      // Show confirmation
      Alert.alert(
        `TestFlight Mode ${newTestMode ? 'Enabled' : 'Disabled'}`,
        newTestMode 
          ? 'All premium packs are now unlocked for testing.'
          : 'Premium packs now require purchase.'
      );
      
      // Refresh purchased packs to update UI
      await loadPurchasedPacks();
    } catch (error) {
      console.error('Error toggling test mode:', error);
      Alert.alert('Error', 'Failed to toggle test mode.');
    }
  };

  // Handle title press to show dev controls
  const handleTitlePress = () => {
    // Increment tap count
    const newCount = devTapCount + 1;
    setDevTapCount(newCount);
    
    // After 5 taps, show dev controls
    if (newCount >= 5) {
      setShowDevControls(true);
      setDevTapCount(0);
      
      // Store dev controls visibility
      AsyncStorage.setItem('trivia_dev_controls', 'true').catch(() => {});
    }
  };

  // Hide dev controls
  const hideDevControls = () => {
    setShowDevControls(false);
    AsyncStorage.setItem('trivia_dev_controls', 'false').catch(() => {});
  };

  // Find product details
  const getProductDetails = (packId) => {
    const productId = PACK_TO_PRODUCT_MAP[packId];
    if (!productId) return null;
    
    return products.find(p => p.productId === productId);
  };

  // Check if a pack is purchased or unlocked in test mode
  const isPackAvailable = (packId) => {
    return isTestMode || hasEverythingBundle || purchasedPacks.includes(packId);
  };

  // Render pack item
  const renderPackItem = ({ item }) => {
    const product = getProductDetails(item.id);
    const isPurchased = isPackAvailable(item.id);
    const isPurchasing = purchasingProductId === PACK_TO_PRODUCT_MAP[item.id];
    
    return (
      <View style={styles.packItem}>
        <ImageBackground 
          source={item.image}
          style={styles.packImage}
          imageStyle={{ borderRadius: 10 }}
        >
          <View style={styles.packOverlay} />
          <View style={styles.packInfo}>
            <Text style={styles.packName}>{item.name}</Text>
            <Text style={styles.packDescription} numberOfLines={2}>
              {item.description || `Test your knowledge with this exciting ${item.category || 'trivia'} pack!`}
            </Text>
          </View>
          
          {item.category && (
            <View style={styles.packCategory}>
              <Text style={styles.packCategoryText}>{item.category}</Text>
            </View>
          )}
          
          {/* If test mode is on, show TestFlight badge */}
          {isTestMode && (
            <View style={styles.testModeBadge}>
              <Text style={styles.testModeBadgeText}>TESTFLIGHT</Text>
            </View>
          )}
        </ImageBackground>
        
        <View style={styles.packPriceContainer}>
          {isPurchased ? (
            <View style={styles.purchasedButton}>
              <Ionicons name="checkmark-circle" size={22} color="#00C853" />
              <Text style={styles.purchasedText}>OWNED</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.purchaseButton}
              onPress={() => handlePurchase(PACK_TO_PRODUCT_MAP[item.id], item.id)}
              disabled={isPurchasing || !product}
            >
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.purchaseButtonText}>
                    {product ? product.localizedPrice : item.defaultPrice || '$3.99'}
                  </Text>
                  <Ionicons name="cart-outline" size={22} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Find bundle product
  const bundleProduct = products.find(p => p.productId === PRODUCT_IDS.EVERYTHING_BUNDLE);

  return (
    <ImageBackground 
      source={require('../assets/gameshow.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="#FFD700" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerTitleContainer}
            onPress={handleTitlePress}
            activeOpacity={1}
          >
            <Text style={styles.headerTitle}>TriviaDare Store</Text>
            {isTestMode && (
              <Text style={styles.testFlagText}>TESTFLIGHT MODE</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={restoringPurchases}
          >
            {restoringPurchases ? (
              <ActivityIndicator size="small" color="#FFD700" />
            ) : (
              <Text style={styles.restoreText}>Restore</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* TestFlight Controls - shown when activated */}
        {showDevControls && (
          <View style={styles.devControlsContainer}>
            <View style={styles.devControlsHeader}>
              <Text style={styles.devControlsTitle}>TestFlight Controls</Text>
              <TouchableOpacity onPress={hideDevControls}>
                <Ionicons name="close" size={24} color="#FFD700" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.testModeContainer}>
              <Text style={styles.testModeLabel}>
                TestFlight Mode (Unlock All Packs)
              </Text>
              <Switch
                value={isTestMode}
                onValueChange={toggleTestMode}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={isTestMode ? "#00C853" : "#f4f3f4"}
              />
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00ff00" />
            <Text style={styles.loadingText}>Loading store...</Text>
          </View>
        ) : (
          <>
            {/* Bundle section */}
            {!hasEverythingBundle && bundleProduct && !isTestMode && (
              <View style={styles.bundleContainer}>
                <View style={styles.bundleCard}>
                  <Text style={styles.bundleTitle}>EVERYTHING BUNDLE</Text>
                  <Text style={styles.bundleDescription}>
                    Get all current and future premium packs at one incredible price!
                  </Text>
                  <View style={styles.savingsContainer}>
                    <Text style={styles.savingsText}>
                      Save {((TRIVIA_PACKS.Premium.length * 3.99 - 49.99) / (TRIVIA_PACKS.Premium.length * 3.99) * 100).toFixed(0)}%!
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.bundleButton}
                    onPress={() => handlePurchase(PRODUCT_IDS.EVERYTHING_BUNDLE, 'everything')}
                    disabled={purchasingProductId === PRODUCT_IDS.EVERYTHING_BUNDLE}
                  >
                    {purchasingProductId === PRODUCT_IDS.EVERYTHING_BUNDLE ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.bundleButtonText}>
                        {bundleProduct.localizedPrice || '$49.99'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Everything bundle purchased message */}
            {(hasEverythingBundle || isTestMode) && (
              <View style={styles.everythingPurchasedContainer}>
                <Ionicons name="trophy" size={30} color="#FFD700" />
                <Text style={styles.everythingPurchasedText}>
                  {isTestMode ? 'TestFlight Mode Enabled' : 'You own the Everything Bundle!'}
                </Text>
                <Text style={styles.everythingPurchasedSubtext}>
                  All current and future packs are unlocked.
                </Text>
              </View>
            )}

            {/* Individual packs */}
            <FlatList
              data={TRIVIA_PACKS.Premium}
              keyExtractor={(item) => item.id}
              renderItem={renderPackItem}
              contentContainerStyle={styles.packsList}
              numColumns={1}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No premium packs available</Text>
                </View>
              )}
            />
          </>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 40 : 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backButton: {
    padding: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  testFlagText: {
    color: '#00C853',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  restoreButton: {
    padding: 10,
  },
  restoreText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // TestFlight controls
  devControlsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 15,
    margin: 15,
    padding: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  devControlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
    paddingBottom: 10,
  },
  devControlsTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testModeLabel: {
    color: 'white',
    fontSize: 16,
    flex: 1,
    paddingRight: 10,
  },
  
  // Bundle section
  bundleContainer: {
    padding: 15,
    marginBottom: 10,
  },
  bundleCard: {
    backgroundColor: 'rgba(0, 50, 100, 0.8)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  bundleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bundleDescription: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  savingsContainer: {
    backgroundColor: 'rgba(0, 200, 0, 0.3)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  savingsText: {
    color: '#00ff00',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bundleButton: {
    backgroundColor: '#00ff00',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  bundleButtonText: {
    color: 'black',
    fontSize: 22,
    fontWeight: 'bold',
  },
  
  // Everything purchased container
  everythingPurchasedContainer: {
    margin: 15,
    padding: 15,
    backgroundColor: 'rgba(0, 200, 83, 0.2)',
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00C853',
  },
  everythingPurchasedText: {
    color: '#00ff00',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  everythingPurchasedSubtext: {
    color: 'white',
    fontSize: 16,
    marginTop: 5,
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  
  // Packs list
  packsList: {
    paddingHorizontal: 15,
    paddingBottom: 30,
  },
  packItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  packImage: {
    height: 150,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    overflow: 'hidden',
  },
  packOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  packInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  packName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  packDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  packCategory: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 155, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'white',
  },
  packCategoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  testModeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 200, 83, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'white',
  },
  testModeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  packPriceContainer: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  purchaseButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  purchaseButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  purchasedButton: {
    backgroundColor: 'rgba(0, 200, 83, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00C853',
  },
  purchasedText: {
    color: '#00C853',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default StoreScreen;