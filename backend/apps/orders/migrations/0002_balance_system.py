# Generated migration for balance system

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid
from decimal import Decimal
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orders', '0001_initial'),
    ]

    operations = [
        # Update Order model for balance system
        migrations.RemoveField(
            model_name='order',
            name='paypal_withdraw_fee',
        ),
        migrations.RemoveField(
            model_name='order',
            name='paypal_withdraw_fee_percent',
        ),
        migrations.RemoveField(
            model_name='order',
            name='seller_gross',
        ),
        migrations.RemoveField(
            model_name='order',
            name='seller_net',
        ),
        migrations.AddField(
            model_name='order',
            name='seller_credited',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Monto acreditado al balance del vendedor',
                max_digits=10
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='balance_credited',
            field=models.BooleanField(
                default=False,
                help_text='Si ya se acreditó al balance del vendedor'
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='balance_released',
            field=models.BooleanField(
                default=False,
                help_text='Si el balance pasó de pending a available (orden entregada)'
            ),
        ),
        migrations.AlterField(
            model_name='order',
            name='paypal_receive_fee_percent',
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal('0.0690'),
                max_digits=5
            ),
        ),
        migrations.AlterField(
            model_name='order',
            name='lightcode_fee_percent',
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal('0.0430'),
                max_digits=5
            ),
        ),
        
        # Create SellerBalance model
        migrations.CreateModel(
            name='SellerBalance',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('available_balance', models.DecimalField(
                    decimal_places=2,
                    default=Decimal('0.00'),
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))]
                )),
                ('pending_balance', models.DecimalField(
                    decimal_places=2,
                    default=Decimal('0.00'),
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))]
                )),
                ('total_earned', models.DecimalField(
                    decimal_places=2,
                    default=Decimal('0.00'),
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))]
                )),
                ('total_withdrawn', models.DecimalField(
                    decimal_places=2,
                    default=Decimal('0.00'),
                    max_digits=12,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.00'))]
                )),
                ('currency', models.CharField(default='USD', max_length=3)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('seller', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='seller_balance',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Balance de Vendedor',
                'verbose_name_plural': 'Balances de Vendedores',
                'db_table': 'seller_balances',
            },
        ),
        
        # Create Withdrawal model
        migrations.CreateModel(
            name='Withdrawal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount_requested', models.DecimalField(
                    decimal_places=2,
                    max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('5.00'))]
                )),
                ('paypal_fee_withdraw', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('paypal_fee_rate', models.DecimalField(decimal_places=4, default=Decimal('0.0190'), max_digits=5)),
                ('amount_received', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('paypal_transaction_id', models.CharField(blank=True, max_length=100)),
                ('paypal_destination', models.EmailField(max_length=254)),
                ('paypal_batch_id', models.CharField(blank=True, max_length=100)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pendiente'),
                        ('processing', 'Procesando'),
                        ('completed', 'Completado'),
                        ('failed', 'Fallido'),
                        ('cancelled', 'Cancelado')
                    ],
                    default='pending',
                    max_length=20
                )),
                ('failure_reason', models.TextField(blank=True)),
                ('notes', models.TextField(blank=True)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('seller', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='withdrawals',
                    to=settings.AUTH_USER_MODEL
                )),
                ('processed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='processed_withdrawals',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'db_table': 'withdrawals',
                'ordering': ['-requested_at'],
            },
        ),
        
        # Create BalanceTransaction model
        migrations.CreateModel(
            name='BalanceTransaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('type', models.CharField(
                    choices=[
                        ('sale', 'Venta'),
                        ('withdrawal', 'Retiro'),
                        ('refund', 'Reembolso'),
                        ('adjustment', 'Ajuste Manual'),
                        ('fee', 'Fee'),
                        ('delivery', 'Entrega Completada')
                    ],
                    max_length=20
                )),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('balance_before', models.DecimalField(decimal_places=2, max_digits=10)),
                ('balance_after', models.DecimalField(decimal_places=2, max_digits=10)),
                ('description', models.TextField()),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('seller', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='balance_transactions',
                    to=settings.AUTH_USER_MODEL
                )),
                ('order', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='balance_transactions',
                    to='orders.order'
                )),
                ('withdrawal', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='balance_transactions',
                    to='orders.withdrawal'
                )),
            ],
            options={
                'db_table': 'balance_transactions',
                'ordering': ['-created_at'],
            },
        ),
        
        # Create lightcodeEarnings model
        migrations.CreateModel(
            name='lightcodeEarnings',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('gross_payment', models.DecimalField(
                    decimal_places=2,
                    help_text='Lo que pagó el comprador (con o sin descuento)',
                    max_digits=10
                )),
                ('paypal_fee_receive', models.DecimalField(
                    decimal_places=2,
                    help_text='Fee de PayPal al RECIBIR el pago',
                    max_digits=10
                )),
                ('amount_after_paypal', models.DecimalField(
                    decimal_places=2,
                    help_text='Lo que quedó después del fee de PayPal',
                    max_digits=10
                )),
                ('lightcode_fee_amount', models.DecimalField(
                    decimal_places=2,
                    help_text='Comisión de lightcode',
                    max_digits=10
                )),
                ('seller_credited', models.DecimalField(
                    decimal_places=2,
                    help_text='Lo que se acreditó al vendedor',
                    max_digits=10
                )),
                ('lightcode_plan', models.CharField(max_length=20)),
                ('lightcode_fee_rate', models.DecimalField(
                    decimal_places=4,
                    help_text='% de comisión lightcode en ese momento',
                    max_digits=5
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lightcode_earnings',
                    to='orders.order'
                )),
                ('seller', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lightcode_earnings_from',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'db_table': 'lightcode_earnings',
                'ordering': ['-created_at'],
            },
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='balancetransaction',
            index=models.Index(fields=['seller', '-created_at'], name='balance_tra_seller__idx'),
        ),
        migrations.AddIndex(
            model_name='balancetransaction',
            index=models.Index(fields=['type', '-created_at'], name='balance_tra_type_idx'),
        ),
        migrations.AddIndex(
            model_name='withdrawal',
            index=models.Index(fields=['seller', '-requested_at'], name='withdrawal_seller_idx'),
        ),
        migrations.AddIndex(
            model_name='withdrawal',
            index=models.Index(fields=['status', '-requested_at'], name='withdrawal_status_idx'),
        ),
        migrations.AddIndex(
            model_name='lightcodeearnings',
            index=models.Index(fields=['-created_at'], name='lightcode_earn_created_idx'),
        ),
        migrations.AddIndex(
            model_name='lightcodeearnings',
            index=models.Index(fields=['seller', '-created_at'], name='lightcode_earn_seller_idx'),
        ),
    ]
