const fs = require('fs');

const csv = fs.readFileSync('past_results.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim().length > 0);

const header = lines[0].split(',');
const playerNames = header.slice(3).map(n => n.trim()).filter(n => n.length > 0);

let sql = `DO $$
DECLARE
  v_session_id uuid;
  v_player_id uuid;
BEGIN
`;

for (let i = 1; i < lines.length; i++) {
  const row = lines[i].split(',');
  if (!row[0]) continue;
  
  const gameNum = row[0].trim();
  const date = row[1].trim();
  const bCents = Math.round(parseFloat(row[2].trim()) * 100);
  
  sql += `  -- Game ${gameNum} (${date})\n`;
  sql += `  INSERT INTO sessions (played_at, reconciled) VALUES ('${date}', true) RETURNING id INTO v_session_id;\n`;
  
  for (let j = 0; j < playerNames.length; j++) {
    const valStr = row[3 + j] ? row[3 + j].trim() : "";
    if (!valStr) continue;
    
    const net = parseFloat(valStr);
    if (isNaN(net)) continue;
    
    const netCents = Math.round(net * 100);
    
    let totalBuyIn, cashOut;
    if (netCents > 0) {
      totalBuyIn = bCents;
      cashOut = bCents + netCents;
    } else {
      const loss = Math.abs(netCents);
      if (loss === 0) {
        totalBuyIn = bCents;
        cashOut = bCents;
      } else {
        totalBuyIn = Math.max(bCents, Math.ceil(loss / bCents) * bCents);
        cashOut = totalBuyIn - loss;
      }
    }
    
    const safeName = playerNames[j].replace(/'/g, "''");
    
    sql += `  SELECT id INTO v_player_id FROM players WHERE lower(name) = lower('${safeName}') LIMIT 1;\n`;
    sql += `  IF v_player_id IS NULL THEN\n`;
    sql += `    INSERT INTO players (name, is_guest) VALUES ('${safeName}', true) RETURNING id INTO v_player_id;\n`;
    sql += `  END IF;\n`;
    
    sql += `  INSERT INTO buy_ins (session_id, player_id, amount_cents) VALUES (v_session_id, v_player_id, ${totalBuyIn});\n`;
    sql += `  INSERT INTO cash_outs (session_id, player_id, reported_amount_cents, adjusted_amount_cents) VALUES (v_session_id, v_player_id, ${cashOut}, ${cashOut});\n`;
  }
  sql += `\n`;
}

sql += `END;\n$$;\n`;

fs.writeFileSync('import_results.sql', sql);
console.log('Done');
