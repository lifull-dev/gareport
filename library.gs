var util = {
  /**
   * Output to the log in an easy-to-see form.
   *
   * @param {mixed} data
   */
  log: function utilLog(data) {
    var type = Object.prototype.toString.call(data)
      ;

    if (type === '[object Object]' || type === '[object Array]') {
      Logger.log(JSON.stringify(data, null, '  '));
    } else {
      Logger.log(data);
    }
  },
  /**
   * resolve date format
   *
   * @param {Date} date
   * @return {string} 2017-01-23
   */
  resolveDate: function utilResolveDate(date) {
    var capture;

    if (!(date instanceof Date)) {
      switch(true) {
      case /^today$/.test(date):
        return Moment.moment().format('YYYY-MM-DD');
      case /^yesterday$/.test(date):
        return Moment.moment().subtract(1, 'day').format('YYYY-MM-DD');
      case /^\d{1,3}daysAgo$/.test(date):
        capture = /^(\d{1,3})daysAgo$/.exec(date)[1]
        return Moment.moment().subtract(+capture, 'day').format('YYYY-MM-DD');
      default:
        return date;
      }
    }

    return [
      date.getFullYear(),
      util.stringPadZero(date.getMonth()+1, 2),
      util.stringPadZero(date.getDate(), 2)
    ].join('-');
  },
  /**
   * get values of object
   *
   * @param {object} obj
   * @return {array} values
   */
  objectValues: function utilObjectValues(obj) {
    return Object.keys(obj).map(function (key) { return obj[key] });
  },
  /**
   * 与えられたObjectをマージした新しいObjectを返す
   *
   * @param {Object}
   * @return {Object}
   */
  objectMerge: function utilObjectMerge() {
    var args = Array.prototype.slice.call(arguments);

    return args.reduce(function (memo, a) {
      Object.keys(a).forEach(function (key) {
        memo[key] = a[key];
      });

      return memo;
    }, {})
  },
  /**
   * 与えられたobjectの値のないキーを削除する
   *
   * @param {Object} object
   * @return {Object}
   */
  objectCompact: function utilObjectCompact(object) {
    var res = {}
      ;

    Object.keys(object).forEach(function (key) {
      if (object[key]) {
        res[key] = object[key];
      }
    });

    return res;
  },
  /**
   * keyとvalueを反転させる
   *
   * @param {Object} object
   * @return {Object}
   */
  objectInvert: function utilObjectInvert(object) {
    var res = {}
      ;

    Object.keys(object).forEach(function (key) {
      var value = object[key];
      res[value] = key;
    });

    return res;
  },
  /**
   * Fill the numerical value with zero.
   *
   * @param {number|string} number ex. 3
   * @param {number} length ex. 2
   * @return {string} ex. "03"
   */
  stringPadZero: function utilStringPadZero(number, length) {
    return (Array(length).join('0') + number).slice(-length);
  },
  /**
   * Retrieve cells
   *
   * @param {string} column ex. "A", "BI"
   * @param {number} num ex. 1, 2, 3
   * @return {Cell} ex. A1's cell
   */
  sheetCell: function utilSheetCell(column, num) {
    return (column.toUpperCase() + num);
  },
  /**
   * シートの指定されたカラムの最終行を取得する
   *
   * @param {string} column ex. "A", "BI"
   * @return {Number}
   */
  sheetLastRow: function utilSheetLastRow(column, sheet) {
    var i, iz, values, value;

    values = sheet.getRange([column, column].join(':')).getValues();
    for (i = values.length - 1; i >= 0; i--) {
      value = values[i][0];
      if (!!String(value).trim()) {
        return i + 1;
      }
    }
    return 0;
  },
  /**
   * Open the sheet. (Create a new sheet if it is not there)
   *
   * @param {string} sheetName
   * @return {Sheet}
   */
  sheetOpen: function utilSheetOpen(sheetName, ss) {
    var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet()
      , sheet
      ;

    try {
      spreadsheet.insertSheet(sheetName);
    }catch(e) {}
    sheet = spreadsheet.getSheetByName(sheetName);

    return sheet;
  },
};

var schedule = {
  /**
   * is timer enable?
   *
   * @return {Boolean}
   */
  isEnabled: function scheduleIsEnabled() {
    var triggers = ScriptApp.getProjectTriggers()
      , i
      , iz
      ;

    for (i = 0, iz = triggers.length; i < iz; i++) {
      if ('timer' === triggers[i].getHandlerFunction()) {
        return true;
      }
    }

    return false;
  },
  /**
   * Retrice timer id (properties key)
   *
   * @return {string}
   */
  getId: function scheduleGetId() {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  },
  /**
   * get timer information by fileid
   *
   * @return {object}
   */
  get: function scheduleGet(key) {
    var allItems = schedule.getAll()
      ;

    return allItems[key] || {};
  },
  /**
   * get timer information (by form/properties)
   *
   * @return {object}
   */
  getCurrent: function scheduleGetCurrent() {
    var key = schedule.getId()
    return this.get(key);
  },
  /**
   * すべてのタイマー設定を取得
   *
   * @return {Object} {fileid: config, fileid: config, ...}
   */
  getAll: function scheduleGetAll() {
    var userProperty = PropertiesService.getUserProperties()
      , namespace = globalConfig.namespace
      , raw
      ;

    raw = userProperty.getProperty(namespace);

    if (raw) {
      return JSON.parse(raw);
    }

    return {};
  },
  /**
   * clear timer
   *
   * @param {String} key
   */
  clear: function scheduleClear(key) {
    var allItems = this.getAll()
      ;

    delete allItems[key];
    this.saveAll(allItems)
  },
  /**
   * set timer information (by form/properties)
   *
   * @param {object} form
   * @param {string} key
   */
  save: function scheduleSave(key, form) {
    var allItems = schedule.getAll()
      ;

    allItems[key] = form;
    this.saveAll(allItems)
  },
  /**
   * save all timer
   *
   * @param {Object} {key: setting, ....}
   */
  saveAll: function scheduleSaveAll(allItems) {
    var config = globalConfig
      , userProperty = PropertiesService.getUserProperties()
      , namespace = config.namespace
      ;

    userProperty.setProperty(namespace, JSON.stringify(allItems || {}))
  },
  /**
   * put last error in timer setting
   *
   * @param {String} key file id
   * @param {Object} errObj error
   */
  saveLastError: function scheduleSaveLastError(key, errObj) {
    var setting = this.get(key)
      ;
    setting.lastError = errObj;
    this.save(key, setting);
  },
  /**
   * remove last error in timer setting
   *
   * @param {String} key file id
   */
  removeLastError: function scheduleRemoveLastError(key) {
    var setting = this.get(key);
    delete setting.lastError;
    this.save(key, setting);
  }
}
