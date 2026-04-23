import pandas as pd
import os

# ---------------------------------------------------------------------------
# CICIDS 2017 - Full Week Processor
# Slices each day's CSV into a balanced, engine-safe training file.
# Just drop all the raw CICIDS files in the same folder and run this script.
# ---------------------------------------------------------------------------

# Columns your engine and traffic generator expect
COLUMNS_TO_KEEP = [
    'Destination Port', 'Flow Duration', 'Total Fwd Packets',
    'Total Backward Packets', 'Total Length of Fwd Packets',
    'Fwd Packet Length Max', 'Fwd Packet Length Min',
    'Fwd Packet Length Mean', 'Flow Bytes/s', 'Flow Packets/s',
    'Label'
]

# Each file, how many rows per class to sample, and the output name
# Rows per class: 5000 is safe. Bump to 10000 if your machine can handle it.
ROWS_PER_CLASS = 5000

DATASET_MANIFEST = [
    {
        'input':  'Monday-WorkingHours.pcap_ISCX.csv',
        'output': 'monday_baseline.csv',
        'note':   'Benign only — used to establish normal traffic baseline'
    },
    {
        'input':  'Tuesday-WorkingHours.pcap_ISCX.csv',
        'output': 'tuesday_bruteforce.csv',
        'note':   'FTP-Patator + SSH-Patator'
    },
    {
        'input':  'Wednesday-workingHours.pcap_ISCX.csv',
        'output': 'wednesday_dos.csv',
        'note':   'DoS Slowloris, SlowHTTPTest, Hulk, GoldenEye, Heartbleed'
    },
    {
        'input':  'Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv',
        'output': 'thursday_webattacks.csv',
        'note':   'Web Attacks: Brute Force, XSS, SQL Injection'
    },
    {
        'input':  'Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv',
        'output': 'thursday_infiltration.csv',
        'note':   'Infiltration attacks'
    },
    {
        'input':  'Friday-WorkingHours-Morning.pcap_ISCX.csv',
        'output': 'friday_portscan.csv',
        'note':   'Port Scan'
    },
    {
        'input':  'Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv',
        'output': 'friday_ddos.csv',
        'note':   'DDoS — your existing goldilocks dataset'
    },
    {
        'input':  'Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv',
        'output': 'friday_portscan_botnet.csv',
        'note':   'Botnet ARES'
    },
]


def process_file(entry):
    input_file  = entry['input']
    output_file = entry['output']
    note        = entry['note']

    if not os.path.exists(input_file):
        print(f"  [SKIP] '{input_file}' not found — skipping.")
        return None

    print(f"\n{'='*55}")
    print(f"  Processing: {input_file}")
    print(f"  Note: {note}")

    df = pd.read_csv(input_file, low_memory=False)
    df.columns = df.columns.str.strip()
    df.replace([float('inf'), float('-inf')], pd.NA, inplace=True)
    df.dropna(subset=['Label'], inplace=True)

    print(f"  Loaded {len(df):,} rows | Attack types: {list(df['Label'].unique())}")

    # Keep only the columns the engine needs
    available_cols = [c for c in COLUMNS_TO_KEEP if c in df.columns]
    missing_cols   = [c for c in COLUMNS_TO_KEEP if c not in df.columns]
    if missing_cols:
        print(f"  [WARN] Missing columns (will be skipped): {missing_cols}")
    df = df[available_cols]

    # Separate benign and attack rows
    benign_df = df[df['Label'].str.strip().str.upper() == 'BENIGN']
    attack_df = df[df['Label'].str.strip().str.upper() != 'BENIGN']

    # Monday is benign-only — handle gracefully
    if len(attack_df) == 0:
        print(f"  No attack rows found — saving benign-only slice.")
        sliced = benign_df.head(ROWS_PER_CLASS * 2).sample(frac=1, random_state=42)
    else:
        # Balance: equal benign and attack rows, capped at ROWS_PER_CLASS each
        n_benign = min(len(benign_df), ROWS_PER_CLASS)
        n_attack = min(len(attack_df), ROWS_PER_CLASS)

        sliced = pd.concat([
            benign_df.head(n_benign),
            attack_df.head(n_attack)
        ]).sample(frac=1, random_state=42)

    sliced.to_csv(output_file, index=False)
    print(f"  Saved '{output_file}' — {len(sliced):,} rows x {len(sliced.columns)} columns")
    print(f"  Class breakdown: {dict(sliced['Label'].value_counts())}")
    return output_file


def main():
    print("\n" + "="*55)
    print("  CICIDS 2017 Full Week Processor")
    print("  Each file will be sliced to a balanced, engine-safe size.")
    print("="*55)

    saved_files = []
    skipped     = []

    for entry in DATASET_MANIFEST:
        result = process_file(entry)
        if result:
            saved_files.append(result)
        else:
            skipped.append(entry['input'])

    print(f"\n{'='*55}")
    print(f"  Done! {len(saved_files)} file(s) processed:")
    for f in saved_files:
        print(f"    ✅ {f}")

    if skipped:
        print(f"\n  {len(skipped)} file(s) not found (download from Kaggle):")
        for f in skipped:
            print(f"    ⚠  {f}")

    print("\n  Upload each output CSV to Warden and train in this order:")
    print("  1. monday_baseline.csv       → establishes normal traffic")
    print("  2. tuesday_bruteforce.csv    → brute force signatures")
    print("  3. wednesday_dos.csv         → DoS/DDoS signatures")
    print("  4. thursday_webattacks.csv   → web attack signatures")
    print("  5. thursday_infiltration.csv → infiltration signatures")
    print("  6. friday_portscan.csv       → port scan signatures")
    print("  7. friday_ddos.csv           → DDoS (you already have this)")
    print("  8. friday_portscan_botnet.csv → botnet signatures")
    print("="*55)


if __name__ == '__main__':
    main()