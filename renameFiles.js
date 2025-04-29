const fs = require('fs');
const path = require('path');

const renameFiles = () => {
  const genericPath = path.join(__dirname, 'Packs', 'TriviaDare', 'GenericPacks');
  const difficulties = ['easy', 'medium', 'hard', 'impossible'];
  const packs = [
    'Art',
    'Entertainment',
    'Geography',
    'History',
    'Movie',
    'Music',
    'Science',
    'Sports',
    'Technology'
  ];

  packs.forEach(pack => {
    difficulties.forEach(difficulty => {
      // Check both possible filenames
      const withoutPack = path.join(genericPath, `${pack}${difficulty}.json`);
      const withPack = path.join(genericPath, `${pack}pack${difficulty}.json`);
      
      // If the file exists without 'pack', rename it
      if (fs.existsSync(withoutPack)) {
        fs.renameSync(withoutPack, withPack);
        console.log(`Renamed: ${pack}${difficulty}.json -> ${pack}pack${difficulty}.json`);
      }
    });
  });
  
  console.log('\nRenaming complete! Verifying files...\n');
  
  // Verify all files after renaming
  packs.forEach(pack => {
    difficulties.forEach(difficulty => {
      const expected = path.join(genericPath, `${pack}pack${difficulty}.json`);
      if (fs.existsSync(expected)) {
        console.log(`✓ Found: ${pack}pack${difficulty}.json`);
      } else {
        console.log(`✗ Missing: ${pack}pack${difficulty}.json`);
      }
    });
  });
};

renameFiles();