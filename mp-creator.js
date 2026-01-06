// MP Creator JavaScript - Clean Version
class MPCreator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.mpData = {
            basicInfo: {},
            selectedComponents: {
                discovery: null,
                monitors: [],  // Will store objects like {type: 'service-monitor-no-alert', instanceId: 'instance-1'}
                rules: [],
                groups: [],
                tasks: [],
                views: []
            },
            configurations: {},
            importedMP: null,  // Store imported MP data
            importedClasses: []  // Store classes from imported MP
        };
        this.fragmentLibrary = {};
        this.instanceCounters = {};  // Track instance numbers for each monitor type
        this.previewDebounceTimer = null;  // Timer for debouncing auto-preview updates
        
        this.loadFragmentLibrary();
        this.initializeEventListeners();
        
        // Initialize progress line on page load
        setTimeout(() => {
            this.updateProgressLine();
        }, 100);
    }

    // Security: XML encoding for user inputs to prevent XML injection
    escapeXml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Security: HTML encoding for display to prevent XSS
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        const div = document.createElement('div');
        div.textContent = unsafe;
        return div.innerHTML;
    }

    // Security: Sanitize user input - remove potentially dangerous characters
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        // Allow alphanumeric, spaces, hyphens, underscores, dots, and common punctuation
        // Remove any control characters or special sequences
        return input.replace(/[<>'"&\x00-\x1F\x7F]/g, '');
    }

    loadFragmentLibrary() {
        this.fragmentLibrary = {
            'registry-key': {
                name: 'Registry Key Discovery',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <TypeDefinitions>
    <EntityTypes>
      <ClassTypes>
        <ClassType ID="##CompanyID##.##AppName##.##UniqueID##.Class" Base="Windows!Microsoft.Windows.LocalApplication" Accessibility="Public" Abstract="false" Hosted="true" Singleton="false"></ClassType>
      </ClassTypes>
    </EntityTypes>
  </TypeDefinitions>
  <Monitoring>
    <Discoveries>
      <Discovery ID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery" Target="##TargetClass##" Enabled="true" ConfirmDelivery="false" Remotable="true" Priority="Normal">
        <Category>Discovery</Category>
        <DiscoveryTypes>
          <DiscoveryClass TypeID="##CompanyID##.##AppName##.##UniqueID##.Class" />
        </DiscoveryTypes>
        <DataSource ID="DS" TypeID="Windows!Microsoft.Windows.FilteredRegistryDiscoveryProvider">
          <ComputerName>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</ComputerName>
          <RegistryAttributeDefinitions>
            <RegistryAttributeDefinition>
              <AttributeName>##UniqueID##RegKeyExists</AttributeName>
              <Path>##RegKeyPath##</Path>
              <PathType>0</PathType>
              <AttributeType>0</AttributeType>
            </RegistryAttributeDefinition>
          </RegistryAttributeDefinitions>
          <Frequency>86400</Frequency>
          <ClassId>$MPElement[Name="##CompanyID##.##AppName##.##UniqueID##.Class"]$</ClassId>
          <InstanceSettings>
            <Settings>
              <Setting>
                <Name>$MPElement[Name="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Name>
                <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
              </Setting>
              <Setting>
                <Name>$MPElement[Name="System!System.Entity"]/DisplayName$</Name>
                <Value>##CompanyID## ##AppName##</Value>
              </Setting>
            </Settings>
          </InstanceSettings>
          <Expression>
            <SimpleExpression>
              <ValueExpression>
                <XPathQuery Type="Boolean">Values/##UniqueID##RegKeyExists</XPathQuery>
              </ValueExpression>
              <Operator>Equal</Operator>
              <ValueExpression>
                <Value Type="Boolean">true</Value>
              </ValueExpression>
            </SimpleExpression>
          </Expression>
        </DataSource>
      </Discovery>
    </Discoveries>
  </Monitoring>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class Discovery</Name>
        </DisplayString>
      </DisplayStrings>
      <KnowledgeArticles></KnowledgeArticles>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'regKeyPath', label: 'Registry Key Path', type: 'text', required: true, placeholder: 'SOFTWARE\\MyCompany\\MyApplication' },
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'Application' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'registry-value': {
                name: 'Registry Value Discovery',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <TypeDefinitions>
    <EntityTypes>
      <ClassTypes>
        <ClassType ID="##CompanyID##.##AppName##.##UniqueID##.Class" Base="Windows!Microsoft.Windows.LocalApplication" Accessibility="Public" Abstract="false" Hosted="true" Singleton="false"></ClassType>
      </ClassTypes>
    </EntityTypes>
  </TypeDefinitions>
  <Monitoring>
    <Discoveries>
      <Discovery ID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery" Target="##TargetClass##" Enabled="true" ConfirmDelivery="false" Remotable="true" Priority="Normal">
        <Category>Discovery</Category>
        <DiscoveryTypes>
          <DiscoveryClass TypeID="##CompanyID##.##AppName##.##UniqueID##.Class" />
        </DiscoveryTypes>
        <DataSource ID="DS" TypeID="Windows!Microsoft.Windows.FilteredRegistryDiscoveryProvider">
          <ComputerName>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</ComputerName>
          <RegistryAttributeDefinitions>
            <RegistryAttributeDefinition>
              <AttributeName>##UniqueID##RegValueExists</AttributeName>
              <Path>##RegKeyPath##\\##ValueName##</Path>
              <PathType>1</PathType>
              <AttributeType>0</AttributeType>
            </RegistryAttributeDefinition>
          </RegistryAttributeDefinitions>
          <Frequency>86400</Frequency>
          <ClassId>$MPElement[Name="##CompanyID##.##AppName##.##UniqueID##.Class"]$</ClassId>
          <InstanceSettings>
            <Settings>
              <Setting>
                <Name>$MPElement[Name="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Name>
                <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
              </Setting>
              <Setting>
                <Name>$MPElement[Name="System!System.Entity"]/DisplayName$</Name>
                <Value>##CompanyID## ##AppName##</Value>
              </Setting>
            </Settings>
          </InstanceSettings>
          <Expression>
            <SimpleExpression>
              <ValueExpression>
                <XPathQuery Type="Boolean">Values/##UniqueID##RegValueExists</XPathQuery>
              </ValueExpression>
              <Operator>Equal</Operator>
              <ValueExpression>
                <Value Type="Boolean">true</Value>
              </ValueExpression>
            </SimpleExpression>
          </Expression>
        </DataSource>
      </Discovery>
    </Discoveries>
  </Monitoring>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class Discovery</Name>
        </DisplayString>
      </DisplayStrings>
      <KnowledgeArticles></KnowledgeArticles>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'regKeyPath', label: 'Registry Key Path', type: 'text', required: true, placeholder: 'SOFTWARE\\MyCompany\\MyApplication' },
                    { id: 'valueName', label: 'Value Name', type: 'text', required: true, placeholder: 'Version' },
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'Application' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'wmi-query': {
                name: 'WMI Query Discovery',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <TypeDefinitions>
    <EntityTypes>
      <ClassTypes>
        <ClassType ID="##CompanyID##.##AppName##.##UniqueID##.Class" Base="Windows!Microsoft.Windows.LocalApplication" Accessibility="Public" Abstract="false" Hosted="true" Singleton="false"></ClassType>
      </ClassTypes>
    </EntityTypes>
  </TypeDefinitions>
  <Monitoring>
    <Discoveries>
      <Discovery ID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery" Target="##TargetClass##" Enabled="true" ConfirmDelivery="false" Remotable="true" Priority="Normal">
        <Category>Discovery</Category>
        <DiscoveryTypes>
          <DiscoveryClass TypeID="##CompanyID##.##AppName##.##UniqueID##.Class" />
        </DiscoveryTypes>
        <DataSource ID="DS" TypeID="Windows!Microsoft.Windows.WmiProviderWithClassSnapshotDataMapper">
          <NameSpace>##Namespace##</NameSpace>
          <Query><![CDATA[##WMIQuery##]]></Query>
          <Frequency>14400</Frequency>
          <ClassId>$MPElement[Name="##CompanyID##.##AppName##.##UniqueID##.Class"]$</ClassId>
          <InstanceSettings>
            <Settings>
              <Setting>
                <Name>$MPElement[Name="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Name>
                <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
              </Setting>
              <Setting>
                <Name>$MPElement[Name="System!System.Entity"]/DisplayName$</Name>
                <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
              </Setting>
            </Settings>
          </InstanceSettings>
        </DataSource>
      </Discovery>
    </Discoveries>
  </Monitoring>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class Discovery</Name>
        </DisplayString>
      </DisplayStrings>
      <KnowledgeArticles></KnowledgeArticles>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'wmiQuery', label: 'WMI Query', type: 'textarea', required: true, placeholder: 'SELECT * FROM Win32_Service WHERE Name = "YourService"' },
                    { id: 'namespace', label: 'WMI Namespace', type: 'text', required: false, placeholder: 'root\\cimv2', value: 'root\\cimv2' },
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'WMI' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'server-name-discovery': {
                name: 'Discovery by Server Name',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <TypeDefinitions>
    <EntityTypes>
      <ClassTypes>
        <ClassType ID="##CompanyID##.##AppName##.##UniqueID##.Class" Base="Windows!Microsoft.Windows.LocalApplication" Accessibility="Public" Abstract="false" Hosted="true" Singleton="false"></ClassType>
      </ClassTypes>
    </EntityTypes>
  </TypeDefinitions>
  <Monitoring>
    <Discoveries>
      <Discovery ID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery" Target="##TargetClass##" Enabled="true" ConfirmDelivery="false" Remotable="true" Priority="Normal">
        <Category>Discovery</Category>
        <DiscoveryTypes>
          <DiscoveryClass TypeID="##CompanyID##.##AppName##.##UniqueID##.Class" />
        </DiscoveryTypes>
        <DataSource ID="DS" TypeID="Windows!Microsoft.Windows.TimedPowerShell.DiscoveryProvider">
          <IntervalSeconds>86400</IntervalSeconds>
          <SyncTime />
          <ScriptName>##CompanyID##.##AppName##.##UniqueID##.Class.Discovery.ps1</ScriptName>
          <ScriptBody>
param($SourceId,$ManagedEntityId,[string]$ComputerName,[string]$MGName)

$ScriptName = "##CompanyID##.##AppName##.##UniqueID##.Class.Discovery.ps1"
$EventID = "1240"
$StartTime = Get-Date
$whoami = whoami
$momapi = New-Object -comObject MOM.ScriptAPI
$DiscoveryData = $momapi.CreateDiscoveryData(0, $SourceId, $ManagedEntityId)

$NetBIOSName = $ComputerName.Split(".")[0]
$NetBIOSName = $NetBIOSName.Trim()

$momapi.LogScriptEvent($ScriptName,$EventID,0,"\`nScript is starting. \`nRunning as ($whoami). \`nManagement Group: ($MGName). \`nComputerName: ($ComputerName). \`nNetBIOSName: ($NetBIOSName).")

$ComputerNameList = "##ComputerNameList##"
$ComputerNameList = $ComputerNameList.Replace(" ","")
[array]$ComputerNameListArray = $ComputerNameList.Split(",")

IF ($ComputerNameListArray -contains $NetBIOSName)
{
  $instance = $DiscoveryData.CreateClassInstance("$MPElement[Name='##CompanyID##.##AppName##.##UniqueID##.Class']$")
  $instance.AddProperty("$MPElement[Name='Windows!Microsoft.Windows.Computer']/PrincipalName$", $ComputerName)
  $instance.AddProperty("$MPElement[Name='System!System.Entity']/DisplayName$", $ComputerName)
  $DiscoveryData.AddInstance($instance)
  $momapi.LogScriptEvent($ScriptName,$EventID,0,"\`n Discovery script is returning discoverydata objects for ($ComputerName).") 
}

$DiscoveryData

$EndTime = Get-Date
$ScriptTime = ($EndTime - $StartTime).TotalSeconds
$momapi.LogScriptEvent($ScriptName,$EventID,0,"\`n Script Completed. \`n Script Runtime: ($ScriptTime) seconds.")
          </ScriptBody>
          <Parameters>
            <Parameter>
              <Name>SourceId</Name>
              <Value>$MPElement$</Value>
            </Parameter>
            <Parameter>
              <Name>ManagedEntityId</Name>
              <Value>$Target/Id$</Value>
            </Parameter>
            <Parameter>
              <Name>ComputerName</Name>
              <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
            </Parameter>
            <Parameter>
              <Name>MGName</Name>
              <Value>$Target/ManagementGroup/Name$</Value>
            </Parameter>
          </Parameters>
          <TimeoutSeconds>120</TimeoutSeconds>
        </DataSource>
      </Discovery>
    </Discoveries>
  </Monitoring>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Class.Discovery">
          <Name>##CompanyID## ##AppName## ##UniqueID## Class Discovery</Name>
        </DisplayString>
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'computerNameList', label: 'Computer Name List (comma-separated)', type: 'textarea', required: true, placeholder: 'SERVER1,SERVER2,SERVER3' },
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'ServerGroup' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'script-discovery': {
                name: 'Script Discovery',
                template: 'Class.And.Discovery.Script.mpx',
                fields: [
                    { id: 'scriptType', label: 'Script Type', type: 'select', options: ['PowerShell', 'VBScript'], value: 'PowerShell' },
                    { id: 'scriptBody', label: 'Script Content', type: 'textarea', required: true, placeholder: 'Enter your discovery script here...' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'service-monitor': {
                name: 'Service Monitor',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Monitoring>
    <Monitors>
      <UnitMonitor ID="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor" Accessibility="Public" Enabled="true" Target="##ClassID##" ParentMonitorID="Health!System.Health.AvailabilityState" Remotable="true" Priority="Normal" TypeID="Windows!Microsoft.Windows.CheckNTServiceStateMonitorType" ConfirmDelivery="false">
        <Category>AvailabilityHealth</Category>
        <AlertSettings AlertMessage="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor.AlertMessage">
          <AlertOnState>Warning</AlertOnState>
          <AutoResolve>true</AutoResolve>
          <AlertPriority>##AlertPriority##</AlertPriority>
          <AlertSeverity>##AlertSeverity##</AlertSeverity>
          <AlertParameters>
            <AlertParameter1>$Data/Context/Property[@Name='Name']$</AlertParameter1>
            <AlertParameter2>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</AlertParameter2>
          </AlertParameters>
        </AlertSettings>
        <OperationalStates>
          <OperationalState ID="Running" MonitorTypeStateID="Running" HealthState="Success" />
          <OperationalState ID="NotRunning" MonitorTypeStateID="NotRunning" HealthState="Warning" />
        </OperationalStates>
        <Configuration>
          <ComputerName />
          <ServiceName>##ServiceName##</ServiceName>
          <CheckStartupType />
        </Configuration>
      </UnitMonitor>
    </Monitors>
  </Monitoring>
  <Presentation>
    <StringResources>
      <StringResource ID="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor.AlertMessage" />
    </StringResources>
  </Presentation>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor">
          <Name>##CompanyID## ##AppName## ##ServiceName## Service Monitor</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor" SubElementID="Running">
          <Name>Running</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor" SubElementID="NotRunning">
          <Name>Not Running</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Service.Monitor.AlertMessage">
          <Name>##AppName## ##ServiceName## service is not running</Name>
          <Description>Service {0} is not running on {1}</Description>
        </DisplayString>
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'serviceName', label: 'Service Name', type: 'text', required: true, placeholder: 'W3SVC' },
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'WebService' },
                    { id: 'alertPriority', label: 'Alert Priority', type: 'select', options: ['Low', 'Normal', 'High'], value: 'Normal' },
                    { id: 'alertSeverity', label: 'Alert Severity', type: 'select', options: ['Information', 'Warning', 'Error'], value: 'Error' }
                ]
            },
            'performance-monitor': {
                name: 'Performance Monitor',
                template: 'Monitor.Performance.ConsecSamples.TwoState.mpx',
                fields: [
                    { id: 'objectName', label: 'Performance Object', type: 'text', required: true, placeholder: 'Processor' },
                    { id: 'counterName', label: 'Counter Name', type: 'text', required: true, placeholder: '% Processor Time' },
                    { id: 'instanceName', label: 'Instance', type: 'text', required: false, placeholder: '_Total' },
                    { id: 'frequencySeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'threshold', label: 'Threshold', type: 'number', required: true, placeholder: '80' },
                    { id: 'samples', label: 'Consecutive Samples', type: 'number', required: true, value: '3' }
                ]
            },
            'process-monitor': {
                name: 'Process Monitor',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <TypeDefinitions>
    <MonitorTypes>
        <UnitMonitorType ID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.MonitorType" Accessibility="Public">
          <MonitorTypeStates>
            <MonitorTypeState ID="ProcessCountThresholdBreached" NoDetection="false" />
            <MonitorTypeState ID="ProcessCountWithinThresholds" NoDetection="false" />
          </MonitorTypeStates>
          <Configuration>
            <IncludeSchemaTypes>
              <SchemaType>System!System.ExpressionEvaluatorSchema</SchemaType>
            </IncludeSchemaTypes>
            <xsd:element name="ProcessName" type="xsd:string" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
            <xsd:element name="FrequencySeconds" type="xsd:unsignedInt" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
            <xsd:element name="MinProcessCount" type="xsd:unsignedInt" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
            <xsd:element name="MaxProcessCount" type="xsd:unsignedInt" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
            <xsd:element name="MatchCount" type="xsd:integer" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
          </Configuration>
          <OverrideableParameters>
            <OverrideableParameter ID="FrequencySeconds" Selector="$Config/FrequencySeconds$" ParameterType="int" />
            <OverrideableParameter ID="MinProcessCount" Selector="$Config/MinProcessCount$" ParameterType="int" />
            <OverrideableParameter ID="MaxProcessCount" Selector="$Config/MaxProcessCount$" ParameterType="int" />
            <OverrideableParameter ID="MatchCount" Selector="$Config/MatchCount$" ParameterType="int" />
          </OverrideableParameters>
          <MonitorImplementation>
            <MemberModules>
              <DataSource ID="DS" TypeID="System!System.ProcessInformationProvider">
                <Frequency>$Config/FrequencySeconds$</Frequency>
              </DataSource>
              <ConditionDetection ID="CDProcessCountWithinThresholds" TypeID="System!System.ExpressionFilter">
                <Expression>
                  <And>
                    <Expression>
                      <Exists>
                        <ValueExpression>
                          <XPathQuery Type="UnsignedInteger">ProcessInformations/ProcessInformation[./ProcessName ='$Config/ProcessName$']/ActiveInstanceCount</XPathQuery>
                        </ValueExpression>
                      </Exists>
                    </Expression>
                    <Expression>
                      <SimpleExpression>
                        <ValueExpression>
                          <XPathQuery Type="UnsignedInteger">ProcessInformations/ProcessInformation[./ProcessName ='$Config/ProcessName$']/ActiveInstanceCount</XPathQuery>
                        </ValueExpression>
                        <Operator>GreaterEqual</Operator>
                        <ValueExpression>
                          <Value Type="UnsignedInteger">$Config/MinProcessCount$</Value>
                        </ValueExpression>
                      </SimpleExpression>
                    </Expression>
                    <Expression>  
                      <SimpleExpression>
                        <ValueExpression>
                          <XPathQuery Type="UnsignedInteger">ProcessInformations/ProcessInformation[./ProcessName ='$Config/ProcessName$']/ActiveInstanceCount</XPathQuery>
                        </ValueExpression>
                        <Operator>LessEqual</Operator>
                        <ValueExpression>
                          <Value Type="UnsignedInteger">$Config/MaxProcessCount$</Value>
                        </ValueExpression>
                      </SimpleExpression>
                    </Expression>
                  </And>
                </Expression>
              </ConditionDetection>
              <ConditionDetection ID="CDProcessCountThresholdBreached" TypeID="System!System.ExpressionFilter">
                <Expression>
                  <Not>
                    <Expression>
                      <And>
                        <Expression>
                          <Exists>
                            <ValueExpression>
                              <XPathQuery Type="UnsignedInteger">ProcessInformations/ProcessInformation[./ProcessName ='$Config/ProcessName$']/ActiveInstanceCount</XPathQuery>
                            </ValueExpression>
                          </Exists>
                        </Expression>
                        <Expression>
                          <SimpleExpression>
                            <ValueExpression>
                              <XPathQuery Type="UnsignedInteger">ProcessInformations/ProcessInformation[./ProcessName ='$Config/ProcessName$']/ActiveInstanceCount</XPathQuery>
                            </ValueExpression>
                            <Operator>GreaterEqual</Operator>
                            <ValueExpression>
                              <Value Type="UnsignedInteger">$Config/MinProcessCount$</Value>
                            </ValueExpression>
                          </SimpleExpression>
                        </Expression>
                        <Expression>  
                          <SimpleExpression>
                            <ValueExpression>
                              <XPathQuery Type="UnsignedInteger">ProcessInformations/ProcessInformation[./ProcessName ='$Config/ProcessName$']/ActiveInstanceCount</XPathQuery>
                            </ValueExpression>
                            <Operator>LessEqual</Operator>
                            <ValueExpression>
                              <Value Type="UnsignedInteger">$Config/MaxProcessCount$</Value>
                            </ValueExpression>
                          </SimpleExpression>
                        </Expression>
                      </And>
                    </Expression>
                  </Not>
                </Expression>
                <SuppressionSettings>
                  <MatchCount>$Config/MatchCount$</MatchCount>
                </SuppressionSettings>  
              </ConditionDetection>
            </MemberModules>
            <RegularDetections>
              <RegularDetection MonitorTypeStateID="ProcessCountThresholdBreached">
                <Node ID="CDProcessCountThresholdBreached">
                  <Node ID="DS" />
                </Node>
              </RegularDetection>
              <RegularDetection MonitorTypeStateID="ProcessCountWithinThresholds">
                <Node ID="CDProcessCountWithinThresholds">
                  <Node ID="DS" />
                </Node>
              </RegularDetection>
            </RegularDetections>
          </MonitorImplementation>
        </UnitMonitorType>
    </MonitorTypes>
  </TypeDefinitions>
  <Monitoring>
    <Monitors>
      <UnitMonitor ID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor" Accessibility="Public" Enabled="true" Target="##ClassID##" ParentMonitorID="Health!System.Health.AvailabilityState" Remotable="false" Priority="Normal" TypeID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.MonitorType" ConfirmDelivery="false">
        <Category>AvailabilityHealth</Category>
        <AlertSettings AlertMessage="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor.AlertMessage">
          <AlertOnState>Warning</AlertOnState>
          <AutoResolve>true</AutoResolve>
          <AlertPriority>Normal</AlertPriority>
          <AlertSeverity>Warning</AlertSeverity>
          <AlertParameters>
            <AlertParameter1>$Data[Default='0']/Context/ProcessInformations/ProcessInformation[./ProcessName ='##ProcessName##']/ActiveInstanceCount$</AlertParameter1>
            <AlertParameter2>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</AlertParameter2>
          </AlertParameters>
        </AlertSettings>
        <OperationalStates>
          <OperationalState ID="ProcessCountWithinThresholds" MonitorTypeStateID="ProcessCountWithinThresholds" HealthState="Success" />
          <OperationalState ID="ProcessCountThresholdBreached" MonitorTypeStateID="ProcessCountThresholdBreached" HealthState="Warning" />
        </OperationalStates>
        <Configuration>
          <ProcessName>##ProcessName##</ProcessName>    
          <FrequencySeconds>##FrequencySeconds##</FrequencySeconds>
          <MinProcessCount>##MinProcessCount##</MinProcessCount>
          <MaxProcessCount>##MaxProcessCount##</MaxProcessCount>  
          <MatchCount>##MatchCount##</MatchCount>
        </Configuration>
      </UnitMonitor>
    </Monitors>
  </Monitoring>
  <Presentation>  
    <StringResources>
      <StringResource ID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor.AlertMessage" />
    </StringResources>
  </Presentation>  
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>  
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor">
          <Name>##CompanyID## ##AppName## ##ProcessName## Process Count Monitor</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor" SubElementID="ProcessCountWithinThresholds">
          <Name>Process count within thresholds</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor" SubElementID="ProcessCountThresholdBreached">
          <Name>Process count threshold breached</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.ProcessCount.Monitor.AlertMessage">
          <Name>##AppName## ##ProcessName## - Process count threshold has been breached.</Name>
          <Description>The number of expected processes was less than or greater than the thresholds
Process name: (##ProcessName##)
Process count found: {0} 
Computer: {1}</Description>
        </DisplayString>
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'uniqueId', label: 'Unique ID (no spaces)', type: 'text', required: true, placeholder: 'WebServer' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', required: true, value: 'Windows!Microsoft.Windows.Server.OperatingSystem', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'] },
                    { id: 'processName', label: 'Process Name (lowercase)', type: 'text', required: true, placeholder: 'notepad.exe' },
                    { id: 'frequencySeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '60' },
                    { id: 'minProcessCount', label: 'Minimum Process Count', type: 'number', required: true, value: '1' },
                    { id: 'maxProcessCount', label: 'Maximum Process Count', type: 'number', required: true, value: '10' },
                    { id: 'matchCount', label: 'Match Count (breaches before alert)', type: 'number', required: true, value: '2' }
                ]
            },
            'port-monitor': {
                name: 'Port Check Monitor',
                template: 'Monitor.PortCheck.mpx',
                fields: [
                    { id: 'portNumber', label: 'Port Number', type: 'number', required: true, placeholder: '80' },
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '120' },
                    { id: 'matchCount', label: 'Match Count (consecutive failures)', type: 'number', required: true, value: '2' }
                ]
            },
            'file-size-monitor': {
                name: 'File Size Monitor',
                template: 'Monitor.TimedScript.PowerShell.FileSize.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'folderPath', label: 'Folder Path', type: 'text', required: true, placeholder: 'C:\\Logs' },
                    { id: 'fileNameFilter', label: 'File Name Filter', type: 'text', required: true, placeholder: '*.log,*.txt' },
                    { id: 'fileSizeThresholdKB', label: 'File Size Threshold (KB)', type: 'number', required: true, value: '1024' },
                    { id: 'fileCountThreshold', label: 'File Count Threshold', type: 'number', required: true, value: '1' }
                ]
            },
            'file-count-monitor': {
                name: 'File Count Monitor',
                template: 'Monitor.TimedScript.PowerShell.FileCountInFolderThreshold.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'folderPath', label: 'Folder Path', type: 'text', required: true, placeholder: 'C:\\Logs' },
                    { id: 'fileNameFilter', label: 'File Name Filter', type: 'text', required: true, placeholder: '*.log' },
                    { id: 'fileCountThreshold', label: 'File Count Threshold', type: 'number', required: true, value: '100' },
                    { id: 'comparisonType', label: 'Comparison Type', type: 'select', options: ['Greater Than', 'Less Than'], value: 'Greater Than' }
                ]
            },
            'unc-path-freespace-monitor': {
                name: 'UNC Path Free Space Monitor',
                template: 'Monitor.TimedScript.PowerShell.UNCPathFreeSpace.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'uncPath', label: 'UNC Path', type: 'text', required: true, placeholder: '\\\\server\\share\\folder' },
                    { id: 'warningThresholdPercent', label: 'Warning Threshold (%)', type: 'number', required: true, value: '20' },
                    { id: 'criticalThresholdPercent', label: 'Critical Threshold (%)', type: 'number', required: true, value: '10' }
                ]
            },
            'text-file-parser-monitor': {
                name: 'Text File Parser Monitor',
                template: 'Monitor.TimedScript.PowerShell.ParseTextFile.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'timeoutSeconds', label: 'Timeout (seconds)', type: 'number', required: true, value: '120' },
                    { id: 'filePath', label: 'File Path', type: 'text', required: true, placeholder: 'C:\\Logs\\application.log' },
                    { id: 'searchString', label: 'Search String', type: 'text', required: true, placeholder: 'ERROR' },
                    { id: 'matchThreshold', label: 'Match Threshold (hours)', type: 'number', required: true, value: '1' }
                ]
            },
            'powershell-script-monitor': {
                name: 'PowerShell Script Monitor (2 States)',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <TypeDefinitions>
    <ModuleTypes>
      <DataSourceModuleType ID="##CompanyID##.##AppName##.##UniqueID##.Monitor.DataSource" Accessibility="Internal" Batching="false">
        <Configuration>
          <xsd:element minOccurs="1" type="xsd:integer" name="IntervalSeconds" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
          <xsd:element minOccurs="0" type="xsd:string" name="SyncTime" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
          <xsd:element minOccurs="1" type="xsd:integer" name="TimeoutSeconds" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />	
        </Configuration>
        <OverrideableParameters>
          <OverrideableParameter ID="IntervalSeconds" Selector="$Config/IntervalSeconds$" ParameterType="int" />
          <OverrideableParameter ID="SyncTime" Selector="$Config/SyncTime$" ParameterType="string" />
          <OverrideableParameter ID="TimeoutSeconds" Selector="$Config/TimeoutSeconds$" ParameterType="int" />
        </OverrideableParameters>
        <ModuleImplementation Isolation="Any">
          <Composite>
            <MemberModules>
              <DataSource ID="Scheduler" TypeID="System!System.Scheduler">
                <Scheduler>
                  <SimpleReccuringSchedule>
                    <Interval Unit="Seconds">$Config/IntervalSeconds$</Interval>
                    <SyncTime>$Config/SyncTime$</SyncTime>
                  </SimpleReccuringSchedule>
                  <ExcludeDates />
                </Scheduler>
              </DataSource>
              <ProbeAction ID="PA" TypeID="Windows!Microsoft.Windows.PowerShellPropertyBagTriggerOnlyProbe">
                <ScriptName>##CompanyID##.##AppName##.##UniqueID##.Monitor.DataSource.ps1</ScriptName>
                <ScriptBody>
#=================================================================================
#  ##CompanyID## ##AppName## ##UniqueID## Monitor
#
#  Author: Generated by SCOM MP Creator
#  v1.0
#=================================================================================

# Constants section
#=================================================================================
$ScriptName = "##CompanyID##.##AppName##.##UniqueID##.Monitor.DataSource.ps1"
$EventID = "##EventID##"
#=================================================================================

# Starting Script section
#=================================================================================
$StartTime = Get-Date
$whoami = whoami
$momapi = New-Object -comObject MOM.ScriptAPI
$bag = $momapi.CreatePropertyBag()
$momapi.LogScriptEvent($ScriptName,$EventID,0,"\`n Script is starting. \`n Running as ($whoami).")
#=================================================================================

# Begin MAIN script section
#=================================================================================
##SCRIPT_BODY##
#=================================================================================
# End MAIN script section

# Return all bags
$bag

# End of script section
#=================================================================================
$EndTime = Get-Date
$ScriptTime = ($EndTime - $StartTime).TotalSeconds
$momapi.LogScriptEvent($ScriptName,$EventID,0,"\`n Script Completed. \`n Script Runtime: ($ScriptTime) seconds.")
#=================================================================================
                </ScriptBody>
                <TimeoutSeconds>$Config/TimeoutSeconds$</TimeoutSeconds>
              </ProbeAction>
            </MemberModules>
            <Composition>
              <Node ID="PA">
                <Node ID="Scheduler" />
              </Node>
            </Composition>
          </Composite>
        </ModuleImplementation>
        <OutputType>System!System.PropertyBagData</OutputType>
      </DataSourceModuleType>
    </ModuleTypes>
    <MonitorTypes>
      <UnitMonitorType ID="##CompanyID##.##AppName##.##UniqueID##.Monitor.MonitorType" Accessibility="Internal">
        <MonitorTypeStates>
          <MonitorTypeState ID="GoodCondition" NoDetection="false" />
          <MonitorTypeState ID="BadCondition" NoDetection="false" />
        </MonitorTypeStates>
        <Configuration>
          <xsd:element minOccurs="1" type="xsd:integer" name="IntervalSeconds" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
          <xsd:element minOccurs="0" type="xsd:string" name="SyncTime" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />
          <xsd:element minOccurs="1" type="xsd:integer" name="TimeoutSeconds" xmlns:xsd="http://www.w3.org/2001/XMLSchema" />	
        </Configuration>
        <OverrideableParameters>
          <OverrideableParameter ID="IntervalSeconds" Selector="$Config/IntervalSeconds$" ParameterType="int" />
          <OverrideableParameter ID="SyncTime" Selector="$Config/SyncTime$" ParameterType="string" />
          <OverrideableParameter ID="TimeoutSeconds" Selector="$Config/TimeoutSeconds$" ParameterType="int" />
        </OverrideableParameters>
        <MonitorImplementation>
          <MemberModules>
            <DataSource ID="DS" TypeID="##CompanyID##.##AppName##.##UniqueID##.Monitor.DataSource">
              <IntervalSeconds>$Config/IntervalSeconds$</IntervalSeconds>
              <SyncTime>$Config/SyncTime$</SyncTime>	
              <TimeoutSeconds>$Config/TimeoutSeconds$</TimeoutSeconds>
            </DataSource>
            <ConditionDetection ID="GoodConditionFilter" TypeID="System!System.ExpressionFilter">
              <Expression>
                <SimpleExpression>
                  <ValueExpression>
                    <XPathQuery Type="String">Property[@Name='Result']</XPathQuery>
                  </ValueExpression>
                  <Operator>Equal</Operator>
                  <ValueExpression>
                    <Value Type="String">GoodCondition</Value>
                  </ValueExpression>
                </SimpleExpression>
              </Expression>
            </ConditionDetection>
            <ConditionDetection ID="BadConditionFilter" TypeID="System!System.ExpressionFilter">
              <Expression>
                <SimpleExpression>
                  <ValueExpression>
                    <XPathQuery Type="String">Property[@Name='Result']</XPathQuery>
                  </ValueExpression>
                  <Operator>Equal</Operator>
                  <ValueExpression>
                    <Value Type="String">BadCondition</Value>
                  </ValueExpression>
                </SimpleExpression>
              </Expression>
            </ConditionDetection>
          </MemberModules>
          <RegularDetections>
            <RegularDetection MonitorTypeStateID="GoodCondition">
              <Node ID="GoodConditionFilter">
                <Node ID="DS" />
              </Node>
            </RegularDetection>
            <RegularDetection MonitorTypeStateID="BadCondition">
              <Node ID="BadConditionFilter">
                <Node ID="DS" />
              </Node>
            </RegularDetection>
          </RegularDetections>
          <OnDemandDetections>
            <OnDemandDetection MonitorTypeStateID="GoodCondition">
              <Node ID="GoodConditionFilter">
                <Node ID="DS" />
              </Node>
            </OnDemandDetection>
            <OnDemandDetection MonitorTypeStateID="BadCondition">
              <Node ID="BadConditionFilter">
                <Node ID="DS" />
              </Node>
            </OnDemandDetection>
          </OnDemandDetections>
        </MonitorImplementation>
      </UnitMonitorType>
    </MonitorTypes>
  </TypeDefinitions>
  <Monitoring>
    <Monitors>
      <UnitMonitor ID="##CompanyID##.##AppName##.##UniqueID##.Monitor" Accessibility="Public" Enabled="true" Target="##ClassID##" ParentMonitorID="Health!System.Health.AvailabilityState" Remotable="true" Priority="Normal" TypeID="##CompanyID##.##AppName##.##UniqueID##.Monitor.MonitorType" ConfirmDelivery="true">
        <Category>AvailabilityHealth</Category>
        <AlertSettings AlertMessage="##CompanyID##.##AppName##.##UniqueID##.Monitor.AlertMessage">
          <AlertOnState>Warning</AlertOnState>
          <AutoResolve>true</AutoResolve>
          <AlertPriority>Normal</AlertPriority>
          <AlertSeverity>MatchMonitorHealth</AlertSeverity>
        </AlertSettings>
        <OperationalStates>
          <OperationalState ID="GoodCondition" MonitorTypeStateID="GoodCondition" HealthState="Success" />
          <OperationalState ID="BadCondition" MonitorTypeStateID="BadCondition" HealthState="Warning" />
        </OperationalStates>
        <Configuration>
          <IntervalSeconds>##IntervalSeconds##</IntervalSeconds>
          <SyncTime></SyncTime>
          <TimeoutSeconds>120</TimeoutSeconds>
        </Configuration>
      </UnitMonitor>
    </Monitors>
  </Monitoring>
  <Presentation>
    <StringResources>
      <StringResource ID="##CompanyID##.##AppName##.##UniqueID##.Monitor.AlertMessage" />
    </StringResources>
  </Presentation>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor">
          <Name>##CompanyID## ##AppName## ##UniqueID## Monitor</Name>
          <Description></Description>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor" SubElementID="GoodCondition">
          <Name>Good Condition</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor" SubElementID="BadCondition">
          <Name>Bad Condition</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor.AlertMessage">
          <Name>##CompanyID## ##AppName## ##UniqueID## Monitor: Failure</Name>
          <Description>##CompanyID## ##AppName## ##UniqueID## Monitor: detected a bad condition</Description>
        </DisplayString>		
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'CheckWebSite' },
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '3600', placeholder: '3600' },
                    { id: 'eventId', label: 'Event ID', type: 'number', required: true, value: '1234', placeholder: '1234', help: 'Event ID for script logging in Operations Manager event log' },
                    { id: 'scriptBody', label: 'PowerShell Script', type: 'textarea', required: true, 
                      placeholder: '# Your monitoring script should set $bag values:\n# $bag.AddValue(\'Result\',\'GoodCondition\')  # for healthy\n# $bag.AddValue(\'Result\',\'BadCondition\')   # for unhealthy\n\nExample:\n$strCondition = "Good"  # or "Bad"\nif ($strCondition -eq "Good") {\n  $bag.AddValue(\'Result\',\'GoodCondition\')\n} else {\n  $bag.AddValue(\'Result\',\'BadCondition\')\n}',
                      help: 'Script must set $bag.AddValue(\'Result\', \'GoodCondition\') or $bag.AddValue(\'Result\', \'BadCondition\'). Note: $bag is automatically returned by the wrapper script - do NOT add "return $bag" in your code.' 
                    }
                ]
            },
            'powershell-script-with-params-monitor': {
                name: 'PowerShell Script Monitor (With Parameters)',
                template: 'Monitor.TimedScript.PowerShell.WithParams.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'scriptBody', label: 'PowerShell Script', type: 'textarea', required: true, placeholder: 'param($Param1, $Param2)\n# Your script here' },
                    { id: 'param1', label: 'Parameter 1', type: 'text', required: false, placeholder: 'Value for $Param1' },
                    { id: 'param2', label: 'Parameter 2', type: 'text', required: false, placeholder: 'Value for $Param2' }
                ]
            },
            'powershell-script-monitor-3state': {
                name: 'PowerShell Script Monitor (3 States)',
                template: `<ManagementPackFragment SchemaVersion="2.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Monitoring>
    <Monitors>
      <UnitMonitor ID="##CompanyID##.##AppName##.##UniqueID##.Monitor" Accessibility="Public" Enabled="true" Target="##ClassID##" ParentMonitorID="Health!System.Health.AvailabilityState" Remotable="true" Priority="Normal" TypeID="PowerShellMonitoring!Community.PowerShellMonitoring.UnitMonitors.PowerShellThreeState" ConfirmDelivery="false">
        <Category>Custom</Category>
        <AlertSettings AlertMessage="##CompanyID##.##AppName##.##UniqueID##.Monitor.AlertMessage">
          <AlertOnState>Warning</AlertOnState>
          <AutoResolve>true</AutoResolve>
          <AlertPriority>Normal</AlertPriority>
          <AlertSeverity>MatchMonitorHealth</AlertSeverity>
          <AlertParameters>
            <AlertParameter1>$Data/Context/Property[@Name='State']$</AlertParameter1>
          </AlertParameters>
        </AlertSettings>
        <OperationalStates>
          <OperationalState ID="Unhealthy" MonitorTypeStateID="Unhealthy" HealthState="Error" />
          <OperationalState ID="Warning" MonitorTypeStateID="Warning" HealthState="Warning" />
          <OperationalState ID="Healthy" MonitorTypeStateID="Healthy" HealthState="Success" />
        </OperationalStates>
        <Configuration>
          <IntervalSeconds>##IntervalSeconds##</IntervalSeconds>
          <SyncTime />
          <ScriptName>##CompanyID##.##AppName##.##UniqueID##.Monitor.ps1</ScriptName>
          <ScriptBody># Any Arguments specified will be sent to the script as a single string.
# If you need to send multiple values, delimit them with a space, semicolon or other separator and then use split.
param([string]$Arguments)

$ScomAPI = New-Object -comObject "MOM.ScriptAPI"
$PropertyBag = $ScomAPI.CreatePropertyBag()

# Example of use below, in this case return the length of the string passed in and we'll set health state based on that.
# Since the health state comparison is string based in this template we'll need to create a state value and return it.
# Ensure you return a unique value per health state (e.g. a service status), or a unique combination of values.

##SCRIPT_BODY##
             
# Send output to SCOM
$PropertyBag</ScriptBody>
          <Arguments />
          <TimeoutSeconds>60</TimeoutSeconds>
          <UnhealthyExpression>
            <SimpleExpression>
              <ValueExpression>
                <XPathQuery>Property[@Name='State']</XPathQuery>
              </ValueExpression>
              <Operator>Equal</Operator>
              <ValueExpression>
                <Value>Bad</Value>
              </ValueExpression>
            </SimpleExpression>
          </UnhealthyExpression>
          <WarningExpression>
            <SimpleExpression>
              <ValueExpression>
                <XPathQuery>Property[@Name='State']</XPathQuery>
              </ValueExpression>
              <Operator>Equal</Operator>
              <ValueExpression>
                <Value>Warning</Value>
              </ValueExpression>
            </SimpleExpression>
          </WarningExpression>
          <HealthyExpression>
            <SimpleExpression>
              <ValueExpression>
                <XPathQuery>Property[@Name='State']</XPathQuery>
              </ValueExpression>
              <Operator>Equal</Operator>
              <ValueExpression>
                <Value>Ok</Value>
              </ValueExpression>
            </SimpleExpression>
          </HealthyExpression>
        </Configuration>
      </UnitMonitor>
    </Monitors>
  </Monitoring>
  <Presentation>
    <StringResources>
      <StringResource ID="##CompanyID##.##AppName##.##UniqueID##.Monitor.AlertMessage" />
    </StringResources>
  </Presentation>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor">
          <Name>##CompanyID## ##AppName## ##UniqueID## 3-State Monitor</Name>
          <Description />
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor" SubElementID="Unhealthy">
          <Name>Unhealthy</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor" SubElementID="Warning">
          <Name>Warning</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor" SubElementID="Healthy">
          <Name>Healthy</Name>
        </DisplayString>
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.Monitor.AlertMessage">
          <Name>##CompanyID## ##AppName## ##UniqueID## 3-State Monitor</Name>
          <Description>The Status of the monitor is {0}</Description>
        </DisplayString>
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>
</ManagementPackFragment>`,
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'CheckApplication' },
                    { id: 'intervalSeconds', label: 'Run Every (seconds)', type: 'number', required: true, value: '300', placeholder: '300', help: 'How often to run the PowerShell script (in seconds). Example: 300 = 5 minutes, 600 = 10 minutes, 3600 = 1 hour' },
                    { id: 'eventId', label: 'Event ID', type: 'number', required: true, value: '1234', placeholder: '1234', help: 'Event ID for script logging in Operations Manager event log' },
                    { id: 'scriptBody', label: 'PowerShell Script', type: 'textarea', required: true, 
                      placeholder: ' $status=if(Get-Process -Name notepad -ErrorAction SilentlyContinue) { 1 } else {0} \n\nif($status -eq 0) {\n  $PropertyBag.AddValue("State","Bad")\n}\nelseif($status -eq "Warning") {\n  $PropertyBag.AddValue("State","Warning")\n}\nelse\n{\n  $PropertyBag.AddValue("State","Ok")\n}',
                      value: ' $status=if(Get-Process -Name notepad -ErrorAction SilentlyContinue) { 1 } else {0} \n\nif($status -eq 0) {\n  $PropertyBag.AddValue("State","Bad")\n}\nelseif($status -eq "Warning") {\n  $PropertyBag.AddValue("State","Warning")\n}\nelse\n{\n  $PropertyBag.AddValue("State","Ok")\n}',
                      help: 'IMPORTANT: Your script MUST use $PropertyBag.AddValue("State", "Ok|Warning|Bad"). Do NOT change the variable name "State" or "PropertyBag" - they are required for the monitor to work correctly. The script wrapper automatically creates $PropertyBag and returns it.' 
                    }
                ]
            },
            // RULES
            'eventlog-alert-eventid-expression': {
                name: 'Event Log Alert - Event ID',
                template: 'Rule.AlertGenerating.EventLog.EventIdExpression.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'EventAlert' },
                    { id: 'logName', label: 'Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId', label: 'Event ID(s)', type: 'text', required: true, placeholder: '1234 or 1000,1001,1002', help: 'Single Event ID or comma-separated list' }
                ]
            },
            'eventlog-alert-eventid-expression-description': {
                name: 'Event Log Alert - Event ID with Description',
                template: 'Rule.AlertGenerating.EventLog.EventIdExpression.DescriptionContains.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'EventAlert' },
                    { id: 'logName', label: 'Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId', label: 'Event ID(s)', type: 'text', required: true, placeholder: '1234 or 1000,1001,1002', help: 'Single Event ID or comma-separated list' },
                    { id: 'description', label: 'Description Contains', type: 'text', required: true, placeholder: 'error' }
                ]
            },
            'eventlog-alert-eventid-expression-source': {
                name: 'Event Log Alert - Event ID with Source',
                template: 'Rule.AlertGenerating.EventLog.EventIdExpression.SourceEquals.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'EventAlert' },
                    { id: 'logName', label: 'Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId', label: 'Event ID(s)', type: 'text', required: true, placeholder: '1234 or 1000,1001,1002', help: 'Single Event ID or comma-separated list' },
                    { id: 'eventSource', label: 'Event Source', type: 'text', required: true, placeholder: 'MyApplication' }
                ]
            },
            'eventlog-alert-eventid-expression-source-description': {
                name: 'Event Log Alert - Event ID with Source and Description',
                template: 'Rule.AlertGenerating.EventLog.EventIdExpression.SourceEquals.DescriptionContains.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'EventAlert' },
                    { id: 'logName', label: 'Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId', label: 'Event ID(s)', type: 'text', required: true, placeholder: '1234 or 1000,1001,1002', help: 'Single Event ID or comma-separated list' },
                    { id: 'eventSource', label: 'Event Source', type: 'text', required: true, placeholder: 'MyApplication' },
                    { id: 'description', label: 'Description Contains', type: 'text', required: true, placeholder: 'error' }
                ]
            },
            'eventlog-alert-repeated': {
                name: 'Event Log Alert - Repeated Event',
                template: 'Rule.AlertGenerating.EventLog.RepeatedEvent.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'RepeatedEventAlert' },
                    { id: 'logName', label: 'Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId', label: 'Event ID', type: 'number', required: true, placeholder: '1234' },
                    { id: 'repeatCount', label: 'Repeat Count', type: 'number', required: true, value: '5', placeholder: '5' },
                    { id: 'intervalSeconds', label: 'Time Window (seconds)', type: 'number', required: true, value: '300', placeholder: '300' }
                ]
            },
            'eventlog-alert-correlated': {
                name: 'Event Log Alert - Two Correlated Events',
                template: 'Rule.AlertGenerating.EventLog.TwoCorrelatedEvents.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'CorrelatedEventAlert' },
                    { id: 'logName1', label: 'First Event Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId1', label: 'First Event ID', type: 'number', required: true, placeholder: '1234' },
                    { id: 'eventSource1', label: 'First Event Source', type: 'text', required: true, placeholder: 'MyApplication' },
                    { id: 'logName2', label: 'Second Event Log Name', type: 'text', required: true, placeholder: 'Application', value: 'Application' },
                    { id: 'eventId2', label: 'Second Event ID', type: 'number', required: true, placeholder: '1235' },
                    { id: 'eventSource2', label: 'Second Event Source', type: 'text', required: true, placeholder: 'MyApplication' },
                    { id: 'intervalSeconds', label: 'Time Window (seconds)', type: 'number', required: true, value: '300', placeholder: '300' }
                ]
            },
            'performance-collection': {
                name: 'Performance Collection Rule',
                template: 'Rule.Performance.Collection.Perfmon.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'CPUUsage' },
                    { id: 'objectName', label: 'Performance Object', type: 'text', required: true, placeholder: 'Processor', value: 'Processor' },
                    { id: 'counterName', label: 'Counter Name', type: 'text', required: true, placeholder: '% Processor Time', value: '% Processor Time' },
                    { id: 'instanceName', label: 'Instance Name', type: 'text', required: true, placeholder: '_Total', value: '_Total', help: 'Use "_Total" for aggregate or specific instance name' },
                    { id: 'frequencySeconds', label: 'Collection Frequency (seconds)', type: 'number', required: true, value: '300', placeholder: '300', help: '300 seconds (5 minutes) is recommended' }
                ]
            },
            'script-alert': {
                name: 'Script Alert Rule (PowerShell)',
                template: 'Rule.AlertGenerating.TimedScript.Powershell.WithParams.mpx',
                fields: [
                    { id: 'uniqueId', label: 'Unique ID', type: 'text', required: true, placeholder: 'CustomScriptAlert' },
                    { id: 'intervalSeconds', label: 'Run Every (seconds)', type: 'number', required: true, value: '300', placeholder: '300' },
                    { id: 'scriptBody', label: 'PowerShell Script', type: 'textarea', required: true, 
                      placeholder: '# Your custom PowerShell script here\n# Return $true to generate alert, $false otherwise\n$result = Test-Path "C:\\MyApp\\critical.txt"\nreturn $result',
                      help: 'Script should return $true to generate an alert' }
                ]
            },
            'snmp-alert': {
                name: 'SNMP Trap Alert Rule',
                template: 'Rule.AlertGenerating.SNMPTrap.AlertOnOID.mpx',
                fields: [
                    { id: 'oid', label: 'SNMP OID', type: 'text', required: true, placeholder: '1.3.6.1.4.1.9.9.41.2.0.1', help: 'The SNMP trap OID to monitor' }
                ]
            }
        };
    }

    initializeEventListeners() {
        // Handle MP file import
        const importFileInput = document.getElementById('import-mp-file');
        if (importFileInput) {
            console.log('Import file input found, adding event listener');
            importFileInput.addEventListener('change', (e) => {
                console.log('File selected:', e.target.files[0]);
                this.handleMPImport(e.target.files[0]);
            });
        } else {
            console.log('Import file input NOT found');
        }
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.discovery-card')) {
                this.selectDiscoveryCard(e.target.closest('.discovery-card'));
            }
            
            // Handle clicking on component card (anywhere on the card)
            const componentCard = e.target.closest('.component-card');
            if (componentCard && !e.target.closest('.component-checkbox')) {
                // Only toggle if not clicking directly on the checkbox label
                const checkbox = componentCard.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // Trigger the change event
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Handle step navigation when clicking on progress steps
            if (e.target.closest('.progress-step')) {
                this.handleStepNavigation(e.target.closest('.progress-step'));
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.component-card')) {
                this.handleComponentSelection(e.target);
            }
            
            // Auto-save configuration data when any input in config section changes
            if (e.target.closest('#component-configs')) {
                this.saveConfigurationData();
                // Auto-update preview on step 6
                if (this.currentStep === 6) {
                    this.autoGeneratePreview();
                }
            }
        });

        document.addEventListener('input', (e) => {
            // Auto-capitalize Company ID and uniqueId fields
            if (e.target.id === 'company-id' || (e.target.id && e.target.id.endsWith('-uniqueId'))) {
                const cursorPosition = e.target.selectionStart;
                const originalLength = e.target.value.length;
                e.target.value = e.target.value.toUpperCase();
                // Restore cursor position after capitalization
                const newLength = e.target.value.length;
                const newPosition = cursorPosition + (newLength - originalLength);
                e.target.setSelectionRange(newPosition, newPosition);
            }
            
            // Auto-save configuration data when any input in config section is typed in
            if (e.target.closest('#component-configs')) {
                this.saveConfigurationData();
                // Auto-update preview on step 6 with debounce
                if (this.currentStep === 6) {
                    clearTimeout(this.previewDebounceTimer);
                    this.previewDebounceTimer = setTimeout(() => {
                        this.autoGeneratePreview();
                        updateDownloadButtons();
                    }, 500); // 500ms debounce
                }
            }
            // Also handle management group name input
            if (e.target.id === 'management-group-name' && this.currentStep === 6) {
                clearTimeout(this.previewDebounceTimer);
                this.previewDebounceTimer = setTimeout(() => {
                    this.autoGeneratePreview();
                    updateDownloadButtons();
                }, 500);
            }
        });

        document.addEventListener('blur', (e) => {

            if (e.target.matches('input, select, textarea')) {
                this.validateField(e.target);
                
                // Auto-save configuration data when leaving any input in config section
                if (e.target.closest('#component-configs')) {
                    this.saveConfigurationData();
                    // Auto-update preview on step 6
                    if (this.currentStep === 6) {
                        this.autoGeneratePreview();
                        updateDownloadButtons();
                    }
                }
            }
        }, true);
    }

    async handleMPImport(file) {
        if (!file) return;
        
        const statusDiv = document.getElementById('import-mp-status');
        const filenameSpan = document.getElementById('import-mp-filename');
        
        try {
            statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Parsing MP file...';
            statusDiv.style.color = '#3b82f6';
            
            const text = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Invalid XML file');
            }
            
            // Extract MP information - try multiple selectors for compatibility
            let mpId = '';
            let version = '1.0.0.0';
            
            // Try Identity element first (most common)
            const identity = xmlDoc.querySelector('Identity ID, Identity > ID');
            if (identity) {
                mpId = identity.textContent.trim();
            }
            
            // Try Manifest ID attribute as fallback
            if (!mpId) {
                const manifest = xmlDoc.querySelector('Manifest');
                if (manifest) {
                    mpId = manifest.getAttribute('ID') || '';
                }
            }
            
            // Try Version
            const versionElement = xmlDoc.querySelector('Identity Version, Identity > Version');
            if (versionElement) {
                version = versionElement.textContent.trim();
            }
            
            // Parse the ID (format: CompanyID.AppName or CompanyID.AppName.SubName)
            const idParts = mpId.split('.');
            const companyId = idParts[0] || '';
            const appName = idParts.slice(1).join('.') || '';
            
            console.log('Extracted MP Info:', { mpId, companyId, appName, version });
            
            // Extract classes
            const classes = [];
            const classTypes = xmlDoc.querySelectorAll('ClassType');
            classTypes.forEach(classType => {
                const id = classType.getAttribute('ID');
                const base = classType.getAttribute('Base');
                if (id) {
                    // Try to find associated discovery and determine its type
                    let discoveryType = '';
                    const discoveries = xmlDoc.querySelectorAll('Discovery');
                    discoveries.forEach(discovery => {
                        const discoverClass = discovery.querySelector('DiscoveryClass');
                        if (discoverClass && discoverClass.getAttribute('TypeID') === id) {
                            // Determine discovery type from DataSource TypeID
                            const dataSource = discovery.querySelector('DataSource');
                            if (dataSource) {
                                const typeId = dataSource.getAttribute('TypeID');
                                if (typeId) {
                                    if (typeId.includes('Registry')) discoveryType = 'Registry';
                                    else if (typeId.includes('WmiProvider')) discoveryType = 'WMI';
                                    else if (typeId.includes('Script')) discoveryType = 'Script';
                                    else if (typeId.includes('PowerShell')) discoveryType = 'PowerShell';
                                    else if (typeId.includes('SNMP')) discoveryType = 'SNMP';
                                    else discoveryType = 'Custom';
                                }
                            }
                        }
                    });
                    
                    classes.push({
                        id: id,
                        name: id.split('.').pop(),
                        fullId: id,
                        base: base || 'Unknown',
                        discoveryType: discoveryType || 'Unknown'
                    });
                }
            });
            
            console.log('Found classes:', classes);
            
            // Store the imported MP data
            this.mpData.importedMP = {
                xml: text,
                xmlDoc: xmlDoc,
                companyId: companyId,
                appName: appName,
                version: version,
                fullId: mpId
            };
            this.mpData.importedClasses = classes;
            
            // Auto-fill basic info - always fill from imported MP
            document.getElementById('company-id').value = companyId;
            document.getElementById('app-name').value = appName;
            document.getElementById('mp-version').value = version;
            
            // Show success message
            filenameSpan.textContent = file.name;
            filenameSpan.style.color = '#10b981';
            statusDiv.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981;"></i> <strong>MP imported successfully!</strong><br>
                <small style="color: #64748b;">Company: ${companyId} | App: ${appName}<br>Found ${classes.length} class(es). You can now add monitors and rules to these classes.</small>`;
            statusDiv.style.color = '#10b981';
            
        } catch (error) {
            console.error('MP Import Error:', error);
            statusDiv.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i> <strong>Error:</strong> ${error.message}`;
            statusDiv.style.color = '#ef4444';
            filenameSpan.textContent = '';
        }
    }

    selectDiscoveryCard(card) {
        document.querySelectorAll('.discovery-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        const discoveryType = card.dataset.discovery;
        this.mpData.selectedComponents.discovery = discoveryType;
        
        // Show target class selection if skip discovery is selected
        let skipClassContainer = document.getElementById('skip-discovery-class-container');
        if (discoveryType === 'skip') {
            if (!skipClassContainer) {
                // Create the target class selection dropdown
                const container = document.createElement('div');
                container.id = 'skip-discovery-class-container';
                container.style.cssText = 'margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;';
                
                // Build options HTML - include imported classes if available
                let optionsHTML = '<option value="">-- Select a Target Class --</option>';
                
                // Add imported classes first
                if (this.mpData.importedClasses && this.mpData.importedClasses.length > 0) {
                    optionsHTML += '<optgroup label="Classes from Imported MP">';
                    this.mpData.importedClasses.forEach(cls => {
                        const discoveryInfo = cls.discoveryType ? ` [${cls.discoveryType} Discovery]` : '';
                        optionsHTML += `<option value="${cls.fullId}">${cls.fullId}${discoveryInfo}</option>`;
                    });
                    optionsHTML += '</optgroup>';
                }
                
                // Add standard Windows classes
                optionsHTML += '<optgroup label="Standard Windows Classes">';
                optionsHTML += '<option value="Windows!Microsoft.Windows.Server.OperatingSystem">Windows Server Operating System</option>';
                optionsHTML += '<option value="Windows!Microsoft.Windows.Computer">Windows Computer</option>';
                optionsHTML += '<option value="Windows!Microsoft.Windows.LogicalDisk">Windows Logical Disk</option>';
                optionsHTML += '<option value="Windows!Microsoft.Windows.Server.6.2.OperatingSystem">Windows Server 2012+ Operating System</option>';
                optionsHTML += '<option value="Windows!Microsoft.Windows.Server.2016.OperatingSystem">Windows Server 2016+ Operating System</option>';
                optionsHTML += '<option value="Windows!Microsoft.Windows.Client.OperatingSystem">Windows Client Operating System</option>';
                optionsHTML += '<option value="System!System.Computer">System Computer</option>';
                optionsHTML += '</optgroup>';
                
                container.innerHTML = `
                    <h4 style="margin-bottom: 15px; color: #2c3e50;">Select Target Class</h4>
                    <div class="form-group">
                        <label for="skip-target-class">Target Class</label>
                        <select id="skip-target-class" class="form-control" required>
                            ${optionsHTML}
                        </select>
                        <small style="color: #666; margin-top: 5px; display: block;">Select the class that your monitors/rules will target</small>
                    </div>
                `;
                // Insert after the discovery-options div (parent of all cards)
                const discoveryOptions = card.closest('.discovery-options');
                if (discoveryOptions) {
                    discoveryOptions.insertAdjacentElement('afterend', container);
                    
                    // Immediately disable the Next button when dropdown is created
                    const nextBtn = document.getElementById('next-discovery');
                    if (nextBtn) {
                        nextBtn.disabled = true;
                    }
                } else {
                    console.error('Could not find discovery-options container');
                }
                
                // Add change event listener
                document.getElementById('skip-target-class').addEventListener('change', (e) => {
                    this.mpData.configurations.skip = this.mpData.configurations.skip || {};
                    this.mpData.configurations.skip.targetClass = e.target.value;
                    
                    // Remove any error message when user selects a class
                    const container = document.getElementById('skip-discovery-class-container');
                    const existingError = container ? container.querySelector('.error-message') : null;
                    if (existingError) {
                        existingError.remove();
                    }
                    
                    // Enable the Next button when a class is selected
                    const nextBtn = document.getElementById('next-discovery');
                    if (nextBtn) {
                        nextBtn.disabled = !e.target.value;
                    }
                });
            } else {
                // Container already exists, just make sure it's visible
                skipClassContainer.style.display = 'block';
                
                // Make sure Next button is disabled if no class is selected
                const targetClassSelect = document.getElementById('skip-target-class');
                const nextBtn = document.getElementById('next-discovery');
                if (nextBtn && targetClassSelect) {
                    nextBtn.disabled = !targetClassSelect.value;
                }
            }
        } else {
            // Hide the container if switching away from skip
            if (skipClassContainer) {
                skipClassContainer.style.display = 'none';
            }
        }
        
        const nextBtn = document.getElementById('next-discovery');
        if (nextBtn) {
            // For skip discovery, disable Next button until target class is selected
            if (discoveryType === 'skip') {
                // Use setTimeout to ensure the dropdown element is in the DOM
                setTimeout(() => {
                    const targetClassSelect = document.getElementById('skip-target-class');
                    const btn = document.getElementById('next-discovery');
                    if (btn) {
                        btn.disabled = !targetClassSelect || !targetClassSelect.value;
                    }
                }, 10);
            } else {
                nextBtn.disabled = false;
            }
        }
    }

    handleStepNavigation(stepElement) {
        const targetStep = parseInt(stepElement.dataset.step);
        
        // Don't navigate if clicking on the current step
        if (targetStep === this.currentStep) {
            return;
        }
        
        const previousStep = this.currentStep;
        
        // Allow navigation to any previous step (already completed)
        if (targetStep < this.currentStep) {
            this.currentStep = targetStep;
            this.updateStepDisplay(previousStep);
            return;
        }
        
        // For forward navigation, validate the current step first
        if (targetStep === this.currentStep + 1) {
            if (this.validateCurrentStep()) {
                this.saveCurrentStepData();
                this.currentStep = targetStep;
                this.updateStepDisplay(previousStep);
                
                // Generate configuration forms if navigating to step 6
                if (this.currentStep === 6) {
                    this.generateConfigurationForms();
                }
            } else {
                // Show validation message
                this.showValidationMessage();
            }
        }
    }

    showValidationMessage() {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = 'validation-notification';
        notification.textContent = 'Please complete the current step before proceeding.';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    handleComponentSelection(checkbox) {
        const componentType = checkbox.value;
        const card = checkbox.closest('.component-card');
        
        // Find the step by checking which step contains this checkbox
        const step = checkbox.closest('.form-step');
        let category = 'other';
        
        if (step) {
            const stepId = step.id;
            switch (stepId) {
                case 'step-3':
                    category = 'monitors';
                    break;
                case 'step-4':
                    category = 'rules';
                    break;
                case 'step-5':
                    if (componentType.includes('group')) category = 'groups';
                    else if (componentType.includes('task')) category = 'tasks';
                    else if (componentType.includes('view')) category = 'views';
                    break;
            }
        }
        
        if (checkbox.checked) {
            if (!this.mpData.selectedComponents[category]) {
                this.mpData.selectedComponents[category] = [];
            }
            
            // For monitors, create a new instance with unique ID
            if (category === 'monitors') {
                // Initialize counter for this type if it doesn't exist
                if (!this.instanceCounters[componentType]) {
                    this.instanceCounters[componentType] = 0;
                }
                this.instanceCounters[componentType]++;
                
                const instance = {
                    type: componentType,
                    instanceId: `${componentType}-instance-${this.instanceCounters[componentType]}`
                };
                
                this.mpData.selectedComponents[category].push(instance);
                
                // Create or get button container
                let buttonContainer = card.querySelector('.btn-container');
                if (!buttonContainer) {
                    buttonContainer = document.createElement('div');
                    buttonContainer.className = 'btn-container';
                    card.appendChild(buttonContainer);
                }
                buttonContainer.innerHTML = ''; // Clear existing buttons
                
                // Get current count
                const count = this.mpData.selectedComponents.monitors.filter(m => m.type === componentType).length;
                
                // Create counter display
                const counterDisplay = document.createElement('div');
                counterDisplay.className = 'instance-counter';
                counterDisplay.innerHTML = `
                    <button class="counter-btn counter-minus" title="Remove instance (add another instance)"><i class="fas fa-minus"></i></button>
                    <span class="counter-value">${count}</span>
                    <button class="counter-btn counter-plus" title="Add instance (add another instance)"><i class="fas fa-plus"></i></button>
                    <span class="counter-label">Add Another Instance</span>
                `;
                
                // Add event listeners for counter buttons
                counterDisplay.querySelector('.counter-minus').onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentCount = this.mpData.selectedComponents.monitors.filter(m => m.type === componentType).length;
                    if (currentCount > 1) {
                        this.removeMonitorFromCard(componentType);
                    }
                };
                
                counterDisplay.querySelector('.counter-plus').onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addAnotherMonitorInstance(componentType);
                };
                
                buttonContainer.appendChild(counterDisplay);
            } else {
                // For other categories, keep existing behavior
                if (!this.mpData.selectedComponents[category].includes(componentType)) {
                    this.mpData.selectedComponents[category].push(componentType);
                }
            }
            
            card.classList.add('selected');
        } else {
            if (this.mpData.selectedComponents[category]) {
                if (category === 'monitors') {
                    // Remove all instances of this monitor type
                    this.mpData.selectedComponents[category] = this.mpData.selectedComponents[category]
                        .filter(instance => instance.type !== componentType);
                    // Reset counter
                    this.instanceCounters[componentType] = 0;
                    // Remove "Add Another" button
                    const addBtn = card.querySelector('.btn-add-another');
                    if (addBtn) addBtn.remove();
                } else {
                    const index = this.mpData.selectedComponents[category].indexOf(componentType);
                    if (index > -1) {
                        this.mpData.selectedComponents[category].splice(index, 1);
                    }
                }
            }
            
            card.classList.remove('selected');
        }
    }

    addAnotherMonitorInstance(componentType) {
        // Increment counter and create new instance
        if (!this.instanceCounters[componentType]) {
            this.instanceCounters[componentType] = 0;
        }
        this.instanceCounters[componentType]++;
        
        const instance = {
            type: componentType,
            instanceId: `${componentType}-instance-${this.instanceCounters[componentType]}`
        };
        
        this.mpData.selectedComponents.monitors.push(instance);
        
        // Show notification
        this.showNotification(`Added another instance of ${this.fragmentLibrary[componentType]?.name || componentType}`, 'success');
        
        // If we're on step 6, regenerate the configuration forms
        if (this.currentStep === 6) {
            this.generateConfigurationForms();
        }
    }

    removeMonitorInstance(instanceId) {
        // Remove the specific monitor instance
        this.mpData.selectedComponents.monitors = this.mpData.selectedComponents.monitors
            .filter(instance => instance.instanceId !== instanceId);
        
        // Remove configuration data for this instance
        delete this.mpData.configurations[instanceId];
        
        // Regenerate the configuration forms
        this.generateConfigurationForms();
    }

    removeMonitorFromCard(componentType) {
        // Remove the last instance of this monitor type from the card
        const instances = this.mpData.selectedComponents.monitors.filter(m => m.type === componentType);
        
        if (instances.length > 1) {
            // Remove the last instance
            const lastInstance = instances[instances.length - 1];
            this.removeMonitorInstance(lastInstance.instanceId);
            
            // Update the counter display
            const card = document.querySelector(`.component-card[data-component="${componentType}"]`);
            if (card) {
                const count = this.mpData.selectedComponents.monitors.filter(m => m.type === componentType).length;
                const counterValue = card.querySelector('.counter-value');
                if (counterValue) {
                    counterValue.textContent = count;
                }
            }
            
            // If we're on step 6, regenerate the configuration forms
            if (this.currentStep === 6) {
                this.generateConfigurationForms();
            }
        } else if (instances.length === 1) {
            // If this is the last instance, uncheck the card
            const card = document.querySelector(`.component-card[data-component="${componentType}"]`);
            if (card) {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    addAnotherMonitorInstance(componentType) {
        // Increment counter and create new instance
        if (!this.instanceCounters[componentType]) {
            this.instanceCounters[componentType] = 0;
        }
        this.instanceCounters[componentType]++;
        
        const instance = {
            type: componentType,
            instanceId: `${componentType}-instance-${this.instanceCounters[componentType]}`
        };
        
        this.mpData.selectedComponents.monitors.push(instance);
        
        // Update the counter display
        const card = document.querySelector(`.component-card[data-component="${componentType}"]`);
        if (card) {
            const count = this.mpData.selectedComponents.monitors.filter(m => m.type === componentType).length;
            const counterValue = card.querySelector('.counter-value');
            if (counterValue) {
                counterValue.textContent = count;
            }
        }
        
        // If we're on step 6, regenerate the configuration forms
        if (this.currentStep === 6) {
            this.generateConfigurationForms();
        }
    }

    validateField(field) {
        const formGroup = field.closest('.form-group');
        const isRequired = field.hasAttribute('required');
        const value = field.value.trim();
        
        formGroup.classList.remove('error', 'success');
        
        const existingMessage = formGroup.querySelector('.error-message, .success-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        if (isRequired && !value) {
            this.showFieldError(formGroup, 'This field is required');
            return false;
        }
        
        if (field.id === 'company-id') {
            // Auto-capitalize the company ID
            if (value) {
                field.value = value.toUpperCase();
            }
        }
        
        if (field.id === 'app-name') {
            if (value && !/^[a-zA-Z0-9]+$/.test(value)) {
                this.showFieldError(formGroup, 'Only letters and numbers allowed, no spaces or special characters');
                return false;
            }
        }
        
        if (field.id && field.id.includes('-regKeyPath')) {
            if (value && !/^[A-Z]+\\[A-Za-z0-9\\_.]+$/.test(value)) {
                this.showFieldError(formGroup, 'Registry path must follow format: HIVE\\Path\\To\\Key (e.g., SOFTWARE\\Microsoft\\MyApp)');
                return false;
            }
        }
        
        // Validate Event ID fields for event log alert rules
        // Be specific: match exact eventId field names, not fields that contain "eventId" (like "uniqueId")
        if (field.id && (field.id === 'eventId' || field.id === 'eventId1' || field.id === 'eventId2' || 
                        field.id.endsWith('-eventId') || field.id.endsWith('-eventid'))) {
            if (value) {
                // Allow comma-separated event IDs
                const eventIds = value.toString().split(',').map(id => id.trim());
                for (const id of eventIds) {
                    const eventId = parseInt(id, 10);
                    if (isNaN(eventId) || eventId < 1 || eventId > 65535) {
                        this.showFieldError(formGroup, 'Event ID must be between 1 and 65535');
                        return false;
                    }
                }
            }
        }
        
        if (value) {
            formGroup.classList.add('success');
        }
        
        return true;
    }

    showFieldError(formGroup, message) {
        formGroup.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        formGroup.appendChild(errorDiv);
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            this.saveCurrentStepData();
            
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.updateStepDisplay();
                
                if (this.currentStep === 6) {
                    this.generateConfigurationForms();
                }
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    validateCurrentStep() {
        const currentStepElement = document.getElementById(`step-${this.currentStep}`);
        
        if (this.currentStep === 1) {
            const requiredFields = currentStepElement.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!this.validateField(field)) {
                    isValid = false;
                }
            });
            
            return isValid;
        }
        
        if (this.currentStep === 2) {
            const discoveryType = this.mpData.selectedComponents.discovery;
            
            // Check if a discovery method is selected
            if (!discoveryType) {
                return false;
            }
            
            // If skip discovery is selected, validate that a target class is chosen
            if (discoveryType === 'skip') {
                const targetClassSelect = document.getElementById('skip-target-class');
                const container = document.getElementById('skip-discovery-class-container');
                
                // Remove any existing error message
                const existingError = container ? container.querySelector('.error-message') : null;
                if (existingError) {
                    existingError.remove();
                }
                
                if (!targetClassSelect || !targetClassSelect.value) {
                    // Show error message below the dropdown
                    if (container) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'error-message';
                        errorDiv.style.cssText = 'margin-top: 10px; font-weight: 500;';
                        errorDiv.textContent = 'Please select a target class for your monitors before proceeding.';
                        container.appendChild(errorDiv);
                    }
                    return false;
                }
            }
            
            return true;
        }
        
        return true;
    }

    saveCurrentStepData() {
        if (this.currentStep === 1) {
            this.mpData.basicInfo = {
                companyId: document.getElementById('company-id').value.trim().toUpperCase(),
                appName: document.getElementById('app-name').value.trim(),
                version: document.getElementById('mp-version').value.trim() || '1.0.0.0',
                description: document.getElementById('mp-description').value.trim()
            };
        }
    }

    updateStepDisplay(previousStep = null) {
        const isGoingBackward = previousStep !== null && this.currentStep < previousStep;
        
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            const stepNumber = index + 1;
            
            // If going backward and this step was just un-completed, add animation class
            if (isGoingBackward && stepNumber === previousStep - 1) {
                step.classList.add('animating-backward');
                // Remove the animation class after it completes
                setTimeout(() => {
                    step.classList.remove('animating-backward');
                }, 400);
            }
            
            const isActive = stepNumber === this.currentStep;
            const isCompleted = stepNumber < this.currentStep;
            
            step.classList.toggle('active', isActive);
            step.classList.toggle('completed', isCompleted);
        });
        
        document.querySelectorAll('.form-step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('active', stepNumber === this.currentStep);
        });

        // Update progress line animation
        this.updateProgressLine();

        this.scrollToCurrentStep();
        
        // Auto-generate preview if we're on step 6
        if (this.currentStep === 6) {
            setTimeout(() => {
                updateDownloadButtons();
                this.autoGeneratePreview();
            }, 100);
        }
    }

    autoGeneratePreview() {
        // Automatically generate and display the XML preview
        this.saveBasicInfo();
        this.saveConfigurationData();
        const xmlContent = this.generateMPXML();
        // Show output without scrolling (auto mode)
        const outputArea = document.getElementById('output-area');
        if (!outputArea) return;
        
        const outputCode = outputArea.querySelector('#mp-output code');
        
        if (outputCode) {
            outputCode.textContent = xmlContent;
        }
        if (outputArea) {
            outputArea.style.display = 'block';
        }
    }

    updateProgressLine() {
        // Progress line functionality removed - line stays grey
    }

    calculateProgressWidth(currentStep, totalSteps) {
        // Progress line functionality removed - line stays grey
        return '0%';
    }

    scrollToCurrentStep() {
        const currentStepElement = document.getElementById(`step-${this.currentStep}`);
        if (currentStepElement) {
            const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
            const progressBarHeight = document.querySelector('.progress-bar')?.offsetHeight || 0;
            const offset = headerHeight + progressBarHeight + 40;
            
            const targetPosition = currentStepElement.offsetTop - offset;
            
            window.scrollTo({
                top: Math.max(0, targetPosition),
                behavior: 'smooth'
            });
        }
    }

    generateConfigurationForms() {
        const configContainer = document.getElementById('component-configs');
        if (!configContainer) return;
        
        configContainer.innerHTML = '';
        
        // Generate discovery configuration
        if (this.mpData.selectedComponents.discovery && this.mpData.selectedComponents.discovery !== 'skip') {
            const discoveryType = this.mpData.selectedComponents.discovery;
            const fragment = this.fragmentLibrary[discoveryType];
            if (fragment) {
                const panel = document.createElement('div');
                panel.className = 'config-panel';
                panel.innerHTML = `
                    <h3>
                        <div class="config-panel-icon">
                            <i class="fas fa-search"></i>
                        </div>
                        Configure ${fragment.name}
                    </h3>
                    <div class="config-grid" id="config-${discoveryType}">
                        ${this.generateConfigFields(discoveryType, fragment.fields)}
                    </div>
                `;
                
                configContainer.appendChild(panel);
            }
        }

        // Generate monitor configurations
        if (this.mpData.selectedComponents.monitors && this.mpData.selectedComponents.monitors.length > 0) {
            this.mpData.selectedComponents.monitors.forEach(monitorInstance => {
                const monitorType = monitorInstance.type;
                const instanceId = monitorInstance.instanceId;
                const fragment = this.fragmentLibrary[monitorType];
                if (fragment) {
                    
                    // Count how many instances of this type exist
                    const instanceNumber = this.mpData.selectedComponents.monitors
                        .filter(m => m.type === monitorType)
                        .indexOf(monitorInstance) + 1;
                    const totalOfType = this.mpData.selectedComponents.monitors
                        .filter(m => m.type === monitorType).length;
                    
                    const panel = document.createElement('div');
                    panel.className = 'config-panel';
                    panel.dataset.instanceId = instanceId;
                    panel.innerHTML = `
                        <h3 style="display: flex; align-items: center; gap: 12px;">
                            <div class="config-panel-icon">
                                <i class="fas fa-heartbeat"></i>
                            </div>
                            <span>Configure ${fragment.name}${totalOfType > 1 ? ` (Instance ${instanceNumber})` : ''}</span>
                            ${totalOfType > 1 ? `<button class="btn-remove-instance" data-instance-id="${instanceId}"><i class="fas fa-trash"></i> Remove</button>` : ''}
                        </h3>
                        <div class="config-grid" id="config-${instanceId}">
                            ${this.generateConfigFields(instanceId, fragment.fields)}
                        </div>
                    `;
                    
                    configContainer.appendChild(panel);
                } else {
                    console.error('Fragment NOT found for monitor type:', monitorType);
                }
            });
            
            // Add event listeners for remove buttons
            configContainer.querySelectorAll('.btn-remove-instance').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const instanceId = btn.dataset.instanceId;
                    this.removeMonitorInstance(instanceId);
                });
            });
        }

        // Generate rule configurations (when rules are implemented)
        if (this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0) {
            this.mpData.selectedComponents.rules.forEach(ruleType => {
                const fragment = this.fragmentLibrary[ruleType];
                if (fragment) {
                    const panel = document.createElement('div');
                    panel.className = 'config-panel';
                    panel.innerHTML = `
                        <h3>
                            <div class="config-panel-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            Configure ${fragment.name}
                        </h3>
                        <div class="config-grid" id="config-${ruleType}">
                            ${this.generateConfigFields(ruleType, fragment.fields)}
                        </div>
                    `;
                    
                    configContainer.appendChild(panel);
                } else {
                    console.error('Fragment NOT found for rule type:', ruleType);
                }
            });
        }

        // Show message if no components are selected
        if (configContainer.children.length === 0) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'no-config-message';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-info-circle"></i>
                    <h3>No Configuration Required</h3>
                    <p>You haven't selected any components that require configuration. Go back to previous steps to select discovery methods, monitors, or rules.</p>
                </div>
            `;
            configContainer.appendChild(messageDiv);
        }
        
        // Update download button states after generating forms
        setTimeout(() => {
            updateDownloadButtons();
        }, 100);
    }

    generateConfigFields(componentType, fields) {
        return fields.map(field => {
            const fieldId = `${componentType}-${field.id}`;
            const required = field.required ? 'required' : '';
            const value = field.value || '';
            const placeholder = field.placeholder || '';
            
            let input;
            switch (field.type) {
                case 'select':
                    const options = field.options.map(opt => {
                        const selected = (field.value && opt === field.value) ? 'selected' : '';
                        return `<option value="${opt}" ${selected}>${opt}</option>`;
                    }).join('');
                    
                    const defaultOption = field.value ? '' : '<option value="">Select...</option>';
                    input = `<select id="${fieldId}" ${required}>${defaultOption}${options}</select>`;
                    break;
                case 'textarea':
                    input = `<textarea id="${fieldId}" placeholder="${placeholder}" ${required}>${value}</textarea>`;
                    break;
                case 'number':
                    input = `<input type="number" id="${fieldId}" placeholder="${placeholder}" value="${value}" ${required}>`;
                    break;
                default:
                    input = `<input type="text" id="${fieldId}" placeholder="${placeholder}" value="${value}" ${required}>`;
            }
            
            const helpText = field.help ? `<small>${field.help}</small>` : '';
            const fullWidthClass = field.type === 'textarea' ? ' form-group--full-width' : '';
            
            return `
                <div class="form-group${fullWidthClass}">
                    <label for="${fieldId}">${field.label}${field.required ? ' *' : ''}</label>
                    ${input}
                    ${helpText}
                </div>
            `;
        }).join('');
    }

    previewMP() {
        this.saveBasicInfo();
        // Explicitly save configuration data before generating preview
        this.saveConfigurationData();
        const previewContent = this.generatePreviewStructure();
        this.showOutput(previewContent, 'Management Pack XML Preview');
    }

    saveBasicInfo() {
        const companyIdField = document.getElementById('company-id');
        const appNameField = document.getElementById('app-name');
        const versionField = document.getElementById('mp-version');
        const descriptionField = document.getElementById('mp-description');
        
        if (companyIdField && appNameField) {
            this.mpData.basicInfo = {
                companyId: companyIdField.value.trim().toUpperCase(),
                appName: appNameField.value.trim(),
                version: versionField ? versionField.value.trim() || '1.0.0.0' : '1.0.0.0',
                description: descriptionField ? descriptionField.value.trim() : ''
            };
        }
    }

    generatePreviewStructure() {
        const { companyId, appName, version, description } = this.mpData.basicInfo;
        
        if (!companyId || !appName) {
            return `<!-- Management Pack Preview -->
<!-- Please fill out Company ID and Application Name in Step 1 to see XML preview -->

Basic Information Needed:
- Company ID: ${companyId || 'Not provided'}
- Application Name: ${appName || 'Not provided'}

Selected Components:
${this.mpData.selectedComponents.discovery ? `- Discovery: ${this.mpData.selectedComponents.discovery}` : '- No discovery selected'}
${this.mpData.selectedComponents.monitors?.length > 0 ? `- Monitors: ${this.mpData.selectedComponents.monitors.map(m => m.type).join(', ')} (${this.mpData.selectedComponents.monitors.length} instance${this.mpData.selectedComponents.monitors.length > 1 ? 's' : ''})` : ''}
${this.mpData.selectedComponents.rules?.length > 0 ? `- Rules: ${this.mpData.selectedComponents.rules.join(', ')}` : ''}

Once you complete Step 1, the preview will show the actual XML structure.`;
        }

        const hasComponents = this.mpData.selectedComponents.discovery || 
            (this.mpData.selectedComponents.monitors && this.mpData.selectedComponents.monitors.length > 0) ||
            (this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0);

        if (!hasComponents) {
            const mpId = `${companyId}.${appName}`;
            return `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack ContentReadable="true" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <Manifest>
    <Identity>
      <ID>${mpId}</ID>
      <Version>${version || '1.0.0.0'}</Version>
    </Identity>
    <Name>${mpId}</Name>
    <References>
      <Reference Alias="System">
        <ID>System.Library</ID>
        <Version>7.0.8560.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>
      <Reference Alias="Windows">
        <ID>Microsoft.Windows.Library</ID>
        <Version>7.0.8560.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>
    </References>
    ${description ? `<Description>${description}</Description>` : ''}
  </Manifest>
  
  <!-- 
  No components selected yet. 
  Please continue through the wizard to add:
  - Discovery (Step 2)
  - Monitors (Step 3) 
  - Rules (Step 4)
  - Groups, Tasks, Views (Step 5)
  -->
  
  <Monitoring>
    <!-- Components will be added here based on your selections -->
  </Monitoring>
  
</ManagementPack>`;
        }

        try {
            this.saveConfigurationData();
            return this.generateMPXML();
        } catch (error) {
            console.error('Error generating preview XML:', error);
            return `<!-- Error generating XML preview: ${error.message} -->
<!-- Please check your configuration and try again -->`;
        }
    }

    saveConfigurationData() {
        // Save configuration data from all visible config forms
        const allConfigInputs = document.querySelectorAll('#component-configs input, #component-configs select, #component-configs textarea');
        
        allConfigInputs.forEach(input => {
            const id = input.id;
            const value = input.value.trim();
            
            if (id) {
                // Parse the component type and field from the ID
                const parts = id.split('-');
                if (parts.length >= 2) {
                    let componentType, fieldName;
                    
                    // Check if this is a monitor instance ID (contains 'instance')
                    const instanceIndex = parts.findIndex(part => part === 'instance');
                    if (instanceIndex > 0 && instanceIndex < parts.length - 1) {
                        // This is a monitor instance - use the full instance ID as componentType
                        const fieldIndex = instanceIndex + 2; // Skip 'instance' and the number
                        if (fieldIndex < parts.length) {
                            componentType = parts.slice(0, fieldIndex).join('-');
                            fieldName = parts.slice(fieldIndex).join('-');
                        } else {
                            // Fallback if parsing fails
                            componentType = parts.slice(0, -1).join('-');
                            fieldName = parts[parts.length - 1];
                        }
                    } else {
                        // Handle component types with hyphens (like 'registry-key')
                        // Find the original component type by checking against known types
                        // Sort by length (longest first) to match more specific types first
                        const knownComponentTypes = Object.keys(this.fragmentLibrary)
                            .sort((a, b) => b.length - a.length);
                        
                        const matchingType = knownComponentTypes.find(type => id.startsWith(type + '-'));
                        
                        if (matchingType) {
                            componentType = matchingType;
                            fieldName = id.substring(matchingType.length + 1); // +1 for the hyphen
                        } else {
                            // Fallback to original logic
                            componentType = parts[0];
                            fieldName = parts.slice(1).join('-');
                        }
                    }
                    
                    if (!this.mpData.configurations[componentType]) {
                        this.mpData.configurations[componentType] = {};
                    }
                    
                    // Save the value even if it's empty (might be intentional)
                    this.mpData.configurations[componentType][fieldName] = value;
                }
            }
        });
    }

    generateMPXML() {
        const { companyId, appName, version, description } = this.mpData.basicInfo;
        const mpId = `${companyId}.${appName}`;
        
        // If MP was imported, merge new content into it
        if (this.mpData.importedMP && this.mpData.importedMP.xmlDoc) {
            return this.mergeIntoImportedMP();
        }
        
        // Otherwise, create a new MP from scratch
        return this.generateNewMPXML();
    }

    mergeIntoImportedMP() {
        const xmlDoc = this.mpData.importedMP.xmlDoc.cloneNode(true);
        
        // Increment the version number
        const versionElement = xmlDoc.querySelector('Manifest > Identity > Version');
        if (versionElement) {
            const currentVersion = versionElement.textContent.trim();
            const versionParts = currentVersion.split('.');
            if (versionParts.length === 4) {
                // Increment the last part (build number)
                versionParts[3] = (parseInt(versionParts[3]) + 1).toString();
                const newVersion = versionParts.join('.');
                versionElement.textContent = newVersion;
            }
        }
        
        // Process new fragments to add
        let newFragments = [];
        
        // Add monitor fragments
        if (this.mpData.selectedComponents.monitors && this.mpData.selectedComponents.monitors.length > 0) {
            this.mpData.selectedComponents.monitors.forEach(monitorInstance => {
                const monitorType = monitorInstance.type;
                const instanceId = monitorInstance.instanceId;
                const fragment = this.fragmentLibrary[monitorType];
                if (fragment && fragment.template) {
                    const processedFragment = this.processFragmentTemplate(instanceId, fragment.template, monitorType);
                    if (processedFragment && processedFragment.trim().length > 0) {
                        newFragments.push(processedFragment);
                    }
                }
            });
        }
        
        // Add rule fragments
        if (this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0) {
            this.mpData.selectedComponents.rules.forEach(ruleType => {
                const fragment = this.fragmentLibrary[ruleType];
                if (fragment && fragment.template) {
                    const processedFragment = this.processFragmentTemplate(ruleType, fragment.template);
                    if (processedFragment && processedFragment.trim().length > 0) {
                        newFragments.push(processedFragment);
                    }
                }
            });
        }
        
        if (newFragments.length === 0) {
            // No new content to add, return original
            return new XMLSerializer().serializeToString(xmlDoc);
        }
        
        // Parse new fragments and merge into xmlDoc
        const { typeDefinitions, monitoring, presentation, languagePacks } = this.extractAndCombineSections(newFragments);
        
        // Add TypeDefinitions in proper order: EntityTypes, ModuleTypes, MonitorTypes
        if (typeDefinitions) {
            const tempDoc = new DOMParser().parseFromString(`<TypeDefinitions>${typeDefinitions}</TypeDefinitions>`, 'text/xml');
            
            // Get or create TypeDefinitions section
            let typeDefsSection = xmlDoc.querySelector('TypeDefinitions');
            if (!typeDefsSection) {
                typeDefsSection = xmlDoc.createElement('TypeDefinitions');
                const manifest = xmlDoc.querySelector('Manifest');
                if (manifest && manifest.nextSibling) {
                    manifest.parentNode.insertBefore(typeDefsSection, manifest.nextSibling);
                } else {
                    xmlDoc.querySelector('ManagementPack').appendChild(typeDefsSection);
                }
            }
            
            // Check what sections currently exist
            let entityTypesSection = typeDefsSection.querySelector('EntityTypes');
            let moduleTypesSection = typeDefsSection.querySelector('ModuleTypes');
            let monitorTypesSection = typeDefsSection.querySelector('MonitorTypes');
            
            // Add ClassTypes (inside EntityTypes) - should come first
            const newClassTypes = tempDoc.querySelectorAll('EntityTypes > ClassTypes > *');
            if (newClassTypes.length > 0) {
                if (!entityTypesSection) {
                    entityTypesSection = xmlDoc.createElement('EntityTypes');
                    // Insert at the beginning
                    if (typeDefsSection.firstChild) {
                        typeDefsSection.insertBefore(entityTypesSection, typeDefsSection.firstChild);
                    } else {
                        typeDefsSection.appendChild(entityTypesSection);
                    }
                }
                let classTypesSection = entityTypesSection.querySelector('ClassTypes');
                if (!classTypesSection) {
                    classTypesSection = xmlDoc.createElement('ClassTypes');
                    entityTypesSection.appendChild(classTypesSection);
                }
                newClassTypes.forEach(classType => {
                    classTypesSection.appendChild(xmlDoc.importNode(classType, true));
                });
            }
            
            // Add ModuleTypes - should come after EntityTypes, before MonitorTypes
            const newModuleTypes = tempDoc.querySelectorAll('ModuleTypes > *');
            if (newModuleTypes.length > 0) {
                if (!moduleTypesSection) {
                    moduleTypesSection = xmlDoc.createElement('ModuleTypes');
                    // Re-query to get updated positions
                    entityTypesSection = typeDefsSection.querySelector('EntityTypes');
                    monitorTypesSection = typeDefsSection.querySelector('MonitorTypes');
                    
                    if (monitorTypesSection) {
                        // Insert before MonitorTypes
                        typeDefsSection.insertBefore(moduleTypesSection, monitorTypesSection);
                    } else if (entityTypesSection) {
                        // Insert after EntityTypes
                        if (entityTypesSection.nextSibling) {
                            typeDefsSection.insertBefore(moduleTypesSection, entityTypesSection.nextSibling);
                        } else {
                            typeDefsSection.appendChild(moduleTypesSection);
                        }
                    } else {
                        typeDefsSection.appendChild(moduleTypesSection);
                    }
                }
                newModuleTypes.forEach(modType => {
                    moduleTypesSection.appendChild(xmlDoc.importNode(modType, true));
                });
            }
            
            // Add MonitorTypes - should come last
            const newMonitorTypes = tempDoc.querySelectorAll('MonitorTypes > *');
            if (newMonitorTypes.length > 0) {
                if (!monitorTypesSection) {
                    monitorTypesSection = xmlDoc.createElement('MonitorTypes');
                    // Always append at end
                    typeDefsSection.appendChild(monitorTypesSection);
                }
                newMonitorTypes.forEach(monType => {
                    monitorTypesSection.appendChild(xmlDoc.importNode(monType, true));
                });
            }
        }
        
        // Get or create Monitoring section
        let monitoringSection = xmlDoc.querySelector('Monitoring');
        if (!monitoringSection) {
            monitoringSection = xmlDoc.createElement('Monitoring');
            const root = xmlDoc.querySelector('ManagementPack');
            root.appendChild(monitoringSection);
        }
        
        // Add new monitoring content in proper order: Discoveries, Monitors, Rules
        if (monitoring) {
            const tempDoc = new DOMParser().parseFromString(`<Monitoring>${monitoring}</Monitoring>`, 'text/xml');
            
            // Check what sections currently exist
            let discoveriesSection = monitoringSection.querySelector('Discoveries');
            let monitorsSection = monitoringSection.querySelector('Monitors');
            let rulesSection = monitoringSection.querySelector('Rules');
            
            // Add Discoveries (for fragments that include class + discovery)
            const newDiscoveries = tempDoc.querySelectorAll('Discoveries > *');
            if (newDiscoveries.length > 0) {
                if (!discoveriesSection) {
                    discoveriesSection = xmlDoc.createElement('Discoveries');
                    // Insert at the beginning
                    if (monitoringSection.firstChild) {
                        monitoringSection.insertBefore(discoveriesSection, monitoringSection.firstChild);
                    } else {
                        monitoringSection.appendChild(discoveriesSection);
                    }
                }
                newDiscoveries.forEach(discovery => {
                    discoveriesSection.appendChild(xmlDoc.importNode(discovery, true));
                });
            }
            
            // Add Monitors (should come after Discoveries, before Rules)
            const newMonitors = tempDoc.querySelectorAll('Monitors > *');
            if (newMonitors.length > 0) {
                if (!monitorsSection) {
                    monitorsSection = xmlDoc.createElement('Monitors');
                    // Re-query to get updated positions
                    discoveriesSection = monitoringSection.querySelector('Discoveries');
                    rulesSection = monitoringSection.querySelector('Rules');
                    
                    if (rulesSection) {
                        // Insert before Rules
                        monitoringSection.insertBefore(monitorsSection, rulesSection);
                    } else if (discoveriesSection) {
                        // Insert after Discoveries
                        if (discoveriesSection.nextSibling) {
                            monitoringSection.insertBefore(monitorsSection, discoveriesSection.nextSibling);
                        } else {
                            monitoringSection.appendChild(monitorsSection);
                        }
                    } else {
                        monitoringSection.appendChild(monitorsSection);
                    }
                }
                newMonitors.forEach(monitor => {
                    monitorsSection.appendChild(xmlDoc.importNode(monitor, true));
                });
            }
            
            // Add Rules (should come last)
            const newRules = tempDoc.querySelectorAll('Rules > *');
            if (newRules.length > 0) {
                if (!rulesSection) {
                    rulesSection = xmlDoc.createElement('Rules');
                    // Always append at end
                    monitoringSection.appendChild(rulesSection);
                }
                newRules.forEach(rule => {
                    rulesSection.appendChild(xmlDoc.importNode(rule, true));
                });
            }
        }
        
        // Add Presentation section (Views, StringResources, etc)
        if (presentation) {
            const tempDoc = new DOMParser().parseFromString(`<Presentation>${presentation}</Presentation>`, 'text/xml');
            
            // Get or create Presentation section
            let presentationSection = xmlDoc.querySelector('Presentation');
            if (!presentationSection) {
                presentationSection = xmlDoc.createElement('Presentation');
                const monitoring = xmlDoc.querySelector('Monitoring');
                if (monitoring && monitoring.nextSibling) {
                    monitoring.parentNode.insertBefore(presentationSection, monitoring.nextSibling);
                } else {
                    xmlDoc.querySelector('ManagementPack').appendChild(presentationSection);
                }
            }
            
            // Add StringResources
            const newStringResources = tempDoc.querySelectorAll('StringResources > *');
            if (newStringResources.length > 0) {
                let stringResourcesSection = presentationSection.querySelector('StringResources');
                if (!stringResourcesSection) {
                    stringResourcesSection = xmlDoc.createElement('StringResources');
                    presentationSection.appendChild(stringResourcesSection);
                }
                newStringResources.forEach(sr => {
                    stringResourcesSection.appendChild(xmlDoc.importNode(sr, true));
                });
            }
            
            // Add Views (if any)
            const newViews = tempDoc.querySelectorAll('Views > *');
            if (newViews.length > 0) {
                let viewsSection = presentationSection.querySelector('Views');
                if (!viewsSection) {
                    viewsSection = xmlDoc.createElement('Views');
                    presentationSection.appendChild(viewsSection);
                }
                newViews.forEach(view => {
                    viewsSection.appendChild(xmlDoc.importNode(view, true));
                });
            }
        }
        
        // Add new language pack entries
        if (languagePacks) {
            const tempDoc = new DOMParser().parseFromString(languagePacks, 'text/xml');
            const newDisplayStrings = tempDoc.querySelectorAll('DisplayString');
            
            if (newDisplayStrings.length > 0) {
                let languagePacksSection = xmlDoc.querySelector('LanguagePacks');
                if (!languagePacksSection) {
                    languagePacksSection = xmlDoc.createElement('LanguagePacks');
                    xmlDoc.querySelector('ManagementPack').appendChild(languagePacksSection);
                }
                
                let langPack = languagePacksSection.querySelector('LanguagePack[ID="ENU"]');
                if (!langPack) {
                    langPack = xmlDoc.createElement('LanguagePack');
                    langPack.setAttribute('ID', 'ENU');
                    langPack.setAttribute('IsDefault', 'true');
                    languagePacksSection.appendChild(langPack);
                }
                
                let displayStringsSection = langPack.querySelector('DisplayStrings');
                if (!displayStringsSection) {
                    displayStringsSection = xmlDoc.createElement('DisplayStrings');
                    langPack.appendChild(displayStringsSection);
                }
                
                newDisplayStrings.forEach(ds => {
                    displayStringsSection.appendChild(xmlDoc.importNode(ds, true));
                });
            }
        }
        
        // Serialize and return
        const serializer = new XMLSerializer();
        let xmlString = serializer.serializeToString(xmlDoc);
        
        // Format the XML nicely
        return this.formatXML(xmlString);
    }

    formatXML(xml) {
        // Simple XML formatting - add proper indentation
        const PADDING = '  '; // 2 spaces for indentation
        const reg = /(>)(<)(\/*)/g;
        let formatted = '';
        let pad = 0;
        
        xml = xml.replace(reg, '$1\n$2$3');
        xml.split('\n').forEach((node) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/) && pad > 0) {
                pad -= 1;
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            
            formatted += PADDING.repeat(pad) + node + '\n';
            pad += indent;
        });
        
        return formatted.trim();
    }

    generateNewMPXML() {
        const { companyId, appName, version, description } = this.mpData.basicInfo;
        const mpId = `${companyId}.${appName}`;
        
        // Process all selected fragments and combine them
        let allFragments = [];
        
        // Add discovery fragment
        if (this.mpData.selectedComponents.discovery && this.mpData.selectedComponents.discovery !== 'skip') {
            const discoveryType = this.mpData.selectedComponents.discovery;
            const fragment = this.fragmentLibrary[discoveryType];
            if (fragment && fragment.template) {
                const processedFragment = this.processFragmentTemplate(discoveryType, fragment.template);
                allFragments.push(processedFragment);
            }
        }
        
        // Add monitor fragments
        if (this.mpData.selectedComponents.monitors && this.mpData.selectedComponents.monitors.length > 0) {
            this.mpData.selectedComponents.monitors.forEach(monitorInstance => {
                const monitorType = monitorInstance.type;
                const instanceId = monitorInstance.instanceId;
                const fragment = this.fragmentLibrary[monitorType];
                if (fragment && fragment.template) {
                    const processedFragment = this.processFragmentTemplate(instanceId, fragment.template, monitorType);
                    if (processedFragment && processedFragment.trim().length > 0) {
                        allFragments.push(processedFragment);
                    }
                } else {
                    console.error('No template found for monitor:', monitorType);
                }
            });
        }
        
        // Add rule fragments
        if (this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0) {
            this.mpData.selectedComponents.rules.forEach(ruleType => {
                const fragment = this.fragmentLibrary[ruleType];
                if (fragment && fragment.template) {
                    const processedFragment = this.processFragmentTemplate(ruleType, fragment.template);
                    if (processedFragment && processedFragment.trim().length > 0) {
                        allFragments.push(processedFragment);
                    }
                } else {
                    console.error('No template found for rule:', ruleType);
                }
            });
        }
        
        // Extract sections from fragments and combine them
        const { typeDefinitions, monitoring, presentation, languagePacks } = this.extractAndCombineSections(allFragments);
        
        // Build references
        let references = this.generateReferences();
        
        // Check if any rules are selected - if so, skip Description
        const hasAnyRule = this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0;
        const includeDescription = !hasAnyRule && description;
        
        return `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack ContentReadable="true" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <Manifest>
    <Identity>
      <ID>${mpId}</ID>
      <Version>${version}</Version>
    </Identity>
    <Name>${mpId}</Name>
    <References>
${references}
    </References>
    ${includeDescription ? `<Description>${description}</Description>` : ''}
  </Manifest>
  ${typeDefinitions ? `<TypeDefinitions>\n${typeDefinitions}\n  </TypeDefinitions>` : ''}
  <Monitoring>
${monitoring}
  </Monitoring>
  ${presentation ? `<Presentation>\n${presentation}\n  </Presentation>` : ''}
${languagePacks ? `${languagePacks}` : ''}
</ManagementPack>`;
    }

    extractAndCombineSections(fragments) {
        let classTypes = [];
        let moduleTypes = [];
        let monitorTypes = [];
        let discoveries = [];
        let monitors = [];
        let rules = [];
        let displayStrings = [];
        
        fragments.forEach((fragmentXml, index) => {
            if (!fragmentXml || fragmentXml.trim().length === 0) {
                console.error('Fragment', index, 'is empty or null');
                return;
            }
            try {
                // Parse the fragment XML
                const parser = new DOMParser();
                const doc = parser.parseFromString(fragmentXml, 'text/xml');
                
                // Check for parsing errors
                const parserError = doc.querySelector('parsererror');
                if (parserError) {
                    console.error('XML Parse Error in fragment', index, ':', parserError.textContent);
                    console.error('Fragment content:', fragmentXml);
                    return;
                }
                
                // Extract ClassTypes from TypeDefinitions
                const classTypeNodes = doc.querySelectorAll('TypeDefinitions > EntityTypes > ClassTypes > ClassType');
                classTypeNodes.forEach(node => {
                    classTypes.push(this.nodeToString(node));
                });
                
                // Extract ModuleTypes from TypeDefinitions
                const moduleTypeNodes = doc.querySelectorAll('TypeDefinitions > ModuleTypes > DataSourceModuleType, TypeDefinitions > ModuleTypes > ProbeActionModuleType, TypeDefinitions > ModuleTypes > ConditionDetectionModuleType, TypeDefinitions > ModuleTypes > WriteActionModuleType');
                moduleTypeNodes.forEach(node => {
                    moduleTypes.push(this.nodeToString(node));
                });
                
                // Extract MonitorTypes from TypeDefinitions
                const monitorTypeNodes = doc.querySelectorAll('TypeDefinitions > MonitorTypes > UnitMonitorType, TypeDefinitions > MonitorTypes > AggregateMonitorType, TypeDefinitions > MonitorTypes > DependencyMonitorType');
                monitorTypeNodes.forEach(node => {
                    monitorTypes.push(this.nodeToString(node));
                });
                
                // Extract Discoveries
                const discoveryNodes = doc.querySelectorAll('Monitoring > Discoveries > Discovery');
                discoveryNodes.forEach(node => {
                    discoveries.push(this.nodeToString(node));
                });
                
                // Extract Monitors
                const monitorNodes = doc.querySelectorAll('Monitoring > Monitors > UnitMonitor, Monitoring > Monitors > AggregateMonitor, Monitoring > Monitors > DependencyMonitor');
                monitorNodes.forEach(node => {
                    monitors.push(this.nodeToString(node));
                });
                
                // Extract Rules
                const ruleNodes = doc.querySelectorAll('Monitoring > Rules > Rule');
                ruleNodes.forEach(node => {
                    rules.push(this.nodeToString(node));
                });
                
                // Extract Display Strings
                const displayStringNodes = doc.querySelectorAll('LanguagePacks > LanguagePack > DisplayStrings > DisplayString');
                displayStringNodes.forEach(node => {
                    displayStrings.push(this.nodeToString(node));
                });
                
            } catch (error) {
                console.error('Error parsing fragment XML:', error);
            }
        });
        
        // Build combined sections
        let combinedTypeDefinitions = '';
        let typeDefSections = [];
        
        if (classTypes.length > 0) {
            typeDefSections.push(`    <EntityTypes>
      <ClassTypes>
${classTypes.map(def => '        ' + def).join('\n')}
      </ClassTypes>
    </EntityTypes>`);
        }
        
        if (moduleTypes.length > 0) {
            typeDefSections.push(`    <ModuleTypes>
${moduleTypes.map(def => '      ' + def).join('\n')}
    </ModuleTypes>`);
        }
        
        if (monitorTypes.length > 0) {
            typeDefSections.push(`    <MonitorTypes>
${monitorTypes.map(def => '      ' + def).join('\n')}
    </MonitorTypes>`);
        }
        
        combinedTypeDefinitions = typeDefSections.join('\n');
        
        let combinedMonitoring = '';
        let monitoringSections = [];
        
        if (discoveries.length > 0) {
            monitoringSections.push(`    <Discoveries>
${discoveries.map(disc => '      ' + disc).join('\n')}
    </Discoveries>`);
        }
        
        if (monitors.length > 0) {
            monitoringSections.push(`    <Monitors>
${monitors.map(mon => '      ' + mon).join('\n')}
    </Monitors>`);
        }
        
        if (rules.length > 0) {
            monitoringSections.push(`    <Rules>
${rules.map(rule => '      ' + rule).join('\n')}
    </Rules>`);
        }
        
        combinedMonitoring = monitoringSections.join('\n');
        
        // Generate StringResource elements for monitors and rules with AlertMessage references
        let stringResources = [];
        monitors.forEach(monitorXml => {
            // Look for AlertMessage references in the monitor XML
            const alertMessageMatch = monitorXml.match(/AlertMessage="([^"]+)"/);
            if (alertMessageMatch) {
                const alertMessageId = alertMessageMatch[1];
                stringResources.push(`      <StringResource ID="${alertMessageId}" />`);
            }
        });
        
        // Also check rules for AlertMessage references
        rules.forEach(ruleXml => {
            // Look for AlertMessageId references in the rule XML
            const alertMessageMatch = ruleXml.match(/AlertMessageId[^>]*>\$MPElement\[Name="([^"]+)"\]\$</);
            if (alertMessageMatch) {
                const alertMessageId = alertMessageMatch[1];
                stringResources.push(`      <StringResource ID="${alertMessageId}" />`);
            }
        });
        
        let combinedPresentation = '';
        if (displayStrings.length > 0 || stringResources.length > 0) {
            combinedPresentation = `    <StringResources>
${stringResources.join('\n')}
    </StringResources>`;
        }
        
        let combinedLanguagePacks = '';
        if (displayStrings.length > 0) {
            combinedLanguagePacks = `  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
${displayStrings.map(str => '        ' + str).join('\n')}
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>`;
        }
        
        return {
            typeDefinitions: combinedTypeDefinitions,
            monitoring: combinedMonitoring,
            presentation: combinedPresentation,
            languagePacks: combinedLanguagePacks
        };
    }

    nodeToString(node) {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(node);
    }

    generateReferences() {
        let refs = [
            `      <Reference Alias="System">
        <ID>System.Library</ID>
        <Version>7.5.8501.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`,
            `      <Reference Alias="Windows">
        <ID>Microsoft.Windows.Library</ID>
        <Version>7.5.8501.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`,
            `      <Reference Alias="Health">
        <ID>System.Health.Library</ID>
        <Version>7.0.8437.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`
        ];

        // Add SyntheticTransactions reference if Port Check Monitor is selected
        const hasPortMonitor = this.mpData.selectedComponents.monitors?.some(
            monitor => monitor.type === 'port-monitor'
        );
        
        if (hasPortMonitor) {
            refs.push(`      <Reference Alias="MSSL">
        <ID>Microsoft.SystemCenter.SyntheticTransactions.Library</ID>
        <Version>7.5.8501.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`);
        }

        // Add PowerShell Monitoring reference if 3-state monitor is selected
        const has3StateMonitor = this.mpData.selectedComponents.monitors?.some(
            monitor => monitor.type === 'powershell-script-monitor-3state'
        );
        
        if (has3StateMonitor) {
            refs.push(`      <Reference Alias="PowerShellMonitoring">
        <ID>Community.PowerShellMonitoring</ID>
        <Version>1.1.1.2</Version>
        <PublicKeyToken>3aa540324b898d3c</PublicKeyToken>
      </Reference>`);
        }

        // Add Performance Collection references if performance collection rule is selected
        const hasPerfCollectionRule = this.mpData.selectedComponents.rules?.includes('performance-collection');
        
        if (hasPerfCollectionRule) {
            refs.push(`      <Reference Alias="SC">
        <ID>Microsoft.SystemCenter.Library</ID>
        <Version>7.0.8437.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`);
            refs.push(`      <Reference Alias="Perf">
        <ID>System.Performance.Library</ID>
        <Version>7.0.8437.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`);
            refs.push(`      <Reference Alias="MSDL">
        <ID>Microsoft.SystemCenter.DataWarehouse.Library</ID>
        <Version>7.0.8437.0</Version>
        <PublicKeyToken>31bf3856ad364e35</PublicKeyToken>
      </Reference>`);
        }

        return refs.join('\n');
    }

    generateTypeDefinitions() {
        if (!this.mpData.selectedComponents.discovery || this.mpData.selectedComponents.discovery === 'skip') {
            return '';
        }

        const { companyId, appName } = this.mpData.basicInfo;
        const className = `${companyId}.${appName}.Application.Class`;

        return `    <EntityTypes>
      <ClassTypes>
        <ClassType ID="${className}" Base="Windows!Microsoft.Windows.LocalApplication" Accessibility="Public" Abstract="false" Hosted="true" Singleton="false">
        </ClassType>
      </ClassTypes>
    </EntityTypes>`;
    }

    generateMonitoringSection() {
        let sections = [];

        // Generate Discoveries
        if (this.mpData.selectedComponents.discovery && this.mpData.selectedComponents.discovery !== 'skip') {
            sections.push(this.generateDiscoverySection());
        }

        // Generate Monitors
        if (this.mpData.selectedComponents.monitors && this.mpData.selectedComponents.monitors.length > 0) {
            sections.push(this.generateMonitorsSection());
        }

        // Generate Rules
        if (this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0) {
            sections.push(this.generateRulesSection());
        }

        return sections.join('\n');
    }

    generateDiscoverySection() {
        const discoveryType = this.mpData.selectedComponents.discovery;
        const fragment = this.fragmentLibrary[discoveryType];
        
        if (!fragment || !fragment.template) {
            return '';
        }

        return this.processFragmentTemplate(discoveryType, fragment.template);
    }

    processFragmentTemplate(componentType, template, baseMonitorType = null) {
        const { companyId, appName } = this.mpData.basicInfo;
        
        // Ensure configuration data is saved before processing
        this.saveConfigurationData();
        
        // Check if template is a filename (external template) and load it synchronously
        if (typeof template === 'string' && template.endsWith('.mpx')) {
            try {
                const xhr = new XMLHttpRequest();
                // Add cache-busting timestamp to prevent browser from using cached template
                const cacheBuster = `?_=${Date.now()}`;
                xhr.open('GET', `FragmentLibrary-master 2/${template}${cacheBuster}`, false); // synchronous load
                xhr.send();
                if (xhr.status === 200) {
                    template = xhr.responseText;
                } else {
                    console.error(`Failed to load template file: ${template} (HTTP ${xhr.status})`);
                    template = '<!-- Failed to load template -->';
                }
            } catch (error) {
                console.error(`Error loading template file ${template}:`, error);
                template = '<!-- Error loading template -->';
            }
        }
        
        const config = this.mpData.configurations[componentType] || {};
        
        // Get target class from discovery configuration if not in current component
        const discoveryType = this.mpData.selectedComponents.discovery;
        const discoveryConfig = discoveryType ? this.mpData.configurations[discoveryType] || {} : {};
        // Check for skip configuration target class
        const skipConfig = this.mpData.configurations.skip || {};
        const targetClass = config.targetClass || config.targetclass || 
                           discoveryConfig.targetClass || discoveryConfig.targetclass || 
                           skipConfig.targetClass || 
                           'Windows!Microsoft.Windows.Server.OperatingSystem';
        
        // Determine the correct uniqueId and target class for monitors
        let monitorTargetClass;
        let effectiveUniqueId;
        
        // Check if this is a monitor instance (baseMonitorType is passed)
        if (baseMonitorType) {
            // Extract instance number from componentType (e.g., "port-monitor-instance-2" -> "2")
            let instanceSuffix = '';
            const instanceMatch = componentType.match(/-instance-(\d+)$/);
            if (instanceMatch) {
                instanceSuffix = `.Instance${instanceMatch[1]}`;
            }
            
            // For monitors, check if they have their own uniqueId first
            if (config.uniqueId || config.uniqueid) {
                effectiveUniqueId = (config.uniqueId || config.uniqueid) + instanceSuffix;
            } else if (this.mpData.selectedComponents.discovery && this.mpData.selectedComponents.discovery !== 'skip') {
                // If no uniqueId in monitor config, use discovery's uniqueId
                effectiveUniqueId = (discoveryConfig.uniqueId || 'Application') + instanceSuffix;
            } else {
                // Default fallback
                effectiveUniqueId = 'Application' + instanceSuffix;
            }
            
            // Determine target class for monitor
            if (this.mpData.selectedComponents.discovery && this.mpData.selectedComponents.discovery !== 'skip') {
                monitorTargetClass = `${companyId}.${appName}.${discoveryConfig.uniqueId || 'Application'}.Class`;
            } else {
                // Use the selected target class from skip configuration
                monitorTargetClass = skipConfig.targetClass || targetClass;
            }
        } else {
            // For discoveries, rules and other components
            effectiveUniqueId = config.uniqueId || config.uniqueid || 'Application';
            
            // For rules, use the target class directly (not a custom class)
            // Rules should target Windows classes or the discovery class if one exists
            if (this.mpData.selectedComponents.discovery && this.mpData.selectedComponents.discovery !== 'skip') {
                monitorTargetClass = `${companyId}.${appName}.${discoveryConfig.uniqueId || effectiveUniqueId}.Class`;
            } else {
                // No discovery - use the skip target class or default Windows class
                monitorTargetClass = skipConfig.targetClass || targetClass;
            }
        }
        
        // Create replacement map
        // Security: Apply XML encoding to all user-provided values
        const replacements = {
            '##CompanyID##': this.escapeXml(companyId),
            '##AppName##': this.escapeXml(appName),
            '##UniqueID##': this.escapeXml(effectiveUniqueId),
            '##ClassID##': this.escapeXml(monitorTargetClass),
            '##RegKeyPath##': this.escapeXml(config.regKeyPath || config.regkeypath || 'SOFTWARE\\MyCompany\\MyApplication'),
            '##TargetClass##': this.escapeXml(targetClass),
            '##ServiceName##': this.escapeXml(config.serviceName || config.servicename || 'YourService'),
            '##WMIQuery##': this.escapeXml(config.wmiQuery || config.wmiquery || 'SELECT * FROM Win32_Service WHERE Name = "YourService"'),
            '##Namespace##': this.escapeXml(config.namespace || 'root\\cimv2'),
            '##ComputerNameList##': this.escapeXml(config.computerNameList || config.computernamelist || 'SERVER1,SERVER2'),
            '##ScriptType##': config.scriptType || config.scripttype || 'PowerShell',
            '##ScriptBody##': this.escapeXml(config.scriptBody || config.scriptbody || '# Enter your script here'),
            '##SCRIPT_BODY##': this.escapeXml(config.scriptBody || config.scriptbody || ' $status=if(Get-Process -Name notepad -ErrorAction SilentlyContinue) { 1 } else {0} \n\nif($status -eq 0) {\n  $PropertyBag.AddValue("State","Bad")\n}\nelseif($status -eq "Warning") {\n  $PropertyBag.AddValue("State","Warning")\n}\nelse\n{\n  $PropertyBag.AddValue("State","Ok")\n}'),
            '##ValueName##': this.escapeXml(config.valueName || config.valuename || ''),
            '##ExpectedValue##': this.escapeXml(config.expectedValue || config.expectedvalue || ''),
            '##AlertPriority##': config.alertPriority || config.alertpriority || 'Normal',
            '##AlertSeverity##': config.alertSeverity || config.alertseverity || 'Error',
            '##ObjectName##': this.escapeXml(config.objectName || config.counterObject || config.counterobject || 'Processor'),
            '##CounterName##': this.escapeXml(config.counterName || config.countername || '% Processor Time'),
            '##CounterObject##': this.escapeXml(config.counterObject || config.counterobject || 'Processor'),
            '##InstanceName##': this.escapeXml(config.instanceName || config.instance || '_Total'),
            '##Instance##': this.escapeXml(config.instanceName || config.instance || '_Total'),
            '##FrequencySeconds##': config.frequencySeconds || config.intervalseconds || config.intervalSeconds || '300',
            '##IntervalSeconds##': config.intervalSeconds || config.frequencySeconds || config.intervalseconds || '300',
            '##EventID##': this.escapeXml(config.eventId || config.eventid || '1234'),
            '##Threshold##': config.threshold || config.warningThreshold || config.warningthreshold || '80',
            '##WarningThreshold##': config.warningThreshold || config.warningthreshold || '80',
            '##CriticalThreshold##': config.criticalThreshold || config.criticalthreshold || '95',
            '##Samples##': config.samples || '3',
            '##ProcessName##': this.escapeXml(config.processName || config.processname || 'notepad.exe'),
            '##MinProcessCount##': config.minProcessCount || config.minprocesscount || '1',
            '##MaxProcessCount##': config.maxProcessCount || config.maxprocesscount || '10',
            '##MatchCount##': config.matchCount || config.matchcount || '2',
            '##PortNumber##': config.portNumber || config.portnumber || '80',
            '##Protocol##': config.protocol || 'TCP',
            '##Timeout##': config.timeout || '10',
            '##FolderPath##': this.escapeXml(config.folderPath || config.folderpath || 'C:\\Logs'),
            '##FileExtensionFilter##': this.escapeXml(config.fileExtensionFilter || config.fileextensionfilter || config.fileNameFilter || config.filenamefilter || '*.log'),
            '##FileNameFilter##': this.escapeXml(config.fileNameFilter || config.filenamefilter || '*.log'),
            '##FileAgeThresholdMinutes##': config.fileAgeThresholdMinutes || config.fileagethresholdminutes || '60',
            '##FileSizeThresholdKB##': config.fileSizeThresholdKB || config.filesizethresholdkb || '1024',
            '##FileCountThreshold##': config.fileCountThreshold || config.filecountthreshold || '1',
            '##UNCPath##': this.escapeXml(config.uncPath || config.uncpath || '\\\\server\\share'),
            '##WarningThresholdPercent##': config.warningThresholdPercent || config.warningthresholdpercent || '20',
            '##CriticalThresholdPercent##': config.criticalThresholdPercent || config.criticalthresholdpercent || '10',
            '##SQLServer##': this.escapeXml(config.sqlServer || config.sqlserver || 'localhost'),
            '##SQLDBName##': this.escapeXml(config.sqlDBName || config.sqldbname || 'master'),
            '##SQLQuery##': this.escapeXml(config.sqlQuery || config.sqlquery || 'SELECT 1'),
            '##RowCountThreshold##': config.rowCountThreshold || config.rowcountthreshold || '1',
            '##FilePath##': this.escapeXml(config.filePath || config.filepath || 'C:\\Logs\\app.log'),
            '##SearchString##': this.escapeXml(config.searchString || config.searchstring || 'ERROR'),
            '##MatchThreshold##': config.matchThreshold || config.matchthreshold || '1',
            // Text File Parser Monitor specific placeholders
            '##LogFilePath##': this.escapeXml(config.filePath || config.filepath || 'C:\\Logs\\app.log'),
            '##TextStringExpected##': this.escapeXml(config.searchString || config.searchstring || 'ERROR'),
            '##ThresholdHours##': config.matchThreshold || config.matchthreshold || '1',
            '##TimeoutSeconds##': config.timeoutSeconds || config.timeoutseconds || '120',
            '##Param1##': this.escapeXml(config.param1 || ''),
            '##Param2##': this.escapeXml(config.param2 || ''),
            '##ThresholdMinutes##': config.thresholdMinutes || config.thresholdminutes || '60',
            '##ComparisonType##': config.comparisonType || config.comparisontype || 'Greater Than',
            '##OID##': this.escapeXml(config.oid || '1.3.6.1.2.1.1.3.0'),
            '##Community##': this.escapeXml(config.community || 'public'),
            '##Port##': config.port || '161',
            '##ShellCommand##': this.escapeXml(config.shellCommand || config.shellcommand || 'echo "test"'),
            '##LogName##': this.escapeXml(config.logName || config.logname || 'Application'),
            '##EventSource##': this.escapeXml(config.eventSource || config.eventsource || ''),
            '##EventId##': this.escapeXml(config.eventId || config.eventid || ''),
            '##EventID##': this.escapeXml(config.eventId || config.eventid || ''),
            '##EventLevel##': config.eventLevel || config.eventlevel || 'Error',
            '##Description##': this.escapeXml(config.description || ''),
            '##RepeatCount##': config.repeatCount || config.repeatcount || '5',
            '##EventId1##': this.escapeXml(config.eventId1 || config.eventid1 || ''),
            '##EventId2##': this.escapeXml(config.eventId2 || config.eventid2 || ''),
            '##EventID1##': this.escapeXml(config.eventId1 || config.eventid1 || ''),
            '##EventID2##': this.escapeXml(config.eventId2 || config.eventid2 || ''),
            '##LogName1##': this.escapeXml(config.logName1 || config.logname1 || 'Application'),
            '##LogName2##': this.escapeXml(config.logName2 || config.logname2 || 'Application'),
            '##EventSource1##': this.escapeXml(config.eventSource1 || config.eventsource1 || ''),
            '##EventSource2##': this.escapeXml(config.eventSource2 || config.eventsource2 || ''),
            '##IntervalSeconds##': config.intervalSeconds || config.intervalseconds || '300'
        };

        // FAILSAFE: If intervalSeconds is not in config, try to read it directly from the DOM
        if (!config.intervalSeconds && !config.intervalseconds && !config.frequencySeconds) {
            const intervalInput = document.getElementById(`${componentType}-intervalSeconds`);
            if (intervalInput && intervalInput.value) {
                config.intervalSeconds = intervalInput.value.trim();
            }
        }

        // Replace all placeholders in the template
        let processedTemplate = template;
        for (const [placeholder, value] of Object.entries(replacements)) {
            processedTemplate = processedTemplate.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        
        return processedTemplate;
    }

    generateRegistryKeyDiscovery(className, config) {
        // This method is now handled by processFragmentTemplate
        return '';
    }

    generateRegistryValueDiscovery(className, config) {
        // Similar implementation for registry value discovery
        return '    <!-- Registry Value Discovery not yet implemented -->';
    }

    generateWMIDiscovery(className, config) {
        const companyId = config.companyId || '##CompanyID##';
        const appName = config.appName || '##AppName##';
        const uniqueId = config.uniqueId || 'WMI';
        const wmiQuery = config.wmiQuery || '##WMIQuery##';
        const namespace = config.namespace || 'root\\cimv2';
        const targetClass = config.targetClass || 'Windows!Microsoft.Windows.Server.OperatingSystem';
        
        return `  <TypeDefinitions>
    <EntityTypes>
      <ClassTypes>
        <ClassType ID="${companyId}.${appName}.${uniqueId}.Class" Base="Windows!Microsoft.Windows.LocalApplication" Accessibility="Public" Abstract="false" Hosted="true" Singleton="false"></ClassType>
      </ClassTypes>
    </EntityTypes>
  </TypeDefinitions>
  <Monitoring>
    <Discoveries>
      <Discovery ID="${companyId}.${appName}.${uniqueId}.Class.Discovery" Target="${targetClass}" Enabled="true" ConfirmDelivery="false" Remotable="true" Priority="Normal">
        <Category>Discovery</Category>
        <DiscoveryTypes>
          <DiscoveryClass TypeID="${companyId}.${appName}.${uniqueId}.Class" />
        </DiscoveryTypes>
        <DataSource ID="DS" TypeID="Windows!Microsoft.Windows.WmiProviderWithClassSnapshotDataMapper">
          <NameSpace>${namespace}</NameSpace>
          <Query><![CDATA[${wmiQuery}]]></Query>
          <Frequency>14400</Frequency>
          <ClassId>$MPElement[Name="${companyId}.${appName}.${uniqueId}.Class"]$</ClassId>
          <InstanceSettings>
            <Settings>
              <Setting>
                <Name>$MPElement[Name="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Name>
                <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
              </Setting>
              <Setting>
                <Name>$MPElement[Name="System!System.Entity"]/DisplayName$</Name>
                <Value>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</Value>
              </Setting>
            </Settings>
          </InstanceSettings>
        </DataSource>
      </Discovery>
    </Discoveries>
  </Monitoring>
  <LanguagePacks>
    <LanguagePack ID="ENU" IsDefault="true">
      <DisplayStrings>
        <DisplayString ElementID="${companyId}.${appName}.${uniqueId}.Class">
          <Name>${companyId} ${appName} ${uniqueId} Class</Name>
        </DisplayString>
        <DisplayString ElementID="${companyId}.${appName}.${uniqueId}.Class.Discovery">
          <Name>${companyId} ${appName} ${uniqueId} Class Discovery</Name>
        </DisplayString>
      </DisplayStrings>
    </LanguagePack>
  </LanguagePacks>`;
    }

    generateServiceDiscovery(className, config) {
        // Similar implementation for service discovery
        return '    <!-- Service Discovery not yet implemented -->';
    }

    generateScriptDiscovery(className, config) {
        // Similar implementation for script discovery
        return '    <!-- Script Discovery not yet implemented -->';
    }

    generateMonitorsSection() {
        let monitors = [];
        
        this.mpData.selectedComponents.monitors.forEach(monitorInstance => {
            const monitorType = monitorInstance.type;
            const instanceId = monitorInstance.instanceId;
            const fragment = this.fragmentLibrary[monitorType];
            
            if (fragment && fragment.template) {
                const processedFragment = this.processFragmentTemplate(instanceId, fragment.template, monitorType);
                if (processedFragment) {
                    monitors.push(processedFragment);
                }
            }
        });

        if (monitors.length > 0) {
            return monitors.join('\n');
        }
        
        return '';
    }

    generateServiceMonitor(config) {
        const { companyId, appName } = this.mpData.basicInfo;
        const monitorId = `${companyId}.${appName}.Service.Monitor`;
        const serviceName = config.serviceName || 'YourService';
        const targetClass = this.mpData.selectedComponents.discovery === 'skip' ? 
            'Windows!Microsoft.Windows.Computer' : `${companyId}.${appName}.Application.Class`;

        return `      <UnitMonitor ID="${monitorId}" Accessibility="Public" Enabled="true" Target="${targetClass}" ParentMonitorID="Health!System.Health.AvailabilityState" Remotable="true" Priority="Normal" TypeID="Windows!Microsoft.Windows.CheckNTServiceStateMonitorType" ConfirmDelivery="false">
        <Category>AvailabilityHealth</Category>
        <AlertSettings AlertMessage="${monitorId}.AlertMessage">
          <AlertOnState>Warning</AlertOnState>
          <AutoResolve>true</AutoResolve>
          <AlertPriority>Normal</AlertPriority>
          <AlertSeverity>Error</AlertSeverity>
          <AlertParameters>
            <AlertParameter1>$Data/Context/Property[@Name='Name']$</AlertParameter1>
            <AlertParameter2>$Target/Host/Property[Type="Windows!Microsoft.Windows.Computer"]/PrincipalName$</AlertParameter2>
          </AlertParameters>
        </AlertSettings>
        <OperationalStates>
          <OperationalState ID="Running" MonitorTypeStateID="Running" HealthState="Success" />
          <OperationalState ID="NotRunning" MonitorTypeStateID="NotRunning" HealthState="Warning" />
        </OperationalStates>
        <Configuration>
          <ComputerName />
          <ServiceName>${serviceName}</ServiceName>
          <CheckStartupType />
        </Configuration>
      </UnitMonitor>`;
    }

    generatePerformanceMonitor(config) {
        return '      <!-- Performance Monitor not yet implemented -->';
    }

    generateEventLogMonitor(config) {
        return '      <!-- Event Log Monitor not yet implemented -->';
    }

    generateScriptMonitor(config) {
        return '      <!-- Script Monitor not yet implemented -->';
    }

    generatePortMonitor(config) {
        return '      <!-- Port Monitor not yet implemented -->';
    }

    generateRegistryMonitor(config) {
        return '      <!-- Registry Monitor not yet implemented -->';
    }

    generateRulesSection() {
        const rules = [];
        
        if (this.mpData.selectedComponents.rules && this.mpData.selectedComponents.rules.length > 0) {
            this.mpData.selectedComponents.rules.forEach(ruleType => {
                const fragment = this.fragmentLibrary[ruleType];
                if (fragment && fragment.template) {
                    const processedRule = this.processFragmentTemplate(ruleType, fragment.template);
                    if (processedRule && processedRule.trim()) {
                        rules.push(processedRule);
                    }
                }
            });
        }
        
        return rules.join('\n');
    }

    generatePresentationSection() {
        let stringResources = [];

        // Add string resources for monitors that generate alerts
        if (this.mpData.selectedComponents.monitors && this.mpData.selectedComponents.monitors.includes('service-monitor')) {
            const { companyId, appName } = this.mpData.basicInfo;
            const monitorId = `${companyId}.${appName}.Service.Monitor`;
            
            stringResources.push(`      <StringResource ID="${monitorId}.AlertMessage">
        <Text>The service {0} is not running on computer {1}.</Text>
      </StringResource>`);
        }

        if (stringResources.length > 0) {
            return `    <StringResources>
${stringResources.join('\n')}
    </StringResources>`;
        }

        return '';
    }

    showOutput(content, title) {
        const outputArea = document.getElementById('output-area');
        if (!outputArea) return;
        
        const outputHeader = outputArea.querySelector('.output-header h3');
        const outputCode = outputArea.querySelector('#mp-output code');
        
        if (outputHeader) {
            outputHeader.textContent = title;
        }
        if (outputCode) {
            outputCode.textContent = content;
        }
        if (outputArea) {
            outputArea.style.display = 'block';
            outputArea.scrollIntoView({ behavior: 'smooth' });
        }
    }

    generateMP() {
        this.saveBasicInfo();
        
        if (!this.mpData.basicInfo.companyId || !this.mpData.basicInfo.appName) {
            alert('Please fill out the Company ID and Application Name in step 1 before generating.');
            return;
        }

        try {
            this.saveConfigurationData();
            const mpXml = this.generateMPXML();
            
            if (mpXml && mpXml.trim()) {
                const filename = `${this.mpData.basicInfo.companyId}.${this.mpData.basicInfo.appName}.xml`;
                this.downloadFile(mpXml, filename, 'text/xml');
            } else {
                alert('Error generating Management Pack XML. Please check your selections.');
            }
        } catch (error) {
            console.error('Error generating MP:', error);
            alert('Error generating Management Pack: ' + error.message);
        }
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    startOver() {
        if (confirm('Are you sure you want to start over? All your progress will be lost.')) {
            this.currentStep = 1;
            this.mpData = {
                basicInfo: {},
                selectedComponents: {
                    discovery: null,
                    monitors: [],
                    rules: [],
                    groups: [],
                    tasks: [],
                    views: []
                },
                configurations: {}
            };
            
            document.querySelectorAll('input, select, textarea').forEach(field => {
                field.value = '';
            });
            
            document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            document.querySelectorAll('.component-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            const outputArea = document.getElementById('output-area');
            if (outputArea) {
                outputArea.style.display = 'none';
            }
            
            this.updateStepDisplay();
        }
    }
}

// Update download button states based on management group name
function updateDownloadButtons() {
    // Check if all required fields are filled
    let allRequiredFieldsFilled = true;
    
    // Check basic info
    if (!mpCreator || !mpCreator.mpData.basicInfo.companyId || !mpCreator.mpData.basicInfo.appName) {
        allRequiredFieldsFilled = false;
    }
    
    // Check all required fields in config forms
    if (allRequiredFieldsFilled) {
        const requiredInputs = document.querySelectorAll('#component-configs input[required], #component-configs select[required], #component-configs textarea[required]');
        requiredInputs.forEach(input => {
            if (!input.value || !input.value.trim()) {
                allRequiredFieldsFilled = false;
            }
        });
    }
    
    // Get all download-related buttons
    const downloadButtons = document.querySelectorAll('#download-btn-header, #download-btn-footer');
    
    downloadButtons.forEach(downloadButton => {
        if (downloadButton) {
            if (allRequiredFieldsFilled) {
                // Enable download button
                downloadButton.disabled = false;
                downloadButton.classList.remove('btn--disabled');
                downloadButton.style.opacity = '1';
                downloadButton.style.cursor = 'pointer';
            } else {
                // Disable download button (make it gray)
                downloadButton.disabled = true;
                downloadButton.classList.add('btn--disabled');
                downloadButton.style.opacity = '0.5';
                downloadButton.style.cursor = 'not-allowed';
            }
        }
    });
}

// Global functions
let mpCreator;
let isDownloading = false; // Guard to prevent multiple simultaneous downloads

function nextStep() {
    mpCreator.nextStep();
}

function prevStep() {
    mpCreator.prevStep();
}

function previewMP() {
    if (!mpCreator) {
        alert('MP Creator not initialized');
        return;
    }
    mpCreator.previewMP();
}

function generateMP() {
    if (!mpCreator) {
        alert('MP Creator not initialized');
        return;
    }
    mpCreator.generateMP();
}

function downloadPackage() {
    // Prevent multiple simultaneous downloads
    if (isDownloading) {
        return;
    }
    
    if (!mpCreator) {
        alert('MP Creator not initialized');
        return;
    }
    
    mpCreator.saveBasicInfo();
    
    if (!mpCreator.mpData.basicInfo.companyId || !mpCreator.mpData.basicInfo.appName) {
        alert('Please fill out the Company ID and Application Name in step 1 before downloading.');
        return;
    }

    try {
        isDownloading = true;
        mpCreator.saveConfigurationData();
        const mpXml = mpCreator.generateMPXML();
        const { companyId, appName } = mpCreator.mpData.basicInfo;
        
        if (!mpXml || !mpXml.trim()) {
            alert('Error generating Management Pack XML. Please check your selections.');
            isDownloading = false;
            return;
        }
        
        // Download the XML file
        mpCreator.downloadFile(mpXml, `${companyId}.${appName}.xml`, 'text/xml');
        
        // Reset the guard after download completes
        setTimeout(() => {
            isDownloading = false;
        }, 500);
        
    } catch (error) {
        console.error('Error downloading package:', error);
        alert('Error downloading package: ' + error.message);
        isDownloading = false;
    }
}

function copyToClipboard() {
    const output = document.querySelector('#mp-output code');
    if (output) {
        navigator.clipboard.writeText(output.textContent).then(() => {
            const button = event.target.closest('button');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            button.style.background = '#10b981';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
        });
    }
}

function startOver() {
    mpCreator.startOver();
}

// Initialize MP Creator when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    mpCreator = new MPCreator();
});
