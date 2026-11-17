/* Integration Studio — built-in templates and training samples.
 * Exposed as window.__BUILTIN__. Plain ES2020, no modules.
 * Templates use String.raw so no backtick or ${ may appear inside.
 */
(function () {
  'use strict';

  var templates = {};

  // Shared SI_RESOURCES export/import XML (single line in the real file).
  var EXPORT_XML = String.raw`<?xml version="1.0" encoding="UTF-8"?><SI_RESOURCES xmlns="http://www.stercomm.com/SI/SI_IE_Resources" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" GISVersion="6100" FrameworkVersion="2"><BPDEFS><BPDEF><LangResource>SIB64ENCODE{{BP_B64}}</LangResource><ConfigResource><ConfDescription>{{CONF_DESC}}</ConfDescription><ConfProcessName>{{BP_NAME}}</ConfProcessName><ConfWFDID>{{WFD_ID}}</ConfWFDID><ConfWFDVersion>{{VERSION}}</ConfWFDVersion><OBJECT_VERSION>{{VERSION}}</OBJECT_VERSION><SIResourceDefaultVersion>true</SIResourceDefaultVersion><ConfPersist>0</ConfPersist><ConfLifeSpan>-1</ConfLifeSpan><ConfExpedite>false</ConfExpedite><ConfRemoval>0</ConfRemoval><ConfDocStorage>4</ConfDocStorage><ConfPriority>4</ConfPriority><ConfRecoveryLevel>3</ConfRecoveryLevel><ConfSoftstopRecoveryLevel>103</ConfSoftstopRecoveryLevel><ConfOnfaultFlag>false</ConfOnfaultFlag><ConfStatus>1</ConfStatus><ConfLastUsed>{{LAST_USED}}</ConfLastUsed><ConfEncoding>None</ConfEncoding><ConfType>1</ConfType><ConfDocTracking>false</ConfDocTracking><ConfDeadLineInterval>-1</ConfDeadLineInterval><ConfFirstNotifyInterval>-1</ConfFirstNotifyInterval><ConfSecondNotifyInterval>-1</ConfSecondNotifyInterval><ConfEventLevel>2</ConfEventLevel><ConfCategory></ConfCategory><ConfPreferredNode></ConfPreferredNode><ConfMandatoryNode></ConfMandatoryNode><ConfRoleNode></ConfRoleNode><ConfTransaction>false</ConfTransaction><ConfCommitOnError>true</ConfCommitOnError></ConfigResource></BPDEF></BPDEFS></SI_RESOURCES>`;

  // ---- MB -> FS : XSLT-only RULEID regenerator ---------------------------
  // Produces a single RULEID block. No BPML / import XML is generated.
  templates.MBFS = {
    xslt: String.raw`<RULEID name="{{RuleId}}">
		<process_info>
			<ProcessName>{{ProcessName}}</ProcessName>
			<MailboxPath>{{MailboxPath}}</MailboxPath>
			<MessageNamePattern>{{MessageNamePattern}}</MessageNamePattern>
			<InboundFileExtn>{{InboundFileExtn}}</InboundFileExtn>
			<DeleteMail>{{DeleteMail}}</DeleteMail>
			<ArchiveFlag>{{ArchiveFlag}}</ArchiveFlag>
			<ArchiveFolder>{{ArchiveFolder}}</ArchiveFolder>
			<PGPUnPackFlag>{{PGPUnPackFlag}}</PGPUnPackFlag>
			<KeyMapName>{{KeyMapName}}</KeyMapName>
			<TimeStampFlag>{{TimeStampFlag}}</TimeStampFlag>
			<PGPPackFlag>{{PGPPackFlag}}</PGPPackFlag>
			<public_user>{{public_user}}</public_user>
			<TargetFolder>{{TargetFolder}}</TargetFolder>
			<TargetFileName>{{TargetFileName}}</TargetFileName>
			<TargetFileExtn>{{TargetFileExtn}}</TargetFileExtn>
			<TargetFileCheck>{{TargetFileCheck}}</TargetFileCheck>
		</process_info>
		<mail_info>
			<MailFlag>{{MailFlag}}</MailFlag>
			<SendArchiveInfo>{{SendArchiveInfo}}</SendArchiveInfo>
			<MailFormat>{{MailFormat}}</MailFormat>
			<mail-mime-sender>{{MailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{MailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{MailCc}}</mail-mime-cc>
			<mail-mime-subject>{{MailSubject}}</mail-mime-subject>
			<MailName>{{MailName}}</MailName>
		</mail_info>
	</RULEID>`
  };

  // ---- SFTP -> FS : Business Process + three config blocks ---------------
  templates.SFTPFS = {
    bp: String.raw`<!--*******************************************************************************************************
Business Object Name        : {{BP_NAME}}
Business Object Description : {{DESCRIPTION}}
Business Object Requirements: Modify {{GENERIC_BP}}_Config.xslt to configure Transaction.

History:                    Author           Date          Description 
Initial Version             {{AUTHOR}}      {{DATE}}      initial version

Copyright 2026 - Southern California Edison

*******************************************************************************************************-->

<process name="{{BP_NAME}}">
  <sequence name="Main">
    <operation name="processid">
      <participant name="BPMetaDataInfoService"/>
      <output message="BPMetaDataServiceTypeInputMessage">
        <assign to="." from="*"></assign>
      </output>
      <input message="inmsg">
        <assign to="ProcessID" from="/inmsg/BPDATA/WORKFLOW_ID/text()"></assign>
      </input>
    </operation>

    <assign name="Assign" to="ProcessName">{{BP_NAME}}</assign>
     <assign name="Assign" to="MailName">{{BP_NAME}}</assign>
    <assign name="Assign" to="SystemName">{{SystemName}}</assign>
    <operation name="Get Files">
      <participant name="InlineInvokeBusinessProcessService"/>
      <output message="InvokeBusinessProcessServiceTypeInputMessage">
        <assign to="WFD_NAME">{{GENERIC_BP}}</assign>
        <assign to="." from="*"></assign>
      </output>
      <input message="inmsg">
        <assign to="." from="*"></assign>
      </input>
    </operation>

    <onFault>
      <sequence name="Sequence Start">
        <spawn name="Spawn" ref="{{ERROR_BP}}"/>

      </sequence>
    </onFault>
  </sequence>
</process>`,

    // Same single-line SI_RESOURCES export (base64 of the BP).
    export: EXPORT_XML,

    // Three XSLT configuration blocks, one wizard step each.
    xsltList: [
      {
        key: 'config',
        label: 'SFTP Get config',
        file: '_SFTPGet_Config.txt',
        tpl: String.raw`<SYSTEM name="{{SystemName}}">
		<process_info>
			<beginsession>
				<ProfileId>{{ProfileId}}</ProfileId>
				<SFTPClientAdapterName>{{SFTPClientAdapterName}}</SFTPClientAdapterName>
			</beginsession>
			<changedir>
				<Directory>{{Directory}}</Directory>
			</changedir>
			<RemoteFileName>{{RemoteFileName}}</RemoteFileName>									
			<DeleteRemoteFile>{{DeleteRemoteFile}}</DeleteRemoteFile>
			<ArchiveFlag>{{ArchiveFlag}}</ArchiveFlag>
			<AddArchiveTimeStamp>{{AddArchiveTimeStamp}}</AddArchiveTimeStamp>
			<ArchivePath>{{ArchivePath}}</ArchivePath> 
			<InboundFileExtn>{{InboundFileExtn}}</InboundFileExtn>
			<PGPUnPackFlag>{{PGPUnPackFlag}}</PGPUnPackFlag>
			<PGPExtn>{{PGPExtn}}</PGPExtn>
			<KeyMapName>{{KeyMapName}}</KeyMapName>
			<FileDestinationName>{{FileDestinationName}}</FileDestinationName>
			<AddTargetTimeStamp>{{AddTargetTimeStamp}}</AddTargetTimeStamp>
			<TargetFileName>{{TargetFileName}}</TargetFileName>
			<TargetFileCheck>{{TargetFileCheck}}</TargetFileCheck>
			<TargetFileExtn>{{TargetFileExtn}}</TargetFileExtn>
			<TargetFilePath>{{TargetFilePath}}</TargetFilePath>
			<ExtractableCount>{{ExtractableCount}}</ExtractableCount>
			<SendEmail>{{SendEmail}}</SendEmail>
			<SendArchiveInfo>{{SendArchiveInfo}}</SendArchiveInfo>
 		</process_info>
</SYSTEM>`
      },
      {
        key: 'errormail',
        label: 'Error e-mail',
        file: '_Error_Email.txt',
        tpl: String.raw`<ERRORMAIL name="{{ProcessName}}">
		<email_info>
			<mail-format>{{ErrMailFormat}}</mail-format>
			<mail-mime-sender>{{ErrMailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{ErrMailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{ErrMailCc}}</mail-mime-cc>
			<mail-mime-subject>{{ErrMailSubject}}</mail-mime-subject>
		</email_info>
</ERRORMAIL>`
      },
      {
        key: 'email',
        label: 'Success e-mail',
        file: '_Email_Config.txt',
        tpl: String.raw`<PROCNAME name="{{ProcessName}}">
		<EMailNotificationXSLT>{{EMailNotificationXSLT}}</EMailNotificationXSLT>
		<mail_info>
			<MailFlag>{{MailFlag}}</MailFlag>
			<SendArchiveInfo>{{EmailSendArchiveInfo}}</SendArchiveInfo>
			<MailFormat>{{MailFormat}}</MailFormat>
			<mail-mime-sender>{{MailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{MailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{MailCc}}</mail-mime-cc>
			<mail-mime-subject>{{MailSubject}}</mail-mime-subject>
		</mail_info>
		</PROCNAME>`
      }
    ]
  };

  // Interface definitions. MB -> FS removed; will be rebuilt.
  var IFACES = {
    MBFS: {
      id: 'MBFS', title: 'MB \u2192 FS',
      desc: 'Generate the RULEID XSLT block only (no BPML / import XML).',
      dynamicDefault: false,
      xsltOnly: true,
      steps: ['XSLT fields', 'Review']
    },
    FSMB: {
      id: 'FSMB', title: 'FS \u2192 MB',
      desc: 'File system to mailbox.', dynamicDefault: false,
      steps: ['Details', 'XSLT fields', 'Review']
    },
    MBMB: {
      id: 'MBMB', title: 'MB \u2192 MB',
      desc: 'Mailbox to mailbox.', dynamicDefault: false,
      steps: ['Details', 'XSLT fields', 'Review']
    },
    FSFS: {
      id: 'FSFS', title: 'FS \u2192 FS',
      desc: 'File system to file system.', dynamicDefault: false,
      steps: ['Details', 'XSLT fields', 'Review']
    },
    SFTPFS: {
      id: 'SFTPFS', title: 'SFTP \u2192 FS',
      desc: 'Pull files from an SFTP server and deliver to the file system (3 config blocks).',
      dynamicDefault: false,
      steps: ['Details', 'SFTP Get config', 'Error e-mail', 'Success e-mail', 'Review'],
      bpDefaults: {
        genericBp: 'SCE_Generic_SFTPGet',
        errorBp: 'SCE_Generic_EMailOnError',
        wfdId: ''
      }
    }
  };

  // Reserved tokens are filled by the app; everything else becomes a field.
  var RESERVED = [
    'BP_NAME', 'DESCRIPTION', 'GENERIC_BP', 'ERROR_BP', 'AUTHOR', 'DATE',
    'DATE_VAR', 'DATE_FORMAT', 'SOURCE_MAILBOX_ASSIGN', 'BP_B64', 'CONF_DESC',
    'WFD_ID', 'VERSION', 'LAST_USED', 'ProcessName', 'MailboxPath'
  ];

  // Tokens rendered as Yes/No toggles.
  var YN = [
    'PGPFlag', 'ArchiveFlag', 'AddArchiveTimestamp', 'ConstantTargetFileName',
    'UnixToWindowsConversion', 'WindowsToUnixConversion', 'TargetFileCheck',
    'AddTargetTimestamp', 'TriggerBPAtEndInParent', 'TriggerBPAtEndInChild',
    'SendSuccessEmail',
    // MB -> FS (RULEID application form)
    'DeleteMail', 'TimeStampFlag', 'PGPPackFlag',
    // SFTP -> FS
    'DeleteRemoteFile', 'AddArchiveTimeStamp', 'PGPUnPackFlag',
    'AddTargetTimeStamp', 'SendEmail', 'MailFlag'
  ];

  // Logical grouping of XSLT fields in the form.
  var GROUPS = {
    // MB -> FS (RULEID application form) — shown first
    'Rule': ['RuleId', 'ProcessName', 'MailboxPath', 'MessageNamePattern',
      'InboundFileExtn', 'DeleteMail'],
    'MB-FS options': ['ArchiveFlag', 'ArchiveFolder', 'PGPUnPackFlag', 'KeyMapName',
      'TimeStampFlag', 'PGPPackFlag', 'public_user'],
    'MB-FS target': ['TargetFolder', 'TargetFileName', 'TargetFileExtn', 'TargetFileCheck'],
    'MB-FS mail': ['MailFlag', 'SendArchiveInfo', 'MailFormat', 'MailSender',
      'MailRecipient', 'MailCc', 'MailSubject', 'MailName'],
    'Message': ['MessageNamePattern'],
    'PGP': ['PGPFlag', 'PGPExtn', 'KeyMapName'],
    'Archive': ['ArchiveFlag', 'AddArchiveTimestamp', 'ArchiveFolder'],
    'Target file': ['ConstantTargetFileName', 'PredefinedTargetFilenameWithExtn',
      'UnixToWindowsConversion', 'WindowsToUnixConversion', 'TargetFileCheck',
      'AddTargetTimestamp', 'TargetTimestampFormat', 'TimestampSeparator'],
    'Target folders': ['FirstTargetFolder', 'SecondTargetFolder', 'ThirdTargetFolder'],
    'Command line (CLA)': ['NoofCLACommands', 'CLACommand'],
    'Triggers': ['DeleteTriggerFile', 'TriggerFileName', 'TriggerBPAtEndInParent',
      'ParentTriggerBPName', 'TriggerBPAtEndInChild', 'ChildTriggerBPName'],
    'Notification': ['SendSuccessEmail', 'MailName'],
    // SFTP -> FS groupings
    'SFTP session': ['SystemName', 'ProfileId', 'SFTPClientAdapterName', 'Directory',
      'RemoteFileName', 'DeleteRemoteFile'],
    'SFTP archive': ['ArchiveFlag', 'AddArchiveTimeStamp', 'ArchivePath', 'InboundFileExtn'],
    'SFTP PGP': ['PGPUnPackFlag', 'PGPExtn', 'KeyMapName'],
    'SFTP target': ['FileDestinationName', 'AddTargetTimeStamp', 'TargetFileName',
      'TargetFileCheck', 'TargetFileExtn', 'TargetFilePath', 'ExtractableCount',
      'SendEmail', 'SendArchiveInfo'],
    'Error e-mail': ['ErrMailFormat', 'ErrMailSender', 'ErrMailRecipient',
      'ErrMailCc', 'ErrMailSubject'],
    'Success e-mail': ['EMailNotificationXSLT', 'MailFlag', 'EmailSendArchiveInfo',
      'MailFormat', 'MailSender', 'MailRecipient', 'MailCc', 'MailSubject']
  };

  // Default values for XSLT tokens.
  var DEFAULTS = {
    MessageNamePattern: '*.csv',
    PGPFlag: 'No', PGPExtn: '', KeyMapName: '',
    ArchiveFlag: 'No', AddArchiveTimestamp: 'No', ArchiveFolder: '',
    ConstantTargetFileName: 'No', PredefinedTargetFilenameWithExtn: '',
    UnixToWindowsConversion: 'No', WindowsToUnixConversion: 'No',
    TargetFileCheck: 'No', AddTargetTimestamp: 'No',
    TargetTimestampFormat: '', TimestampSeparator: '',
    FirstTargetFolder: '', SecondTargetFolder: '', ThirdTargetFolder: '',
    NoofCLACommands: '0', CLACommand: '',
    DeleteTriggerFile: '', TriggerFileName: '',
    TriggerBPAtEndInParent: 'No', ParentTriggerBPName: '',
    TriggerBPAtEndInChild: 'No', ChildTriggerBPName: '',
    SendSuccessEmail: 'No', MailName: '',
    // MB -> FS (RULEID application form) defaults
    RuleId: '', DeleteMail: 'Yes', TimeStampFlag: 'No', PGPPackFlag: 'No',
    public_user: '', TargetFolder: '',
    // SFTP -> FS defaults
    SystemName: '', ProfileId: '',
    SFTPClientAdapterName: 'SCE_SFTP_CLIENT_DMZ1_GROUP',
    Directory: '', RemoteFileName: '', DeleteRemoteFile: 'Yes',
    AddArchiveTimeStamp: 'No', ArchivePath: '', InboundFileExtn: 'unknown',
    PGPUnPackFlag: 'No', FileDestinationName: 'FS', AddTargetTimeStamp: 'No',
    TargetFileName: 'unknown', TargetFileExtn: 'unknown', TargetFilePath: '',
    ExtractableCount: '', SendEmail: 'No', SendArchiveInfo: '',
    ErrMailFormat: 'HTML', ErrMailSender: 'scemftprod@sce.com',
    ErrMailRecipient: 'ManagedServicesMFTSupport@sce.com', ErrMailCc: '',
    ErrMailSubject: '',
    EMailNotificationXSLT: 'SCE_Generic_SFTPGet_SuccessEmailBodyWithArchiveInf',
    MailFlag: 'No', EmailSendArchiveInfo: '', MailFormat: 'TEXT',
    MailSender: 'scemftprod@sce.com', MailRecipient: 'scemftprod@sce.com',
    MailCc: '', MailSubject: ''
  };

  // Short hints shown under some fields.
  var HINT = {
    MessageNamePattern: 'File pattern to collect, e.g. *.csv',
    FirstTargetFolder: 'Primary delivery folder on the file system.',
    NoofCLACommands: 'Number of command-line commands (0 = none).',
    SystemName: 'SYSTEM name in the config XSLT. Defaults to the BP name without the SCE_SFTPGET_ prefix.',
    ProfileId: 'SFTP trading-partner / profile id on the SFTP client adapter.',
    SFTPClientAdapterName: 'Name of the SFTP Client adapter / adapter group.',
    Directory: 'Remote directory to change into on the SFTP server.',
    RemoteFileName: 'Remote file pattern to pick up, e.g. sce_*.zip',
    TargetFilePath: 'Destination folder on the file system (NAS).',
    ErrMailSubject: 'Defaults to "<BP name> - Failed".',
    MailSubject: 'Defaults to the BP name.',
    RuleId: 'Unique RULEID identifier for the rule (leave blank to omit).',
    public_user: 'PGP public key / user id used when PGPPackFlag is Yes.',
    TargetFolder: 'Destination folder on the file system for the delivered file.',
    InboundFileExtn: 'Inbound file extension, e.g. .csv'
  };

  // Training samples: five PROCNAME blocks from the user's generic XSLT.
  var SAMPLES = [
    {
      name: 'SCE_IB_ML_ENS_ECMWF_1km_From_HPCC_TSYL_To_WDSP_Palantir_00z',
      cycle: '00z', product: 'station_ecmwf'
    },
    {
      name: 'SCE_IB_ML_ENS_ECMWF_1km_From_HPCC_TSYL_To_WDSP_Palantir_12z',
      cycle: '12z', product: 'station_ecmwf'
    },
    {
      name: 'SCE_IB_ML_ENS_ECMWF_GFS_1km_From_HPCC_TSYL_To_WDSP_Palantir_00z',
      cycle: '00z', product: 'station_ecmwf_gfs'
    },
    {
      name: 'SCE_IB_ML_ENS_ECMWF_GFS_1km_From_HPCC_TSYL_To_WDSP_Palantir_12z',
      cycle: '12z', product: 'station_ecmwf_gfs'
    },
    {
      name: 'SCE_IB_ML_ENS_GFS_1km_From_HPCC_TSYL_To_WDSP_Palantir_00z',
      cycle: '00z', product: 'station_gfs'
    }
  ];

  window.__BUILTIN__ = {
    templates: templates,
    IFACES: IFACES,
    RESERVED: RESERVED,
    YN: YN,
    GROUPS: GROUPS,
    DEFAULTS: DEFAULTS,
    HINT: HINT,
    SAMPLES: SAMPLES
  };
})();
