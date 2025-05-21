import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  View, 
  Modal, 
  ImageBackground, 
  Dimensions,
  Platform,
  TextInput,
  Alert,
  ScrollView,
  FlatList,
  Animated,
  BackHandler,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useSettings } from '../Context/Settings';
import { useCustomDares } from '../Context/CustomDaresContext';
import { debounce } from 'lodash';
import { useFocusEffect } from '@react-navigation/native';
import iapManager from '../Context/IAPManager'; // Add this import
import { CommonActions } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_PADDING = SCREEN_WIDTH * 0.04; // 4% of screen width
const COLUMNS = 2;
const CARD_MARGIN = SCREEN_WIDTH * 0.02; // 2% of screen width
const CARD_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - (CARD_MARGIN * (COLUMNS + 1))) / COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // Maintain poker card aspect ratio

// Function to calculate responsive font sizes
const scaleFontSize = (size) => {
  const scaleFactor = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
  return Math.round(size * scaleFactor);
};

const PackCard = memo(({ item, packCounts, customCounts, onPress, showDareCounts, isPurchased, price, onPurchase }) => {
  const totalCount = (packCounts[item.name] || 0) + (customCounts[item.name] || 0);
  const [cardAnim] = useState(new Animated.Value(0));
  
  useEffect(() => {
    // Subtle card hover animation on mount
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(cardAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);
  
  const cardTransform = {
    transform: [
      {
        scale: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02]
        })
      }
    ]
  };
  
  return (
    <Animated.View style={[styles.cardContainer, cardTransform]}>
      <TouchableOpacity
        style={[
          styles.card,
          isPurchased && price && styles.purchasedCard // Add green border for purchased premium packs
        ]}
        onPress={() => isPurchased ? onPress(item) : onPurchase(item)}
        activeOpacity={Platform.OS === 'android' ? 0.7 : 0.9}
      >
        <ImageBackground 
          source={item.image} 
          style={styles.cardImage}
          imageStyle={styles.cardImageStyle}
          fadeDuration={Platform.OS === 'android' ? 300 : 0}
        >
          {/* Price Badge - shown if pack is not purchased and has a price */}
          {!isPurchased && price && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>${price}</Text>
            </View>
          )}
          
          {/* Age Restriction Badge */}
          {item.ageRestricted && (
            <View style={styles.ageRestrictedBadge}>
              <Text style={styles.ageRestrictedText}>18+</Text>
            </View>
          )}
          
          {/* Lock Overlay for non-purchased premium packs */}
          {!isPurchased && price ? (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={40} color="#FFD700" />
            </View>
          ) : isPurchased && price ? (
            <View style={styles.purchasedBadge}>
              <Text style={styles.purchasedText}>OWNED</Text>
            </View>
          ) : null}
          
          <View style={styles.cardOverlay}>
            <Text 
              style={styles.packName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            {showDareCounts && (
              <Text style={styles.packDareCount}>
                {totalCount} Dares {customCounts[item.name] > 0 && `(${customCounts[item.name]} Custom)`}
              </Text>
            )}
          </View>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
});

const DarePackSelectionScreen = ({ navigation }) => {
  const { addCustomDare, getCustomDares, getCustomDareCount, removeCustomDare } = useCustomDares();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [dareCount, setDareCount] = useState(5);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDealAnimation, setShowDealAnimation] = useState(false);
  const [packCounts, setPackCounts] = useState({});
  const [customCounts, setCustomCounts] = useState({});
  const [previewDares, setPreviewDares] = useState([]);
  const [lastTap, setLastTap] = useState(0);
  const [customDareText, setCustomDareText] = useState('');
  const [showCustomDareInput, setShowCustomDareInput] = useState(false);
  const [customDareSuccess, setCustomDareSuccess] = useState(false);
  const [showCustomDaresModal, setShowCustomDaresModal] = useState(false);
  const [customDares, setCustomDares] = useState([]);
  const [editingDare, setEditingDare] = useState(null);
  const [contentOpacity] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(true);
  const [cardsAnimation] = useState(new Animated.Value(0));
  // Add state for showing/hiding numbers - default to hiding
  const [showDareCounts, setShowDareCounts] = useState(false);
  // Add state for purchase status
  const [purchaseStates, setPurchaseStates] = useState({});

  // Handle Android back button
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          if (modalVisible) {
            handleBack();
            return true;
          }
          if (showCustomDaresModal) {
            setShowCustomDaresModal(false);
            setTimeout(() => {
              setModalVisible(true);
              setIsFlipped(true);
            }, 300);
            return true;
          }
          return false;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [modalVisible, showCustomDaresModal])
  );

  // Set up purchase completion callback
  useEffect(() => {
    // Set callback for purchases
    const setupPurchaseCallback = async () => {
      // Initialize IAP manager 
      await iapManager.initialize();
      
      // Set the purchase completion callback
      iapManager.onPurchaseComplete = async () => {
        console.log('Purchase callback triggered');
        // Refresh purchase states
        await checkPurchaseStates();
        // Show success message
        Alert.alert('Purchase Successful', 'Your purchase has been completed!');
      };
    };
    
    setupPurchaseCallback();
    
    // Cleanup on unmount
    return () => {
      if (iapManager) {
        iapManager.onPurchaseComplete = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isFlipped) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300, // Faster on Android
        delay: Platform.OS === 'android' ? 300 : 400,
        useNativeDriver: true,
      }).start();
    } else {
      contentOpacity.setValue(0);
    }
  }, [isFlipped]);

  useEffect(() => {
    // Animate cards when screen loads
    Animated.timing(cardsAnimation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Screen focused');
      // Refresh purchase states when screen is focused
      checkPurchaseStates();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
  const loadCounts = async () => {
    setIsLoading(true);
    const counts = {};
    const customCounts = {};
    
    try {
      console.log('📊 Loading pack counts and dare counts');
      
      // On Android, process in smaller batches to prevent ANR
      if (Platform.OS === 'android') {
        const batchSize = 3;
        for (let i = 0; i < packs.length; i += batchSize) {
          const batchPacks = packs.slice(i, i + batchSize);
          for (const pack of batchPacks) {
            counts[pack.name] = Array.isArray(pack.dares) ? pack.dares.length : 0;
            customCounts[pack.name] = await getCustomDareCount(pack.name);
          }
        }
      } else {
        // Original iOS implementation
        for (const pack of packs) {
          counts[pack.name] = Array.isArray(pack.dares) ? pack.dares.length : 0;
          customCounts[pack.name] = await getCustomDareCount(pack.name);
        }
      }
    } catch (error) {
      console.error('Error loading dare counts:', error);
    } finally {
      setPackCounts(counts);
      setCustomCounts(customCounts);
      setIsLoading(false);
    }
  };

  console.log('🚀 Loading counts and checking purchase states');
  loadCounts();
  
  // Check IAP environment
  console.log('🔒 Production mode active:', !__DEV__);
  console.log('📱 Platform:', Platform.OS);
  
  // Add more explicit logging around IAP checks
  console.log('💰 Checking purchase states for premium packs...');
  checkPurchaseStates().then(() => {
    console.log('✅ Purchase state checking complete');
    
    // Log premium packs status
    const premiumPacks = packs.filter(pack => pack.isPremium);
    premiumPacks.forEach(pack => {
      console.log(`📦 Premium pack: ${pack.name}, purchased: ${purchaseStates[pack.name] === true}`);
    });
  });
}, []);

  const checkPurchaseStates = async () => {
  try {
    const states = {};
    
    console.log('=== Checking Purchase States ===');
    
    // Check if we are in production/TestFlight
    const isProductionBuild = !__DEV__;
    console.log('Is production build:', isProductionBuild);
    
    // Initialize IAP manager if needed
    if (!iapManager.isInitialized) {
      await iapManager.initialize();
    }
    
    // Get the purchased dares packs
    const purchasedDaresPacks = await iapManager.getPurchasedDaresPacks();
    console.log('Purchased dares packs:', purchasedDaresPacks);
    
    // Check bundle purchase first
    const hasBundle = await iapManager.isPurchased(iapManager.PRODUCT_IDS.EVERYTHING_BUNDLE);
    console.log('Everything bundle purchased:', hasBundle);
    
    // Set purchase states for each pack
    for (const pack of packs) {
      // Free packs are always available
      if (!pack.isPremium) {
        states[pack.name] = true;
        continue;
      }
      
      // If bundle is purchased, all packs are available
      if (hasBundle) {
        states[pack.name] = true;
        continue;
      }
      
      // Map pack names to the keys used in DARES_TO_PRODUCT_MAP
      let packKey = '';
      switch (pack.name) {
        case 'Spicy':
          packKey = 'spicy';
          break;
        case 'House Party':
          packKey = 'houseparty';
          break;
        case 'Couples':
          packKey = 'couples';
          break;
        case 'Bar':
          packKey = 'bar';
          break;
      }
      
      // Check if the specific pack is purchased
      if (packKey && purchasedDaresPacks.includes(packKey)) {
        states[pack.name] = true;
      } else {
        // Premium packs are locked by default
        states[pack.name] = false;
      }
    }
    
    // Log detailed purchase state information for debugging
    console.log('Final purchase states:', states);
    
    // Extra logging for premium packs for clarity
    const premiumPacks = packs.filter(p => p.isPremium);
    for (const pack of premiumPacks) {
      console.log(`Premium pack "${pack.name}" locked status: ${!states[pack.name]}`);
    }
    
    setPurchaseStates(states);
  } catch (error) {
    console.error('Error checking purchase states:', error);
    
    // Fallback: Always set premium packs as locked in case of any errors
    const fallbackStates = {};
    packs.forEach(pack => {
      fallbackStates[pack.name] = !pack.isPremium;
    });
    console.log('Using fallback purchase states due to error:', fallbackStates);
    setPurchaseStates(fallbackStates);
  }
};

  const handlePurchase = async (pack) => {
    try {
      console.log('Starting purchase flow for:', pack.name);
      
      // Map pack names to product IDs
      let packKey = '';
      switch (pack.name) {
        case 'Spicy':
          packKey = 'spicy';
          break;
        case 'House Party':
          packKey = 'houseparty';
          break;
        case 'Couples':
          packKey = 'couples';
          break;
        case 'Bar':
          packKey = 'bar';
          break;
        default:
          throw new Error('Unknown pack');
      }

      // First verify this pack is actually mapped to a product ID
      if (!packKey || !iapManager.DARES_TO_PRODUCT_MAP[packKey]) {
        console.error('No product ID found for pack:', pack.name);
        Alert.alert('Purchase Error', 'Could not find this product. Please try again later.');
        return;
      }

      // Get the actual product ID
      const productId = iapManager.DARES_TO_PRODUCT_MAP[packKey];
      console.log('Initiating purchase for product ID:', productId);
      
      // Show purchase confirmation dialog
      Alert.alert(
        `Purchase ${pack.name}`,
        `Would you like to purchase the ${pack.name} pack for $${pack.price}?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Purchase",
            onPress: async () => {
              try {
                // Show loading indicator if you have one
                setIsLoading(true);
                
                console.log('Calling purchaseProduct() with ID:', productId);
                const success = await iapManager.purchaseProduct(productId);
                
                if (success) {
                  console.log('Purchase initiated successfully');
                  // Note: Final success is handled by the purchaseUpdateListener
                  // in the IAPManager which will trigger onPurchaseComplete callback
                } else {
                  console.log('Purchase not initiated');
                  Alert.alert('Purchase Cancelled', 'The purchase was not completed.');
                }
              } catch (error) {
                console.error('Purchase error:', error);
                Alert.alert('Purchase Error', 'An error occurred during purchase. Please try again.');
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Purchase setup error:', error);
      Alert.alert('Error', 'There was a problem setting up the purchase. Please try again.');
    }
  };

  const getPreviewDares = useCallback(async (pack, count = 2) => {
    if (!pack || !Array.isArray(pack.dares)) return [];
    
    try {
      const standardDares = [...pack.dares];
      const customDares = await getCustomDares(pack.name);
      const allDares = [...standardDares, ...customDares.map(d => d.text)];
      return allDares.sort(() => 0.5 - Math.random()).slice(0, count);
    } catch (error) {
      console.error('Error getting preview dares:', error);
      return [];
    }
  }, [getCustomDares]);
  
  const handleCreateCustomDare = async () => {
    if (!customDareText.trim() || !selectedPack) return;
    
    // Dismiss keyboard on Android
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
    
    try {
      const success = await addCustomDare(selectedPack.name, customDareText.trim());
      if (success) {
        setCustomDareSuccess(true);
        setCustomDareText('');
        const newCount = await getCustomDareCount(selectedPack.name);
        setCustomCounts(prev => ({
          ...prev,
          [selectedPack.name]: newCount
        }));
        setPreviewDares(await getPreviewDares(selectedPack));
        setTimeout(() => {
          setCustomDareSuccess(false);
          setShowCustomDareInput(false);
        }, 2000);
      } else {
        Alert.alert('Error', 'Failed to add custom dare. Please try again.');
      }
    } catch (error) {
      console.error('Error creating custom dare:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };
  
  const handleEditDare = async (dare) => {
    if (!dare.text.trim()) return;
    
    try {
      await removeCustomDare(selectedPack.name, dare.id);
      const success = await addCustomDare(selectedPack.name, dare.text);
      if (success) {
        const updatedDares = await getCustomDares(selectedPack.name);
        setCustomDares(updatedDares);
        setEditingDare(null);
      }
    } catch (error) {
      console.error('Error editing dare:', error);
      Alert.alert('Error', 'Failed to edit the dare. Please try again.');
    }
  };
  
  const handleSelectPack = useCallback(
    debounce(async (pack) => {
      try {
        console.log('Pack selected:', pack.name);
        if (modalVisible) return;
        const now = Date.now();
        if (now - lastTap < 300) return;
        setLastTap(now);
        setSelectedPack(pack);
        setDareCount(5);
        setModalVisible(true);
        // Slight delay before flip animation - shorter on Android
        setTimeout(() => {
          setIsFlipped(true);
        }, Platform.OS === 'android' ? 50 : 100);
        
        // Load preview dares
        try {
          const dares = await getPreviewDares(pack);
          setPreviewDares(dares);
        } catch (error) {
          console.error('Error loading preview dares:', error);
        }
      } catch (error) {
        console.error('Error in handleSelectPack:', error);
      }
    }, 300, { leading: true, trailing: false }),
    [modalVisible, lastTap, getPreviewDares]
  );
  
  // Enhanced deal cards animation
  const handleConfirmDares = useCallback(() => {
    setShowDealAnimation(true);
    
    // Card dealing animation and delay settings are already in place
    setTimeout(() => {
      navigation.navigate('DareOnlyScreen', { 
        packName: selectedPack.name, 
        dareCount,
        // Add platform-specific navigation options
        ...(Platform.OS === 'android' ? {
          animation: 'slide_from_right'
        } : {})
      });
      setModalVisible(false);
      setIsFlipped(false);
      setShowDealAnimation(false);
      setShowCustomDareInput(false);
      setCustomDareText('');
    }, Platform.OS === 'android' ? 800 : 1000); // Slightly faster on Android
  }, [selectedPack, dareCount, navigation]);
  
  const handleBack = useCallback(() => {
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
    
    setIsFlipped(false);
    setTimeout(() => {
      setModalVisible(false);
      setShowPreview(false);
      setShowCustomDareInput(false);
      setCustomDareText('');
    }, Platform.OS === 'android' ? 600 : 800); // Slightly faster on Android
  }, []);

  // Function to handle long press on the title to toggle showing numbers
  const handleTitleLongPress = () => {
    // Start a timeout for 5 seconds
    const timer = setTimeout(() => {
      // Toggle showing numbers
      setShowDareCounts(prev => !prev);
      
      // Provide haptic feedback when toggled
      try {
        if (Platform.OS === 'ios') {
          const ReactNative = require('react-native');
          if (ReactNative.Haptics) {
            ReactNative.Haptics.impactAsync(ReactNative.Haptics.ImpactFeedbackStyle.Medium);
          }
        } else if (Platform.OS === 'android') {
          const { Vibration } = require('react-native');
          Vibration.vibrate(100);
        }
      } catch (error) {
        console.log('Haptic feedback error:', error);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  };

  const packs = [
    {
      name: 'Family Friendly',
      image: require('../assets/DaresOnly/familyfun.jpg'),
      description: 'Fun for the whole family! Dares suitable for all ages.',
      dares: require('../Packs/DaresOnly/family_friendly.json'),
      isPremium: false
    },
    {
      name: 'IceBreakers',
      image: require('../assets/DaresOnly/icebreakers.jpg'),
      description: 'More of a Truth than a dare, just simple questions to learn about one another.',
      dares: require('../Packs/DaresOnly/icebreakers.json'),
      isPremium: false
    },
    {
      name: 'Out In Public',
      image: require('../assets/DaresOnly/public.jpg'),
      description: 'Dares that involve interactions in social settings.',
      dares: require('../Packs/DaresOnly/out_in_public.json'),
      isPremium: false
    },
    {
      name: 'Music Mania',
      image: require('../assets/DaresOnly/music.jpg'),
      description: 'For music lovers, dares involve singing, dancing, or performing to your favorite tunes.',
      dares: require('../Packs/DaresOnly/music_mania.json'),
      isPremium: false
    },
    {
      name: 'Office Fun',
      image: require('../assets/DaresOnly/office.jpg'),
      description: 'Lighten up the workday with office-appropriate dares that build teamwork and camaraderie.',
      dares: require('../Packs/DaresOnly/office_fun.json'),
      isPremium: false
    },
    {
      name: 'Adventure',
      image: require('../assets/DaresOnly/adventure.jpg'),
      description: 'Challenge your limits with thrilling and adventurous dares perfect for the fearless.',
      dares: require('../Packs/DaresOnly/adventure_seekers.json'),
      isPremium: false
    },
    {
      name: 'Couples',
      image: require('../assets/DaresOnly/couples.jpg'),
      description: 'Strengthen your bond with fun and romantic dares.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/couples.json'),
      isPremium: true,
      price: '3.99'
    },
    {
      name: 'Bar',
      image: require('../assets/DaresOnly/bar.jpg'),
      description: 'Night out? Spice it up with these bar-themed dares. 18+ only.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/bar.json'),
      isPremium: true,
      price: '3.99'
    },
    {
      name: 'House Party',
      image: require('../assets/DaresOnly/houseparty.jpg'),
      description: 'Wanting to make the house party even more crazy? This pack is for you!',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/house_party.json'),
      isPremium: true,
      price: '3.99'
    },
    {
      name: 'Spicy',
      image: require('../assets/DaresOnly/spicy.jpg'),
      description: 'Turn up the heat with these daring challenges. 18+ only.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/spicy.json'),
      isPremium: true,
      price: '3.99'
    },
  ];

  const renderItem = useCallback(({ item, index }) => {
  // Calculate card entrance animation delay
  const animationDelay = index * 100;
  
  // Add explicit logging for premium packs
  if (item.isPremium) {
    console.log(`Premium pack ${item.name}:`, {
      state: purchaseStates[item.name],
      isPremium: item.isPremium,
      price: item.price,
      isLocked: !(purchaseStates[item.name] === true)
    });
  }
  
  // Make sure we use precise equality check - not using default value
  const isPurchased = purchaseStates[item.name] === true;
  
  return (
    <Animated.View 
      style={{
        opacity: cardsAnimation,
        transform: [
          {
            translateY: cardsAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0]
            })
          }
        ]
      }}
    >
      <PackCard
        item={item}
        packCounts={packCounts}
        customCounts={customCounts}
        onPress={handleSelectPack}
        showDareCounts={showDareCounts}
        isPurchased={isPurchased} // Use the explicit value
        price={item.isPremium ? item.price : null}
        onPurchase={handlePurchase}
      />
    </Animated.View>
  );
}, [packCounts, customCounts, handleSelectPack, cardsAnimation, showDareCounts, purchaseStates, handlePurchase]);

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require('../assets/redfelt.jpg')} 
        style={styles.backgroundImage}
        fadeDuration={Platform.OS === 'android' ? 300 : 0}
      >
        <View style={styles.feltOverlay} />
        <View style={styles.mainContent}>
          {/* Header Section with enhanced casino styling - UPDATED FOR CENTERING */}
          <View style={styles.header}>
            <TouchableOpacity
  style={styles.backButton}
  onPress={() => {
    // Use the CommonActions to dispatch an immediate back action
    navigation.dispatch(CommonActions.goBack());
  }}
  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
>
  <Ionicons name="arrow-back" size={24} color="#FFD700" />
</TouchableOpacity>
            
            {/* This empty view balances the header */}
            <View style={styles.headerSpacer} />
            
            <View style={styles.titleContainerCentered}>
              <Pressable
                onLongPress={handleTitleLongPress}
                delayLongPress={1000}
                style={styles.titlePressable}
              >
                <Text style={styles.title}>Dare Pack</Text>
                <View style={styles.titleDecoration}>
                  <View style={styles.titleLine} />
                  <Ionicons name="diamond" size={24} color="#FFD700" />
                  <View style={styles.titleLine} />
                </View>
                {showDareCounts && (
                  <Text style={styles.developerModeText}>Developer Mode</Text>
                )}
              </Pressable>
            </View>
            
            {/* This empty view balances the back button */}
            <View style={styles.headerSpacer} />
          </View>
  
          {/* Grid Section */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Animatable.Text 
                animation="pulse" 
                iterationCount="infinite" 
                style={styles.loadingText}
              >
                Loading dare packs...
              </Animatable.Text>
            </View>
          ) : (
            <FlatList
              data={packs}
              renderItem={renderItem}
              keyExtractor={item => item.name}
              numColumns={2}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.row}
              ListHeaderComponent={
                <Animatable.View 
                  animation="fadeIn" 
                  duration={800} 
                  delay={300}
                >
                  <Text style={styles.instruction}>
                    Select a dare pack to begin
                  </Text>
                </Animatable.View>
              }
              ListFooterComponent={<View style={{ height: 20 }} />}
              initialNumToRender={Platform.OS === 'android' ? 4 : 6}
              maxToRenderPerBatch={Platform.OS === 'android' ? 2 : 4}
              windowSize={Platform.OS === 'android' ? 3 : 5}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>
  
        {/* Enhanced Casino-style Modal */}
        <Modal
          animationType={Platform.OS === 'android' ? "fade" : "fade"}
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleBack}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
            <Animated.View 
              style={[
                styles.centeredView,
                {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                }
              ]}
            >
              <Animatable.View
                animation={isFlipped ? 'fadeIn' : 'fadeOut'}
                duration={Platform.OS === 'android' ? 200 : 300}
                style={[styles.modalContainer]}
                useNativeDriver
              >
                <Animatable.View
                  animation={isFlipped ? 'flipInY' : 'flipOutY'}
                  duration={Platform.OS === 'android' ? 500 : 600}
                  style={[styles.modalView]}
                  useNativeDriver
                >
                  <Animated.View
                    style={[
                      styles.modalContent,
                      {
                        opacity: contentOpacity,
                        transform: [{
                          scale: contentOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1]
                          })
                        }]
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={handleBack}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                      <Ionicons name="close-circle" size={24} color="#FFD700" />
                    </TouchableOpacity>
  
                    <Text style={styles.modalTitle}>{selectedPack?.name}</Text>
                    <View style={styles.casinoSeparator}>
                      <View style={styles.separatorLine} />
                      <Ionicons name="diamond" size={16} color="#FFD700" />
                      <View style={styles.separatorLine} />
                    </View>
                    {showDareCounts && (
                      <Text style={styles.modalSubtitle}>
                        {(packCounts[selectedPack?.name] || 0) + (customCounts[selectedPack?.name] || 0)} Dares Available
                        {customCounts[selectedPack?.name] > 0 && ` (${customCounts[selectedPack?.name]} Custom)`}
                      </Text>
                    )}
                    <Text style={styles.modalDescription}>{selectedPack?.description}</Text>
  
                    {/* Casino-styled Custom Dare Buttons */}
                    <View style={styles.customDareButtonsContainer}>
                      <TouchableOpacity
                        style={[styles.customDareButton, showCustomDareInput && styles.customDareButtonActive]}
                        onPress={() => {
                          setShowCustomDareInput(!showCustomDareInput);
                          if (showCustomDaresModal) setShowCustomDaresModal(false);
                          if (Platform.OS === 'android' && showCustomDareInput) {
                            Keyboard.dismiss();
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.customDareButtonText}>
                          {showCustomDareInput ? 'Cancel Custom Dare' : 'Create Custom Dare'}
                        </Text>
                      </TouchableOpacity>
  
                      <TouchableOpacity
                        style={[styles.viewCustomButton, showCustomDaresModal && styles.viewCustomButtonActive]}
                        onPress={async () => {
                          if (Platform.OS === 'android') {
                            Keyboard.dismiss();
                          }
                          try {
                            const dares = await getCustomDares(selectedPack.name);
                            setCustomDares(dares);
                            setModalVisible(false);
                            setTimeout(() => {
                              setShowCustomDaresModal(true);
                            }, 100);
                          } catch (error) {
                            console.error('Error loading custom dares:', error);
                            Alert.alert('Error', 'Failed to load custom dares');
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewCustomButtonText}>View Custom Dares</Text>
                      </TouchableOpacity>
                    </View>
  
                    {/* Custom Dare Input */}
                    {showCustomDareInput && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={Platform.OS === 'android' ? 200 : 300}
                        style={styles.customDareInputContainer}
                      >
                        <TextInput
                          style={styles.customDareInput}
                          value={customDareText}
                          onChangeText={setCustomDareText}
                          placeholder="Type your custom dare here..."
                          multiline
                          maxLength={200}
                          autoFocus={!Platform.OS === 'android'} // Avoid autofocus on Android
                          blurOnSubmit={Platform.OS === 'android'}
                          returnKeyType="done"
                        />
                        <TouchableOpacity
                          style={[
                            styles.createDareButton,
                            !customDareText.trim() && styles.createDareButtonDisabled
                          ]}
                          onPress={handleCreateCustomDare}
                          disabled={!customDareText.trim()}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.createDareButtonText}>Add Custom Dare</Text>
                        </TouchableOpacity>
                      </Animatable.View>
                    )}
  
                    {/* Success Message */}
                    {customDareSuccess && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={300}
                        style={styles.successMessage}
                      >
                        <Text style={styles.successText}>✓ Custom Dare Added!</Text>
                      </Animatable.View>
                    )}
  
                    {/* Preview Section */}
                    <TouchableOpacity
                      style={[styles.previewButton, showPreview && styles.previewButtonActive]}
                      onPress={() => setShowPreview(!showPreview)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.previewButtonText}>
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                      </Text>
                    </TouchableOpacity>
  
                    {showPreview && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={Platform.OS === 'android' ? 200 : 300}
                        style={styles.previewContainer}
                      >
                        {previewDares.map((dare, index) => (
                          <Text key={index} style={styles.previewDare}>• {dare}</Text>
                        ))}
                      </Animatable.View>
                    )}
  
                    {/* Enhanced Counter Section styled like a casino chips counter */}
                    <View style={styles.counterContainer}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => setDareCount(Math.max(dareCount - 1, 1))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.counterButtonText}>-</Text>
                      </TouchableOpacity>
                      <View style={styles.counterTextContainer}>
                        <Text style={styles.counterText}>{dareCount}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => setDareCount(Math.min(dareCount + 1, 10))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
  
                    <TouchableOpacity
                      style={[styles.buttonClose, styles.confirmButton]}
                      onPress={handleConfirmDares}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.confirmButtonText}>Deal Cards</Text>
                      <Ionicons name="card" size={20} color="white" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  </Animated.View>
                </Animatable.View>
              </Animatable.View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Modal>
  
        {/* Custom Dares Management Modal - Casino styled */}
        <Modal
          visible={showCustomDaresModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowCustomDaresModal(false);
            setTimeout(() => {
              setModalVisible(true);
              setIsFlipped(true);
            }, 300);
          }}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
            <TouchableOpacity 
              style={styles.centeredView} 
              activeOpacity={1} 
              onPress={() => {
                if (Platform.OS === 'android') {
                  Keyboard.dismiss();
                }
              }}
            >
              <Animatable.View
                animation="slideInUp"
                duration={Platform.OS === 'android' ? 200 : 300}
                style={[styles.modalView, styles.customDaresModalView]}
              >
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      Keyboard.dismiss();
                    }
                    setShowCustomDaresModal(false);
                    setTimeout(() => {
                      setModalVisible(true);
                      setIsFlipped(true);
                    }, 300);
                  }}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Ionicons name="close-circle" size={24} color="#FFD700" />
                </TouchableOpacity>
  
                <Text style={styles.modalTitle}>Custom Dares</Text>
                <View style={styles.casinoSeparator}>
                  <View style={styles.separatorLine} />
                  <Ionicons name="diamond" size={16} color="#FFD700" />
                  <View style={styles.separatorLine} />
                </View>
                
                {customDares.length === 0 ? (
                  <Text style={styles.noDaresText}>No custom dares yet</Text>
                ) : (
                  <ScrollView 
                    style={styles.daresList}
                    showsVerticalScrollIndicator={true}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {customDares.map((dare) => (
                      <View key={dare.id} style={styles.dareItem}>
                        {editingDare?.id === dare.id ? (
                          <TextInput
                            style={styles.editDareInput}
                            value={editingDare.text}
                            onChangeText={(text) => setEditingDare({...editingDare, text})}
                            multiline
                            autoFocus={!Platform.OS === 'android'} // Avoid autofocus on Android
                            returnKeyType="done"
                            blurOnSubmit={Platform.OS === 'android'}
                          />
                        ) : (
                          <Text style={styles.dareText}>{dare.text}</Text>
                        )}
                        <View style={styles.dareActions}>
                          {editingDare?.id === dare.id ? (
                            <>
                              <TouchableOpacity
                                style={styles.saveButton}
                                onPress={() => handleEditDare(editingDare)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="checkmark" size={20} color="#4CAF50" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                  if (Platform.OS === 'android') {
                                    Keyboard.dismiss();
                                  }
                                  setEditingDare(null);
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="close" size={20} color="#666" />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => setEditingDare(dare)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="pencil" size={20} color="#2196F3" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => {
                                  Alert.alert(
                                    'Delete Dare',
                                    'Are you sure you want to delete this dare?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: async () => {
                                          await removeCustomDare(selectedPack.name, dare.id);
                                          setCustomDares(dares => dares.filter(d => d.id !== dare.id));
                                          const newCount = await getCustomDareCount(selectedPack.name);
                                          setCustomCounts(prev => ({
                                            ...prev,
                                            [selectedPack.name]: newCount
                                          }));
                                        }
                                      }
                                    ]
                                  );
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="trash" size={20} color="#ff0000" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </Animatable.View>
            </TouchableOpacity>
          </TouchableWithoutFeedback>
        </Modal>
      </ImageBackground>
    </View>
  );
};

// Add the new styles here
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  feltOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Changed from 0.65 to 0.5 for lighter background
  },
  mainContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Changed to ensure proper spacing
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  headerSpacer: {
    width: 40, // Match the size of the back button for balance
    height: 30,
  },
  titleContainerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 25,
  },
  titlePressable: {
    alignItems: 'center',
  },
  title: {
    fontSize: scaleFontSize(32),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    // Removed marginLeft: 20 that was causing off-center alignment
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  titleLine: {
    height: 1,
    width: 50,
    backgroundColor: '#FFD700',
    marginHorizontal: 8,
  },
  developerModeText: {
    color: '#ff4500',
    fontSize: 12,
    marginTop: 3,
  },
  instruction: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    fontWeight: '500',
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 30,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginVertical: 8,
  },
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  // Add purchased card styling
  purchasedCard: {
    borderColor: '#00C853',
    borderWidth: 2,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  cardImageStyle: {
    borderRadius: 10,
    resizeMode: 'cover',
  },
  cardOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 5,
  },
  packName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  packDareCount: {
    color: '#FFD700',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFD700',
    fontSize: 18,
    textAlign: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    padding: 10,
    height: 'auto',
  },
  modalView: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    zIndex: 10,
  },
  modalTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  casinoSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    marginBottom: 15,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
    marginHorizontal: 10,
  },
  modalSubtitle: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDescription: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  customDareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  customDareButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  customDareButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  customDareButtonText: {
    color: '#FFD700',
    fontWeight: '500',
    fontSize: 12,
  },
  viewCustomButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  viewCustomButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  viewCustomButtonText: {
    color: '#FFD700',
    fontWeight: '500',
    fontSize: 12,
  },
  customDareInputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  customDareInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: 'white',
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 10,
  },
  createDareButton: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  createDareButtonDisabled: {
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
  },
  createDareButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  successMessage: {
    backgroundColor: 'rgba(0, 200, 0, 0.3)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    alignItems: 'center',
  },
  successText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  previewButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  previewButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  previewButtonText: {
    color: '#FFD700',
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  previewDare: {
    color: 'white',
    marginBottom: 8,
    lineHeight: 20,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: 8,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  counterButtonText: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  counterTextContainer: {
    paddingHorizontal: 20,
  },
  counterText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonClose: {
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: '#FFD700',
  },
  confirmButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  customDaresModalView: {
    height: '80%',
    alignItems: 'stretch',
  },
  daresList: {
    width: '100%',
    marginTop: 10,
    flex: 1,
  },
  dareItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  dareText: {
    color: 'white',
    flex: 1,
  },
  editDareInput: {
    color: 'white',
    flex: 1,
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 8,
    borderRadius: 5,
    marginRight: 8,
  },
  dareActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 5,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 5,
    marginLeft: 8,
  },
  saveButton: {
    padding: 5,
    marginLeft: 8,
  },
  cancelButton: {
    padding: 5,
    marginLeft: 8,
  },
  noDaresText: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  priceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    zIndex: 2,
  },
  priceText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ageRestrictedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'red',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  ageRestrictedText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  purchasedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#00C853',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 3,
  },
  purchasedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default DarePackSelectionScreen;