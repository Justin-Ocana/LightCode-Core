from django.urls import path
from . import views

urlpatterns = [
    # RCON Lab endpoints
    path('rcon/test-connection/', views.test_connection, name='rcon-test-connection'),
    path('rcon/execute/', views.execute_command, name='rcon-execute'),
    path('rcon/stress-test/', views.stress_test, name='rcon-stress-test'),
    path('rcon/batch/', views.batch_execute, name='rcon-batch'),
    path('rcon/check-player/', views.check_player_online, name='rcon-check-player'),
    path('rcon/test-delivery/', views.test_product_delivery, name='rcon-test-delivery'),
    path('rcon/session/', views.get_session_status, name='rcon-session-status'),
    
    # RCON Queue - Admin Global View
    path('rcon-queue/', views.get_rcon_queue, name='admin-rcon-queue'),
    path('rcon-queue/<int:store_id>/jobs/', views.get_store_rcon_jobs, name='admin-rcon-store-jobs'),
    path('rcon-queue/jobs/<uuid:job_id>/cancel/', views.cancel_rcon_job, name='admin-rcon-cancel-job'),
]
