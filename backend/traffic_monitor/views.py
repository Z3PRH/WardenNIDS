import pandas as pd
import io
import random
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import ExtractHour

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

# Import your local models and ML engine
from .ml_engine import train_dynamic_model
from .models import NetworkTraffic, Alert, FeedbackLog, KnownAsset
from .serializers import TrafficSerializer, AlertSerializer, FeedbackSerializer, AssetSerializer


class TrafficViewSet(viewsets.ModelViewSet):
    queryset = NetworkTraffic.objects.all().order_by('-timestamp')
    serializer_class = TrafficSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def live(self, request):
        recent_traffic = NetworkTraffic.objects.all().order_by('-timestamp')[:30]
        data = []
        for t in reversed(recent_traffic):
            has_alert = Alert.objects.filter(traffic=t).exists()
            data.append({
                "timestamp": t.timestamp,
                "packet_count": t.packet_count,
                "byte_count": t.byte_count,
                "anomaly_score": t.anomaly_score,
                "has_alert": has_alert
            })
        return Response(data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        now = timezone.now()
        historical_threshold = now - timedelta(hours=24)
        
        # FIX 1: Increased from 10s to 60s for a stable, continuous live feed
        live_threshold = now - timedelta(seconds=60) 

        # 1. LIVE DATA
        live_traffic_qs = NetworkTraffic.objects.filter(timestamp__gte=live_threshold, timestamp__lte=now)
        live_alerts_qs = Alert.objects.filter(created_at__gte=live_threshold, created_at__lte=now)

        live_total = live_traffic_qs.count()
        
        # FIX 2: Look for 'zero-day' instead of 'unknown' to match the generator's new labels
        live_zero_day = live_alerts_qs.filter(severity__icontains='zero-day').count()
        live_quarantined = live_alerts_qs.filter(status__icontains='quarantined').exclude(severity__icontains='zero-day').count()
        live_blocked = live_alerts_qs.exclude(severity__icontains='zero-day').exclude(status__icontains='quarantined').count()
        
        live_normal = max(0, live_total - (live_zero_day + live_quarantined + live_blocked))

        # 2. HISTORICAL DATA (Last 24 Hours)
        hist_alerts_qs = Alert.objects.filter(created_at__gte=historical_threshold, created_at__lte=now)
        hist_traffic_total = NetworkTraffic.objects.filter(timestamp__gte=historical_threshold, timestamp__lte=now).count()
        
        hist_zero = hist_alerts_qs.filter(severity__icontains='zero-day').count()
        hist_quar = hist_alerts_qs.filter(status__icontains='quarantined').exclude(severity__icontains='zero-day').count()
        hist_block = hist_alerts_qs.exclude(severity__icontains='zero-day').exclude(status__icontains='quarantined').count()
        hist_norm = max(0, hist_traffic_total - (hist_zero + hist_quar + hist_block))

        distribution = [
            {"name": "Normal Traffic", "value": hist_norm},
            {"name": "Known Attacks", "value": hist_block},
            {"name": "Quarantined", "value": hist_quar},
            {"name": "Zero-Day Anomalies", "value": hist_zero}
        ]
        
        hourly_threats = hist_alerts_qs.annotate(hour=ExtractHour('created_at')) \
                                      .values('hour') \
                                      .annotate(count=Count('alert_id')) \
                                      .order_by('hour')
        
        return Response({
            "live_total": live_total,
            "live_blocked": live_blocked,
            "live_quarantined": live_quarantined,
            "live_zero_day": live_zero_day,
            "live_normal": live_normal,
            "distribution": distribution,
            "hourly": list(hourly_threats)
        })

# --- NEW ENDPOINT: PERSONAL NETWORK AUDIT ---
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def personal_network_audit(request):
    """
    Allows secondary users (students/professors) to upload logs for a safety check.
    Returns a human-readable safety report based on threat density.
    """
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({"error": "No log file provided."}, status=400)

    try:
        # Read uploaded log via pandas
        df = pd.read_csv(io.StringIO(file_obj.read().decode('utf-8')))
        total_rows = len(df)
        
        # 1. Strip invisible spaces and count actual anomalies based on the 'Label' column
        if 'Label' in df.columns:
            anomalies_found = len(df[df['Label'].astype(str).str.strip().str.upper() != 'BENIGN'])
        else:
            anomalies_found = 0
        
        # 2. Calculate threat density percentage
        anomaly_percentage = (anomalies_found / total_rows) * 100 if total_rows > 0 else 0

        # 3. Grading Logic based on threat density
        if anomaly_percentage == 0:
            safety_grade = "A+"
            recommendations = ["Your network appears secure. No malicious signatures detected."]
            is_safe = True
            
        elif anomaly_percentage < 1:
            safety_grade = "A"
            recommendations = ["Network is mostly secure. Minor background noise detected and ignored."]
            is_safe = True
            
        elif anomaly_percentage < 5:
            safety_grade = "B"
            recommendations = [
                f"Warden detected {anomalies_found} unusual connection attempts.",
                "Suspicious probing detected. Recommend verifying firewall rules for open ports."
            ]
            is_safe = False
            
        elif anomaly_percentage < 15:
            safety_grade = "C"
            recommendations = [
                f"Warden detected {anomalies_found} malicious connection attempts.",
                "Active threats detected. Ensure critical ports (22, 3389) are not exposed to the public internet."
            ]
            is_safe = False
            
        elif anomaly_percentage < 30:
            safety_grade = "D"
            recommendations = [
                f"High-volume attack detected ({anomaly_percentage:.1f}% of traffic).",
                "Recommend immediate IP blocking of top offending addresses."
            ]
            is_safe = False
            
        else:
            safety_grade = "F"
            recommendations = [
                f"CRITICAL: Network under severe active attack ({anomaly_percentage:.1f}% malicious).",
                "Deploy DDoS mitigation countermeasures and firewall lockdowns immediately."
            ]
            is_safe = False

        return Response({
            "report_id": f"WRDN-AUDIT-{random.randint(1000, 9999)}",
            "timestamp": timezone.now(),
            "summary": {
                "packets_scanned": total_rows,
                "anomalies": anomalies_found,
                "grade": safety_grade
            },
            "recommendations": recommendations,
            "is_safe": is_safe
        })
    except Exception as e:
        return Response({"error": f"Parsing Error: {str(e)}"}, status=400)


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all().order_by('-created_at')
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def recent(self, request):
        alerts = Alert.objects.all().order_by('-created_at')[:10]
        serializer = self.get_serializer(alerts, many=True)
        return Response({"alerts": serializer.data})

    @action(detail=True, methods=['patch'])
    def acknowledge(self, request, pk=None):
        try:
            alert = self.get_object()
            alert.status = "Acknowledged"
            alert.save()
            return Response({"status": "alert acknowledged"})
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        
    @action(detail=True, methods=['patch'])
    def false_positive(self, request, pk=None):
        try:
            alert = self.get_object()
            alert.status = "False Positive"
            alert.save()
            FeedbackLog.objects.create(alert=alert, user=request.user, label=0)
            return Response({"status": "Marked as False Positive"})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def block_ip(request):
    ip_to_block = request.data.get('ip')
    alert_id = request.data.get('alert_id')
    if alert_id:
        try:
            alert = Alert.objects.get(alert_id=alert_id)
            alert.status = "Blocked"
            alert.save()
        except Alert.DoesNotExist:
            pass
    return Response({"message": f"IP {ip_to_block} blocked."}, status=200)

# --- NEW ENDPOINT: ML FEEDBACK OVERRIDE ---
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_feedback(request):
    """
    Allows a frontend analyst to override an AI classification.
    Expects: {'alert_id': 123, 'label': 0} (0 = Benign/False Positive, 1 = Malicious/True Positive)
    """
    try:
        alert_id = request.data.get('alert_id')
        new_label = request.data.get('label')
        notes = request.data.get('notes', 'Analyst override via dashboard')
        
        # 1. Fetch the original alert
        alert = Alert.objects.get(alert_id=alert_id)
        
        # 2. Log the correction for the ML Engine to read during next training cycle
        FeedbackLog.objects.create(
            alert=alert,
            user=request.user,
            label=new_label,
            notes=notes
        )
        
        # 3. Clear it from the active/quarantine queue
        alert.status = 'Resolved'
        alert.save()
        
        return Response({
            "success": True, 
            "message": f"Alert {alert_id} overridden. Logged for next ML training cycle."
        })
        
    except Alert.DoesNotExist:
        return Response({"success": False, "error": "Alert not found."}, status=404)
    except Exception as e:
        return Response({"success": False, "error": str(e)}, status=400)


class ModelTrainingViewSet(viewsets.ViewSet):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """GET /api/training/ - Returns training info"""
        return Response({"status": "ready", "message": "Training endpoint available"})

    @action(detail=False, methods=['post'])
    def train(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No file uploaded"}, status=400)
        csv_file = request.FILES['file']
        dataset_type = request.POST.get('dataset_type', 'auto')  # Read schema hint from frontend dropdown
        result = train_dynamic_model(csv_file, dataset_type=dataset_type)
        if result['success']:
            return Response({
                "message": "Model trained",
                "metrics": result['metrics'],
                "run_id": result.get('run_id'),
                "dataset_schema": result.get('dataset_schema'),
                "schema_warning": result.get('schema_warning'),  # None if no mismatch
            }, status=200)
        return Response({"error": result['error']}, status=500)

class UpgradeRoleView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        SECRET_PASSCODE = "WARDEN-ADMIN-2026"
        provided_code = request.data.get('passcode', '').strip()
        if provided_code == SECRET_PASSCODE:
            user = request.user
            user.role = 'primary'
            user.save()
            return Response({"message": "Privileges escalated", "new_role": user.role})
        return Response({"error": "Invalid code"}, status=403)


class FeedbackViewSet(viewsets.ModelViewSet):
    queryset = FeedbackLog.objects.all()
    serializer_class = FeedbackSerializer
    permission_classes = [IsAuthenticated] 


class AssetViewSet(viewsets.ModelViewSet):
    queryset = KnownAsset.objects.all()
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['role'] = getattr(self.user, 'role', 'secondary')
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer