# SCOM MP Creator - Offline Installation Guide

This guide explains how to run the SCOM MP Creator application on a computer without internet access.

## What You Need

The application is completely self-contained and includes:
- `index.html` - Landing page
- `creator.html` - Main MP creator wizard
- `mp-creator.js` - Application logic
- `mp-creator.css` - Application styles
- `styles.css` - Landing page styles
- `script.js` - Landing page scripts

## External Dependencies (Online Only)

The application uses these external resources that require internet:
- **Font Awesome Icons** - For UI icons
- **Google Fonts (Inter)** - For typography

For offline use, the app will still function but icons and fonts will fall back to system defaults.

## Installation Steps

### Option 1: Simple File Access (Recommended)

1. **Copy all files** to a folder on the offline computer:
   ```
   SCOM-MP-Creator/
   ├── index.html
   ├── creator.html
   ├── mp-creator.js
   ├── mp-creator.css
   ├── styles.css
   └── script.js
   ```

2. **Open in browser**:
   - Double-click `index.html` to open the landing page
   - Click "Get Started" or double-click `creator.html` to launch the wizard
   - **Note**: Some browsers may block JavaScript when opening from `file://` protocol

### Option 2: Local Web Server (Best for Full Functionality)

If the computer has Python installed:

#### Windows:
1. Open Command Prompt
2. Navigate to the folder:
   ```cmd
   cd C:\path\to\SCOM-MP-Creator
   ```
3. Run Python server:
   ```cmd
   python -m http.server 8080
   ```
   or for Python 2:
   ```cmd
   python -m SimpleHTTPServer 8080
   ```

#### macOS/Linux:
1. Open Terminal
2. Navigate to the folder:
   ```bash
   cd /path/to/SCOM-MP-Creator
   ```
3. Run Python server:
   ```bash
   python3 -m http.server 8080
   ```

4. Open browser and go to: `http://localhost:8080`

### Option 3: Using Node.js http-server

If Node.js is installed:

1. Install http-server globally (do this once on a computer with internet):
   ```bash
   npm install -g http-server
   ```

2. On the offline computer, navigate to the folder and run:
   ```bash
   http-server -p 8080
   ```

3. Open browser and go to: `http://localhost:8080`

## Making It Fully Offline (Optional)

To have icons and fonts work offline, you would need to:

1. **Download Font Awesome** (on a computer with internet):
   - Download from: https://fontawesome.com/download
   - Extract to a `fonts/` folder
   - Update HTML files to reference local Font Awesome CSS

2. **Download Google Fonts** (on a computer with internet):
   - Download Inter font from: https://fonts.google.com/specimen/Inter
   - Add font files to a `fonts/` folder
   - Update CSS to use local font files

**Note**: The current version works offline but will use system fonts and skip icons.

## Browser Compatibility

Tested and working on:
- Google Chrome 90+
- Microsoft Edge 90+
- Firefox 88+
- Safari 14+

## Usage

Once running:
1. Fill in basic information (Company ID, App Name, Version)
2. Choose discovery method
3. Select monitors you want to create
4. Configure each monitor instance
5. Review the generated Management Pack XML
6. Download the .xml or .mp files

## Troubleshooting

**Problem**: JavaScript not working when opening HTML files directly
- **Solution**: Use a local web server (Option 2 or 3)

**Problem**: Can't see icons
- **Solution**: This is normal offline. Icons are cosmetic only and don't affect functionality

**Problem**: Fonts look different
- **Solution**: This is normal offline. The app uses system fonts as fallback

**Problem**: Download buttons not working
- **Solution**: Ensure you're using a modern browser and have proper file permissions

## File Size

Total package size: ~250 KB (very lightweight)
- All files are text-based (HTML, CSS, JavaScript)
- No external dependencies bundled
- No database or backend required

## Security Notes

- All processing happens in the browser (client-side)
- No data is sent to any server
- Generated Management Packs are created locally
- Safe to use in air-gapped environments

## Support

For issues or questions:
- GitHub: https://github.com/osalzberg/scom-mp-creator
- LinkedIn: https://www.linkedin.com/in/oren-salzberg-4b827b57/

---

**Version**: 1.0
**Last Updated**: November 2025
