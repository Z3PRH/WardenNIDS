import pandas as pd
import numpy as np
import joblib
import os
from datetime import date
from datetime import datetime

# Scikit-Learn Ecosystem
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction import DictVectorizer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

# Experimental flag required for HalvingGridSearchCV
from sklearn.experimental import enable_halving_search_cv
from sklearn.model_selection import HalvingGridSearchCV

from .models import FeedbackLog, MLModel

# PATHS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'artifacts')
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

RF_MODEL_PATH        = os.path.join(ARTIFACTS_DIR, 'rf_model.pkl')
IF_MODEL_PATH        = os.path.join(ARTIFACTS_DIR, 'if_model.pkl')
PREPROCESSOR_PATH    = os.path.join(ARTIFACTS_DIR, 'preprocessor.pkl')
TARGET_ENCODER_PATH  = os.path.join(ARTIFACTS_DIR, 'target_encoder.pkl')
COLUMN_MAP_PATH      = os.path.join(ARTIFACTS_DIR, 'column_map.pkl')

# ---------------------------------------------------------------------------
# UNIVERSAL FEATURE MAP
# Maps any known dataset column variant → canonical internal name.
# ---------------------------------------------------------------------------
FEATURE_MAP = {
    # --- Packets ---
    'total fwd packets':           'fwd_packets',
    'spkts':                       'fwd_packets',
    'count':                       'fwd_packets',
    'fwd packet count':            'fwd_packets',
    'tot fwd pkts':                'fwd_packets',

    # --- Bytes ---
    'total length of fwd packets': 'fwd_bytes',
    'sbytes':                      'fwd_bytes',
    'fwd bytes':                   'fwd_bytes',
    'totlen fwd pkts':             'fwd_bytes',

    # --- Duration ---
    'flow duration':               'duration',
    'dur':                         'duration',
    'duration':                    'duration',

    # --- Destination Port ---
    'destination port':            'port',
    'destination_port':            'port',
    'dest_port':                   'port',
    'dport':                       'port',
    'dst_port':                    'port',

    # --- Source Port ---
    'source port':                 'src_port',
    'sport':                       'src_port',
    'src_port':                    'src_port',

    # --- Protocol ---
    'protocol':                    'protocol',
    'proto':                       'protocol',

    # --- Backward Packets ---
    'total backward packets':      'bwd_packets',
    'dstpkts':                     'bwd_packets',
    'tot bwd pkts':                'bwd_packets',

    # --- Backward Bytes ---
    'total length of bwd packets': 'bwd_bytes',
    'dbytes':                      'bwd_bytes',
    'totlen bwd pkts':             'bwd_bytes',

    # --- Flow Rate ---
    'flow bytes/s':                'flow_bytes_per_sec',
    'flow packets/s':              'flow_pkts_per_sec',
    'rate':                        'flow_pkts_per_sec',

    # --- Labels ---
    'label':                       'Label',
    'class':                       'Label',
    'attack':                      'Label',
    'category':                    'Label',
    'attack_cat':                  'Label',
}

LABEL_ALIASES = {'label', 'class', 'attack', 'category', 'attack_cat'}

# ---------------------------------------------------------------------------
# DATASET FINGERPRINTS
# Each dataset has a set of unique column signatures that only appear in that
# format. The detector scores each candidate and picks the highest match.
# ---------------------------------------------------------------------------
DATASET_SIGNATURES = {
    'cicids': {
        # Columns that are highly specific to CIC-IDS2017/2018
        'exclusive': [
            'flow duration', 'total fwd packets', 'total backward packets',
            'total length of fwd packets', 'total length of bwd packets',
            'fwd packet length max', 'fwd packet length min',
            'fwd packet length mean', 'bwd packet length max',
            'flow bytes/s', 'flow packets/s', 'flow iat mean',
            'fwd iat total', 'fwd iat mean', 'bwd iat total',
            'fwd psh flags', 'bwd psh flags', 'fwd urg flags',
            'fwd header length', 'bwd header length', 'fin flag count',
            'syn flag count', 'rst flag count', 'psh flag count',
            'ack flag count', 'urg flag count', 'cwe flag count',
            'ece flag count', 'down/up ratio', 'average packet size',
            'avg fwd segment size', 'avg bwd segment size',
            'fwd avg bytes/bulk', 'fwd avg packets/bulk',
            'active mean', 'active std', 'idle mean', 'idle std',
        ],
        'label_col': 'label',
    },
    'unsw': {
        # Columns specific to UNSW-NB15
        'exclusive': [
            'dur', 'proto', 'service', 'state', 'spkts', 'dpkts',
            'sbytes', 'dbytes', 'sttl', 'dttl', 'sloss', 'dloss',
            'sload', 'dload', 'sinpkt', 'dinpkt', 'sjit', 'djit',
            'swin', 'stcpb', 'dtcpb', 'dwin', 'tcprtt', 'synack',
            'ackdat', 'smean', 'dmean', 'trans_depth', 'res_bdy_len',
            'ct_srv_src', 'ct_state_ttl', 'ct_dst_ltm', 'ct_src_dport_ltm',
            'ct_dst_sport_ltm', 'ct_dst_src_ltm', 'is_ftp_login',
            'ct_ftp_cmd', 'ct_flw_http_mthd', 'ct_src_ltm',
            'ct_srv_dst', 'is_sm_ips_ports', 'attack_cat',
        ],
        'label_col': 'label',
    },
    'kdd': {
        # Columns specific to NSL-KDD / KDD Cup 99
        'exclusive': [
            'duration', 'protocol_type', 'service', 'flag',
            'src_bytes', 'dst_bytes', 'land', 'wrong_fragment',
            'urgent', 'hot', 'num_failed_logins', 'logged_in',
            'num_compromised', 'root_shell', 'su_attempted',
            'num_root', 'num_file_creations', 'num_shells',
            'num_access_files', 'num_outbound_cmds', 'is_host_login',
            'is_guest_login', 'count', 'srv_count', 'serror_rate',
            'srv_serror_rate', 'rerror_rate', 'srv_rerror_rate',
            'same_srv_rate', 'diff_srv_rate', 'srv_diff_host_rate',
            'dst_host_count', 'dst_host_srv_count',
            'dst_host_same_srv_rate', 'dst_host_diff_srv_rate',
        ],
        'label_col': 'label',
    },
}


def _detect_dataset_schema(df) -> str:
    """
    Fingerprint the uploaded CSV by scoring its columns against known dataset
    signatures. Returns the best matching schema key, or 'custom' if no
    confident match is found.

    Scoring: count how many exclusive signature columns appear in the file
    (case-insensitive). The dataset with the most hits wins, provided it
    clears a minimum confidence threshold (>= 3 matches).
    """
    cols_lower = set(c.lower().strip() for c in df.columns)

    scores = {}
    for schema, sig in DATASET_SIGNATURES.items():
        hits = sum(1 for col in sig['exclusive'] if col in cols_lower)
        scores[schema] = hits
        print(f"[DETECT] '{schema}' signature score: {hits}/{len(sig['exclusive'])}")

    best_schema = max(scores, key=scores.get)
    best_score  = scores[best_schema]

    # Require at least 3 column matches for a confident detection
    if best_score >= 3:
        print(f"[DETECT] Auto-detected schema: '{best_schema}' (confidence: {best_score} column matches)")
        return best_schema
    else:
        print(f"[DETECT] No confident match found (best score: {best_score}). Treating as 'custom'.")
        return 'custom'


def _validate_schema_match(df, user_hint: str) -> tuple[str, str | None]:
    """
    Compares what the user selected in the dropdown against what the file
    actually looks like.

    Returns:
        (resolved_schema, warning_message | None)

    Rules:
        - If user picked 'auto'   → run detector, use detected result, no warning.
        - If user picked a schema → run detector anyway. If it matches, great.
          If it doesn't match, log a warning but USE THE DETECTED schema so
          training doesn't silently use wrong labels.
        - If detector returns 'custom' and user picked something specific →
          trust the user's hint (they may know their own custom format).
    """
    detected = _detect_dataset_schema(df)

    if user_hint == 'auto':
        # Pure auto-detect path
        return detected, None

    if detected == 'custom':
        # Detector couldn't fingerprint it — trust the user's explicit selection
        print(f"[VALIDATE] Detector inconclusive. Trusting user hint: '{user_hint}'")
        return user_hint, None

    if detected == user_hint:
        # Perfect match — user knew what they were uploading
        print(f"[VALIDATE] Schema confirmed: user hint matches detected schema '{detected}'")
        return detected, None

    # MISMATCH — user said one thing, file looks like another
    warning = (
        f"Schema mismatch detected: you selected '{user_hint}' but the file "
        f"looks like '{detected}' ({scores_summary(df, detected)} column matches). "
        f"Training will proceed using the detected schema '{detected}'."
    )
    print(f"[WARNING] {warning}")
    return detected, warning


def scores_summary(df, schema: str) -> int:
    """Helper: returns the hit count for a given schema against df columns."""
    cols_lower = set(c.lower().strip() for c in df.columns)
    return sum(1 for col in DATASET_SIGNATURES[schema]['exclusive'] if col in cols_lower)


def _normalize_columns(df):
    """
    Universal Schema Normalizer.
    Strips, lowercases, remaps via FEATURE_MAP, handles duplicate renames,
    detects label column. Persists column map for inference-time use.
    """
    df = df.copy()
    df.columns = df.columns.str.strip()

    resolved_map = {}
    new_columns  = {}

    for col in df.columns:
        key = col.lower().strip()
        if key in FEATURE_MAP:
            canonical = FEATURE_MAP[key]
            resolved_map[col] = canonical
            new_columns[col]  = canonical
        else:
            new_columns[col] = col

    df.rename(columns=new_columns, inplace=True)

    # Handle duplicates from remapping
    seen = {}
    final_cols = []
    for col in df.columns:
        if col in seen:
            seen[col] += 1
            final_cols.append(f"{col}_{seen[col]}")
        else:
            seen[col] = 0
            final_cols.append(col)
    df.columns = final_cols

    # Detect label column
    label_col = None
    for col in df.columns:
        if col == 'Label' or col.lower() in LABEL_ALIASES:
            label_col = col
            break
    if label_col is None:
        label_col = df.columns[-1]

    print(f"[INFO] Schema normalized — {len(resolved_map)} column(s) remapped. "
          f"Label column: '{label_col}'")
    if resolved_map:
        for orig, canon in resolved_map.items():
            print(f"         '{orig}' → '{canon}'")

    joblib.dump({'col_map': new_columns, 'label_col': label_col}, COLUMN_MAP_PATH)

    return df, label_col


def train_dynamic_model(csv_file, dataset_type: str = 'auto'):
    """
    Entry point for training. Accepts any dataset schema.

    Args:
        csv_file:     Uploaded CSV file object.
        dataset_type: Hint from the frontend dropdown:
                      'auto' | 'cicids' | 'unsw' | 'kdd' | 'custom'
    """
    try:
        print("\n" + "="*55)
        print("[INFO] Universal Active Learning Pipeline: Initializing...")
        print(f"[INFO] User schema hint: '{dataset_type}'")
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip()
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        print(f"[INFO] Uploaded Dataset: {len(df)} rows x {len(df.columns)} columns")
        return _train_hybrid_models(df, dataset_type=dataset_type)
    except Exception as e:
        print(f"[ERROR] Universal Training Failed: {e}")
        return {"success": False, "error": str(e)}


def _train_hybrid_models(df, dataset_type: str = 'auto'):
    try:
        run_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        print(f"[INFO] Run ID: {run_id}")

        print("[INFO] Phase 1: Schema Detection & Validation")

        # --- Detect actual schema and validate against user hint ---
        resolved_schema, schema_warning = _validate_schema_match(df, dataset_type)
        print(f"[INFO] Resolved schema: '{resolved_schema}'")

        # --- Normalize columns ---
        df, label_col = _normalize_columns(df)

        # 1. Target Detection & Encoding
        le = LabelEncoder()
        y = le.fit_transform(df[label_col].astype(str))

        # 2. Dictionary Conversion
        X_df    = df.drop(columns=[label_col])
        X_dicts = X_df.to_dict('records')

        # 3. Human Feedback Memory
        try:
            human_corrections = FeedbackLog.objects.all().select_related('alert__traffic')
            if human_corrections.exists():
                feedback_data = [
                    log.alert.traffic.flow_features
                    for log in human_corrections
                    if isinstance(log.alert.traffic.flow_features, dict)
                ]
                feedback_labels = [
                    log.label
                    for log in human_corrections
                    if isinstance(log.alert.traffic.flow_features, dict)
                ]
                X_dicts.extend(feedback_data)
                y = np.concatenate([y, feedback_labels])
                print(f"[INFO] Merged {len(feedback_data)} human-verified flows.")
        except Exception as e:
            print(f"[WARNING] Skipping human feedback: {e}")

        print("[INFO] Phase 2: Building Preprocessor Pipeline...")
        preprocessor = Pipeline([
            ('vectorizer', DictVectorizer(sparse=False)),
            ('imputer',    SimpleImputer(strategy='median')),
            ('scaler',     StandardScaler())
        ])

        X_processed = preprocessor.fit_transform(X_dicts)
        X_train, X_test, y_train, y_test = train_test_split(
            X_processed, y, test_size=0.2, random_state=42
        )

        print("[INFO] Phase 3: Random Forest Tournament...")
        base_rf = RandomForestClassifier(class_weight='balanced_subsample', random_state=42)
        param_grid = {
            'n_estimators': [50, 100],
            'max_depth':    [10, 20, None]
        }
        tuner = HalvingGridSearchCV(
            estimator=base_rf,
            param_grid=param_grid,
            factor=2, cv=3,
            scoring='f1_weighted',
            n_jobs=-1
        )
        tuner.fit(X_train, y_train)
        best_rf  = tuner.best_estimator_
        rf_preds = best_rf.predict(X_test)
        print(f"[SUCCESS] Champion RF: {tuner.best_params_}")

        print("[INFO] Phase 4: Isolation Forest...")
        iso_forest = IsolationForest(n_estimators=100, contamination='auto', random_state=42)
        iso_forest.fit(X_processed)
        if_preds        = iso_forest.predict(X_test)
        if_preds_binary = np.where(if_preds == -1, 1, 0)

        print("[INFO] Phase 5: Saving Artifacts & Registering to DB...")
        joblib.dump(best_rf,      RF_MODEL_PATH)
        joblib.dump(iso_forest,   IF_MODEL_PATH)
        joblib.dump(preprocessor, PREPROCESSOR_PATH)
        joblib.dump(le,           TARGET_ENCODER_PATH)

        models_to_save = [
            ("Random Forest",    rf_preds,        RF_MODEL_PATH, 0.5),
            ("Isolation Forest", if_preds_binary, IF_MODEL_PATH, 0.0),
        ]

        rf_metrics_flat = {}
        for name, preds, path, thresh in models_to_save:
            acc  = round(accuracy_score(y_test, preds) * 100, 2)
            prec = round(precision_score(y_test, preds, zero_division=0, average='weighted') * 100, 2)
            rec  = round(recall_score(y_test, preds, zero_division=0, average='weighted') * 100, 2)
            f1   = round(f1_score(y_test, preds, zero_division=0, average='weighted') * 100, 2)

            MLModel.objects.create(
                model_name=name,
                model_version=f"v{date.today().strftime('%Y%m%d')}",
                trained_on=date.today(),
                accuracy=acc, precision=prec, recall=rec, f1_score=f1,
                threshold=thresh,
                samples_trained=len(X_dicts),
                file_path=path,
                run_id=run_id,
                dataset_schema=resolved_schema,   # Always the DETECTED schema, never blind user hint
            )
            print(f"  -> [{name}] Run: {run_id} | Schema: {resolved_schema} | Acc: {acc}%, F1: {f1}%")
            if name == "Random Forest":
                rf_metrics_flat = {"accuracy": acc, "precision": prec, "recall": rec, "f1_score": f1}

        print("="*55)
        return {
            "success": True,
            "metrics": rf_metrics_flat,
            "run_id": run_id,
            "dataset_schema": resolved_schema,
            "schema_warning": schema_warning,  # Passed back to the view → frontend can show it
        }

    except Exception as e:
        print(f"[ERROR] Engine Failure: {str(e)}")
        return {"success": False, "error": str(e)}


def _normalize_traffic_dict(traffic_data: dict) -> dict:
    """Normalize live traffic dict keys to match training schema."""
    if not os.path.exists(COLUMN_MAP_PATH):
        return traffic_data
    try:
        saved   = joblib.load(COLUMN_MAP_PATH)
        col_map = saved.get('col_map', {})
    except Exception:
        return traffic_data

    return {col_map.get(k.strip(), k): v for k, v in traffic_data.items()}


def load_and_predict(traffic_data):
    """Live Waterfall Inference Engine."""
    try:
        if not all(os.path.exists(p) for p in [RF_MODEL_PATH, IF_MODEL_PATH, PREPROCESSOR_PATH]):
            return 0.0, "Models not fully trained"

        best_rf      = joblib.load(RF_MODEL_PATH)
        iso_forest   = joblib.load(IF_MODEL_PATH)
        preprocessor = joblib.load(PREPROCESSOR_PATH)

        traffic_data = _normalize_traffic_dict(traffic_data)
        X_processed  = preprocessor.transform([traffic_data])

        # 1. Random Forest — Known Threats
        probabilities = best_rf.predict_proba(X_processed)[0]
        rf_confidence = probabilities[1] if len(probabilities) > 1 else float(best_rf.predict(X_processed)[0])

        if rf_confidence >= 0.85:
            return float(rf_confidence), "Random Forest (Known Signature)"

        # 2. Isolation Forest — Zero-Days
        if_score = iso_forest.decision_function(X_processed)[0]
        if if_score < -0.05:
            return 0.92, "Isolation Forest (Zero-Day)"

        return float(rf_confidence), "Random Forest (Safe)"

    except Exception as e:
        print(f"[ERROR] Inference failed: {str(e)}")
        return 0.0, f"Error: {str(e)}"