from rest_framework import serializers
from .models import Discount, DiscountUsage
from apps.products.serializers import ProductListSerializer, ProductCategorySerializer

class DiscountSerializer(serializers.ModelSerializer):
    applicable_products_data = ProductListSerializer(source='applicable_products', many=True, read_only=True)
    applicable_categories_data = ProductCategorySerializer(source='applicable_categories', many=True, read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = [
            'id', 'store', 'name', 'code', 'code_type', 'discount_type', 
            'value', 'scope', 'applicable_products', 'applicable_categories',
            'applicable_products_data', 'applicable_categories_data',
            'min_purchase_amount', 'min_items_count', 'only_first_purchase',
            'max_uses_global', 'max_uses_per_user', 'is_combinable',
            'start_date', 'end_date', 'is_active', 'status',
            'total_uses', 'total_discounted_amount', 'created_at'
        ]
        read_only_fields = ['id', 'total_uses', 'total_discounted_amount', 'created_at', 'status']

    def get_status(self, obj):
        from django.utils import timezone
        now = timezone.now()
        
        if not obj.is_active: 
            return 'inactive'
        
        # Robust comparison for start_date
        if obj.start_date and obj.start_date > now: 
            return 'scheduled'
            
        # Robust comparison for end_date
        if obj.end_date and obj.end_date < now: 
            return 'expired'
            
        if obj.max_uses_global and obj.total_uses >= obj.max_uses_global: 
            return 'limit_reached'
            
        return 'active'
    
    def to_representation(self, instance):
        """Override to handle ManyToMany fields properly"""
        data = super().to_representation(instance)
        # Ensure applicable_products and applicable_categories are lists of IDs
        if 'applicable_products' in data and data['applicable_products']:
            data['applicable_products'] = [str(p) if hasattr(p, '__str__') else p for p in instance.applicable_products.values_list('id', flat=True)]
        else:
            data['applicable_products'] = []
            
        if 'applicable_categories' in data and data['applicable_categories']:
            data['applicable_categories'] = [str(c) if hasattr(c, '__str__') else c for c in instance.applicable_categories.values_list('id', flat=True)]
        else:
            data['applicable_categories'] = []
        
        return data

class DiscountUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountUsage
        fields = '__all__'
