from django.contrib import admin
from .models import User, MLModel, Alert, NetworkTraffic, FeedbackLog, RoleUpgradeRequest

# 1. View all personnel, differentiate based on roles
@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'is_staff', 'created_at')
    list_filter = ('role', 'is_staff', 'created_at') # Creates a sidebar to filter by role
    search_fields = ('username', 'email')

# 2. View the models, and their info, accuracy
@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ('model_name', 'model_version', 'dataset_schema', 'f1_score', 'accuracy', 'trained_on')
    list_filter = ('dataset_schema', 'model_name', 'trained_on')
    search_fields = ('model_version', 'run_id')
    date_hierarchy = 'trained_on' # Creates a top navigation to see "This Week's" models

# 3. View new types of attacks and history
@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('alert_id', 'severity', 'status', 'created_at')
    list_filter = ('severity', 'status', 'created_at') # Filter attacks by "Past 7 Days"
    date_hierarchy = 'created_at' 
    search_fields = ('severity',)

# Manage Role Upgrades
@admin.register(RoleUpgradeRequest)
class RoleUpgradeAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'requested_at', 'approved_by')
    list_filter = ('status', 'requested_at')

# Basic view for remaining tables
admin.site.register(FeedbackLog)
admin.site.register(NetworkTraffic)

# Customize the Admin Header for your Presentation
admin.site.site_header = "Warden NIDS Central Administration"
admin.site.site_title = "Warden Admin Portal"
admin.site.index_title = "Welcome to the Central Security Dashboard"