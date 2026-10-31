"""
Product permissions - Control de acceso granular.
"""
from rest_framework import permissions


class IsStoreOwner(permissions.BasePermission):
    """
    Permiso: Solo el dueño de la tienda puede gestionar productos.
    """
    
    def has_object_permission(self, request, view, obj):
        # Admins tienen acceso total
        if request.user.is_superuser:
            return True
        
        # Determinar la tienda según el tipo de objeto
        if hasattr(obj, 'store'):
            # Es un Product
            store = obj.store
        elif hasattr(obj, 'product'):
            # Es un ProductCommand
            store = obj.product.store
        else:
            return False
        
        # Verificar ownership
        return store.owner == request.user


class IsStoreOwnerOrReadOnly(permissions.BasePermission):
    """
    Permiso: Solo el dueño puede editar, otros pueden ver si está activo.
    """
    
    def has_object_permission(self, request, view, obj):
        # Lectura permitida para productos activos
        if request.method in permissions.SAFE_METHODS:
            if hasattr(obj, 'status'):
                return obj.status == 'ACTIVE'
            return True
        
        # Escritura solo para owner
        if request.user.is_superuser:
            return True
        
        if hasattr(obj, 'store'):
            store = obj.store
        elif hasattr(obj, 'product'):
            store = obj.product.store
        else:
            return False
        
        return store.owner == request.user


class CanCreateProduct(permissions.BasePermission):
    """
    Permiso: Verificar que el usuario puede crear productos.
    """
    
    message = 'No tienes permiso para crear productos.'
    
    def has_permission(self, request, view):
        # Solo sellers pueden crear productos
        if not request.user.is_authenticated:
            return False
        
        if request.user.user_type != 'seller':
            self.message = 'Solo los vendedores pueden crear productos.'
            return False
        
        # Verificar que tenga seller_profile
        if not hasattr(request.user, 'seller_profile'):
            self.message = 'Perfil de vendedor no encontrado.'
            return False
        
        return True
