import csv
import math

csv_file = "past_results.csv"
sql_file = "import_results.sql"

def clean_name(name):
    return name.strip()

with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    
    # Columns: Game #,Date,Buy-in, <players...>
    player_names = [clean_name(p) for p in header[3:] if p.strip()]
    
    sql = []
    sql.append("DO $$")
    sql.append("DECLARE")
    sql.append("  v_session_id uuid;")
    sql.append("  v_player_id uuid;")
    sql.append("BEGIN")
    
    for row in reader:
        if not row or not any(row):
            continue
            
        game_num = row[0].strip()
        if not game_num:
            continue
            
        date = row[1].strip()
        default_buy_in = float(row[2].strip())
        b_cents = int(default_buy_in * 100)
        
        sql.append(f"  -- Game {game_num} ({date})")
        sql.append(f"  INSERT INTO sessions (played_at, reconciled) VALUES ('{date}', true) RETURNING id INTO v_session_id;")
        
        for i, player_name in enumerate(player_names):
            val_str = row[3 + i].strip() if (3 + i) < len(row) else ""
            if not val_str:
                continue
                
            try:
                net = float(val_str)
            except ValueError:
                continue
                
            net_cents = int(round(net * 100))
            
            # Compute total buy-in and cash-out
            if net_cents > 0:
                total_buy_in = b_cents
                cash_out = b_cents + net_cents
            else:
                loss = abs(net_cents)
                if loss == 0:
                    total_buy_in = b_cents
                    cash_out = b_cents
                else:
                    total_buy_in = max(b_cents, int(math.ceil(loss / b_cents)) * b_cents)
                    cash_out = total_buy_in - loss
                    
            # Generate player lookup/insert
            safe_name = player_name.replace("'", "''")
            sql.append(f"  SELECT id INTO v_player_id FROM players WHERE lower(name) = lower('{safe_name}') LIMIT 1;")
            sql.append(f"  IF v_player_id IS NULL THEN")
            sql.append(f"    INSERT INTO players (name, is_guest) VALUES ('{safe_name}', true) RETURNING id INTO v_player_id;")
            sql.append(f"  END IF;")
            
            # Insert buy-in
            sql.append(f"  INSERT INTO buy_ins (session_id, player_id, amount_cents) VALUES (v_session_id, v_player_id, {total_buy_in});")
            
            # Insert cash-out
            sql.append(f"  INSERT INTO cash_outs (session_id, player_id, reported_amount_cents, adjusted_amount_cents) VALUES (v_session_id, v_player_id, {cash_out}, {cash_out});")
            
        sql.append("")
        
    sql.append("END;")
    sql.append("$$;")
    
with open(sql_file, 'w') as f:
    f.write("\n".join(sql))

print("Generated import_results.sql successfully.")
