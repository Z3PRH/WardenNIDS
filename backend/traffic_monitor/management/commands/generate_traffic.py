import time
import random
from django.core.management.base import BaseCommand
from traffic_monitor.models import NetworkTraffic, Alert
from django.utils import timezone

# IMPORT THE ML ENGINE
from traffic_monitor.ml_engine import load_and_predict

class Command(BaseCommand):
    help = 'Generates traffic and scores it using the live ML engine'

    def handle(self, *args, **kwargs):
        print("[START] STARTING REALISTIC WARDEN TRAFFIC GENERATOR...")
        
        protocols = ['TCP', 'UDP', 'HTTP']
        ips = ['192.168.1.50', '10.0.0.5', '172.16.0.99', '8.8.8.8', '45.33.32.156', '192.168.1.200']
        
        try:
            while True:
                src = random.choice(ips)
                packet_count = random.randint(5, 5000)
                byte_count = random.randint(100, 100000) 
                
                # 1. Format the data for the ML Engine
                traffic_data = {
                    'Destination Port': 80 if random.random() > 0.5 else 443,
                    'Flow Duration': random.randint(100, 50000),
                    'Total Fwd Packets': packet_count // 2,
                    'Total Backward Packets': packet_count // 2,
                    'Total Length of Fwd Packets': byte_count // 2,
                    'Fwd Packet Length Max': random.randint(10, 1500),
                    'Fwd Packet Length Min': 0,
                    'Fwd Packet Length Mean': random.randint(10, 500),
                    'Flow Bytes/s': random.randint(100, 10000),
                    'Flow Packets/s': random.randint(10, 1000)
                }

                # 2. ASK THE BRAIN
                ml_result = load_and_predict(traffic_data)
                confidence = ml_result['confidence']
                is_attack = ml_result['is_attack']

                # 3. Create Raw Traffic record
                traffic = NetworkTraffic.objects.create(
                    src_ip=src,
                    dst_ip="192.168.1.100",
                    protocol=random.choice(protocols),
                    packet_count=packet_count,
                    byte_count=byte_count,
                    timestamp=timezone.now(),
                    anomaly_score=confidence
                )

                # 4. THE REALISTIC ROUTING LOGIC
                if confidence > 0.95:
                    # High Confidence -> Active Threat
                    Alert.objects.create(
                        traffic=traffic,
                        severity='Known Attack',
                        status='New',
                        created_at=timezone.now()
                    )
                    print(f"[ATTACK] {traffic.src_ip} | Confidence: {confidence*100:.1f}% -> Sent to ACTIVE")
                    
                elif confidence >= 0.80 and confidence <= 0.95:
                    
                    # --- THE REALITY SIMULATOR ---
                    # Base chance of being a Zero-Day is only 10%
                    zero_day_chance = 0.10 
                    
                    # If AI confidence is above 90%, it's more aggressive. Bump chance to 25%.
                    if confidence > 0.90:
                        zero_day_chance = 0.25 

                    if random.random() < zero_day_chance:
                        severity_label = 'Unknown Anomaly'
                        ui_target = 'ZERO-DAY TAB'
                        print_prefix = '[ZERO-DAY]'
                    else:
                        severity_label = 'Suspicious Flow'
                        ui_target = 'QUARANTINED TAB'
                        print_prefix = '[QUARANTINE]'

                    Alert.objects.create(
                        traffic=traffic,
                        severity=severity_label, 
                        status='Quarantined',
                        created_at=timezone.now()
                    )
                    print(f"{print_prefix} {traffic.src_ip} | Confidence: {confidence*100:.1f}% -> Sent to {ui_target}")
                    
                else:
                    print(f"[NORMAL] {traffic.src_ip} | Confidence: {confidence*100:.1f}%")

                time.sleep(3) 
        except KeyboardInterrupt:
            print("[STOP] Stopped Warden Traffic Generator.")