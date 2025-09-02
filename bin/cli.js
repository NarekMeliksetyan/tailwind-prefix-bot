#!/usr/bin/env node

const TailwindPrefixBot = require('../src/index.js');

async function main() {
  const args = process.argv.slice(2);

  const options = {
    prefix: 'two-',
    sourceDir: './',
    filePatterns: ['**/*.html', '**/*.php', '**/*.css', '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue'],
    excludePatterns: ['node_modules/**', 'vendor/**', '.git/**', 'dist/**', 'build/**'],
    backup: true,
    cleanBackupsFlag: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--prefix':
        options.prefix = args[++i];
        break;
      case '--dir':
        options.sourceDir = args[++i];
        break;
      case '--no-backup':
        options.backup = false;
        break;
      case '--clean-backups':
        options.cleanBackupsFlag = true;
        break;
      case '--test':
        const testBot = new TailwindPrefixBot(options);
        testBot.testLogic();
        return;
      case '--help':
        console.log(`
Tailwind Class Prefix Bot

Usage: tailwind-prefixify [options]

Options:
  --prefix PREFIX        Set the prefix to add (default: 'two-')
  --dir DIRECTORY        Set the source directory (default: './')
  --no-backup            Don't create backup files
  --clean-backups        Delete all .backup files
  --test                 Test the class processing logic with examples
  --help                 Show this help message

Examples:
  tailwind-prefixify --prefix "my-"
  tailwind-prefixify --prefix "two-" --dir "./src"
  tailwind-prefixify --prefix "custom-" --no-backup
  tailwind-prefixify --clean-backups
  tailwind-prefixify --test
        `);
        return;
    }
  }

  const bot = new TailwindPrefixBot(options);

  if (options.cleanBackupsFlag) {
    const deletedCount = await bot.cleanupBackups();
    console.log(`\nTotal backup files deleted: ${deletedCount}`);
    return;
  }

  await bot.run();
  await bot.updateTailwindConfig();

  console.log('\n🎉 Done! Your Tailwind classes now have the prefix.');
  console.log('\nNext steps:');
  console.log('1. Update your Tailwind config to use the same prefix');
  console.log('2. Rebuild your CSS with the new prefix');
  console.log('3. Test your application thoroughly');
  console.log('4. Remove backup files once everything works correctly');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
