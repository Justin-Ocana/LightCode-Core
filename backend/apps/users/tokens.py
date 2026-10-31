"""
Custom JWT tokens with context (store_id for buyers).
"""
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer that adds user_type and context to JWT claims.
    """
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['user_type'] = user.user_type
        token['username'] = user.username
        token['email'] = user.email
        
        return token


def get_tokens_for_seller(user):
    """
    Generate JWT tokens for seller.
    """
    refresh = RefreshToken.for_user(user)
    
    # Add custom claims
    refresh['user_type'] = 'seller'
    refresh['username'] = user.username
    refresh['email'] = user.email
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def get_tokens_for_buyer(user, store_id, buyer_id):
    """
    Generate JWT tokens for buyer with store context.
    
    CRITICAL: Buyer tokens include store_id to ensure they can only
    access resources from THAT specific store.
    """
    refresh = RefreshToken.for_user(user)
    
    # Add custom claims
    refresh['user_type'] = 'buyer'
    refresh['username'] = user.username
    refresh['email'] = user.email
    refresh['store_id'] = str(store_id)  # CRITICAL: Store context
    refresh['buyer_id'] = str(buyer_id)
    refresh['type'] = 'buyer'  # Added for middleware validation
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def get_tokens_for_admin(user):
    """
    Generate JWT tokens for admin.
    """
    refresh = RefreshToken.for_user(user)
    
    # Add custom claims
    refresh['user_type'] = 'admin'
    refresh['username'] = user.username
    refresh['is_superuser'] = user.is_superuser
    refresh['is_staff'] = user.is_staff
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }
