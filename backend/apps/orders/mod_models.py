"""
ModCommand - Comandos pendientes para entrega via PlugsEssentials mod.
Soporta tanto entregas de órdenes como comandos manuales desde el panel.
"""
from django.db import models
from django.utils import timezone
import uuid


class ModCommand(models.Model):
    """
    Comando pendiente para ser ejecutado por el mod PlugsEssentials en el servidor.

    Flujo de estados: pending → processing → completed | failed

    - pending:    Listo para ser recogido por el mod
    - processing: El mod lo recibió (GET), aún no confirmó ejecución
    - completed:  El mod confirmó ejecución exitosa (POST /confirm)
    - failed:     Error al ejecutar, con mensaje de error
    """

    class Status(models.TextChoices):
        PENDING       = 'pending',       'Pendiente'
        PENDING_CLAIM = 'pending_claim', 'Esperando reclamo del jugador'
        PROCESSING    = 'processing',    'Procesando'
        COMPLETED     = 'completed',     'Completado'
        FAILED        = 'failed',        'Fallido'

    class Source(models.TextChoices):
        ORDER  = 'order',  'Orden de compra'
        MANUAL = 'manual', 'Comando manual (panel)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Tienda dueña del comando (aislamiento multi-tenant)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='mod_commands',
        db_index=True
    )

    # Orden relacionada (opcional, solo para source=order)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mod_commands'
    )

    # El comando a ejecutar. Puede contener {player} como placeholder.
    command = models.TextField(
        help_text='Comando a ejecutar. Usa {player} como placeholder del jugador.'
    )

    # Nombre del jugador para reemplazar {player}
    player = models.CharField(
        max_length=64,
        blank=True,
        help_text='Nombre del jugador Minecraft (reemplaza {player} en el comando)'
    )

    # Origen del comando
    source = models.CharField(
        max_length=10,
        choices=Source.choices,
        default=Source.ORDER,
        db_index=True
    )

    # Tipo de ejecución: player (desde jugador) o world (desde overworld)
    class ExecType(models.TextChoices):
        PLAYER = 'player', 'Desde jugador'
        WORLD  = 'world',  'Desde overworld'

    exec_type = models.CharField(
        max_length=6,
        choices=ExecType.choices,
        default=ExecType.PLAYER,
        help_text='player = runCommand desde jugador, world = desde overworld'
    )

    # Estado actual
    status = models.CharField(
        max_length=14,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )

    # Reintentos y expiración
    retry_count   = models.IntegerField(default=0, help_text='Número de reintentos realizados')
    max_retries   = models.IntegerField(default=0, help_text='0 = sin límite de reintentos')
    expires_at    = models.DateTimeField(null=True, blank=True, db_index=True,
                        help_text='Si no se completa antes de esta fecha, se marca como failed')
    delay_seconds = models.IntegerField(default=0,
                        help_text='Segundos a esperar antes de ejecutar (para comandos secuenciales)')
    next_retry_at = models.DateTimeField(null=True, blank=True, db_index=True,
                        help_text='Próximo intento programado')

    # Resultado de ejecución
    error_message = models.TextField(blank=True)

    # Slots requeridos en el inventario del jugador para reclamar
    required_slots = models.IntegerField(
        default=0,
        help_text='Slots libres que el jugador necesita para recibir este comando'
    )

    # Timestamps
    created_at    = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at    = models.DateTimeField(auto_now=True)
    processing_at = models.DateTimeField(null=True, blank=True)
    completed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'mod_commands'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.status}] {self.store.slug} | {self.command[:60]}"

    def get_resolved_command(self):
        """Devuelve el comando con {player} reemplazado por el nombre real."""
        if self.player:
            return self.command.replace('{player}', self.player)
        return self.command

    def mark_processing(self):
        self.status = self.Status.PROCESSING
        self.processing_at = timezone.now()
        self.save(update_fields=['status', 'processing_at', 'updated_at'])

    def mark_completed(self):
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at', 'updated_at'])

    def mark_failed(self, error=''):
        self.status = self.Status.FAILED
        self.error_message = error
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'error_message', 'completed_at', 'updated_at'])
