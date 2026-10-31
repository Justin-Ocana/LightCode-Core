"""
Serializers para el sistema de pedidos.
"""
from rest_framework import serializers
from .models import Order, RCONJob, OrderStatusHistory, OrderNote


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer para historial de cambios de estado."""
    
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderStatusHistory
        fields = [
            'id', 'from_status', 'to_status', 'changed_by', 
            'changed_by_name', 'reason', 'created_at'
        ]
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.username
        return 'Sistema'


class OrderNoteSerializer(serializers.ModelSerializer):
    """Serializer para notas del vendedor."""
    
    author_name = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderNote
        fields = [
            'id', 'author', 'author_name', 'content', 
            'is_internal', 'created_at'
        ]
    
    def get_author_name(self, obj):
        if obj.author:
            return obj.author.username
        return 'Desconocido'


class RCONJobSerializer(serializers.ModelSerializer):
    """Serializer para jobs RCON."""
    
    cancelled_by_username = serializers.SerializerMethodField()
    is_partial_delivery = serializers.SerializerMethodField()
    delivered_commands = serializers.SerializerMethodField()
    pending_commands = serializers.SerializerMethodField()
    
    class Meta:
        model = RCONJob
        fields = [
            'id', 'status', 'auto_retry_count', 'manual_retry_count', 
            'attempts', 'max_attempts',
            'rcon_raw_log', 'rcon_error', 'failure_reason', 'failure_reason_type',
            'last_error_message',
            'is_partial_delivery', 'delivered_commands', 'pending_commands',
            'next_retry_at', 'last_attempt_at', 'delivered_at',
            'cancelled_by', 'cancelled_by_username', 'cancelled_at',
            'created_at', 'updated_at'
        ]
    
    def get_cancelled_by_username(self, obj):
        if obj.cancelled_by:
            return obj.cancelled_by.username
        return None
    
    def get_is_partial_delivery(self, obj):
        """Detecta si hay entrega parcial basándose en el log"""
        if not obj.rcon_raw_log:
            return False
        return '✅ Ejecutados exitosamente:' in obj.rcon_raw_log and '❌ Comandos pendientes' in obj.rcon_raw_log
    
    def get_delivered_commands(self, obj):
        """Extrae lista de items entregados (sin el comando 'give')"""
        if not obj.rcon_raw_log or '✅ Ejecutados exitosamente:' not in obj.rcon_raw_log:
            return []
        
        try:
            # Extraer sección de comandos exitosos
            log_parts = obj.rcon_raw_log.split('✅ Ejecutados exitosamente:')
            if len(log_parts) < 2:
                return []
            
            success_section = log_parts[1].split('❌ Comandos pendientes')[0]
            items = []
            for line in success_section.strip().split('\n'):
                line = line.strip()
                if line.startswith('•'):
                    cmd = line[1:].strip()
                    # Parsear comando: "give lightcodedea diamond_sword 1" -> "Diamond Sword x1"
                    item = self._parse_give_command(cmd)
                    if item:
                        items.append(item)
            return items
        except:
            return []
    
    def get_pending_commands(self, obj):
        """Extrae lista de items pendientes (sin el comando 'give')"""
        if not obj.rcon_raw_log or '❌ Comandos pendientes' not in obj.rcon_raw_log:
            return []
        
        try:
            # Extraer sección de comandos pendientes
            log_parts = obj.rcon_raw_log.split('❌ Comandos pendientes')
            if len(log_parts) < 2:
                return []
            
            pending_section = log_parts[1].split(':')[1] if ':' in log_parts[1] else log_parts[1]
            items = []
            for line in pending_section.strip().split('\n'):
                line = line.strip()
                if line.startswith('•'):
                    cmd = line[1:].strip()
                    # Parsear comando: "give lightcodedea golden_apple 2" -> "Golden Apple x2"
                    item = self._parse_give_command(cmd)
                    if item:
                        items.append(item)
            return items
        except:
            return []
    
    def _parse_give_command(self, command):
        """
        Parsea un comando give y retorna el item en formato legible.
        Ejemplo: "give lightcodedea diamond_sword 1" -> "Diamond Sword x1"
        """
        try:
            parts = command.split()
            if len(parts) < 3 or parts[0] != 'give':
                return command  # Si no es un comando give, retornar tal cual
            
            # Extraer item y cantidad
            item_id = parts[2]
            quantity = parts[3] if len(parts) > 3 else '1'
            
            # Convertir item_id a nombre legible: "diamond_sword" -> "Diamond Sword"
            item_name = item_id.replace('_', ' ').title()
            
            return f"{item_name} x{quantity}"
        except:
            return command


class OrderListSerializer(serializers.ModelSerializer):
    """Serializer para lista de pedidos (vista resumida)."""
    
    product_snapshot = serializers.JSONField(read_only=True)
    product_name = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    buyer_username = serializers.SerializerMethodField()
    rcon_job = RCONJobSerializer(read_only=True)  # Agregar RCON job para la cola
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'status', 'status_display',
            'delivery_method', 'delivery_method_display',
            'product_snapshot', 'product_name', 'product_image', 'minecraft_username',
            'buyer', 'buyer_username',
            'amount_after_discount', 'currency',
            'payment_method', 'gross_amount', 'paypal_fee', 'net_amount',  # Solo pagos directos
            'created_at', 'delivered_at',
            'rcon_job'  # Incluir RCON job
        ]
    
    def get_product_name(self, obj):
        return obj.product_snapshot.get('name', 'Producto eliminado')
    
    def get_product_image(self, obj):
        return obj.product_snapshot.get('image')
    
    def get_buyer_username(self, obj):
        if obj.buyer:
            return obj.buyer.username
        return 'Invitado'


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalles de pedido."""
    
    product_snapshot = serializers.JSONField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_method_display = serializers.CharField(source='get_delivery_method_display', read_only=True)
    
    # Relaciones
    rcon_job = RCONJobSerializer(read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    notes = OrderNoteSerializer(many=True, read_only=True)
    
    # Campos calculados
    buyer_username = serializers.SerializerMethodField()
    store_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            # Identificadores
            'id', 'order_number', 'status', 'status_display',
            'delivery_method', 'delivery_method_display',
            'manual_reason',
            
            # Relaciones
            'store', 'store_name', 'buyer', 'buyer_username',
            'product', 'product_snapshot', 'discount',
            
            # Datos del comprador
            'buyer_contact_email', 'buyer_paypal_name', 'buyer_paypal_email', 'buyer_payer_id',
            'paypal_transaction_id', 'paypal_order_id', 'payment_ip',
            
            # Datos del producto/servidor
            'minecraft_username', 'server_address', 'command_sent',
            
            # Montos básicos
            'original_amount', 'discount_code', 'discount_type',
            'discount_value', 'discount_amount_saved', 'amount_after_discount',
            'currency',
            
            # Pagos directos PayPal (sin comisión lightcode)
            'payer_email', 'payer_id', 'gross_amount', 'paypal_fee', 'net_amount',
            'payment_method', 'webhook_confirmed', 'minecraft_delivered',
            
            # Timestamps
            'payment_captured_at', 'created_at', 'updated_at', 'delivered_at',
            
            # Notas
            'seller_notes',
            
            # Relaciones anidadas
            'rcon_job', 'status_history', 'notes'
        ]
    
    def get_buyer_username(self, obj):
        if obj.buyer:
            return obj.buyer.username
        return 'Invitado'
    
    def get_store_name(self, obj):
        return obj.store.name


class CheckoutRequestSerializer(serializers.Serializer):
    """Serializer para iniciar checkout."""
    
    product_id = serializers.UUIDField(required=True)
    minecraft_username = serializers.CharField(max_length=16, required=True)
    discount_code = serializers.CharField(max_length=50, required=False, allow_blank=True)
    
    def validate_minecraft_username(self, value):
        """Validar formato de username de Minecraft."""
        if not value.replace('_', '').isalnum():
            raise serializers.ValidationError("Username de Minecraft inválido")
        return value


class CapturePaymentSerializer(serializers.Serializer):
    """Serializer para capturar pago de PayPal."""
    
    paypal_order_id = serializers.CharField(required=True)


class UpdateOrderStatusSerializer(serializers.Serializer):
    """Serializer para actualizar estado de pedido (manual)."""
    
    status = serializers.ChoiceField(
        choices=[
            Order.Status.REQUESTED,
            Order.Status.DELIVERED,
            Order.Status.FAILED,
            Order.Status.CANCELLED,
            Order.Status.REFUNDED
        ],
        required=True
    )
    reason = serializers.CharField(required=False, allow_blank=True)


class AddOrderNoteSerializer(serializers.Serializer):
    """Serializer para agregar nota a pedido."""
    
    content = serializers.CharField(required=True)
    is_internal = serializers.BooleanField(default=True)
