import pandas as pd
import numpy as np
import joblib
import os
from datetime import date
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

# PATHS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'artifacts')
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

RF_MODEL_PATH = os.path.join(ARTIFACTS_DIR, 'rf_model.pkl')
IF_MODEL_PATH = os.path.join(ARTIFACTS_DIR, 'if_model.pkl')
SCALER_PATH = os.path.join(ARTIFACTS_DIR, 'scaler.pkl')
FEATURES_PATH = os.path.join(ARTIFACTS_DIR, 'features.pkl')

def train_dynamic_model(csv_file):
    try:
        print("\n" + "="*50)
        print("[INFO] Starting Active Learning Pipeline (Zero-Day to Signature)")
        print("="*50)
        
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip() 
        
        if 'Flow Duration' in df.columns:
            print(f"[INFO] CIC-IDS2017 Dataset format confirmed. ({len(df)} rows found)")
            return _train_hybrid_models(df)
        else:
            print("[ERROR] Invalid dataset. Missing 'Flow Duration'.")
            return {"success": False, "error": "Please upload a CIC-IDS2017 format CSV"}
    except Exception as e:
        print(f"[ERROR] Failed to read CSV: {e}")
        return {"success": False, "error": str(e)}

def _train_hybrid_models(df):
    try:
        from .models import MLModel, FeedbackLog

        print("[INFO] Step 1: Cleaning and preprocessing baseline data...")
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.dropna(inplace=True)

        if 'Label' not in df.columns:
            return {"success": False, "error": "Dataset missing 'Label' column"}
        
        y = df['Label'].apply(lambda x: 0 if x == 'BENIGN' else 1)

        features = [
            'Destination Port', 'Flow Duration', 'Total Fwd Packets',
            'Total Backward Packets', 'Total Length of Fwd Packets',
            'Fwd Packet Length Max', 'Fwd Packet Length Min',
            'Fwd Packet Length Mean', 'Flow Bytes/s', 'Flow Packets/s'
        ]
        available_features = [f for f in features if f in df.columns]
        X = df[available_features]

        print("[INFO] Step 2: Injecting Analyst Feedback (Learning new signatures)...")
        try:
            # Fetch ALL feedback (0 = False Positives/Benign, 1 = True Positives/New Attacks)
            human_corrections = FeedbackLog.objects.all().select_related('alert__traffic')
            if human_corrections.exists():
                print(f"[INFO] Injecting {human_corrections.count()} verified analyst corrections into training data...")
                feedback_data = []
                feedback_labels = []
                
                for log in human_corrections:
                    t = log.alert.traffic
                    # Map the saved traffic stats back into the feature array
                    row = [80, 1000, t.packet_count, 0, t.byte_count, 0, 0, 0, 0, 0][:len(available_features)]
                    feedback_data.append(row)
                    feedback_labels.append(log.label) # Assigns the exact label the analyst chose
                
                human_df = pd.DataFrame(feedback_data, columns=available_features)
                X = pd.concat([X, human_df], ignore_index=True)
                y = pd.concat([y, pd.Series(feedback_labels)], ignore_index=True)
        except Exception as e:
            print(f"[WARNING] Skipping human feedback integration: {e}")

        print("[INFO] Step 3: Scaling feature space...")
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

        print("[INFO] Step 4: Upgrading Supervised Brain (Random Forest)...")
        rf = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
        rf.fit(X_train, y_train)
        rf_preds = rf.predict(X_test)

        print("[INFO] Step 5: Recalibrating Unsupervised Brain (Isolation Forest)...")
        iso_forest = IsolationForest(n_estimators=100, contamination='auto', random_state=42)
        iso_forest.fit(X_scaled)
        if_preds = iso_forest.predict(X_test)
        if_preds_binary = np.where(if_preds == -1, 1, 0)

        print("[INFO] Step 6: Overwriting ML artifacts on disk...")
        joblib.dump(rf, RF_MODEL_PATH)
        joblib.dump(iso_forest, IF_MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        joblib.dump(available_features, FEATURES_PATH)

        print("[INFO] Step 7: Updating Database ML Registry...")
        models_to_update = [
            ("Random Forest", rf_preds, RF_MODEL_PATH, 0.5),
            ("Isolation Forest", if_preds_binary, IF_MODEL_PATH, 0.0) 
        ]

        rf_metrics_flat = {}

        for name, preds, path, thresh in models_to_update:
            acc = round(accuracy_score(y_test, preds) * 100, 2)
            prec = round(precision_score(y_test, preds, zero_division=0) * 100, 2)
            rec = round(recall_score(y_test, preds, zero_division=0) * 100, 2)
            f1 = round(f1_score(y_test, preds, zero_division=0) * 100, 2)

            MLModel.objects.update_or_create(
                model_name=name,
                defaults={
                    'model_version': f"v{date.today().strftime('%Y%m%d')}",
                    'trained_on': date.today(),
                    'accuracy': acc,
                    'precision': prec,
                    'recall': rec,
                    'f1_score': f1,
                    'threshold': thresh,
                    'samples_trained': len(X),
                    'file_path': path
                }
            )
            print(f"  -> [{name}] Registered in DB (Acc: {acc}%, F1: {f1}%)")
            
            if name == "Random Forest":
                rf_metrics_flat = {
                    "accuracy": acc, "precision": prec, "recall": rec, "f1_score": f1
                }

        print("="*50)
        print("[SUCCESS] Active Learning Sequence Completed Successfully.\n")
        return {"success": True, "metrics": rf_metrics_flat}

    except Exception as e:
        print(f"[ERROR] Engine Failure: {str(e)}")
        return {"success": False, "error": str(e)}

def load_and_predict(traffic_data):
    """
    Waterfall Inference Engine: 
    1. RF checks its memory for known signatures.
    2. IF acts as a safety net to catch out-of-bounds zero-days.
    """
    try:
        # 1. Load artifacts 
        if not os.path.exists(RF_MODEL_PATH) or not os.path.exists(IF_MODEL_PATH) or not os.path.exists(SCALER_PATH):
            return {"is_anomaly": False, "confidence": 0.0, "error": "Models not fully trained"}

        rf_model = joblib.load(RF_MODEL_PATH)
        if_model = joblib.load(IF_MODEL_PATH) 
        scaler = joblib.load(SCALER_PATH)
        expected_features = joblib.load(FEATURES_PATH)

        # 2. Format and Scale incoming data
        df = pd.DataFrame([traffic_data])
        for feature in expected_features:
            if feature not in df.columns:
                df[feature] = 0.0
        X_scaled = scaler.transform(df[expected_features])

        # --- STEP 1: THE MEMORY CHECK (Random Forest) ---
        rf_prediction = rf_model.predict(X_scaled)[0]
        probabilities = rf_model.predict_proba(X_scaled)[0]
        rf_confidence = probabilities[1] if len(probabilities) > 1 else float(rf_prediction)

        # If RF recognizes it as a known threat with high confidence, we block it immediately.
        if rf_confidence >= 0.85:
            return {
                "is_anomaly": True,
                "confidence": round(float(rf_confidence) * 100, 2),
                "model_used": "Random Forest (Known Signature)"
            }

        # --- STEP 2: THE ZERO-DAY CHECK (Isolation Forest) ---
        # If RF thought it was safe, we ask IF to do a geometry check.
        if_score = if_model.decision_function(X_scaled)[0]
        
        # A negative score means it's an anomaly. The lower the score, the worse it is.
        if if_score < -0.05: 
            # IF caught something RF missed. Assign a high confidence to force a block/quarantine.
            return {
                "is_anomaly": True,
                "confidence": 92.0, 
                "model_used": "Isolation Forest (Zero-Day)"
            }

        # --- STEP 3: IT IS TRULY NORMAL ---
        return {
            "is_anomaly": False,
            "confidence": round(float(rf_confidence) * 100, 2),
            "model_used": "Random Forest (Safe)"
        }

    except Exception as e:
        print(f"[ERROR] Inference failed: {str(e)}")
        return {"is_anomaly": False, "confidence": 0.0, "error": str(e)}