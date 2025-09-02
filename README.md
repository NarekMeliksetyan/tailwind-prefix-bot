# Tailwind Prefix Bot

A powerful CLI tool that automatically adds prefixes to Tailwind CSS classes in your project files. Perfect for avoiding CSS conflicts when integrating Tailwind into existing projects or when working with multiple CSS frameworks.

## 🚀 Features

- **Smart Class Detection**: Intelligently identifies Tailwind classes while avoiding framework-specific classes, custom classes, and JavaScript variables
- **Multiple File Support**: Works with HTML, PHP, CSS, SCSS, JavaScript, JSX, TypeScript, TSX, Vue, and Svelte files
- **Safe Operations**: Creates automatic backups before making changes
- **Atomic File Operations**: Ensures file integrity during processing
- **Dry Run Mode**: Preview changes before applying them
- **Advanced Pattern Matching**: Handles complex Tailwind patterns including:
  - Responsive prefixes (`md:`, `lg:`, etc.)
  - Pseudo-class modifiers (`hover:`, `focus:`, etc.)
  - Group modifiers (`group-hover:`, `peer-focus:`)
  - Negative values (`!-mt-4`)
  - Arbitrary values (`w-[100px]`)
- **Backup Management**: Easy restoration and cleanup of backup files
- **Configurable Logging**: Multiple log levels for debugging and monitoring

## 📦 Installation

### Global Installation
```bash
npm install -g tailwind-prefix-bot
```

### Local Installation
```bash
npm install tailwind-prefix-bot
```

### Use with npx (no installation required)
```bash
npx tailwind-prefix-bot [options]
```

## 🛠️ Usage

### Basic Usage
```bash
# Add 'tw-' prefix to all Tailwind classes
tailwind-prefixify

# Use custom prefix
tailwind-prefixify --prefix "my-"

# Process specific directory
tailwind-prefixify --prefix "tw-" --dir "./src"
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prefix PREFIX` | Prefix to add to Tailwind classes | `'two-'` |
| `--dir DIRECTORY` | Source directory to process | `'./'` |
| `--no-backup` | Disable backup file creation | `false` |
| `--clean-backups` | Remove all backup files | `false` |
| `--test` | Test class processing logic with examples | - |
| `--help` | Show help message | - |

## 📋 Examples

### Add Custom Prefix
```bash
tailwind-prefixify --prefix "company-"
```
**Before:** `<div class="bg-red-500 hover:bg-red-600">`  
**After:** `<div class="company-bg-red-500 hover:company-bg-red-600">`

### Process Specific Directory
```bash
tailwind-prefixify --prefix "tw-" --dir "./src/components"
```

### Preview Changes (Test Mode)
```bash
tailwind-prefixify --test
```

### Clean Up Backup Files
```bash
tailwind-prefixify --clean-backups
```

## 🎯 How It Works

1. **File Discovery**: Scans your project for supported file types
2. **Smart Detection**: Identifies Tailwind classes using advanced pattern matching
3. **Backup Creation**: Creates timestamped backups in `.tailwind-prefix-backups/`
4. **Class Processing**: Adds prefixes while preserving modifiers and special syntax
5. **File Updates**: Writes changes using atomic operations for safety
6. **Config Update**: Automatically updates `tailwind.config.js` with the new prefix

## 🧠 Smart Class Detection

The bot intelligently avoids prefixing:

- **Framework Classes**: `v-show`, `ng-if`, `data-*`, `aria-*`
- **Custom Classes**: `myComponent`, `custom_class`, `BEM__element`
- **Already Prefixed**: Classes that already contain your prefix
- **Non-Tailwind Patterns**: Classes starting with numbers or uppercase letters

### Supported Patterns

```javascript
// Simple classes
'bg-red-500' → 'tw-bg-red-500'

// Responsive modifiers
'md:bg-blue-500' → 'md:tw-bg-blue-500'

// Pseudo-class modifiers
'hover:text-white' → 'hover:tw-text-white'

// Complex combinations
'lg:hover:!-translate-x-2' → 'lg:hover:!tw--translate-x-2'

// Group modifiers
'group-hover:opacity-50' → 'group-hover:tw-opacity-50'

// Arbitrary values
'w-[100px]' → 'tw-w-[100px]'
```

## 📁 File Support

| File Type | Extensions | Processing |
|-----------|------------|------------|
| HTML | `.html` | `class` attributes |
| PHP | `.php` | `class` attributes |
| CSS/SCSS | `.css`, `.scss`, `.sass` | Selectors and `@apply` directives |
| JavaScript | `.js`, `.jsx` | `className` attributes |
| TypeScript | `.ts`, `.tsx` | `className` attributes |
| Vue | `.vue` | `class` attributes |
| Svelte | `.svelte` | `class` attributes |

## 🔄 Backup System

- Backups stored in `.tailwind-prefix-backups/` directory
- Timestamped filenames for easy identification
- Restore functionality available
- Automatic cleanup options

```bash
# Restore from backups (if needed)
# Manual restoration from .tailwind-prefix-backups/ directory

# Clean up backups after verification
tailwind-prefixify --clean-backups
```

## ⚙️ Configuration

The tool automatically updates your `tailwind.config.js` file:

```javascript
// Before
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
}

// After
module.exports = {
  prefix: 'tw-',
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## 🚨 Important Notes

1. **Always backup your project** before running the tool (automatic backups are created, but manual backups are recommended for important projects)
2. **Test thoroughly** after applying prefixes
3. **Update your Tailwind config** to match the prefix used
4. **Rebuild your CSS** after making changes
5. **Check for any missed classes** in dynamically generated content

## 🛡️ Safety Features

- **Atomic Operations**: Files are written atomically to prevent corruption
- **Backup Creation**: Automatic backups before any changes
- **Dry Run Support**: Preview changes without applying them
- **Error Handling**: Comprehensive error handling and logging
- **Rollback Capability**: Easy restoration from backups

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/NarekMeliksetyan/tailwind-prefix-bot.git

# Install dependencies
npm install

# Run tests
npm test

# Test the logic
node bin/cli.js --test
```

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/NarekMeliksetyan/tailwind-prefix-bot/issues) page
2. Create a new issue with detailed information
3. Include sample code and expected vs actual behavior

## 🎉 Acknowledgments

Built for developers who need to integrate Tailwind CSS into existing projects without CSS conflicts.