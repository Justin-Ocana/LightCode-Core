"""
Endpoints para el mod PlugsEssentials (lightcode Delivery).

Rutas:
  GET  /api/mc/commands/          → devuelve comandos pending, los marca processing
  POST /api/mc/commands/confirm/  → confirma ejecución (completed o failed)
  GET  /mc-internal/test/<token>/ → página de prueba (URL secreta, no indexada)
"""
import json
import secrets
import logging
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from apps.stores.models import Store
from .mod_models import ModCommand

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _get_store_by_api_key(api_key):
    """Devuelve la tienda correspondiente a la api_key, o None si no existe."""
    if not api_key:
        return None
    try:
        return Store.objects.get(mod_api_key=api_key, is_deleted=False)
    except Store.DoesNotExist:
        return None


def _json_error(message, status=400):
    return JsonResponse({'error': message}, status=status)


# ─────────────────────────────────────────────
# GET /api/mc/commands/
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET'])
def mc_get_commands(request):
    """
    El mod hace polling aquí cada N segundos.
    Devuelve todos los comandos pending y los marca como processing
    en una transacción atómica para evitar duplicados.
    """
    api_key = request.GET.get('api_key') or request.headers.get('X-Api-Key')
    store = _get_store_by_api_key(api_key)

    if not store:
        return _json_error('api_key inválida o tienda no encontrada.', 401)

    with transaction.atomic():
        pending = list(
            ModCommand.objects.select_for_update()
            .filter(store=store, status=ModCommand.Status.PENDING)
            .order_by('created_at')[:50]  # máximo 50 por batch
        )

        now = timezone.now()
        ids = [cmd.id for cmd in pending]
        ModCommand.objects.filter(id__in=ids).update(
            status=ModCommand.Status.PROCESSING,
            processing_at=now,
            updated_at=now,
        )

    # Actualizar último poll del mod
    from apps.stores.models import Store as StoreModel
    StoreModel.objects.filter(pk=store.pk).update(mod_last_poll=timezone.now())

    commands_data = [
        {
            'id':             str(cmd.id),
            'cmd':            cmd.get_resolved_command(),
            'player':         cmd.player,
            'source':         cmd.source,
            'exec':           cmd.exec_type,
            'delay':          cmd.delay_seconds,
            'required_slots': cmd.required_slots,
        }
        for cmd in pending
    ]

    return JsonResponse({'commands': commands_data})


# ─────────────────────────────────────────────
# GET /api/mc/pending-claims/
# Comandos en estado pending_claim agrupados por jugador
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET'])
def mc_pending_claims(request):
    """
    El mod consulta esto para saber qué jugadores tienen compras pendientes de reclamar.
    Devuelve: { "claims": [{ "player": "...", "count": N, "total_slots": N }] }
    """
    api_key = request.GET.get('api_key') or request.headers.get('X-Api-Key')
    store = _get_store_by_api_key(api_key)
    if not store:
        return _json_error('api_key inválida.', 401)

    from django.db.models import Count, Sum
    claims = (
        ModCommand.objects
        .filter(store=store, status=ModCommand.Status.PENDING_CLAIM)
        .values('player')
        .annotate(count=Count('id'), total_slots=Sum('required_slots'))
        .order_by('player')
    )

    # Actualizar último poll
    from apps.stores.models import Store as StoreModel
    StoreModel.objects.filter(pk=store.pk).update(mod_last_poll=timezone.now())

    return JsonResponse({'claims': list(claims)})


# ─────────────────────────────────────────────
# POST /api/mc/claim/
# El jugador ejecuta !lightcode claim — entrega el siguiente comando
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def mc_claim_command(request):
    """
    El mod llama aquí cuando el jugador ejecuta !lightcode claim.
    Body: { "api_key": "...", "player": "nombre_jugador", "free_slots": N }
    Devuelve el siguiente comando a ejecutar para ese jugador.
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return _json_error('Body JSON inválido.')

    api_key = body.get('api_key') or request.headers.get('X-Api-Key')
    store = _get_store_by_api_key(api_key)
    if not store:
        return _json_error('api_key inválida.', 401)

    player = body.get('player', '').strip()
    free_slots = int(body.get('free_slots', 0))

    if not player:
        return _json_error('Falta el campo "player".')

    # ── Anti-spam: si el jugador ya tiene un comando en processing, bloquearlo ──
    # Esto evita que spamear !lightcode claim entregue más items de los comprados.
    in_processing = ModCommand.objects.filter(
        store=store,
        player=player,
        status=ModCommand.Status.PROCESSING
    ).exists()

    if in_processing:
        return JsonResponse({
            'ok': True,
            'has_claim': True,
            'can_claim': False,
            'blocked': True,
            'message': 'Tu entrega anterior aún está en proceso. Espera un momento antes de volver a ejecutar el comando.',
        })

    # Obtener el siguiente comando pending_claim para este jugador
    # Usar select_for_update para evitar race conditions con requests simultáneos
    with transaction.atomic():
        cmd = (
            ModCommand.objects
            .select_for_update(skip_locked=True)
            .filter(store=store, player=player, status=ModCommand.Status.PENDING_CLAIM)
            .order_by('created_at')
            .first()
        )

        if not cmd:
            return JsonResponse({'ok': True, 'has_claim': False, 'message': 'No tienes compras pendientes.'})

        # Verificar slots
        if cmd.required_slots > 0 and free_slots < cmd.required_slots:
            total_pending = ModCommand.objects.filter(
                store=store, player=player, status=ModCommand.Status.PENDING_CLAIM
            ).count()
            return JsonResponse({
                'ok': True,
                'has_claim': True,
                'can_claim': False,
                'required_slots': cmd.required_slots,
                'free_slots': free_slots,
                'pending_count': total_pending,
                'message': f'Necesitas {cmd.required_slots} slots libres en tu inventario. Tienes {free_slots}.',
            })

        # Marcar como processing dentro de la misma transacción atómica
        cmd.status = ModCommand.Status.PROCESSING
        cmd.processing_at = timezone.now()
        cmd.save(update_fields=['status', 'processing_at', 'updated_at'])

    # Contar cuántas quedan después de esta
    remaining = ModCommand.objects.filter(
        store=store, player=player, status=ModCommand.Status.PENDING_CLAIM
    ).count()

    return JsonResponse({
        'ok': True,
        'has_claim': True,
        'can_claim': True,
        'id':             str(cmd.id),
        'cmd':            cmd.get_resolved_command(),
        'exec':           cmd.exec_type,
        'delay':          cmd.delay_seconds,
        'required_slots': cmd.required_slots,
        'remaining':      remaining,
    })


# ─────────────────────────────────────────────
# POST /api/mc/commands/confirm/
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def mc_confirm_command(request):
    """
    El mod llama aquí después de ejecutar cada comando.
    Body JSON: { "api_key": "...", "id": "uuid", "success": true, "error": "" }
    """
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return _json_error('Body JSON inválido.')

    api_key = body.get('api_key') or request.headers.get('X-Api-Key')
    store = _get_store_by_api_key(api_key)

    if not store:
        return _json_error('api_key inválida o tienda no encontrada.', 401)

    command_id = body.get('id')
    if not command_id:
        return _json_error('Falta el campo "id".')

    try:
        cmd = ModCommand.objects.get(id=command_id, store=store)
    except ModCommand.DoesNotExist:
        return _json_error('Comando no encontrado.', 404)

    # Solo se puede confirmar si está en processing
    if cmd.status not in (ModCommand.Status.PROCESSING, ModCommand.Status.PENDING):
        return JsonResponse({'ok': True, 'status': cmd.status, 'note': 'Ya procesado.'})

    success = body.get('success', True)
    if success:
        cmd.mark_completed()

        # Si el comando pertenece a una orden, verificar si todos los comandos
        # de esa orden están completados para marcarla como entregada
        if cmd.order_id:
            try:
                from .models import Order, OrderStatusHistory
                from .services import OrderService

                order = cmd.order
                # Verificar que todos los ModCommands de esta orden estén completados
                total = ModCommand.objects.filter(order=order).count()
                completed = ModCommand.objects.filter(
                    order=order,
                    status=ModCommand.Status.COMPLETED
                ).count()

                if total > 0 and completed >= total:
                    # Todos los comandos ejecutados → marcar orden como entregada
                    if order.status not in (Order.Status.DELIVERED, Order.Status.CANCELLED, Order.Status.REFUNDED):
                        OrderService.mark_order_delivered(order)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error updating order status after mod confirm: {e}")
    else:
        cmd.mark_failed(error=body.get('error', 'Error desconocido desde el mod'))

    return JsonResponse({'ok': True, 'status': cmd.status})


# ─────────────────────────────────────────────
# Página de prueba (URL secreta)
# GET /mc-internal/test/<token>/
# ─────────────────────────────────────────────

def mc_test_page(request, token):
    """
    Página de prueba simple para verificar que el flujo funciona.
    Solo accesible con el token secreto definido en settings.
    No aparece en ningún menú ni enlace de la app.
    """
    expected = getattr(settings, 'MC_TEST_PAGE_TOKEN', None)
    if not expected or not secrets.compare_digest(token, expected):
        return HttpResponse('Not found.', status=404)

    # Obtener estadísticas básicas para mostrar en la página
    total     = ModCommand.objects.count()
    pending   = ModCommand.objects.filter(status='pending').count()
    processing= ModCommand.objects.filter(status='processing').count()
    completed = ModCommand.objects.filter(status='completed').count()
    failed    = ModCommand.objects.filter(status='failed').count()
    recent    = ModCommand.objects.select_related('store').order_by('-created_at')[:20]

    rows = ''.join(
        f"""<tr>
            <td>{c.created_at.strftime('%Y-%m-%d %H:%M:%S')}</td>
            <td>{c.store.slug}</td>
            <td><code>{c.get_resolved_command()[:80]}</code></td>
            <td>{c.player or '—'}</td>
            <td><span class="badge badge-{c.status}">{c.status}</span></td>
            <td>{c.source}</td>
        </tr>"""
        for c in recent
    )

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex,nofollow">
<title>lightcode · MC Delivery Test</title>
<style>
  body {{ font-family: monospace; background: #0f0f0f; color: #e0e0e0; padding: 2rem; }}
  h1 {{ color: #6ee7b7; }}
  .stats {{ display: flex; gap: 1.5rem; margin: 1.5rem 0; flex-wrap: wrap; }}
  .stat {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1rem 1.5rem; }}
  .stat .num {{ font-size: 2rem; font-weight: bold; color: #6ee7b7; }}
  .stat .label {{ color: #888; font-size: 0.85rem; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 1.5rem; }}
  th {{ background: #1a1a1a; padding: 0.6rem 1rem; text-align: left; color: #6ee7b7; border-bottom: 1px solid #333; }}
  td {{ padding: 0.5rem 1rem; border-bottom: 1px solid #222; font-size: 0.85rem; }}
  tr:hover td {{ background: #1a1a1a; }}
  code {{ color: #fbbf24; }}
  .badge {{ padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }}
  .badge-pending    {{ background: #78350f; color: #fde68a; }}
  .badge-processing {{ background: #1e3a5f; color: #93c5fd; }}
  .badge-completed  {{ background: #064e3b; color: #6ee7b7; }}
  .badge-failed     {{ background: #450a0a; color: #fca5a5; }}
  .test-form {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; margin-top: 2rem; max-width: 600px; }}
  .test-form input, .test-form select {{ background: #0f0f0f; border: 1px solid #444; color: #e0e0e0; padding: 0.5rem; border-radius: 4px; width: 100%; margin-bottom: 0.75rem; }}
  .test-form button {{ background: #059669; color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 4px; cursor: pointer; }}
  .test-form button:hover {{ background: #047857; }}
  #result {{ margin-top: 1rem; padding: 0.75rem; background: #0f0f0f; border-radius: 4px; white-space: pre; font-size: 0.8rem; display: none; }}
</style>
</head>
<body>
<h1>🟢 lightcode · MC Delivery</h1>
<p style="color:#888">Página de prueba interna · No indexada · <strong style="color:#fbbf24">No compartir esta URL</strong></p>

<div class="stats">
  <div class="stat"><div class="num">{total}</div><div class="label">Total</div></div>
  <div class="stat"><div class="num" style="color:#fde68a">{pending}</div><div class="label">Pending</div></div>
  <div class="stat"><div class="num" style="color:#93c5fd">{processing}</div><div class="label">Processing</div></div>
  <div class="stat"><div class="num">{completed}</div><div class="label">Completed</div></div>
  <div class="stat"><div class="num" style="color:#fca5a5">{failed}</div><div class="label">Failed</div></div>
</div>

<div class="test-form">
  <h3 style="margin-top:0;color:#6ee7b7">Crear comando de prueba</h3>
  <input id="f-apikey" placeholder="api_key de la tienda" />
  <input id="f-player" placeholder="Nombre del jugador (opcional)" />
  <input id="f-cmd" placeholder='Comando, ej: give {"{player}"} diamond 1' value='say Hola {"{player}"} desde lightcode!' />
  <select id="f-source">
    <option value="manual">manual (panel)</option>
    <option value="order">order (compra)</option>
  </select>
  <select id="f-exec">
    <option value="player">player (desde jugador)</option>
    <option value="world">world (desde overworld)</option>
  </select>
  <button onclick="createTest()">Crear comando</button>
  <div id="result"></div>
</div>

<h2 style="margin-top:2rem">Últimos 20 comandos</h2>
<table>
  <thead><tr><th>Fecha</th><th>Tienda</th><th>Comando</th><th>Player</th><th>Estado</th><th>Origen</th></tr></thead>
  <tbody>{rows}</tbody>
</table>

<script>
async function createTest() {{
  const apiKey = document.getElementById('f-apikey').value.trim();
  const player = document.getElementById('f-player').value.trim();
  const cmd    = document.getElementById('f-cmd').value.trim();
  const source = document.getElementById('f-source').value;
  const exec   = document.getElementById('f-exec').value;
  const res = document.getElementById('result');
  res.style.display = 'block';
  res.textContent = 'Enviando...';
  try {{
    const r = await fetch('/api/mc/commands/test-create/', {{
      method: 'POST',
      headers: {{'Content-Type': 'application/json'}},
      body: JSON.stringify({{ api_key: apiKey, player, command: cmd, source, exec_type: exec }})
    }});
    const data = await r.json();
    res.textContent = JSON.stringify(data, null, 2);
    setTimeout(() => location.reload(), 1500);
  }} catch(e) {{
    res.textContent = 'Error: ' + e.message;
  }}
}}
</script>
</body>
</html>"""

    return HttpResponse(html)


# ─────────────────────────────────────────────
# POST /api/mc/commands/test-create/
# Solo para la página de prueba interna
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def mc_test_create(request):
    """Crea un ModCommand de prueba desde la página interna."""
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return _json_error('Body JSON inválido.')

    api_key = body.get('api_key')
    store = _get_store_by_api_key(api_key)
    if not store:
        return _json_error('api_key inválida.', 401)

    cmd = ModCommand.objects.create(
        store=store,
        command=body.get('command', 'say test'),
        player=body.get('player', ''),
        source=body.get('source', ModCommand.Source.MANUAL),
        exec_type=body.get('exec_type', ModCommand.ExecType.PLAYER),
    )

    return JsonResponse({
        'ok': True,
        'id': str(cmd.id),
        'cmd': cmd.get_resolved_command(),
        'status': cmd.status,
    })


# ─────────────────────────────────────────────
# GET /api/mc/status/
# Estado del mod para el dashboard
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET'])
def mc_status(request, store_id):
    """
    Devuelve el estado de conexión del mod y estadísticas de comandos.
    Requiere autenticación JWT (llamado desde el dashboard del seller).
    """
    from apps.stores.models import Store
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework.exceptions import AuthenticationFailed

    # Autenticar via JWT manualmente (la vista no usa DRF views)
    try:
        auth = JWTAuthentication()
        result = auth.authenticate(request)
        if result is None:
            return _json_error('No autorizado.', 401)
        user, _ = result
    except Exception:
        return _json_error('No autorizado.', 401)

    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return _json_error('Tienda no encontrada.', 404)

    if store.owner != user:
        return _json_error('No autorizado.', 403)

    now = timezone.now()
    last_poll = store.mod_last_poll

    # Considerar "conectado" si el último poll fue hace menos de 30s
    is_connected = last_poll and (now - last_poll).total_seconds() < 30

    stats = {
        'pending':    ModCommand.objects.filter(store=store, status='pending').count(),
        'processing': ModCommand.objects.filter(store=store, status='processing').count(),
        'completed':  ModCommand.objects.filter(store=store, status='completed').count(),
        'failed':     ModCommand.objects.filter(store=store, status='failed').count(),
    }

    return JsonResponse({
        'connected':    is_connected,
        'last_poll':    last_poll.isoformat() if last_poll else None,
        'last_poll_ago': int((now - last_poll).total_seconds()) if last_poll else None,
        'has_api_key':  bool(store.mod_api_key),
        'stats':        stats,
    })


# ─────────────────────────────────────────────
# POST /api/mc/generate-key/
# Genera o regenera la API key del mod
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET'])
def mc_get_key(request, store_id):
    """Devuelve la API key actual de la tienda (solo al dueño)."""
    from apps.stores.models import Store
    from rest_framework_simplejwt.authentication import JWTAuthentication

    try:
        auth = JWTAuthentication()
        result = auth.authenticate(request)
        if result is None:
            return _json_error('No autorizado.', 401)
        user, _ = result
    except Exception:
        return _json_error('No autorizado.', 401)

    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return _json_error('Tienda no encontrada.', 404)

    if store.owner != user:
        return _json_error('No autorizado.', 403)

    return JsonResponse({
        'api_key': store.mod_api_key or '',
        'has_api_key': bool(store.mod_api_key),
    })


@csrf_exempt
@require_http_methods(['POST'])
def mc_generate_key(request, store_id):
    """Genera una nueva API key para el mod. Invalida la anterior."""
    from apps.stores.models import Store
    from rest_framework_simplejwt.authentication import JWTAuthentication

    try:
        auth = JWTAuthentication()
        result = auth.authenticate(request)
        if result is None:
            return _json_error('No autorizado.', 401)
        user, _ = result
    except Exception:
        return _json_error('No autorizado.', 401)

    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return _json_error('Tienda no encontrada.', 404)

    if store.owner != user:
        return _json_error('No autorizado.', 403)

    key = store.generate_mod_api_key()
    return JsonResponse({'api_key': key})


# ─────────────────────────────────────────────
# POST /api/mc/test-delivery/
# Envía un comando de prueba al servidor
# ─────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def mc_test_delivery(request, store_id):
    """Crea un comando de prueba para verificar que el mod funciona."""
    from apps.stores.models import Store
    from rest_framework_simplejwt.authentication import JWTAuthentication

    try:
        auth = JWTAuthentication()
        result = auth.authenticate(request)
        if result is None:
            return _json_error('No autorizado.', 401)
        user, _ = result
    except Exception:
        return _json_error('No autorizado.', 401)

    try:
        store = Store.objects.get(id=store_id, is_deleted=False)
    except Store.DoesNotExist:
        return _json_error('Tienda no encontrada.', 404)

    if store.owner != user:
        return _json_error('No autorizado.', 403)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return _json_error('Body JSON inválido.')

    message = body.get('message', '¡lightcode conectado correctamente!')
    player = body.get('player', '')

    cmd = ModCommand.objects.create(
        store=store,
        command=f'say {message}',
        player=player,
        source=ModCommand.Source.MANUAL,
        exec_type=ModCommand.ExecType.WORLD,
    )

    return JsonResponse({
        'ok': True,
        'id': str(cmd.id),
        'message': 'Comando de prueba creado. Debería ejecutarse en los próximos 10 segundos.',
    })
