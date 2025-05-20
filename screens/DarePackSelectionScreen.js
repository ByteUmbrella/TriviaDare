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
        style={styles.card}
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
          {!isPurchased && price && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={40} color="#FFD700" />
            </View>
          )}
          
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
 
    loadCounts();
    checkPurchaseStates();
  }, []);

  const checkPurchaseStates = async () => {
    try {
      const states = {};
      
      console.log('=== DEBUG PURCHASE STATES ===');
      
      // Initialize IAP manager first
      const initialized = await iapManager.initialize();
      console.log('IAP Manager initialized:', initialized);
      
      // Now access the maps from the instance
      console.log('DARES_TO_PRODUCT_MAP:', iapManager.DARES_TO_PRODUCT_MAP);
      console.log('PRODUCT_IDS:', iapManager.PRODUCT_IDS);
      
      // Check each pack's purchase status
      for (const pack of packs) {
        console.log(`\nChecking pack: ${pack.name}`);
        console.log(`isPremium: ${pack.isPremium}`);
        console.log(`price: ${pack.price}`);
        
        if (pack.isPremium) {
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
          
          console.log(`Pack key: ${packKey}`);
          console.log(`Product ID from map: ${iapManager.DARES_TO_PRODUCT_MAP[packKey]}`);
          
          if (packKey) {
            try {
              // First check what isDaresPurchased returns
              const purchased = await iapManager.isDaresPurchased(packKey);
              console.log(`isDaresPurchased(${packKey}): ${purchased}`);
              states[pack.name] = purchased;
            } catch (error) {
              console.error(`Error checking if ${packKey} is purchased:`, error);
              states[pack.name] = false; // Default to not purchased on error
            }
          }
        } else {
          // Free packs are always available
          states[pack.name] = true;
          console.log('FREE PACK - always available');
        }
      }
      
      console.log('\nFinal states:', states);
      setPurchaseStates(states);
    } catch (error) {
      console.error('Error checking purchase states:', error);
      
      // Fallback: Set all free packs as available, premium packs as locked
      const fallbackStates = {};
      packs.forEach(pack => {
        fallbackStates[pack.name] = !pack.isPremium;
      });
      setPurchaseStates(fallbackStates);
    }
  };

  const handlePurchase = async (pack) => {
    try {
      // Map pack names to product IDs
      let productId = '';
      switch (pack.name) {
        case 'Spicy':
          productId = iapManager.PRODUCT_IDS?.DARES_SPICY;
          break;
        case 'House Party':
          productId = iapManager.PRODUCT_IDS?.DARES_HOUSEPARTY;
          break;
        case 'Couples':
          productId = iapManager.PRODUCT_IDS?.DARES_COUPLES;
          break;
        case 'Bar':
          productId = iapManager.PRODUCT_IDS?.DARES_BAR;
          break;
      }

      if (productId) {
        const success = await iapManager.purchaseProduct(productId);
        if (success) {
          // Refresh purchase states after successful purchase
          await checkPurchaseStates();
          Alert.alert('Success', `${pack.name} pack purchased successfully!`);
        } else {
          Alert.alert('Purchase Failed', 'Unable to complete purchase. Please try again.');
        }
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'An error occurred during purchase. Please try again.');
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
    const isPurchased = purchaseStates[item.name] !== false; // Show as purchased by default if state is undefined
    
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
          isPurchased={isPurchased}
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
          {/* Header Section with enhanced casino styling */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFD700" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  // Enhanced casino felt overlay
  feltOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 115, 51, 0.2)', // Green felt overlay
    opacity: 0.8,
  },
  mainContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -19,
    paddingHorizontal: 20,
  },
  titlePressable: {
    alignItems: 'center',
    width: '100%',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    marginRight: -45,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700', // Gold border for casino feel
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: scaleFontSize(28),
    fontWeight: 'bold',
    color: '#FFD700', // Casino gold color
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      }
    }),
  },
  developerModeText: {
    fontSize: scaleFontSize(12),
    color: '#e74c3c', // Red text to indicate developer mode is active
    textAlign: 'center',
    marginTop: 4,
    fontWeight: 'bold',
  },
  // Casino title decoration
  titleDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    width: '60%',
  },
  titleLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
  },
  instruction: {
    color: '#FFD700', // Gold text
    textAlign: 'center',
    fontSize: scaleFontSize(18),
    marginVertical: 15,
    fontWeight: 'bold',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  gridContent: {
    padding: GRID_PADDING,
  },
  row: {
    justifyContent: 'space-between',
  },
  // Enhanced card styling for casino feel
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: CARD_MARGIN * 2,
    borderRadius: 15,
    transform: [{ perspective: 1000 }],
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700', // Gold shadow for casino feel
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  card: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a', // Dark card background
    borderWidth: 2,
    borderColor: '#FFD700', // Gold border
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageStyle: {
    borderRadius: 15,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
    paddingBottom: 8, // Add some bottom padding to accommodate the badge
  },
  ageRestrictedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10, // Ensure it appears above other elements
    backgroundColor: '#D50000',
    borderRadius: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'white',
    width: 55, // Increase width to accommodate horizontal text
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageRestrictedText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    flexDirection: 'row', // Ensure text flows horizontally
  },
  packName: {
    color: '#FFD700', // Gold text
    fontSize: scaleFontSize(Platform.OS === 'android' ? 16 : 18),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    numberOfLines: 1,
    ellipsizeMode: 'tail',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  packDescription: {
    color: 'white',
    fontSize: scaleFontSize(12),
    textAlign: 'center',
    marginBottom: 4,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  packDareCount: {
    color: 'white',
    fontSize: scaleFontSize(12),
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  // Enhanced modal styling for casino feel
  modalContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    margin: Math.min(20, SCREEN_WIDTH * 0.05), // Responsive margin
    backgroundColor: '#1a1a1a', // Dark background for casino feel
    borderRadius: 20,
    padding: Platform.OS === 'android' ? 
      Math.min(25, SCREEN_WIDTH * 0.06) : 
      Math.min(35, SCREEN_WIDTH * 0.08),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700', // Gold border
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700', // Gold shadow for casino feel
        shadowOffset: {
          width: 0,
          height: 3
        },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      }
    }),
    width: SCREEN_WIDTH > 600 ? '80%' : '90%', // Adjust width for tablets
    maxWidth: 500, // Maximum width cap
    transform: [{ perspective: 1000 }],
    backfaceVisibility: 'hidden',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
  // Casino-style separator
  casinoSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginVertical: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
  },
  modalTitle: {
    fontSize: scaleFontSize(24),
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#FFD700', // Gold text
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }
    }),
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#4CAF50',
    zIndex: 10, // Above everything else
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  priceText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scaleFontSize(14),
    textAlign: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -20 },
      { translateY: -20 }
    ],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 30,
    padding: 10,
    zIndex: 5,
  },
  modalSubtitle: {
    fontSize: scaleFontSize(Platform.OS === 'android' ? 16 : 18),
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
    marginBottom: 20,
    textAlign: 'center',
    color: '#e0e0e0', // Light gray
    paddingHorizontal: 10,
  },
  customDareButtonsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  // Casino-styled buttons
  customDareButton: {
    flex: 0.48,
    backgroundColor: '#D4AF37', // Slightly darker gold
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  customDareButtonActive: {
    backgroundColor: '#b8860b', // Darker gold when active
  },
  customDareButtonText: {
    color: 'black',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
  },
  viewCustomButton: {
    flex: 0.48,
    backgroundColor: '#2962FF',
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#90CAF9',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  viewCustomButtonActive: {
    backgroundColor: '#1E40AF',
  },
  viewCustomButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
  },
  customDaresModalView: {
    maxHeight: '80%',
    width: '90%',
    backgroundColor: '#1a1a1a', // Dark background
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700', // Gold border
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  daresList: {
    width: '100%',
    maxHeight: '80%',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  dareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#282828', // Dark background
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#444',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  dareText: {
    flex: 1,
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
    color: 'white',
    paddingRight: 10,
    lineHeight: Platform.OS === 'android' ? 20 : 22,
  },
  dareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
  },
  editButton: {
    padding: 8,
    marginRight: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderRadius: 15,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 15,
  },
  saveButton: {
    padding: 8,
    marginRight: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 15,
  },
  cancelButton: {
    padding: 8,
    backgroundColor: 'rgba(158, 158, 158, 0.2)',
    borderRadius: 15,
  },
  editDareInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
    color: 'white',
    backgroundColor: '#333',
    minHeight: 40,
  },
  noDaresText: {
    fontSize: scaleFontSize(16),
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
  },
  customDareInputContainer: {
    width: '100%',
    marginVertical: 10,
    padding: 10,
  },
  customDareInput: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    padding: 10,
    minHeight: Platform.OS === 'android' ? 60 : 80, // Smaller on Android
    width: '100%',
    textAlignVertical: 'top',
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
    color: 'white',
    backgroundColor: '#333',
  },
  createDareButton: {
    backgroundColor: '#4CAF50',
    padding: Platform.OS === 'android' ? 8 : 10,
    borderRadius: 10,
    marginTop: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2E7D32',
    ...Platform.select({
      android: {
        elevation: 3,
      }
    }),
  },
  createDareButtonDisabled: {
    backgroundColor: '#444',
    borderColor: '#333',
  },
  createDareButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: scaleFontSize(14),
  },
  successMessage: {
    position: 'absolute',
    top: 10,
    backgroundColor: '#388E3C',
    padding: 10,
    borderRadius: 20,
    zIndex: 2,
    borderWidth: 1,
    borderColor: '#81C784',
    ...Platform.select({
      android: {
        elevation: 8,
      }
    }),
  },
  successText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scaleFontSize(14),
  },
  previewButton: {
    backgroundColor: '#388E3C',
    padding: 10,
    borderRadius: 15,
    marginVertical: 15,
    width: '80%',
    borderWidth: 1,
    borderColor: '#81C784',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  previewButtonActive: {
    backgroundColor: '#2E7D32',
  },
  previewButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: scaleFontSize(Platform.OS === 'android' ? 14 : 16),
  },
  previewContainer: {
    backgroundColor: '#282828',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#444',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  previewDare: {
    fontSize: scaleFontSize(Platform.OS === 'android' ? 13 : 14),
    marginVertical: 5,
    color: '#e0e0e0',
  },
  // Enhanced counter styling like casino chips
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    marginHorizontal: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  counterButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
  },
  counterTextContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      }
    }),
  },
  counterText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    minWidth: 30,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      }
    }),
  },
  confirmButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 15,
    width: '80%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#64B5F6',
    ...Platform.select({
      ios: {
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      }
    }),
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: scaleFontSize(18),
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 5,
  },
  buttonClose: {
    borderRadius: 20,
    padding: 10,
    ...Platform.select({
      ios: {
        elevation: 2,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: scaleFontSize(18),
    color: '#FFD700',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
});

export default DarePackSelectionScreen;