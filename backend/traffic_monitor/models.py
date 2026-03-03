from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class User(AbstractUser):    
    # Enforcing constraints from your table design:
    email = models.EmailField(unique=True, max_length=100)
    
    ROLE_CHOICES = (
        ('Admin', 'Admin'),
        ('primary', 'Primary Analyst'),
        ('secondary', 'Secondary Analyst'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='secondary')
    
    # Explicitly matching your 'created_at' column preference
    created_at = models.DateTimeField(auto_now_add=True)

    # Fix related_name conflicts with default Django auth
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='traffic_user_set',
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='traffic_user_set',
        blank=True
    )

    def __str__(self):
        return f"{self.username} ({self.role})"
# 2. NETWORK_TRAFFIC Table (Source 206)
class NetworkTraffic(models.Model):
    traffic_id = models.AutoField(primary_key=True)
    src_ip = models.CharField(max_length=15)
    dst_ip = models.CharField(max_length=15)
    protocol = models.CharField(max_length=10)
    packet_count = models.IntegerField()
    byte_count = models.IntegerField()
    timestamp = models.DateTimeField(default=timezone.now)
    anomaly_score = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.src_ip} -> {self.dst_ip}"

# 3. ALERTS Table (Source 209)
class Alert(models.Model):
    alert_id = models.AutoField(primary_key=True)
    traffic = models.ForeignKey(NetworkTraffic, on_delete=models.CASCADE)
    severity = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='open')
    created_at = models.DateTimeField(default=timezone.now)


# 4. ML_MODEL Table (Source 211)
class MLModel(models.Model):
    model_id = models.AutoField(primary_key=True)
    model_name = models.CharField(max_length=100)
    model_version = models.CharField(max_length=50)
    trained_on = models.DateField()
    threshold = models.FloatField()
    accuracy = models.FloatField()
    precision = models.FloatField()
    recall = models.FloatField()
    f1_score = models.FloatField()
    samples_trained = models.IntegerField()
    
    # File Reference (Optional: path to the actual .pkl file)
    file_path = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.model_name} ({self.model_version}) - F1: {self.f1_score:.2f}"

# ==========================================
# ADMIN EXCLUSIVE TABLES
# These tables are defined here for the database, 
# but will be RESTRICTED in the Admin Panel/API.
# ==========================================

# 5. FEEDBACK_LOG Table (Source 213)
class FeedbackLog(models.Model):
    feedback_id = models.AutoField(primary_key=True)
    alert = models.ForeignKey(Alert, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    label = models.IntegerField()  # 0 = Normal, 1 = Attack
    feedback_time = models.DateTimeField(default=timezone.now)
    
    class Meta:
        # This ensures only users with 'change_feedbacklog' permission can edit
        default_permissions = ('add', 'change', 'delete', 'view')

# 6. KNOWN_ASSET Table (Source 215)
class KnownAsset(models.Model):
    asset_id = models.AutoField(primary_key=True)
    ip_address = models.CharField(max_length=45, unique=True)
    device_type = models.CharField(max_length=50)
    trust_level = models.CharField(max_length=20, default='Medium')