from rest_framework import serializers
from .models import User, NetworkTraffic, Alert, MLModel, FeedbackLog, KnownAsset

# 1. User Serializer
class UserSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = User
        fields = ['user_id', 'username', 'email', 'role', 'created_at']

# 2. Traffic Serializer
class TrafficSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkTraffic
        fields = '__all__'

# 3. Alert Serializer
class AlertSerializer(serializers.ModelSerializer):
    # Map the severity to threat_level
    threat_level = serializers.CharField(source='severity', read_only=True)
    traffic = TrafficSerializer(read_only=True)
    
    class Meta:
        model = Alert
        fields = '__all__'

# 4. ML Model Serializer
class MLModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLModel
        fields = '__all__'

# 5. Feedback Serializer (Admin Only)
class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackLog
        fields = '__all__'

# 6. Asset Serializer (Admin Only)
class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnownAsset
        fields = '__all__'