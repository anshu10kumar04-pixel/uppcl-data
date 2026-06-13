
const fs = require('fs');
const path = require('fs');

function pf(v){
  if(v===undefined || v===null || v==='' || v==='-') return 0;
  return parseFloat(String(v).replace(/,/g,'')) || 0;
}

function ac(id){
  return String(id||'').replace(/^0+/,'').trim();
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

function parseCSVLine(line){
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
    return v.map(val => val.replace(/^"|"$/g, '').trim());
}

async function runDebug(){
    console.log("--- DEBUG REPORT ---");
    
    // 1. Check Manifest
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    console.log("Manifest loaded.");
    
    let MASTER_CUTOFF = null;
    if(manifest.sync_status){
        const mp = manifest.sync_status["233511"].master_period;
        const p = mp.split('_');
        const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
        MASTER_CUTOFF = new Date(parseInt(p[1]), months[p[0].toUpperCase()] + 1, 0);
        console.log("MASTER_PERIOD:", mp, "-> CUTOFF:", MASTER_CUTOFF.toDateString());
    }

    // 2. Sample Master File Check
    const masterFiles = manifest.eudd1;
    const masterMap = {};
    let masterWithData = 0;
    
    console.log("Checking master files in master/ folder...");
    for(const f of masterFiles){
        const filePath = 'master/' + (f.startsWith('master/') ? f.slice(7) : f);
        if(!fs.existsSync(filePath)) { continue; }
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        for(let i=1; i<lines.length; i++){
            const v = parseCSVLine(lines[i]);
            if(v.length < 3) continue;
            const acct = ac(v[0]);
            const out = v[v.length-1];
            if(out && out !== '0' && out !== ''){
                masterWithData++;
                masterMap[acct] = out;
            }
        }
    }
    console.log("Total records with balance in master/ folder:", masterWithData);

    // 2b. Root File Check
    let rootWithData = 0;
    ['EUDD1.csv', 'EUDD2.csv'].forEach(f => {
        if(!fs.existsSync(f)) return;
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        for(let i=1; i<lines.length; i++){
            const v = parseCSVLine(lines[i]);
            if(v.length < 3) continue;
            const acct = ac(v[0]);
            const out = v[v.length-1];
            if(out && out !== '0' && out !== ''){
                rootWithData++;
                if(!masterMap[acct]) masterMap[acct] = out;
            }
        }
    });
    console.log("Total records with balance in ROOT EUDD files:", rootWithData);

    // 3. Sample Unbilled Check
    const unbilledFiles = manifest.unbilled_eudd1;
    console.log("Checking unbilled files for matches...");
    let matched = 0;
    let deducted = 0;
    
    for(const f of unbilledFiles){
        if(!fs.existsSync(f)) { console.log("Missing file:", f); continue; }
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        // Find header first
        let headerIdx = 0;
        while(headerIdx < lines.length && !lines[headerIdx].includes("ACCT_ID")) headerIdx++;
        
        for(let i=headerIdx+1; i<lines.length; i++){
            const v = parseCSVLine(lines[i]);
            if(v.length < 30) continue;
            const acct = ac(v[0]);
            if(masterMap[acct]){
                matched++;
                const masterOut = pf(masterMap[acct]);
                const payDate = parseDate(v[28]);
                const payAmt = pf(v[29]);
                
                if(payDate && MASTER_CUTOFF && payDate > MASTER_CUTOFF){
                    deducted++;
                }
                
                if(matched <= 5){
                    console.log(`Match Found: ${acct}`);
                    console.log(`  Master Out: ${masterOut}`);
                    console.log(`  Pay Date: ${v[28]} (Parsed: ${payDate ? payDate.toDateString() : 'FAIL'})`);
                    console.log(`  Pay Amt: ${payAmt}`);
                    console.log(`  Deductible: ${payDate > MASTER_CUTOFF}`);
                }
            }
        }
    }
    console.log("Total matches between Unbilled and Master:", matched);
    console.log("Total records where payment would be deducted:", deducted);
}

runDebug();
