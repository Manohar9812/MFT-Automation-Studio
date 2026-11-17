/* Integration Studio — golden reference for the self-test.
 * window.__GOLDEN__ holds a fixed state for the MB -> FS (XSLT-only)
 * RULEID regenerator so the self-test is deterministic.
 */
(function () {
  'use strict';

  // Fixed state matching the SCE_IB_DailyReports_From_EXL sample RULEID block.
  var GOLDEN_STATE = {
    iface: 'MBFS',
    dynamicMb: false,
    bp: {
      name: 'SCE_IB_DailyReports_From_EXL',
      desc: '',
      author: 'Integration Studio',
      date: '01/01/2024',
      version: '1',
      wfdId: '',
      lastUsed: '1',
      confDesc: '',
      genericBp: '',
      errorBp: '',
      dateFormat: 'yyyyMMdd',
      dateVar: 'MyCurrentDayDate'
    },
    mb: {
      pattern: 'static',
      prefix: '',
      dateVar: 'MyCurrentDayDate',
      cycles: [],
      suffix: '',
      staticPath: '/EXL/Inbound',
      custom: '',
      appendCycle: false
    },
    x: {
      RuleId: '-1c0be28b:1a1330000f6:-2c40',
      MessageNamePattern: '*.csv',
      InboundFileExtn: '.csv',
      DeleteMail: 'Yes',
      ArchiveFlag: 'No',
      ArchiveFolder: '',
      PGPUnPackFlag: 'No',
      KeyMapName: '',
      TimeStampFlag: 'No',
      PGPPackFlag: 'Yes',
      public_user: '0x02ECCE6B',
      TargetFolder: '/ISUTechDataQU/FI/EXL/In',
      TargetFileName: 'unknown',
      TargetFileExtn: '.csv.pgp',
      TargetFileCheck: 'No',
      MailFlag: 'Yes',
      SendArchiveInfo: 'No',
      MailFormat: 'TEXT',
      MailSender: 'scemftsys@sce.com',
      MailRecipient: 'scemftsys@sce.com',
      MailCc: '',
      MailSubject: 'SCE_IB_DailyReports_From_EXL-Successfull',
      MailName: 'SCE_IB_DailyReports_From_EXL'
    }
  };

  window.__GOLDEN__ = { state: GOLDEN_STATE };
})();
