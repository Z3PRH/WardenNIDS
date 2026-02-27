from django import views
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView
from .views import (
    TrafficViewSet, 
    AlertViewSet, 
    block_ip,
    UpgradeRoleView,
    ModelTrainingViewSet 
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
    path('upgrade-role/', UpgradeRoleView.as_view(), name='upgrade_role'),
]