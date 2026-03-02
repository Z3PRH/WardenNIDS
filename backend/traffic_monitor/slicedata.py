import pandas as pd

print("Loading massive CSV... (this might take a few seconds)")
# Make sure the filename matches exactly what you have
df = pd.read_csv('Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv')

# Clean up column names just in case
df.columns = df.columns.str.strip()

print(f"Total rows found: {len(df)}")
print(f"Attack types found: {df['Label'].unique()}")

# Grab 5,000 normal rows and 5,000 attack rows
print("Slicing data...")
benign_df = df[df['Label'] == 'BENIGN'].head(5000)
ddos_df = df[df['Label'] == 'DDoS'].head(5000)

# Combine them and shuffle the deck so the ML model doesn't just memorize the order
goldilocks_df = pd.concat([benign_df, ddos_df]).sample(frac=1, random_state=42)

# Save the perfect test file
goldilocks_df.to_csv('goldilocks_test.csv', index=False)
print("✅ Saved 'goldilocks_test.csv' with 10,000 perfectly balanced rows!")