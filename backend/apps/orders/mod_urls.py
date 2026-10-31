"""
URLs para el sistema de entrega via mod (PlugsEssentials / lightcode Delivery).
"""
from django.urls import path
from . import mod_views

urlpatterns = [
    # Endpoints que consume el mod (polling y confirmación)
    path('commands/',              mod_views.mc_get_commands,    name='mc-get-commands'),
    path('commands/confirm/',      mod_views.mc_confirm_command, name='mc-confirm-command'),
    path('commands/test-create/',  mod_views.mc_test_create,     name='mc-test-create'),

    # Claim system (jugador reclama sus compras con !lightcode claim)
    path('pending-claims/',        mod_views.mc_pending_claims,  name='mc-pending-claims'),
    path('claim/',                 mod_views.mc_claim_command,   name='mc-claim-command'),

    # Dashboard del seller
    path('status/<uuid:store_id>/',        mod_views.mc_status,        name='mc-status'),
    path('key/<uuid:store_id>/',           mod_views.mc_get_key,       name='mc-get-key'),
    path('generate-key/<uuid:store_id>/',  mod_views.mc_generate_key,  name='mc-generate-key'),
    path('test-delivery/<uuid:store_id>/', mod_views.mc_test_delivery, name='mc-test-delivery'),
]
