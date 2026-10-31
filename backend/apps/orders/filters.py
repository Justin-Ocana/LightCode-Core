"""
Filtros para pedidos.
"""
import django_filters
from .models import Order


class OrderFilter(django_filters.FilterSet):
    """
    Filtros para la lista de pedidos.
    """
    
    status = django_filters.MultipleChoiceFilter(
        choices=Order.Status.choices,
        field_name='status',
        lookup_expr='in'
    )
    
    delivery_method = django_filters.ChoiceFilter(
        choices=Order.DeliveryMethod.choices
    )
    
    minecraft_username = django_filters.CharFilter(
        lookup_expr='icontains'
    )
    
    order_number = django_filters.CharFilter(
        lookup_expr='icontains'
    )
    
    created_after = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='gte'
    )
    
    created_before = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='lte'
    )
    
    min_amount = django_filters.NumberFilter(
        field_name='amount_after_discount',
        lookup_expr='gte'
    )
    
    max_amount = django_filters.NumberFilter(
        field_name='amount_after_discount',
        lookup_expr='lte'
    )
    
    class Meta:
        model = Order
        fields = [
            'status', 'delivery_method', 'minecraft_username',
            'order_number', 'created_after', 'created_before',
            'min_amount', 'max_amount'
        ]
