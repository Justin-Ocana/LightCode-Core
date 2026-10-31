"""
WebSocket consumers for real-time notifications.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time notifications.
    Each user connects to their own notification channel.
    """
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope["user"]
        
        # Only allow authenticated users
        if self.user.is_anonymous or isinstance(self.user, AnonymousUser):
            await self.close()
            return
        
        # Create a unique channel for this user
        self.user_group_name = f'notifications_{self.user.id}'
        
        # Join user's notification group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to notifications'
        }))
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Handle messages from WebSocket (not used for now)."""
        pass
    
    # Handler for notification events
    async def notification_message(self, event):
        """
        Send notification to WebSocket.
        Called when a notification is sent to the group.
        """
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))
    
    # Handler for order updates
    async def order_update(self, event):
        """
        Send order update to WebSocket.
        Called when an order is updated.
        """
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'data': event['data']
        }))
    
    # Handler for RCON job updates
    async def rcon_job_update(self, event):
        """
        Send RCON job update to WebSocket.
        Called when an RCON job status changes.
        """
        await self.send(text_data=json.dumps({
            'type': 'rcon_job_update',
            'data': event['data']
        }))
