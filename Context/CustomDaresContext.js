import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const CustomDaresContext = createContext();

class CustomDaresManager {
  constructor() {
    // Use appropriate directory based on platform
    // Android has different file permission requirements
    this.basePath = Platform.OS === 'android' 
      ? `${FileSystem.documentDirectory}DaresOnly` // Remove leading slash for Android
      : `${FileSystem.documentDirectory}/DaresOnly`;
      
    this.customPacksPath = `${this.basePath}/${Platform.OS === 'android' ? '' : '/'}customDarePacks`;
    
    // Initialize retry and timeout settings for Android
    this.maxRetries = Platform.OS === 'android' ? 3 : 1;
    this.retryDelay = 300; // ms
    
    console.log('Storage paths:', {
      base: this.basePath,
      custom: this.customPacksPath,
      platform: Platform.OS
    });
  }
  
  async initialize() {
    try {
      // First ensure base directory exists
      const baseExists = await FileSystem.getInfoAsync(this.basePath);
      if (!baseExists.exists) {
        console.log('Creating base directory at:', this.basePath);
        await this.retryOperation(() => 
          FileSystem.makeDirectoryAsync(this.basePath, { 
            intermediates: true 
          })
        );
      }
  
      // Then ensure custom packs directory exists
      const customExists = await FileSystem.getInfoAsync(this.customPacksPath);
      if (!customExists.exists) {
        console.log('Creating custom packs directory at:', this.customPacksPath);
        await this.retryOperation(() => 
          FileSystem.makeDirectoryAsync(this.customPacksPath, { 
            intermediates: true 
          })
        );
      }
  
      console.log('Directories initialized:', {
        base: baseExists.exists ? 'exists' : 'created',
        custom: customExists.exists ? 'exists' : 'created'
      });
  
    } catch (error) {
      console.error('Directory initialization error:', error);
      // Try with full path creation with retries
      try {
        await this.retryOperation(() => 
          FileSystem.makeDirectoryAsync(this.customPacksPath, {
            intermediates: true
          })
        );
      } catch (secondError) {
        console.error('Failed to create directories after retries:', secondError);
      }
    }
  }
  
  // Helper function to retry operations for Android reliability
  async retryOperation(operation, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
        lastError = error;
        
        // Only wait if we're going to retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    // If we got here, all attempts failed
    throw lastError;
  }

  getCustomFilePath(packName) {
    // Sanitize filename more aggressively for Android
    const sanitizedName = packName.toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') // Replace any non-alphanumeric chars with underscore
      .replace(/__+/g, '_'); // Replace multiple underscores with single one
      
    return `${this.customPacksPath}/custom_${sanitizedName}.json`;
  }

  async checkCustomFileExists(packName) {
    try {
      const info = await FileSystem.getInfoAsync(this.getCustomFilePath(packName));
      return info.exists;
    } catch (error) {
      console.warn('Error checking if file exists:', error);
      return false;
    }
  }

  async createCustomFile(packName) {
    try {
      await this.retryOperation(() => 
        FileSystem.writeAsStringAsync(
          this.getCustomFilePath(packName),
          JSON.stringify([], null, 2)
        )
      );
      return true;
    } catch (error) {
      console.error('Error creating custom file:', error);
      return false;
    }
  }

  async addCustomDare(packName, dareText) {
    try {
      const filePath = this.getCustomFilePath(packName);
      console.log('Attempting to add dare at:', filePath);
  
      const exists = await this.checkCustomFileExists(packName);
      console.log('File exists?', exists);
  
      if (!exists) {
        console.log('Creating new custom dare file');
        const success = await this.createCustomFile(packName);
        if (!success) {
          throw new Error('Failed to create custom dare file');
        }
      }
  
      // Read existing content with retry for Android
      const fileContent = exists ? 
        await this.retryOperation(() => FileSystem.readAsStringAsync(filePath)) : 
        '[]';
      
      let dares;
      try {
        dares = JSON.parse(fileContent);
        // Validate that it's an array
        if (!Array.isArray(dares)) {
          console.warn('File content was not an array, resetting:', fileContent);
          dares = [];
        }
      } catch (parseError) {
        console.warn('Error parsing JSON, resetting file:', parseError);
        dares = [];
      }
      
      // Add new dare
      dares.push({
        text: dareText,
        isCustom: true,
        createdAt: new Date().toISOString(),
        id: Date.now().toString()
      });
  
      // Write back with retry for Android
      await this.retryOperation(() => 
        FileSystem.writeAsStringAsync(filePath, JSON.stringify(dares, null, 2))
      );
      
      console.log('Successfully saved dare to:', filePath);
      return true;
    } catch (error) {
      console.error('Error adding custom dare:', error, error.stack);
      return false;
    }
  }

  async getCustomDares(packName) {
    try {
      const exists = await this.checkCustomFileExists(packName);
      if (!exists) return [];

      const content = await this.retryOperation(() => 
        FileSystem.readAsStringAsync(this.getCustomFilePath(packName))
      );
      
      try {
        const dares = JSON.parse(content);
        // Validate that it's an array
        return Array.isArray(dares) ? dares : [];
      } catch (parseError) {
        console.warn('Error parsing custom dares JSON:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error getting custom dares:', error);
      return [];
    }
  }

  async getCustomDareCount(packName) {
    const dares = await this.getCustomDares(packName);
    return dares.length;
  }

  async removeCustomDare(packName, dareId) {
    try {
      const filePath = this.getCustomFilePath(packName);
      const exists = await this.checkCustomFileExists(packName);
      if (!exists) return false;

      const content = await this.retryOperation(() => 
        FileSystem.readAsStringAsync(filePath)
      );
      
      let dares;
      try {
        dares = JSON.parse(content);
        if (!Array.isArray(dares)) {
          return false;
        }
      } catch (parseError) {
        console.warn('Error parsing JSON when removing dare:', parseError);
        return false;
      }
      
      const updatedDares = dares.filter(dare => dare.id !== dareId);

      if (updatedDares.length === 0) {
        await this.retryOperation(() => FileSystem.deleteAsync(filePath));
      } else {
        await this.retryOperation(() => 
          FileSystem.writeAsStringAsync(filePath, JSON.stringify(updatedDares, null, 2))
        );
      }
      return true;
    } catch (error) {
      console.error('Error removing custom dare:', error);
      return false;
    }
  }

  async listCustomPacks() {
    try {
      // Create directory first if it doesn't exist to prevent errors on Android
      const dirExists = await FileSystem.getInfoAsync(this.customPacksPath);
      if (!dirExists.exists) {
        await this.initialize();
        return [];
      }
      
      const dirContents = await this.retryOperation(() => 
        FileSystem.readDirectoryAsync(this.customPacksPath)
      );
      
      return dirContents
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const name = file.replace('custom_', '').replace('.json', '');
          return name.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
        });
    } catch (error) {
      console.error('Error listing custom packs:', error);
      return [];
    }
  }
}

export const CustomDaresProvider = ({ children }) => {
  const managerRef = useRef(new CustomDaresManager());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeManager = async () => {
      try {
        await managerRef.current.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize CustomDaresManager:', error);
        // Still set initialized to prevent hanging
        setIsInitialized(true);
      }
    };
    
    initializeManager();
  }, []);

  const value = {
    addCustomDare: async (packName, dareText) => 
      await managerRef.current.addCustomDare(packName, dareText),
    getCustomDares: async (packName) => 
      await managerRef.current.getCustomDares(packName),
    removeCustomDare: async (packName, dareId) => 
      await managerRef.current.removeCustomDare(packName, dareId),
    getCustomDareCount: async (packName) => 
      await managerRef.current.getCustomDareCount(packName),
    listCustomPacks: async () => 
      await managerRef.current.listCustomPacks(),
    isInitialized // Add initialization state to context
  };

  return (
    <CustomDaresContext.Provider value={value}>
      {children}
    </CustomDaresContext.Provider>
  );
};

export const useCustomDares = () => {
  const context = useContext(CustomDaresContext);
  if (context === undefined) {
    throw new Error('useCustomDares must be used within a CustomDaresProvider');
  }
  return context;
};