import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  TouchableNativeFeedback,
  Linking,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ReportQuestionModal = ({ visible, question, onClose }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const reasons = [
    { id: 'incorrect', label: 'Answer might be incorrect' },
    { id: 'confusing', label: 'Question is confusing/unclear' },
    { id: 'typo', label: 'Spelling or grammar issue' },
    { id: 'other', label: 'Other issue' }
  ];
  
  const handleSubmit = async () => {
    if (!selectedReason) return;
    
    setIsSubmitting(true);
    
    // Create email content with the hidden correct answer (only for the developer)
    const subject = `TriviaDare Question Report: ${selectedReason.label}`;
    const body = `
Question ID: ${question?.id || 'Unknown'}
Pack: ${question?.pack || 'Unknown'}
Question: ${question?.questionText || 'Unknown'}
Correct Answer (DEVELOPER ONLY): ${question?.correctAnswer || 'Unknown'}
Report Reason: ${selectedReason.label}
    `.trim();
    
    // Construct the mailto URL
    const mailtoUrl = `mailto:triviadare@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
      // Check if can open email client
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        // Show alert if email client can't be opened
        Alert.alert(
          'Email App Not Found',
          'We couldn\'t open your email app. Please send feedback to triviadare@gmail.com directly.',
          [{ text: 'OK' }]
        );
      }
      
      // Show success state
      setIsSubmitted(true);
      
      // Close modal after a delay
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedReason(null);
        onClose();
      }, 2500);
    } catch (error) {
      console.error('Error sending report:', error);
      // Show error alert
      Alert.alert(
        'Report Error',
        'There was a problem sending the report. Please try again or email triviadare@gmail.com directly.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderReasonOption = (reason) => {
    const isSelected = selectedReason?.id === reason.id;
    
    // Platform-specific button rendering
    if (Platform.OS === 'android') {
      return (
        <View key={reason.id} style={[
          styles.reasonOption,
          isSelected && styles.reasonOptionSelected,
          { overflow: 'hidden' }
        ]}>
          <TouchableNativeFeedback
            onPress={() => setSelectedReason(reason)}
            background={TouchableNativeFeedback.Ripple('#FFD700', false)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
              <View style={[
                styles.radioButton,
                isSelected && styles.radioButtonSelected
              ]}>
                {isSelected && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={styles.reasonText}>{reason.label}</Text>
            </View>
          </TouchableNativeFeedback>
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        key={reason.id}
        style={[
          styles.reasonOption,
          isSelected && styles.reasonOptionSelected
        ]}
        onPress={() => setSelectedReason(reason)}
      >
        <View style={[
          styles.radioButton,
          isSelected && styles.radioButtonSelected
        ]}>
          {isSelected && <View style={styles.radioButtonInner} />}
        </View>
        <Text style={styles.reasonText}>{reason.label}</Text>
      </TouchableOpacity>
    );
  };
  
  const renderButton = (label, onPress, isPrimary = false, disabled = false) => {
    if (Platform.OS === 'android') {
      return (
        <View style={[
          styles.button,
          isPrimary ? styles.primaryButton : styles.secondaryButton,
          disabled && styles.disabledButton,
          { overflow: 'hidden' }
        ]}>
          <TouchableNativeFeedback
            onPress={onPress}
            disabled={disabled}
            background={TouchableNativeFeedback.Ripple(isPrimary ? '#212121' : '#FFD700', false)}
          >
            <View style={{ padding: 12, alignItems: 'center', width: '100%' }}>
              <Text style={[
                styles.buttonText,
                isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
                disabled && styles.disabledButtonText
              ]}>{label}</Text>
            </View>
          </TouchableNativeFeedback>
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.button,
          isPrimary ? styles.primaryButton : styles.secondaryButton,
          disabled && styles.disabledButton
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[
          styles.buttonText,
          isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
          disabled && styles.disabledButtonText
        ]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  
  const renderContent = () => {
    if (isSubmitted) {
      return (
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
          </View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successMessage}>
            Your report has been submitted. We appreciate your help in improving TriviaDare!
          </Text>
        </View>
      );
    }
    
    return (
      <>
        <Text style={styles.title}>Report Question</Text>
        <Text style={styles.description}>
          Help us improve by reporting any issues with this question.
        </Text>
        
        <View style={styles.questionPreview}>
          <Text style={styles.questionPreviewText} numberOfLines={2}>
            {question?.questionText || 'Question'}
          </Text>
        </View>
        
        <Text style={styles.sectionTitle}>What's the issue?</Text>
        
        <View style={styles.reasonsContainer}>
          {reasons.map(renderReasonOption)}
        </View>
        
        {/* Added disclaimer */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            By submitting this report, your default email app will open with a pre-filled message. Your email address will be included when you send the report.
          </Text>
        </View>
        
        <View style={styles.buttonsContainer}>
          {renderButton('Cancel', onClose)}
          {renderButton('Submit Report', handleSubmit, true, !selectedReason || isSubmitting)}
        </View>
      </>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {renderContent()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#1A237E',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }
    }),
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
    opacity: 0.9,
  },
  questionPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  questionPreviewText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  reasonsContainer: {
    marginBottom: 15,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  reasonOptionSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#FFD700',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
  },
  reasonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  // New disclaimer styles
  disclaimerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  disclaimerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 25,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFD700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  primaryButtonText: {
    color: '#000000',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
  disabledButtonText: {
    opacity: 0.8,
  },
  successContainer: {
    alignItems: 'center',
    padding: 20,
  },
  successIconContainer: {
    marginBottom: 15,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ReportQuestionModal;