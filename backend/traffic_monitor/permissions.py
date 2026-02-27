from rest_framework import permissions
class IsPrimaryAnalyst(permissions.BasePermission):
    """
    Allows access only to Primary Analysts for critical actions.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'primary')
