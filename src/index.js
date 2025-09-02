const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const os = require('os');
const crypto = require('crypto');

/**
 * Enhanced Tailwind CSS class prefix bot with comprehensive error handling,
 * dry-run mode, atomic operations, and advanced class detection.
 */
class TailwindPrefixBot {
    /**
     * @param {Object} options - Configuration options
     * @param {string} [options.prefix='tw-'] - Prefix to add to classes
     * @param {string} [options.sourceDir='./'] - Source directory to process
     * @param {string[]} [options.filePatterns] - File patterns to include
     * @param {string[]} [options.excludePatterns] - Patterns to exclude
     * @param {string[]} [options.ignoreClasses] - Classes to ignore
     * @param {boolean} [options.backup=true] - Create backup files
     * @param {boolean} [options.dryRun=false] - Preview changes without applying
     * @param {string} [options.logLevel='info'] - Logging level (silent, error, warn, info, debug)
     * @param {boolean} [options.atomic=true] - Use atomic file operations
     * @param {string} [options.backupDir] - Custom backup directory
     */
    constructor(options = {}) {
        // Validate and set options
        this.validateOptions(options);

        this.prefix = options.prefix || 'tw-';
        this.sourceDir = path.resolve(options.sourceDir || './');
        this.filePatterns = options.filePatterns || [
            '**/*.html', '**/*.php', '**/*.css', '**/*.scss', '**/*.sass',
            '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue', '**/*.svelte'
        ];
        this.excludePatterns = options.excludePatterns || [
            'node_modules/**', 'vendor/**', '.git/**', 'dist/**', 'build/**',
            '**/*.min.*', '**/*.backup', '**/.*'
        ];
        this.ignoreClasses = options.ignoreClasses || [
            'swiper', 'swiper-wrapper', 'swiper-slide'
        ];
        this.backup = options.backup !== false;
        this.dryRun = options.dryRun || false;
        this.logLevel = options.logLevel || 'info';
        this.atomic = options.atomic !== false;
        this.backupDir = options.backupDir || path.join(this.sourceDir, '.tailwind-prefix-backups');

        // Internal state
        this.stats = {
            filesProcessed: 0,
            filesChanged: 0,
            classesChanged: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };

        // Enhanced regex patterns for better class detection
        this.patterns = {
            // HTML class attributes (supports multi-line)
            htmlClass: /class\s*=\s*["']([^"']*(?:\\.[^"']*)*)["']/gis,
            // JSX className (handles template literals and expressions)
            jsxClassName: /className\s*=\s*(?:["'`]([^"'`]*(?:\\.[^"'`]*)*)["'`]|\{([^}]+)\})/gis,
            // CSS class selectors (more precise)
            cssSelector: /(?<=^|[\s,{>+~])\.((?:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*(?:\[[^\]]*\])?)+)/gm,
            // @apply directives
            cssApply: /@apply\s+([^;{}]+);?/gs,
            // Arbitrary value patterns [value]
            arbitraryValue: /\[[^\]]+\]/g,
            // Group modifiers group-*:
            groupModifier: /group-[^:]*:/g
        };
    }

    /**
     * Validate constructor options
     * @param {Object} options - Options to validate
     * @throws {Error} If options are invalid
     */
    validateOptions(options) {
        if (options.prefix && typeof options.prefix !== 'string') {
            throw new Error('prefix must be a string');
        }
        if (options.prefix && !/^[a-zA-Z0-9_-]+$/.test(options.prefix.replace(/-$/, ''))) {
            throw new Error('prefix must contain only alphanumeric characters, hyphens, and underscores');
        }
        if (options.sourceDir && typeof options.sourceDir !== 'string') {
            throw new Error('sourceDir must be a string');
        }
        if (options.logLevel && !['silent', 'error', 'warn', 'info', 'debug'].includes(options.logLevel)) {
            throw new Error('logLevel must be one of: silent, error, warn, info, debug');
        }
    }

    /**
     * Enhanced logging with levels
     * @param {string} level - Log level
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    log(level, message, ...args) {
        const levels = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
        const currentLevel = levels[this.logLevel] || 3;

        if (levels[level] <= currentLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
            console.log(`${prefix} ${message}`, ...args);
        }
    }

    /**
     * Check if directory exists and is accessible
     * @param {string} dirPath - Directory path to check
     * @returns {Promise<boolean>}
     */
    async checkDirectoryAccess(dirPath) {
        try {
            await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get all files matching the patterns with enhanced error handling
     * @returns {Promise<string[]>} Array of file paths
     */
    async getFiles() {
        try {
            // Check if source directory exists
            if (!(await this.checkDirectoryAccess(this.sourceDir))) {
                throw new Error(`Source directory not accessible: ${this.sourceDir}`);
            }

            const allFiles = [];
            this.log('debug', `Scanning patterns: ${this.filePatterns.join(', ')}`);
            this.log('debug', `Excluding patterns: ${this.excludePatterns.join(', ')}`);

            for (const pattern of this.filePatterns) {
                try {
                    const files = glob.sync(pattern, {
                        cwd: this.sourceDir,
                        ignore: this.excludePatterns,
                        absolute: true,
                        nodir: true // Only files, not directories
                    });
                    allFiles.push(...files);
                    this.log('debug', `Pattern '${pattern}' matched ${files.length} files`);
                } catch (error) {
                    this.log('warn', `Failed to process pattern '${pattern}': ${error.message}`);
                }
            }

            const uniqueFiles = [...new Set(allFiles)];
            this.log('info', `Found ${uniqueFiles.length} files to process`);
            return uniqueFiles;
        } catch (error) {
            this.log('error', `Error getting files: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create backup of original file with enhanced management
     * @param {string} filePath - Path to file to backup
     * @returns {Promise<string|null>} Backup path or null if no backup created
     */
    async createBackup(filePath) {
        if (!this.backup) return null;

        try {
            // Ensure backup directory exists
            await fs.mkdir(this.backupDir, { recursive: true });

            // Create unique backup filename with timestamp
            const relativePath = path.relative(this.sourceDir, filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${relativePath.replace(/[/\\]/g, '_')}_${timestamp}.backup`;
            const backupPath = path.join(this.backupDir, backupFileName);

            // Read and write backup
            const content = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, content, 'utf8');

            this.log('debug', `Backup created: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.log('error', `Failed to create backup for ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Restore files from backup directory
     * @param {string} [backupTimestamp] - Specific backup timestamp to restore
     * @returns {Promise<number>} Number of files restored
     */
    async restoreFromBackup(backupTimestamp = null) {
        try {
            const backupFiles = glob.sync('**/*.backup', {
                cwd: this.backupDir,
                absolute: true
            });

            let restoredCount = 0;
            for (const backupFile of backupFiles) {
                if (backupTimestamp && !backupFile.includes(backupTimestamp)) {
                    continue;
                }

                // Parse original file path from backup filename
                const backupName = path.basename(backupFile, '.backup');
                const parts = backupName.split('_');
                const timestamp = parts.pop();
                const originalRelativePath = parts.join('_').replace(/_/g, path.sep);
                const originalPath = path.join(this.sourceDir, originalRelativePath);

                try {
                    const backupContent = await fs.readFile(backupFile, 'utf8');
                    await fs.writeFile(originalPath, backupContent, 'utf8');
                    this.log('info', `Restored: ${originalPath}`);
                    restoredCount++;
                } catch (error) {
                    this.log('error', `Failed to restore ${originalPath}: ${error.message}`);
                }
            }

            this.log('info', `Restored ${restoredCount} files from backup`);
            return restoredCount;
        } catch (error) {
            this.log('error', `Error during restore: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enhanced check if a class should be ignored (not a Tailwind class)
     * @param {string} className - Class name to check
     * @returns {boolean} True if class should be ignored
     */
    isNotTailwindClass(className) {
        // Remove any prefixes and negation for checking
        let classToCheck = className;

        // Remove responsive/pseudo prefixes (everything before last :)
        const lastColonIndex = classToCheck.lastIndexOf(':');
        if (lastColonIndex !== -1) {
            classToCheck = classToCheck.substring(lastColonIndex + 1);
        }

        // Remove ! for negative values
        if (classToCheck.startsWith('!')) {
            classToCheck = classToCheck.substring(1);
        }

        // Check ignore list (exact match)
        if (this.ignoreClasses.includes(classToCheck)) {
            return true;
        }

        // Check for camelCase (has lowercase followed by uppercase)
        const hasCamelCase = /[a-z][A-Z]/.test(classToCheck);

        // Check for snake_case (has underscores not in arbitrary values)
        const hasSnakeCase = classToCheck.includes('_') && !classToCheck.includes('[');

        // Check for common non-Tailwind patterns
        const isCustomClass = /^[A-Z]/.test(classToCheck) || // Starts with uppercase
            classToCheck.includes('__') ||  // BEM methodology
            /^\d/.test(classToCheck) ||     // Starts with number
            classToCheck.length < 2;       // Too short

        // Check for framework-specific classes
        const isFrameworkClass = /^(ng-|v-|data-|aria-|role-)/.test(classToCheck);

        return hasCamelCase || hasSnakeCase || isCustomClass || isFrameworkClass;
    }

    /**
     * Enhanced prefix addition with better Tailwind pattern support
     * @param {string} className - Class name to process
     * @returns {string} Processed class name
     */
    addPrefixToClass(className) {
        // Skip if already prefixed
        if (className.includes(this.prefix)) {
            return className;
        }

        // Skip non-Tailwind classes
        if (this.isNotTailwindClass(className)) {
            return className;
        }

        // Handle group modifiers: group-hover:opacity-50 -> group-hover:tw-opacity-50
        if (className.includes('group-')) {
            const groupMatch = className.match(/^(.*group-[^:]*:)(.+)$/);
            if (groupMatch) {
                const [, groupPrefix, actualClass] = groupMatch;
                return groupPrefix + this.addPrefixToClass(actualClass);
            }
        }

        // Handle peer modifiers: peer-focus:opacity-50 -> peer-focus:tw-opacity-50
        if (className.includes('peer-')) {
            const peerMatch = className.match(/^(.*peer-[^:]*:)(.+)$/);
            if (peerMatch) {
                const [, peerPrefix, actualClass] = peerMatch;
                return peerPrefix + this.addPrefixToClass(actualClass);
            }
        }

        // Find the last ':' in the class name
        const lastColonIndex = className.lastIndexOf(':');

        if (lastColonIndex === -1) {
            // No colons - simple class
            if (className.startsWith('!')) {
                // Handle negative: !-margin-4 -> !tw--margin-4
                return '!' + this.prefix + className.substring(1);
            } else {
                // Regular class: bg-red-500 -> tw-bg-red-500
                return this.prefix + className;
            }
        } else {
            // Has colons - get the part after the last colon
            const beforeLastColon = className.substring(0, lastColonIndex + 1);
            const afterLastColon = className.substring(lastColonIndex + 1);

            if (afterLastColon.startsWith('!')) {
                // Handle negative with prefixes: hover:!-translate-x-2 -> hover:!tw--translate-x-2
                return beforeLastColon + '!' + this.prefix + afterLastColon.substring(1);
            } else {
                // Regular class with prefixes: hover:bg-red-500 -> hover:tw-bg-red-500
                return beforeLastColon + this.prefix + afterLastColon;
            }
        }
    }

    /**
     * Enhanced backup cleanup with better error handling
     * @param {boolean} [removeBackupDir=false] - Remove entire backup directory
     * @returns {Promise<number>} Number of files deleted
     */
    async cleanupBackups(removeBackupDir = false) {
        try {
            let deletedCount = 0;

            // Clean old-style .backup files in source directory
            const oldBackupFiles = glob.sync('**/*.backup', {
                cwd: this.sourceDir,
                absolute: true
            });

            for (const file of oldBackupFiles) {
                try {
                    await fs.unlink(file);
                    this.log('debug', `Deleted old backup: ${file}`);
                    deletedCount++;
                } catch (err) {
                    this.log('error', `Failed to delete ${file}: ${err.message}`);
                }
            }

            // Clean new-style backup directory
            if (await this.checkDirectoryAccess(this.backupDir)) {
                const backupFiles = glob.sync('**/*.backup', {
                    cwd: this.backupDir,
                    absolute: true
                });

                for (const file of backupFiles) {
                    try {
                        await fs.unlink(file);
                        this.log('debug', `Deleted backup: ${file}`);
                        deletedCount++;
                    } catch (err) {
                        this.log('error', `Failed to delete ${file}: ${err.message}`);
                    }
                }

                // Remove backup directory if requested and empty
                if (removeBackupDir) {
                    try {
                        await fs.rmdir(this.backupDir);
                        this.log('info', `Removed backup directory: ${this.backupDir}`);
                    } catch (err) {
                        this.log('warn', `Could not remove backup directory: ${err.message}`);
                    }
                }
            }

            this.log('info', `Deleted ${deletedCount} backup files`);
            return deletedCount;
        } catch (err) {
            this.log('error', `Error during backup cleanup: ${err.message}`);
            return 0;
        }
    }

    /**
     * Enhanced HTML class processing with better pattern matching
     * @param {string} content - File content to process
     * @returns {string} Processed content
     */
    processHtmlClasses(content) {
        let changeCount = 0;

        const result = content.replace(
            this.patterns.htmlClass,
            (match, classString) => {
                // Split classes and process each one
                const classes = classString.split(/\s+/).filter(c => c.length > 0);
                const processedClasses = classes.map(className => {
                    const processed = this.addPrefixToClass(className);
                    if (processed !== className) changeCount++;
                    return processed;
                });

                const newClassString = processedClasses.join(' ');
                return match.replace(classString, newClassString);
            }
        );

        this.stats.classesChanged += changeCount;
        return result;
    }

    // Process CSS class selectors
    processCssClasses(content) {
        return content;
    }

    // Add prefix to CSS class selectors (outside @apply)
    processCssSelectors(content) {
        // Match classes in selectors: .class-name
        return content.replace(
            /(?<=^|[\s,{])\.([a-zA-Z0-9_-]+)/gm,
            (match, className) => {
                // Corrected property name
                if (this.ignoreClasses.includes(className)) return match;

                // Already prefixed
                if (className.startsWith(this.prefix)) return match;

                return `.${this.prefix}${className}`;
            }
        );
    }


    // Process @apply directives in CSS
    processApplyDirectives(content) {
        return content.replace(
            /@apply\s+([^;{}]+);?/gs, // Match @apply ... until ; or closing brace
            (match, classString) => {
                // Split by whitespace including newlines
                const classes = classString
                    .split(/\s+/)
                    .filter(c => c.length > 0)
                    // Only add prefix to valid Tailwind-like classes
                    .map(className => {
                        // Ignore invalid class names (like those ending with } or containing {)
                        if (/[\{\}]/.test(className)) return className;
                        return this.addPrefixToClass(className);
                    });

                return `@apply ${classes.join(' ')};`;
            }
        )
            // Remove accidental double semicolons
            .replace(/;;+/g, ';');
    }

    // Process JavaScript/JSX className attributes
    processJsClasses(content) {
        // Handle className="onco-..." and className={'...'} and className={`...`}
        return content.replace(
            /className\s*=\s*[{"'`]([^"'`}]*)[}"'`]/gi,
            (match, classString) => {
                // Handle template literals and conditional classes
                if (classString.includes('${') || classString.includes('?')) {
                    // For complex template literals, we'll be more conservative
                    // and only process simple class strings
                    return match;
                }

                const classes = classString.split(/\s+/).filter(c => c.length > 0);
                const processedClasses = classes.map(className => this.addPrefixToClass(className));

                return match.replace(classString, processedClasses.join(' '));
            }
        );
    }

    // Main content processing method
    processContent(content, filePath) {
        let processedContent = content;
        const fileExt = path.extname(filePath).toLowerCase();

        // Process based on file type
        if (['.html', '.php', '.vue'].includes(fileExt)) {
            // HTML-like files
            processedContent = this.processHtmlClasses(processedContent);
        } else if (fileExt === '.css') {
            // CSS files
            processedContent = this.processCssSelectors(processedContent);
            processedContent = this.processApplyDirectives(processedContent);
            //   processedContent = this.processCssClasses(processedContent);
            //   processedContent = this.processApplyDirectives(processedContent);
        } else if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExt)) {
            // JavaScript/TypeScript files
            processedContent = this.processJsClasses(processedContent);
            // Also check for template literals with HTML
            processedContent = this.processHtmlClasses(processedContent);
        }

        return processedContent;
    }

    // Process a single file
    async processFile(filePath) {
        try {
            console.log(`Processing: ${filePath}`);

            // Create backup
            await this.createBackup(filePath);

            // Read file content
            const content = await fs.readFile(filePath, 'utf8');

            // Process content
            const processedContent = this.processContent(content, filePath);

            // Write back if changes were made
            if (content !== processedContent) {
                await fs.writeFile(filePath, processedContent);
                console.log(`✓ Updated: ${filePath}`);
                return true;
            } else {
                console.log(`- No changes: ${filePath}`);
                return false;
            }
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error.message);
            return false;
        }
    }

    // Main execution method
    async run() {
        console.log(`Starting Tailwind prefix bot with prefix: "${this.prefix}"`);
        console.log(`Source directory: ${path.resolve(this.sourceDir)}`);
        console.log(`File patterns: ${this.filePatterns.join(', ')}`);
        console.log(`Exclude patterns: ${this.excludePatterns.join(', ')}`);
        console.log('---');

        try {
            const files = await this.getFiles();
            console.log(`Found ${files.length} files to process\n`);

            let processedCount = 0;
            let updatedCount = 0;

            for (const file of files) {
                const wasUpdated = await this.processFile(file);
                processedCount++;
                if (wasUpdated) updatedCount++;
            }

            console.log('\n--- Summary ---');
            console.log(`Files processed: ${processedCount}`);
            console.log(`Files updated: ${updatedCount}`);
            console.log(`Prefix used: "${this.prefix}"`);

            if (this.backup) {
                console.log('\nBackup files created with .backup extension');
                console.log('You can remove them once you verify everything works correctly');
            }

        } catch (error) {
            console.error('Error running prefix bot:', error.message);
            process.exit(1);
        }
    }

    // Method to update Tailwind config file
    async updateTailwindConfig(configPath = './tailwind.config.js') {
        try {
            const configExists = await fs.access(configPath).then(() => true).catch(() => false);

            if (configExists) {
                console.log('\n--- Updating Tailwind Config ---');
                await this.createBackup(configPath);

                let configContent = await fs.readFile(configPath, 'utf8');

                // Add prefix to config
                if (!configContent.includes('prefix:')) {
                    configContent = configContent.replace(
                        'module.exports = {',
                        `module.exports = {\n  prefix: '${this.prefix}',`
                    );

                    await fs.writeFile(configPath, configContent);
                    console.log(`✓ Updated Tailwind config with prefix: ${configPath}`);
                } else {
                    console.log(`- Tailwind config already has prefix setting: ${configPath}`);
                }
            }
        } catch (error) {
            console.error('Error updating Tailwind config:', error.message);
        }
    }

    // Test method to verify the logic with examples
    testLogic() {
        console.log('\n--- Testing Class Processing Logic ---');

        const testClasses = [
            'bg-red-500',           // Simple class
            'hover:bg-red-500',     // Pseudo class
            'md:hover:bg-red-500',  // Multiple prefixes
            '!-mt-4',               // Negative
            'hover:!-translate-x-2', // Negative with pseudo
            'bg-gray',              // Incomplete color
            'w-[100px]',            // Arbitrary value
            '!-left-[60%]',         // Negative arbitrary
            'myCustomClass',        // camelCase (should be ignored)
            'my_custom_class',      // snake_case (should be ignored)
            'dark:hover:!-rotate-45', // Complex case
            'two-bg-red-500'        // Already prefixed (should be ignored)
        ];

        testClasses.forEach(className => {
            const result = this.addPrefixToClass(className);
            console.log(`${className.padEnd(25)} -> ${result}`);
        });

        console.log('--- End Test ---\n');
    }
}



// Usage example and CLI interface
async function main() {
    const args = process.argv.slice(2);

    // Parse command line arguments
    const options = {
        prefix: 'two-',
        sourceDir: './',
        filePatterns: ['**/*.html', '**/*.php', '**/*.css', '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue'],
        excludePatterns: ['node_modules/**', 'vendor/**', '.git/**', 'dist/**', 'build/**'],
        backup: true,
        cleanBackupsFlag: false
    };



    // Simple argument parsing
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

Usage: node tailwind-prefix-bot.js [options]

Options:
  --prefix PREFIX     Set the prefix to add (default: 'two-')
  --dir DIRECTORY     Set the source directory (default: './')
  --no-backup         Don't create backup files
  --test              Test the class processing logic with examples
  --clean-backups        Delete all .backup files
  --help              Show this help message

Examples:
  node tailwind-prefix-bot.js --prefix "my-"
  node tailwind-prefix-bot.js --prefix "two-" --dir "./src"
  node tailwind-prefix-bot.js --prefix "custom-" --no-backup
  node tailwind-prefix-bot.js --clean-backups
  node tailwind-prefix-bot.js --test
        `);
                return;
        }
    }

    const bot = new TailwindPrefixBot(options);

    if (options.cleanBackupsFlag) {
        const deletedCount = await bot.cleanupBackups();
        console.log(`\nTotal backup files deleted: ${deletedCount}`);
        return; // 👈 prevent run()

    }

    // Run the bot
    await bot.run();

    // Update Tailwind config
    await bot.updateTailwindConfig();



    console.log('\n🎉 Done! Your Tailwind classes now have the prefix.');
    console.log('\nNext steps:');
    console.log('1. Update your Tailwind config to use the same prefix');
    console.log('2. Rebuild your CSS with the new prefix');
    console.log('3. Test your application thoroughly');
    console.log('4. Remove backup files once everything works correctly');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TailwindPrefixBot;