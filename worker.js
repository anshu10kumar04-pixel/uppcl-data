
// Web Worker - parses CSV in background thread
self.onmessage = function(e) {
  var files = e.data;
  var allRows = [];
  var allPay = {};

  files.forEach(function(item, i) {
    if (!item.text) return;
    var result = parseFile(item.text);
    allRows = allRows.concat(result.rows);
    Object.assign(allPay, result.pay);
    self.postMessage({type:'progress', done: i+1, total: files.length});
  });

  self.postMessage({type:'done', rows: allRows, pay: allPay});
};

function parseFile(text) {
  var rows = [], pay = {};
  var nl = text.indexOf('\n');
  if (nl < 0) return {rows:[], pay:{}};
  
  var hdrs = text.substring(0, nl).replace(/\r/,'').split(',')
    .map(function(h){ return h.replace(/"/g,'').trim(); });

  var iAcct=hdrs.indexOf('ACCT_ID'), iMob=hdrs.indexOf('MOBILE_NO'),
      iName=hdrs.indexOf('NAME'), iFath=hdrs.indexOf('FATHER_NAME'),
      iAddr=hdrs.indexOf('ADDRESS'), iCat=hdrs.indexOf('CATEGORY'),
      iLoad=hdrs.indexOf('LOAD'), iLat=hdrs.indexOf('LAT'),
      iLon=hdrs.indexOf('LON'), iSub=hdrs.indexOf('SUBSTATION'),
      iFeed=hdrs.indexOf('FEEDER'), iSerl=hdrs.indexOf('SERIAL_NBR'),
      iPayAmt=hdrs.indexOf('LP AMT'), iPayDate=hdrs.indexOf('LP DATE'),
      iTotOut=hdrs.indexOf('TOTAL OUTSTANDING');

  if(iPayAmt<0) iPayAmt=hdrs.indexOf('PAY_AMT');
  if(iPayDate<0) iPayDate=hdrs.indexOf('PAY_DATE');
  if(iTotOut<0) iTotOut=hdrs.indexOf('TOTAL_OUTSTANDING');

  var pos = nl + 1, len = text.length;

  while (pos < len) {
    var end = text.indexOf('\n', pos);
    if (end < 0) end = len;
    var line = text.substring(pos, end);
    pos = end + 1;
    if (!line || line === '\r') continue;

    var v = line.split(',');
    var acct = v[iAcct];
    if (!acct) continue;
    acct = acct.replace(/"/g,'').trim();
    if (!acct) continue;

    var lat = (v[iLat]||'').replace(/"/g,'');
    var lon = (v[iLon]||'').replace(/"/g,'');
    var fLat = parseFloat(lat), fLon = parseFloat(lon);
    if (fLat > 50) { var t=lat; lat=lon; lon=t; }

    var rawAmt  = iPayAmt>=0  ? (v[iPayAmt] ||'').replace(/"/g,'') : '-';
    var rawDate = iPayDate>=0 ? (v[iPayDate]||'').replace(/"/g,'') : '-';
    if (rawAmt && rawDate && /\d{2}-\d{2}-\d{4}/.test(rawAmt)) {
      var tmp=rawAmt; rawAmt=rawDate; rawDate=tmp;
    }

    var row = {
      ACCT_ID: acct,
      MOBILE_NO:  (v[iMob] ||'').replace(/"/g,''),
      NAME:       (v[iName]||'').replace(/"/g,''),
      FATHER_NAME:iFath>=0?(v[iFath]||'').replace(/"/g,''):'',
      ADDRESS:    (v[iAddr]||'').replace(/"/g,''),
      CATEGORY:   (v[iCat] ||'').replace(/"/g,''),
      LOAD:       (v[iLoad]||'').replace(/"/g,''),
      LAT: lat, LON: lon,
      SUBSTATION: (v[iSub] ||'').replace(/"/g,''),
      FEEDER:     (v[iFeed]||'').replace(/"/g,''),
      SERIAL_NBR: iSerl>=0?(v[iSerl]||'').replace(/"/g,''):'',
      Google_Map_Link: (lat&&lon)?'https://www.google.com/maps?q='+lat+','+lon:''
    };

    if (iPayAmt >= 0) {
      pay[acct] = {
        PAY_AMT: rawAmt, PAY_DATE: rawDate,
        TOTAL_OUTSTANDING: iTotOut>=0?(v[iTotOut]||'-').replace(/"/g,''):'-',
        STATUS: 'INSERVICE', NAME: row.NAME,
        SUPPLY_TYPE: row.CATEGORY||'-', CLOSING_READING: '-'
      };
    }
    rows.push(row);
  }
  return {rows: rows, pay: pay};
}
