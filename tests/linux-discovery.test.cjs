'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMpCreator, selectDiscoveryWithDefaults } = require('./helpers/loadMpCreator.cjs');

function setBasicInfo(mp, overrides = {}) {
    mp.instance.mpData.basicInfo = {
        companyId: 'CONTOSO',
        appName: 'LinuxMon',
        version: '1.0.0.0',
        description: 'Test management pack',
        ...overrides
    };
}

function setImportedMp(mp, xml) {
    mp.instance.mpData.importedMP = {
        xmlDoc: new mp.window.DOMParser().parseFromString(xml, 'text/xml')
    };
}

function directChildNames(parent) {
    return [...parent.children].map(child => child.tagName);
}

function assertRelativeOrder(parent, expectedNames) {
    const actual = directChildNames(parent).filter(name => expectedNames.includes(name));
    const positions = actual.map(name => expectedNames.indexOf(name));
    assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
}

function assertWellFormedXml(xml) {
    const parser = new mp_DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const parserError = doc.querySelector('parsererror');
    assert.equal(parserError, null, `Generated XML did not parse cleanly:\n${parserError ? parserError.textContent : ''}`);
    return doc;
}

// Use the jsdom-provided DOMParser from the same window each MPCreator instance uses,
// so parsing behaves consistently with how the app itself parses fragments.
let mp_DOMParser;

function withParser(mp, fn) {
    mp_DOMParser = mp.window.DOMParser;
    return fn();
}

function assertParserEmbeddedExactly(scriptBody, parser) {
    assert.ok(scriptBody.includes(parser), 'The saved parser must appear unchanged inside the safety wrapper');
    assert.equal(scriptBody.split(parser).length - 1, 1, 'The saved parser must appear exactly once');
}

function findPowerShellExecutable() {
    for (const executable of ['pwsh', 'powershell']) {
        const probe = spawnSync(executable, ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
            encoding: 'utf8'
        });
        if (!probe.error && probe.status === 0) return executable;
    }
    return null;
}

function runDiscoveryPowerShell(executable, scriptBody, { stdout = '', returnCode = '0', stderr = '' }) {
    const encode = value => Buffer.from(value, 'utf8').toString('base64');
    const harness = `
class MockInstance {
    [void] AddProperty([string]$Name, [object]$Value) {}
}
class MockDiscoveryData {
    [int]$Count = 0
    [MockInstance] CreateClassInstance([string]$Name) { return [MockInstance]::new() }
    [void] AddInstance([object]$Instance) { $this.Count++ }
}
class MockMomApi {
    [MockDiscoveryData] CreateDiscoveryData([object]$Type, [object]$SourceId, [object]$ManagedEntityId) {
        [Console]::Error.WriteLine("CREATE_DISCOVERY_DATA")
        return [MockDiscoveryData]::new()
    }
    [void] LogScriptEvent([object]$ScriptName, [object]$EventId, [object]$Severity, [object]$Message) {
        [Console]::Error.WriteLine("LOG|$Severity|$Message")
    }
}
$script:MockMomApi = [MockMomApi]::new()
function New-Object {
    param([string]$ComObject)
    if ($ComObject -ne "MOM.ScriptAPI") { throw "Unexpected COM object: $ComObject" }
    return $script:MockMomApi
}
$scriptText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encode(scriptBody)}'))
$stdOutText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encode(stdout)}'))
$stdErrText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encode(stderr)}'))
$discoveryScript = [scriptblock]::Create($scriptText)
try {
    $result = & $discoveryScript "source" "entity" "linux01.contoso.com" $stdOutText "${returnCode}" $stdErrText
    foreach ($item in @($result)) {
        if ($item -is [MockDiscoveryData]) {
            Write-Output "DISCOVERY_DATA|$($item.Count)"
        }
        else {
            Write-Output "UNEXPECTED_OUTPUT|$item"
        }
    }
    exit 0
}
catch {
    [Console]::Error.WriteLine("THROWN|$($_.Exception.Message)")
    exit 17
}
`;
    const encodedHarness = Buffer.from(harness, 'utf16le').toString('base64');
    return spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedHarness], {
        encoding: 'utf8'
    });
}

function shellQuote(value) {
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function runStarterShellCommand(command, directory) {
    const configuredCommand = command.replace(
        "directory='/opt/myapp'",
        `directory=${shellQuote(directory)}`
    );
    return spawnSync('/bin/sh', ['-c', configuredCommand], {
        encoding: 'utf8'
    });
}

test('Linux Shell Script Discovery: generic starter produces well-formed MP XML with verified Unix/Linux module IDs', () => {
    const mp = createMpCreator();
    setBasicInfo(mp);
    selectDiscoveryWithDefaults(mp, 'linux-shell-script-discovery');

    const xml = mp.instance.generateNewMPXML();

    const doc = withParser(mp, () => assertWellFormedXml(xml));

    // Verified real Unix/Linux SCOM module/class IDs (sourced from Kevin Holman's
    // FragmentLibrary, not invented) must be present.
    assert.match(xml, /Target="MUL!Microsoft\.Unix\.Computer"/);
    assert.match(xml, /Base="MUL!Microsoft\.Unix\.LocalApplication"/);
    assert.match(xml, /TypeID="MUL!Microsoft\.Unix\.WSMan\.Invoke\.ProbeAction"/);
    assert.match(xml, /<InvokeAction>ExecuteShellCommand<\/InvokeAction>/);
    assert.match(xml, /Windows!Microsoft\.Windows\.PowerShellDiscoveryProbe/);
    assert.match(xml, /<OutputType>System!System\.Discovery\.Data<\/OutputType>/);
    assert.match(xml, /<ID>Microsoft\.Unix\.Library<\/ID>/);
    assert.match(xml, /<ID>Microsoft\.SystemCenter\.WSManagement\.Library<\/ID>/);

    // Default (out-of-the-box) property names must appear as discovered class properties.
    assert.match(xml, /Property ID="InstanceKey" Type="string" Key="true"/);
    assert.match(xml, /Property ID="Property2" Type="string" Key="false"/);
    const scriptBody = doc.querySelector('ScriptBody').textContent;
    for (const propertyId of ['InstanceKey', 'Property2', 'Property3', 'Property4']) {
        assert.ok(scriptBody.includes(`CONTOSO.LinuxMon.LinuxApp.Class']/${propertyId}$`));
    }

    // No leftover unresolved placeholder tokens anywhere in the final XML.
    assert.doesNotMatch(xml, /##[A-Za-z0-9]+##/);
});

test('NFS Mount Discovery starter is ready-to-use out of the box (no user edits) and models one instance per NFS mount', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { companyId: 'CONTOSO', appName: 'NFSMon' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');

    const xml = mp.instance.generateNewMPXML();
    const doc = withParser(mp, () => assertWellFormedXml(xml));

    // NFS-specific defaults must be present without any user edits.
    assert.match(xml, /Property ID="MountPoint" Type="string" Key="true"/);
    assert.match(xml, /Property ID="RemoteExport" Type="string" Key="false"/);
    assert.match(xml, /Property ID="FileSystemType" Type="string" Key="false"/);
    assert.match(xml, /Property ID="MountOptions" Type="string" Key="false"/);

    // Match only NFS client filesystem types. In particular, do not use /^nfs/,
    // which also includes Linux's nfsd pseudo-filesystem.
    const shellCommand = [...doc.querySelectorAll('ShellCommand')]
        .map(node => node.textContent)
        .find(value => value.includes('/proc/mounts'));
    assert.ok(shellCommand);
    assert.match(shellCommand, /\$3 == "nfs" \|\| \$3 == "nfs4"/);
    assert.match(shellCommand, /printf "%s\\t%s\\t%s\\t%s\\n"/);
    assert.doesNotMatch(shellCommand, /\^nfs/);
    assert.doesNotMatch(shellCommand, /print \$2"\|"/);

    // /proc/mounts encodes whitespace and backslashes using octal escapes. The starter
    // must split on real tabs first, then decode each token before using it as a key.
    const scriptBody = doc.querySelector('ScriptBody').textContent;
    assert.ok(scriptBody.includes('$line.TrimEnd("`r").Split("`t")'));
    assert.ok(scriptBody.includes('.Replace("\\040", " ")'));
    assert.ok(scriptBody.includes('.Replace("\\011", "`t")'));
    assert.ok(scriptBody.includes('.Replace("\\012", "`n")'));
    assert.ok(scriptBody.includes('.Replace("\\134", "\\")'));
    assert.match(scriptBody, /ConvertFrom-ProcMountEncoding \(\$fields\[0\]\.Trim\(\)\)/);
    assert.match(scriptBody, /ConvertFrom-ProcMountEncoding \(\$fields\[1\]\.Trim\(\)\)/);
    assert.match(scriptBody, /ConvertFrom-ProcMountEncoding \(\$fields\[3\]\.Trim\(\)\)/);

    // Pipes are legal path characters and therefore must survive the transport intact.
    // Literal tabs cannot appear in /proc/mounts tokens (they are represented as \011),
    // which makes tab a safe delimiter for this four-field record.
    const encodedRecord = [
        String.raw`/mnt/team|blue\040data`,
        String.raw`server:/exports/prod|east\040share`,
        'nfs4',
        'rw,context=team|blue'
    ].join('\t');
    const decodeProcMountToken = value => value
        .replaceAll('\\040', ' ')
        .replaceAll('\\011', '\t')
        .replaceAll('\\012', '\n')
        .replaceAll('\\134', '\\');
    const parsedRecord = encodedRecord.split('\t').map(decodeProcMountToken);
    assert.deepEqual(parsedRecord, [
        '/mnt/team|blue data',
        'server:/exports/prod|east share',
        'nfs4',
        'rw,context=team|blue'
    ]);
    assert.ok(scriptBody.includes(`NFSMount.Class']/MountPoint$", $record.MountPoint)`));
    assert.ok(scriptBody.includes(`NFSMount.Class']/RemoteExport$", $record.RemoteExport)`));

    // The class ID token must be resolved *inside* the parsing script text (this proves
    // the double-pass placeholder substitution fix works: ##ClassID##-derived text is
    // embedded inside the ##ParsingScript## default value, which itself is inserted by
    // an earlier map entry).
    assert.match(xml, /CreateClassInstance\("\$MPElement\[Name='CONTOSO\.NFSMon\.NFSMount\.Class'\]\$"\)/);
    assert.deepEqual(
        [...doc.querySelectorAll('ProbeAction[ID="PSDisco"] Parameters > Parameter')].map(parameter => parameter.querySelector('Name').textContent),
        ['SourceId', 'ManagedEntityId', 'TargetSystem', 'StdOut', 'ReturnCode', 'StdErr']
    );
    assert.match(scriptBody, /\$ParsedReturnCode -ne 0/);
    assert.match(scriptBody, /No discovery snapshot was published/);
    assert.match(scriptBody, /\$ParserOutput = & \$DiscoveryParser/);

    // Non-privileged by default.
    assert.match(xml, /TypeID="MUL!Microsoft\.Unix\.WSMan\.Invoke\.ProbeAction"/);
    assert.doesNotMatch(xml, /MUL!Microsoft\.Unix\.WSMan\.Invoke\.Privileged\.ProbeAction/);

    assert.doesNotMatch(xml, /##[A-Za-z0-9]+##/);
});

test('Privileged toggle selects the elevated Unix/Linux WSMan probe action module', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { companyId: 'CONTOSO', appName: 'NFSMon' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery', { privileged: 'Yes' });

    const xml = mp.instance.generateNewMPXML();
    withParser(mp, () => assertWellFormedXml(xml));

    assert.match(xml, /TypeID="MUL!Microsoft\.Unix\.WSMan\.Invoke\.Privileged\.ProbeAction"/);
});

test('Shell command and parsing script inputs are XML-escaped (no injection / malformed XML)', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { companyId: 'CONTOSO', appName: 'NFSMon' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery', {
        shellCommand: 'echo "<evil>" & cat /etc/passwd',
        parsingScript: '# malicious </ScriptBody><Injected>oops</Injected> & "quotes" \'ticks\''
    });

    const xml = mp.instance.generateNewMPXML();
    const doc = withParser(mp, () => assertWellFormedXml(xml));

    // The raw unescaped strings must not appear verbatim as XML markup.
    assert.doesNotMatch(xml, /<evil>/);
    assert.equal(doc.querySelector('Injected'), null);
});

test('Renamed and de-duplicated property fields stay aligned with every parsing-script AddProperty reference', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { companyId: 'CONTOSO', appName: 'NFSMon' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery', {
        keyPropertyName: 'Mount Point!!',
        property2Name: 'Mount Point!!', // intentional duplicate after sanitization
        property3Name: '123Bad',
        property4Name: ''
    });

    const xml = mp.instance.generateNewMPXML();
    const doc = withParser(mp, () => assertWellFormedXml(xml));

    assert.match(xml, /Property ID="MountPoint" Type="string" Key="true"/);
    // Duplicate sanitized name must be disambiguated, not produce two identical Property IDs.
    assert.match(xml, /Property ID="MountPoint2" Type="string" Key="false"/);
    // A name starting with a digit is not a valid identifier and must fall back.
    assert.match(xml, /Property ID="Property3" Type="string" Key="false"/);
    // An empty name must fall back to its default rather than producing Property ID="".
    assert.doesNotMatch(xml, /Property ID="" /);

    const scriptBody = doc.querySelector('ScriptBody').textContent;
    const expectedPropertyIds = ['MountPoint', 'MountPoint2', 'Property3', 'Property4'];
    for (const propertyId of expectedPropertyIds) {
        assert.ok(
            scriptBody.includes(`CONTOSO.NFSMon.NFSMount.Class']/${propertyId}$`),
            `Parsing script must reference generated property ${propertyId}`
        );
    }
    assert.doesNotMatch(scriptBody, /NFSMount\.Class'\/RemoteExport\$/);
    assert.doesNotMatch(scriptBody, /##(?:KeyPropertyName|Property[234]Name)##/);
});

test('Linux discovery Unique ID is validated in both the UI and final generation', () => {
    for (const invalidUniqueId of ['BAD ID!', '9StartsWithDigit', 'A-B', '']) {
        const mp = createMpCreator();
        setBasicInfo(mp);
        selectDiscoveryWithDefaults(mp, 'linux-shell-script-discovery', { uniqueId: invalidUniqueId });

        const field = mp.document.getElementById('linux-shell-script-discovery-uniqueId');
        assert.equal(mp.instance.validateField(field), false, `${JSON.stringify(invalidUniqueId)} must fail UI validation`);
        assert.throws(
            () => mp.instance.generateNewMPXML(),
            /Unique ID must start with a letter or underscore/
        );
    }

    for (const validUniqueId of ['A', '_VALID_9']) {
        const mp = createMpCreator();
        setBasicInfo(mp);
        selectDiscoveryWithDefaults(mp, 'linux-shell-script-discovery', { uniqueId: validUniqueId });

        const field = mp.document.getElementById('linux-shell-script-discovery-uniqueId');
        assert.equal(field.getAttribute('pattern'), '[A-Za-z_][A-Za-z0-9_]*');
        assert.equal(mp.instance.validateField(field), true);
        assert.match(mp.instance.generateNewMPXML(), new RegExp(`CONTOSO\\.LinuxMon\\.${validUniqueId}\\.Class`));
    }
});

test('Linux discovery interval and timeout enforce the SCOM signed-int range in UI and generation', () => {
    for (const fieldName of ['intervalSeconds', 'timeoutSeconds']) {
        for (const invalidValue of ['0', '-1', '1.5', '', '2147483648']) {
            const mp = createMpCreator();
            setBasicInfo(mp);
            selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery', { [fieldName]: invalidValue });

            const field = mp.document.getElementById(`linux-nfs-discovery-${fieldName}`);
            assert.equal(field.min, '1');
            assert.equal(field.max, '2147483647');
            assert.equal(field.step, '1');
            assert.equal(mp.instance.validateField(field), false, `${fieldName}=${JSON.stringify(invalidValue)} must fail UI validation`);
            assert.throws(
                () => mp.instance.generateNewMPXML(),
                fieldName === 'intervalSeconds' ? /Discovery Interval must be a whole number from 1 through 2147483647/ : /Shell Command Timeout must be a whole number from 1 through 2147483647/
            );
        }
    }

    for (const boundary of ['1', '2147483647']) {
        const mp = createMpCreator();
        setBasicInfo(mp);
        selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery', {
            intervalSeconds: boundary,
            timeoutSeconds: boundary
        });
        assert.doesNotThrow(() => mp.instance.generateNewMPXML());
    }
});

test('Linux plus SNMP generation includes one exact SNL reference in new and imported MPs', () => {
    const configureLinuxSnmp = (mp) => {
        setBasicInfo(mp, { appName: 'LinuxSnmp' });
        selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
        mp.instance.mpData.selectedComponents.rules = ['snmp-alert'];
        mp.instance.mpData.configurations['snmp-alert'] = { oid: '1.3.6.1.4.1.9.9.41.2.0.1' };
    };
    const assertSingleSnlReference = (mp, xml) => {
        const doc = withParser(mp, () => assertWellFormedXml(xml));
        const references = [...doc.querySelectorAll('Manifest > References > Reference[Alias="SNL"]')];
        assert.equal(references.length, 1);
        assert.equal(references[0].querySelector('ID').textContent, 'System.NetworkManagement.Library');
        assert.equal(references[0].querySelector('Version').textContent, '7.0.8437.0');
        assert.equal(references[0].querySelector('PublicKeyToken').textContent, '31bf3856ad364e35');
        assert.equal(doc.querySelectorAll('Manifest > References > Reference[Alias="Health"]').length, 1);
        assert.match(xml, /TypeID="SNL!System\.NetworkManagement\.SnmpTrapEventProvider"/);
    };

    const newMp = createMpCreator();
    configureLinuxSnmp(newMp);
    assertSingleSnlReference(newMp, newMp.instance.generateNewMPXML());

    const importedReferenceCases = [
        '',
        `<References>
      <Reference Alias="Health"><ID>System.Health.Library</ID><Version>7.0.8437.0</Version><PublicKeyToken>31bf3856ad364e35</PublicKeyToken></Reference>
      <Reference Alias="SNL"><ID>System.NetworkManagement.Library</ID><Version>7.0.8437.0</Version><PublicKeyToken>31bf3856ad364e35</PublicKeyToken></Reference>
      <Reference Alias="SNL"><ID>System.NetworkManagement.Library</ID><Version>7.0.8437.0</Version><PublicKeyToken>31bf3856ad364e35</PublicKeyToken></Reference>
    </References>`
    ];

    for (const referencesXml of importedReferenceCases) {
        const importedMp = createMpCreator();
        configureLinuxSnmp(importedMp);
        const importedXml = `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.Imported</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.Imported</Name>
    ${referencesXml}
  </Manifest>
  <Monitoring />
</ManagementPack>`;
        importedMp.instance.mpData.importedMP = {
            xmlDoc: new importedMp.window.DOMParser().parseFromString(importedXml, 'text/xml')
        };
        assertSingleSnlReference(importedMp, importedMp.instance.generateMPXML());
    }
});

test('Imported MPs merge Linux discovery classes, modules, discoveries, references, and display strings exactly once', () => {
    const configureNfsDiscovery = (mp) => {
        setBasicInfo(mp, { appName: 'ImportedLinux' });
        selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
    };
    const generatedIds = {
        classType: 'CONTOSO.ImportedLinux.NFSMount.Class',
        shellModule: 'CONTOSO.ImportedLinux.NFSMount.Class.ShellCommand.DS',
        discoveryModule: 'CONTOSO.ImportedLinux.NFSMount.Class.Discovery.DS',
        discovery: 'CONTOSO.ImportedLinux.NFSMount.Class.Discovery'
    };
    const assertMergedDiscovery = (mp, xml) => {
        const doc = withParser(mp, () => assertWellFormedXml(xml));
        assert.equal(doc.querySelectorAll(`ClassType[ID="${generatedIds.classType}"]`).length, 1);
        assert.equal(doc.querySelectorAll(`DataSourceModuleType[ID="${generatedIds.shellModule}"]`).length, 1);
        assert.equal(doc.querySelectorAll(`DataSourceModuleType[ID="${generatedIds.discoveryModule}"]`).length, 1);
        assert.equal(doc.querySelectorAll(`Discovery[ID="${generatedIds.discovery}"]`).length, 1);
        assert.equal(doc.querySelectorAll('Manifest > References > Reference[Alias="MUL"]').length, 1);
        assert.equal(doc.querySelectorAll('Manifest > References > Reference[Alias="MSWL"]').length, 1);
        assert.equal(doc.querySelectorAll('Manifest > References > Reference[Alias="System"]').length, 1);
        assert.equal(doc.querySelectorAll('Manifest > References > Reference[Alias="Windows"]').length, 1);
        assert.equal(
            doc.querySelectorAll(`LanguagePacks DisplayString[ElementID="${generatedIds.classType}"]:not([SubElementID])`).length,
            1
        );
        assert.equal(
            doc.querySelectorAll(`LanguagePacks DisplayString[ElementID="${generatedIds.classType}"][SubElementID="MountPoint"]`).length,
            1
        );
        return doc;
    };

    const importedVariants = [
        `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.EmptyImport</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.EmptyImport</Name>
  </Manifest>
</ManagementPack>`,
        `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.StructuredImport</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.StructuredImport</Name>
    <References>
      <Reference Alias="System"><ID>System.Library</ID><Version>7.5.8501.0</Version><PublicKeyToken>31bf3856ad364e35</PublicKeyToken></Reference>
    </References>
  </Manifest>
  <TypeDefinitions>
    <EntityTypes><ClassTypes><ClassType ID="Existing.Class" /></ClassTypes></EntityTypes>
    <ModuleTypes><DataSourceModuleType ID="Existing.Module" /></ModuleTypes>
  </TypeDefinitions>
  <Monitoring><Discoveries><Discovery ID="Existing.Discovery" /></Discoveries></Monitoring>
  <Presentation><Views><View ID="Existing.View" /></Views></Presentation>
  <LanguagePacks><LanguagePack ID="ENU" IsDefault="true"><DisplayStrings>
    <DisplayString ElementID="Existing.Class"><Name>Existing class</Name></DisplayString>
  </DisplayStrings></LanguagePack></LanguagePacks>
</ManagementPack>`
    ];

    for (const importedXml of importedVariants) {
        const mp = createMpCreator();
        configureNfsDiscovery(mp);
        mp.instance.mpData.importedMP = {
            xmlDoc: new mp.window.DOMParser().parseFromString(importedXml, 'text/xml')
        };
        const doc = assertMergedDiscovery(mp, mp.instance.generateMPXML());
        if (importedXml.includes('Existing.Class')) {
            assert.equal(doc.querySelectorAll('ClassType[ID="Existing.Class"]').length, 1);
            assert.equal(doc.querySelectorAll('DataSourceModuleType[ID="Existing.Module"]').length, 1);
            assert.equal(doc.querySelectorAll('Discovery[ID="Existing.Discovery"]').length, 1);
            assert.equal(doc.querySelectorAll('View[ID="Existing.View"]').length, 1);
            assert.equal(doc.querySelectorAll('DisplayString[ElementID="Existing.Class"]').length, 1);
        }
    }

    // Importing an MP that already contains the generated discovery must not duplicate
    // sections or ID-bearing elements when the same discovery is selected again.
    const source = createMpCreator();
    configureNfsDiscovery(source);
    const existingGeneratedXml = source.instance.generateNewMPXML()
        .replace('<StringResources>', '<Views><View ID="Existing.View" /></Views><StringResources>');
    const repeated = createMpCreator();
    configureNfsDiscovery(repeated);
    repeated.instance.mpData.importedMP = {
        xmlDoc: new repeated.window.DOMParser().parseFromString(existingGeneratedXml, 'text/xml')
    };
    const repeatedDoc = assertMergedDiscovery(repeated, repeated.instance.generateMPXML());
    assert.equal(repeatedDoc.querySelectorAll('ManagementPack > TypeDefinitions').length, 1);
    assert.equal(repeatedDoc.querySelectorAll('ManagementPack > Monitoring').length, 1);
    assert.equal(repeatedDoc.querySelectorAll('ManagementPack > Presentation').length, 1);
    assert.equal(repeatedDoc.querySelectorAll('ManagementPack > LanguagePacks').length, 1);
});

test('Imported MP merging preserves SCOM schema order across root and nested section matrices', () => {
    const variants = [
        `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.LateSections</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.LateSections</Name></Manifest>
  <Categories><Category ID="Existing.Category" /></Categories>
  <Presentation>
    <ConsoleTasks><ConsoleTask ID="Existing.ConsoleTask" /></ConsoleTasks>
    <Folders><Folder ID="Existing.Folder" /></Folders>
  </Presentation>
  <Reporting />
  <LanguagePacks><LanguagePack ID="ENU" IsDefault="true">
    <KnowledgeArticles><KnowledgeArticle ElementID="Existing.Article" /></KnowledgeArticles>
  </LanguagePack></LanguagePacks>
  <Resources />
</ManagementPack>`,
        `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.NestedSections</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.NestedSections</Name></Manifest>
  <TypeDefinitions>
    <EntityTypes>
      <RelationshipTypes><RelationshipType ID="Existing.Relationship" /></RelationshipTypes>
      <EnumerationTypes><EnumerationValue ID="Existing.Enumeration" /></EnumerationTypes>
      <TypeProjections><TypeProjection ID="Existing.Projection" Type="System!System.Entity" /></TypeProjections>
    </EntityTypes>
    <DataTypes><DataType ID="Existing.DataType" Base="System!System.BaseData" /></DataTypes>
    <SchemaTypes><SchemaType ID="Existing.SchemaType" /></SchemaTypes>
    <SecureReferences><SecureReference ID="Existing.Secret" /></SecureReferences>
    <ModuleTypes><WriteActionModuleType ID="Existing.WriteAction" Accessibility="Internal" /></ModuleTypes>
    <MonitorTypes><UnitMonitorType ID="Existing.MonitorType" /></MonitorTypes>
    <Extensions />
  </TypeDefinitions>
  <Categories><Category ID="Existing.Category" /></Categories>
  <Monitoring>
    <Tasks><Task ID="Existing.Task" /></Tasks>
    <Monitors><UnitMonitor ID="Existing.Monitor" /></Monitors>
    <Diagnostics><Diagnostic ID="Existing.Diagnostic" /></Diagnostics>
    <Recoveries><Recovery ID="Existing.Recovery" /></Recoveries>
    <Overrides><MonitorPropertyOverride ID="Existing.Override" /></Overrides>
    <ServiceLevelObjectives><ServiceLevelObjective ID="Existing.SLO" /></ServiceLevelObjectives>
    <Extensions />
  </Monitoring>
  <ConfigurationGroups />
  <Templates />
  <PresentationTypes />
  <Presentation>
    <Forms><Form ID="Existing.Form" /></Forms>
    <ConsoleTasks><ConsoleTask ID="Existing.ConsoleTask" /></ConsoleTasks>
    <Views><View ID="Existing.View" /></Views>
    <Folders><Folder ID="Existing.Folder" /></Folders>
    <FolderItems><FolderItem ID="Existing.FolderItem" /></FolderItems>
    <ImageReferences><ImageReference ID="Existing.ImageReference" /></ImageReferences>
    <ComponentTypes><ComponentType ID="Existing.ComponentType" /></ComponentTypes>
    <ComponentReferences><ComponentReference ID="Existing.ComponentReference" /></ComponentReferences>
    <ComponentOverrides><ComponentOverride ID="Existing.ComponentOverride" /></ComponentOverrides>
    <ComponentImplementations><ComponentImplementation ID="Existing.ComponentImplementation" /></ComponentImplementations>
    <ComponentBehaviors><ComponentBehavior ID="Existing.ComponentBehavior" /></ComponentBehaviors>
    <BehaviorTypes><BehaviorType ID="Existing.BehaviorType" /></BehaviorTypes>
    <BehaviorImplementations><BehaviorImplementation ID="Existing.BehaviorImplementation" /></BehaviorImplementations>
    <Extensions />
  </Presentation>
  <Warehouse />
  <Reporting />
  <LanguagePacks><LanguagePack ID="ENU" IsDefault="true">
    <KnowledgeArticles><KnowledgeArticle ElementID="Existing.Article" /></KnowledgeArticles>
  </LanguagePack></LanguagePacks>
  <Resources />
  <Extensions />
</ManagementPack>`
    ];

    for (const importedXml of variants) {
        const mp = createMpCreator();
        setBasicInfo(mp, { appName: 'OrderedImport' });
        selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
        mp.instance.mpData.selectedComponents.rules = ['snmp-alert'];
        mp.instance.mpData.configurations['snmp-alert'] = { oid: '1.3.6.1.4.1.9.9.41.2.0.1' };
        setImportedMp(mp, importedXml);

        const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateMPXML()));
        const root = doc.documentElement;
        assertRelativeOrder(root, [
            'Manifest',
            'TypeDefinitions',
            'Categories',
            'Monitoring',
            'ConfigurationGroups',
            'Templates',
            'PresentationTypes',
            'Presentation',
            'Warehouse',
            'Reporting',
            'LanguagePacks',
            'Resources',
            'Extensions'
        ]);

        const typeDefinitions = doc.querySelector('ManagementPack > TypeDefinitions');
        assertRelativeOrder(typeDefinitions, [
            'EntityTypes',
            'DataTypes',
            'SchemaTypes',
            'SecureReferences',
            'ModuleTypes',
            'MonitorTypes',
            'Extensions'
        ]);
        assertRelativeOrder(
            typeDefinitions.querySelector(':scope > EntityTypes'),
            ['ClassTypes', 'RelationshipTypes', 'EnumerationTypes', 'TypeProjections']
        );
        assertRelativeOrder(
            typeDefinitions.querySelector(':scope > ModuleTypes'),
            ['DataSourceModuleType', 'ProbeActionModuleType', 'ConditionDetectionModuleType', 'WriteActionModuleType']
        );
        assertRelativeOrder(
            doc.querySelector('ManagementPack > Monitoring'),
            [
                'Discoveries',
                'Rules',
                'Tasks',
                'Monitors',
                'Diagnostics',
                'Recoveries',
                'Overrides',
                'ServiceLevelObjectives',
                'Extensions'
            ]
        );
        assertRelativeOrder(
            doc.querySelector('ManagementPack > Presentation'),
            [
                'Forms',
                'ConsoleTasks',
                'Views',
                'Folders',
                'FolderItems',
                'ImageReferences',
                'StringResources',
                'ComponentTypes',
                'ComponentReferences',
                'ComponentOverrides',
                'ComponentImplementations',
                'ComponentBehaviors',
                'BehaviorTypes',
                'BehaviorImplementations',
                'Extensions'
            ]
        );
        assertRelativeOrder(
            doc.querySelector('LanguagePack[ID="ENU"]'),
            ['DisplayStrings', 'KnowledgeArticles']
        );
    }
});

test('Imported monitor elements follow the authoritative Aggregate, Unit, Dependency sequence', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'MonitorElementOrder' });
    mp.instance.fragmentLibrary['ordered-monitor-fixture'] = {
        name: 'Ordered monitor fixture',
        fields: [],
        template: `<ManagementPackFragment><Monitoring><Monitors>
  <UnitMonitor ID="CONTOSO.Ordered.Unit" Enabled="true" Target="System!System.Entity" />
</Monitors></Monitoring></ManagementPackFragment>`
    };
    mp.instance.mpData.selectedComponents.discovery = 'ordered-monitor-fixture';
    mp.instance.mpData.configurations['ordered-monitor-fixture'] = {};
    setImportedMp(mp, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.MonitorElementOrder</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.MonitorElementOrder</Name></Manifest>
  <Monitoring><Monitors>
    <AggregateMonitor ID="CONTOSO.Existing.Aggregate" />
    <DependencyMonitor ID="CONTOSO.Existing.Dependency" />
  </Monitors></Monitoring>
</ManagementPack>`);

    const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateMPXML()));
    assert.deepEqual(
        directChildNames(doc.querySelector('Monitoring > Monitors')),
        ['AggregateMonitor', 'UnitMonitor', 'DependencyMonitor']
    );
});

test('Imported generated-element ID collisions reject structural differences but accept equivalents', () => {
    const createGeneratedSource = () => {
        const source = createMpCreator();
        setBasicInfo(source, { appName: 'CollisionImport' });
        selectDiscoveryWithDefaults(source, 'linux-nfs-discovery');
        return { source, xml: source.instance.generateNewMPXML() };
    };
    const collisionCases = [
        {
            selector: 'ClassType[ID="CONTOSO.CollisionImport.NFSMount.Class"]',
            mutate: node => node.setAttribute('Accessibility', 'Internal'),
            expected: /different class type with identifier "CONTOSO\.CollisionImport\.NFSMount\.Class"/
        },
        {
            selector: 'DataSourceModuleType[ID="CONTOSO.CollisionImport.NFSMount.Class.ShellCommand.DS"]',
            mutate: node => node.querySelector('Configuration').appendChild(node.ownerDocument.createElement('Unexpected')),
            expected: /different module type with identifier "CONTOSO\.CollisionImport\.NFSMount\.Class\.ShellCommand\.DS"/
        },
        {
            selector: 'Discovery[ID="CONTOSO.CollisionImport.NFSMount.Class.Discovery"]',
            mutate: node => node.setAttribute('Enabled', 'false'),
            expected: /different discovery with identifier "CONTOSO\.CollisionImport\.NFSMount\.Class\.Discovery"/
        }
    ];

    for (const { selector, mutate, expected } of collisionCases) {
        const { source, xml } = createGeneratedSource();
        const importedDoc = new source.window.DOMParser().parseFromString(xml, 'text/xml');
        mutate(importedDoc.querySelector(selector));

        const mp = createMpCreator();
        setBasicInfo(mp, { appName: 'CollisionImport' });
        selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
        mp.instance.mpData.importedMP = { xmlDoc: importedDoc };
        assert.throws(() => mp.instance.generateMPXML(), expected);
    }

    const { xml: equivalentXml } = createGeneratedSource();
    const equivalent = createMpCreator();
    setBasicInfo(equivalent, { appName: 'CollisionImport' });
    selectDiscoveryWithDefaults(equivalent, 'linux-nfs-discovery');
    setImportedMp(equivalent, equivalentXml);
    const equivalentDoc = withParser(equivalent, () => assertWellFormedXml(equivalent.instance.generateMPXML()));
    assert.equal(equivalentDoc.querySelectorAll('ClassType[ID="CONTOSO.CollisionImport.NFSMount.Class"]').length, 1);
    assert.equal(equivalentDoc.querySelectorAll('DataSourceModuleType[ID^="CONTOSO.CollisionImport.NFSMount.Class"]').length, 2);
    assert.equal(equivalentDoc.querySelectorAll('Discovery[ID="CONTOSO.CollisionImport.NFSMount.Class.Discovery"]').length, 1);
});

test('Imported MP merging enforces global IDs across element types and generated fragments', () => {
    const importedCollision = createMpCreator();
    setBasicInfo(importedCollision, { appName: 'GlobalCollision' });
    selectDiscoveryWithDefaults(importedCollision, 'linux-nfs-discovery');
    setImportedMp(importedCollision, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.ImportedCollision</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.ImportedCollision</Name></Manifest>
  <Presentation><StringResources>
    <StringResource ID="CONTOSO.GlobalCollision.NFSMount.Class" />
  </StringResources></Presentation>
</ManagementPack>`);
    assert.throws(
        () => importedCollision.instance.generateMPXML(),
        /global element identifier "CONTOSO\.GlobalCollision\.NFSMount\.Class" is already used by StringResource .* cannot be reused by ClassType/
    );

    const generatedCollision = createMpCreator();
    setBasicInfo(generatedCollision, { appName: 'GeneratedCollision' });
    generatedCollision.instance.fragmentLibrary['generated-class-collision'] = {
        name: 'Generated class collision fixture',
        fields: [],
        template: `<ManagementPackFragment>
  <TypeDefinitions><EntityTypes><ClassTypes>
    <ClassType ID="CONTOSO.Generated.SharedID" Accessibility="Public" Abstract="false" Base="System!System.Entity" Hosted="false" Singleton="false" />
  </ClassTypes></EntityTypes></TypeDefinitions>
</ManagementPackFragment>`
    };
    generatedCollision.instance.fragmentLibrary['generated-rule-collision'] = {
        name: 'Generated rule collision fixture',
        fields: [],
        template: `<ManagementPackFragment>
  <Monitoring><Rules>
    <Rule ID="CONTOSO.Generated.SharedID" Enabled="true" Target="System!System.Entity" />
  </Rules></Monitoring>
</ManagementPackFragment>`
    };
    generatedCollision.instance.mpData.selectedComponents.discovery = 'generated-class-collision';
    generatedCollision.instance.mpData.selectedComponents.rules = ['generated-rule-collision'];
    generatedCollision.instance.mpData.configurations['generated-class-collision'] = {};
    generatedCollision.instance.mpData.configurations['generated-rule-collision'] = {};
    setImportedMp(generatedCollision, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.GeneratedCollision</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.GeneratedCollision</Name></Manifest>
</ManagementPack>`);
    assert.throws(
        () => generatedCollision.instance.generateMPXML(),
        /Generated components "Generated class collision fixture" and "Generated rule collision fixture" conflict on global element identifier "CONTOSO\.Generated\.SharedID"/
    );
});

test('Imported MP language merging preserves one deterministic default and targets ENU display strings', () => {
    const cases = [
        {
            name: 'existing non-ENU default',
            languagePacks: `<LanguagePack ID="DEU" IsDefault="true"><DisplayStrings>
      <DisplayString ElementID="Existing.DEU"><Name>Vorhanden</Name></DisplayString>
    </DisplayStrings></LanguagePack>`,
            expectedDefault: 'DEU',
            expectedEnuDefault: 'false'
        },
        {
            name: 'ENU already present',
            languagePacks: `<LanguagePack ID="DEU" IsDefault="false"><DisplayStrings>
      <DisplayString ElementID="Existing.DEU"><Name>Vorhanden</Name></DisplayString>
    </DisplayStrings></LanguagePack>
    <LanguagePack ID="ENU" IsDefault="true"><DisplayStrings>
      <DisplayString ElementID="Existing.ENU"><Name>Existing</Name></DisplayString>
    </DisplayStrings></LanguagePack>`,
            expectedDefault: 'ENU',
            expectedEnuDefault: 'true'
        },
        {
            name: 'ENU present with another default',
            languagePacks: `<LanguagePack ID="DEU" IsDefault="true"><DisplayStrings>
      <DisplayString ElementID="Existing.DEU"><Name>Vorhanden</Name></DisplayString>
    </DisplayStrings></LanguagePack>
    <LanguagePack ID="ENU" IsDefault="false"><DisplayStrings>
      <DisplayString ElementID="Existing.ENU"><Name>Existing</Name></DisplayString>
    </DisplayStrings></LanguagePack>`,
            expectedDefault: 'DEU',
            expectedEnuDefault: 'false'
        },
        {
            name: 'no existing default',
            languagePacks: `<LanguagePack ID="DEU" IsDefault="false"><DisplayStrings>
      <DisplayString ElementID="Existing.DEU"><Name>Vorhanden</Name></DisplayString>
    </DisplayStrings></LanguagePack>`,
            expectedDefault: 'ENU',
            expectedEnuDefault: 'true'
        }
    ];

    for (const fixture of cases) {
        const mp = createMpCreator();
        setBasicInfo(mp, { appName: 'LanguageMerge' });
        selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
        setImportedMp(mp, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.${fixture.name.replaceAll(' ', '')}</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.LanguageFixture</Name></Manifest>
  <LanguagePacks>${fixture.languagePacks}</LanguagePacks>
</ManagementPack>`);

        const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateMPXML()));
        const languagePacks = [...doc.querySelectorAll('LanguagePacks > LanguagePack')];
        const defaults = languagePacks.filter(languagePack =>
            languagePack.getAttribute('IsDefault')?.toLowerCase() === 'true'
        );
        const enu = doc.querySelector('LanguagePack[ID="ENU"]');
        const deu = doc.querySelector('LanguagePack[ID="DEU"]');

        assert.equal(defaults.length, 1, `${fixture.name}: exactly one language must remain default`);
        assert.equal(defaults[0].getAttribute('ID'), fixture.expectedDefault);
        assert.equal(enu.getAttribute('IsDefault'), fixture.expectedEnuDefault);
        assert.equal(deu.querySelector('DisplayString[ElementID="Existing.DEU"] Name').textContent, 'Vorhanden');
        assert.equal(
            enu.querySelectorAll('DisplayString[ElementID="CONTOSO.LanguageMerge.NFSMount.Class"]').length,
            5,
            `${fixture.name}: generated display strings must be merged into ENU`
        );
        assert.equal(
            enu.querySelectorAll('DisplayString[ElementID="CONTOSO.LanguageMerge.NFSMount.Class"]:not([SubElementID])').length,
            1
        );
        assert.equal(
            deu.querySelectorAll('DisplayString[ElementID="CONTOSO.LanguageMerge.NFSMount.Class"]').length,
            0,
            `${fixture.name}: imported non-ENU language content must not receive generated strings`
        );
    }
});

test('New MP generation rejects duplicate monitor IDs and cross-type global ID collisions', () => {
    const duplicateMonitors = createMpCreator();
    setBasicInfo(duplicateMonitors, { appName: 'DuplicateMonitors' });
    duplicateMonitors.instance.mpData.selectedComponents.discovery = 'skip';
    duplicateMonitors.instance.mpData.configurations.skip = {
        targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem'
    };
    duplicateMonitors.instance.mpData.selectedComponents.monitors = [
        { type: 'powershell-script-monitor', instanceId: 'powershell-script-monitor-instance-1' },
        { type: 'powershell-script-monitor-3state', instanceId: 'powershell-script-monitor-3state-instance-1' }
    ];
    duplicateMonitors.instance.mpData.configurations['powershell-script-monitor-instance-1'] = {
        uniqueId: 'Shared',
        intervalSeconds: '300',
        eventId: '1234',
        scriptBody: '$bag.AddValue("Result", "GoodCondition")'
    };
    duplicateMonitors.instance.mpData.configurations['powershell-script-monitor-3state-instance-1'] = {
        uniqueId: 'Shared',
        intervalSeconds: '300',
        eventId: '1234',
        scriptBody: '$PropertyBag.AddValue("State", "Ok")'
    };
    assert.throws(
        () => duplicateMonitors.instance.generateNewMPXML(),
        /Generated components "PowerShell Script Monitor \(2 States\) \(powershell-script-monitor-instance-1\)" and "PowerShell Script Monitor \(3 States\) \(powershell-script-monitor-3state-instance-1\)" conflict on global element identifier "CONTOSO\.DuplicateMonitors\.Shared\.Instance1\.Monitor"/
    );

    const crossType = createMpCreator();
    setBasicInfo(crossType, { appName: 'NewCrossType' });
    crossType.instance.fragmentLibrary['new-class-collision'] = {
        name: 'Class component',
        fields: [],
        template: `<ManagementPackFragment><TypeDefinitions><EntityTypes><ClassTypes>
  <ClassType ID="CONTOSO.New.Shared" Accessibility="Public" Abstract="false" Base="System!System.Entity" Hosted="false" Singleton="false" />
</ClassTypes></EntityTypes></TypeDefinitions></ManagementPackFragment>`
    };
    crossType.instance.fragmentLibrary['new-rule-collision'] = {
        name: 'Rule component',
        fields: [],
        template: `<ManagementPackFragment><Monitoring><Rules>
  <Rule ID="CONTOSO.New.Shared" Enabled="true" Target="System!System.Entity" />
</Rules></Monitoring></ManagementPackFragment>`
    };
    crossType.instance.mpData.selectedComponents.discovery = 'new-class-collision';
    crossType.instance.mpData.selectedComponents.rules = ['new-rule-collision'];
    crossType.instance.mpData.configurations['new-class-collision'] = {};
    crossType.instance.mpData.configurations['new-rule-collision'] = {};
    assert.throws(
        () => crossType.instance.generateNewMPXML(),
        /Generated components "Class component" and "Rule component" conflict on global element identifier "CONTOSO\.New\.Shared" \(ClassType .* versus Rule/
    );

    const languageConflict = createMpCreator();
    setBasicInfo(languageConflict, { appName: 'LanguageConflict' });
    const displayFragment = name => `<ManagementPackFragment><LanguagePacks>
  <LanguagePack ID="ENU" IsDefault="true"><DisplayStrings>
    <DisplayString ElementID="CONTOSO.Shared.Display"><Name>${name}</Name></DisplayString>
  </DisplayStrings></LanguagePack>
</LanguagePacks></ManagementPackFragment>`;
    languageConflict.instance.fragmentLibrary['language-component-a'] = {
        name: 'Language component A',
        fields: [],
        template: displayFragment('First name')
    };
    languageConflict.instance.fragmentLibrary['language-component-b'] = {
        name: 'Language component B',
        fields: [],
        template: displayFragment('Different name')
    };
    languageConflict.instance.mpData.selectedComponents.discovery = 'language-component-a';
    languageConflict.instance.mpData.selectedComponents.rules = ['language-component-b'];
    languageConflict.instance.mpData.configurations['language-component-a'] = {};
    languageConflict.instance.mpData.configurations['language-component-b'] = {};
    assert.throws(
        () => languageConflict.instance.generateNewMPXML(),
        /Generated components "Language component A" and "Language component B" conflict on display string "CONTOSO\.Shared\.Display" in language "ENU"/
    );
});

test('New MP generation deduplicates equivalent dependencies and supports ordinary multi-component output', () => {
    const equivalent = createMpCreator();
    setBasicInfo(equivalent, { appName: 'EquivalentDependencies' });
    const sharedModule = `<TypeDefinitions><ModuleTypes>
  <DataSourceModuleType ID="CONTOSO.Shared.Module" Accessibility="Internal">
    <Configuration /><ModuleImplementation><Composite><MemberModules /></Composite></ModuleImplementation>
    <OutputType>System!System.BaseData</OutputType>
  </DataSourceModuleType>
</ModuleTypes></TypeDefinitions>`;
    const sharedDisplay = `<LanguagePacks><LanguagePack ID="ENU" IsDefault="true"><DisplayStrings>
  <DisplayString ElementID="CONTOSO.Shared.Module"><Name>Shared module</Name></DisplayString>
</DisplayStrings></LanguagePack></LanguagePacks>`;
    equivalent.instance.fragmentLibrary['equivalent-discovery-dependency'] = {
        name: 'Equivalent dependency A',
        fields: [],
        template: `<ManagementPackFragment>${sharedModule}${sharedDisplay}</ManagementPackFragment>`
    };
    equivalent.instance.fragmentLibrary['equivalent-rule-dependency'] = {
        name: 'Equivalent dependency B',
        fields: [],
        template: `<ManagementPackFragment>${sharedModule}<Monitoring><Rules>
  <Rule ID="CONTOSO.Equivalent.Rule" Enabled="true" Target="System!System.Entity" />
</Rules></Monitoring>${sharedDisplay}</ManagementPackFragment>`
    };
    equivalent.instance.mpData.selectedComponents.discovery = 'equivalent-discovery-dependency';
    equivalent.instance.mpData.selectedComponents.rules = ['equivalent-rule-dependency'];
    equivalent.instance.mpData.configurations['equivalent-discovery-dependency'] = {};
    equivalent.instance.mpData.configurations['equivalent-rule-dependency'] = {};

    const equivalentDoc = withParser(equivalent, () => assertWellFormedXml(equivalent.instance.generateNewMPXML()));
    assert.equal(equivalentDoc.querySelectorAll('DataSourceModuleType[ID="CONTOSO.Shared.Module"]').length, 1);
    assert.equal(equivalentDoc.querySelectorAll('DisplayString[ElementID="CONTOSO.Shared.Module"]').length, 1);
    assert.equal(equivalentDoc.querySelectorAll('Rule[ID="CONTOSO.Equivalent.Rule"]').length, 1);

    const ordinary = createMpCreator();
    setBasicInfo(ordinary, { appName: 'OrdinaryComponents' });
    ordinary.instance.mpData.selectedComponents.discovery = 'skip';
    ordinary.instance.mpData.configurations.skip = {
        targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem'
    };
    ordinary.instance.mpData.selectedComponents.monitors = [
        { type: 'service-monitor', instanceId: 'service-monitor-instance-1' },
        { type: 'service-monitor', instanceId: 'service-monitor-instance-2' }
    ];
    ordinary.instance.mpData.configurations['service-monitor-instance-1'] = {
        serviceName: 'ServiceA',
        uniqueId: 'ServiceA',
        alertPriority: 'Normal',
        alertSeverity: 'Error'
    };
    ordinary.instance.mpData.configurations['service-monitor-instance-2'] = {
        serviceName: 'ServiceB',
        uniqueId: 'ServiceB',
        alertPriority: 'Normal',
        alertSeverity: 'Error'
    };
    const ordinaryDoc = withParser(ordinary, () => assertWellFormedXml(ordinary.instance.generateNewMPXML()));
    assert.equal(ordinaryDoc.querySelectorAll('Monitoring > Monitors > UnitMonitor').length, 2);
    assert.equal(ordinaryDoc.querySelectorAll('Presentation > StringResources > StringResource').length, 2);
});

test('Configuration saving preserves script whitespace while validating trimmed required content', () => {
    const linux = createMpCreator();
    setBasicInfo(linux, { appName: 'WhitespaceLinux' });
    const shellCommand = "\n\tprintf 'value\\ ' \t\n";
    const parsingScript = "\nparam($SourceId,$ManagedEntityId,[string]$TargetSystem,[string]$StdOut)\n\t# indented\n$DiscoveryData\n\n";
    selectDiscoveryWithDefaults(linux, 'linux-shell-script-discovery', {
        uniqueId: '  Whitespace  ',
        shellCommand,
        parsingScript,
        intervalSeconds: '300',
        timeoutSeconds: '60'
    });
    assert.equal(linux.instance.mpData.configurations['linux-shell-script-discovery'].shellCommand, shellCommand);
    assert.equal(linux.instance.mpData.configurations['linux-shell-script-discovery'].parsingScript, parsingScript);
    assert.equal(linux.instance.mpData.configurations['linux-shell-script-discovery'].uniqueId, 'Whitespace');
    assert.equal(linux.instance.mpData.configurations['linux-shell-script-discovery'].intervalSeconds, '300');
    assert.equal(linux.instance.mpData.configurations['linux-shell-script-discovery'].timeoutSeconds, '60');

    const linuxContainer = linux.document.getElementById('component-configs');
    linuxContainer.innerHTML = `<div id="config-linux-shell-script-discovery">${linux.instance.generateConfigFields(
        'linux-shell-script-discovery',
        linux.instance.fragmentLibrary['linux-shell-script-discovery'].fields
    )}</div>`;
    assert.equal(linux.document.getElementById('linux-shell-script-discovery-shellCommand').value, shellCommand);
    assert.equal(linux.document.getElementById('linux-shell-script-discovery-parsingScript').value, parsingScript);
    linux.instance.saveConfigurationData();

    const linuxDoc = withParser(linux, () => assertWellFormedXml(linux.instance.generateNewMPXML()));
    assert.ok([...linuxDoc.querySelectorAll('ShellCommand')].some(node => node.textContent === shellCommand));
    assertParserEmbeddedExactly(linuxDoc.querySelector('ScriptBody').textContent, parsingScript);

    const legacy = createMpCreator();
    setBasicInfo(legacy, { appName: 'WhitespaceLegacy' });
    const legacyScript = "\n\t$Value = \"keep indentation\"\nWrite-Host 'trailing\\ ' \t\n\n";
    selectDiscoveryWithDefaults(legacy, 'script-discovery', {
        scriptType: 'PowerShell',
        scriptBody: legacyScript,
        targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem'
    });
    assert.equal(legacy.instance.mpData.configurations['script-discovery'].scriptBody, legacyScript);
    const legacyContainer = legacy.document.getElementById('component-configs');
    legacyContainer.innerHTML = `<div id="config-script-discovery">${legacy.instance.generateConfigFields(
        'script-discovery',
        legacy.instance.fragmentLibrary['script-discovery'].fields
    )}</div>`;
    assert.equal(legacy.document.getElementById('script-discovery-scriptBody').value, legacyScript);
    legacy.instance.saveConfigurationData();
    const legacyDoc = withParser(legacy, () => assertWellFormedXml(legacy.instance.generateNewMPXML()));
    assert.ok(legacyDoc.querySelector('ScriptBody').textContent.includes(legacyScript));

    for (const { type, field } of [
        { type: 'linux-shell-script-discovery', field: 'shellCommand' },
        { type: 'linux-shell-script-discovery', field: 'parsingScript' },
        { type: 'script-discovery', field: 'scriptBody' }
    ]) {
        const mp = createMpCreator();
        setBasicInfo(mp);
        selectDiscoveryWithDefaults(mp, type, { [field]: ' \n\t ' });
        const input = mp.document.getElementById(`${type}-${field}`);
        assert.equal(mp.instance.validateField(input), false);
        assert.equal(mp.instance.mpData.configurations[type][field], ' \n\t ');
        assert.throws(
            () => mp.instance.generateNewMPXML(),
            /is required and cannot contain only whitespace/
        );
    }
});

test('Ordinary configuration fields retain baseline trimming while script fields preserve whitespace', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'TrimPolicy' });
    mp.instance.mpData.selectedComponents.discovery = 'registry-key';
    mp.instance.mpData.selectedComponents.monitors = [
        { type: 'service-monitor', instanceId: 'service-monitor-instance-1' }
    ];
    mp.instance.mpData.selectedComponents.rules = ['snmp-alert'];

    const container = mp.document.getElementById('component-configs');
    container.innerHTML = [
        mp.instance.generateConfigFields('registry-key', mp.instance.fragmentLibrary['registry-key'].fields),
        mp.instance.generateConfigFields('service-monitor-instance-1', mp.instance.fragmentLibrary['service-monitor'].fields),
        mp.instance.generateConfigFields('snmp-alert', mp.instance.fragmentLibrary['snmp-alert'].fields)
    ].join('');
    mp.document.getElementById('registry-key-regKeyPath').value = '  SOFTWARE\\Contoso\\App  ';
    mp.document.getElementById('service-monitor-instance-1-serviceName').value = '  W3SVC  ';
    mp.document.getElementById('snmp-alert-oid').value = '  1.3.6.1.4.1.9  ';
    mp.instance.saveConfigurationData();

    assert.equal(mp.instance.mpData.configurations['registry-key'].regKeyPath, 'SOFTWARE\\Contoso\\App');
    assert.equal(mp.instance.mpData.configurations['service-monitor-instance-1'].serviceName, 'W3SVC');
    assert.equal(mp.instance.mpData.configurations['snmp-alert'].oid, '1.3.6.1.4.1.9');
});

test('Imported merge preserves shell heredoc, PowerShell here-string, and mixed text/CDATA exactly', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'ImportedTextSafety' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
    const shellText = "\ncat <<'EOF'\n  leading spaces\n\tleading tab\nEOF\n";
    const scriptPrefix = "\n$payload = @'\n  keep two spaces\n";
    const scriptMiddle = "mixed <text> & content\n";
    const scriptSuffix = "'@\n\tWrite-Host $payload\n\n";
    const importedXml = `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest><Identity><ID>CONTOSO.TextSafety</ID><Version>1.0.0.0</Version></Identity><Name>CONTOSO.TextSafety</Name></Manifest>
  <TypeDefinitions><ModuleTypes>
    <DataSourceModuleType ID="Existing.Text.Safe.Module" Accessibility="Internal">
      <Configuration />
      <ModuleImplementation><Composite><MemberModules>
        <ProbeAction ID="PA" TypeID="Windows!Microsoft.Windows.PowerShellProbe">
          <ShellCommand><![CDATA[${shellText}]]></ShellCommand>
          <ScriptBody><![CDATA[${scriptPrefix}]]>${mp.instance.escapeXml(scriptMiddle)}<![CDATA[${scriptSuffix}]]></ScriptBody>
        </ProbeAction>
      </MemberModules></Composite></ModuleImplementation>
      <OutputType>System!System.BaseData</OutputType>
    </DataSourceModuleType>
  </ModuleTypes></TypeDefinitions>
</ManagementPack>`;
    setImportedMp(mp, importedXml);
    const before = mp.instance.mpData.importedMP.xmlDoc;
    const expectedShell = before.querySelector('DataSourceModuleType[ID="Existing.Text.Safe.Module"] ShellCommand').textContent;
    const expectedScript = before.querySelector('DataSourceModuleType[ID="Existing.Text.Safe.Module"] ScriptBody').textContent;

    const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateMPXML()));
    assert.equal(
        doc.querySelector('DataSourceModuleType[ID="Existing.Text.Safe.Module"] ShellCommand').textContent,
        expectedShell
    );
    assert.equal(
        doc.querySelector('DataSourceModuleType[ID="Existing.Text.Safe.Module"] ScriptBody').textContent,
        expectedScript
    );
    assert.equal(expectedShell, shellText);
    assert.equal(expectedScript, scriptPrefix + scriptMiddle + scriptSuffix);
});

test('Imported reference merging is driven only by aliases used by selected generated fragments', () => {
    const noContent = createMpCreator();
    setBasicInfo(noContent);
    noContent.instance.mpData.selectedComponents.discovery = 'skip';
    setImportedMp(noContent, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.NoContent</ID><Version>1.2.3.4</Version></Identity>
    <Name>CONTOSO.NoContent</Name>
    <References>
      <Reference Alias="System"><ID>Contoso.Unrelated.System</ID><Version>1.0.0.0</Version><PublicKeyToken>abcdef1234567890</PublicKeyToken></Reference>
      <Reference Alias="Windows"><ID>Contoso.Unrelated.Windows</ID><Version>1.0.0.0</Version><PublicKeyToken>abcdef1234567890</PublicKeyToken></Reference>
      <Reference Alias="Health"><ID>Contoso.Unrelated.Health</ID><Version>1.0.0.0</Version><PublicKeyToken>abcdef1234567890</PublicKeyToken></Reference>
    </References>
  </Manifest>
</ManagementPack>`);
    const noContentDoc = withParser(noContent, () => assertWellFormedXml(noContent.instance.generateMPXML()));
    assert.equal(noContentDoc.querySelector('Manifest > Identity > Version').textContent, '1.2.3.5');
    assert.deepEqual(
        [...noContentDoc.querySelectorAll('Manifest > References > Reference')].map(reference => reference.querySelector('ID').textContent),
        ['Contoso.Unrelated.System', 'Contoso.Unrelated.Windows', 'Contoso.Unrelated.Health']
    );

    const minimal = createMpCreator();
    setBasicInfo(minimal, { appName: 'MinimalReferences' });
    minimal.instance.mpData.selectedComponents.discovery = 'skip';
    minimal.instance.mpData.selectedComponents.rules = ['snmp-alert'];
    minimal.instance.mpData.configurations['snmp-alert'] = { oid: '1.3.6.1.4.1.9' };
    setImportedMp(minimal, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.MinimalReferences</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.MinimalReferences</Name>
    <References>
      <Reference Alias="System"><ID>Contoso.Unrelated.System</ID><Version>1.0.0.0</Version><PublicKeyToken>abcdef1234567890</PublicKeyToken></Reference>
    </References>
  </Manifest>
</ManagementPack>`);
    const minimalDoc = withParser(minimal, () => assertWellFormedXml(minimal.instance.generateMPXML()));
    assert.equal(minimalDoc.querySelector('Reference[Alias="System"] ID').textContent, 'Contoso.Unrelated.System');
    assert.equal(minimalDoc.querySelector('Reference[Alias="Health"] ID').textContent, 'System.Health.Library');
    assert.equal(minimalDoc.querySelector('Reference[Alias="SNL"] ID').textContent, 'System.NetworkManagement.Library');
    assert.equal(minimalDoc.querySelector('Reference[Alias="Windows"]'), null);
});

test('Imported custom aliases satisfy generated references while known conflicts and new-MP unknown aliases fail', () => {
    const customFragment = `<ManagementPackFragment>
  <Monitoring><Rules>
    <Rule ID="CONTOSO.CustomSql.Rule" Enabled="true" Target="System!System.Entity">
      <DataSources><DataSource ID="DS" TypeID="SQL!Contoso.Sql.QueryProvider">
        <Database>$Target/Property[Type="SQL!Contoso.Sql.Database"]/Name$</Database>
      </DataSource></DataSources>
    </Rule>
  </Rules></Monitoring>
</ManagementPackFragment>`;
    const configureCustomFragment = mp => {
        setBasicInfo(mp, { appName: 'CustomAlias' });
        mp.instance.fragmentLibrary['custom-sql-alias-fixture'] = {
            name: 'Custom SQL alias fixture',
            fields: [],
            template: customFragment
        };
        mp.instance.mpData.selectedComponents.discovery = 'custom-sql-alias-fixture';
        mp.instance.mpData.configurations['custom-sql-alias-fixture'] = {};
    };

    const imported = createMpCreator();
    configureCustomFragment(imported);
    setImportedMp(imported, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.CustomAlias.Import</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.CustomAlias.Import</Name>
    <References>
      <Reference Alias="SQL"><ID>Contoso.Sql.Library</ID><Version>2.0.0.0</Version><PublicKeyToken>0123456789abcdef</PublicKeyToken></Reference>
    </References>
  </Manifest>
</ManagementPack>`);
    const importedDoc = withParser(imported, () => assertWellFormedXml(imported.instance.generateMPXML()));
    assert.equal(importedDoc.querySelectorAll('Reference[Alias="SQL"]').length, 1);
    assert.equal(importedDoc.querySelector('Reference[Alias="SQL"] ID').textContent, 'Contoso.Sql.Library');
    assert.equal(importedDoc.querySelector('Reference[Alias="System"] ID').textContent, 'System.Library');
    assert.equal(importedDoc.querySelectorAll('Rule[ID="CONTOSO.CustomSql.Rule"]').length, 1);

    const inconsistentCustom = createMpCreator();
    configureCustomFragment(inconsistentCustom);
    setImportedMp(inconsistentCustom, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.InconsistentAlias</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.InconsistentAlias</Name>
    <References>
      <Reference Alias="SQL"><ID>Contoso.Sql.Library</ID><Version>2.0.0.0</Version><PublicKeyToken>0123456789abcdef</PublicKeyToken></Reference>
      <Reference Alias="SQL"><ID>Fabrikam.Sql.Library</ID><Version>1.0.0.0</Version><PublicKeyToken>fedcba9876543210</PublicKeyToken></Reference>
    </References>
  </Manifest>
</ManagementPack>`);
    assert.throws(
        () => inconsistentCustom.instance.generateMPXML(),
        /declares reference alias SQL inconsistently/
    );

    const knownConflict = createMpCreator();
    setBasicInfo(knownConflict, { appName: 'KnownAliasConflict' });
    knownConflict.instance.fragmentLibrary['known-system-fixture'] = {
        name: 'Known System alias fixture',
        fields: [],
        template: '<ManagementPackFragment><TypeDefinitions><ModuleTypes><DataSourceModuleType ID="CONTOSO.System.Module"><OutputType>System!System.BaseData</OutputType></DataSourceModuleType></ModuleTypes></TypeDefinitions></ManagementPackFragment>'
    };
    knownConflict.instance.mpData.selectedComponents.discovery = 'known-system-fixture';
    knownConflict.instance.mpData.configurations['known-system-fixture'] = {};
    setImportedMp(knownConflict, `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack>
  <Manifest>
    <Identity><ID>CONTOSO.KnownConflict</ID><Version>1.0.0.0</Version></Identity>
    <Name>CONTOSO.KnownConflict</Name>
    <References>
      <Reference Alias="System"><ID>Contoso.Not.System.Library</ID><Version>1.0.0.0</Version><PublicKeyToken>0123456789abcdef</PublicKeyToken></Reference>
    </References>
  </Manifest>
</ManagementPack>`);
    assert.throws(
        () => knownConflict.instance.generateMPXML(),
        /alias System for Contoso\.Not\.System\.Library; generated content requires System\.Library/
    );

    const newMp = createMpCreator();
    configureCustomFragment(newMp);
    assert.throws(
        () => newMp.instance.generateNewMPXML(),
        /requires unknown Management Pack reference alias "SQL"/
    );
});

test('Script replacement metacharacters round-trip exactly in shell and parsing script paths', () => {
    const tokens = "literal $1 $& $' $` end";
    const shellCommand = `printf '%s\\n' "${tokens}"`;
    const parsingScript = `param($SourceId,$ManagedEntityId,[string]$TargetSystem,[string]$StdOut)\n# ${tokens}\n$DiscoveryData`;
    const linux = createMpCreator();
    setBasicInfo(linux, { appName: 'ReplacementTokens' });
    selectDiscoveryWithDefaults(linux, 'linux-shell-script-discovery', { shellCommand, parsingScript });

    const linuxDoc = withParser(linux, () => assertWellFormedXml(linux.instance.generateNewMPXML()));
    assert.ok([...linuxDoc.querySelectorAll('ShellCommand')].some(node => node.textContent === shellCommand));
    assertParserEmbeddedExactly(linuxDoc.querySelector('ScriptBody').textContent, parsingScript);

    const discovery = createMpCreator();
    setBasicInfo(discovery, { appName: 'LegacyReplacementTokens' });
    selectDiscoveryWithDefaults(discovery, 'script-discovery', {
        scriptType: 'PowerShell',
        scriptBody: tokens,
        targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem'
    });
    const discoveryDoc = withParser(discovery, () => assertWellFormedXml(discovery.instance.generateNewMPXML()));
    const legacyScriptBody = discoveryDoc.querySelector('ScriptBody').textContent;
    assert.ok(legacyScriptBody.includes(tokens));
    assert.equal(legacyScriptBody.split(tokens).length - 1, 1);

    const fullScriptBody = createMpCreator();
    fullScriptBody.instance.mpData.configurations['replacement-full-script-body'] = { scriptBody: tokens };
    const processed = fullScriptBody.instance.processFragmentTemplate(
        'replacement-full-script-body',
        '<Root><ScriptBody>old content</ScriptBody></Root>'
    );
    const fullBodyDoc = new fullScriptBody.window.DOMParser().parseFromString(processed, 'text/xml');
    assert.equal(fullBodyDoc.querySelector('ScriptBody').textContent, tokens);
});

test('Linux discovery key properties preserve case-sensitive object identity', () => {
    for (const discoveryType of ['linux-shell-script-discovery', 'linux-nfs-discovery']) {
        const mp = createMpCreator();
        setBasicInfo(mp, { appName: 'CaseSensitiveKeys' });
        selectDiscoveryWithDefaults(mp, discoveryType);
        const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateNewMPXML()));
        const keyProperty = doc.querySelector('ClassType > Property[Key="true"]');
        assert.equal(keyProperty.getAttribute('CaseSensitive'), 'true');
    }

    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'CaseSensitiveMounts' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
    const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateNewMPXML()));
    const shellCommand = [...doc.querySelectorAll('ShellCommand')]
        .map(node => node.textContent)
        .find(value => value.includes('/proc/mounts'));
    const parsingScript = doc.querySelector('ScriptBody').textContent;
    const records = [
        '/mnt/Data\tserver:/exports/Data\tnfs4\trw',
        '/mnt/data\tserver:/exports/data\tnfs4\trw'
    ];
    const mountKeys = records.map(record => record.split('\t')[0]);

    assert.deepEqual(mountKeys, ['/mnt/Data', '/mnt/data']);
    assert.notEqual(mountKeys[0], mountKeys[1]);
    assert.doesNotMatch(shellCommand, /tolower/i);
    assert.doesNotMatch(parsingScript, /\.ToLower(?:Invariant)?\s*\(/);
    assert.match(parsingScript, /AddProperty\([^,]+, \$record\.MountPoint\)/);
});

test('Linux discovery form values survive hostile innerHTML round trips exactly and remain XML-safe', () => {
    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'SafeForm' });
    const discoveryType = 'linux-shell-script-discovery';
    const values = {
        uniqueId: '_SAFE9',
        shellCommand: `printf '%s' 'A&B "<tag>" </textarea><img id="shell-injected" src=x>'`,
        parsingScript: `param($SourceId,$ManagedEntityId,[string]$TargetSystem,[string]$StdOut)
# & "quotes" '<angle>' </textarea><script id="script-injected">bad()</script>
$DiscoveryData`,
        keyPropertyName: `Key&"'<> </textarea><img id="key-injected">`,
        property2Name: `Second "value" & <node>`,
        property3Name: `Third 'value' > test`,
        property4Name: `Fourth </textarea><div id="property-injected">`,
        intervalSeconds: '2147483647',
        timeoutSeconds: '1',
        privileged: 'Yes'
    };
    mp.instance.mpData.selectedComponents.discovery = discoveryType;
    mp.instance.mpData.configurations[discoveryType] = { ...values };

    const container = mp.document.getElementById('component-configs');
    const render = () => {
        container.innerHTML = `<div id="config-${discoveryType}">${mp.instance.generateConfigFields(
            discoveryType,
            mp.instance.fragmentLibrary[discoveryType].fields
        )}</div>`;
    };

    // Re-render twice to cover navigation away/back and a subsequent configuration refresh.
    for (let pass = 0; pass < 2; pass++) {
        render();
        for (const [fieldId, expected] of Object.entries(values)) {
            assert.equal(mp.document.getElementById(`${discoveryType}-${fieldId}`).value, expected);
        }
        assert.equal(container.querySelector('#shell-injected, #script-injected, #key-injected, #property-injected'), null);
        mp.instance.saveConfigurationData();
        assert.deepEqual({ ...mp.instance.mpData.configurations[discoveryType] }, values);
    }

    const xml = mp.instance.generateNewMPXML();
    const doc = withParser(mp, () => assertWellFormedXml(xml));
    assert.equal(
        [...doc.querySelectorAll('ShellCommand')].map(node => node.textContent).find(text => text.includes('shell-injected')),
        values.shellCommand
    );
    assertParserEmbeddedExactly(doc.querySelector('ScriptBody').textContent, values.parsingScript);
    assert.equal(doc.querySelector('img, script, #shell-injected, #script-injected'), null);
});

test('Linux discovery publishes only complete successful snapshots at runtime', {
    skip: findPowerShellExecutable() ? false : 'PowerShell is required to execute the generated discovery parser'
}, () => {
    const powershell = findPowerShellExecutable();
    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'RuntimeSafety' });
    selectDiscoveryWithDefaults(mp, 'linux-nfs-discovery');
    const doc = withParser(mp, () => assertWellFormedXml(mp.instance.generateNewMPXML()));
    const scriptBody = doc.querySelector('ProbeAction[ID="PSDisco"] ScriptBody').textContent;

    const cases = [
        {
            name: 'successful empty output',
            input: { stdout: '', returnCode: '0' },
            expectedStatus: 0,
            expectedSnapshot: 'DISCOVERY_DATA|0',
            expectsCreate: true
        },
        {
            name: 'successful multiple rows',
            input: {
                stdout: '/mnt/a\tserver:/a\tnfs\trw\n/mnt/b\tserver:/b\tnfs4\tro\n',
                returnCode: '0'
            },
            expectedStatus: 0,
            expectedSnapshot: 'DISCOVERY_DATA|2',
            expectsCreate: true
        },
        {
            name: 'nonzero shell failure',
            input: {
                stdout: '/mnt/partial\tserver:/partial\tnfs4\trw\n',
                returnCode: '5',
                stderr: 'mount enumeration failed'
            },
            expectedStatus: 17,
            expectedSnapshot: null,
            expectsCreate: false,
            expectedError: /LOG\|1\|.*ReturnCode: 5.*mount enumeration failed/
        },
        {
            name: 'malformed row',
            input: { stdout: '/mnt/incomplete\tserver:/incomplete\tnfs4\n', returnCode: '0' },
            expectedStatus: 17,
            expectedSnapshot: null,
            expectsCreate: false,
            expectedError: /LOG\|1\|Linux discovery parsing failed.*Malformed NFS discovery output row/
        },
        {
            name: 'valid row followed by malformed row',
            input: {
                stdout: '/mnt/valid\tserver:/valid\tnfs4\trw\n/mnt/incomplete\tserver:/incomplete\n',
                returnCode: '0'
            },
            expectedStatus: 17,
            expectedSnapshot: null,
            expectsCreate: false,
            expectedError: /LOG\|1\|Linux discovery parsing failed.*Malformed NFS discovery output row/
        }
    ];

    for (const fixture of cases) {
        const result = runDiscoveryPowerShell(powershell, scriptBody, fixture.input);
        assert.equal(result.status, fixture.expectedStatus, `${fixture.name}: ${result.stderr}`);
        if (fixture.expectedSnapshot) {
            assert.equal(result.stdout.trim(), fixture.expectedSnapshot, `${fixture.name}: ${result.stderr}`);
        } else {
            assert.doesNotMatch(result.stdout, /DISCOVERY_DATA/, fixture.name);
        }
        assert.equal(result.stderr.includes('CREATE_DISCOVERY_DATA'), fixture.expectsCreate, fixture.name);
        if (fixture.expectedError) assert.match(result.stderr, fixture.expectedError, fixture.name);
    }
});

test('Required references are collected only from parsed SCOM reference-bearing XML constructs', () => {
    const mp = createMpCreator();
    const fixture = `<ManagementPackFragment>
  <!-- UnknownComment!Ignored -->
  <TypeDefinitions>
    <EntityTypes><ClassTypes>
      <ClassType ID="CONTOSO.Reference.Class" Base="Windows!Microsoft.Windows.LocalApplication" />
    </ClassTypes></EntityTypes>
    <ModuleTypes><DataSourceModuleType ID="CONTOSO.Reference.DS">
      <ModuleImplementation><Composite><MemberModules>
        <DataSource ID="DS" TypeID="System!System.Scheduler">
          <Value>$Target/Property[Type="MSWL!Microsoft.SystemCenter.WSManagement.WSManData"]/Value$</Value>
          <MonitoringClass>$MPElement[Name="MUL!Microsoft.Unix.Computer"]$</MonitoringClass>
          <Account>$RunAs[Name="SC!Microsoft.SystemCenter.DefaultActionAccount"]/UserName$</Account>
          <ScriptBody>Write-Host "Ready!"; # UnknownScript!Ignored
$entity = "$MPElement[Name='Health!System.Health.EntityState']$"</ScriptBody>
          <ShellCommand>printf 'UnknownShell!Ignored'</ShellCommand>
          <Description>Health!Ignored prose</Description>
          <EventDescription>Payment!Failed</EventDescription>
        </DataSource>
      </MemberModules></Composite></ModuleImplementation>
      <OutputType>Perf!System.Performance.Data</OutputType>
    </DataSourceModuleType></ModuleTypes>
  </TypeDefinitions>
  <LanguagePacks><LanguagePack ID="ENU"><DisplayStrings>
    <DisplayString ElementID="CONTOSO.Reference.Class"><Name>UnknownDisplay!Ignored</Name></DisplayString>
  </DisplayStrings></LanguagePack></LanguagePacks>
</ManagementPackFragment>`;

    assert.deepEqual(
        [...mp.instance.collectRequiredReferenceAliases(fixture, 'reference fixture')].sort(),
        ['Health', 'MSWL', 'MUL', 'Perf', 'SC', 'System', 'Windows']
    );
    assert.deepEqual(
        Array.from(
            mp.instance.getRequiredReferenceSpecs([{ xml: fixture, component: 'reference fixture' }]),
            spec => spec.alias
        ),
        ['Health', 'MSWL', 'MUL', 'Perf', 'SC', 'System', 'Windows']
    );

    assert.throws(
        () => mp.instance.getRequiredReferenceSpecs([{
            component: 'unknown alias fixture',
            xml: '<ManagementPackFragment><Monitoring><Rules><Rule ID="Rule" TypeID="MissingLibrary!Custom.RuleType" /></Rules></Monitoring></ManagementPackFragment>'
        }]),
        /requires unknown Management Pack reference alias "MissingLibrary"/
    );
    assert.doesNotThrow(() => mp.instance.getRequiredReferenceSpecs([{
        component: 'ignored exclamation fixture',
        xml: '<ManagementPackFragment><!-- MissingComment!Type --><Configuration><Status>Payment!Failed</Status><EventDescription>MissingEvent!Type</EventDescription><ShellOutput>MissingOutput!Type</ShellOutput></Configuration><ScriptBody>Write-Host "Ready!" # MissingScript!Type</ScriptBody><ShellCommand>printf "MissingShell!Type"</ShellCommand><Description>MissingDescription!Type</Description><LanguagePacks><LanguagePack ID="ENU"><DisplayStrings><DisplayString ElementID="Local"><Name>MissingDisplay!Type</Name></DisplayString></DisplayStrings></LanguagePack></LanguagePacks></ManagementPackFragment>'
    }]));
});

test('Server Name and Script Discovery script macros contribute required aliases without scanning prose', () => {
    const mp = createMpCreator();
    const fragmentDirectory = path.join(__dirname, '..', 'FragmentLibrary-master 2');
    for (const file of [
        'Class.And.Discovery.Script.ByServerName.mpx',
        'Class.And.Discovery.Script.PowerShell.mpx'
    ]) {
        const source = fs.readFileSync(path.join(fragmentDirectory, file), 'utf8');
        const sourceDoc = new mp.window.DOMParser().parseFromString(source, 'text/xml');
        const scriptBody = sourceDoc.querySelector('ScriptBody');
        const isolated = `<ManagementPackFragment>${mp.instance.nodeToString(scriptBody)}</ManagementPackFragment>`;
        const aliases = mp.instance.collectRequiredReferenceAliases(isolated, file);
        assert.ok(aliases.has('System'), `${file}: System macro alias must be detected inside ScriptBody`);
        assert.ok(aliases.has('Windows'), `${file}: Windows macro alias must be detected inside ScriptBody`);
    }

    const customScript = `<ManagementPackFragment><Monitoring><Discoveries><Discovery ID="Custom">
  <DataSource ID="DS"><ScriptBody>
Write-Host "Ready!"
$perfData = "$MPElement[Name='Perf!System.Performance.Data']$"
$computer = "$Target/Host/Property[Type='Windows!Microsoft.Windows.Computer']/PrincipalName$"
$account = "$RunAs[Name='MUL!Microsoft.Unix.ActionAccount']/UserName$"
  </ScriptBody></DataSource>
</Discovery></Discoveries></Monitoring></ManagementPackFragment>`;
    assert.deepEqual(
        [...mp.instance.collectRequiredReferenceAliases(customScript, 'custom macro fixture')].sort(),
        ['MUL', 'Perf', 'Windows']
    );
});

test('XML-aware reference detection covers every alias-bearing construct pattern in the fragment corpus', () => {
    const mp = createMpCreator();
    const fragmentDirectory = path.join(__dirname, '..', 'FragmentLibrary-master 2');
    const files = fs.readdirSync(fragmentDirectory).filter(file => file.endsWith('.mpx'));
    const aliasPattern = /\b([A-Za-z_][A-Za-z0-9_]*)![A-Za-z_][A-Za-z0-9_.]*/g;
    const macroPattern = /\$(?:MPElement|Target|RunAs)\b[^\r\n$]*?\[\s*(?:Name|Type)\s*=\s*(["'])([^"']+)\1\s*\][^\r\n$]*?\$/g;
    const referenceAttributes = new Set([
        'AlertMessage',
        'Base',
        'ImageID',
        'MemberMonitor',
        'ParentFolder',
        'ParentMonitorID',
        'RelationshipType',
        'Target',
        'Type',
        'TypeID',
        'Value'
    ]);
    const referenceTextElements = new Set(['InputType', 'OutputType', 'SchemaType']);
    let parsedCount = 0;

    for (const file of files) {
        const xml = fs.readFileSync(path.join(fragmentDirectory, file), 'utf8');
        const doc = new mp.window.DOMParser().parseFromString(xml, 'text/xml');
        if (doc.querySelector('parsererror')) continue;
        parsedCount++;

        const expected = new Set();
        const add = value => {
            for (const match of value.matchAll(aliasPattern)) expected.add(match[1]);
        };

        for (const element of doc.querySelectorAll('*')) {
            for (const attribute of element.attributes) {
                if (referenceAttributes.has(attribute.localName)) add(attribute.value);
            }
            for (const child of element.childNodes) {
                if (child.nodeType !== 3 && child.nodeType !== 4) continue;
                const text = child.nodeValue || '';
                if (referenceTextElements.has(element.localName)) add(text);
                for (const macro of text.matchAll(macroPattern)) {
                    add(macro[2]);
                }
            }
        }

        const actual = mp.instance.collectRequiredReferenceAliases(xml, file);
        for (const alias of expected) {
            assert.ok(actual.has(alias), `${file}: reference-bearing alias ${alias} was not detected`);
        }
    }

    assert.ok(parsedCount >= 100, `Expected broad fragment coverage, parsed only ${parsedCount} files`);
});

test('Linux starter shell commands preserve source failures and successful result semantics', {
    skip: process.platform === 'win32' ? 'POSIX shell is required' : false
}, t => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'scom-linux-starter-'));
    t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

    const mp = createMpCreator();
    setBasicInfo(mp, { appName: 'ShellRuntime' });
    selectDiscoveryWithDefaults(mp, 'linux-shell-script-discovery');
    const genericDoc = withParser(mp, () => assertWellFormedXml(mp.instance.generateNewMPXML()));
    const genericCommand = [...genericDoc.querySelectorAll('ShellCommand')]
        .map(node => node.textContent)
        .find(value => value.includes("directory='/opt/myapp'"));
    const genericWrapper = genericDoc.querySelector('ProbeAction[ID="PSDisco"] ScriptBody').textContent;
    assert.ok(genericCommand);
    assert.match(genericCommand, /for entry in "\$directory"\/\* "\$directory"\/\.\[!\.\]\* "\$directory"\/\.\.\?\*/);
    assert.match(genericCommand, /name_hex=\$\(printf '%s' "\$name" \| encode_hex\)/);
    assert.match(genericCommand, /if \[ -L "\$entry" \]; then\s+entry_type='symlink'/);
    assert.doesNotMatch(genericCommand, /\bls\b/);
    assert.doesNotMatch(genericCommand, /\bfind\b/);
    assert.doesNotMatch(genericCommand, /set\s+-o\s+pipefail/);
    assert.match(genericWrapper, /function ConvertFrom-HexUtf8/);

    const missing = runStarterShellCommand(genericCommand, path.join(workspace, 'missing'));
    assert.notEqual(missing.status, 0);
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /missing|No such file|cannot access/i);

    const emptyDirectory = path.join(workspace, 'empty');
    fs.mkdirSync(emptyDirectory);
    const empty = runStarterShellCommand(genericCommand, emptyDirectory);
    assert.equal(empty.status, 0, empty.stderr);
    assert.equal(empty.stdout, '');

    const populatedDirectory = path.join(workspace, 'populated');
    fs.mkdirSync(populatedDirectory);
    fs.writeFileSync(path.join(populatedDirectory, 'alpha'), 'a');
    fs.writeFileSync(path.join(populatedDirectory, 'name with spaces'), 'bb');
    fs.writeFileSync(path.join(populatedDirectory, 'tab\tand|pipe'), 'ccc');
    const targetDirectory = path.join(populatedDirectory, 'target directory');
    fs.mkdirSync(targetDirectory);
    fs.symlinkSync(targetDirectory, path.join(populatedDirectory, 'linked -> directory'), 'dir');
    const multiple = runStarterShellCommand(genericCommand, populatedDirectory);
    assert.equal(multiple.status, 0, multiple.stderr);
    const resultRows = multiple.stdout.trim().split('\n');
    assert.equal(resultRows.length, 5);
    assert.ok(resultRows.every(row => row.split('\t').length === 4));
    const decodeHex = value => Buffer.from(value, 'hex').toString('utf8');
    const decodedRows = resultRows.map(row => {
        const [nameHex, pathHex, type, scope] = row.split('\t');
        return {
            name: decodeHex(nameHex),
            path: decodeHex(pathHex),
            type,
            scope
        };
    });
    assert.deepEqual(decodedRows.map(row => row.name).sort(), [
        'alpha',
        'linked -> directory',
        'name with spaces',
        'tab\tand|pipe',
        'target directory'
    ]);
    assert.ok(decodedRows.every(row => row.path === path.join(populatedDirectory, row.name)));
    assert.ok(decodedRows.every(row => row.scope === 'immediate-child'));
    assert.equal(decodedRows.find(row => row.name === 'linked -> directory').type, 'symlink');
    assert.equal(decodedRows.find(row => row.name === 'target directory').type, 'directory');

    if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
        const inaccessibleDirectory = path.join(workspace, 'inaccessible');
        fs.mkdirSync(inaccessibleDirectory);
        fs.writeFileSync(path.join(inaccessibleDirectory, 'secret'), 'secret');
        fs.chmodSync(inaccessibleDirectory, 0o000);
        const inaccessible = runStarterShellCommand(genericCommand, inaccessibleDirectory);
        fs.chmodSync(inaccessibleDirectory, 0o700);
        assert.notEqual(inaccessible.status, 0);
        assert.equal(inaccessible.stdout, '');
        assert.notEqual(inaccessible.stderr.trim(), '');
    }

    const powershell = findPowerShellExecutable();
    if (powershell) {
        const wrapperSuccess = runDiscoveryPowerShell(powershell, genericWrapper, {
            stdout: multiple.stdout,
            returnCode: String(multiple.status),
            stderr: multiple.stderr
        });
        assert.equal(wrapperSuccess.status, 0, wrapperSuccess.stderr);
        assert.equal(wrapperSuccess.stdout.trim(), 'DISCOVERY_DATA|5');

        const wrapperFailure = runDiscoveryPowerShell(powershell, genericWrapper, {
            stdout: missing.stdout,
            returnCode: String(missing.status),
            stderr: missing.stderr
        });
        assert.equal(wrapperFailure.status, 17);
        assert.doesNotMatch(wrapperFailure.stdout, /DISCOVERY_DATA/);
        assert.doesNotMatch(wrapperFailure.stderr, /CREATE_DISCOVERY_DATA/);
        assert.match(wrapperFailure.stderr, /No discovery snapshot was published/);
    }

    const nfs = createMpCreator();
    setBasicInfo(nfs, { appName: 'NfsShellRuntime' });
    selectDiscoveryWithDefaults(nfs, 'linux-nfs-discovery');
    const nfsDoc = withParser(nfs, () => assertWellFormedXml(nfs.instance.generateNewMPXML()));
    const nfsCommand = [...nfsDoc.querySelectorAll('ShellCommand')]
        .map(node => node.textContent)
        .find(value => value.includes('/proc/mounts'));
    const runNfs = mountFile => spawnSync('/bin/sh', ['-c', nfsCommand.replaceAll('/proc/mounts', shellQuote(mountFile))], {
        encoding: 'utf8'
    });

    const missingMounts = runNfs(path.join(workspace, 'missing-mounts'));
    assert.notEqual(missingMounts.status, 0);
    const emptyMountsPath = path.join(workspace, 'empty-mounts');
    fs.writeFileSync(emptyMountsPath, '');
    const emptyMounts = runNfs(emptyMountsPath);
    assert.equal(emptyMounts.status, 0, emptyMounts.stderr);
    assert.equal(emptyMounts.stdout, '');
    const populatedMountsPath = path.join(workspace, 'mounts');
    fs.writeFileSync(
        populatedMountsPath,
        'server:/a /mnt/a nfs rw 0 0\nserver:/b /mnt/b nfs4 ro 0 0\ntmpfs /run tmpfs rw 0 0\n'
    );
    const multipleMounts = runNfs(populatedMountsPath);
    assert.equal(multipleMounts.status, 0, multipleMounts.stderr);
    assert.deepEqual(multipleMounts.stdout.trim().split('\n'), [
        '/mnt/a\tserver:/a\tnfs\trw',
        '/mnt/b\tserver:/b\tnfs4\tro'
    ]);
});

test('Linux discovery disables every incompatible wizard component but leaves independent SNMP rules available', () => {
    const monitorTypes = [
        'service-monitor',
        'process-monitor',
        'performance-monitor',
        'port-monitor',
        'file-size-monitor',
        'file-count-monitor',
        'text-file-parser-monitor',
        'unc-path-freespace-monitor',
        'powershell-script-monitor',
        'powershell-script-with-params-monitor',
        'powershell-script-monitor-3state'
    ];
    const ruleTypes = [
        'performance-collection',
        'eventlog-alert-eventid-expression',
        'eventlog-alert-eventid-expression-description',
        'eventlog-alert-eventid-expression-source',
        'eventlog-alert-eventid-expression-source-description',
        'eventlog-alert-repeated',
        'eventlog-alert-correlated',
        'script-alert',
        'snmp-alert'
    ];

    const mp = createMpCreator();
    mp.document.body.insertAdjacentHTML('beforeend', `
        <div class="discovery-card" data-discovery="linux-nfs-discovery"></div>
        <div class="discovery-card" data-discovery="registry-key"></div>
        <section id="step-3"><p class="step-description"></p>${monitorTypes.map(type =>
            `<div class="component-card selected"><input type="checkbox" value="${type}" checked></div>`
        ).join('')}</section>
        <section id="step-4"><p class="step-description"></p>${ruleTypes.map(type =>
            `<div class="component-card selected"><input type="checkbox" value="${type}" checked></div>`
        ).join('')}</section>
    `);
    mp.instance.mpData.selectedComponents.monitors = monitorTypes.map((type, index) => ({
        type,
        instanceId: `${type}-instance-${index + 1}`
    }));
    mp.instance.mpData.selectedComponents.rules = [...ruleTypes];

    mp.instance.selectDiscoveryCard(mp.document.querySelector('[data-discovery="linux-nfs-discovery"]'));

    for (const type of monitorTypes) {
        const checkbox = mp.document.querySelector(`[value="${type}"]`);
        assert.equal(checkbox.disabled, true, `${type} must be disabled`);
        assert.equal(checkbox.checked, false, `${type} must be cleared`);
    }
    for (const type of ruleTypes.filter(type => type !== 'snmp-alert')) {
        assert.equal(mp.document.querySelector(`[value="${type}"]`).disabled, true, `${type} must be disabled`);
    }
    assert.equal(mp.document.querySelector('[value="snmp-alert"]').disabled, false);
    assert.equal(mp.document.querySelector('[value="snmp-alert"]').checked, true);
    assert.deepEqual(Array.from(mp.instance.mpData.selectedComponents.monitors), []);
    assert.deepEqual(Array.from(mp.instance.mpData.selectedComponents.rules), ['snmp-alert']);
    assert.match(mp.document.getElementById('step-3-linux-compatibility').textContent, /Windows-only/);
    assert.match(mp.document.getElementById('step-4-linux-compatibility').textContent, /SNMP trap rule remains available/);

    // Switching back to a Windows discovery restores the ordinary workflow choices.
    mp.instance.selectDiscoveryCard(mp.document.querySelector('[data-discovery="registry-key"]'));
    for (const type of [...monitorTypes, ...ruleTypes]) {
        assert.equal(mp.document.querySelector(`[value="${type}"]`).disabled, false, `${type} must be re-enabled`);
    }
});

test('Final generation rejects programmatically injected incompatible Linux combinations', () => {
    const incompatibleSelections = [
        { category: 'monitors', value: [{ type: 'service-monitor', instanceId: 'service-monitor-instance-1' }] },
        { category: 'rules', value: ['script-alert'] },
        { category: 'tasks', value: ['powershell-task'] }
    ];

    for (const { category, value } of incompatibleSelections) {
        const mp = createMpCreator();
        setBasicInfo(mp);
        selectDiscoveryWithDefaults(mp, 'linux-shell-script-discovery');
        mp.instance.mpData.selectedComponents[category] = value;
        assert.throws(
            () => mp.instance.generateNewMPXML(),
            /cannot be combined with the current Windows-only monitor, rule, or task templates/
        );
    }

    const linuxWithSnmp = createMpCreator();
    linuxWithSnmp.instance.mpData.selectedComponents.discovery = 'linux-nfs-discovery';
    linuxWithSnmp.instance.mpData.selectedComponents.rules = ['snmp-alert'];
    assert.doesNotThrow(() => linuxWithSnmp.instance.assertComponentCompatibility());

    const windows = createMpCreator();
    windows.instance.mpData.selectedComponents.discovery = 'registry-key';
    windows.instance.mpData.selectedComponents.monitors = [{ type: 'service-monitor', instanceId: 'service-monitor-instance-1' }];
    windows.instance.mpData.selectedComponents.rules = ['script-alert'];
    assert.doesNotThrow(() => windows.instance.assertComponentCompatibility());
});

test('Regression: existing discovery types still generate well-formed MP XML unaffected by the Linux discovery changes', () => {
    const cases = [
        { type: 'registry-key', config: { uniqueId: 'RegApp', regKeyPath: 'SOFTWARE\\Contoso\\App', valueName: 'Installed', expectedValue: '1', targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem' } },
        { type: 'wmi-query', config: { uniqueId: 'WmiApp', wmiQuery: 'SELECT * FROM Win32_Service', namespace: 'root\\cimv2', targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem' } },
        { type: 'server-name-discovery', config: { uniqueId: 'SrvGroup', computerNameList: 'SERVER1,SERVER2', targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem' } },
        // Note: script-discovery has no uniqueId field of its own (see fragmentLibrary
        // definition), so the generator falls back to the default 'Application' unique
        // ID regardless of the config passed in here - this is pre-existing, unrelated
        // behavior, not something introduced by the Linux discovery changes.
        { type: 'script-discovery', config: { scriptType: 'PowerShell', scriptBody: 'param($SourceId,$ManagedEntityId,$ComputerName)\n$DiscoveryData', targetClass: 'Windows!Microsoft.Windows.Server.OperatingSystem' }, expectedUniqueId: 'Application' }
    ];

    for (const { type, config, expectedUniqueId } of cases) {
        const mp = createMpCreator();
        setBasicInfo(mp);
        selectDiscoveryWithDefaults(mp, type, config);

        const xml = mp.instance.generateNewMPXML();
        const doc = withParser(mp, () => assertWellFormedXml(xml));
        const uniqueId = expectedUniqueId || config.uniqueId;
        assert.ok(xml.includes(`CONTOSO.LinuxMon.${uniqueId}.Class`), `${type}: expected class ID to appear in output`);
        assert.doesNotMatch(xml, /##[A-Za-z0-9]+##/, `${type}: no unresolved placeholders expected`);
    }
});

test('Skip discovery (no discovery selected) still generates valid MP XML with no Linux/Unix references added', () => {
    const mp = createMpCreator();
    setBasicInfo(mp);
    mp.instance.mpData.selectedComponents.discovery = 'skip';

    const xml = mp.instance.generateNewMPXML();
    withParser(mp, () => assertWellFormedXml(xml));

    assert.doesNotMatch(xml, /Microsoft\.Unix\.Library/);
    assert.doesNotMatch(xml, /Microsoft\.SystemCenter\.WSManagement\.Library/);
});
