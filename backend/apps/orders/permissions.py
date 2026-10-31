"""
Permisos para el sistema de pedidos.
"""
from rest_framework import permissions


class IsOrderOwner(permissions.BasePermission):
    """
    Permiso para verificar que el usuario es el vendedor (owner de la tienda)
    o el comprador del pedido.
    """
    
    def has_object_permission(self, request, view, obj):
        # Staff puede ver todo
        if request.user.is_staff:
            return True
        
        # El vendedor (owner de la tienda) puede ver y modificar
        if obj.store.owner == request.user:
            return True
        
        # El comprador solo puede ver (no modificar)
        if request.method in permissions.SAFE_METHODS:
            if obj.buyer == request.user:
                return True
        
        return False


class IsStoreSeller(permissions.BasePermission):
    """
    Permiso para verificar que el usuario es el vendedor de la tienda.
    """
    
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        
        return obj.store.owner == request.user
