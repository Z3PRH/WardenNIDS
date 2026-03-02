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
        print("[INFO] Starting Hybrid NIDS/IPS Training Sequence")
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

        print("[INFO] Step 1: Cleaning and preprocessing data...")
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

        print("[INFO] Step 2: Checking for human feedback constraints...")
        try:
            human_corrections = FeedbackLog.objects.filter(label=0).select_related('alert__traffic')
            if human_corrections.exists():
                print(f"[INFO] Injecting {human_corrections.count()} human corrections...")
                feedback_data = []
                for log in human_corrections:
                    t = log.alert.traffic
                    feedback_data.append([80, 1000, t.packet_count, 0, t.byte_count, 0, 0, 0, 0, 0][:len(available_features)])
                
                human_df = pd.DataFrame(feedback_data, columns=available_features)
                X = pd.concat([X, human_df], ignore_index=True)
                y = pd.concat([y, pd.Series([0] * len(human_df))], ignore_index=True)
        except Exception as e:
            print(f"[WARNING] Skipping human feedback: {e}")

        print("[INFO] Step 3: Scaling feature space...")
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

        print("[INFO] Step 4: Training Random Forest (Supervised Signature Detection)...")
        rf = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
        rf.fit(X_train, y_train)
        rf_preds = rf.predict(X_test)

        print("[INFO] Step 5: Training Isolation Forest (Unsupervised Anomaly Detection)...")
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

        # Fix for Issue 1: We will store the RF metrics separately to send back to the frontend
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
        print("[SUCCESS] Training Sequence Completed Successfully.\n")
        
        # We return the flat metrics dictionary so the React frontend doesn't break
        return {"success": True, "metrics": rf_metrics_flat}

    except Exception as e:
        print(f"[ERROR] Engine Failure: {str(e)}")
        return {"success": False, "error": str(e)}