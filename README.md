# SCOM Management Pack Creator

A professional web-based tool for creating System Center Operations Manager (SCOM) Management Packs with an intuitive step-by-step wizard interface.

## 🚀 Features

### Interactive MP Creator Wizard
- **6-Step Progressive Interface**: Guided workflow from basic info to final generation
- **Discovery Methods**: Registry keys, WMI queries, services, scripts, Linux/Unix shell scripts (with an NFS mount discovery starter), and more
- **Health Monitors**: Service, performance, event log, script, and port monitors
- **Data Collection Rules**: Performance counters, event alerts, and custom scripts
- **Advanced Components**: Groups, tasks, views, and recovery actions

### Professional UI/UX
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern Styling**: Professional gradients, animations, and card-based layouts
- **Smart Navigation**: Auto-scroll to steps, progress tracking, and validation
- **Component Cards**: Visual selection with hover effects and status indicators

### SCOM Integration
- **Fragment Library**: Based on Microsoft SCOM best practices and templates
- **Valid XML Generation**: Produces production-ready Management Pack XML
- **Deployment Support**: Includes PowerShell deployment scripts
- **Multiple Export Options**: Preview, download XML, or complete package

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript
- **Styling**: Custom CSS with modern design patterns
- **Icons**: Font Awesome for professional iconography
- **Architecture**: Object-oriented JavaScript with modular design

## 📁 Project Structure

```
SCOM MP Creator/
├── index.html              # Main landing page
├── creator.html             # Interactive MP Creator wizard
├── styles.css              # Main website styling
├── mp-creator.css          # Creator-specific styles
├── script.js               # Navigation and common functionality
├── mp-creator.js           # Core MP Creator logic
└── README.md               # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Web server for local development (optional but recommended)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "SCOM MP Creator"
   ```

2. **Start local development server** (optional):
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**:
   ```
   http://localhost:8000
   ```

### Quick Start

1. **Visit the landing page** (`index.html`) to learn about SCOM MP services
2. **Click "Create MP"** to access the interactive wizard
3. **Follow the 6-step process**:
   - Step 1: Enter basic MP information
   - Step 2: Choose discovery method
   - Step 3: Select health monitors
   - Step 4: Configure data collection rules
   - Step 5: Add groups, tasks, and views
   - Step 6: Preview and generate your MP

## 📋 Usage Guide

### Step 1: Basic Information
- **Company ID**: Your organization identifier (e.g., "Contoso")
- **Application Name**: The application to monitor (e.g., "WebApp")
- **Version**: MP version (defaults to 1.0.0.0)
- **Description**: Optional MP description

### Step 2: Discovery Selection
Choose how SCOM will discover your application:
- **Registry Key**: Check for registry key existence
- **Registry Value**: Validate specific registry values
- **WMI Query**: Use WMI to discover components
- **Script Discovery**: Custom PowerShell logic
- **Service Discovery**: Discover based on Windows services
- **Linux Shell Script Discovery**: Run a shell command on a Unix/Linux computer (via the Microsoft Unix/Linux/SCX management pack's WSMan probe) and parse its output into one or more discovered class instances. Supports single- or multi-instance discovery, an optional privileged (elevated) probe action, schedule/timeout values from 1 through 2147483647 seconds, and customizable property names that remain synchronized with the starter parsing script. The generic starter enumerates immediate directory children using quoted POSIX shell globs rather than parsing `ls`; names and paths are UTF-8 hex encoded for transport, preserving spaces, tabs, pipes, and arrow text. Symlinks—including symlinked directories—are included as `symlink` objects and are never traversed. The generated workflow passes `StdOut`, `ReturnCode`, and `StdErr` to a mandatory safety wrapper: nonzero or invalid return codes are logged as errors and fail without emitting discovery data, while parser output is buffered until parsing finishes successfully. Custom parsers should throw on malformed input; this prevents a partial snapshot from removing previously discovered instances. A zero return code with no records intentionally emits a successful empty snapshot. Shell commands and parsing scripts preserve their exact leading/trailing whitespace through navigation and XML generation. Requires the target computer to already be discovered by the Microsoft Unix/Linux agent (`Microsoft.Unix.Library` / `Microsoft.SystemCenter.WSManagement.Library` management packs). The current monitor, Windows event/performance, and PowerShell rule templates are disabled for Linux discovery because their modules cannot target Unix/Linux-hosted objects; the independently targeted SNMP trap rule remains available and adds its required network-management reference automatically.
- **NFS Mount Discovery (Linux)**: A ready-to-use starter built on Linux Shell Script Discovery, pre-filled with a `/proc/mounts` command and parsing script that discovers each `nfs` or `nfs4` client mount as its own instance (mount point, remote export path, filesystem type, and mount options as properties), hosted under the Linux computer. It transports fields as tab-separated records, preserving legal pipe characters in paths, and decodes standard `/proc/mounts` octal escapes only after splitting each record. The starter validates the complete output before creating discovery data, so a malformed row—including one after valid rows—fails safely rather than publishing a partial destructive snapshot. Linux discovery keys are case-sensitive, so paths such as `/mnt/Data` and `/mnt/data` remain distinct objects. Works out of the box, or customize the command/parsing script/property names for your environment.
- **Imported MP localization**: Generated display strings are merged into the ENU language pack without replacing an imported default language. If the imported MP has no default language, ENU is selected deterministically as the sole default.
- **Safe imported MP merging**: Generated sections follow the Operations Manager SDK Management Pack v2 schema order, existing script and command text is serialized without whitespace-changing pretty printing, and references are derived from parsed SCOM reference-bearing attributes, schema-typed text elements, and quoted `Name`/`Type` operands in `$MPElement`, `$Target`, or `$RunAs` macros. Macro references inside scripts are recognized, while ordinary exclamation text such as `Ready!` or `Payment!Failed` in scripts, configuration, descriptions, comments, and display strings is ignored. Generated content may reuse a custom alias already declared consistently by an imported MP; the built-in catalog is used only to add missing aliases, and known aliases mapped to the wrong library are rejected.
- **Skip Discovery**: Target existing SCOM classes

### Step 3: Health Monitors
Select monitors to track application health:
- **Service Monitor**: Monitor Windows service state
- **Performance Monitor**: Track performance counters
- **Event Log Monitor**: Monitor Windows Event Logs
- **Script Monitor**: Custom health check scripts
- **Port Monitor**: TCP port availability checks
- **Registry Monitor**: Monitor registry changes

### Step 4: Data Collection Rules
Configure data collection and alerting:
- **Performance Collection**: Collect performance data
- **Event Alerts**: Generate alerts from events
- **Script Alerts**: Custom alert conditions
- **SNMP Alerts**: SNMP trap-based alerts

### Step 5: Additional Components
Add organizational and operational components:
- **Groups**: Computer or instance groups
- **Tasks**: PowerShell tasks and recovery actions
- **Views**: State views and alert views

### Step 6: Generate Management Pack
- **Preview**: Review MP structure before generation
- **Generate**: Download XML file
- **Package**: Download XML + deployment scripts

## 🔧 Development

### Code Architecture

**MPCreator Class** (`mp-creator.js`):
- `constructor()`: Initialize wizard state and data structures
- `nextStep()`/`prevStep()`: Handle wizard navigation
- `selectDiscoveryCard()`: Manage discovery method selection
- `handleComponentSelection()`: Process component checkboxes
- `generateMPXML()`: Create SCOM-compatible XML
- `previewMP()`: Generate preview content
- `downloadFile()`: Handle file downloads

**Key Features**:
- **Fragment Library**: Template-based MP generation
- **Progressive Validation**: Step-by-step form validation
- **Auto-scroll**: Smooth navigation between steps
- **Error Handling**: Comprehensive error reporting
- **Responsive Design**: Mobile-friendly interface

### Customization

**Adding New Discovery Methods**:
1. Add entry to `fragmentLibrary` in `loadFragmentLibrary()`
2. Create discovery card in Step 2 HTML
3. Implement XML generation in `generateDiscovery()`

**Adding New Monitors**:
1. Add monitor template to fragment library
2. Create component card in Step 3
3. Implement generation logic in `generateMonitor()`

**Styling Customizations**:
- Modify `mp-creator.css` for wizard-specific styles
- Update `styles.css` for main website appearance
- Customize color scheme via CSS variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

## 🎯 Roadmap

- [ ] **ZIP Package Export**: Complete deployment packages
- [ ] **Advanced Validation**: XML schema validation
- [ ] **Template Import**: Load existing MP templates
- [ ] **Dark Mode**: Theme switching support
- [ ] **Multi-language**: Internationalization support
- [ ] **Cloud Integration**: Azure DevOps integration

## 📊 Project Stats

- **Files**: 6 core files
- **Languages**: HTML, CSS, JavaScript
- **Features**: 20+ component types
- **Wizard Steps**: 6 progressive steps
- **Discovery Methods**: 8 options
- **Monitor Types**: 6 varieties
- **Rule Types**: 4 categories

---

**Built with ❤️ for the SCOM community**
