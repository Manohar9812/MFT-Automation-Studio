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

  // ---- FS -> MB : PROCNAME config block (collect from FS, put to mailbox) --
  templates.FSMB = {
    xslt: String.raw`<PROCNAME name="{{ProcessName}}">
		<process_info>
			<CollectionFileName>{{CollectionFileName}}</CollectionFileName>
			<CollectionFileExtn>{{CollectionFileExtn}}</CollectionFileExtn>
			<CollectionFolder>{{CollectionFolder}}</CollectionFolder>
			<ArchiveFlag>{{ArchiveFlag}}</ArchiveFlag>
			<ArchiveTimeStamp>{{ArchiveTimeStamp}}</ArchiveTimeStamp>
			<ArchiveFolder>{{ArchiveFolder}}</ArchiveFolder>
			<PGPPackFlag>{{PGPPackFlag}}</PGPPackFlag>
			<public_user>{{public_user}}</public_user>
			<conv_keymap_name>{{conv_keymap_name}}</conv_keymap_name>
			<secret_keymap_name>{{secret_keymap_name}}</secret_keymap_name>
			<MailBoxFileTimeStamp>{{MailBoxFileTimeStamp}}</MailBoxFileTimeStamp>
			<MailboxPath>{{MailboxPath}}</MailboxPath>
			<MailBoxFileName>{{MailBoxFileName}}</MailBoxFileName>
			<MailBoxFileExtn>{{MailBoxFileExtn}}</MailBoxFileExtn>
			<ExtractableCount>{{ExtractableCount}}</ExtractableCount>
		</process_info>
		<mail_info>
			<SendSuccessMail>{{SendSuccessMail}}</SendSuccessMail>
			<SendArchiveInfo>{{SendArchiveInfo}}</SendArchiveInfo>
			<mail-mime-sender>{{MailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{MailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{MailCc}}</mail-mime-cc>
			<mail-mime-subject>{{MailSubject}}</mail-mime-subject>
			<MailName>{{MailName}}</MailName>
		</mail_info>
</PROCNAME>`
  };

  // ---- FS -> FS : PROCNAME config block (collect from FS, deliver to FS) ---
  templates.FSFS = {
    xslt: String.raw`<PROCNAME name="{{ProcessName}}">
		<process_info>
			<CollectionFileName>{{CollectionFileName}}</CollectionFileName>
			<CollectionFileExtn>{{CollectionFileExtn}}</CollectionFileExtn>
			<CollectionFolder>{{CollectionFolder}}</CollectionFolder>
			<ArchiveFlag>{{ArchiveFlag}}</ArchiveFlag>
			<ArchiveTimeStamp>{{ArchiveTimeStamp}}</ArchiveTimeStamp>
			<ArchiveFolder>{{ArchiveFolder}}</ArchiveFolder>
			<PGPPackFlag>{{PGPPackFlag}}</PGPPackFlag>
			<public_user>{{public_user}}</public_user>
			<PGPPackExtn>{{PGPPackExtn}}</PGPPackExtn>
			<TargetFolder1>{{TargetFolder1}}</TargetFolder1>
			<TargetFolder2>{{TargetFolder2}}</TargetFolder2>
			<TargetFileCheck>{{TargetFileCheck}}</TargetFileCheck>
			<TargetFileTimeStamp>{{TargetFileTimeStamp}}</TargetFileTimeStamp>
			<DeleteSourceFile>{{DeleteSourceFile}}</DeleteSourceFile>
		</process_info>
		<plat_conversion>
			<WindowsToUnix>{{WindowsToUnix}}</WindowsToUnix>
			<UnixToWindows>{{UnixToWindows}}</UnixToWindows>
		</plat_conversion>
		<mail_info>
			<mail-mime-sender>{{MailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{MailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{MailCc}}</mail-mime-cc>
			<MailName>{{MailName}}</MailName>
		</mail_info>
</PROCNAME>`
  };

  // ---- MB -> MB : ROUTERULE block (mailbox to mailbox routing) ------------
  templates.MBMB = {
    xslt: String.raw`<ROUTERULE name="{{RuleName}}">
		<FromMailBox>{{FromMailBox}}</FromMailBox>
		<ToMailBox>{{ToMailBox}}</ToMailBox>
		<ArchiveFlag>{{ArchiveFlag}}</ArchiveFlag>
		<ArchiveInfo>
			<AddArchiveTimeStamp>{{AddArchiveTimeStamp}}</AddArchiveTimeStamp>
			<ArchivePath>{{ArchivePath}}</ArchivePath>
		</ArchiveInfo>
		<TargetFileTimeStamp>{{TargetFileTimeStamp}}</TargetFileTimeStamp>
		<SendEmail>{{SendEmail}}</SendEmail>
		<MailName>{{MailName}}</MailName>
	</ROUTERULE>`
  };

  // ---- FS -> SFTP : PROCNAME config block with SFTP connection info -------
  templates.FSSFTP = {
    xslt: String.raw`<PROCNAME name="{{ProcessName}}">
		<connection_info>
			<beginsession>
				<SFTPClientAdapter>{{SFTPClientAdapter}}</SFTPClientAdapter>
				<ProfileId>{{ProfileId}}</ProfileId>
			</beginsession>
			<changedir>
				<Directory>{{Directory}}</Directory>
			</changedir>
		</connection_info>
		<process_info>
			<FileSourceName>{{FileSourceName}}</FileSourceName>
			<CollectionFileName>{{CollectionFileName}}</CollectionFileName>
			<CollectionFileExtn>{{CollectionFileExtn}}</CollectionFileExtn>
			<CollectionFolder>{{CollectionFolder}}</CollectionFolder>
			<DeleteSourceFile>{{DeleteSourceFile}}</DeleteSourceFile>
			<ArchiveFlag>{{ArchiveFlag}}</ArchiveFlag>
			<ArchiveTimeStamp>{{ArchiveTimeStamp}}</ArchiveTimeStamp>
			<ArchiveFolder>{{ArchiveFolder}}</ArchiveFolder>
			<PGPPackFlag>{{PGPPackFlag}}</PGPPackFlag>
			<useSubFolders>{{useSubFolders}}</useSubFolders>
			<public_user>{{public_user}}</public_user>
			<conv_keymap_name>{{conv_keymap_name}}</conv_keymap_name>
			<AddTargetTimeStamp>{{AddTargetTimeStamp}}</AddTargetTimeStamp>
			<TargetFileName>{{TargetFileName}}</TargetFileName>
			<TargetFileExtn>{{TargetFileExtn}}</TargetFileExtn>
			<DelayBetweenFiles>{{DelayBetweenFiles}}</DelayBetweenFiles>
			<DelayTimeInMS>{{DelayTimeInMS}}</DelayTimeInMS>
			<MailName>{{MailName}}</MailName>
		</process_info>
</PROCNAME>`
  };

  // =====================================================================
  // EDI reusable config blocks (one copy per block-type, prefixed tokens).
  // Each block type appears at most once per EDI interface, so prefixed
  // tokens keep every wizard step independent.
  // =====================================================================

  // ROUTERULE — inbound variant (ToMailBox1).
  var EDI_ROUTERULE_IN = String.raw`<ROUTERULE name="{{rr_name}}">
		<FromMailBox>{{rr_FromMailBox}}</FromMailBox>
		<archive_info>
			<ArchiveFlag>{{rr_ArchiveFlag}}</ArchiveFlag>
			<ArchiveFolder>{{rr_ArchiveFolder}}</ArchiveFolder>
		</archive_info>
		<orgDir_info>
			<FileNameAddition>{{rr_FileNameAddition}}</FileNameAddition>
			<FileNameExtn>{{rr_FileNameExtn}}</FileNameExtn>
		</orgDir_info>
		<destination_info>
			<NewFileName>{{rr_NewFileName}}</NewFileName>
			<ToMailBox1>{{rr_ToMailBox1}}</ToMailBox1>
		</destination_info>
		<mail_info>
			<MailFlag>{{rr_MailFlag}}</MailFlag>
		</mail_info>
		<DeleteMessage>{{rr_DeleteMessage}}</DeleteMessage>
	</ROUTERULE>`;

  // ROUTERULE — outbound variant (ToMailBox2 + ExtractableCount2).
  var EDI_ROUTERULE_OUT = String.raw`<ROUTERULE name="{{rr_name}}">
		<FromMailBox>{{rr_FromMailBox}}</FromMailBox>
		<archive_info>
			<ArchiveFlag>{{rr_ArchiveFlag}}</ArchiveFlag>
			<ArchiveFolder>{{rr_ArchiveFolder}}</ArchiveFolder>
		</archive_info>
		<orgDir_info>
			<FileNameAddition>{{rr_FileNameAddition}}</FileNameAddition>
			<FileNameExtn>{{rr_FileNameExtn}}</FileNameExtn>
		</orgDir_info>
		<destination_info>
			<NewFileName>{{rr_NewFileName}}</NewFileName>
			<ToMailBox2>{{rr_ToMailBox2}}</ToMailBox2>
			<ExtractableCount2>{{rr_ExtractableCount2}}</ExtractableCount2>
		</destination_info>
		<mail_info>
			<MailFlag>{{rr_MailFlag}}</MailFlag>
		</mail_info>
		<DeleteMessage>{{rr_DeleteMessage}}</DeleteMessage>
	</ROUTERULE>`;

  // SYSTEM — SFTP Get config block.
  var EDI_SYSTEM_GET = String.raw`<SYSTEM name="{{sg_SystemName}}">
		<process_info>
			<beginsession>
				<ProfileId>{{sg_ProfileId}}</ProfileId>
				<SFTPClientAdapterName>{{sg_SFTPClientAdapterName}}</SFTPClientAdapterName>
			</beginsession>
			<changedir>
				<Directory>{{sg_Directory}}</Directory>
			</changedir>
			<RemoteFileName>{{sg_RemoteFileName}}</RemoteFileName>
			<DeleteRemoteFile>{{sg_DeleteRemoteFile}}</DeleteRemoteFile>
			<ArchiveFlag>{{sg_ArchiveFlag}}</ArchiveFlag>
			<AddArchiveTimeStamp>{{sg_AddArchiveTimeStamp}}</AddArchiveTimeStamp>
			<ArchivePath>{{sg_ArchivePath}}</ArchivePath>
			<InboundFileExtn>{{sg_InboundFileExtn}}</InboundFileExtn>
			<PGPUnPackFlag>{{sg_PGPUnPackFlag}}</PGPUnPackFlag>
			<PGPExtn>{{sg_PGPExtn}}</PGPExtn>
			<KeyMapName>{{sg_KeyMapName}}</KeyMapName>
			<FileDestinationName>{{sg_FileDestinationName}}</FileDestinationName>
			<AddTargetTimeStamp>{{sg_AddTargetTimeStamp}}</AddTargetTimeStamp>
			<TargetFileName>{{sg_TargetFileName}}</TargetFileName>
			<TargetFileCheck>{{sg_TargetFileCheck}}</TargetFileCheck>
			<TargetFileExtn>{{sg_TargetFileExtn}}</TargetFileExtn>
			<TargetFilePath>{{sg_TargetFilePath}}</TargetFilePath>
			<ExtractableCount>{{sg_ExtractableCount}}</ExtractableCount>
			<SendEmail>{{sg_SendEmail}}</SendEmail>
			<SendArchiveInfo>{{sg_SendArchiveInfo}}</SendArchiveInfo>
		</process_info>
</SYSTEM>`;

  // SYSTEM — SFTP Put connection block (EDI 810/814 OB). The real reference
  // files use <SYSTEM><beginsession>...<changedir>...</SYSTEM> with NO
  // <connection_info> wrapper (that wrapper only appears on the PROCNAME
  // SFTP-Put used by generic FS->SFTP / EDI 867).
  var EDI_SYSTEM_PUT = String.raw`<SYSTEM name="{{sp_SystemName}}">
		<beginsession>
			<SFTPClientAdapter>{{sp_SFTPClientAdapter}}</SFTPClientAdapter>
			<ProfileId>{{sp_ProfileId}}</ProfileId>
		</beginsession>
		<changedir>
			<Directory>{{sp_Directory}}</Directory>
		</changedir>
</SYSTEM>`;

  // EDIPROCESS — inbound ib_info block.
  var EDI_PROCESS_IB = String.raw`<EDIPROCESS name="{{ib_name}}">
		<ib_info>
			<edi-staging-dir>{{ib_edi_staging_dir}}</edi-staging-dir>
			<temp-archive-path>{{ib_temp_archive_path}}</temp-archive-path>
			<edi-archive-name>{{ib_edi_archive_name}}</edi-archive-name>
			<edi-archive-path>{{ib_edi_archive_path}}</edi-archive-path>
			<nia-archive-flag>{{ib_nia_archive_flag}}</nia-archive-flag>
			<nia-archive-name>{{ib_nia_archive_name}}</nia-archive-name>
			<nia-archive-path>{{ib_nia_archive_path}}</nia-archive-path>
			<app-archive-name>{{ib_app_archive_name}}</app-archive-name>
			<app-archive-path>{{ib_app_archive_path}}</app-archive-path>
			<destination-staging-dir>{{ib_destination_staging_dir}}</destination-staging-dir>
			<destination-retransmit-dir>{{ib_destination_retransmit_dir}}</destination-retransmit-dir>
			<emailXSLT>{{ib_emailXSLT}}</emailXSLT>
		</ib_info>
</EDIPROCESS>`;

  // EDIPROCESS — inbound ib_info (997 acknowledgement variant, used by 810 OB).
  // Archive NAMES are computed at runtime via xsl:value-of; only the paths and
  // staging/retransmit directories are developer-fillable.
  var EDI_PROCESS_IB_997 = String.raw`<EDIPROCESS name="{{ib_name}}">
		<ib_info>
			<edi997-archive-name><xsl:value-of select="concat('EDI_OB_997.',$DateTime,'.txt')"/></edi997-archive-name>
			<edi997-archive-path>{{ib_edi997_archive_path}}</edi997-archive-path>
			<nia-ob-archive-name><xsl:value-of select="concat('EDI_OB_997.',$DateTime,'.txt')"/></nia-ob-archive-name>
			<nia-ob-archive-path>{{ib_nia_ob_archive_path}}</nia-ob-archive-path>
			<ob997-staging-dir>{{ib_ob997_staging_dir}}</ob997-staging-dir>
			<ob997-retransmit-dir>{{ib_ob997_retransmit_dir}}</ob997-retransmit-dir>
			<ib997-archive-name><xsl:value-of select="concat('EDI_IB_997.',$DateTime,'.txt')"/></ib997-archive-name>
			<ib997-archive-path>{{ib_ib997_archive_path}}</ib997-archive-path>
			<nia-ib-archive-name><xsl:value-of select="concat('EDI_IB_997.',$DateTime,'.txt')"/></nia-ib-archive-name>
			<nia-ib-archive-path>{{ib_nia_ib_archive_path}}</nia-ib-archive-path>
		</ib_info>
</EDIPROCESS>`;

  // EDIPROCESS — outbound ob_info block.
  var EDI_PROCESS_OB = String.raw`<EDIPROCESS name="{{ob_name}}">
		<ob_info>
			<app-archive-name>{{ob_app_archive_name}}</app-archive-name>
			<app-archive-path>{{ob_app_archive_path}}</app-archive-path>
			<edi-archive-name>{{ob_edi_archive_name}}</edi-archive-name>
			<edi-archive-path>{{ob_edi_archive_path}}</edi-archive-path>
			<nia-archive-flag>{{ob_nia_archive_flag}}</nia-archive-flag>
			<nia-archive-name>{{ob_nia_archive_name}}</nia-archive-name>
			<nia-archive-path>{{ob_nia_archive_path}}</nia-archive-path>
			<temp-file-name>{{ob_temp_file_name}}</temp-file-name>
			<temp-file-path>{{ob_temp_file_path}}</temp-file-path>
			<mb-staging-name>{{ob_mb_staging_name}}</mb-staging-name>
			<mb-staging-dir>{{ob_mb_staging_dir}}</mb-staging-dir>
			<mb-retransmit-name>{{ob_mb_retransmit_name}}</mb-retransmit-name>
			<mb-retransmit-dir>{{ob_mb_retransmit_dir}}</mb-retransmit-dir>
			<map_name>{{ob_map_name}}</map_name>
		</ob_info>
</EDIPROCESS>`;

  // PROCNAME — FS -> MB (EDI outbound collection) block.
  var EDI_PROCNAME_FSMB = String.raw`<PROCNAME name="{{fm_ProcessName}}">
		<process_info>
			<CollectionFileName>{{fm_CollectionFileName}}</CollectionFileName>
			<CollectionFolder>{{fm_CollectionFolder}}</CollectionFolder>
			<ArchiveFlag>{{fm_ArchiveFlag}}</ArchiveFlag>
			<ArchiveTimeStamp>{{fm_ArchiveTimeStamp}}</ArchiveTimeStamp>
			<ArchiveFolder>{{fm_ArchiveFolder}}</ArchiveFolder>
			<PGPUnPackFlag>{{fm_PGPUnPackFlag}}</PGPUnPackFlag>
			<KeyMapName>{{fm_KeyMapName}}</KeyMapName>
			<PGPUnPackFileExtn>{{fm_PGPUnPackFileExtn}}</PGPUnPackFileExtn>
			<MailboxPath>{{fm_MailboxPath}}</MailboxPath>
			<ExtractableCount>{{fm_ExtractableCount}}</ExtractableCount>
		</process_info>
		<mail_info>
			<SendSuccessMail>{{fm_SendSuccessMail}}</SendSuccessMail>
			<SendArchiveInfo>{{fm_SendArchiveInfo}}</SendArchiveInfo>
			<mail-mime-sender>{{fm_MailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{fm_MailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{fm_MailCc}}</mail-mime-cc>
			<mail-mime-subject>{{fm_MailSubject}}</mail-mime-subject>
			<MailName>{{fm_MailName}}</MailName>
		</mail_info>
</PROCNAME>`;

  // PROCNAME — SFTP Put config (867) block.
  var EDI_PROCNAME_SFTPPUT = String.raw`<PROCNAME name="{{pp_ProcessName}}">
		<connection_info>
			<beginsession>
				<SFTPClientAdapter>{{pp_SFTPClientAdapter}}</SFTPClientAdapter>
				<ProfileId>{{pp_ProfileId}}</ProfileId>
			</beginsession>
		</connection_info>
		<process_info>
			<FileSourceName>{{pp_FileSourceName}}</FileSourceName>
			<CollectionFileName>{{pp_CollectionFileName}}</CollectionFileName>
			<CollectionFileExtn>{{pp_CollectionFileExtn}}</CollectionFileExtn>
			<CollectionFolder>{{pp_CollectionFolder}}</CollectionFolder>
			<DeleteSourceFile>{{pp_DeleteSourceFile}}</DeleteSourceFile>
			<ArchiveFlag>{{pp_ArchiveFlag}}</ArchiveFlag>
			<ArchiveTimeStamp>{{pp_ArchiveTimeStamp}}</ArchiveTimeStamp>
			<ArchiveFolder>{{pp_ArchiveFolder}}</ArchiveFolder>
			<PGPPackFlag>{{pp_PGPPackFlag}}</PGPPackFlag>
			<useSubFolders>{{pp_useSubFolders}}</useSubFolders>
			<public_user>{{pp_public_user}}</public_user>
			<conv_keymap_name>{{pp_conv_keymap_name}}</conv_keymap_name>
			<AddTargetTimeStamp>{{pp_AddTargetTimeStamp}}</AddTargetTimeStamp>
			<TargetFileName>{{pp_TargetFileName}}</TargetFileName>
			<TargetFileExtn>{{pp_TargetFileExtn}}</TargetFileExtn>
			<DelayBetweenFiles>{{pp_DelayBetweenFiles}}</DelayBetweenFiles>
			<DelayTimeInMS>{{pp_DelayTimeInMS}}</DelayTimeInMS>
			<MailName>{{pp_MailName}}</MailName>
		</process_info>
</PROCNAME>`;

  // PROC_NAME — OB -> PI config block.
  var EDI_PROCNAME_PI = String.raw`<PROC_NAME name="{{pi_name}}">
		<file_info>
			<CollectionFolder>{{pi_CollectionFolder}}</CollectionFolder>
			<FileName>{{pi_FileName}}</FileName>
			<TargetMB>{{pi_TargetMB}}</TargetMB>
			<TargetMessageName>{{pi_TargetMessageName}}</TargetMessageName>
		</file_info>
		<mail_info>
			<SendSuccessMail>{{pi_SendSuccessMail}}</SendSuccessMail>
			<SendArchiveInfo>{{pi_SendArchiveInfo}}</SendArchiveInfo>
			<MailFormat>{{pi_MailFormat}}</MailFormat>
			<mail-mime-sender>{{pi_MailSender}}</mail-mime-sender>
			<mail-mime-recipient>{{pi_MailRecipient}}</mail-mime-recipient>
			<mail-mime-cc>{{pi_MailCc}}</mail-mime-cc>
			<mail-mime-subject>{{pi_MailSubject}}</mail-mime-subject>
		</mail_info>
</PROC_NAME>`;

  // ERRORMAIL block.
  var EDI_ERRORMAIL = String.raw`<ERRORMAIL name="{{em_name}}">
	<email_info>
		<mail-format>{{em_MailFormat}}</mail-format>
		<mail-mime-sender>{{em_MailSender}}</mail-mime-sender>
		<mail-mime-recipient>{{em_MailRecipient}}</mail-mime-recipient>
		<mail-mime-cc>{{em_MailCc}}</mail-mime-cc>
		<mail-mime-subject>{{em_MailSubject}}</mail-mime-subject>
	</email_info>
</ERRORMAIL>`;

  // EDIMAIL block.
  var EDI_EDIMAIL = String.raw`<EDIMAIL name="{{dm_name}}">
	<email_info>
		<mail-format>{{dm_MailFormat}}</mail-format>
		<mail-mime-sender>{{dm_MailSender}}</mail-mime-sender>
		<mail-mime-recipient>{{dm_MailRecipient}}</mail-mime-recipient>
		<mail-mime-cc>{{dm_MailCc}}</mail-mime-cc>
		<mail-mime-subject>{{dm_MailSubject}}</mail-mime-subject>
	</email_info>
</EDIMAIL>`;

  // EXTRACT block.
  var EDI_EXTRACT = String.raw`<EXTRACT name="{{ex_name}}">
	<Processing_BP>{{ex_Processing_BP}}</Processing_BP>
	<Process_Name>{{ex_Process_Name}}</Process_Name>
</EXTRACT>`;

  // ----- EDI multi-block interfaces (xsltOnly; one wizard step per block) --
  var B_RR_IN = { key: 'routerule', label: 'Route rule', file: '_MB_To_MB_Config.txt', tpl: EDI_ROUTERULE_IN };
  var B_RR_OUT = { key: 'routerule', label: 'Route rule', file: '_File_Routing_Rule.txt', tpl: EDI_ROUTERULE_OUT };
  var B_SGET = { key: 'sftpget', label: 'SFTP Get config', file: '_SFTPGet_Config.txt', tpl: EDI_SYSTEM_GET };
  var B_SPUT = { key: 'sftpput', label: 'SFTP Put config', file: '_SFTPPut.txt', tpl: EDI_SYSTEM_PUT };
  var B_IB = { key: 'ediprocess', label: 'EDI process (IB)', file: '_IB_EDI_PARMS.txt', tpl: EDI_PROCESS_IB };
  var B_IB_997 = { key: 'ediprocess', label: 'EDI process (IB)', file: '_IB_EDI_PARMS.txt', tpl: EDI_PROCESS_IB_997 };
  var B_OB = { key: 'ediprocess', label: 'EDI process (OB)', file: '_OB_EDI_PARMS.txt', tpl: EDI_PROCESS_OB };
  var B_RULEID = { key: 'ruleid', label: 'IB rule (RULEID)', file: '_IB_Config.txt', tpl: templates.MBFS.xslt };
  var B_FSMB = { key: 'procname', label: 'FS to MB config', file: '_FS_To_MB_Config.txt', tpl: EDI_PROCNAME_FSMB };
  var B_SFTPPUT_CFG = { key: 'sftpputcfg', label: 'SFTP Put config', file: '_SFTPPut_Config.txt', tpl: EDI_PROCNAME_SFTPPUT };
  var B_PI = { key: 'obtopi', label: 'OB to PI config', file: '_OB_To_PI.txt', tpl: EDI_PROCNAME_PI };
  var B_ERR = { key: 'errormail', label: 'Error e-mail', file: '_Error_Email_List.txt', tpl: EDI_ERRORMAIL };
  var B_EDIMAIL = { key: 'edimail', label: 'EDI e-mail', file: '_EDI_Email_List.txt', tpl: EDI_EDIMAIL };
  var B_EXTRACT = { key: 'extract', label: 'Mailbox extract', file: '_Mbx_Extract.txt', tpl: EDI_EXTRACT };

  templates.EDI810OB = { xsltList: [B_RR_IN, B_SGET, B_SPUT, B_IB_997] };
  templates.EDI814IB = { xsltList: [B_RR_IN, B_RULEID, B_SGET, B_IB] };
  templates.EDI814OB = { xsltList: [B_RR_OUT, B_FSMB, B_SPUT] };
  templates.EDI820IB = { xsltList: [B_RR_IN, B_ERR, B_FSMB, B_EXTRACT] };
  templates.EDI824IB = { xsltList: [B_RR_IN, B_IB] };
  templates.EDI824OB = { xsltList: [B_RR_OUT, B_ERR, B_FSMB, B_OB] };
  templates.EDI850OB = { xsltList: [B_RR_OUT, B_ERR, B_EDIMAIL, B_PI, B_OB] };
  templates.EDI852OB = { xsltList: [B_RR_OUT, B_EDIMAIL, B_PI, B_OB] };
  templates.EDI867 = { xsltList: [B_FSMB, B_SFTPPUT_CFG, B_OB] };

  // Interface definitions. MB -> FS removed; will be rebuilt.
  var IFACES = {
    MBFS: {
      id: 'MBFS', title: 'MB \u2192 FS', category: 'Generic transfers',
      desc: 'Generate the RULEID XSLT block only (no BPML / import XML).',
      dynamicDefault: false,
      xsltOnly: true,
      steps: ['XSLT fields', 'Review']
    },
    FSMB: {
      id: 'FSMB', title: 'FS \u2192 MB', category: 'Generic transfers',
      desc: 'Collect files from the file system and deliver to a mailbox (PROCNAME block only).',
      dynamicDefault: false,
      xsltOnly: true,
      steps: ['XSLT fields', 'Review']
    },
    MBMB: {
      id: 'MBMB', title: 'MB \u2192 MB', category: 'Generic transfers',
      desc: 'Route a message from one mailbox to another (ROUTERULE block only).',
      dynamicDefault: false,
      xsltOnly: true,
      steps: ['XSLT fields', 'Review']
    },
    FSFS: {
      id: 'FSFS', title: 'FS \u2192 FS', category: 'Generic transfers',
      desc: 'Collect files from the file system and deliver to the file system (PROCNAME block only).',
      dynamicDefault: false,
      xsltOnly: true,
      steps: ['XSLT fields', 'Review']
    },
    FSSFTP: {
      id: 'FSSFTP', title: 'FS \u2192 SFTP', category: 'Generic transfers',
      desc: 'Collect files from the file system and push to an SFTP server (PROCNAME block only).',
      dynamicDefault: false,
      xsltOnly: true,
      steps: ['XSLT fields', 'Review']
    },
    SFTPFS: {
      id: 'SFTPFS', title: 'SFTP \u2192 FS', category: 'Generic transfers',
      desc: 'Pull files from an SFTP server and deliver to the file system (3 config blocks).',
      dynamicDefault: false,
      steps: ['Details', 'SFTP Get config', 'Error e-mail', 'Success e-mail', 'Review'],
      bpDefaults: {
        genericBp: 'SCE_Generic_SFTPGet',
        errorBp: 'SCE_Generic_EMailOnError',
        wfdId: ''
      }
    },
    EDI810OB: {
      id: 'EDI810OB', title: 'EDI 810 OB', category: 'EDI', desc: 'Outbound 810 invoice: route rule, SFTP get/put and EDI process params.',
      xsltOnly: true,
      steps: ['Route rule', 'SFTP Get config', 'SFTP Put config', 'EDI process (IB)', 'Envelopes', 'Review']
    },
    EDI814IB: {
      id: 'EDI814IB', title: 'EDI 814 IB', category: 'EDI', desc: 'Inbound 814: route rule, RULEID, SFTP get and EDI process params.',
      xsltOnly: true,
      steps: ['Route rule', 'IB rule (RULEID)', 'SFTP Get config', 'EDI process (IB)', 'Envelopes', 'Review']
    },
    EDI814OB: {
      id: 'EDI814OB', title: 'EDI 814 OB', category: 'EDI', desc: 'Outbound 814: file routing rule, FS to MB config and SFTP put.',
      xsltOnly: true,
      steps: ['Route rule', 'FS to MB config', 'SFTP Put config', 'Envelopes', 'Review']
    },
    EDI820IB: {
      id: 'EDI820IB', title: 'EDI 820 IB', category: 'EDI', desc: 'Inbound 820: route rule, error e-mail, FS to MB config and mailbox extract.',
      xsltOnly: true,
      steps: ['Route rule', 'Error e-mail', 'FS to MB config', 'Mailbox extract', 'Envelopes', 'Review']
    },
    EDI824IB: {
      id: 'EDI824IB', title: 'EDI 824 IB', category: 'EDI', desc: 'Inbound 824: route rule and EDI process params.',
      xsltOnly: true,
      steps: ['Route rule', 'EDI process (IB)', 'Envelopes', 'Review']
    },
    EDI824OB: {
      id: 'EDI824OB', title: 'EDI 824 OB', category: 'EDI', desc: 'Outbound 824: file routing rule, error e-mail, FS to MB config and EDI process params.',
      xsltOnly: true,
      steps: ['Route rule', 'Error e-mail', 'FS to MB config', 'EDI process (OB)', 'Envelopes', 'Review']
    },
    EDI850OB: {
      id: 'EDI850OB', title: 'EDI 850 OB', category: 'EDI', desc: 'Outbound 850 PO: route rule, error e-mail, EDI e-mail, OB to PI config and EDI process params.',
      xsltOnly: true,
      steps: ['Route rule', 'Error e-mail', 'EDI e-mail', 'OB to PI config', 'EDI process (OB)', 'Envelopes', 'Review']
    },
    EDI852OB: {
      id: 'EDI852OB', title: 'EDI 852 OB', category: 'EDI', desc: 'Outbound 852 PA: route rule, EDI e-mail, OB to PI config and EDI process params.',
      xsltOnly: true,
      steps: ['Route rule', 'EDI e-mail', 'OB to PI config', 'EDI process (OB)', 'Envelopes', 'Review']
    },
    EDI867: {
      id: 'EDI867', title: 'EDI 867', category: 'EDI', desc: 'Outbound 867: FS to MB config, SFTP put config and EDI process params.',
      xsltOnly: true,
      steps: ['FS to MB config', 'SFTP Put config', 'EDI process (OB)', 'Envelopes', 'Review']
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
    'AddTargetTimeStamp', 'SendEmail', 'MailFlag',
    // FS -> MB / FS -> FS / MB -> MB / FS -> SFTP
    'ArchiveTimeStamp', 'MailBoxFileTimeStamp', 'SendSuccessMail',
    'TargetFileTimeStamp', 'DeleteSourceFile', 'WindowsToUnix', 'UnixToWindows',
    'DelayBetweenFiles',
    // EDI blocks (prefixed tokens)
    'rr_ArchiveFlag', 'rr_MailFlag', 'rr_DeleteMessage',
    'sg_DeleteRemoteFile', 'sg_ArchiveFlag', 'sg_AddArchiveTimeStamp',
    'sg_PGPUnPackFlag', 'sg_AddTargetTimeStamp', 'sg_TargetFileCheck', 'sg_SendEmail',
    'ib_nia_archive_flag', 'ob_nia_archive_flag',
    'fm_ArchiveFlag', 'fm_ArchiveTimeStamp', 'fm_PGPUnPackFlag',
    'fm_SendSuccessMail', 'fm_SendArchiveInfo',
    'pp_DeleteSourceFile', 'pp_ArchiveFlag', 'pp_ArchiveTimeStamp', 'pp_PGPPackFlag',
    'pp_AddTargetTimeStamp', 'pp_DelayBetweenFiles',
    'pi_SendSuccessMail', 'pi_SendArchiveInfo'
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
      'MailFormat', 'MailSender', 'MailRecipient', 'MailCc', 'MailSubject'],
    // FS -> MB collect/deliver
    'Collect': ['ProcessName', 'CollectionFileName', 'CollectionFileExtn',
      'CollectionFolder', 'DeleteSourceFile'],
    'Collect archive': ['ArchiveFlag', 'ArchiveTimeStamp', 'ArchiveFolder'],
    'Collect PGP': ['PGPPackFlag', 'public_user', 'PGPPackExtn', 'conv_keymap_name',
      'secret_keymap_name'],
    'Mailbox target': ['MailBoxFileTimeStamp', 'MailboxPath', 'MailBoxFileName',
      'MailBoxFileExtn', 'ExtractableCount'],
    'Collect mail': ['SendSuccessMail', 'SendArchiveInfo', 'MailSender',
      'MailRecipient', 'MailCc', 'MailSubject', 'MailName'],
    // FS -> FS target
    'FS target': ['TargetFolder1', 'TargetFolder2', 'TargetFileCheck',
      'TargetFileTimeStamp'],
    'Platform conversion': ['WindowsToUnix', 'UnixToWindows'],
    // MB -> MB routing
    'Route': ['RuleName', 'FromMailBox', 'ToMailBox'],
    'Route archive': ['ArchiveFlag', 'AddArchiveTimeStamp', 'ArchivePath'],
    'Route options': ['TargetFileTimeStamp', 'SendEmail', 'MailName'],
    // FS -> SFTP connection
    'SFTP connection': ['SFTPClientAdapter', 'ProfileId', 'Directory'],
    'SFTP push source': ['FileSourceName', 'CollectionFileName', 'CollectionFileExtn',
      'CollectionFolder', 'DeleteSourceFile'],
    'SFTP push target': ['useSubFolders', 'AddTargetTimeStamp', 'TargetFileName',
      'TargetFileExtn', 'DelayBetweenFiles', 'DelayTimeInMS']
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
    MailCc: '', MailSubject: '',
    // FS -> MB / FS -> FS / FS -> SFTP collect defaults
    CollectionFileName: '*', CollectionFileExtn: 'unknown', CollectionFolder: '',
    ArchiveTimeStamp: 'No', PGPPackExtn: '.pgp',
    conv_keymap_name: '', secret_keymap_name: '',
    MailBoxFileTimeStamp: 'No', MailboxPath: '', MailBoxFileName: 'unknown',
    MailBoxFileExtn: 'unknown', SendSuccessMail: 'Yes',
    DeleteSourceFile: 'Yes',
    // FS -> FS target defaults
    TargetFolder1: '', TargetFolder2: '', TargetFileTimeStamp: 'No',
    WindowsToUnix: 'No', UnixToWindows: 'No',
    // MB -> MB routing defaults
    RuleName: '', FromMailBox: '', ToMailBox: '',
    // FS -> SFTP defaults
    SFTPClientAdapter: 'SCE_SFTP_CLIENT_DMZ1_GROUP', Directory: '',
    FileSourceName: 'FS', useSubFolders: 'false',
    DelayBetweenFiles: 'No', DelayTimeInMS: '30000',
    // ---- EDI ROUTERULE defaults
    rr_name: '', rr_FromMailBox: '', rr_ArchiveFlag: 'Yes', rr_ArchiveFolder: '',
    rr_FileNameAddition: '', rr_FileNameExtn: '.txt', rr_NewFileName: '',
    rr_ToMailBox1: '', rr_ToMailBox2: '', rr_ExtractableCount2: '1',
    rr_MailFlag: 'No', rr_DeleteMessage: 'Yes',
    // ---- EDI SFTP Get (SYSTEM) defaults
    sg_SystemName: '', sg_ProfileId: '',
    sg_SFTPClientAdapterName: 'SCE_SFTP_CLIENT_DMZ1_GROUP', sg_Directory: '',
    sg_RemoteFileName: '', sg_DeleteRemoteFile: 'Yes', sg_ArchiveFlag: 'Yes',
    sg_AddArchiveTimeStamp: 'No', sg_ArchivePath: '', sg_InboundFileExtn: 'unknown',
    sg_PGPUnPackFlag: 'No', sg_PGPExtn: '.pgp', sg_KeyMapName: 'mftadmin',
    sg_FileDestinationName: 'MB', sg_AddTargetTimeStamp: 'No', sg_TargetFileName: 'unknown',
    sg_TargetFileCheck: 'No', sg_TargetFileExtn: 'unknown', sg_TargetFilePath: '',
    sg_ExtractableCount: '1', sg_SendEmail: 'No', sg_SendArchiveInfo: 'No',
    // ---- EDI SFTP Put (SYSTEM) defaults
    sp_SystemName: '', sp_SFTPClientAdapter: 'SCE_SFTP_CLIENT_DMZ1_GROUP',
    sp_ProfileId: '', sp_Directory: '',
    // ---- EDI process ib_info defaults
    ib_name: '', ib_edi_staging_dir: '', ib_temp_archive_path: '',
    ib_edi_archive_name: '', ib_edi_archive_path: '', ib_nia_archive_flag: 'No',
    ib_nia_archive_name: '', ib_nia_archive_path: '', ib_app_archive_name: '',
    ib_app_archive_path: '', ib_destination_staging_dir: '',
    ib_destination_retransmit_dir: '', ib_emailXSLT: '',
    // ---- EDI process ib_info (997 ACK variant) defaults
    ib_edi997_archive_path: '', ib_nia_ob_archive_path: '',
    ib_ob997_staging_dir: '', ib_ob997_retransmit_dir: '',
    ib_ib997_archive_path: '', ib_nia_ib_archive_path: '',
    // ---- EDI process ob_info defaults
    ob_name: '', ob_app_archive_name: '', ob_app_archive_path: '',
    ob_edi_archive_name: '', ob_edi_archive_path: '', ob_nia_archive_flag: 'No',
    ob_nia_archive_name: '', ob_nia_archive_path: '', ob_temp_file_name: '',
    ob_temp_file_path: '', ob_mb_staging_name: '', ob_mb_staging_dir: '',
    ob_mb_retransmit_name: '', ob_mb_retransmit_dir: '', ob_map_name: '',
    // ---- EDI FS -> MB (PROCNAME) defaults
    fm_ProcessName: '', fm_CollectionFileName: '*', fm_CollectionFolder: '',
    fm_ArchiveFlag: 'Yes', fm_ArchiveTimeStamp: 'No', fm_ArchiveFolder: '',
    fm_PGPUnPackFlag: 'Yes', fm_KeyMapName: 'mftadmin', fm_PGPUnPackFileExtn: '.pgp',
    fm_MailboxPath: '', fm_ExtractableCount: '1', fm_SendSuccessMail: 'No',
    fm_SendArchiveInfo: 'No', fm_MailSender: 'scemftprod@sce.com',
    fm_MailRecipient: 'scemftprod@sce.com', fm_MailCc: '', fm_MailSubject: '',
    fm_MailName: '',
    // ---- EDI SFTP Put config (PROCNAME) defaults
    pp_ProcessName: '', pp_SFTPClientAdapter: 'SCE_SFTP_CLIENT_DMZ1_GROUP',
    pp_ProfileId: '', pp_FileSourceName: 'FS', pp_CollectionFileName: '*',
    pp_CollectionFileExtn: 'unknown', pp_CollectionFolder: '', pp_DeleteSourceFile: 'Yes',
    pp_ArchiveFlag: 'Yes', pp_ArchiveTimeStamp: 'No', pp_ArchiveFolder: '',
    pp_PGPPackFlag: 'No', pp_useSubFolders: 'false', pp_public_user: '',
    pp_conv_keymap_name: '', pp_AddTargetTimeStamp: 'No', pp_TargetFileName: 'unknown',
    pp_TargetFileExtn: 'unknown', pp_DelayBetweenFiles: 'No', pp_DelayTimeInMS: '30000',
    pp_MailName: '',
    // ---- EDI OB -> PI (PROC_NAME) defaults
    pi_name: '', pi_CollectionFolder: '', pi_FileName: '*', pi_TargetMB: '',
    pi_TargetMessageName: 'unknown', pi_SendSuccessMail: 'Yes', pi_SendArchiveInfo: 'No',
    pi_MailFormat: 'TEXT', pi_MailSender: 'scemftprod@sce.com',
    pi_MailRecipient: 'scemftprod@sce.com', pi_MailCc: '', pi_MailSubject: '',
    // ---- EDI ERRORMAIL defaults
    em_name: '', em_MailFormat: 'HTML', em_MailSender: 'scemftprod@sce.com',
    em_MailRecipient: 'ManagedServicesMFTSupport@sce.com, scemftprod@sce.com',
    em_MailCc: '', em_MailSubject: '',
    // ---- EDI EDIMAIL defaults
    dm_name: '', dm_MailFormat: 'HTML', dm_MailSender: 'scemftprod@sce.com',
    dm_MailRecipient: 'scemftprod@sce.com', dm_MailCc: '', dm_MailSubject: '',
    // ---- EDI EXTRACT defaults
    ex_name: '', ex_Processing_BP: '', ex_Process_Name: ''
  };

  // Friendly labels. Keyed by the token name AFTER stripping the EDI block
  // prefix (rr_/sg_/sp_/ib_/ob_/fm_/pp_/pi_/em_/dm_/ex_). labelFor() in app.js
  // falls back to a prettified version of the token for anything not listed.
  var LABELS = {
    // routing / mailboxes
    name: 'Config name',
    FromMailBox: 'Source mailbox',
    ToMailBox: 'Destination mailbox',
    ToMailBox1: 'Destination mailbox',
    ToMailBox2: 'Partner destination mailbox',
    ExtractableCount2: 'Extractable count',
    NewFileName: 'New file name',
    FileNameAddition: 'File name addition',
    FileNameExtn: 'File name extension',
    DeleteMessage: 'Delete message after routing?',
    MailFlag: 'Send notification e-mail?',
    MailboxPath: 'Mailbox path',
    TargetMB: 'Target mailbox',
    TargetMessageName: 'Target message name',
    // SFTP
    SystemName: 'SFTP SYSTEM name',
    ProfileId: 'SFTP Profile ID',
    SFTPClientAdapter: 'SFTP client adapter',
    SFTPClientAdapterName: 'SFTP client adapter',
    Directory: 'Remote directory',
    RemoteFileName: 'Remote file pattern',
    DeleteRemoteFile: 'Delete remote file after pickup?',
    // collection / file system
    CollectionFolder: 'Collection folder',
    CollectionFileName: 'Collection file pattern',
    CollectionFileExtn: 'Collection file extension',
    FileSourceName: 'File source name',
    TargetFilePath: 'Target folder (NAS)',
    TargetFileName: 'Target file name',
    TargetFileExtn: 'Target file extension',
    TargetFileCheck: 'Check target file exists?',
    FileName: 'File name pattern',
    // archive
    ArchiveFlag: 'Archive the file?',
    ArchiveFolder: 'Archive folder',
    ArchivePath: 'Archive path',
    ArchiveTimeStamp: 'Add timestamp to archive?',
    AddArchiveTimeStamp: 'Add timestamp to archive?',
    // PGP
    PGPUnPackFlag: 'PGP decrypt (unpack)?',
    PGPPackFlag: 'PGP encrypt (pack)?',
    KeyMapName: 'PGP key map name',
    public_user: 'PGP public key / user id',
    // EDI process (ib_info / ob_info)
    edi_staging_dir: 'EDI staging directory',
    temp_archive_path: 'Temp archive path',
    edi_archive_name: 'EDI archive name',
    edi_archive_path: 'EDI archive path',
    nia_archive_flag: 'Archive non-interchange ack?',
    nia_archive_name: 'Non-interchange ack archive name',
    nia_archive_path: 'Non-interchange ack archive path',
    app_archive_name: 'Application archive name',
    app_archive_path: 'Application archive path',
    destination_staging_dir: 'Destination staging directory',
    destination_retransmit_dir: 'Destination retransmit directory',
    emailXSLT: 'E-mail notification XSLT',
    edi997_archive_path: 'OB 997 EDI archive path',
    nia_ob_archive_path: 'OB 997 non-interchange archive path',
    ob997_staging_dir: 'OB 997 staging directory',
    ob997_retransmit_dir: 'OB 997 retransmit directory',
    ib997_archive_path: 'IB 997 EDI archive path',
    nia_ib_archive_path: 'IB 997 non-interchange archive path',
    temp_file_name: 'Temp file name',
    temp_file_path: 'Temp file path',
    mb_staging_name: 'Mailbox staging name',
    mb_staging_dir: 'Mailbox staging directory',
    mb_retransmit_name: 'Mailbox retransmit name',
    mb_retransmit_dir: 'Mailbox retransmit directory',
    map_name: 'EDI map name',
    // extract
    Processing_BP: 'Processing business process',
    Process_Name: 'Extract process name',
    // e-mail
    MailFormat: 'E-mail format',
    MailSender: 'E-mail sender',
    MailRecipient: 'E-mail recipient',
    MailCc: 'E-mail CC',
    MailSubject: 'E-mail subject',
    MailName: 'Mail config name',
    SendSuccessMail: 'Send success e-mail?',
    SendArchiveInfo: 'Include archive info in e-mail?',
    // envelope identity (used by the envelope step)
    NAME: 'Envelope name',
    SENDER_ID: 'Sender ID',
    CONTROL_NUMBER: 'Control number',
    RECEIVER_ID: 'Receiver ID',
    InterchangeSenderIDQualifier: 'Interchange sender ID qualifier',
    InterchangeReceiverIDQualifier: 'Interchange receiver ID qualifier',
    InterchangeControlStandardsIdentifier: 'Interchange control standards id',
    InterchangeControlVersionNumber: 'Interchange control version',
    InterchangeTestIndicator: 'Test / production indicator',
    GroupFunctionalIDCode: 'Functional ID code',
    GroupVersionReleaseIDCode: 'Version / release code',
    GroupResponsibleAgencyCode: 'Responsible agency code',
    AcknowledgementFormat: 'Acknowledgement format',
    ExpectAcknowledgement: 'Expect acknowledgement?',
    TransactionSetIDCode: 'Transaction set ID code',
    MapName: 'EDI map name',
    AccepterLookupAlias: 'Accepter lookup alias',
    ValidateInput: 'Validate input?',
    ValidateOutput: 'Validate output?'
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
    LABELS: LABELS,
    SAMPLES: SAMPLES
  };
})();
