
// Simulation of index.html logic
const MASTER_MAP = {};
let MASTER_CUTOFF = null;
const PAY_DATA = {};

function pf(v){
  if(v===undefined || v===null || v==='' || v==='-') return 0;
  return parseFloat(String(v).replace(/,/g,'')) || 0;
}

function parseDate(s){
  if(!s || s==='-') return null;
  s = String(s).trim().toUpperCase();
  var parts = s.split(/[-\/]/);
  if(parts.length===3){
    var d = parseInt(parts[0]), m, y = parseInt(parts[2]);
    if(isNaN(d)) return null;
    if(parts[1].length===3){
        var months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
        m = months[parts[1]];
    } else {
        m = parseInt(parts[1]) - 1;
    }
    if(y < 100) y += 2000;
    return new Date(y, m, d);
  }
  return null;
}

// Mock Manifest
const manifest = {
  sync_status: {
    "233511": { master_period: "MAY_2026" }
  }
};

// Set Cutoff
const mp = manifest.sync_status["233511"].master_period;
const p = mp.split('_');
const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
MASTER_CUTOFF = new Date(parseInt(p[1]), months[p[0].toUpperCase()] + 1, 0);
console.log("MASTER_CUTOFF:", MASTER_CUTOFF.toDateString());

// Sample Master Data (with unquoted commas)
const masterLine = '2751522265,9453101075,SMT SUMAN GUPTA,ADDRESS WITH, COMMA,,1,25.46,78.58,SUB,FEEDER,30-APR-26,"1,000.00","5,000.00"';

function parseMaster(line){
    var v = [];
    var inQuotes = false;
    var current = '';
    for(var i=0; i<line.length; i++){
      var c = line[i];
      if(c==='"' && (i===0 || line[i-1]!== '\\')){ inQuotes = !inQuotes; }
      else if(c===',' && !inQuotes){ v.push(current.trim()); current = ''; }
      else { current += c; }
    }
    v.push(current.trim());
    v = v.map(val => val.replace(/^"|"$/g, '').trim());

    const acct = v[0];
    const outValue = v[v.length - 1];
    const rawAmt = v[v.length - 2];
    const rawDate = v[v.length - 3];
    
    MASTER_MAP[acct] = {
      TOTAL_OUTSTANDING: outValue,
      LP_DATE: rawDate,
      LP_AMT: rawAmt
    };
    console.log("MASTER_MAP Entry:", acct, MASTER_MAP[acct]);
}

parseMaster(masterLine);

// Sample Unbilled Data (June payment)
const unbilledLine = '"2751522265",,"BOOK",,"MOB",,,,,"NAME","ADDR","LMV1","10",,"SUB","FEED","POLE","MTR",2,"KW","A","12-MAY-26","N","05-JUN-26","2,000.00"';
// Columns based on unbilled header found earlier:
// "ACCT_ID","KNO","BOOK_NO","MOBILE_NO",...,"NAME","ADDRESS","TARIFF_TYPE","SUPPLY_TYPE",...,"SUBSTATION","FEEDER",...,"LAST_PAY_DATE","LAST_PAY_AMT"

function parseUnbilled(line){
    var v = [];
    var inQuotes = false;
    var current = '';
    for(var i=0; i<line.length; i++){
      var c = line[i];
      if(c==='"' && (i===0 || line[i-1]!== '\\')){ inQuotes = !inQuotes; }
      else if(c===',' && !inQuotes){ v.push(current.trim()); current = ''; }
      else { current += c; }
    }
    v.push(current.trim());
    v = v.map(val => val.replace(/^"|"$/g, '').trim());

    const acct = v[0];
    // Unbilled Indices (estimated from earlier read)
    // 0: ACCT_ID
    // 28: LAST_PAY_DATE (actually 28 in my count? Let's check header again)
    // ACCT_ID,KNO,BOOK_NO,MOBILE_NO,DISCOM,ZONE_CODE,ZONE_NAME,CIRCLE_CODE,CIRCLE_NAME,DIV_CODE,DIV_NAME,SDO_CODE,SDO_NAME,SCNO,NAME,ADDRESS,TARIFF_TYPE,SUPPLY_TYPE,DT,SUBSTATION,FEEDER,POLE,MTR_SRL_NO,SANCTION_LOAD,SANCTION_LOAD_UOM,METER_STATUS,LAST_BILL_DATE,ACCT_INF_FLG,LAST_PAY_DATE,LAST_PAY_AMT,PRESYS_CODE
    // Indices:
    // 0: ACCT_ID
    // 28: LAST_PAY_DATE
    // 29: LAST_PAY_AMT
    
    const rawDate = v[28];
    const rawAmt = v[29];
    
    console.log("UNBILLED Parsing:", acct, "Date:", rawDate, "Amt:", rawAmt);

    const master = MASTER_MAP[acct];
    if(master){
        let mOut = pf(master.TOTAL_OUTSTANDING);
        const curLpDate = parseDate(rawDate);
        if(curLpDate && MASTER_CUTOFF && curLpDate > MASTER_CUTOFF){
            mOut -= pf(rawAmt);
            console.log("Payment deducted:", pf(rawAmt), "New balance:", mOut);
        }
        PAY_DATA[acct] = {
            TOTAL_OUTSTANDING: mOut.toString(),
            PAY_AMT: rawAmt,
            PAY_DATE: rawDate
        };
    } else {
        console.log("Master record not found for", acct);
    }
}

parseUnbilled(unbilledLine);
console.log("Final PAY_DATA:", PAY_DATA["2751522265"]);
