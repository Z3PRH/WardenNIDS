import pandas as pd
import os

# ---------------------------------------------------------------------------
# UNSW-NB15 - Full Dataset Processor
# Handles BOTH .parquet and .csv file formats automatically.
#
# If your files are .parquet, install the required engine first:
#   pip install pyarrow
#
# Files expected (download from Kaggle or UNSW official):
#   UNSW-NB15_1.parquet / .csv  (raw, parts 1-4)
#   UNSW_NB15_training-set.parquet / .csv
#   UNSW_NB15_testing-set.parquet / .csv
# ---------------------------------------------------------------------------

ROWS_PER_CLASS = 5000

# Official 49 UNSW-NB15 column names — only needed for raw CSV files with no header
RAW_COLUMN_NAMES = [
    'srcip', 'sport', 'dstip', 'dsport', 'proto', 'state', 'dur',
    'sbytes', 'dbytes', 'sttl', 'dttl', 'sloss', 'dloss', 'service',
    'sload', 'dload', 'spkts', 'dpkts', 'swin', 'dwin', 'stcpb',
    'dtcpb', 'smeansz', 'dmeansz', 'trans_depth', 'res_bdy_len',
    'sjit', 'djit', 'stime', 'ltime', 'sintpkt', 'dintpkt', 'tcprtt',
    'synack', 'ackdat', 'is_sm_ips_ports', 'ct_state_ttl',
    'ct_flw_http_mthd', 'is_ftp_login', 'ct_ftp_cmd', 'ct_srv_src',
    'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 'ct_src_dport_ltm',
    'ct_dst_sport_ltm', 'ct_dst_src_ltm', 'attack_cat', 'label'
]

COLUMNS_TO_KEEP = [
    'proto', 'dur', 'sbytes', 'dbytes', 'sttl', 'dttl',
    'sloss', 'dloss', 'sload', 'dload', 'spkts', 'dpkts',
    'sjit', 'djit', 'tcprtt', 'synack', 'ackdat',
    'ct_srv_src', 'ct_srv_dst', 'ct_state_ttl',
    'is_sm_ips_ports', 'is_ftp_login',
    'attack_cat',
    'label'
]

ATTACK_CATEGORIES = [
    'Fuzzers', 'Analysis', 'Backdoors', 'DoS',
    'Exploits', 'Generic', 'Reconnaissance', 'Shellcode', 'Worms',
]

# Each entry lists the base name — script will find .parquet or .csv automatically
DATASET_MANIFEST = [
    {'base': 'UNSW-NB15_1',            'has_header': False, 'note': 'Raw part 1 of 4'},
    {'base': 'UNSW-NB15_2',            'has_header': False, 'note': 'Raw part 2 of 4'},
    {'base': 'UNSW-NB15_3',            'has_header': False, 'note': 'Raw part 3 of 4'},
    {'base': 'UNSW-NB15_4',            'has_header': False, 'note': 'Raw part 4 of 4'},
    {'base': 'UNSW_NB15_training-set', 'has_header': True,  'note': 'Pre-split training set'},
    {'base': 'UNSW_NB15_testing-set',  'has_header': True,  'note': 'Pre-split testing set'},
]


def find_file(base: str) -> tuple[str, str] | tuple[None, None]:
    """
    Look for base.parquet first, then base.csv.
    Returns (filepath, format) or (None, None) if neither exists.
    """
    for ext, fmt in [('.parquet', 'parquet'), ('.csv', 'csv')]:
        path = base + ext
        if os.path.exists(path):
            return path, fmt
    return None, None


def load_file(entry) -> pd.DataFrame | None:
    """Load a single UNSW file — handles parquet and csv, with or without headers."""
    path, fmt = find_file(entry['base'])

    if path is None:
        print(f"  [SKIP] '{entry['base']}' not found (.parquet or .csv) — skipping.")
        return None

    print(f"  Loading '{path}' [{fmt.upper()}] ({entry['note']})...")

    try:
        if fmt == 'parquet':
            # Parquet files always have column names embedded
            df = pd.read_parquet(path)
            df.columns = df.columns.str.strip().str.lower()

        elif fmt == 'csv':
            if entry['has_header']:
                df = pd.read_csv(path, low_memory=False)
                df.columns = df.columns.str.strip().str.lower()
            else:
                # Raw UNSW CSV files have no header row
                df = pd.read_csv(path, header=None, low_memory=False)
                df.columns = RAW_COLUMN_NAMES

    except Exception as e:
        print(f"  [ERROR] Failed to load '{path}': {e}")
        if fmt == 'parquet':
            print("  → Make sure pyarrow is installed: pip install pyarrow")
        return None

    print(f"  Loaded {len(df):,} rows x {len(df.columns)} columns")
    return df


def process_combined(all_dfs: list[pd.DataFrame]):
    """Merge all files, then produce one output CSV per attack category."""
    print("\n[INFO] Merging all loaded files...")
    df = pd.concat(all_dfs, ignore_index=True)
    df.replace([float('inf'), float('-inf')], pd.NA, inplace=True)

    # Normalize label columns
    df['label']      = df['label'].astype(str).str.strip()
    df['attack_cat'] = df['attack_cat'].astype(str).str.strip().str.title()

    # Keep only engine-relevant columns
    available_cols = [c for c in COLUMNS_TO_KEEP if c in df.columns]
    missing_cols   = [c for c in COLUMNS_TO_KEEP if c not in df.columns]
    if missing_cols:
        print(f"  [WARN] Missing columns (skipped): {missing_cols}")
    df = df[available_cols]

    print(f"  Combined: {len(df):,} rows x {len(df.columns)} columns")
    print(f"  Attack categories: {sorted(df['attack_cat'].unique())}")

    normal_df = df[df['label'] == '0']
    attack_df = df[df['label'] == '1']
    print(f"  Normal: {len(normal_df):,} | Attack: {len(attack_df):,}")

    saved_files = []

    # --- Full balanced slice (all attack types vs normal) ---
    n = min(len(normal_df), ROWS_PER_CLASS)
    a = min(len(attack_df), ROWS_PER_CLASS)
    full_slice = pd.concat([
        normal_df.sample(n, random_state=42),
        attack_df.sample(a, random_state=42)
    ]).sample(frac=1, random_state=42)

    full_slice = full_slice.rename(columns={'attack_cat': 'Label'})
    full_slice.drop(columns=['label'], inplace=True, errors='ignore')

    out = 'unsw_full_balanced.csv'
    full_slice.to_csv(out, index=False)
    print(f"\n  ✅ '{out}' — {len(full_slice):,} rows (all attack types vs normal)")
    saved_files.append(out)

    # --- One file per attack category ---
    for category in ATTACK_CATEGORIES:
        cat_df = df[df['attack_cat'] == category]
        if len(cat_df) == 0:
            print(f"  [SKIP] No rows for '{category}'")
            continue

        n_normal = min(len(normal_df), ROWS_PER_CLASS)
        n_attack = min(len(cat_df),    ROWS_PER_CLASS)

        sliced = pd.concat([
            normal_df.sample(n_normal, random_state=42),
            cat_df.sample(n_attack,    random_state=42)
        ]).sample(frac=1, random_state=42)

        sliced = sliced.rename(columns={'attack_cat': 'Label'})
        sliced.drop(columns=['label'], inplace=True, errors='ignore')

        out = f"unsw_{category.lower()}.csv"
        sliced.to_csv(out, index=False)
        print(f"  ✅ '{out}' — {len(sliced):,} rows "
              f"(Normal: {n_normal} | {category}: {n_attack})")
        saved_files.append(out)

    return saved_files


def main():
    print("\n" + "="*55)
    print("  UNSW-NB15 Full Dataset Processor")
    print("  Supports both .parquet and .csv formats.")
    print("="*55)

    # Check pyarrow is available if any parquet files exist
    parquet_found = any(os.path.exists(e['base'] + '.parquet') for e in DATASET_MANIFEST)
    if parquet_found:
        try:
            import pyarrow  # noqa
            print("  [OK] pyarrow detected — parquet files supported.")
        except ImportError:
            print("  [ERROR] Parquet files found but pyarrow is not installed.")
            print("  Run: pip install pyarrow  then try again.")
            return

    all_dfs = []
    skipped = []

    for entry in DATASET_MANIFEST:
        df = load_file(entry)
        if df is not None:
            all_dfs.append(df)
        else:
            skipped.append(entry['base'])

    if not all_dfs:
        print("\n[ERROR] No UNSW files found. Place them in the same folder as this script.")
        return

    saved_files = process_combined(all_dfs)

    print(f"\n{'='*55}")
    print(f"  Done! {len(saved_files)} file(s) ready for Warden:")
    for f in saved_files:
        print(f"    ✅ {f}")

    if skipped:
        print(f"\n  {len(skipped)} file(s) not found:")
        for f in skipped:
            print(f"    ⚠  {f}")

    print("\n  Recommended training order in Warden (select UNSW-NB15 in dropdown):")
    print("  1.  unsw_full_balanced.csv   → broad overview, train this first")
    print("  2.  unsw_dos.csv             → DoS signatures")
    print("  3.  unsw_exploits.csv        → Exploit signatures")
    print("  4.  unsw_reconnaissance.csv  → Recon/scanning")
    print("  5.  unsw_generic.csv         → Generic attack patterns")
    print("  6.  unsw_fuzzers.csv         → Fuzzer signatures")
    print("  7.  unsw_backdoors.csv       → Backdoor signatures")
    print("  8.  unsw_analysis.csv        → Analysis attacks")
    print("  9.  unsw_shellcode.csv       → Shellcode")
    print("  10. unsw_worms.csv           → Worms")
    print("="*55)


if __name__ == '__main__':
    main()