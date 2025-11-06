# SCOM MP Creator - Offline Package for Windows

## Quick Start (No Internet Required)

### Option 1: Simple Double-Click (Easiest)

1. **Extract all files** to a folder on your Windows computer
2. **Double-click `index.html`** to open in your default browser
3. Click "Get Started" or open `creator.html` to use the wizard

**Note**: Some browsers may show security warnings when opening local HTML files. This is normal.

### Option 2: Local Web Server (Recommended for Best Performance)

#### Using the Batch File (Easiest):

1. **Double-click `start-server.bat`**
2. A command window will open
3. Open your browser and go to: **http://localhost:8080**
4. Press Ctrl+C in the command window to stop when done

#### Using PowerShell:

1. **Right-click `Start-Server.ps1`** and select "Run with PowerShell"
   - If you get an error about execution policy, open PowerShell as Administrator and run:
     ```powershell
     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
     ```
2. Open your browser and go to: **http://localhost:8080**

## What's Included

All files needed to run the application:

```
SCOM-MP-Creator/
├── index.html              - Landing page
├── creator.html            - Main MP Creator wizard
├── mp-creator.js           - Application logic
├── mp-creator.css          - Application styles
├── styles.css              - Landing page styles
├── script.js               - Landing page scripts
├── assets/
│   ├── fontawesome/        - Font Awesome icons (offline)
│   │   └── all.min.css
│   └── webfonts/           - Font Awesome font files
│       ├── fa-solid-900.woff2
│       ├── fa-brands-400.woff2
│       └── fa-regular-400.woff2
├── start-server.bat        - Windows batch file to start server
├── Start-Server.ps1        - PowerShell script to start server
├── OFFLINE_INSTALLATION.md - Detailed installation guide
└── README_WINDOWS.md       - This file
```

## System Requirements

- **Operating System**: Windows 7 or later
- **Browser**: Chrome, Edge, Firefox, or Safari (latest versions)
- **Python** (optional, for local server): Python 2.7+ or Python 3.x
  - Check if Python is installed: Open Command Prompt and type `python --version`
  - Download from: https://www.python.org/downloads/ (if needed on a computer with internet)

## No Python? No Problem!

If you don't have Python installed:

1. Just **double-click `index.html`** or `creator.html`
2. The app will open in your browser and work normally
3. All features are available, no server needed!

## How to Use the App

1. **Start the application** (use any method above)
2. **Fill in basic information**:
   - Company ID (e.g., CONTOSO)
   - Application Name (e.g., MyApp)
   - Version (default: 1.0.0.0)

3. **Choose discovery method**:
   - Registry Key/Value
   - WMI Query
   - PowerShell Script
   - Server Name List
   - Skip Discovery (use existing classes)

4. **Select monitors** you want to create:
   - Service Monitor
   - Process Monitor
   - Performance Counters
   - Event Log monitoring
   - TCP Port checks
   - And more...

5. **Configure each monitor** with specific settings

6. **Download** your Management Pack as .xml or .mp file

## Troubleshooting

### "JavaScript is not working"
- **Solution**: Use the batch file to start a local server (Option 2)

### "Cannot open .bat file"
- **Solution**: Right-click the file and select "Edit" to see if it contains the correct commands, then try running as Administrator

### "Python is not recognized"
- **Solution**: Either:
  - Install Python (get it from python.org on a computer with internet)
  - Or just double-click the HTML files directly (Option 1)

### "Browser shows security warning"
- **Solution**: This is normal for local files. Click "Allow" or "Continue"

### "Download not working"
- **Solution**: Check that your browser allows downloads from local files. Try a different browser (Chrome or Edge work best)

### "Fonts or icons look weird"
- **Solution**: Icons and fonts are now included offline! If you still see issues, refresh the page (F5)

## Security & Privacy

✅ **Completely Offline**: No data sent to any server
✅ **All Processing Local**: Everything runs in your browser
✅ **No Installation**: No changes to your system
✅ **No Admin Rights Needed**: Works with standard user permissions
✅ **Air-Gap Safe**: Perfect for isolated networks

## File Size

Total: ~500 KB (includes all icons and fonts for offline use)

## Common Browser Shortcuts

- **Reload page**: F5 or Ctrl+R
- **Open Developer Console** (for debugging): F12
- **Zoom In**: Ctrl + Plus
- **Zoom Out**: Ctrl + Minus
- **Reset Zoom**: Ctrl + 0

## Need Help?

- GitHub: https://github.com/osalzberg/scom-mp-creator
- LinkedIn: https://www.linkedin.com/in/oren-salzberg-4b827b57/

## License

See LICENSE file for details.

---

**Built by**: Oren Salzberg
**With assistance from**: Ilai Cohen and Yuval Canning
**Version**: 1.0
**Last Updated**: November 2025
