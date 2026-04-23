import time
import random
import numpy as np
from django.core.management.base import BaseCommand
from django.utils import timezone
from traffic_monitor.models import NetworkTraffic, Alert

# ---------------------------------------------------------------------------
# Warden Live Traffic Simulator
# Usage:
#   python manage.py generate_traffic              # runs forever
#   python manage.py generate_traffic --limit 500  # stops after 500 flows
#   python manage.py generate_traffic --interval 2 # 1 flow every 2 seconds
#   python manage.py generate_traffic --burst       # fast mode, no sleep
#
# NOTE: The generator always uses synthetic anomaly scores so the dashboard
# works even before a model is trained. Once a model is trained, ML inference
# takes over and overrides the synthetic scores.
# ---------------------------------------------------------------------------

TRAFFIC_WEIGHTS = {
    'benign':        0.70,
    'ddos':          0.10,
    'zeroday':       0.10,
    'falsepositive': 0.10,
}

INTERNAL_IPS = [f"192.168.1.{i}" for i in range(2, 50)]
EXTERNAL_IPS = [f"203.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
                for _ in range(100)]
ATTACK_IPS   = [f"45.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
                for _ in range(30)]

WEB_PORTS  = [80, 443, 8080, 8443]
DNS_PORTS  = [53]
MAIL_PORTS = [25, 465, 587, 993, 143]
DB_PORTS   = [3306, 5432, 1433]
VOIP_PORTS = [1935, 3478, 5004, 5060]


def gen_benign():
    port     = random.choice(WEB_PORTS + DNS_PORTS + MAIL_PORTS)
    duration = int(np.random.lognormal(mean=10, sigma=2))
    fwd_pkts = int(np.random.lognormal(mean=2.5, sigma=0.8))
    bwd_pkts = int(np.random.lognormal(mean=2.2, sigma=0.8))
    fwd_len  = int(np.random.lognormal(mean=6.5, sigma=1.2))
    pkt_max  = int(np.random.uniform(100, 1500))
    pkt_min  = int(np.random.uniform(0, 100))
    pkt_mean = round(np.random.uniform(pkt_min, pkt_max), 2)
    return {
        'src_ip':       random.choice(INTERNAL_IPS),
        'dst_ip':       random.choice(EXTERNAL_IPS),
        'protocol':     random.choice(['TCP', 'UDP', 'HTTPS', 'DNS']),
        'packet_count': fwd_pkts + bwd_pkts,
        'byte_count':   fwd_len,
        'anomaly_score': round(random.uniform(0.05, 0.35), 4),  # clearly safe
        'flow_features': {
            'Destination Port': port, 'Flow Duration': duration,
            'Total Fwd Packets': fwd_pkts, 'Total Backward Packets': bwd_pkts,
            'Total Length of Fwd Packets': fwd_len,
            'Fwd Packet Length Max': pkt_max, 'Fwd Packet Length Min': pkt_min,
            'Fwd Packet Length Mean': pkt_mean,
            'Flow Bytes/s': round(fwd_len / max(duration, 1) * 1e6, 4),
            'Flow Packets/s': round(fwd_pkts / max(duration, 1) * 1e6, 4),
        }
    }


def gen_ddos():
    port     = random.choice(WEB_PORTS + DNS_PORTS)
    duration = int(np.random.uniform(100, 50000))
    fwd_pkts = int(np.random.uniform(500, 5000))
    bwd_pkts = int(np.random.uniform(0, 5))
    fwd_len  = int(np.random.uniform(50000, 500000))
    pkt_max  = int(np.random.uniform(1400, 1500))
    pkt_min  = int(np.random.uniform(0, 40))
    pkt_mean = round(np.random.uniform(800, 1400), 2)
    return {
        'src_ip':       random.choice(ATTACK_IPS),
        'dst_ip':       random.choice(INTERNAL_IPS),
        'protocol':     random.choice(['TCP', 'UDP', 'HTTP']),
        'packet_count': fwd_pkts + bwd_pkts,
        'byte_count':   fwd_len,
        'anomaly_score': round(random.uniform(0.90, 0.99), 4),  # always triggers blocked
        'flow_features': {
            'Destination Port': port, 'Flow Duration': duration,
            'Total Fwd Packets': fwd_pkts, 'Total Backward Packets': bwd_pkts,
            'Total Length of Fwd Packets': fwd_len,
            'Fwd Packet Length Max': pkt_max, 'Fwd Packet Length Min': pkt_min,
            'Fwd Packet Length Mean': pkt_mean,
            'Flow Bytes/s': round(fwd_len / max(duration, 1) * 1e6, 4),
            'Flow Packets/s': round(fwd_pkts / max(duration, 1) * 1e6, 4),
        }
    }


def gen_zeroday():
    port     = random.choice(DB_PORTS + list(range(4000, 6000)) + list(range(49000, 65000)))
    duration = int(np.random.uniform(500, 300000))
    fwd_pkts = int(np.random.uniform(10, 200))
    bwd_pkts = int(np.random.uniform(50, 500))
    fwd_len  = int(np.random.uniform(100, 5000))
    pkt_max  = int(np.random.uniform(500, 1200))
    pkt_min  = int(np.random.uniform(50, 200))
    pkt_mean = round(np.random.uniform(200, 600), 2)
    return {
        'src_ip':       random.choice(ATTACK_IPS + EXTERNAL_IPS),
        'dst_ip':       random.choice(INTERNAL_IPS),
        'protocol':     random.choice(['TCP', 'UDP', 'ICMP']),
        'packet_count': fwd_pkts + bwd_pkts,
        'byte_count':   fwd_len,
        'anomaly_score': round(random.uniform(0.80, 0.89), 4),  # quarantine range
        'flow_features': {
            'Destination Port': port, 'Flow Duration': duration,
            'Total Fwd Packets': fwd_pkts, 'Total Backward Packets': bwd_pkts,
            'Total Length of Fwd Packets': fwd_len,
            'Fwd Packet Length Max': pkt_max, 'Fwd Packet Length Min': pkt_min,
            'Fwd Packet Length Mean': pkt_mean,
            'Flow Bytes/s': round(np.random.uniform(100, 50000), 4),
            'Flow Packets/s': round(np.random.uniform(5, 500), 4),
        }
    }


def gen_false_positive():
    port     = random.choice([443, 80, 8080] + VOIP_PORTS)
    duration = int(np.random.uniform(100000, 3000000))
    fwd_pkts = int(np.random.uniform(200, 2000))
    bwd_pkts = int(np.random.uniform(150, 1800))
    fwd_len  = int(np.random.uniform(10000, 200000))
    pkt_max  = int(np.random.uniform(800, 1500))
    pkt_min  = int(np.random.uniform(40, 200))
    pkt_mean = round(np.random.uniform(400, 900), 2)
    return {
        'src_ip':       random.choice(INTERNAL_IPS),
        'dst_ip':       random.choice(EXTERNAL_IPS),
        'protocol':     random.choice(['TCP', 'HTTPS', 'UDP']),
        'packet_count': fwd_pkts + bwd_pkts,
        'byte_count':   fwd_len,
        'anomaly_score': round(random.uniform(0.80, 0.88), 4),  # quarantine range — suspicious but legit
        'flow_features': {
            'Destination Port': port, 'Flow Duration': duration,
            'Total Fwd Packets': fwd_pkts, 'Total Backward Packets': bwd_pkts,
            'Total Length of Fwd Packets': fwd_len,
            'Fwd Packet Length Max': pkt_max, 'Fwd Packet Length Min': pkt_min,
            'Fwd Packet Length Mean': pkt_mean,
            'Flow Bytes/s': round(fwd_len / max(duration, 1) * 1e6, 4),
            'Flow Packets/s': round(fwd_pkts / max(duration, 1) * 1e6, 4),
        }
    }


GENERATORS = {
    'benign':        gen_benign,
    'ddos':          gen_ddos,
    'zeroday':       gen_zeroday,
    'falsepositive': gen_false_positive,
}

SEVERITY_MAP = {
    'ddos':          'High | DDoS | Synthetic',
    'zeroday':       'Critical | Zero-Day Anomaly | Synthetic',
    'falsepositive': 'Low | Suspicious (Likely False Positive) | Synthetic',
}

STATUS_MAP = {
    'ddos':          'quarantined',
    'zeroday':       'open',
    'falsepositive': 'open',
}


class Command(BaseCommand):
    help = 'Continuously generate synthetic network traffic flows into the database'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=0,
            help='Stop after N flows. Default 0 = run forever.')
        parser.add_argument('--interval', type=float, default=1.0,
            help='Seconds between each flow. Default 1.0')
        parser.add_argument('--burst', action='store_true',
            help='No sleep between flows — insert as fast as possible.')

    def handle(self, *args, **options):
        limit    = options['limit']
        interval = options['interval']
        burst    = options['burst']

        # Import here to avoid circular import issues at module load time
        from traffic_monitor.ml_engine import load_and_predict

        pool    = list(GENERATORS.keys())
        weights = [TRAFFIC_WEIGHTS[k] for k in pool]

        self.stdout.write(self.style.SUCCESS(
            "\n" + "="*55 +
            "\n  Warden Live Traffic Simulator — ACTIVE" +
            f"\n  Mix: {int(TRAFFIC_WEIGHTS['benign']*100)}% benign | "
            f"{int(TRAFFIC_WEIGHTS['ddos']*100)}% DDoS | "
            f"{int(TRAFFIC_WEIGHTS['zeroday']*100)}% zero-day | "
            f"{int(TRAFFIC_WEIGHTS['falsepositive']*100)}% false-positive" +
            f"\n  Interval: {'burst mode' if burst else f'{interval}s'}" +
            f"\n  Limit: {'unlimited' if limit == 0 else limit}" +
            "\n  Press Ctrl+C to stop.\n" +
            "="*55
        ))

        count       = 0
        alert_count = 0

        try:
            while True:
                if limit > 0 and count >= limit:
                    break

                traffic_type = random.choices(pool, weights=weights, k=1)[0]
                data         = GENERATORS[traffic_type]()
                flow_features = data.pop('flow_features')
                synthetic_score = data['anomaly_score']

                # Save to DB with synthetic score first
                traffic = NetworkTraffic.objects.create(
                    **data,
                    flow_features=flow_features,
                    timestamp=timezone.now(),
                )

                # Try ML inference — override synthetic score if model is available
                final_score  = synthetic_score
                source       = 'Synthetic'
                ml_available = False

                try:
                    ml_score, ml_source = load_and_predict(flow_features)
                    if ml_score > 0.0:  # 0.0 means model not trained yet
                        final_score  = ml_score
                        source       = ml_source
                        ml_available = True
                        # Update the record with the real ML score
                        traffic.anomaly_score = final_score
                        traffic.save(update_fields=['anomaly_score'])
                except Exception:
                    pass  # Model not ready — synthetic score stays

                # Create alert for non-benign traffic
                if traffic_type != 'benign':
                    Alert.objects.create(
                        traffic=traffic,
                        severity=SEVERITY_MAP.get(traffic_type, 'Medium | Unknown'),
                        status=STATUS_MAP.get(traffic_type, 'open'),
                        created_at=timezone.now(),
                    )
                    alert_count += 1

                count += 1

                if count % 10 == 0:
                    ml_tag = f'ML:{source}' if ml_available else 'ML:not trained'
                    self.stdout.write(
                        f"  [{timezone.now().strftime('%H:%M:%S')}] "
                        f"Flows: {count} | Alerts: {alert_count} | "
                        f"Last: {traffic_type.upper()} "
                        f"(score: {final_score:.3f} | {ml_tag})"
                    )

                if not burst:
                    time.sleep(interval)

        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS(
                f"\n\n  Stopped. {count} flows inserted, {alert_count} alerts generated."
            ))