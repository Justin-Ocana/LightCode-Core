"""
Reusable mixins for views and models.
"""
from django.db import models
from django.utils import timezone
from django.core.cache import cache
from rest_framework.response import Response
from rest_framework import status


class TimestampMixin(models.Model):
    """
    Abstract model mixin for created_at and updated_at fields.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True
        ordering = ['-created_at']


class SoftDeleteMixin(models.Model):
    """
    Abstract model mixin for soft delete functionality.
    """
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        """Mark object as deleted."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])
    
    def restore(self):
        """Restore soft-deleted object."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])


class CacheInvalidationMixin:
    """
    Mixin to automatically invalidate cache on model changes.
    """
    def get_cache_key(self):
        """Override this to define cache key pattern."""
        return f"{self.__class__.__name__}:{self.pk}"
    
    def invalidate_cache(self):
        """Invalidate cache for this object."""
        cache_key = self.get_cache_key()
        cache.delete(cache_key)
        
        # Also invalidate list cache
        list_cache_key = f"{self.__class__.__name__}:list"
        cache.delete(list_cache_key)
    
    def save(self, *args, **kwargs):
        """Override save to invalidate cache."""
        super().save(*args, **kwargs)
        self.invalidate_cache()
    
    def delete(self, *args, **kwargs):
        """Override delete to invalidate cache."""
        self.invalidate_cache()
        super().delete(*args, **kwargs)


class CachedListMixin:
    """
    Mixin for ViewSets to cache list responses.
    """
    cache_timeout = 300  # 5 minutes default
    
    def list(self, request, *args, **kwargs):
        """Cache list responses."""
        cache_key = self.get_list_cache_key(request)
        
        # Try to get from cache
        cached_response = cache.get(cache_key)
        if cached_response is not None:
            return Response(cached_response)
        
        # Get fresh data
        response = super().list(request, *args, **kwargs)
        
        # Cache the response
        if response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, self.cache_timeout)
        
        return response
    
    def get_list_cache_key(self, request):
        """Generate cache key for list endpoint."""
        model_name = self.queryset.model.__name__
        query_params = request.query_params.urlencode()
        return f"{model_name}:list:{query_params}"
