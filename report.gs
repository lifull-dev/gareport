var globalConfig = {
  configSheetName: 'config',
  configScope: (function () {
    var i = 66, iz = 90, column = [];// B-Z
    for(; i<=iz; i++) column.push(String.fromCharCode(i));
    return column;
  }()),
  configKeyMatrix: {
    report_name: 2,
    account_id: 3,
    property_id: 4,
    type: 5,
    view_id: 6,
    start_date: 7,
    end_date: 8,
    metrics: 9,
    dimensions: 10,
    sort: 11,
    filters: 12,
    segment: 13,
    sampling_level: 14,
    unsampled_report_id: 15,
    resolve_unsampled_report: 16,
    behavior: 17,
    update_sheet: 18
  },
  updateStyle: ['all update', 'diff update'],
  headerNum: 5,
  namespace: 'gas-gareport'
};

/**
--------------------------------
ui
--------------------------------
*/

function onOpen() {
  var ui = SpreadsheetApp.getUi()
    ;

  ui.createAddonMenu()
    .addItem('設定のシートを作る', 'generateConfigSheet')
    .addItem('計測開始する', 'build')
    .addItem('非サンプリングレポートを抽出する', 'pollingUnsampledReport')
    .addItem('スケジューリングを行う', 'showTimer')
    .addItem('スケジューリング一覧', 'showAllTimer')
    .addSubMenu(
      ui
        .createMenu('入力補助機能')
        .addItem('基礎項目一覧', 'showOutline')
        .addItem('セグメント一覧', 'showSegmentList')
    )
    .addToUi();
}

function onInstall() {
  onOpen();
}

/**
 * Fire the polling process.
 */
function timer() {
  var hour = (new Date()).getHours()
    , settings = schedule.getAll()
    , filterdSettings
    , user = Session.getActiveUser().getEmail()
    ;

  function betterError(key, err, isRetry) {
    return {
      user: user,
      message: err.message,
      date: (new Date()).toString(),
      fileid: key,
      errs: err.errors,
      err_code: err.code,
      retry_info: err.retryInfo,
      is_retry: isRetry || false
    };
  }

  Object.keys(settings).forEach(function (key) {
    var setting = settings[key]
      , isEnable = !!(+setting.enable)
      , lastError = setting.lastError || {}
      , retryInfo = lastError.retry_info
      , spreadsheet
      , configSheet
      , config
      , customError
      ;

    if (!isEnable) {
      return;
    }

    if (retryInfo) {
      spreadsheet = SpreadsheetApp.openById(retryInfo.fileId)
      configSheet = spreadsheet.getSheetByName(globalConfig.configSheetName)
      config = util.objectMerge(retryInfo.config, {
        start_date: new Date(retryInfo.config.start_date),
        end_date: new Date(retryInfo.config.end_date),
      });
      try {
        extract(config, spreadsheet, configSheet, retryInfo.column)
      } catch(err) {}
      // retryは一度まで
      delete setting.lastError.retry_info;
      schedule.save(key, setting)
    }

    try {
      pollingUnsampledReport(key);
      schedule.removeLastError(key)
    } catch(err) {
      customError = betterError(key, err)
      schedule.saveLastError(key, customError);
    }

    if (+setting.hourOfDay === hour) {
      try {
        build(key);
      } catch(err) {
        customError = betterError(key, err)
        schedule.saveLastError(key, customError);
      }
    }
  });
}

/**
--------------------------------
public api
--------------------------------
*/
function generateConfigSheet() {
  var sheet = util.sheetOpen(globalConfig.configSheetName)
    , keyMatrix = globalConfig.configKeyMatrix
    , scope = globalConfig.configScope
    , header
    , itemHeader
    , minConfigLine
    , maxConfigLine
    , minConfigColumn
    , maxConfigColumn
    , settingLabels = []
    , invertKeyMatrix = {}
    , i
    , iz
    , rule
    , updateStyle = globalConfig.updateStyle
    , updateRange
    ;

  sheet
    .setColumnWidth(1, 230)
    .setRowHeight(1, 50)
    .setFrozenColumns(1);

  header = sheet.getRange(util.sheetCell('A', 1))
    .setValue('設定')
    .setFontSize(12)
    .setFontWeight("bold")
    .setBackground('#666')
    .setFontColor('#fff')
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  itemHeader = sheet.getRange("B1:Z1")
    .merge()
    .setValue('あなたのレポートの設定')
    .setVerticalAlignment("middle")
    .setFontSize(12)
    .setBackground('#ed6103')
    .setFontColor('#fff');

  minConfigLine = Math.min.apply(Math, util.objectValues(keyMatrix));
  maxConfigLine = Math.max.apply(Math, util.objectValues(keyMatrix));
  maxConfigColumn = scope[scope.length - 1];
  minConfigColumn = scope[0];

  sheet.getRange('B3:Z'+maxConfigLine)
  　　.setHorizontalAlignment('right')
   .setWrap(true);

  sheet
    .getRange('A' + maxConfigLine + ':' + 'Z' +   maxConfigLine)
    .setBorder(false, false, true, false, false, false, '#333', SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(util.sheetCell(minConfigColumn,2) + ':' + util.sheetCell(maxConfigColumn, 2))
    .setBackground('#eee');

  Object.keys(keyMatrix).forEach(function (key) {
    var value = keyMatrix[key];
    invertKeyMatrix[value] = key;
  });

  for (i = minConfigLine, iz = maxConfigLine; i <= iz; i++) {
    settingLabels.push([invertKeyMatrix[i] || null]);
  }

  sheet.getRange(util.sheetCell('A', minConfigLine) + ':' + util.sheetCell('A', maxConfigLine))
    .setBackground('#eee')
    .setFontWeight('bold')
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle")
    .setValues(settingLabels);

  Object.keys(keyMatrix).forEach(function (name) {
    var idx = keyMatrix[name]
      ;
    sheet.setRowHeight(idx, 30);
  });

  rule = SpreadsheetApp
　　　  .newDataValidation()
　　　  .requireValueInList(updateStyle, true)
　　　  .build();

  updateRange = sheet
    .getRange([util.sheetCell('B', keyMatrix.behavior), util.sheetCell('Z', keyMatrix.behavior)].join(':'))
    .setDataValidation(rule);
}

/**
 * build analytics sheet
 */
function build(key) {
  var spreadsheet = key ? SpreadsheetApp.openById(key) : SpreadsheetApp.getActiveSpreadsheet()
    , configSheet = spreadsheet.getSheetByName(globalConfig.configSheetName)
    , keyMatrix = globalConfig.configKeyMatrix
    , configs = {}
    , txt
    ;

  try {
    configs = getConfig(spreadsheet)
  } catch (err) {
    Browser.msgBox(err.message);
  }

  Object.keys(configs).forEach(function (column, idx) {
    var config = configs[column]
      ;

    try {
      extract(config, spreadsheet, configSheet, column)
    } catch(err) {
      err.retryInfo = {
        fileId: key,
        config: config,
        column: column
      };

      throw err;
    }
  });
}

function extract(config, spreadsheet, configSheet, column) {
  var report
    , nextUnsampledReportId
    , keyMatrix = globalConfig.configKeyMatrix
    ;

  // skip unsetting config column
  if (!config.report_name) { return; }

  // [get] normal report
  report = getReport(config, spreadsheet)
  configSheet = configSheet || spreadsheet.getSheetByName(globalConfig.configSheetName);

  if (!report) {
    return;
  }

  if (!report.containsSampledData) {
    assembleReportSheet(spreadsheet, config.report_name, report, config);
    configSheet.getRange(util.sheetCell(column, keyMatrix.unsampled_report_id)).setValue('');
    configSheet.getRange(util.sheetCell(column, keyMatrix.resolve_unsampled_report)).setValue('');
    return;
  }

  // [request] unsampled report (fetched by polling event)
  nextUnsampledReportId = insertUnsampledReport(config, spreadsheet);
  configSheet.getRange(util.sheetCell(column, keyMatrix.unsampled_report_id)).setValue(nextUnsampledReportId);
  configSheet.getRange(util.sheetCell(column, keyMatrix.resolve_unsampled_report)).setValue(false);
}

/**
 * polling task of unsampled report
 */
function pollingUnsampledReport(key) {
  var spreadsheet = key ? SpreadsheetApp.openById(key) : SpreadsheetApp.getActiveSpreadsheet()
    , configSheet = spreadsheet.getSheetByName(globalConfig.configSheetName)
    , configScope = globalConfig.configScope
    , keyMatrix = globalConfig.configKeyMatrix
    , configs
    ;

  try {
    configs = getConfig(spreadsheet)
  } catch (err) {
    Browser.msgBox(err.message);
  }

  Object.keys(configs).forEach(function (column, idx) {
    var config = configs[column]
      , report
      , nextUnsampledReportId
      , unsampledReportDocumentId
      , isResolved
      ;

    // skip unsetting config column
    if (!config.report_name) { return; }

    isResolved = config.resolve_unsampled_report;

    // If updating has already been completed, it ends.
    if (isResolved) { return; }

    // get document ID of unsampled report
    try {
      unsampledReportDocumentId = getUnsampledReportDocumentId(config);
    } catch (err) {
      throw new Error([('file id: ' + key), ('report name: ' + config.report_name), ('message: ' + err.message)].join('\n'));
    }

    if (unsampledReportDocumentId) {
      report = importUnsampledReport(unsampledReportDocumentId);
      assembleReportSheet(spreadsheet, config.report_name, report, config);
      configSheet.getRange(util.sheetCell(column, keyMatrix.resolve_unsampled_report)).setValue(true);
    }
  });

  util.log('done.');
}

/**
 * show segment [segment list]
 */
function showSegmentList() {
  var template = HtmlService.createTemplateFromFile('segment.html')
    , html
    , segmentList
    ;

  segmentList = Analytics.Management.Segments.list({"max-results": 1000, fields: "items", "start-index": 1});
  template.segments = segmentList;

  html = template
    .evaluate()
    .setTitle('セグメント一覧');

 SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 基礎項目設定メニュー
 */
function showOutline() {
  var template = HtmlService.createTemplateFromFile('outline.html')
    , acountList
    , html
    ;

  accountList = Analytics.Management.Accounts.list();
  template.accountList = accountList;
  html = template
    .evaluate()
    .setTitle('アウトライン情報');

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * タイマー設定モーダル
 */
function showTimer() {
  var html
    , form
    , template
    ;

  form = schedule.getCurrent();
  template = HtmlService.createTemplateFromFile('timer.html');
  template.form = form;
  html = template
    .evaluate()
    .setWidth(600)
    .setHeight(200)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, 'レポートの抽出をスケジューリングする');
}

/**
 * タイマー一覧モーダル
 */
function showAllTimer() {
  var allItems = schedule.getAll()
    , template = HtmlService.createTemplateFromFile('all_timer.html')
    , html
    , timers
    ;

  timers = Object.keys(allItems).map(function (id) {
    var setting = allItems[id]
      , ss
      , url
      , name
      ;
    try {
      ss = SpreadsheetApp.openById(id);
      url = ss.getUrl();
      name = ss.getName();
    } catch(err) {
      name = '不明なファイル (権限がない、削除された等が考えられます)';
    }

    return {
      id: id,
      name: name,
      url: url,
      setting: setting
    }
  });

  template.timers = timers;

  html = template
    .evaluate()
    .setWidth(700)
    .setHeight(600)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  SpreadsheetApp.getUi().showModalDialog(html, 'あなたの設定してる全タイマー設定');
}


/**
--------------------------------
private api
--------------------------------
*/

function formatMetadata(metadata) {
  var dimensions = {}
    , metrics = {}
    ;

  underscoreGS._each(metadata.items || [], function (item) {
    var attr = item.attributes
      ;

    if (attr.status !== "PUBLIC") { return; }

    switch (attr.type) {
      case "DIMENSION":
        dimensions[attr.group] = dimensions[attr.group] || [];
        dimensions[attr.group].push({
          id: item.id,
          name: attr.uiName
        });
        break;
      case "METRIC":
        metrics[attr.group] = metrics[attr.group] || [];
        metrics[attr.group].push({
          id: item.id,
          name: attr.uiName
        });
        break;
    }
  });

  return {
    dimensions: dimensions,
    metrics: metrics
  };
}

/**
 * get config
 * ex.( {'B': {report_name: 'xxxx', ...}, 'C': {...}} )
 *
 * @return {object}
 */
function getConfig(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet()
    , configSheet = spreadsheet.getSheetByName(globalConfig.configSheetName)
    , configScope = globalConfig.configScope
    , keyMatrix = globalConfig.configKeyMatrix
    , keyMatrixValues = util.objectValues(keyMatrix)
    , firstColumn = configScope[0]
    , lastColumn = configScope[configScope.length - 1]
    , max = Math.max.apply(Math, keyMatrixValues)
    , min = Math.min.apply(Math, keyMatrixValues)
    , configs = {}
    , values
    ;

  if (!configSheet) {
    throw new Error('設定ファイルがありません');
  }

  values = configSheet.getRange(util.sheetCell(firstColumn, min) + ':' + util.sheetCell(lastColumn, max)).getValues();
  values.forEach(function (rows, rowIndex) {
    var key = min + rowIndex
      , field = util.objectInvert(keyMatrix)[key]
      ;

    rows.forEach(function (row, index) {
      var column = configScope[index]
        ;
      if (field === 'behavior' && !row) {
        row = globalConfig.updateStyle[0];
      }
      if (field === 'update_sheet' && !row) {
        row = values[0][index]
      }

      configs[column] = configs[column] || {};
      configs[column][field] = row;
    });
  });

  return configs;
}

/**
 * get google drive id of unsampled report
 *
 * @param {object} config
 * @return {string} documentId (google drive)
 */
function getUnsampledReportDocumentId(config) {
  var req
    , formattedReport
    ;

  req = Analytics.Management.UnsampledReports.get(
    config.account_id, // account_id
    config.property_id, // property_id
    config.view_id.replace('ga:', ''), // view_id
    config.unsampled_report_id
  );

  if (req.status !== 'COMPLETED') {
    return false;
  }

  if (!req.driveDownloadDetails) {
    return false;
  }

  return req.driveDownloadDetails.documentId;
}


/**
 * request unsampled report
 *
 * @param {object} config
 * @return {string} report id
 */
function insertUnsampledReport(config, ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet()
    , unsampledReportName = ['unsampled_report', spreadsheet.getName(), config.report_name].join('_')
    , startDate = util.resolveDate(config.start_date)
    , res
    , option
    ;

  try {
    checkValidConfig(config);
  } catch(e) {
    ui = SpreadsheetApp.getUi();
    ui.alert(e.message);
    throw e;
  }

    // 差分更新
  if (config.behavior === globalConfig.updateStyle[1]) {
    startDate = getLastExtractionDate(
      util.sheetOpen(config.update_sheet, spreadsheet),
      config
    );
  }
  startDate = util.resolveDate(startDate);
  endDate = util.resolveDate(config.end_date || 'today');
  if (Moment.moment(startDate, 'YYYY-MM-DD') > Moment.moment(endDate, 'YYYY-MM-DD')) {
    return false;
  }

  option = util.objectCompact({
    title: unsampledReportName,
    'start-date': startDate,
    'end-date':   endDate,
    metrics:    config.metrics,
    dimensions: config.dimensions,
    filters:    config.filters,
    sort:       config.sort,
    segment:    config.segment
  });

  req = Analytics.Management.UnsampledReports.insert(
    option,
    config.account_id,
    config.property_id,
    config.view_id.replace('ga:', '') // view_id
  );

  return req.id;
}

/**
 * get anlytics report
 *
 * @return {object} report
 */
function getReport(config, ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet()
    , startDate = config.start_date
    , endDate
    , lastExtrationDate
    , report
    , req
    , unsampledReportName
    , option
    , ui
    , sheet
    ;

  try {
    checkValidConfig(config);
  } catch(e) {
    ui = SpreadsheetApp.getUi();
    ui.alert(e.message);
    throw e;
  }

  option = util.objectMerge(
    util.objectCompact({
      dimensions: config.dimensions,
      filters : config.filters,
      sort: config.sort,
      samplingLevel: config.sampling_level,
      segment: config.segment,
    }), {
      'include-empty-rows': true,
      includeEmptyRows: true
    }
  )

  // 差分更新
  if (config.behavior === globalConfig.updateStyle[1]) {
    startDate = getLastExtractionDate(
      util.sheetOpen(config.update_sheet, spreadsheet),
      config
    );
  }
  startDate = util.resolveDate(startDate);
  endDate = util.resolveDate(config.end_date || 'today');

  if (Moment.moment(startDate, 'YYYY-MM-DD') > Moment.moment(endDate, 'YYYY-MM-DD')) {
    return false;
  }

  report = Analytics.Data.Ga.get(
    config.view_id,
    startDate,
    endDate,
    config.metrics,
    option
  );

  return formatReportData(report);
}

/**
 * configがvalidか判定する
 *
 * @param {Object} config
 */
function checkValidConfig(config) {
  var required = [
      'report_name',
      'account_id',
      'property_id',
      'type',
      'view_id',
      'start_date',
      'metrics',
      'dimensions'
    ]
    , choices = {
      'behavior': [''].concat(globalConfig.updateStyle)
    }
    ;

  required.forEach(function (key) {
    if (config[key] == null || config[key] == "") {
      throw new Error(key + 'の設定は必須です(レポート名:'+ config.report_name +')');
    }
  });

  Object.keys(choices).forEach(function (key) {
    var list = choices[key], value = config[key];
    if (list.indexOf(value) === -1) {
      throw new Error(key + 'の設定に入力規則エラーがあります(レポート名:' + config.report_name +')')
    }
  })

  if (config.behavior === globalConfig.updateStyle[1]) {
    if (config.dimensions.split(',').map(function (v) { return v.trim(); })[0] !== 'ga:date') {
      throw new Error(config.behavior + 'の利用は第一dimensionがga:dateの時に限ります(レポート名:'+ config.report_name +')')
    }
  }
}

/**
 * 最終抽出日(ga:dateから算出)を取得
 *
 * @param {Sheet} sheet
 * @param {Object} config
 * @return {String} date
 */
function getLastExtractionDate(sheet, config) {
  var startDate = util.resolveDate(config.start_date)
    , gaDateRegex = /(\d{4})(\d{2})(\d{2})/
    , lastRow = util.sheetLastRow('A', sheet)
    , lastDateStr
    , lastDate
    ;


  if (lastRow > globalConfig.headerNum) {
    lastDateStr = sheet.getRange(util.sheetCell('A', lastRow)).getValue();
    lastDate = Moment.moment(String(lastDateStr), 'YYYYMMDD').add(1, 'days').format('YYYY-MM-DD')

    if (Moment.moment(startDate).isBefore(lastDate)) {
      startDate = lastDate
    }
  }

  return startDate;
}



/**
 * Import unsampled report with file Id.
 *
 * @param {string} fileId
 * @return {object} report
 */
function importUnsampledReport(fileId) {
  var file = DriveApp.getFileById(fileId)
    , csvString = file.getBlob().getDataAsString()
    , data = Utilities.parseCsv(csvString)
    , trimedData = []
    , headers
    , rowset
    , i
    , segmentIdx
    ;

  // skip comment header
  data.forEach(function (v) {
    if (v[0].indexOf('#') === 0) { return; }
    trimedData.push(v);
  });

  headers = trimedData[0];
  rowset = trimedData.slice(1);

  /**
   * custom reportには含まれないga:segment列が入ることがあるので削除
   * 1reportにつきsegmentは1つまでしか含められないので不要
   */
  segmentIdx = headers.indexOf('ga:segment');
  if (segmentIdx && segmentIdx > 0) {
    headers.splice(segmentIdx, 1)
    rowset.forEach(function (row) {
      row.splice(segmentIdx, 1)
    })
  }

  return {
    containsSampledData: false,
    headers: headers,
    rowset: rowset
  };
}

/**
 * Format the report data.
 *
 * @param {object} report
 * @return {object}
 * @config {boolean} containsSampledData
 * @config {array} headers
 * @config {array} rowset
 */
function formatReportData(report) {
  var dimensions = report.query.dimensions.split(',')
    , metrics = report.query.metrics
    , rows = report.rows || []
    , headers = dimensions.concat(metrics)
    ;

  return {
    containsSampledData: report.containsSampledData,
    headers: headers,
    rowset: report.rows || []
  }
}

/**
 * Build a sheet of the report.
 *
 * @param {string} reportName
 * @param {object} formattedReport
 */
function assembleReportSheet(ss, reportName, formattedReport, config) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet()
    , sheet = util.sheetOpen(reportName, ss)
    , rows = formattedReport.rowset || []
    , columns = formattedReport.headers
    , rowset = {}
    , alpha = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
    , headerNum = globalConfig.headerNum
    , values
    , columnsMax = columns.length - 1
    , rowsMax
    , lastRow = util.sheetLastRow('A', sheet)
    ;

  rows.map(function (record) {
    record.forEach(function (val, idx) {
      column = columns[idx];
      rowset[column] = rowset[column] || [];
      rowset[column].push(val);
    });
  });

  if (config.behavior === globalConfig.updateStyle[0] || lastRow === 0) {
    sheet.getRange(util.sheetCell('A', 1)).setValue(reportName);
    values = [columns].concat(rows);
  } else {
    headerNum = lastRow + 1;
    values = rows;
  }

  if (values.length === 0) {
    return;
  }

  rowsMax = values.length -1;
  sheet.getRange(util.sheetCell(alpha[0], headerNum) + ':' + util.sheetCell(alpha[columnsMax], rowsMax + headerNum)).setValues(values);
}

/**
 * ----------------------------
 * outline.html's callbacks
 * ----------------------------
 */
function onAccountChanged(accountId) {
  return Analytics.Management.Webproperties.list(accountId);
}

function onPropertyChanged(accountId, propertyId) {
  var views = Analytics.Management.Profiles.list(accountId, propertyId, {fields: "items"})
    , customDimensions = Analytics.Management.CustomDimensions.list(accountId, propertyId, {fields: "items"})
    , customMetrics = Analytics.Management.CustomMetrics.list(accountId, propertyId, {fields: "items"})
    , metadata = formatMetadata(Analytics.Metadata.Columns.list('ga', {fields: "items"}))
    , dimensions = metadata.dimensions
    , metrics = metadata.metrics
    ;

  metrics['custom metrics'] = customMetrics.items;
  dimensions['custom dimensions'] = customDimensions.items;

  return {
    views: views,
    dimensions: dimensions,
    metrics: metrics
  };
}

function onFilterGeneratorClicked(config) {
  var template = HtmlService.createTemplateFromFile('filter.html')
    , accountId = config.account
    , propertyId = config.property
    , customDimensions = Analytics.Management.CustomDimensions.list(accountId, propertyId, {fields: "items"})
    , metadata = formatMetadata(Analytics.Metadata.Columns.list('ga', {fields: "items"}))
    , dimensions = {}
    , html
    ;

  dimensions = metadata.dimensions;
  dimensions['custom dimensions'] = customDimensions.items;
  template.dimensions = dimensions;

  html = template
    .evaluate()
    .setWidth(700)
    .setHeight(600)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, 'フィルタジェネレータ');
}

/**
 * ----------------------------
 * timer.html's callbacks
 * ----------------------------
 */

/**
 * set the polling timer
 *
 * @param {object} form
 */
function onTimerSetting(form) {
  var key = schedule.getId()
  schedule.save(key, form);

  if (schedule.isEnabled()) {
    return;
  }

  ScriptApp.newTrigger("timer")
   .timeBased()
   .everyHours(1)
   .create();
}


/**
 * ----------------------------
 * all_timer.html's callbacks
 * ----------------------------
 */

/**
 * remove timer
 *
 * @param {String} key
 */
function onTimerRemoved(key) {
  schedule.clear(key)
}
