from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from rest_framework_simplejwt.views import TokenRefreshView
from traffic_monitor.views import CustomTokenObtainPairView 
from traffic_monitor import views

urlpatterns = [

    path('', RedirectView.as_view(url='admin/login/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/audit-personal-log/', views.personal_network_audit, name='audit_personal_log'),

    # 3. Your App Routes
    path('api/', include('traffic_monitor.urls')),
]