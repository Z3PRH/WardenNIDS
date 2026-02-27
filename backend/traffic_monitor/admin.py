from django.contrib import admin
from .models import User, NetworkTraffic, Alert, MLModel, FeedbackLog, KnownAsset

# 1. Register the Admin-Only Models
# These will appear in the Admin Panel for full management (Add/Edit/Delete)
@admin.register(KnownAsset)
class KnownAssetAdmin(admin.ModelAdmin):
    list_display = ('ip_address', 'device_type', 'trust_level')
    search_fields = ('ip_address', 'device_type')
    list_filter = ('trust_level', 'device_type')

@admin.register(FeedbackLog)
class FeedbackLogAdmin(admin.ModelAdmin):
    list_display = ('feedback_id', 'alert', 'user', 'label', 'feedback_time')
    list_filter = ('label', 'feedback_time')
    # Optional: Make feedback logs read-only in admin so history isn't tampered with
    # readonly_fields = ('alert', 'user', 'label', 'feedback_time')

# 2. Register Shared Models (Optional)
# You might want Admins to view these, but maybe not edit them manually
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'created_at')
    list_filter = ('role',)

@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ('model_name', 'model_version', 'accuracy', 'threshold')


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('severity', 'status', 'created_at', 'traffic')
    list_filter = ('severity', 'status')

@admin.register(NetworkTraffic)
class NetworkTrafficAdmin(admin.ModelAdmin):
    list_display = ('src_ip', 'dst_ip', 'protocol', 'anomaly_score', 'timestamp')
    list_filter = ('protocol',)
    search_fields = ('src_ip', 'dst_ip')