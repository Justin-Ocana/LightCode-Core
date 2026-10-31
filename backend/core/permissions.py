"""
Custom permission classes for granular access control.
"""
from rest_framework import permissions
from guardian.shortcuts import get_objects_for_user


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow owners to edit.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Check if object has owner attribute
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        return False


class IsStoreOwner(permissions.BasePermission):
    """
    Permission to check if user owns the store.
    """
    def has_object_permission(self, request, view, obj):
        # Get store from object
        store = getattr(obj, 'store', obj)
        return store.owner == request.user


class IsStoreOwnerOrReadOnly(permissions.BasePermission):
    """
    Store owners can edit, others can only read.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        store = getattr(obj, 'store', obj)
        return store.owner == request.user


class IsStoreStaffOrReadOnly(permissions.BasePermission):
    """
    Store staff (owner + staff members) can edit.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        store = getattr(obj, 'store', obj)
        
        # Check if user is owner
        if store.owner == request.user:
            return True
        
        # Check if user is staff member
        if hasattr(store, 'staff'):
            return store.staff.filter(id=request.user.id).exists()
        
        return False


class HasStorePermission(permissions.BasePermission):
    """
    Check if user has specific permission on store using django-guardian.
    Usage: Set permission_required attribute on view.
    """
    def has_object_permission(self, request, view, obj):
        permission = getattr(view, 'permission_required', None)
        if not permission:
            return True
        
        store = getattr(obj, 'store', obj)
        return request.user.has_perm(permission, store)


class IsSuperUserOrReadOnly(permissions.BasePermission):
    """
    Only superusers can modify, everyone can read.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_superuser


class IslightcodeAdmin(permissions.BasePermission):
    """
    Only superusers and staff can access lightcode admin panel.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.is_staff
        )
