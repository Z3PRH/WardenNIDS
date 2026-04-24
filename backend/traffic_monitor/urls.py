from django import views
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView
from .views import (
    TrafficViewSet, 
    AlertViewSet, 
    block_ip,
    UpgradeRoleView,
    GetMyUpgradeRequestView,
    AdminRoleUpprovalListView,
    ApproveRoleUpgradeView,
    RejectRoleUpgradeView,
    CancelRoleUpgradeView,
    ModelTrainingViewSet,
    GetMyUpgradeRequestHistoryView
)

router = DefaultRouter()
router.register(r'traffic', TrafficViewSet)
router.register(r'alerts', AlertViewSet)

# FIX 1: Changed to 'model' so Django REST Framework automatically 
# creates the /api/model/train/ endpoint for the @action in views.py
router.register(r'model', ModelTrainingViewSet, basename='model') 
# ----------------------------------------

urlpatterns = [
    path('', include(router.urls)),
    
    # FIX 2: Changed dash to underscore to match React's axios call
    path('block_ip/', block_ip, name='block_ip'),
    
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # Role Upgrade Request Endpoints
    path('upgrade-role/', UpgradeRoleView.as_view(), name='upgrade_role'),
    path('my-upgrade-request/', GetMyUpgradeRequestView.as_view(), name='get_my_upgrade_request'),
    path('role-upgrade-requests/', AdminRoleUpprovalListView.as_view(), name='admin_role_approval_list'),
    path('my-upgrade-request-history/', GetMyUpgradeRequestHistoryView.as_view(), name='get_my_upgrade_request_history'),
    path('role-upgrade-requests/<int:request_id>/approve/', ApproveRoleUpgradeView.as_view(), name='approve_role_upgrade'),
    path('role-upgrade-requests/<int:request_id>/reject/', RejectRoleUpgradeView.as_view(), name='reject_role_upgrade'),
    path('role-upgrade-requests/<int:request_id>/cancel/', CancelRoleUpgradeView.as_view(), name='cancel_role_upgrade'),
]