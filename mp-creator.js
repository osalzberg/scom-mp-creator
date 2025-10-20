// MP Creator JavaScript - Clean Version
class MPCreator {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
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
        this.fragmentLibrary = {};
        
        this.loadFragmentLibrary();
        this.initializeEventListeners();
        
        // Initialize progress line on page load
        setTimeout(() => {
            this.updateProgressLine();
        }, 100);
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
    <Monitors>
      <UnitMonitor ID="##CompanyID##.##AppName##.##UniqueID##.AvailabilityMonitor" Accessibility="Public" Enabled="true" Target="##CompanyID##.##AppName##.##UniqueID##.Class" ParentMonitorID="Health!System.Health.AvailabilityState" Remotable="true" Priority="Normal" TypeID="Windows!Microsoft.Windows.CheckNTServiceStateMonitorType" ConfirmDelivery="false">
        <Category>AvailabilityHealth</Category>
        <AlertSettings AlertMessage="##CompanyID##.##AppName##.##UniqueID##.AvailabilityMonitor.AlertMessage">
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
          <ServiceName>W3SVC</ServiceName>
          <CheckStartupType />
        </Configuration>
      </UnitMonitor>
    </Monitors>
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
        <DisplayString ElementID="##CompanyID##.##AppName##.##UniqueID##.AvailabilityMonitor">
          <Name>##CompanyID## ##AppName## ##UniqueID## Availability Monitor</Name>
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
                template: 'Class.And.Discovery.Registry.Value.mpx',
                fields: [
                    { id: 'regKeyPath', label: 'Registry Key Path', type: 'text', required: true, placeholder: 'SOFTWARE\\MyCompany\\MyApplication' },
                    { id: 'valueName', label: 'Value Name', type: 'text', required: true, placeholder: 'Version' },
                    { id: 'expectedValue', label: 'Expected Value', type: 'text', required: false, placeholder: 'Leave empty to check if value exists' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'wmi-query': {
                name: 'WMI Query Discovery',
                template: 'Class.And.Discovery.WMI.Query.mpx',
                fields: [
                    { id: 'wmiQuery', label: 'WMI Query', type: 'textarea', required: true, placeholder: 'SELECT * FROM Win32_Service WHERE Name = "YourService"' },
                    { id: 'namespace', label: 'WMI Namespace', type: 'text', required: false, placeholder: 'root\\cimv2', value: 'root\\cimv2' },
                    { id: 'targetClass', label: 'Target Class', type: 'select', options: ['Windows!Microsoft.Windows.Server.OperatingSystem', 'Windows!Microsoft.Windows.Computer'], value: 'Windows!Microsoft.Windows.Server.OperatingSystem' }
                ]
            },
            'service-discovery': {
                name: 'Service Discovery',
                template: 'Class.And.Discovery.Service.mpx',
                fields: [
                    { id: 'serviceName', label: 'Service Name', type: 'text', required: true, placeholder: 'W3SVC' },
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
                template: 'Monitor.Service.WithAlert.mpx',
                fields: [
                    { id: 'serviceName', label: 'Service Name', type: 'text', required: true, placeholder: 'W3SVC' },
                    { id: 'alertPriority', label: 'Alert Priority', type: 'select', options: ['Low', 'Normal', 'High'], value: 'Normal' },
                    { id: 'alertSeverity', label: 'Alert Severity', type: 'select', options: ['Information', 'Warning', 'Error'], value: 'Error' }
                ]
            },
            'service-monitor-no-alert': {
                name: 'Service Monitor (No Alert)',
                template: 'Monitor.Service.NoAlert.mpx',
                fields: [
                    { id: 'serviceName', label: 'Service Name', type: 'text', required: true, placeholder: 'W3SVC' }
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
            'performance-monitor-multi-instance': {
                name: 'Performance Monitor (Multi-Instance)',
                template: 'Monitor.Performance.MultiInstance.ConsecSamples.TwoState.mpx',
                fields: [
                    { id: 'objectName', label: 'Performance Object', type: 'text', required: true, placeholder: 'Process' },
                    { id: 'counterName', label: 'Counter Name', type: 'text', required: true, placeholder: 'Working Set' },
                    { id: 'instanceName', label: 'Instance Filter', type: 'text', required: false, placeholder: '*' },
                    { id: 'frequencySeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'threshold', label: 'Threshold', type: 'number', required: true, placeholder: '100000000' },
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
            'process-performance-monitor': {
                name: 'Process Performance Monitor',
                template: 'Monitor.Process.Performance.ConsecSamples.TwoState.mpx',
                fields: [
                    { id: 'processName', label: 'Process Name', type: 'text', required: true, placeholder: 'w3wp' },
                    { id: 'counterName', label: 'Counter Name', type: 'text', required: true, placeholder: 'Working Set' },
                    { id: 'frequencySeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'threshold', label: 'Threshold', type: 'number', required: true, placeholder: '100000000' },
                    { id: 'samples', label: 'Consecutive Samples', type: 'number', required: true, value: '3' }
                ]
            },
            'port-monitor': {
                name: 'Port Check Monitor',
                template: 'Monitor.PortCheck.mpx',
                fields: [
                    { id: 'portNumber', label: 'Port Number', type: 'number', required: true, placeholder: '80' }
                ]
            },
            'registry-key-monitor': {
                name: 'Registry Key Exists Monitor',
                template: 'Monitor.RegistryKey.Exists.mpx',
                fields: [
                    { id: 'regKeyPath', label: 'Registry Key Path', type: 'text', required: true, placeholder: 'SOFTWARE\\MyCompany\\MyApplication' }
                ]
            },
            'registry-value-monitor': {
                name: 'Registry Value Exists Monitor',
                template: 'Monitor.RegistryValue.Exists.mpx',
                fields: [
                    { id: 'regKeyPath', label: 'Registry Key Path', type: 'text', required: true, placeholder: 'SOFTWARE\\MyCompany\\MyApplication' },
                    { id: 'valueName', label: 'Value Name', type: 'text', required: true, placeholder: 'Version' }
                ]
            },
            'file-age-monitor': {
                name: 'File Age Monitor',
                template: 'Monitor.TimedScript.PowerShell.FileAge.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'folderPath', label: 'Folder Path', type: 'text', required: true, placeholder: 'C:\\Logs' },
                    { id: 'fileExtensionFilter', label: 'File Extension Filter', type: 'text', required: true, placeholder: '*.log,*.txt' },
                    { id: 'fileAgeThresholdMinutes', label: 'File Age Threshold (minutes)', type: 'number', required: true, value: '60' },
                    { id: 'fileCountThreshold', label: 'File Count Threshold', type: 'number', required: true, value: '1' }
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
            'folder-last-write-monitor': {
                name: 'Folder Last Write Time Monitor',
                template: 'Monitor.TimedScript.PowerShell.FolderLastWriteTimeOlderThanThreshold.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'folderPath', label: 'Folder Path', type: 'text', required: true, placeholder: 'C:\\Logs' },
                    { id: 'thresholdMinutes', label: 'Threshold (minutes)', type: 'number', required: true, value: '60' }
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
            'sql-query-monitor': {
                name: 'SQL Query Monitor',
                template: 'Monitor.TimedScript.PowerShell.SQLQuery.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'sqlServer', label: 'SQL Server', type: 'text', required: true, placeholder: 'server.domain.com' },
                    { id: 'sqlDBName', label: 'Database Name', type: 'text', required: true, placeholder: 'MyDatabase' },
                    { id: 'sqlQuery', label: 'SQL Query', type: 'textarea', required: true, placeholder: 'SELECT COUNT(*) FROM MyTable WHERE Status = "Error"' },
                    { id: 'rowCountThreshold', label: 'Row Count Threshold', type: 'number', required: true, value: '1' }
                ]
            },
            'text-file-parser-monitor': {
                name: 'Text File Parser Monitor',
                template: 'Monitor.TimedScript.PowerShell.ParseTextFile.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'filePath', label: 'File Path', type: 'text', required: true, placeholder: 'C:\\Logs\\application.log' },
                    { id: 'searchString', label: 'Search String', type: 'text', required: true, placeholder: 'ERROR' },
                    { id: 'matchThreshold', label: 'Match Threshold', type: 'number', required: true, value: '1' }
                ]
            },
            'powershell-script-monitor': {
                name: 'PowerShell Script Monitor',
                template: 'Monitor.TimedScript.PowerShell.NoParams.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'scriptBody', label: 'PowerShell Script', type: 'textarea', required: true, placeholder: 'Enter your PowerShell monitoring script here...' }
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
            'vbscript-monitor': {
                name: 'VBScript Monitor',
                template: 'Monitor.TimedScript.VBScript.mpx',
                fields: [
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' },
                    { id: 'scriptBody', label: 'VBScript', type: 'textarea', required: true, placeholder: 'Enter your VBScript monitoring code here...' }
                ]
            },
            'snmp-monitor': {
                name: 'SNMP OID Monitor',
                template: 'Monitor.SNMP.Poll.OIDValue.Integer.Performance.mpx',
                fields: [
                    { id: 'oid', label: 'SNMP OID', type: 'text', required: true, placeholder: '1.3.6.1.2.1.1.3.0' },
                    { id: 'community', label: 'SNMP Community', type: 'text', required: true, value: 'public' },
                    { id: 'port', label: 'SNMP Port', type: 'number', required: true, value: '161' },
                    { id: 'threshold', label: 'Threshold', type: 'number', required: true, placeholder: '90' },
                    { id: 'intervalSeconds', label: 'Check Interval (seconds)', type: 'number', required: true, value: '300' }
                ]
            }
        };
    }

    initializeEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.discovery-card')) {
                this.selectDiscoveryCard(e.target.closest('.discovery-card'));
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
            }
        });

        document.addEventListener('input', (e) => {
            // Auto-save configuration data when any input in config section is typed in
            if (e.target.closest('#component-configs')) {
                this.saveConfigurationData();
            }
        });

        document.addEventListener('blur', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.validateField(e.target);
                
                // Auto-save configuration data when leaving any input in config section
                if (e.target.closest('#component-configs')) {
                    this.saveConfigurationData();
                }
            }
        }, true);
    }

    selectDiscoveryCard(card) {
        document.querySelectorAll('.discovery-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        const discoveryType = card.dataset.discovery;
        this.mpData.selectedComponents.discovery = discoveryType;
        
        const nextBtn = document.getElementById('next-discovery');
        if (nextBtn) {
            nextBtn.disabled = false;
        }
    }

    handleStepNavigation(stepElement) {
        const targetStep = parseInt(stepElement.dataset.step);
        
        // Don't navigate if clicking on the current step
        if (targetStep === this.currentStep) {
            return;
        }
        
        // Allow navigation to any previous step (already completed)
        if (targetStep < this.currentStep) {
            this.currentStep = targetStep;
            this.updateStepDisplay();
            return;
        }
        
        // For forward navigation, validate the current step first
        if (targetStep === this.currentStep + 1) {
            if (this.validateCurrentStep()) {
                this.saveCurrentStepData();
                this.currentStep = targetStep;
                this.updateStepDisplay();
                
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
        
        const step = document.querySelector('.form-step:not([style*="display: none"])');
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
            
            if (!this.mpData.selectedComponents[category].includes(componentType)) {
                this.mpData.selectedComponents[category].push(componentType);
            }
            
            card.classList.add('selected');
        } else {
            if (this.mpData.selectedComponents[category]) {
                const index = this.mpData.selectedComponents[category].indexOf(componentType);
                if (index > -1) {
                    this.mpData.selectedComponents[category].splice(index, 1);
                }
            }
            
            card.classList.remove('selected');
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
            return this.mpData.selectedComponents.discovery !== null;
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

    updateStepDisplay() {
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('active', stepNumber === this.currentStep);
            step.classList.toggle('completed', stepNumber < this.currentStep);
        });
        
        document.querySelectorAll('.form-step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.toggle('active', stepNumber === this.currentStep);
        });

        // Update progress line animation
        this.updateProgressLine();

        this.scrollToCurrentStep();
        
        // Update download buttons if we're on step 6
        if (this.currentStep === 6) {
            setTimeout(() => {
                updateDownloadButtons();
            }, 100);
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
            this.mpData.selectedComponents.monitors.forEach(monitorType => {
                const fragment = this.fragmentLibrary[monitorType];
                if (fragment) {
                    const panel = document.createElement('div');
                    panel.className = 'config-panel';
                    panel.innerHTML = `
                        <h3>
                            <div class="config-panel-icon">
                                <i class="fas fa-heartbeat"></i>
                            </div>
                            Configure ${fragment.name}
                        </h3>
                        <div class="config-grid" id="config-${monitorType}">
                            ${this.generateConfigFields(monitorType, fragment.fields)}
                        </div>
                    `;
                    
                    configContainer.appendChild(panel);
                }
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
            
            return `
                <div class="form-group">
                    <label for="${fieldId}">${field.label}${field.required ? ' *' : ''}</label>
                    ${input}
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
${this.mpData.selectedComponents.monitors?.length > 0 ? `- Monitors: ${this.mpData.selectedComponents.monitors.join(', ')}` : ''}
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
    ${description ? `<Description>${description}</Description>` : ''}
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
        
        console.log('Saving configuration data from', allConfigInputs.length, 'inputs');
        
        allConfigInputs.forEach(input => {
            const id = input.id;
            const value = input.value.trim();
            
            console.log('Processing field:', id, 'with value:', value);
            
            if (id) {
                // Parse the component type and field from the ID
                const parts = id.split('-');
                if (parts.length >= 2) {
                    // Handle component types with hyphens (like 'registry-key')
                    let componentType, fieldName;
                    
                    // Find the original component type by checking against known types
                    const knownComponentTypes = Object.keys(this.fragmentLibrary);
                    const matchingType = knownComponentTypes.find(type => id.startsWith(type + '-'));
                    
                    if (matchingType) {
                        componentType = matchingType;
                        fieldName = id.substring(matchingType.length + 1); // +1 for the hyphen
                    } else {
                        // Fallback to original logic
                        componentType = parts[0];
                        fieldName = parts.slice(1).join('-');
                    }
                    
                    if (!this.mpData.configurations[componentType]) {
                        this.mpData.configurations[componentType] = {};
                    }
                    
                    // Save the value even if it's empty (might be intentional)
                    this.mpData.configurations[componentType][fieldName] = value;
                    
                    console.log('Saved to config:', componentType, fieldName, '=', value);
                }
            }
        });
        
        console.log('Final configuration data:', this.mpData.configurations);
    }

    generateMPXML() {
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
            this.mpData.selectedComponents.monitors.forEach(monitorType => {
                const fragment = this.fragmentLibrary[monitorType];
                if (fragment && fragment.template) {
                    const processedFragment = this.processFragmentTemplate(monitorType, fragment.template);
                    allFragments.push(processedFragment);
                }
            });
        }
        
        // Extract sections from fragments and combine them
        const { typeDefinitions, monitoring, presentation, languagePacks } = this.extractAndCombineSections(allFragments);
        
        // Build references
        let references = this.generateReferences();
        
        return `<?xml version="1.0" encoding="utf-8"?>
<ManagementPack ContentReadable="true" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <Manifest>
    <Identity>
      <ID>${mpId}</ID>
      <Version>${version}</Version>
    </Identity>
    <Name>${mpId}</Name>
    ${description ? `<Description>${description}</Description>` : ''}
    <References>
${references}
    </References>
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
        let typeDefinitions = [];
        let discoveries = [];
        let monitors = [];
        let rules = [];
        let displayStrings = [];
        
        fragments.forEach(fragmentXml => {
            try {
                // Parse the fragment XML
                const parser = new DOMParser();
                const doc = parser.parseFromString(fragmentXml, 'text/xml');
                
                // Extract TypeDefinitions
                const typeDefsNodes = doc.querySelectorAll('TypeDefinitions ClassTypes ClassType');
                typeDefsNodes.forEach(node => {
                    typeDefinitions.push(this.nodeToString(node));
                });
                
                // Extract Discoveries
                const discoveryNodes = doc.querySelectorAll('Monitoring Discoveries Discovery');
                discoveryNodes.forEach(node => {
                    discoveries.push(this.nodeToString(node));
                });
                
                // Extract Monitors
                const monitorNodes = doc.querySelectorAll('Monitoring Monitors UnitMonitor, Monitoring Monitors AggregateMonitor, Monitoring Monitors DependencyMonitor');
                monitorNodes.forEach(node => {
                    monitors.push(this.nodeToString(node));
                });
                
                // Extract Rules
                const ruleNodes = doc.querySelectorAll('Monitoring Rules Rule');
                ruleNodes.forEach(node => {
                    rules.push(this.nodeToString(node));
                });
                
                // Extract Display Strings
                const displayStringNodes = doc.querySelectorAll('LanguagePacks LanguagePack DisplayStrings DisplayString');
                displayStringNodes.forEach(node => {
                    displayStrings.push(this.nodeToString(node));
                });
                
            } catch (error) {
                console.error('Error parsing fragment XML:', error);
            }
        });
        
        // Build combined sections
        let combinedTypeDefinitions = '';
        if (typeDefinitions.length > 0) {
            combinedTypeDefinitions = `    <EntityTypes>
      <ClassTypes>
${typeDefinitions.map(def => '        ' + def).join('\n')}
      </ClassTypes>
    </EntityTypes>`;
        }
        
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
        
        // Generate StringResource elements for monitors with AlertMessage references
        let stringResources = [];
        monitors.forEach(monitorXml => {
            // Look for AlertMessage references in the monitor XML
            const alertMessageMatch = monitorXml.match(/AlertMessage="([^"]+)"/);
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

    processFragmentTemplate(componentType, template) {
        const { companyId, appName } = this.mpData.basicInfo;
        
        // Ensure configuration data is saved before processing
        this.saveConfigurationData();
        
        const config = this.mpData.configurations[componentType] || {};
        
        // Create replacement map with better debugging
        const replacements = {
            '##CompanyID##': companyId,
            '##AppName##': appName,
            '##UniqueID##': config.uniqueId || 'Application',
            '##ClassID##': config.targetClass || config.targetclass || 'Windows!Microsoft.Windows.Server.OperatingSystem',
            '##RegKeyPath##': config.regKeyPath || config.regkeypath || 'SOFTWARE\\MyCompany\\MyApplication',
            '##TargetClass##': config.targetClass || config.targetclass || 'Windows!Microsoft.Windows.Server.OperatingSystem',
            '##ServiceName##': config.serviceName || config.servicename || 'YourService',
            '##WMIQuery##': config.wmiQuery || config.wmiquery || 'SELECT * FROM Win32_Service WHERE Name = "YourService"',
            '##Namespace##': config.namespace || 'root\\cimv2',
            '##ScriptType##': config.scriptType || config.scripttype || 'PowerShell',
            '##ScriptBody##': config.scriptBody || config.scriptbody || '# Enter your script here',
            '##ValueName##': config.valueName || config.valuename || '',
            '##ExpectedValue##': config.expectedValue || config.expectedvalue || '',
            '##AlertPriority##': config.alertPriority || config.alertpriority || 'Normal',
            '##AlertSeverity##': config.alertSeverity || config.alertseverity || 'Error',
            '##ObjectName##': config.objectName || config.counterObject || config.counterobject || 'Processor',
            '##CounterName##': config.counterName || config.countername || '% Processor Time',
            '##CounterObject##': config.counterObject || config.counterobject || 'Processor',
            '##InstanceName##': config.instanceName || config.instance || '_Total',
            '##Instance##': config.instanceName || config.instance || '_Total',
            '##FrequencySeconds##': config.frequencySeconds || config.intervalseconds || config.intervalSeconds || '300',
            '##IntervalSeconds##': config.intervalSeconds || config.frequencySeconds || config.intervalseconds || '300',
            '##Threshold##': config.threshold || config.warningThreshold || config.warningthreshold || '80',
            '##WarningThreshold##': config.warningThreshold || config.warningthreshold || '80',
            '##CriticalThreshold##': config.criticalThreshold || config.criticalthreshold || '95',
            '##Samples##': config.samples || '3',
            '##ProcessName##': config.processName || config.processname || 'notepad.exe',
            '##MinProcessCount##': config.minProcessCount || config.minprocesscount || '1',
            '##MaxProcessCount##': config.maxProcessCount || config.maxprocesscount || '10',
            '##MatchCount##': config.matchCount || config.matchcount || '2',
            '##PortNumber##': config.portNumber || config.portnumber || '80',
            '##Protocol##': config.protocol || 'TCP',
            '##Timeout##': config.timeout || '10',
            '##FolderPath##': config.folderPath || config.folderpath || 'C:\\Logs',
            '##FileExtensionFilter##': config.fileExtensionFilter || config.fileextensionfilter || '*.log',
            '##FileNameFilter##': config.fileNameFilter || config.filenamefilter || '*.log',
            '##FileAgeThresholdMinutes##': config.fileAgeThresholdMinutes || config.fileagethresholdminutes || '60',
            '##FileSizeThresholdKB##': config.fileSizeThresholdKB || config.filesizethresholdkb || '1024',
            '##FileCountThreshold##': config.fileCountThreshold || config.filecountthreshold || '1',
            '##UNCPath##': config.uncPath || config.uncpath || '\\\\server\\share',
            '##WarningThresholdPercent##': config.warningThresholdPercent || config.warningthresholdpercent || '20',
            '##CriticalThresholdPercent##': config.criticalThresholdPercent || config.criticalthresholdpercent || '10',
            '##SQLServer##': config.sqlServer || config.sqlserver || 'localhost',
            '##SQLDBName##': config.sqlDBName || config.sqldbname || 'master',
            '##SQLQuery##': config.sqlQuery || config.sqlquery || 'SELECT 1',
            '##RowCountThreshold##': config.rowCountThreshold || config.rowcountthreshold || '1',
            '##FilePath##': config.filePath || config.filepath || 'C:\\Logs\\app.log',
            '##SearchString##': config.searchString || config.searchstring || 'ERROR',
            '##MatchThreshold##': config.matchThreshold || config.matchthreshold || '1',
            '##Param1##': config.param1 || '',
            '##Param2##': config.param2 || '',
            '##ThresholdMinutes##': config.thresholdMinutes || config.thresholdminutes || '60',
            '##ComparisonType##': config.comparisonType || config.comparisontype || 'Greater Than',
            '##OID##': config.oid || '1.3.6.1.2.1.1.3.0',
            '##Community##': config.community || 'public',
            '##Port##': config.port || '161',
            '##ShellCommand##': config.shellCommand || config.shellcommand || 'echo "test"',
            '##LogName##': config.logName || config.logname || 'Application',
            '##EventSource##': config.eventSource || config.eventsource || '',
            '##EventId##': config.eventId || config.eventid || '',
            '##EventLevel##': config.eventLevel || config.eventlevel || 'Error'
        };

        // Debug logging to help identify the issue
        console.log('Configuration for', componentType, ':', config);
        console.log('Registry Key Path value:', config.regKeyPath || config.regkeypath);

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
        // Similar implementation for WMI discovery
        return '    <!-- WMI Discovery not yet implemented -->';
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
        
        this.mpData.selectedComponents.monitors.forEach(monitorType => {
            const config = this.mpData.configurations[monitorType] || {};
            
            switch (monitorType) {
                case 'service-monitor':
                    monitors.push(this.generateServiceMonitor(config));
                    break;
                case 'performance-monitor':
                    monitors.push(this.generatePerformanceMonitor(config));
                    break;
                case 'event-log-monitor':
                    monitors.push(this.generateEventLogMonitor(config));
                    break;
                case 'script-monitor':
                    monitors.push(this.generateScriptMonitor(config));
                    break;
                case 'port-monitor':
                    monitors.push(this.generatePortMonitor(config));
                    break;
                case 'registry-monitor':
                    monitors.push(this.generateRegistryMonitor(config));
                    break;
            }
        });

        if (monitors.length > 0) {
            return `    <Monitors>
${monitors.join('\n')}
    </Monitors>`;
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
        // Implementation for rules section
        return '    <!-- Rules not yet implemented -->';
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
    const managementGroupField = document.getElementById('management-group-name');
    const managementGroupName = managementGroupField ? managementGroupField.value.trim() : '';
    
    // Get all download-related buttons
    const downloadButton = document.querySelector('button[onclick="downloadPackage()"]');
    
    if (downloadButton) {
        if (managementGroupName) {
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
}

// Global functions
let mpCreator;

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
        mpCreator.saveConfigurationData();
        const mpXml = mpCreator.generateMPXML();
        const { companyId, appName } = mpCreator.mpData.basicInfo;
        
        if (!mpXml || !mpXml.trim()) {
            alert('Error generating Management Pack XML. Please check your selections.');
            return;
        }
        
        // Get management group name if provided
        const managementGroupField = document.getElementById('management-group-name');
        const managementGroupName = managementGroupField ? managementGroupField.value.trim() : '';
        
        let deployScript = `# Management Pack Deployment Script
# Generated by SCOM MP Creator

$MPName = "${companyId}.${appName}"
$MPFile = "${companyId}.${appName}.xml"

# Import Operations Manager module
Import-Module OperationsManager`;

        // Add management group connection if specified
        if (managementGroupName) {
            deployScript += `

# Connect to Management Group
Set-SCOMManagementGroup "${managementGroupName}"`;
        }

        deployScript += `

# Import the Management Pack
try {
    Import-SCManagementPack -FullName $MPFile
    Write-Host "Management Pack imported successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error importing Management Pack: $($_.Exception.Message)" -ForegroundColor Red
}`;

        mpCreator.downloadFile(mpXml, `${companyId}.${appName}.xml`, 'text/xml');
        
        setTimeout(() => {
            mpCreator.downloadFile(deployScript, 'Deploy-MP.ps1', 'text/plain');
        }, 500);
        
    } catch (error) {
        console.error('Error downloading package:', error);
        alert('Error downloading package: ' + error.message);
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
