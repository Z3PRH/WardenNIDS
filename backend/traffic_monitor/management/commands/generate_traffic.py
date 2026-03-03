import time
import random
from django.core.management.base import BaseCommand
from traffic_monitor.models import NetworkTraffic, Alert
from django.utils import timezone

# IMPORT THE ML ENGINE
from traffic_monitor.ml_engine import load_and_predict

class Command(BaseCommand):
    help = 'Generates traffic including DDoS, Zero-Days, and False Positives'

    def handle(self, *args, **kwargs):
        print("[START] STARTING WARDEN TRAFFIC GENERATOR (V3 - ADVANCED THREATS)...")
        
        protocols = ['TCP', 'UDP', 'HTTP']
        ips = ['192.168.1.50', '10.0.0.5', '172.16.0.99', '8.8.8.8', '45.33.32.156', '192.168.1.200']
        
        try:
            while True:
                src = random.choice(ips)
                
                # --- ADVANCED PROFILER ---
                # 60% Normal, 15% False Positive (Heavy Benign), 10% Zero-Day, 15% DDoS
                profile = random.choices(
                    ['normal', 'false_positive', 'zero_day', 'ddos'], 
                    weights=[0.60, 0.01, 0.30, 0.09]
                )[0]

                if profile == 'ddos':
                    # DDOS ATTACK: Massive, overwhelming packet flood
                    attack_type = 'DDoS Flood'
                    packet_count = random.randint(50000, 250000)
                    traffic_data = {
                        'Destination Port': random.choice([80, 443, 53]),
                        'Flow Duration': random.randint(100000, 500000), 
                        'Total Fwd Packets': packet_count,
                        'Total Backward Packets': 0, # Unidirectional flood
                        'Total Length of Fwd Packets': packet_count * random.randint(500, 1500),
                        'Fwd Packet Length Max': random.randint(1000, 1500),
                        'Fwd Packet Length Min': 50,
                        'Fwd Packet Length Mean': random.randint(800, 1200),
                        'Flow Bytes/s': random.randint(5000000, 15000000),
                        'Flow Packets/s': random.randint(100000, 500000)
                    }

                elif profile == 'zero_day':
                    # ZERO-DAY: Completely weird, out-of-distribution mathematical signatures
                    attack_type = 'Unknown Zero-Day'
                    traffic_data = {
                        'Destination Port': random.randint(10000, 65535), 
                        'Flow Duration': random.randint(1, 100), # Impossibly fast
                        'Total Fwd Packets': random.randint(1000, 5000),
                        'Total Backward Packets': random.randint(1000, 5000),
                        'Total Length of Fwd Packets': 0, # Lots of packets, 0 payload
                        'Fwd Packet Length Max': 0,
                        'Fwd Packet Length Min': 0,
                        'Fwd Packet Length Mean': 0,
                        'Flow Bytes/s': 0,
                        'Flow Packets/s': random.randint(1000000, 5000000) 
                    }

                elif profile == 'false_positive':
                    # FALSE POSITIVE: 4K Video Streaming or Large File Download
                    # AI might flag it because of high volume, but it's totally safe
                    attack_type = 'Heavy Benign'
                    packet_count = random.randint(10000, 50000)
                    traffic_data = {
                        'Destination Port': 443,
                        'Flow Duration': random.randint(5000000, 15000000), # Long connection
                        'Total Fwd Packets': packet_count,
                        'Total Backward Packets': packet_count + random.randint(100, 500),
                        'Total Length of Fwd Packets': packet_count * 1400,
                        'Fwd Packet Length Max': 1500,
                        'Fwd Packet Length Min': 64,
                        'Fwd Packet Length Mean': 1200,
                        'Flow Bytes/s': random.randint(1000000, 5000000),
                        'Flow Packets/s': random.randint(1000, 5000)
                    }

                else:
                    # NORMAL: Standard Web Browsing
                    attack_type = 'Normal'
                    packet_count = random.randint(10, 150) # Increased min-packets to avoid 4-packet bug
                    byte_count = random.randint(1000, 15000) 
                    traffic_data = {
                        'Destination Port': random.choice([80, 443]),
                        'Flow Duration': random.randint(10000, 80000),
                        'Total Fwd Packets': packet_count // 2,
                        'Total Backward Packets': packet_count // 2,
                        'Total Length of Fwd Packets': byte_count // 2,
                        'Fwd Packet Length Max': random.randint(100, 1500),
                        'Fwd Packet Length Min': 0,
                        'Fwd Packet Length Mean': random.randint(50, 500),
                        'Flow Bytes/s': random.randint(10000, 100000),
                        'Flow Packets/s': random.randint(100, 1500)
                    }

                # 2. ASK THE ML ENGINE
                ml_result = load_and_predict(traffic_data)
                confidence = ml_result.get('confidence', 0.0) / 100.0

                # 3. RECORD RAW TRAFFIC
                total_packets = traffic_data['Total Fwd Packets'] + traffic_data['Total Backward Packets']
                total_bytes = traffic_data['Total Length of Fwd Packets'] * 2 

                traffic = NetworkTraffic.objects.create(
                    src_ip=src,
                    dst_ip="192.168.1.100",
                    protocol=random.choice(protocols),
                    packet_count=total_packets,
                    byte_count=total_bytes,
                    timestamp=timezone.now(),
                    anomaly_score=confidence
                )

                # --- 4. THE ROUTING LOGIC (WITH THE 4-PACKET FIX) ---
                
                # FIX: If it's less than 15 packets, and not 100% confidence, ignore it to prevent spam
                if total_packets < 15 and confidence < 0.99:
                    confidence = 0.10 # Artificially lower the score to bypass the alert system
                    
                if confidence > 0.95:
                    Alert.objects.create(
                        traffic=traffic,
                        severity=f'Active Threat ({attack_type})',
                        status='New',
                        created_at=timezone.now()
                    )
                    print(f"[BLOCKED] {traffic.src_ip} | Pkts: {total_packets} | Conf: {confidence*100:.1f}% -> ACTIVE")
                    
                elif confidence >= 0.80 and confidence <= 0.95:
                    
                    if profile == 'zero_day':
                        severity_label = 'Zero-Day Signature'
                    elif profile == 'false_positive':
                        # The AI got tricked!
                        severity_label = 'Suspicious Flow (Review)' 
                    else:
                        severity_label = 'Anomaly Detected'

                    Alert.objects.create(
                        traffic=traffic,
                        severity=severity_label, 
                        status='Quarantined',
                        created_at=timezone.now()
                    )
                    print(f"[QUARANTINE] {traffic.src_ip} | Pkts: {total_packets} | Conf: {confidence*100:.1f}% -> {severity_label}")
                    
                else:
                    print(f"[NORMAL] {traffic.src_ip} | Pkts: {total_packets} | Conf: {confidence*100:.1f}%")

                time.sleep(2.5) 
                
        except KeyboardInterrupt:
            print("\n[STOP] Stopped Warden Traffic Generator.")