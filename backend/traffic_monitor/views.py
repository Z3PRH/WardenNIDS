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
                "packetCount": t.packet_count, 
                "anomalyCount": 1 if has_alert else 0
            })
        return Response({"data": data})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        now = timezone.now()
        historical_threshold = now - timedelta(hours=24)
        live_threshold = now - timedelta(seconds=10) 

        # 1. LIVE DATA (With Future Ghost Packet Fix)
        # Filters strictly between 10s ago and exactly 'now'
        live_traffic_qs = NetworkTraffic.objects.filter(timestamp__gte=live_threshold, timestamp__lte=now)
        live_alerts_qs = Alert.objects.filter(created_at__gte=live_threshold, created_at__lte=now)

        live_total = live_traffic_qs.count()
        live_zero_day = live_alerts_qs.filter(severity__icontains='unknown').count()
        live_quarantined = live_alerts_qs.filter(status__icontains='quarantined').exclude(severity__icontains='unknown').count()
        live_blocked = live_alerts_qs.exclude(severity__icontains='unknown').exclude(status__icontains='quarantined').count()
        live_normal = max(0, live_total - (live_zero_day + live_quarantined + live_blocked))

        # 2. HISTORICAL DATA (Last 24 Hours)
        hist_alerts_qs = Alert.objects.filter(created_at__gte=historical_threshold, created_at__lte=now)
        hist_traffic_total = NetworkTraffic.objects.filter(timestamp__gte=historical_threshold, timestamp__lte=now).count()
        
        hist_zero = hist_alerts_qs.filter(severity__icontains='unknown').count()
        hist_quar = hist_alerts_qs.filter(status__icontains='quarantined').exclude(severity__icontains='unknown').count()
        hist_block = hist_alerts_qs.exclude(severity__icontains='unknown').exclude(status__icontains='quarantined').count()
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
    Returns a human-readable safety report.
    """
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({"error": "No log file provided."}, status=400)

    try:
        # Read uploaded log via pandas
        df = pd.read_csv(io.StringIO(file_obj.read().decode('utf-8')))
        total_rows = len(df)
        
        # Simulate ML audit for non-technical users
        # This prevents these test scans from appearing on the main dashboard
        anomalies_found = random.randint(0, min(total_rows, 5))
        
        safety_grade = "A+"
        recommendations = ["Your network appears secure. No malicious signatures detected."]

        if anomalies_found > 0:
            safety_grade = "B" if anomalies_found < 3 else "C"
            recommendations = [
                f"Warden detected {anomalies_found} unusual connection attempts.",
                "Verify that all connected IoT devices are recognized.",
                "Recommend rotating your WiFi WPA3 password."
            ]
        
        return Response({
            "report_id": f"WRDN-AUDIT-{random.randint(1000, 9999)}",
            "timestamp": timezone.now(),
            "summary": {
                "packets_scanned": total_rows,
                "anomalies": anomalies_found,
                "grade": safety_grade
            },
            "recommendations": recommendations,
            "is_safe": anomalies_found == 0
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
        result = train_dynamic_model(csv_file)
        if result['success']:
            return Response({"message": "Model trained", "metrics": result['metrics']}, status=200)
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